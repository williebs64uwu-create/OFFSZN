/**
 * CocaColaCheckoutController.js
 * =============================
 * ISOLATED checkout endpoint exclusively for Coca-Cola plugin (ID 903).
 * 
 * WHY: The main PayPalController uses multi-payee purchase_units which causes
 * "Payee passed in transaction does not match expected merchant" errors with
 * the PayPal SDK when partner emails / merchant IDs are involved.
 * 
 * SOLUTION: Collect 100% to OFFSZN (MXV5F6X8JXG4S), log partner owed amount
 * internally, generate license, and send emails — all in a simple, single-payee flow.
 * 
 * SPLIT:
 *   $15 sale → OFFSZN gets $5, partner owed $10
 *   $10 sale → OFFSZN gets $3, partner owed $7
 */

import paypal from '@paypal/checkout-server-sdk';
import paypalClient from '../paypalClient.js';
import { supabase } from '../../database/connection.js';
import { generatePluginLicense } from './PluginLicensingController.js';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';

const COKE_PRODUCT = {
    id: 903,
    name: 'Coca-Cola',
    producer_id: '8d2c03bf-2910-4af9-b75d-d6d9d3509bc2' // agustintitoo
};

const PARTNER_EMAIL = 'suarez.azocarn@gmail.com';
const MAIN_MERCHANT_ID = 'MXV5F6X8JXG4S';

/**
 * POST /api/orders/coke/create
 * Creates a simple single-payee PayPal order for Coca-Cola.
 */
export const createCokeOrder = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const customPrice = parseFloat(req.body.customPrice) || 15;
        const validPrice = (customPrice === 10 || customPrice === 15) ? customPrice : 15;

        // Simple single-payee order — all to OFFSZN
        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: 'coke_903',
                description: 'Coca-Cola VST Plugin — Lifetime License',
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

        const order = await paypalClient.execute(request);

        console.log(`[CokeCheckout] Order created: ${order.result.id} | Price: $${validPrice} | User: ${userId || 'guest'}`);

        // Track A/B price
        try {
            await supabase.from('ab_price_events').insert({
                plugin_name: 'Coca-Cola',
                assigned_price: validPrice,
                event_type: 'checkout_started',
                user_id: userId || null,
                metadata: { source: 'coke_isolated_endpoint' }
            });
        } catch (e) { /* non-critical */ }

        return res.json({ id: order.result.id });
    } catch (err) {
        console.error('[CokeCheckout] Create Order Error:', err);
        return res.status(500).json({ error: 'Error al crear orden de Coca-Cola' });
    }
};

/**
 * POST /api/orders/coke/capture
 * Captures the payment, generates license, logs partner split, sends emails.
 */
export const captureCokeOrder = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const orderID = req.body.orderID;
        const customPrice = parseFloat(req.body.customPrice) || 15;
        const validPrice = (customPrice === 10 || customPrice === 15) ? customPrice : 15;

        if (!orderID) {
            return res.status(400).json({ error: 'Falta orderID' });
        }

        // 1. Capture the payment
        const request = new paypal.orders.OrdersCaptureRequest(orderID);
        request.requestBody({});

        const response = await paypalClient.execute(request);
        const captureStatus = response.result.status;
        
        if (captureStatus !== 'COMPLETED') {
            console.error(`[CokeCheckout] Capture not completed: ${captureStatus}`);
            return res.status(400).json({ error: 'El pago no se completó', status: captureStatus });
        }

        const payerEmail = req.body.guestEmail || response.result.payer?.email_address;
        const payerName = response.result.payer?.name?.given_name || 'Cliente';
        const capturedAmount = parseFloat(response.result.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || validPrice);

        console.log(`[CokeCheckout] ✅ Payment captured: $${capturedAmount} from ${payerEmail} (${payerName})`);

        // 2. Calculate split
        const offsznShare = capturedAmount >= 15 ? 5.00 : 3.00;
        const partnerShare = capturedAmount - offsznShare;

        console.log(`[CokeCheckout] Split: OFFSZN=$${offsznShare.toFixed(2)} | Partner (${PARTNER_EMAIL})=$${partnerShare.toFixed(2)}`);

        // 3. Generate License
        let generatedKey = null;
        try {
            const licResult = await generatePluginLicense({
                licenseType: 'lifetime',
                userEmail: payerEmail,
                userId: userId,
                pluginName: 'Coca-Cola'
            });
            if (licResult?.serialKey) {
                generatedKey = licResult.serialKey;
                console.log(`[CokeCheckout] License generated: ${generatedKey}`);
            }
        } catch (licErr) {
            console.error('[CokeCheckout] License generation error:', licErr);
        }

        // 4. Log the sale in orders table
        try {
            await supabase.from('orders').insert({
                user_id: userId || null,
                total: capturedAmount,
                status: 'completed',
                payment_method: 'paypal',
                payment_details: {
                    paypal_order_id: orderID,
                    capture_id: response.result.purchase_units?.[0]?.payments?.captures?.[0]?.id,
                    payer_email: payerEmail,
                    payer_name: payerName,
                    product: 'Coca-Cola',
                    product_id: 903,
                    license_key: generatedKey,
                    partner_owed: partnerShare,
                    partner_email: PARTNER_EMAIL,
                    offszn_share: offsznShare,
                    source: 'coke_isolated_endpoint'
                }
            });
        } catch (dbErr) {
            console.error('[CokeCheckout] Order insert error:', dbErr);
        }

        // 5. Track A/B conversion
        try {
            await supabase.from('ab_price_events').insert({
                plugin_name: 'Coca-Cola',
                assigned_price: capturedAmount,
                event_type: 'purchase_completed',
                user_id: userId || null,
                metadata: {
                    serial_key: generatedKey,
                    payer_email: payerEmail,
                    source: 'coke_isolated_endpoint'
                }
            });
        } catch (e) { /* non-critical */ }

        // 6. Send Emails (non-blocking)
        (async () => {
            try {
                // A. Email to buyer
                if (payerEmail) {
                    const serialSection = generatedKey ? `
                        <div style="background:#111827; border:2px dashed #e61b2b; border-radius:12px; padding:20px; margin:20px 0; text-align:center;">
                            <p style="color:#e61b2b; font-size:0.8rem; text-transform:uppercase; letter-spacing:2px; margin:0 0 10px; font-weight:700;">🔑 Tu Serial Key FULL</p>
                            <p style="font-family:monospace; font-size:1.3rem; font-weight:800; color:#fff; letter-spacing:2px; margin:0; word-break:break-all;">${generatedKey}</p>
                            <p style="color:#888; font-size:0.78rem; margin:12px 0 0;">Guarda esta clave en un lugar seguro. La necesitarás para activar el plugin en tu DAW.</p>
                        </div>
                    ` : '';

                    await sendOffsznEmail({
                        to: payerEmail,
                        subject: '🎉 Tu compra de Coca-Cola VST está lista',
                        html: `
                            <div style="font-family:system-ui; max-width:600px; margin:0 auto; background:#0a0a0a; color:#fff; padding:30px; border-radius:16px;">
                                <h1 style="color:#e61b2b; font-size:1.5rem; margin:0 0 10px;">¡Gracias ${payerName}!</h1>
                                <p style="color:#aaa; margin:0 0 20px;">Tu compra de <strong>Coca-Cola VST</strong> se procesó correctamente.</p>
                                ${serialSection}
                                <div style="margin:20px 0;">
                                    <p style="color:#aaa; font-size:0.85rem; margin:0 0 10px;">📥 Descarga tu plugin:</p>
                                    <a href="https://drive.google.com/file/d/1cFKYYabnqLkVLeJDQYtWLixh93KzPwbN/view?usp=sharing" style="display:inline-block; background:#e61b2b; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:700; margin:4px;">Windows</a>
                                    <a href="https://drive.google.com/file/d/1y3oiTglmfpAQpxOjUb0aeXwenfjWz0J2/view?usp=sharing" style="display:inline-block; background:#333; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:700; margin:4px;">macOS</a>
                                </div>
                                <p style="color:#555; font-size:0.75rem; margin:20px 0 0;">OFFSZN — offszn.lat</p>
                            </div>
                        `
                    });
                    console.log(`[CokeCheckout] Buyer email sent to ${payerEmail}`);
                }

                // B. Notify Willie (admin) about sale + partner owed
                await sendOffsznEmail({
                    to: 'willie2008garay@gmail.com',
                    subject: `💰 Venta Coca-Cola: $${capturedAmount} (debes $${partnerShare.toFixed(2)} al partner)`,
                    html: `
                        <div style="font-family:system-ui; max-width:600px; margin:0 auto; background:#0a0a0a; color:#fff; padding:30px; border-radius:16px;">
                            <h2 style="color:#e61b2b;">Venta Coca-Cola</h2>
                            <table style="width:100%; color:#ccc; font-size:0.9rem;">
                                <tr><td>Cliente:</td><td>${payerName} (${payerEmail})</td></tr>
                                <tr><td>Total cobrado:</td><td><strong>$${capturedAmount.toFixed(2)}</strong></td></tr>
                                <tr><td>OFFSZN:</td><td>$${offsznShare.toFixed(2)}</td></tr>
                                <tr><td style="color:#e61b2b;">⚠️ Debes al partner:</td><td style="color:#e61b2b;"><strong>$${partnerShare.toFixed(2)}</strong></td></tr>
                                <tr><td>Partner PayPal:</td><td>${PARTNER_EMAIL}</td></tr>
                                <tr><td>Serial:</td><td style="font-family:monospace;">${generatedKey || 'N/A'}</td></tr>
                            </table>
                        </div>
                    `
                });
                console.log(`[CokeCheckout] Admin notification sent`);

                // C. Notify partner about their earnings
                await sendOffsznEmail({
                    to: PARTNER_EMAIL,
                    subject: `🎉 Ganaste $${partnerShare.toFixed(2)} USD por venta de Coca-Cola`,
                    html: `
                        <div style="font-family:system-ui; max-width:600px; margin:0 auto; background:#0a0a0a; color:#fff; padding:30px; border-radius:16px;">
                            <h2 style="color:#e61b2b;">¡Nueva venta de Coca-Cola!</h2>
                            <p style="color:#aaa;">Se vendió una licencia de Coca-Cola VST.</p>
                            <div style="background:#111; border-radius:12px; padding:20px; margin:15px 0;">
                                <p style="color:#fff; font-size:1.5rem; font-weight:800; margin:0;">$${partnerShare.toFixed(2)} USD</p>
                                <p style="color:#888; font-size:0.8rem; margin:5px 0 0;">Tu parte de esta venta</p>
                            </div>
                            <p style="color:#666; font-size:0.8rem;">El pago será transferido a tu PayPal (${PARTNER_EMAIL}) por OFFSZN.</p>
                        </div>
                    `
                });
                console.log(`[CokeCheckout] Partner notification sent to ${PARTNER_EMAIL}`);

            } catch (emailErr) {
                console.error('[CokeCheckout] Email error (non-critical):', emailErr.message);
            }
        })();

        // 7. Return success to frontend
        return res.json({
            status: 'COMPLETED',
            id: orderID,
            generatedLicenseKey: generatedKey,
            message: 'Coca-Cola purchase completed successfully'
        });

    } catch (err) {
        console.error('[CokeCheckout] Capture Error:', err);
        return res.status(500).json({ error: 'Error al capturar pago de Coca-Cola' });
    }
};
