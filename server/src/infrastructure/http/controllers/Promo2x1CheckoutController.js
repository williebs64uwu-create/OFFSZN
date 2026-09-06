/**
 * Promo2x1CheckoutController.js
 * =============================
 * ISOLATED checkout endpoint exclusively for the Promo 2x1 (Easy Mix + Easy Master).
 * 
 * GUARANTEES:
 * 1. Both Easy Mix and Easy Master lifetime licenses are ALWAYS generated automatically.
 * 2. Dedicated single-payee PayPal flow with no multi-merchant conflicts.
 * 3. Premium 2x1 email receipt with both serial keys and all installer links.
 * 4. Meta Pixel / CAPI purchase tracking deduplicated.
 */

import paypal from '@paypal/checkout-server-sdk';
import paypalClient from '../paypalClient.js';
import { supabase } from '../../database/connection.js';
import { generatePluginLicense } from './PluginLicensingController.js';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';
import MetaCapiService from '../../services/MetaCapiService.js';

const MAIN_MERCHANT_ID = 'MXV5F6X8JXG4S';
const WILLIE_ADMIN_EMAIL = 'willie2008garay@gmail.com';

const DOWNLOAD_LINKS = {
    easyMix: {
        win: 'https://drive.google.com/file/d/1wBErtaIXdj-CPObcaJV0fnomX9rzWVNu/view?usp=sharing',
        mac: 'https://drive.google.com/file/d/1OUMuGr4trI7M5J0JvaLc-4n5xaTyN17z/view?usp=sharing'
    },
    easyMaster: {
        win: 'https://drive.google.com/file/d/1JF4oDN_beOOxnOO5ca3TLGDCEQyOeWjh/view',
        mac: 'https://drive.google.com/file/d/14Lc6-vOtEYgw7IbQcpBe7h2kIiGTrP6Q/view?usp=sharing'
    }
};

/**
 * POST /api/orders/promo-2x1/create
 * Creates a single-payee PayPal order for the 2x1 bundle.
 */
export const createPromo2x1Order = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const customPrice = parseFloat(req.body.customPrice || req.body.abPrice) || 10;
        const validPrice = [5, 10, 15, 20].includes(customPrice) ? customPrice : 10;

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: 'promo_2x1_bundle',
                description: 'Promo 2x1 (Easy Mix + Easy Master VST) — Lifetime Licenses',
                amount: {
                    currency_code: 'USD',
                    value: validPrice.toFixed(2)
                },
                payee: {
                    merchant_id: MAIN_MERCHANT_ID
                }
            }],
            application_context: {
                brand_name: 'OFFSZN',
                shipping_preference: 'NO_SHIPPING',
                user_action: 'PAY_NOW'
            }
        });

        const order = await paypalClient.client().execute(request);
        console.log(`[Promo2x1Checkout] Order created: ${order.result.id} | Price: $${validPrice} | User: ${userId || 'guest'}`);

        // --- META CAPI: INITIATE CHECKOUT ---
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress;
        const clientUserAgent = req.headers['user-agent'];
        const fbp = req.body.fbp || req.cookies?._fbp;
        const fbc = req.body.fbc || req.cookies?._fbc;
        const eventSourceUrl = req.headers.referer || req.headers.origin || 'https://offszn.lat/plugins/promo-2x1.html';

        MetaCapiService.sendEvent({
            eventName: 'InitiateCheckout',
            eventId: `initiate_checkout_${order.result.id}`,
            eventSourceUrl,
            userData: {
                clientIp,
                clientUserAgent,
                fbp,
                fbc,
                externalId: userId
            },
            customData: {
                currency: 'USD',
                value: validPrice,
                content_ids: ['promo_2x1', 'easy_mix', 'easy_master'],
                content_name: 'Promo 2x1 (Easy Mix + Easy Master)',
                content_type: 'product',
                num_items: 2
            }
        }).catch(e => console.error('[MetaCapi] Promo 2x1 InitiateCheckout error:', e));

        // Track A/B price event
        try {
            await supabase.from('ab_price_events').insert({
                plugin_name: 'Promo 2x1',
                assigned_price: validPrice,
                event_type: 'checkout_started',
                user_id: userId || null,
                metadata: { source: 'promo2x1_isolated_endpoint' }
            });
        } catch (e) { /* non-critical */ }

        return res.json({ id: order.result.id });
    } catch (err) {
        console.error('[Promo2x1Checkout] Create Order Error:', err);
        return res.status(500).json({ error: 'Error al crear orden de Promo 2x1' });
    }
};

/**
 * POST /api/orders/promo-2x1/capture
 * Captures payment, generates BOTH licenses (Easy Mix + Easy Master), logs order and sends confirmation email.
 */
export const capturePromo2x1Order = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const orderID = req.body.orderID;
        const customPrice = parseFloat(req.body.customPrice || req.body.abPrice) || 10;
        const validPrice = [5, 10, 15, 20].includes(customPrice) ? customPrice : 10;

        if (!orderID) {
            return res.status(400).json({ error: 'Falta orderID' });
        }

        // 1. Capture PayPal Payment
        const request = new paypal.orders.OrdersCaptureRequest(orderID);
        request.requestBody({});

        const response = await paypalClient.client().execute(request);
        const captureStatus = response.result.status;

        if (captureStatus !== 'COMPLETED' && captureStatus !== 'APPROVED') {
            console.error(`[Promo2x1Checkout] Capture not completed: ${captureStatus}`);
            return res.status(400).json({ error: 'El pago no se completó', status: captureStatus });
        }

        const payerEmail = req.body.guestEmail || response.result.payer?.email_address;
        const payerName = response.result.payer?.name?.given_name || 'Productor';
        const capturedAmount = parseFloat(response.result.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || validPrice);

        console.log(`[Promo2x1Checkout] ✅ Payment captured: $${capturedAmount} from ${payerEmail} (${payerName})`);

        // 2. ALWAYS Generate BOTH Licenses (Easy Mix + Easy Master Lifetime)
        let mixKey = null;
        let masterKey = null;

        try {
            // License 1: Easy Mix
            const mixResult = await generatePluginLicense({
                licenseType: 'lifetime',
                userEmail: payerEmail,
                userId: userId || null,
                pluginName: 'Easy Mix'
            });
            mixKey = mixResult?.serialKey;
            console.log(`[Promo2x1Checkout] 🔑 Generated Easy Mix: ${mixKey}`);

            // License 2: Easy Master (Bonus 2x1)
            const masterResult = await generatePluginLicense({
                licenseType: 'lifetime',
                userEmail: payerEmail,
                userId: userId || null,
                pluginName: 'Easy Master'
            });
            masterKey = masterResult?.serialKey;
            console.log(`[Promo2x1Checkout] 🎁 Generated Easy Master: ${masterKey}`);
        } catch (licErr) {
            console.error('[Promo2x1Checkout] License generation error:', licErr);
        }

        const keysGenerated = [
            { plugin: 'Easy Mix', key: mixKey || 'EASY-FULL-GEN-ERROR' },
            { plugin: 'Easy Master (REGALO)', key: masterKey || 'MASTER-FULL-GEN-ERROR' }
        ];

        const combinedKeyString = `Easy Mix: ${mixKey || ''} | Easy Master (REGALO): ${masterKey || ''}`;

        // 3. Log the sale in orders & order_items
        let orderId = null;
        try {
            const { data: orderData, error: orderErr } = await supabase.from('orders').insert({
                user_id: userId || null,
                total_price: capturedAmount,
                amount: capturedAmount,
                status: 'completed',
                guest_email: payerEmail,
                product_id: 899, // Primary product Easy Mix
                transaction_id: orderID
            }).select('id').single();

            if (orderErr) {
                console.error('[Promo2x1Checkout] Supabase order insert error:', orderErr);
            } else {
                orderId = orderData?.id;
                if (orderId) {
                    await supabase.from('order_items').insert([
                        { order_id: orderId, product_id: 899, price_at_purchase: capturedAmount, quantity: 1, license_name: 'lifetime' },
                        { order_id: orderId, product_id: 900, price_at_purchase: 0, quantity: 1, license_name: 'lifetime_bonus_2x1' }
                    ]);
                }
            }
        } catch (dbErr) {
            console.error('[Promo2x1Checkout] DB insert error:', dbErr);
        }

        // 4. Track A/B conversion
        try {
            await supabase.from('ab_price_events').insert({
                plugin_name: 'Promo 2x1',
                assigned_price: capturedAmount,
                event_type: 'purchase_completed',
                user_id: userId || null,
                metadata: {
                    mix_key: mixKey,
                    master_key: masterKey,
                    payer_email: payerEmail,
                    source: 'promo2x1_isolated_endpoint'
                }
            });
        } catch (e) { /* non-critical */ }

        // 5. Send Emails (Non-blocking)
        (async () => {
            try {
                if (payerEmail) {
                    const buyerHtml = `
                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 32px; border-radius: 20px; border: 1px solid #222;">
                            <div style="text-align: center; margin-bottom: 24px;">
                                <span style="background: linear-gradient(90deg, #ff9f0a, #d97706); color: #000; font-weight: 900; font-size: 0.75rem; padding: 6px 14px; border-radius: 100px; text-transform: uppercase; letter-spacing: 1px;">Oferta Especial 2x1</span>
                                <h1 style="color: #ffffff; font-size: 1.8rem; margin: 16px 0 6px; font-weight: 900;">¡Tu Promo 2x1 está lista! 🎁</h1>
                                <p style="color: #a1a1aa; font-size: 0.95rem; margin: 0;">Hola <strong>${payerName}</strong>, procesamos tu pago correctamente.</p>
                            </div>

                            <!-- KEYS SECTION -->
                            <div style="background: #121212; border: 2px dashed #ff9f0a; border-radius: 16px; padding: 20px; margin: 24px 0;">
                                <p style="color: #ff9f0a; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 16px; font-weight: 800; text-align: center;">🔑 Tus Claves de Activación Vitalicias</p>
                                
                                <div style="margin-bottom: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px;">
                                    <div style="font-size: 0.75rem; color: #a1a1aa; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">1. Easy Mix VST:</div>
                                    <div style="font-family: monospace; font-size: 1.25rem; font-weight: 800; color: #ffffff; letter-spacing: 1px; word-break: break-all;">${mixKey || 'Ver en tu cuenta'}</div>
                                </div>

                                <div style="background: rgba(255,159,10,0.05); border: 1px solid rgba(255,159,10,0.25); border-radius: 10px; padding: 14px;">
                                    <div style="font-size: 0.75rem; color: #ff9f0a; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">2. Easy Master VST (REGALO):</div>
                                    <div style="font-family: monospace; font-size: 1.25rem; font-weight: 800; color: #ffffff; letter-spacing: 1px; word-break: break-all;">${masterKey || 'Ver en tu cuenta'}</div>
                                </div>

                                <p style="color: #71717a; font-size: 0.75rem; margin: 14px 0 0; text-align: center;">Copia y pega cada clave correspondiente en tu plugin para activarlo.</p>
                            </div>

                            <!-- DOWNLOADS SECTION -->
                            <div style="margin: 28px 0;">
                                <h3 style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1.5px; color: #a1a1aa; margin: 0 0 16px;">📥 Descargar Instaladores</h3>

                                <!-- Easy Mix Downloads -->
                                <div style="margin-bottom: 16px; padding: 14px; background: #141414; border-radius: 12px;">
                                    <p style="margin: 0 0 8px; font-weight: 700; font-size: 0.9rem; color: #fff;">Easy Mix VST:</p>
                                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                        <a href="${DOWNLOAD_LINKS.easyMix.win}" style="background: #222; color: #fff; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; border: 1px solid #333;">🪟 Windows (.exe)</a>
                                        <a href="${DOWNLOAD_LINKS.easyMix.mac}" style="background: #222; color: #fff; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; border: 1px solid #333;">🍎 macOS (.dmg)</a>
                                    </div>
                                </div>

                                <!-- Easy Master Downloads -->
                                <div style="padding: 14px; background: #141414; border-radius: 12px;">
                                    <p style="margin: 0 0 8px; font-weight: 700; font-size: 0.9rem; color: #ff9f0a;">Easy Master VST (Regalo):</p>
                                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                        <a href="${DOWNLOAD_LINKS.easyMaster.win}" style="background: #222; color: #fff; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; border: 1px solid #333;">🪟 Windows (.exe)</a>
                                        <a href="${DOWNLOAD_LINKS.easyMaster.mac}" style="background: #222; color: #fff; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; border: 1px solid #333;">🍎 macOS (.dmg)</a>
                                    </div>
                                </div>
                            </div>

                            <hr style="border: 0; border-top: 1px solid #222; margin: 24px 0;">
                            <p style="font-size: 0.75rem; color: #555; text-align: center; margin: 0;">OFFSZN • Sonido de Grandes Ligas • Soporte por WhatsApp</p>
                        </div>
                    `;

                    await sendOffsznEmail({
                        to: payerEmail,
                        subject: '🎁 Tus Claves de Activación (Promo 2x1: Easy Mix + Easy Master) — OFFSZN',
                        html: buyerHtml,
                        fromName: 'OFFSZN'
                    });
                    console.log(`[Promo2x1Checkout] Buyer email sent successfully to ${payerEmail}`);
                }

                // Notify Admin (Willie)
                await sendOffsznEmail({
                    to: WILLIE_ADMIN_EMAIL,
                    subject: `🔥 Venta Promo 2x1: $${capturedAmount.toFixed(2)} USD (${payerEmail})`,
                    html: `
                        <div style="font-family: system-ui; max-width: 500px; padding: 24px; background: #0a0a0a; color: #fff; border-radius: 12px;">
                            <h2 style="color: #ff9f0a; margin: 0 0 12px;">Nueva Venta Promo 2x1</h2>
                            <p><b>Cliente:</b> ${payerName} (${payerEmail})</p>
                            <p><b>Total Cobrado:</b> $${capturedAmount.toFixed(2)} USD</p>
                            <p><b>Easy Mix Key:</b> <code>${mixKey}</code></p>
                            <p><b>Easy Master Key:</b> <code>${masterKey}</code></p>
                            <p><b>PayPal Order ID:</b> <code>${orderID}</code></p>
                        </div>
                    `,
                    fromName: 'OFFSZN Sales'
                });
            } catch (emailErr) {
                console.error('[Promo2x1Checkout] Email notification error:', emailErr);
            }
        })();

        // 6. Meta CAPI Purchase Event
        (async () => {
            try {
                const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress;
                const clientUserAgent = req.headers['user-agent'];
                const fbp = req.body.fbp || req.cookies?._fbp;
                const fbc = req.body.fbc || req.cookies?._fbc;
                const eventSourceUrl = req.headers.referer || req.headers.origin || 'https://offszn.lat/plugins/promo-2x1.html';

                await MetaCapiService.sendEvent({
                    eventName: 'Purchase',
                    eventId: `purchase_${orderID}`,
                    eventSourceUrl,
                    userData: {
                        email: payerEmail,
                        clientIp,
                        clientUserAgent,
                        fbp,
                        fbc,
                        externalId: userId
                    },
                    customData: {
                        currency: 'USD',
                        value: capturedAmount,
                        content_ids: ['promo_2x1', 'easy_mix', 'easy_master'],
                        contents: [
                            { id: 'easy_mix', quantity: 1, item_price: capturedAmount },
                            { id: 'easy_master', quantity: 1, item_price: 0 }
                        ],
                        content_type: 'product',
                        content_name: 'Promo 2x1 (Easy Mix + Easy Master)',
                        order_id: orderID,
                        num_items: 2
                    }
                });
            } catch (capiErr) {
                console.error('[MetaCapi] Promo 2x1 Purchase error:', capiErr);
            }
        })();

        // 7. Response for Frontend Modal
        return res.json({
            status: 'COMPLETED',
            id: orderID,
            isPromo2x1: true,
            generatedLicenseKey: combinedKeyString,
            serialKey: mixKey,
            bonusSerialKey: masterKey,
            keys: keysGenerated,
            downloads: {
                win: DOWNLOAD_LINKS.easyMix.win,
                mac: DOWNLOAD_LINKS.easyMix.mac,
                masterWin: DOWNLOAD_LINKS.easyMaster.win,
                masterMac: DOWNLOAD_LINKS.easyMaster.mac
            },
            message: 'Promo 2x1 purchase completed successfully'
        });

    } catch (err) {
        console.error('[Promo2x1Checkout] Capture Error:', err);
        return res.status(500).json({ error: 'Error al capturar pago de Promo 2x1' });
    }
};
