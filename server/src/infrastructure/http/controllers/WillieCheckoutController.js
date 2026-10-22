/**
 * WillieCheckoutController.js
 * ================================================
 * Checkout de la tienda Willie Inspired (presets, plantillas, plugins, servicios). 100% a OFFSZN, sin splits.
 *
 * El navegador solo manda ids + oferta; el precio sale de server/src/shared/store (catálogo + región).
 * PayPal guarda cada producto como item (sku = id del catálogo), así la captura entrega lo que se pagó
 * aunque el navegador mande otra cosa.
 *
 *   POST /api/willie/paypal/create   → crea la orden PayPal con el total del servidor
 *   POST /api/willie/paypal/capture  → captura y entrega (archivos, licencias, correos)
 *   POST /api/willie/yape/charge     → cobra con Yape (Mercado Pago Perú) el total del servidor y entrega
 */

import paypal from '@paypal/checkout-server-sdk';
import paypalClient from '../paypalClient.js';
import { supabase } from '../../database/connection.js';
import { getProduct } from '../../../shared/store/catalog.js';
import { regionForRequest, quoteForRequest, fulfillOrder } from '../../services/storeService.js';
import MetaCapiService from '../../services/MetaCapiService.js';
import { v4 as uuidv4 } from 'uuid';

const OFFSZN_MERCHANT_ID = 'MXV5F6X8JXG4S';
const REF_PREFIX = 'willie_';

const cleanEmail = (raw) => {
    const e = String(raw || '').trim().toLowerCase();
    if (!e.includes('@')) return null;
    return e.replace(/@gmsil\.com$/, '@gmail.com').replace(/@gmai\.com$/, '@gmail.com')
        .replace(/@gmial\.com$/, '@gmail.com').replace(/@hotmial\.com$/, '@hotmail.com');
};

// custom_id de PayPal (máx. 127): oferta, referencia de la oferta, variante A/B y región al crear.
const packMeta = ({ offerType, offerRef, variant, region }) =>
    [`o=${offerType || ''}`, `r=${offerRef || ''}`, `v=${variant || ''}`, `c=${region?.country || ''}`, `t=${region?.tier || ''}`]
        .join(';').slice(0, 127);
const unpackMeta = (s) => Object.fromEntries(String(s || '').split(';').map((kv) => kv.split('=')).filter((p) => p.length === 2));

// =========================================================
// POST /api/willie/paypal/create
// =========================================================
export const createWilliePayPalOrder = async (req, res) => {
    try {
        const q = await quoteForRequest(req);
        if (q.error) return res.status(q.status).json({ error: q.error, errors: q.quote?.errors });
        const { quote, region, offerRef } = q;
        const usd = (n) => ({ currency_code: 'USD', value: n.toFixed(2) });

        const items = quote.lines.map((l) => ({
            name: `${l.title}${l.os ? ` (${l.os === 'mac' ? 'Mac' : 'Win'})` : ''}`.slice(0, 127),
            sku: `${l.id}${l.os ? `:${l.os}` : ''}`.slice(0, 127),
            unit_amount: usd(l.unitUsd),
            quantity: '1',
            category: 'DIGITAL_GOODS'
        }));

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
            intent: 'CAPTURE',
            application_context: { brand_name: 'Willie Inspired', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING' },
            purchase_units: [{
                reference_id: `${REF_PREFIX}${uuidv4().substring(0, 8)}`,
                description: `Willie Inspired: ${quote.lines.map((l) => l.title).join(', ')}`.substring(0, 127),
                custom_id: packMeta({ offerType: quote.offerApplied?.type, offerRef, variant: req.body?.abVariant, region }),
                amount: {
                    ...usd(quote.totalUsd),
                    breakdown: {
                        item_total: usd(quote.subtotalUsd),
                        ...(quote.discountUsd > 0 ? { discount: usd(quote.discountUsd) } : {})
                    }
                },
                items,
                payee: { merchant_id: OFFSZN_MERCHANT_ID }
            }]
        });

        const response = await paypalClient.client().execute(request);
        const orderId = response.result.id;
        console.log(`[WillieCheckout] PayPal ${orderId} | $${quote.totalUsd.toFixed(2)} | ${quote.lines.length} items | ${region.country || '??'}/${region.tier}`);

        // Para el embudo (checkout iniciado). Si la tabla aún no existe, no bloquea el pago.
        const { error } = await supabase.from('store_orders').upsert({
            status: 'pending',
            payment_method: 'paypal',
            payment_ref: orderId,
            email: cleanEmail(req.body?.email),
            user_id: req.user?.userId || null,
            country: region.country,
            tier: region.tier,
            vpn_suspected: region.vpnSuspected,
            currency: region.currency?.code,
            subtotal_usd: quote.subtotalUsd,
            discount_usd: quote.discountUsd,
            total_usd: quote.totalUsd,
            offer_type: quote.offerApplied?.type || null,
            offer_ref: offerRef,
            ab_variant: req.body?.abVariant || null,
            lines: quote.lines,
            session_id: req.body?.sessionId || null
        }, { onConflict: 'payment_method,payment_ref' });
        if (error) console.warn('[WillieCheckout] store_orders pending:', error.message);

        return res.status(200).json({ id: orderId, totalUsd: quote.totalUsd });
    } catch (err) {
        console.error('[WillieCheckout Create] Error:', err.message, err.result || '');
        const userMsg = err.statusCode ? `PayPal rechazó la orden: ${err.message}` : 'Error al iniciar el pago con PayPal.';
        return res.status(err.statusCode || 500).json({ error: userMsg });
    }
};

// =========================================================
// POST /api/willie/paypal/capture
// =========================================================
export const captureWilliePayPalOrder = async (req, res) => {
    const { orderID, email } = req.body || {};
    if (!orderID) return res.status(400).json({ error: 'Falta el ID de orden de PayPal.' });

    try {
        const captureRequest = new paypal.orders.OrdersCaptureRequest(orderID);
        captureRequest.requestBody({});
        const captureResponse = await paypalClient.client().execute(captureRequest);
        if (captureResponse.result.status !== 'COMPLETED') {
            return res.status(400).json({ error: `PayPal captura no completada. Estado: ${captureResponse.result.status}` });
        }

        // Lo pagado sale de la orden guardada en PayPal (creada por este servidor), no del navegador.
        const orderRes = await paypalClient.client().execute(new paypal.orders.OrdersGetRequest(orderID));
        const unit = orderRes.result.purchase_units?.[0] || {};
        if (!String(unit.reference_id || '').startsWith(REF_PREFIX)) {
            console.error(`[WillieCheckout Capture] ${orderID} no es una orden de la tienda Willie`);
            return res.status(400).json({ error: 'Esta orden no pertenece a la tienda.' });
        }

        const lines = (unit.items || []).map((it) => {
            const [id, os] = String(it.sku || '').split(':');
            const product = getProduct(id);
            if (!product) return null;
            const price = parseFloat(it.unit_amount?.value || 0);
            return { id: product.id, title: product.title, category: product.category, kind: product.kind, delivery: product.delivery, os: os || null, unitUsd: price, lineUsd: price, free: false };
        }).filter(Boolean);

        const meta = unpackMeta(unit.custom_id);
        const captured = parseFloat(unit.payments?.captures?.[0]?.amount?.value || captureResponse.result.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || 0);
        const subtotal = parseFloat(unit.amount?.breakdown?.item_total?.value || captured);
        const quote = {
            subtotalUsd: subtotal,
            discountUsd: Math.round((subtotal - captured) * 100) / 100,
            totalUsd: captured,
            totalPen: null,
            offerApplied: meta.o ? { type: meta.o } : null
        };
        const live = await regionForRequest(req, req.body?.timezone);
        const region = { ...live, country: meta.c || live.country, tier: meta.t || live.tier };

        const payerEmail = captureResponse.result.payer?.email_address || orderRes.result.payer?.email_address || null;
        const buyerEmail = cleanEmail(email) || cleanEmail(payerEmail);

        const result = await fulfillOrder({
            lines,
            email: buyerEmail,
            extraEmails: [payerEmail],
            paymentMethod: 'paypal',
            paymentRef: orderID,
            quote,
            region,
            offerRef: meta.r || null,
            userId: req.user?.userId || null,
            abVariant: meta.v || null,
            sessionId: req.body?.sessionId || null
        });

        console.log(`[WillieCheckout Capture] ${orderID} entregado a ${buyerEmail} | $${captured.toFixed(2)}`);
        return res.status(200).json({
            success: true,
            status: 'completed',
            paypalOrderId: orderID,
            buyerEmail,
            totalUSD: captured,
            itemCount: lines.length,
            lines: lines.map((l) => ({ id: l.id, title: l.title, delivery: l.delivery })),
            licenses: result.licenses.map((l) => ({ name: l.name, key: l.key })),
            deliveryToken: result.delivery?.token || null,
            portalUrl: result.delivery?.portalUrl || null
        });
    } catch (err) {
        console.error('[WillieCheckout Capture] Error:', err.message, err.result || '');
        const userMsg = err.statusCode ? `PayPal no pudo completar la captura: ${err.message}` : 'Error al confirmar el pago.';
        return res.status(err.statusCode || 500).json({ error: userMsg });
    }
};

// =========================================================
// POST /api/willie/yape/charge
// =========================================================
export const chargeWillieYape = async (req, res) => {
    try {
        const { token, phoneNumber, deviceId, attribution = {} } = req.body || {};
        const email = cleanEmail(req.body?.email);
        if (!token) return res.status(400).json({ error: 'Falta el código de aprobación de Yape.' });
        if (!email) return res.status(400).json({ error: 'Por favor ingresa un correo electrónico válido.' });

        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!accessToken) return res.status(500).json({ error: 'Yape no está configurado en el servidor.' });

        const q = await quoteForRequest(req);
        if (q.error) return res.status(q.status).json({ error: q.error, errors: q.quote?.errors });
        const { quote, region, offerRef } = q;
        const amountPEN = quote.totalPen;
        const cleanPhone = String(phoneNumber || '').replace(/\D/g, '');
        const title = `Willie Inspired - ${quote.lines.map((l) => l.title).join(', ')}`.slice(0, 250);
        const externalReference = `WILLIE-YAPE-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        let mpData;
        if (token.startsWith('TEST_YAPE_') && accessToken.startsWith('TEST-')) {
            mpData = { id: `TEST_MP_${Date.now()}`, status: 'approved' };
        } else {
            // Sin notification_url: Yape responde al instante y el webhook general de OFFSZN no debe re-procesarlo.
            const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': `willie-yape-${externalReference}`,
                    ...(deviceId ? { 'X-Meli-Session-Id': deviceId } : {})
                },
                body: JSON.stringify({
                    token,
                    transaction_amount: amountPEN,
                    installments: 1,
                    payment_method_id: 'yape',
                    description: title,
                    external_reference: externalReference,
                    statement_descriptor: 'OFFSZN',
                    payer: { email, ...(cleanPhone ? { phone: { area_code: '51', number: cleanPhone } } : {}) },
                    additional_info: {
                        items: quote.lines.map((l) => ({
                            id: l.id, title: l.title, category_id: 'software', quantity: 1,
                            unit_price: Math.round(l.lineUsd * (quote.totalPen / quote.totalUsd) * 100) / 100
                        }))
                    },
                    metadata: { store: 'willie', usd_total: quote.totalUsd, lines: quote.lines.map((l) => l.id).join(',').slice(0, 400) }
                })
            });
            mpData = await mpRes.json();
            if (!mpRes.ok || mpData.status !== 'approved') {
                console.error('[WillieYape] Rechazado:', JSON.stringify(mpData).slice(0, 500));
                const detail = mpData.status_detail || '';
                const msg = detail.includes('insufficient_amount') ? 'Saldo insuficiente en Yape.'
                    : detail.includes('security_code') || detail.includes('otp') ? 'El código de aprobación es incorrecto o venció. Genera uno nuevo en tu app Yape.'
                        : 'Yape rechazó el pago. Verifica los datos o intenta con PayPal.';
                return res.status(400).json({ error: msg, status: mpData.status, status_detail: detail });
            }
        }

        const result = await fulfillOrder({
            lines: quote.lines,
            email,
            paymentMethod: 'yape',
            paymentRef: String(mpData.id),
            quote,
            region,
            offerRef,
            userId: req.user?.userId || null,
            abVariant: req.body?.abVariant || null,
            sessionId: req.body?.sessionId || null
        });

        try {
            await MetaCapiService.sendEvent({
                eventName: 'Purchase',
                eventSourceUrl: req.headers.referer || 'https://offszn.lat/willieinspired/checkout',
                userData: { email, phone: phoneNumber, fbc: attribution.fbc, fbp: attribution.fbp, ip: req.ip, userAgent: req.headers['user-agent'] },
                customData: { currency: 'USD', value: quote.totalUsd, content_type: 'product', content_ids: quote.lines.map((l) => l.id), order_id: String(mpData.id) }
            });
        } catch (capiErr) {
            console.warn('[WillieYape] Meta CAPI:', capiErr?.message);
        }

        return res.json({
            success: true,
            status: 'approved',
            paymentId: mpData.id,
            amountPEN,
            totalUSD: quote.totalUsd,
            lines: quote.lines.map((l) => ({ id: l.id, title: l.title, delivery: l.delivery })),
            licenses: result.licenses.map((l) => ({ name: l.name, key: l.key })),
            deliveryToken: result.delivery?.token || null,
            portalUrl: result.delivery?.portalUrl || null
        });
    } catch (error) {
        console.error('[WillieYape] Error:', error);
        return res.status(500).json({ error: 'Error interno al procesar el pago con Yape.' });
    }
};
