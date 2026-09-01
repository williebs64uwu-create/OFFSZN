/**
 * WillieCheckoutController.js
 * ================================================
 * Dedicated checkout backend for Willie Inspired storefront.
 * Handles presets & plugins for @willieinspired without producer splits.
 * 100% goes to OFFSZN (willie2008garay@gmail.com / MXV5F6X8JXG4S).
 *
 * Endpoints:
 *   POST /api/willie/paypal/create   → Creates PayPal order for preset/plugin cart
 *   POST /api/willie/paypal/capture  → Captures PayPal order + delivers files by email
 */

import paypal from '@paypal/checkout-server-sdk';
import paypalClient from '../paypalClient.js';
import { supabase } from '../../database/connection.js';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';
import { generatePluginLicense } from './PluginLicensingController.js';
import { v4 as uuidv4 } from 'uuid';

const OFFSZN_MERCHANT_ID = 'MXV5F6X8JXG4S';
const OFFSZN_MERCHANT_EMAIL = 'willie2008garay@gmail.com';

// =========================================================
// CATALOG LOCAL (presets & plugins de Willie Inspired)
// Si el producto no existe en la BD de OFFSZN, lo resolvemos
// desde este catálogo local para que el flujo no falle.
// =========================================================
const WILLIE_CATALOG = {
    // Presets FL Studio
    'preset-bad-bunny': { name: 'Bad Bunny Vocal Preset', price: 10, type: 'preset', image: '/willieimages/covers/bad-bunny-v2.png' },
    'preset-cris-mj':   { name: 'Cris Mj Vocal Preset', price: 10, type: 'preset', image: '/willieimages/covers/cris-mj.png' },
    'preset-yan-block': { name: 'Yan Block Vocal Preset', price: 10, type: 'preset', image: '/willieimages/covers/yan-block-v2.png' },
    'preset-roa':       { name: 'Roa Vocal Preset', price: 10, type: 'preset', image: '/willieimages/covers/roa-v2.png' },
    'preset-alejo':     { name: 'Alejo Vocal Preset', price: 10, type: 'preset', image: '/willieimages/covers/alejo-v2.png' },
    'preset-jovaan':    { name: 'Jovaan Vocal Preset', price: 10, type: 'preset', image: '/willieimages/covers/jovaan.png' },
    'preset-fanta-rosario': { name: 'Fanta Rosario Vocal Preset', price: 10, type: 'preset', image: '/willieimages/covers/fanta-rosario.png' },
    'preset-omar-courtz': { name: 'Omar Courtz Vocal Preset', price: 10, type: 'preset', image: '/willieimages/covers/omar-courtz-v2.png' },
    'preset-yeat':      { name: 'Yeat Vocal Preset', price: 10, type: 'preset', image: '/willieimages/covers/yeat.png' },
    'preset-the-kid-laroi': { name: 'The Kid LAROI Vocal Preset', price: 10, type: 'preset', image: '/willieimages/covers/the-kid-laroi.png' },
    'preset-yeyo':      { name: 'Yeyo Vocal Preset', price: 10, type: 'preset', image: '/willieimages/covers/yeyo-v2.png' },
    'preset-feid':      { name: 'Feid Vocal Preset',     price: 10, type: 'preset', image: '/willieimages/covers/feid.png' },
    'preset-myke':      { name: 'Myke Towers Vocal Preset', price: 10, type: 'preset', image: '/willieimages/HERO.png' },
    'preset-jhay':      { name: 'Jhay Cortez Vocal Preset', price: 10, type: 'preset', image: '/willieimages/covers/jhayco.jpg' },
    'preset-anuel':     { name: 'Anuel AA Vocal Preset',  price: 10, type: 'preset', image: '/willieimages/HERO.png' },
    'preset-karol-g':   { name: 'Karol G Vocal Preset',  price: 10, type: 'preset', image: '/willieimages/covers/karol-g.jpg' },
    'preset-maluma':    { name: 'Maluma Vocal Preset',    price: 10, type: 'preset', image: '/willieimages/HERO.png' },
    'preset-ozuna':     { name: 'Ozuna Vocal Preset',     price: 10, type: 'preset', image: '/willieimages/HERO.png' },
    'preset-j-balvin':  { name: 'J Balvin Vocal Preset',  price: 10, type: 'preset', image: '/willieimages/HERO.png' },
    'preset-sech':      { name: 'Sech Vocal Preset',      price: 10, type: 'preset', image: '/willieimages/HERO.png' },
    'preset-mora':      { name: 'Mora Vocal Preset',       price: 10, type: 'preset', image: '/willieimages/HERO.png' },
    'preset-rauw':      { name: 'Rauw Alejandro Vocal Preset', price: 10, type: 'preset', image: '/willieimages/HERO.png' },
    'bundle-all-presets': { name: 'Bundle Completo — Todos los Presets', price: 35, type: 'preset', image: '/willieimages/HERO.png' },
    // Plugins
    'plugin-easy-mix':    { name: 'Easy Mix VST/AU (OFFSZN)', price: 10, type: 'plugin', image: '/willieimages/HERO.png' },
    'plugin-easy-master': { name: 'Easy Master VST/AU (OFFSZN)', price: 10, type: 'plugin', image: '/willieimages/HERO.png' },
    'plugin-inka-kola':   { name: 'INKA KOLA VST/AU (OFFSZN)', price: 10, type: 'plugin', image: '/willieimages/HERO.png' },
    // Legacy numeric IDs (from offszn_cart compatibility)
    '899': { name: 'Easy Mix VST/AU (OFFSZN)', price: 10, type: 'plugin', image: '/willieimages/HERO.png' },
    '900': { name: 'Easy Master VST/AU (OFFSZN)', price: 10, type: 'plugin', image: '/willieimages/HERO.png' },
    '902': { name: 'INKA KOLA VST/AU (OFFSZN)', price: 10, type: 'plugin', image: '/willieimages/HERO.png' }
};

/**
 * Resolves an item ID to its catalog entry.
 * Falls back to DB lookup for unknown IDs.
 */
function resolveProduct(id, name, fallbackPrice) {
    if (WILLIE_CATALOG[id]) return WILLIE_CATALOG[id];
    if (WILLIE_CATALOG[String(id)]) return WILLIE_CATALOG[String(id)];
    // Fallback: use the name + price sent from frontend
    return {
        name: name || `Producto #${id}`,
        price: parseFloat(fallbackPrice) || 10,
        type: 'preset',
        image: '/willieimages/HERO.png'
    };
}

// =========================================================
// POST /api/willie/paypal/create
// =========================================================
export const createWilliePayPalOrder = async (req, res) => {
    try {
        const { cartItems, email, couponCode } = req.body;

        if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
            return res.status(400).json({ error: 'Carrito vacío. Agrega al menos un producto.' });
        }

        // Resolve & validate items
        const resolvedItems = cartItems.map(item => {
            const id = item.id || item.product?.id;
            const name = item.name || item.product?.name;
            const price = parseFloat(item.price || item.product?.price || item.variant_price) || 10;
            const qty = parseInt(item.quantity) || 1;
            const catalog = resolveProduct(id, name, price);

            return {
                id: String(id),
                name: catalog.name || name,
                unitPrice: catalog.price || price,
                quantity: qty,
                totalPrice: (catalog.price || price) * qty,
                type: catalog.type || 'preset',
                os: item.os || item.product?.os || null
            };
        });

        // Calculate total
        let subtotal = resolvedItems.reduce((acc, i) => acc + i.totalPrice, 0);

        // Simple coupon handling (server-side)
        const COUPON_MAP = {
            'WILLIE10': { type: 'percent', value: 10 },
            'OFFSZN':   { type: 'amount',  value: 5 },
            'SPECIAL':  { type: 'percent', value: 15 }
        };
        let discountAmount = 0;
        let appliedCoupon = null;
        if (couponCode) {
            const coupon = COUPON_MAP[couponCode.trim().toUpperCase()];
            if (coupon) {
                appliedCoupon = couponCode.trim().toUpperCase();
                if (coupon.type === 'percent') {
                    discountAmount = subtotal * (coupon.value / 100);
                } else {
                    discountAmount = Math.min(subtotal, coupon.value);
                }
            }
        }

        const grandTotal = Math.max(0.01, subtotal - discountAmount);

        const itemDescriptions = resolvedItems.map(i => {
            const osPart = (i.type === 'plugin' && i.os) ? ` [${i.os.toUpperCase()}]` : '';
            return `${i.name}${osPart} x${i.quantity}`;
        }).join(', ');

        // Build PayPal purchase unit — 100% to OFFSZN, no splits
        const purchaseUnit = {
            reference_id: `willie_${uuidv4().substring(0, 8)}`,
            description: `Willie Inspired: ${itemDescriptions}`.substring(0, 127),
            amount: {
                currency_code: 'USD',
                value: grandTotal.toFixed(2)
            },
            payee: {
                merchant_id: OFFSZN_MERCHANT_ID
            }
        };

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
            intent: 'CAPTURE',
            application_context: {
                brand_name: 'Willie Inspired',
                user_action: 'PAY_NOW',
                shipping_preference: 'NO_SHIPPING'
            },
            purchase_units: [purchaseUnit]
        });

        const response = await paypalClient.client().execute(request);
        const orderId = response.result.id;

        console.log(`[WillieCheckout] PayPal Order Created: ${orderId} | Total: $${grandTotal.toFixed(2)} | Items: ${resolvedItems.length}`);

        // Store order context in Supabase for capture lookup
        try {
            await supabase.from('willie_pending_orders').upsert({
                paypal_order_id: orderId,
                email: email || null,
                cart_snapshot: JSON.stringify(resolvedItems),
                coupon_code: appliedCoupon,
                discount_amount: discountAmount,
                total_usd: grandTotal,
                status: 'pending',
                created_at: new Date().toISOString()
            }, { onConflict: 'paypal_order_id' });
        } catch (dbErr) {
            // Non-fatal: log but continue
            console.warn('[WillieCheckout] Could not cache order in DB (table may not exist yet):', dbErr?.message);
        }

        return res.status(200).json({ id: orderId });

    } catch (err) {
        console.error('[WillieCheckout Create] Error:', err.message, err.result || '');
        const userMsg = err.statusCode
            ? `PayPal rechazó la orden: ${err.message}`
            : 'Error al iniciar el pago con PayPal.';
        return res.status(err.statusCode || 500).json({ error: userMsg });
    }
};

// =========================================================
// POST /api/willie/paypal/capture
// =========================================================
export const captureWilliePayPalOrder = async (req, res) => {
    const { orderID, email, cartItems } = req.body;

    if (!orderID) {
        return res.status(400).json({ error: 'Falta el ID de orden de PayPal.' });
    }

    try {
        // Capture PayPal
        const captureRequest = new paypal.orders.OrdersCaptureRequest(orderID);
        captureRequest.requestBody({});

        const captureResponse = await paypalClient.client().execute(captureRequest);
        const captureStatus = captureResponse.result.status;

        console.log(`[WillieCheckout Capture] Order ${orderID} → Status: ${captureStatus}`);

        if (captureStatus !== 'COMPLETED') {
            return res.status(400).json({ error: `PayPal captura no completada. Estado: ${captureStatus}` });
        }

        // Resolve cart items for delivery
        let resolvedItems = [];
        if (Array.isArray(cartItems) && cartItems.length > 0) {
            resolvedItems = cartItems.map(item => {
                const id = item.id || item.product?.id;
                const name = item.name || item.product?.name;
                const price = parseFloat(item.price || item.product?.price) || 10;
                const qty = parseInt(item.quantity) || 1;
                const catalog = resolveProduct(id, name, price);
                return {
                    id: String(id),
                    name: catalog.name || name,
                    unitPrice: catalog.price || price,
                    quantity: qty,
                    type: catalog.type || 'preset',
                    os: item.os || item.product?.os || null
                };
            });
        } else {
            // Try to recover from DB
            try {
                const { data: pending } = await supabase
                    .from('willie_pending_orders')
                    .select('cart_snapshot, email')
                    .eq('paypal_order_id', orderID)
                    .single();
                if (pending?.cart_snapshot) {
                    resolvedItems = JSON.parse(pending.cart_snapshot);
                }
            } catch (_) {}
        }

        const buyerEmail = email || captureResponse.result.payer?.email_address || null;
        const totalUSD = parseFloat(captureResponse.result.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || 0);

        // Record order in Supabase orders table
        let orderId = null;
        try {
            const { data: orderData } = await supabase.from('orders').insert({
                user_id: null,
                guest_email: buyerEmail,
                total_price: totalUSD,
                amount: totalUSD,
                status: 'completed',
                transaction_id: `WILLIE-PP-${orderID}`,
                product_id: null
            }).select('id').single();
            orderId = orderData?.id;
        } catch (dbErr) {
            console.warn('[WillieCheckout Capture] DB order insert error:', dbErr?.message);
        }

        // Update pending order status
        try {
            await supabase.from('willie_pending_orders')
                .update({ status: 'completed', completed_at: new Date().toISOString(), order_id: orderId })
                .eq('paypal_order_id', orderID);
        } catch (_) {}

        // Build item list for email
        const itemLines = resolvedItems.map(i => {
            const osPart = (i.type === 'plugin' && i.os) ? ` (${i.os.toUpperCase()})` : '';
            return `• ${i.name}${osPart} x${i.quantity} — $${(i.unitPrice * i.quantity).toFixed(2)}`;
        }).join('\n');

        // Generate plugin licenses if cart contains plugins (1 license per purchased plugin)
        const pluginLicensesGenerated = [];
        for (const i of resolvedItems) {
            if (i.type === 'plugin') {
                const pName = (i.name.toLowerCase().includes('master')) ? 'Easy Master' : ((i.name.toLowerCase().includes('inka')) ? 'Inka Kola' : 'Easy Mix');
                try {
                    const licRes = await generatePluginLicense({
                        licenseType: 'lifetime',
                        userEmail: buyerEmail,
                        userId: null,
                        pluginName: pName
                    });
                    if (licRes?.serialKey) {
                        pluginLicensesGenerated.push({ name: pName, key: licRes.serialKey });
                    }
                } catch (e) {
                    console.error('[WillieCheckout] License error:', e);
                }
            }
        }

        const pluginKeySection = pluginLicensesGenerated.length > 0 ? `
            <div style="background: #111114; border: 1px solid #742284; border-radius: 12px; padding: 18px; margin-bottom: 24px; text-align: center;">
                <p style="color: #ec4899; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px; font-weight: 700;">🔑 Tu(s) Clave(s) de Plugin</p>
                ${pluginLicensesGenerated.map(k => `
                    <div style="margin: 8px 0; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                        <p style="color: #a1a1aa; font-size: 0.8rem; margin: 0 0 4px;">${k.name}:</p>
                        <p style="font-family: monospace; font-size: 1.2rem; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: 1px; user-select: all;">${k.key}</p>
                    </div>
                `).join('')}
            </div>
        ` : '';

        // Send delivery email
        if (buyerEmail) {
            try {
                await sendOffsznEmail({
                    to: buyerEmail,
                    subject: '✅ ¡Tu compra en Willie Inspired está lista!',
                    html: `
                    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #09090b; color: #ffffff; border-radius: 16px; overflow: hidden;">
                        <div style="background: linear-gradient(135deg, #000000 0%, #1a0a24 100%); padding: 32px 28px; text-align: center;">
                            <h1 style="font-size: 1.6rem; font-weight: 900; letter-spacing: -0.03em; margin: 0;">WILLIE INSPIRED</h1>
                            <p style="color: #a78bfa; font-size: 0.85rem; margin: 6px 0 0;">by @willieinspired</p>
                        </div>
                        <div style="padding: 28px;">
                            <h2 style="font-size: 1.2rem; font-weight: 800; margin: 0 0 8px;">¡Pago confirmado! 🎉</h2>
                            <p style="color: #a1a1aa; font-size: 0.9rem; margin: 0 0 20px;">Hola, aquí tienes el resumen de tu compra:</p>
                            <div style="background: #111114; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin-bottom: 20px; white-space: pre-line; font-size: 0.88rem; color: #e4e4e7;">${itemLines}</div>
                            ${pluginKeySection}
                            <div style="background: #111114; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                                <p style="font-size: 0.8rem; color: #71717a; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Total pagado</p>
                                <p style="font-size: 1.4rem; font-weight: 900; margin: 0; color: #ffffff;">$${totalUSD.toFixed(2)} USD</p>
                            </div>
                            <div style="background: #1c1c22; border: 1px solid #3f3f46; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
                                <p style="font-size: 0.88rem; color: #e4e4e7; font-weight: 700; margin: 0 0 8px;">📦 ¿Cómo recibo mis archivos?</p>
                                <p style="font-size: 0.84rem; color: #a1a1aa; margin: 0; line-height: 1.5;">
                                    Willie te enviará los archivos de tus presets a este correo en los próximos minutos.
                                    Si compraste un plugin, usa la clave de activación mostrada arriba.
                                    Si tienes alguna duda, escríbenos a <a href="https://wa.me/51921839257" style="color: #a78bfa;">WhatsApp</a>.
                                </p>
                            </div>
                            <p style="font-size: 0.8rem; color: #52525b; text-align: center; margin: 0;">
                                Willie Inspired • OFFSZN • offszn.lat
                            </p>
                        </div>
                    </div>
                    `
                });
                console.log(`[WillieCheckout] Delivery email sent to: ${buyerEmail}`);
            } catch (emailErr) {
                console.error('[WillieCheckout] Email delivery error:', emailErr?.message);
            }
        }

        return res.status(200).json({
            success: true,
            status: 'completed',
            paypalOrderId: orderID,
            orderId,
            buyerEmail,
            totalUSD,
            itemCount: resolvedItems.length
        });

    } catch (err) {
        console.error('[WillieCheckout Capture] Error:', err.message, err.result || '');
        const userMsg = err.statusCode
            ? `PayPal no pudo completar la captura: ${err.message}`
            : 'Error al confirmar el pago.';
        return res.status(err.statusCode || 500).json({ error: userMsg });
    }
};
