/**
 * EasyPitchOfferCheckoutController.js
 * ===================================
 * ISOLATED checkout for the Easy Pitch purchase page (/plugin/easy-pitch/comprar).
 *
 * Fixed-price offers (validated server-side, never trusted from the client):
 *   - single: Easy Pitch                   → $7 USD  / S/ 27
 *   - bundle: Easy Pitch + Easy Master     → $9 USD  / S/ 34
 *
 * Flow (same as the other plugin checkouts):
 *   PayPal:  create order → buyer approves → capture → fulfill
 *   Yape:    MercadoPago.js token (frontend) → charge → fulfill
 *   Fulfill: generate lifetime license(s) (each one sends its activation email),
 *            log order + items, send receipt email to buyer and sale email to admin
 *            (Brevo via sendOffsznEmail), Meta CAPI Purchase.
 */

import fetch from 'node-fetch';
import paypal from '@paypal/checkout-server-sdk';
import paypalClient from '../paypalClient.js';
import { supabase } from '../../database/connection.js';
import { generatePluginLicense } from './PluginLicensingController.js';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';
import MetaCapiService from '../../services/MetaCapiService.js';

const MAIN_MERCHANT_ID = 'MXV5F6X8JXG4S';
const WILLIE_ADMIN_EMAIL = 'willie2008garay@gmail.com';
const PAGE_URL = 'https://offszn.lat/plugin/easy-pitch/comprar';

const PLUGINS = {
    'Easy Pitch': {
        productId: 5000,
        contentId: 'easy_pitch',
        downloads: {
            win: 'https://drive.google.com/file/d/1K58LeAnNJKUVJVKZ6kmm_xI8R9XHyQ0C/view?usp=sharing',
            mac: 'https://drive.google.com/file/d/1Say1PQ7AqdpI_10k5IT8hqgeGvpptRNW/view?usp=sharing'
        }
    },
    'Easy Master': {
        productId: 900,
        contentId: 'easy_master',
        downloads: {
            win: 'https://drive.google.com/file/d/1JF4oDN_beOOxnOO5ca3TLGDCEQyOeWjh/view?usp=sharing',
            mac: 'https://drive.google.com/file/d/14Lc6-vOtEYgw7IbQcpBe7h2kIiGTrP6Q/view?usp=sharing'
        }
    }
};

export const EASY_PITCH_OFFERS = {
    single: {
        name: 'Easy Pitch',
        usd: 7,
        pen: 27,
        plugins: ['Easy Pitch']
    },
    bundle: {
        name: 'Easy Pitch + Easy Master',
        usd: 9,
        pen: 34,
        plugins: ['Easy Pitch', 'Easy Master']
    }
};

function getOffer(key) {
    return EASY_PITCH_OFFERS[key] || null;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buyerEmailHtml({ offer, buyerName, licenses }) {
    const keysHtml = licenses.map((lic) => `
        <div style="margin-bottom: 12px; background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 16px;">
            <div style="font-size: 0.75rem; color: #a1a1aa; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">${escapeHtml(lic.plugin)}</div>
            <div style="font-family: monospace; font-size: 1.2rem; font-weight: 800; color: #ffffff; letter-spacing: 1px; word-break: break-all; margin-bottom: 12px;">${escapeHtml(lic.key || 'Ver en tu cuenta')}</div>
            <a href="${lic.downloads.win}" style="display: inline-block; background: #ffffff; color: #000000; text-decoration: none; padding: 8px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; margin-right: 6px;">Windows</a>
            <a href="${lic.downloads.mac}" style="display: inline-block; background: #262626; color: #ffffff; text-decoration: none; padding: 8px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 700;">macOS</a>
        </div>
    `).join('');

    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 32px; border-radius: 20px; border: 1px solid #222;">
            <h1 style="color: #ffffff; font-size: 1.6rem; margin: 0 0 8px; font-weight: 800;">¡Tu compra está lista!</h1>
            <p style="color: #a1a1aa; font-size: 0.95rem; margin: 0 0 24px;">Hola <strong style="color:#fff;">${escapeHtml(buyerName)}</strong>, gracias por comprar <strong style="color:#fff;">${escapeHtml(offer.name)}</strong>. Aquí tienes tus licencias de por vida y los instaladores.</p>
            ${keysHtml}
            <p style="color: #71717a; font-size: 0.8rem; margin: 20px 0 0;">Copia cada clave y pégala en su plugin la primera vez que lo abras en tu DAW.</p>
            <hr style="border: 0; border-top: 1px solid #222; margin: 24px 0;">
            <p style="font-size: 0.75rem; color: #555; text-align: center; margin: 0;">OFFSZN • ¿Dudas? Escríbenos por WhatsApp: +51 993 525 005</p>
        </div>
    `;
}

/**
 * Generates licenses, logs the order and sends emails. Never throws: a failure in any
 * step after the payment is logged and the buyer still gets whatever keys were created.
 */
async function fulfillOffer({ offer, offerKey, email, buyerName, userId, paidUsd, paidLabel, transactionId, method, req, extraAdminLines = '' }) {
    // 1. Licenses (generatePluginLicense also sends each activation email)
    const licenses = [];
    for (const pluginName of offer.plugins) {
        let key = null;
        try {
            const result = await generatePluginLicense({
                licenseType: 'lifetime',
                userEmail: email,
                userId: userId || null,
                pluginName
            });
            key = result?.serialKey || null;
            console.log(`[EasyPitchOffer] 🔑 ${pluginName}: ${key}`);
        } catch (licErr) {
            console.error(`[EasyPitchOffer] License generation error (${pluginName}):`, licErr);
        }
        licenses.push({ plugin: pluginName, key, downloads: PLUGINS[pluginName].downloads });
    }

    // 2. Order + items
    let orderId = null;
    try {
        const { data: orderData, error: orderErr } = await supabase.from('orders').insert({
            user_id: userId || null,
            total_price: paidUsd,
            amount: paidUsd,
            status: 'completed',
            guest_email: email,
            product_id: PLUGINS['Easy Pitch'].productId,
            transaction_id: transactionId
        }).select('id').single();

        if (orderErr) {
            console.error('[EasyPitchOffer] Order insert error:', orderErr);
        } else {
            orderId = orderData?.id;
            if (orderId) {
                await supabase.from('order_items').insert(offer.plugins.map((pluginName, idx) => ({
                    order_id: orderId,
                    product_id: PLUGINS[pluginName].productId,
                    price_at_purchase: idx === 0 ? paidUsd : 0,
                    quantity: 1,
                    license_name: offerKey === 'bundle' ? 'lifetime_easy_pitch_bundle' : 'lifetime'
                })));
            }
        }
    } catch (dbErr) {
        console.error('[EasyPitchOffer] DB insert exception:', dbErr);
    }

    // 3. Emails (non-blocking)
    (async () => {
        try {
            if (email) {
                await sendOffsznEmail({
                    to: email,
                    subject: `Tus licencias de ${offer.name} — OFFSZN`,
                    html: buyerEmailHtml({ offer, buyerName, licenses }),
                    fromName: 'OFFSZN'
                });
            }

            const keysList = licenses.map((l) => `<p><b>${escapeHtml(l.plugin)}:</b> <code>${escapeHtml(l.key || 'ERROR AL GENERAR')}</code></p>`).join('');
            await sendOffsznEmail({
                to: WILLIE_ADMIN_EMAIL,
                subject: `🔥 Venta ${offer.name} (${method}): ${paidLabel} — ${email}`,
                html: `
                    <div style="font-family: system-ui; max-width: 520px; padding: 24px; background: #0a0a0a; color: #fff; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
                        <h2 style="color: #f2379f; margin: 0 0 12px;">Nueva venta — Oferta Easy Pitch</h2>
                        <p><b>Paquete:</b> ${escapeHtml(offer.name)}</p>
                        <p><b>Método:</b> ${escapeHtml(method)}</p>
                        <p><b>Cliente:</b> ${escapeHtml(buyerName)} (${escapeHtml(email)})</p>
                        <p><b>Total cobrado:</b> ${escapeHtml(paidLabel)}</p>
                        ${extraAdminLines}
                        ${keysList}
                        <p><b>ID de transacción:</b> <code>${escapeHtml(transactionId)}</code></p>
                    </div>
                `,
                fromName: 'OFFSZN Ventas'
            });
        } catch (emailErr) {
            console.error('[EasyPitchOffer] Email error:', emailErr);
        }
    })();

    // 4. Meta CAPI Purchase (non-blocking)
    const attribution = req.body.attribution || req.body || {};
    MetaCapiService.sendEvent({
        eventName: 'Purchase',
        eventId: `purchase_${transactionId}`,
        eventSourceUrl: req.headers.referer || PAGE_URL,
        userData: {
            email,
            clientIp: req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress,
            clientUserAgent: req.headers['user-agent'],
            fbp: attribution.fbp || req.cookies?._fbp,
            fbc: attribution.fbc || req.cookies?._fbc,
            externalId: userId
        },
        customData: {
            currency: 'USD',
            value: paidUsd,
            content_ids: offer.plugins.map((p) => PLUGINS[p].contentId),
            content_type: 'product',
            content_name: offer.name,
            order_id: transactionId,
            num_items: offer.plugins.length
        }
    }).catch((e) => console.error('[EasyPitchOffer] Meta CAPI error:', e));

    return { licenses, orderId };
}

function successPayload({ offer, offerKey, licenses, transactionId }) {
    return {
        success: true,
        status: 'COMPLETED',
        id: transactionId,
        offer: offerKey,
        offerName: offer.name,
        serialKey: licenses[0]?.key || null,
        licenses
    };
}

/**
 * POST /api/orders/easy-pitch-offer/create
 * body: { offer: 'single' | 'bundle' }
 */
export const createEasyPitchOfferOrder = async (req, res) => {
    try {
        const offerKey = req.body.offer;
        const offer = getOffer(offerKey);
        if (!offer) {
            return res.status(400).json({ error: 'Paquete no válido' });
        }

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: `easy_pitch_${offerKey}`,
                custom_id: `easy_pitch_${offerKey}`,
                description: `${offer.name} — Licencia de por vida`,
                amount: { currency_code: 'USD', value: offer.usd.toFixed(2) },
                payee: { merchant_id: MAIN_MERCHANT_ID }
            }],
            application_context: {
                brand_name: 'OFFSZN',
                shipping_preference: 'NO_SHIPPING',
                user_action: 'PAY_NOW'
            }
        });

        const order = await paypalClient.client().execute(request);
        console.log(`[EasyPitchOffer] PayPal order created: ${order.result.id} | ${offer.name} $${offer.usd}`);

        MetaCapiService.sendEvent({
            eventName: 'InitiateCheckout',
            eventId: `initiate_checkout_${order.result.id}`,
            eventSourceUrl: req.headers.referer || PAGE_URL,
            userData: {
                clientIp: req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress,
                clientUserAgent: req.headers['user-agent'],
                fbp: req.body.fbp || req.cookies?._fbp,
                fbc: req.body.fbc || req.cookies?._fbc,
                externalId: req.user?.userId
            },
            customData: {
                currency: 'USD',
                value: offer.usd,
                content_ids: offer.plugins.map((p) => PLUGINS[p].contentId),
                content_name: offer.name,
                content_type: 'product',
                num_items: offer.plugins.length
            }
        }).catch((e) => console.error('[EasyPitchOffer] Meta CAPI InitiateCheckout error:', e));

        return res.json({ id: order.result.id });
    } catch (err) {
        console.error('[EasyPitchOffer] Create order error:', err);
        return res.status(500).json({ error: 'Error al crear la orden de pago' });
    }
};

/**
 * POST /api/orders/easy-pitch-offer/capture
 * body: { orderID, offer }
 */
export const captureEasyPitchOfferOrder = async (req, res) => {
    try {
        const { orderID } = req.body;
        const offerKey = req.body.offer;
        const offer = getOffer(offerKey);

        if (!orderID) return res.status(400).json({ error: 'Falta orderID' });
        if (!offer) return res.status(400).json({ error: 'Paquete no válido' });

        const request = new paypal.orders.OrdersCaptureRequest(orderID);
        request.prefer('return=representation');
        request.requestBody({});
        const response = await paypalClient.client().execute(request);

        if (response.result.status !== 'COMPLETED') {
            console.error(`[EasyPitchOffer] Capture not completed: ${response.result.status}`);
            return res.status(400).json({ error: 'El pago no se completó', status: response.result.status });
        }

        const capture = response.result.purchase_units?.[0]?.payments?.captures?.[0];
        const capturedAmount = parseFloat(capture?.amount?.value || '0');
        const capturedOffer = (capture?.custom_id || response.result.purchase_units?.[0]?.custom_id || '').replace('easy_pitch_', '');

        // The package delivered must match what was actually paid for.
        if ((capturedOffer && capturedOffer !== offerKey) || capturedAmount < offer.usd) {
            console.error(`[EasyPitchOffer] Mismatch: requested ${offerKey} ($${offer.usd}), paid ${capturedOffer} ($${capturedAmount}) | order ${orderID}`);
            return res.status(400).json({ error: 'El monto pagado no coincide con el paquete. Escríbenos por WhatsApp para ayudarte.' });
        }

        const email = req.body.guestEmail || response.result.payer?.email_address;
        const buyerName = response.result.payer?.name?.given_name || 'Productor';

        console.log(`[EasyPitchOffer] ✅ PayPal captured $${capturedAmount} — ${offer.name} — ${email}`);

        const { licenses } = await fulfillOffer({
            offer,
            offerKey,
            email,
            buyerName,
            userId: req.user?.userId,
            paidUsd: capturedAmount,
            paidLabel: `$${capturedAmount.toFixed(2)} USD`,
            transactionId: orderID,
            method: 'PayPal',
            req
        });

        return res.json(successPayload({ offer, offerKey, licenses, transactionId: orderID }));
    } catch (err) {
        console.error('[EasyPitchOffer] Capture error:', err);
        return res.status(500).json({ error: 'Error al procesar el pago' });
    }
};

/**
 * POST /api/orders/easy-pitch-offer/yape
 * body: { offer, token, email, phoneNumber, deviceId, attribution }
 */
export const chargeEasyPitchOfferYape = async (req, res) => {
    try {
        const { token, email, phoneNumber } = req.body;
        const offerKey = req.body.offer;
        const offer = getOffer(offerKey);

        if (!offer) return res.status(400).json({ error: 'Paquete no válido' });
        if (!token) return res.status(400).json({ error: 'Falta el token de autorización de Yape.' });
        if (!email || !email.includes('@')) return res.status(400).json({ error: 'Por favor ingresa un correo electrónico válido.' });

        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!accessToken) {
            console.error('[EasyPitchOffer] MERCADOPAGO_ACCESS_TOKEN not set.');
            return res.status(500).json({ error: 'Pasarela de Mercado Pago no configurada en el servidor.' });
        }

        const amountPEN = offer.pen;
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = (phoneNumber || '').trim().replace(/\D/g, '');
        const externalReference = `OFFSZN-YAPE-EP-${offerKey.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const phone = cleanPhone ? { area_code: '51', number: cleanPhone } : null;

        const mpPayload = {
            token,
            transaction_amount: amountPEN,
            installments: 1,
            description: `OFFSZN - ${offer.name} (Licencia Vitalicia)`,
            payment_method_id: 'yape',
            external_reference: externalReference,
            notification_url: 'https://offszn.lat/api/orders/mercadopago-webhook',
            statement_descriptor: 'OFFSZN',
            payer: { email: cleanEmail, ...(phone ? { phone } : {}) },
            additional_info: {
                items: [{
                    id: `easy-pitch-${offerKey}`,
                    title: `OFFSZN - ${offer.name}`,
                    description: `Licencia vitalicia oficial de ${offer.name} para producción musical - OFFSZN`,
                    category_id: 'software',
                    quantity: 1,
                    unit_price: amountPEN
                }],
                ...(phone ? { payer: { phone } } : {})
            },
            metadata: {
                product_id: PLUGINS['Easy Pitch'].productId,
                plugin_name: offer.name,
                offer: offerKey,
                usd_price: offer.usd,
                external_reference: externalReference
            }
        };

        let mpData;
        if (token.startsWith('TEST_YAPE_') && accessToken.startsWith('TEST-')) {
            console.log(`🧪 [EasyPitchOffer] Yape sandbox simulation for token ${token}`);
            mpData = { id: `TEST_MP_${Date.now()}`, status: 'approved', status_detail: 'accredited', transaction_amount: amountPEN };
        } else {
            const mpHeaders = {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': `yape-ep-${Date.now()}-${Math.random().toString(36).substring(7)}`
            };
            if (req.body.deviceId) mpHeaders['X-Meli-Session-Id'] = req.body.deviceId;

            const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: mpHeaders,
                body: JSON.stringify(mpPayload)
            });
            mpData = await mpRes.json();

            if (!mpRes.ok || mpData.status !== 'approved') {
                console.error('[EasyPitchOffer] Yape payment rejected:', JSON.stringify(mpData, null, 2));
                let friendlyMessage = 'No se pudo completar el pago con Yape. Verifica los datos ingresados.';
                if (mpData.status_detail === 'cc_rejected_bad_filled_security_code' || mpData.status_detail === 'bad_filled_security_code') {
                    friendlyMessage = 'El código de aprobación de Yape es incorrecto o ha expirado. Genera uno nuevo en tu app de Yape e inténtalo de nuevo.';
                } else if (mpData.status_detail === 'cc_rejected_insufficient_amount') {
                    friendlyMessage = 'Saldo insuficiente en tu cuenta de Yape.';
                } else if (mpData.status_detail === 'cc_rejected_call_for_authorize') {
                    friendlyMessage = 'La transacción no fue autorizada. Por favor verifica tu app de Yape.';
                } else if (mpData.message) {
                    friendlyMessage = `Mercado Pago: ${mpData.message}`;
                }
                return res.status(400).json({ error: friendlyMessage, status: mpData.status, status_detail: mpData.status_detail });
            }
        }

        console.log(`✅ [EasyPitchOffer] Yape approved S/ ${amountPEN} — ${offer.name} — ${cleanEmail} (MP ${mpData.id})`);

        const transactionId = `MP-YAPE-${mpData.id}`;
        const { licenses, orderId } = await fulfillOffer({
            offer,
            offerKey,
            email: cleanEmail,
            buyerName: 'Productor',
            userId: null,
            paidUsd: offer.usd,
            paidLabel: `S/ ${amountPEN} (~$${offer.usd} USD)`,
            transactionId,
            method: 'Yape',
            req,
            extraAdminLines: `<p><b>Teléfono:</b> ${escapeHtml(cleanPhone || '-')}</p>`
        });

        return res.json({
            ...successPayload({ offer, offerKey, licenses, transactionId }),
            status: 'approved',
            paymentId: mpData.id,
            orderId,
            amountPEN
        });
    } catch (err) {
        console.error('[EasyPitchOffer] Yape charge error:', err);
        return res.status(500).json({ error: err.message || 'Error interno al procesar el pago con Yape.' });
    }
};
