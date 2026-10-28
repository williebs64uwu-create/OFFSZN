// ─── Servicio de la tienda Willie Inspired ────────────────────────────────────────────────────────────────────
// Lo que necesita la BD, el correo o Brevo: región de quien compra, validación de ofertas, clientes con tags
// y el cumplimiento de una orden pagada (archivos, licencias, correos), igual para PayPal y Yape.
import crypto from 'crypto';
import { supabase } from '../database/connection.js';
import { sendOffsznEmail } from '../../shared/utils/mailer.js';
import { countryOf } from '../../shared/utils/emailValidation.js';
import { BREVO_API_KEY } from '../../shared/config/config.js';
import { resolveRegion, quoteCart } from '../../shared/store/pricing.js';
import { getProduct } from '../../shared/store/catalog.js';
import MetaCapiService from './MetaCapiService.js';
import { generatePluginLicense } from '../http/controllers/PluginLicensingController.js';
import { createDeliverySessionRecord } from '../http/controllers/WilliePresetDeliveryController.js';

export const OWNER_EMAIL = 'willie2008garay@gmail.com';
export const WHATSAPP = 'https://wa.me/51993525005';
const SITE = 'https://offszn.lat';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── Correo de marketing: plantilla con baja firmada (HMAC) ──────────────────────────────────────────────────────
const sigSecret = () => process.env.STORE_CRON_SECRET || process.env.JWT_SECRET || 'offszn-store';
export const signEmail = (email) => crypto.createHmac('sha256', sigSecret()).update(String(email).toLowerCase()).digest('hex').slice(0, 32);
export const verifyEmailSig = (email, sig) => {
    const a = Buffer.from(signEmail(email));
    const b = Buffer.from(String(sig || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};
export const unsubscribeUrl = (email) => `${SITE}/api/store/unsubscribe?e=${encodeURIComponent(email)}&t=${signEmail(email)}`;
export { esc };

export const mailShell = (inner, { email = null } = {}) => `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:24px;background:#f3f3f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0a0a0a;font-size:16px;line-height:1.55">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;padding:28px;border:1px solid #e5e5ea">
<p style="font-weight:900;letter-spacing:-0.03em;font-size:18px;margin:0 0 18px">WILLIE INSPIRED</p>${inner}
<p style="margin:24px 0 0;color:#8e8c95;font-size:13px">¿Dudas? Respóndeme por <a href="${WHATSAPP}" style="color:#ec4899">WhatsApp</a>.${email ? ` · <a href="${unsubscribeUrl(email)}" style="color:#8e8c95">No quiero más correos</a>` : ''}</p></div></body></html>`;
export const mailButton = (href, label) => `<p style="margin:18px 0"><a href="${href}" style="display:inline-block;background:#0a0a0a;color:#ffffff;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:999px">${label}</a></p>`;

// ── Pipeline: se crea/mueve solo según lo que hace la persona ───────────────────────────────────────────────────
export async function ensureDeal({ email, title, stage = 'lead', productId = null, source = null, valueUsd = null }) {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean) return null;
    try {
        const { data: open } = await supabase.from('store_deals').select('id, stage')
            .eq('email', clean).not('stage', 'in', '(pagado,perdido)').order('created_at', { ascending: false }).limit(1).maybeSingle();
        const order = ['lead', 'prueba', 'cotizado'];
        if (open) {
            // Solo avanza, nunca retrocede una venta que ya va más adelante.
            if (order.indexOf(stage) > order.indexOf(open.stage)) {
                await supabase.from('store_deals').update({ stage, updated_at: new Date().toISOString() }).eq('id', open.id);
            }
            return open.id;
        }
        const { data } = await supabase.from('store_deals').insert({ email: clean, title, stage, product_id: productId, source, value_usd: valueUsd }).select('id').single();
        return data?.id || null;
    } catch (e) {
        console.warn('[Store] deal:', e.message);
        return null;
    }
}

async function closeDealsAsPaid(email, valueUsd) {
    const now = new Date().toISOString();
    const { data: open } = await supabase.from('store_deals').select('id').eq('email', email).not('stage', 'in', '(pagado,perdido)');
    if (open?.length) {
        await supabase.from('store_deals').update({ stage: 'pagado', value_usd: valueUsd, closed_at: now, updated_at: now }).in('id', open.map((d) => d.id));
    } else {
        await supabase.from('store_deals').insert({ email, title: 'Compra en la tienda', stage: 'pagado', value_usd: valueUsd, source: 'tienda', closed_at: now });
    }
}

export const segmentFor = (purchaseCount) => (purchaseCount >= 2 ? 'COMPRADOR V2' : purchaseCount === 1 ? 'COMPRADOR V1' : 'FREE');

export async function getCustomerByUser(userId) {
    if (!userId) return null;
    const { data } = await supabase.from('store_customers').select('*').eq('user_id', userId).maybeSingle();
    return data || null;
}

export async function getCustomerByEmail(email) {
    if (!email) return null;
    const { data } = await supabase.from('store_customers').select('*').eq('email', email.toLowerCase()).maybeSingle();
    return data || null;
}

// País de la cuenta (onboarding) + IP del CDN + zona horaria del navegador.
export async function regionForRequest(req, timezone) {
    const customer = req.user?.userId ? await getCustomerByUser(req.user.userId) : null;
    return resolveRegion({ ipCountry: countryOf(req), timezone, declaredCountry: customer?.country });
}

export const newCode = (prefix) => `${prefix}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

/**
 * Convierte la oferta que manda el navegador en una oferta válida para quoteCart.
 * Devuelve { offer, offerRef } o { error } (mensaje para mostrar).
 */
export async function resolveOffer(req, input) {
    const type = String(input?.type || '').trim();
    if (!type) return { offer: null };

    if (type === '2x1') {
        return { offer: { type: '2x1', freeIds: Array.isArray(input.freeIds) ? input.freeIds.slice(0, 10).map(String) : [] } };
    }

    if (type === 'welcome50') {
        const userId = req.user?.userId;
        if (!userId) return { error: 'Inicia sesión para usar tu 50% de bienvenida.', code: 'login_required' };
        const { data } = await supabase.from('store_offers').select('id, used_at')
            .eq('user_id', userId).eq('type', 'welcome50').maybeSingle();
        if (!data) return { error: 'Activa tu 50% de bienvenida desde la oferta.', code: 'not_claimed' };
        if (data.used_at) return { error: 'Tu 50% de bienvenida ya fue usado.', code: 'used' };
        return { offer: { type: 'welcome50' }, offerRef: data.id };
    }

    if (type === 'code') {
        const code = String(input.code || '').trim().toUpperCase().slice(0, 40);
        if (!code) return { error: 'Código vacío.' };
        const { data } = await supabase.from('store_offers').select('*').eq('code', code).maybeSingle();
        if (!data || data.type !== 'trial_followup') return { error: 'Ese código no existe.', code: 'invalid' };
        if (data.used_at) return { error: 'Ese código ya fue usado.', code: 'used' };
        if (data.expires_at && new Date(data.expires_at) < new Date()) return { error: 'Ese código ya venció.', code: 'expired' };
        return { offer: { type: 'code', productId: data.product_id, priceUsd: Number(data.price_usd) }, offerRef: data.id };
    }

    if (type === 'coupon') return { offer: { type: 'coupon', code: String(input.code || '') } };
    return { error: 'Oferta no válida.' };
}

// El checkout anterior mandaba { id, ... } o { product: { id } } y "couponCode"; el nuevo manda { id, os } y "offer".
export const normalizeItems = (cartItems) => (Array.isArray(cartItems) ? cartItems : []).slice(0, 60).map((i) => ({
    id: String(i?.id ?? i?.product?.id ?? ''),
    os: i?.os || i?.product?.os || null
}));

// Total del carrito para esta request: oferta validada + región. Lo usan /api/store/quote y los checkouts.
export async function quoteForRequest(req) {
    const { cartItems, items, offer, couponCode, timezone } = req.body || {};
    const offerInput = offer?.type ? offer : (couponCode ? { type: 'coupon', code: couponCode } : null);
    const resolved = await resolveOffer(req, offerInput);
    const region = await regionForRequest(req, timezone);
    const quote = quoteCart({ items: normalizeItems(cartItems || items), getProduct, region, offer: resolved.error ? null : resolved.offer });
    // Oferta no válida: el carrito muestra el total sin oferta y el aviso; los checkouts no cobran (status 400).
    if (resolved.error) return { error: resolved.error, code: resolved.code, status: 400, quote, region };
    if (!quote.lines.length) return { error: 'Carrito vacío o sin productos disponibles.', status: 400, quote, region };
    if (quote.totalUsd <= 0) return { error: 'El total no puede ser 0.', status: 400, quote, region };
    return { quote, region, offerRef: resolved.offerRef || null };
}

export async function markOfferUsed(offerRef, orderRef) {
    if (!offerRef) return;
    const { error } = await supabase.from('store_offers')
        .update({ used_at: new Date().toISOString(), used_order_ref: orderRef })
        .eq('id', offerRef).is('used_at', null);
    if (error) console.warn('[Store] No se pudo marcar la oferta como usada:', error.message);
}

// Contacto en Brevo con los tags como atributos. Si no hay API key o lista, no hace nada.
export async function syncBrevoContact(customer) {
    const listId = parseInt(process.env.STORE_BREVO_LIST_ID, 10);
    if (!BREVO_API_KEY || !customer?.email) return;
    try {
        const res = await fetch('https://api.brevo.com/v3/contacts', {
            method: 'POST',
            headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({
                email: customer.email,
                updateEnabled: true,
                ...(Number.isFinite(listId) ? { listIds: [listId] } : {}),
                attributes: {
                    SEGMENTO: customer.segment,
                    PAIS: customer.country || customer.ip_country || '',
                    COMPRAS: customer.purchase_count || 0,
                    TOTAL_GASTADO: Number(customer.total_spent_usd || 0),
                    ULTIMA_COMPRA: customer.last_purchase_at ? customer.last_purchase_at.slice(0, 10) : '',
                    FUENTE: customer.first_source || ''
                }
            })
        });
        if (!res.ok && res.status !== 204) console.warn('[Store] Brevo contacto:', res.status, (await res.text()).slice(0, 200));
        else await supabase.from('store_customers').update({ brevo_synced_at: new Date().toISOString() }).eq('id', customer.id);
    } catch (e) {
        console.warn('[Store] Brevo no disponible:', e.message);
    }
}

/**
 * Crea o actualiza el cliente. `patch` solo sobreescribe lo que trae; las listas (lead_magnets) se suman.
 */
export async function upsertCustomer(email, patch = {}) {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean) return null;
    const existing = await getCustomerByEmail(clean);
    const now = new Date().toISOString();
    if (existing) {
        const next = { ...patch, updated_at: now };
        if (patch.lead_magnets) next.lead_magnets = [...new Set([...(existing.lead_magnets || []), ...patch.lead_magnets])];
        if (existing.first_source) delete next.first_source;
        const { data, error } = await supabase.from('store_customers').update(next).eq('id', existing.id).select('*').single();
        if (error) console.warn('[Store] update cliente:', error.message);
        return data || existing;
    }
    const { data, error } = await supabase.from('store_customers')
        .insert({ email: clean, segment: 'FREE', ...patch }).select('*').single();
    if (error?.code === '23505') return getCustomerByEmail(clean);
    if (error) console.warn('[Store] insert cliente:', error.message);
    return data || null;
}

async function recordPurchase({ email, userId, totalUsd, region }) {
    const existing = await getCustomerByEmail(email);
    const count = (existing?.purchase_count || 0) + 1;
    const now = new Date().toISOString();
    const customer = await upsertCustomer(email, {
        ...(userId ? { user_id: userId } : {}),
        purchase_count: count,
        segment: segmentFor(count),
        total_spent_usd: Math.round((Number(existing?.total_spent_usd || 0) + totalUsd) * 100) / 100,
        last_purchase_at: now,
        ...(existing?.first_purchase_at ? {} : { first_purchase_at: now }),
        ip_country: region?.ipCountry || existing?.ip_country || null,
        vpn_suspected: Boolean(region?.vpnSuspected)
    });
    await syncBrevoContact(customer);
    // Si vino de una prueba de plugin, se marca como convertido (no le llega la oferta de seguimiento).
    await supabase.from('store_trials').update({ converted_at: now }).eq('email', email.toLowerCase()).is('converted_at', null);
}

const linesHtml = (lines) => lines.map((l) => {
    const os = l.os ? ` (${l.os === 'mac' ? 'Mac' : 'Windows'})` : '';
    const price = l.free ? 'GRATIS' : `$${Number(l.lineUsd).toFixed(2)}`;
    return `• ${esc(l.title)}${os} — ${price}`;
}).join('<br>');

function buyerEmailHtml({ lines, totalUsd, totalPen, paymentMethod, delivery, licenses, manual, services }) {
    const box = 'background:#111114;border:1px solid #27272a;border-radius:12px;padding:18px;margin:0 0 18px';
    const total = paymentMethod === 'yape' ? `S/ ${Number(totalPen).toFixed(2)}` : `$${Number(totalUsd).toFixed(2)} USD`;
    return `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:580px;margin:0 auto;background:#09090b;color:#ffffff;border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#000000 0%,#1a0a24 100%);padding:30px 26px;text-align:center">
    <h1 style="font-size:1.5rem;font-weight:900;letter-spacing:-0.03em;margin:0">WILLIE INSPIRED</h1>
  </div>
  <div style="padding:26px">
    <h2 style="font-size:1.15rem;font-weight:800;margin:0 0 8px">¡Pago confirmado! 🎉</h2>
    <p style="color:#a1a1aa;font-size:0.9rem;margin:0 0 18px">Este es el resumen de tu compra:</p>
    <div style="${box};font-size:0.88rem;color:#e4e4e7;line-height:1.7">${linesHtml(lines)}</div>
    ${delivery ? `<div style="${box};text-align:center;border-color:#742284">
      <p style="color:#ec4899;font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;font-weight:700">🎹 Tus archivos están listos</p>
      <a href="${SITE}${delivery.portalUrl}" style="display:inline-block;background:#ec4899;color:#ffffff;padding:13px 26px;border-radius:10px;font-weight:800;text-decoration:none">Descargar mis archivos</a>
      <p style="color:#71717a;font-size:0.78rem;margin:10px 0 0">4 descargas por producto. Guarda este correo.</p></div>` : ''}
    ${licenses.length ? `<div style="${box};text-align:center;border-color:#742284">
      <p style="color:#ec4899;font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;font-weight:700">🔑 Tus licencias</p>
      ${licenses.map((k) => `<p style="color:#a1a1aa;font-size:0.8rem;margin:8px 0 2px">${esc(k.name)}</p><p style="font-family:monospace;font-size:1.1rem;font-weight:800;margin:0">${esc(k.key)}</p>${k.landingUrl ? `<p style="margin:4px 0 0"><a href="${SITE}${k.landingUrl}" style="color:#a78bfa;font-size:0.8rem">Descargar instalador</a></p>` : ''}`).join('')}
      <p style="color:#71717a;font-size:0.78rem;margin:12px 0 0">¿Dudas al instalar? Escríbeme por <a href="${WHATSAPP}" style="color:#a78bfa">WhatsApp</a>.</p></div>` : ''}
    ${manual.length ? `<div style="${box}"><p style="font-size:0.88rem;font-weight:700;margin:0 0 6px">📦 Te lo envío yo</p>
      <p style="color:#a1a1aa;font-size:0.84rem;margin:0">${manual.map((l) => esc(l.title)).join(', ')}: te llega a este correo en menos de 24 horas. Si lo necesitas ya, escríbeme por <a href="${WHATSAPP}" style="color:#a78bfa">WhatsApp</a>.</p></div>` : ''}
    ${services.length ? `<div style="${box}"><p style="font-size:0.88rem;font-weight:700;margin:0 0 6px">🎚️ Tu servicio</p>
      <p style="color:#a1a1aa;font-size:0.84rem;margin:0">Escríbeme por <a href="${WHATSAPP}?text=${encodeURIComponent('Hola Willie, compré: ' + services.map((l) => l.title).join(', '))}" style="color:#a78bfa">WhatsApp</a> para enviarme tus pistas y coordinar.</p></div>` : ''}
    <div style="${box}"><p style="font-size:0.78rem;color:#71717a;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;font-weight:700">Total pagado</p>
      <p style="font-size:1.35rem;font-weight:900;margin:0">${total}</p></div>
    <p style="font-size:0.78rem;color:#52525b;text-align:center;margin:0">Willie Inspired • offszn.lat</p>
  </div>
</div>`;
}

/**
 * Cumple una orden YA PAGADA. Las líneas salen del servidor (quote o items de PayPal), nunca del navegador.
 */
export async function fulfillOrder({ lines, email, extraEmails = [], paymentMethod, paymentRef, quote, region, offerRef, userId = null, abVariant = null, sessionId = null, utm = null, tracking = null }) {
    const buyer = String(email || '').trim().toLowerCase() || null;
    const eventId = `purchase_${paymentMethod}_${paymentRef}`;
    const result = { delivery: null, licenses: [], eventId };

    try {
        result.delivery = await createDeliverySessionRecord({ email: buyer, lines, paymentMethod, orderId: paymentRef });
    } catch (e) {
        console.error('[Store] Entrega no creada:', e.message);
    }

    for (const line of lines) {
        const product = getProduct(line.id);
        if (product?.delivery !== 'license') continue;
        for (const pluginName of product.licenses || [product.pluginName]) {
            try {
                const lic = await generatePluginLicense({ licenseType: 'lifetime', userEmail: buyer, userId, pluginName });
                if (lic?.serialKey) result.licenses.push({ name: pluginName, key: lic.serialKey, landingUrl: product.landingUrl || null });
            } catch (e) {
                console.error(`[Store] Licencia ${pluginName} no generada:`, e.message);
            }
        }
    }

    const manual = lines.filter((l) => getProduct(l.id)?.delivery === 'manual');
    const services = lines.filter((l) => getProduct(l.id)?.delivery === 'service');
    const html = buyerEmailHtml({ lines, totalUsd: quote.totalUsd, totalPen: quote.totalPen, paymentMethod, delivery: result.delivery, licenses: result.licenses, manual, services });
    for (const to of new Set([buyer, ...extraEmails.map((e) => String(e || '').toLowerCase())].filter((e) => e && e.includes('@')))) {
        try {
            await sendOffsznEmail({ to, subject: '✅ ¡Tu compra en Willie Inspired está lista!', html, fromName: 'Willie Inspired' });
        } catch (e) {
            console.error(`[Store] Correo de compra a ${to} falló:`, e.message);
        }
    }

    // Aviso al owner: siempre, y resaltando lo que hay que entregar a mano.
    try {
        const todo = [...manual, ...services];
        await sendOffsznEmail({
            to: OWNER_EMAIL,
            subject: `${todo.length ? '📦 ENTREGAR A MANO · ' : '💸 '}[WILLIEINSPIRED] Venta $${quote.totalUsd.toFixed(2)} (${paymentMethod}, ${region?.country || '??'})`,
            fromName: 'Willie Inspired Ventas',
            html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">
                <p><b>${esc(buyer)}</b> · ${esc(paymentMethod)} · ref ${esc(paymentRef)}</p>
                <p>${linesHtml(lines)}</p>
                <p>Total: <b>$${quote.totalUsd.toFixed(2)}</b>${quote.offerApplied ? ` · oferta: ${esc(quote.offerApplied.type)}` : ''} · país ${esc(region?.country)} (${esc(region?.tier)})${region?.vpnSuspected ? ' · ⚠️ posible VPN' : ''}</p>
                ${todo.length ? `<p style="color:#b45309"><b>Pendiente de entregar/coordinar:</b> ${todo.map((l) => esc(l.title)).join(', ')}</p>` : ''}
            </div>`
        });
    } catch (e) {
        console.warn('[Store] Aviso al owner falló:', e.message);
    }

    // Meta Conversions API: mismo event_id que el Pixel de la página de gracias, así Meta deduplica.
    try {
        await MetaCapiService.sendEvent({
            eventName: 'Purchase',
            eventId,
            eventSourceUrl: tracking?.sourceUrl || 'https://offszn.lat/willieinspired/gracias',
            userData: { email: buyer, fbc: tracking?.fbc, fbp: tracking?.fbp, ip: tracking?.ip, userAgent: tracking?.userAgent },
            customData: { currency: 'USD', value: quote.totalUsd, content_type: 'product', content_ids: lines.map((l) => l.id), order_id: String(paymentRef) }
        });
    } catch (e) {
        console.warn('[Store] Meta CAPI:', e?.message);
    }

    // Contabilidad: si algo de aquí falla, el cliente ya tiene su compra; solo se registra el error.
    try {
        await recordBookkeeping({ lines, buyer, paymentMethod, paymentRef, quote, region, offerRef, userId, abVariant, sessionId, utm, result });
    } catch (e) {
        console.error('[Store] Contabilidad de la orden falló:', e.message);
    }
    return result;
}

async function recordBookkeeping({ lines, buyer, paymentMethod, paymentRef, quote, region, offerRef, userId, abVariant, sessionId, utm, result }) {
    await markOfferUsed(offerRef, paymentRef);

    const { error: orderErr } = await supabase.from('store_orders').upsert({
        status: 'completed',
        payment_method: paymentMethod,
        payment_ref: paymentRef,
        email: buyer,
        user_id: userId,
        country: region?.country || null,
        tier: region?.tier || null,
        vpn_suspected: Boolean(region?.vpnSuspected),
        currency: region?.currency?.code || null,
        subtotal_usd: quote.subtotalUsd,
        discount_usd: quote.discountUsd,
        total_usd: quote.totalUsd,
        total_pen: paymentMethod === 'yape' ? quote.totalPen : null,
        offer_type: quote.offerApplied?.type || null,
        offer_ref: offerRef || null,
        ab_variant: abVariant,
        lines,
        delivery_token: result.delivery?.token || null,
        license_count: result.licenses.length,
        session_id: sessionId,
        utm,
        updated_at: new Date().toISOString()
    }, { onConflict: 'payment_method,payment_ref' });
    if (orderErr) console.warn('[Store] store_orders:', orderErr.message);

    // Registro histórico que ya usan los paneles (orders)
    const { error: legacyErr } = await supabase.from('orders').insert({
        user_id: null,
        guest_email: buyer,
        total_price: quote.totalUsd,
        amount: quote.totalUsd,
        status: 'completed',
        transaction_id: `WILLIE-${paymentMethod === 'yape' ? 'YAPE' : 'PP'}-${paymentRef}`,
        product_id: null
    });
    if (legacyErr) console.warn('[Store] orders:', legacyErr.message);

    if (buyer) {
        await recordPurchase({ email: buyer, userId, totalUsd: quote.totalUsd, region });
        await closeDealsAsPaid(buyer, quote.totalUsd).catch((e) => console.warn('[Store] deal pagado:', e.message));
        await supabase.from('store_carts').update({ recovered_at: new Date().toISOString() }).eq('email', buyer).is('recovered_at', null);
    }
    await supabase.from('store_events').insert({
        session_id: sessionId, user_id: userId, email: buyer, event: 'purchase', variant: abVariant,
        country: region?.country || null, meta: { total_usd: quote.totalUsd, method: paymentMethod, offer: quote.offerApplied?.type || null }
    });
}
