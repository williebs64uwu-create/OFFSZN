// ─── STAR CHAIN en 3 cuotas (suscripción de PayPal) ──────────────────────────────────────────────────────────────
// Cuota 1 y 2 → clave temporal STAR-SUB de un mes (la del mes anterior se revoca). Cuota 3 → licencia STAR-FULL de por vida.
// Si un cobro falla se revoca la clave temporal hasta que se pague la siguiente cuota.
// Lo que PayPal informa se confirma siempre contra su API: un webhook falso no puede crear licencias.
import crypto from 'crypto';
import { supabase } from '../database/connection.js';
import { sendOffsznEmail } from '../../shared/utils/mailer.js';
import { recordIncome } from './financeService.js';
import { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT } from '../../shared/config/config.js';
import {
    STAR_PRODUCT_ID, STAR_INSTALLMENTS, STAR_INSTALLMENT_USD, licenseForPayment, subExpiry,
    starProductBody, starPlanBody, findCompletedSale, firstCompletedSale
} from '../../shared/store/starPlan.js';

const API = PAYPAL_ENVIRONMENT === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const OWNER_EMAIL = 'willie2008garay@gmail.com';
const SITE = 'https://offszn.lat';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(e || '').trim());

// ─── PayPal ───────────────────────────────────────────────────────────────────────────────────────────────────
async function accessToken() {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) throw new Error('PayPal no está configurado en el servidor.');
    const res = await fetch(`${API}/v1/oauth2/token`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
    });
    const data = await res.json();
    if (!data.access_token) throw new Error('PayPal rechazó las credenciales del servidor.');
    return data.access_token;
}

async function paypal(path, { method = 'GET', body, requestId } = {}) {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.details?.[0]?.description || `PayPal respondió ${res.status}`);
    return data;
}

// % de descuento de un cupón válido para STAR CHAIN (solo cupones del producto 5003). 0 si no existe o no vale.
export async function getStarCouponPercent(code) {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return 0;
    const { data } = await supabase.from('coupons').select('discount_percent, applies_to, applies_to_id, valid_from, valid_to').eq('code', c).maybeSingle();
    if (!data || data.applies_to !== 'product' || String(data.applies_to_id) !== String(STAR_PRODUCT_ID)) return 0;
    const now = Date.now();
    if (data.valid_from && now < new Date(data.valid_from).getTime()) return 0;
    if (data.valid_to && now > new Date(data.valid_to).getTime()) return 0;
    return Number(data.discount_percent) || 0;
}

// ─── Plan de PayPal (se crea una sola vez desde el CRM) ───────────────────────────────────────────────────────
export async function getStarPlanId() {
    if (process.env.STAR_PAYPAL_PLAN_ID) return process.env.STAR_PAYPAL_PLAN_ID.trim();
    const { data } = await supabase.from('star_config').select('value').eq('key', 'paypal_plan_id').maybeSingle();
    return data?.value || null;
}

export async function createStarPlan() {
    const existing = await getStarPlanId();
    if (existing) return { planId: existing, created: false };
    const product = await paypal('/v1/catalogs/products', { method: 'POST', body: starProductBody(), requestId: 'offszn-star-product-v1' });
    const plan = await paypal('/v1/billing/plans', { method: 'POST', body: starPlanBody(product.id), requestId: 'offszn-star-plan-v1' });
    const { error } = await supabase.from('star_config').upsert([
        { key: 'paypal_plan_id', value: plan.id, updated_at: new Date().toISOString() },
        { key: 'paypal_product_id', value: product.id, updated_at: new Date().toISOString() }
    ], { onConflict: 'key' });
    if (error) throw error;
    return { planId: plan.id, productId: product.id, created: true };
}

const getSubscription = (id) => paypal(`/v1/billing/subscriptions/${encodeURIComponent(id)}`);

async function listTransactions(sub) {
    const start = new Date(new Date(sub.start_time || Date.now()).getTime() - 86400000).toISOString();
    const end = new Date(Date.now() + 86400000).toISOString();
    const data = await paypal(`/v1/billing/subscriptions/${encodeURIComponent(sub.id)}/transactions?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`);
    return data.transactions || [];
}

// ─── Licencias ────────────────────────────────────────────────────────────────────────────────────────────────
const part = () => crypto.randomBytes(4).toString('hex').toUpperCase();

async function issueLicense({ kind, userId }) {
    const serial = `STAR-${kind === 'full' ? 'FULL' : 'SUB'}-${part()}-${part()}`;
    const { error } = await supabase.from('plugin_licenses').insert({
        serial_key: serial,
        plugin_name: 'STAR CHAIN',
        license_type: kind === 'full' ? 'lifetime' : 'subscription',
        status: 'active',
        expires_at: kind === 'full' ? null : subExpiry(),
        max_devices: 2,
        user_id: userId || null
    });
    if (error) throw error;
    return serial;
}

// Revoca las claves temporales de esta suscripción que sigan activas.
async function revokeSubLicenses(subscriptionId, exceptSerial = null) {
    const { data: rows } = await supabase.from('star_subscription_payments').select('license_serial').eq('subscription_id', subscriptionId).eq('license_type', 'subscription');
    const serials = (rows || []).map((r) => r.license_serial).filter((s) => s && s !== exceptSerial);
    if (!serials.length) return 0;
    const { data } = await supabase.from('plugin_licenses').update({ status: 'revoked' }).in('serial_key', serials).eq('status', 'active').select('serial_key');
    return data?.length || 0;
}

// ─── Correos ──────────────────────────────────────────────────────────────────────────────────────────────────
const shell = (inner) => `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:560px">${inner}</div>`;
const keyBox = (serial) => `<p style="background:#f4f4f5;border-radius:8px;padding:14px 16px;font-family:monospace;font-size:17px;letter-spacing:1px"><b>${esc(serial)}</b></p>`;

async function emailBuyer({ to, n, serial, kind }) {
    if (!validEmail(to)) return;
    const full = kind === 'full';
    const html = shell(`
        <p>${full ? '¡Completaste tus 3 cuotas! 🎉' : `¡Gracias por tu cuota ${n} de ${STAR_INSTALLMENTS}!`}</p>
        <p>${full ? 'Esta es tu licencia <b>STAR CHAIN FULL</b>, de por vida. Reemplaza a la clave temporal anterior:' : `Esta es tu clave de <b>STAR CHAIN</b> para este mes. ${n > 1 ? 'Reemplaza a la clave del mes pasado: actívala en tu plugin.' : ''}`}</p>
        ${keyBox(serial)}
        ${full ? '' : `<p style="color:#555;font-size:13px">Cuando se cobre tu siguiente cuota recibirás una clave nueva. Si un cobro falla, la clave se suspende hasta que se pague.</p>`}
        <p><a href="${SITE}/mis-compras">Descargar el instalador (Mis compras)</a></p>
        <p>¿Dudas? Escríbele a Willie por <a href="https://wa.me/51993525005">WhatsApp</a>.</p>`);
    await sendOffsznEmail({ to, subject: full ? '🔑 Tu licencia STAR CHAIN FULL de por vida' : `🔑 Tu clave STAR CHAIN · cuota ${n} de ${STAR_INSTALLMENTS}`, html, fromName: 'OFFSZN', type: 'transactional' });
}

async function emailPaymentFailed({ to }) {
    if (!validEmail(to)) return;
    const html = shell(`
        <p>No pudimos cobrar tu cuota de <b>STAR CHAIN</b>, así que tu clave quedó <b>suspendida</b>.</p>
        <p>Revisa el método de pago en tu cuenta de PayPal. Apenas se cobre la cuota te enviamos una clave nueva automáticamente.</p>
        <p>¿Necesitas ayuda? Escríbele a Willie por <a href="https://wa.me/51993525005">WhatsApp</a>.</p>`);
    await sendOffsznEmail({ to, subject: '⚠️ Tu cuota de STAR CHAIN no se pudo cobrar', html, fromName: 'OFFSZN', type: 'transactional' });
}

async function emailOwner({ subject, lines }) {
    await sendOffsznEmail({
        to: OWNER_EMAIL, subject, fromName: 'OFFSZN Ventas',
        html: shell(lines.map((l) => `<p style="margin:4px 0">${l}</p>`).join(''))
    });
}

// ─── Registro de la suscripción y de cada cuota ───────────────────────────────────────────────────────────────
async function ensureSubscription({ id, email, planId, userId = null }) {
    const { data: existing } = await supabase.from('star_subscriptions').select('*').eq('subscription_id', id).maybeSingle();
    if (existing) {
        // Un correo escrito por el comprador en el checkout manda sobre el de la cuenta de PayPal
        if (validEmail(email) && existing.email !== email.toLowerCase()) {
            await supabase.from('star_subscriptions').update({ email: email.toLowerCase(), updated_at: new Date().toISOString() }).eq('subscription_id', id);
            existing.email = email.toLowerCase();
        }
        return existing;
    }
    const row = { subscription_id: id, email: String(email || '').toLowerCase(), plan_id: planId, user_id: userId, status: 'active' };
    const { data, error } = await supabase.from('star_subscriptions').upsert(row, { onConflict: 'subscription_id', ignoreDuplicates: true }).select('*').maybeSingle();
    if (error) throw error;
    return data || (await supabase.from('star_subscriptions').select('*').eq('subscription_id', id).single()).data;
}

async function recordOrder({ email, saleId, amountUsd, kind, n }) {
    const { data: order, error } = await supabase.from('orders').insert({
        user_id: null, guest_email: email, total_price: amountUsd, amount: amountUsd, status: 'completed', transaction_id: saleId, product_id: STAR_PRODUCT_ID
    }).select('id').single();
    if (error) { console.warn('[STAR sub] orders:', error.message); return; }
    await supabase.from('order_items').insert({ order_id: order.id, product_id: STAR_PRODUCT_ID, price_at_purchase: amountUsd, quantity: 1, license_name: kind === 'full' ? 'lifetime' : 'subscription' });
    if (n === 1) {
        const { data: p } = await supabase.from('products').select('sales_count').eq('id', STAR_PRODUCT_ID).maybeSingle();
        if (p) await supabase.from('products').update({ sales_count: (p.sales_count || 0) + 1 }).eq('id', STAR_PRODUCT_ID);
    }
}

// Procesa UNA cuota cobrada (idempotente por sale_id). Devuelve la licencia entregada.
export async function processStarPayment({ subscription, saleId, amountUsd, feeUsd = null, netUsd = null, paidAt }) {
    const { data: already } = await supabase.from('star_subscription_payments').select('*').eq('sale_id', saleId).maybeSingle();
    if (already) return { duplicate: true, serial: already.license_serial, n: already.n, kind: already.license_type === 'lifetime' ? 'full' : 'sub' };

    // Reclama el número de cuota; si dos procesos chocan, el índice único deja pasar solo a uno.
    let n = null;
    for (let attempt = 0; attempt < 3 && n === null; attempt++) {
        const { count } = await supabase.from('star_subscription_payments').select('sale_id', { count: 'exact', head: true }).eq('subscription_id', subscription.subscription_id);
        const candidate = (count || 0) + 1;
        const { error } = await supabase.from('star_subscription_payments').insert({
            sale_id: saleId, subscription_id: subscription.subscription_id, n: candidate, amount_usd: amountUsd || STAR_INSTALLMENT_USD, paid_at: paidAt || new Date().toISOString()
        });
        if (!error) n = candidate;
        else if (error.code === '23505') {
            const { data: again } = await supabase.from('star_subscription_payments').select('*').eq('sale_id', saleId).maybeSingle();
            if (again) return { duplicate: true, serial: again.license_serial, n: again.n, kind: again.license_type === 'lifetime' ? 'full' : 'sub' };
        } else throw error;
    }
    if (n === null) throw new Error('No se pudo asignar el número de cuota.');

    const { kind, licenseType } = licenseForPayment(n);
    const serial = await issueLicense({ kind, userId: subscription.user_id });
    await supabase.from('star_subscription_payments').update({ license_serial: serial, license_type: licenseType }).eq('sale_id', saleId);
    await revokeSubLicenses(subscription.subscription_id, serial); // la clave del mes anterior (o todas, al llegar a FULL)

    await supabase.from('star_subscriptions').update({
        payments_count: n, status: n >= STAR_INSTALLMENTS ? 'completed' : 'active', last_payment_at: paidAt || new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('subscription_id', subscription.subscription_id);

    await recordOrder({ email: subscription.email, saleId, amountUsd: amountUsd || STAR_INSTALLMENT_USD, kind, n });
    // Libro de finanzas: la cuota con su bruto, comisión y neto de PayPal. Nunca rompe la entrega.
    await recordIncome({
        source: 'subscription', ref: saleId, occurred_at: paidAt || new Date().toISOString(), email: subscription.email, product: `STAR CHAIN · cuota ${n} de ${STAR_INSTALLMENTS}`, product_id: STAR_PRODUCT_ID,
        method: 'paypal', currency: 'USD', gross: amountUsd || STAR_INSTALLMENT_USD, fee: feeUsd, net: netUsd, status: 'confirmed', verified: true, by_willie: false, note: null, order_id: null
    });
    await emailBuyer({ to: subscription.email, n, serial, kind }).catch((e) => console.warn('[STAR sub] correo comprador:', e.message));
    await emailOwner({
        subject: `💸 [MARKETPLACE · PLUGIN · STAR CHAIN · CUOTA ${n}/${STAR_INSTALLMENTS}] $${Number(amountUsd || STAR_INSTALLMENT_USD).toFixed(2)} USD`,
        lines: [`<b>${esc(subscription.email)}</b> pagó la cuota ${n} de ${STAR_INSTALLMENTS} de STAR CHAIN.`, `Entregado: <b>${kind === 'full' ? 'licencia FULL de por vida' : 'clave temporal de 1 mes'}</b> <code>${esc(serial)}</code>`, `Suscripción PayPal: ${esc(subscription.subscription_id)}`]
    }).catch((e) => console.warn('[STAR sub] correo owner:', e.message));
    return { duplicate: false, serial, n, kind };
}

// Cobro fallido: se revocan las claves temporales hasta que se pague la siguiente cuota.
async function handlePaymentFailed(subscription) {
    const revoked = await revokeSubLicenses(subscription.subscription_id);
    await supabase.from('star_subscriptions').update({ status: 'past_due', last_failed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('subscription_id', subscription.subscription_id);
    await emailPaymentFailed({ to: subscription.email }).catch((e) => console.warn('[STAR sub] correo fallo:', e.message));
    await emailOwner({
        subject: `⚠️ [STAR CHAIN · PAGO FALLIDO] ${subscription.email}`,
        lines: [`Falló el cobro de una cuota de <b>${esc(subscription.email)}</b>. Claves revocadas: ${revoked}.`, `Suscripción PayPal: ${esc(subscription.subscription_id)}`]
    }).catch(() => {});
    return { revoked };
}

// ─── Confirmación desde el navegador (justo después de aprobar la suscripción) ───────────────────────────────
export async function confirmStarSubscription({ subscriptionId, email, userId }) {
    const planId = await getStarPlanId();
    if (!planId) throw Object.assign(new Error('Las cuotas aún no están habilitadas.'), { status: 503 });
    const sub = await getSubscription(subscriptionId);
    if (sub.plan_id !== planId) throw Object.assign(new Error('Esta suscripción no es de STAR CHAIN.'), { status: 400 });
    if (!['ACTIVE', 'APPROVED', 'APPROVAL_PENDING'].includes(sub.status)) throw Object.assign(new Error('La suscripción no está activa.'), { status: 400 });

    const buyerEmail = validEmail(email) ? email : sub.subscriber?.email_address;
    if (!validEmail(buyerEmail)) throw Object.assign(new Error('Falta un correo válido.'), { status: 400 });
    const row = await ensureSubscription({ id: subscriptionId, email: buyerEmail, planId, userId });

    // El primer cobro puede tardar unos segundos en aparecer: se reintenta antes de rendirse (el webhook lo completa igual).
    for (let attempt = 0; attempt < 3; attempt++) {
        const first = firstCompletedSale(await listTransactions(sub));
        if (first) {
            const r = await processStarPayment({ subscription: row, saleId: first.saleId, amountUsd: first.amountUsd, feeUsd: first.feeUsd, netUsd: first.netUsd, paidAt: first.paidAt });
            return { ok: true, pending: false, serialKey: r.serial, n: r.n, email: row.email };
        }
        await new Promise((res) => setTimeout(res, 2000));
    }
    return { ok: true, pending: true, email: row.email };
}

// ─── Webhook de PayPal: devuelve true si el evento era de STAR CHAIN (y ya se atendió) ───────────────────────
export async function handleStarWebhook(event) {
    const type = event?.event_type || '';
    const isSale = type === 'PAYMENT.SALE.COMPLETED';
    const isSubEvent = type.startsWith('BILLING.SUBSCRIPTION.');
    if (!isSale && !isSubEvent) return false;

    const subscriptionId = isSale ? event.resource?.billing_agreement_id : event.resource?.id;
    if (!subscriptionId || !String(subscriptionId).startsWith('I-')) return false;

    const planId = await getStarPlanId();
    if (!planId) return false;
    let sub;
    try { sub = await getSubscription(subscriptionId); } catch (_) { return false; }
    if (sub.plan_id !== planId) return false; // otra suscripción (créditos de OFFSZN, etc.): la atiende el flujo de siempre

    const row = await ensureSubscription({ id: subscriptionId, email: sub.subscriber?.email_address, planId });

    if (isSale) {
        const sale = findCompletedSale(await listTransactions(sub), event.resource?.id);
        if (!sale) { console.warn(`[STAR sub] Pago ${event.resource?.id} no confirmado por PayPal; se ignora.`); return true; }
        await processStarPayment({ subscription: row, saleId: sale.saleId, amountUsd: sale.amountUsd, feeUsd: sale.feeUsd, netUsd: sale.netUsd, paidAt: sale.paidAt });
        return true;
    }
    if (type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED' || type === 'BILLING.SUBSCRIPTION.SUSPENDED') {
        if (row.status !== 'completed') await handlePaymentFailed(row);
        return true;
    }
    if (type === 'BILLING.SUBSCRIPTION.CANCELLED') {
        // Cancelada por el comprador o por ti: la clave del mes en curso sigue hasta su vencimiento; no se cobran más cuotas.
        await supabase.from('star_subscriptions').update({ status: row.status === 'completed' ? 'completed' : 'cancelled', updated_at: new Date().toISOString() }).eq('subscription_id', subscriptionId);
        await emailOwner({ subject: `ℹ️ [STAR CHAIN] Suscripción cancelada: ${row.email}`, lines: [`<b>${esc(row.email)}</b> canceló sus cuotas (llevaba ${row.payments_count} de ${STAR_INSTALLMENTS}).`] }).catch(() => {});
        return true;
    }
    if (type === 'BILLING.SUBSCRIPTION.EXPIRED') {
        await supabase.from('star_subscriptions').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('subscription_id', subscriptionId);
        return true;
    }
    return true;
}
