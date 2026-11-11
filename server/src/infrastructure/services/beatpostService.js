// ─── Beat Post: cobro y activación de PRO por 1 año ──────────────────────────────────────────────────────────────
// Pago único (39 US$) o 2 cuotas (20 + 20 US$, suscripción de PayPal).
//   · Pago único        → PRO 12 meses.
//   · Cuota 1           → PRO 33 días.   Cuota 2 → PRO hasta 12 meses después de la cuota 1.
// Cada activación queda en `beatpost_grants` (ref única = nunca se aplica dos veces). Si el correo aún no tiene cuenta
// en OFFSZN, la activación queda pendiente y se aplica sola cuando inicia sesión en Beat Post (/api/beatpost/claim).
// El plan se guarda como fila de `subscriptions` (provider 'beatpost'): el Scavenger lo baja a free al vencer.
// Lo que dice PayPal se confirma siempre contra su API: un aviso falso no activa nada.
import { supabase } from '../database/connection.js';
import { sendOffsznEmail } from '../../shared/utils/mailer.js';
import { recordIncome } from './financeService.js';
import { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT } from '../../shared/config/config.js';
import {
    BEATPOST_PRICE_USD, BEATPOST_INSTALLMENTS, BEATPOST_INSTALLMENT_USD, BEATPOST_PRO_MONTHS, BEATPOST_PRODUCT_ID,
    addMonths, laterDate, validEmail, proUntilForPayment, captureMatchesPrice, orderBody, productBody, planBody,
    findCompletedSale, completedSales
} from '../../shared/store/beatpostPlan.js';

const API = PAYPAL_ENVIRONMENT === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const OWNER_EMAIL = 'willie2008garay@gmail.com';
const SITE = 'https://offszn.lat';
const DOWNLOAD_URL = () => process.env.BEATPOST_WIN_URL || `${SITE}/mis-compras`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lower = (e) => String(e || '').trim().toLowerCase();
const fail = (message, status) => Object.assign(new Error(message), { status });

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

async function paypal(path, { method = 'GET', body, requestId, allow = [] } = {}) {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && !allow.includes(res.status)) throw new Error(data.message || data.details?.[0]?.description || `PayPal respondió ${res.status}`);
    return { status: res.status, ...data };
}

// ─── Activar PRO ──────────────────────────────────────────────────────────────────────────────────────────────
async function findUser({ userId, email }) {
    if (userId) {
        const { data } = await supabase.from('users').select('id, email, plan').eq('id', userId).maybeSingle();
        if (data) return data;
    }
    if (!validEmail(email)) return null;
    const { data } = await supabase.from('users').select('id, email, plan').ilike('email', lower(email)).maybeSingle();
    return data || null;
}

async function currentBeatPostSub(userId) {
    const { data } = await supabase.from('subscriptions')
        .select('id, current_period_end').eq('user_id', userId).eq('provider', 'beatpost').eq('status', 'active')
        .order('current_period_end', { ascending: false }).limit(1).maybeSingle();
    return data || null;
}

// Pone al usuario en PRO hasta `until` (nunca acorta un PRO de Beat Post más largo).
async function applyToUser(user, until) {
    const current = await currentBeatPostSub(user.id);
    const end = laterDate(current?.current_period_end, until);
    if (current) {
        const { error } = await supabase.from('subscriptions').update({ current_period_end: end }).eq('id', current.id);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('subscriptions').insert({
            user_id: user.id, plan_id: 'pro_beatpost', status: 'active', provider: 'beatpost',
            provider_subscription_id: `beatpost-${user.id}-${Date.now()}`, current_period_end: end
        });
        if (error) throw error;
    }
    const { error: planError } = await supabase.from('users').update({ plan: 'pro' }).eq('id', user.id);
    if (planError) throw planError;
    await supabase.from('profiles').update({ plan: 'pro' }).eq('id', user.id);
    return end;
}

/**
 * Registra y aplica una activación. `months` cuenta desde el fin del PRO de Beat Post vigente (comprar de nuevo extiende);
 * `until` es una fecha fija (cuotas). `ref` única: repetir la misma activación no hace nada.
 */
export async function grantPro({ email, userId = null, months = null, until = null, source, ref, note = null }) {
    if (!ref) throw new Error('grantPro necesita ref');
    const { data: done } = await supabase.from('beatpost_grants').select('*').eq('ref', ref).maybeSingle();
    if (done) return { duplicate: true, applied: Boolean(done.applied_at), until: done.until, email: done.email };

    const user = await findUser({ userId, email });
    let end = until;
    if (!end) {
        const current = user ? await currentBeatPostSub(user.id) : null;
        const base = laterDate(current?.current_period_end, new Date());
        end = addMonths(base, months || BEATPOST_PRO_MONTHS).toISOString();
    }
    const row = { ref, email: lower(email || user?.email), user_id: user?.id || null, until: end, source, note };
    const { error } = await supabase.from('beatpost_grants').insert(row);
    if (error) {
        if (error.code === '23505') return grantPro({ email, userId, months, until, source, ref, note }); // otro proceso ganó
        throw error;
    }
    if (!user) return { duplicate: false, applied: false, until: end, email: row.email };
    const final = await applyToUser(user, end);
    await supabase.from('beatpost_grants').update({ applied_at: new Date().toISOString(), user_id: user.id }).eq('ref', ref);
    return { duplicate: false, applied: true, until: final, email: user.email };
}

// Al iniciar sesión en Beat Post: aplica las compras hechas con ese correo antes de tener cuenta.
export async function claimPendingGrants({ userId, email }) {
    if (!userId) throw fail('Inicia sesión.', 401);
    const user = await findUser({ userId, email });
    if (!user) return { applied: 0, plan: null };
    const { data: pending } = await supabase.from('beatpost_grants').select('*').eq('email', lower(user.email)).is('applied_at', null);
    let until = null;
    for (const g of pending || []) {
        until = await applyToUser(user, g.until);
        await supabase.from('beatpost_grants').update({ applied_at: new Date().toISOString(), user_id: user.id }).eq('ref', g.ref);
    }
    const current = await currentBeatPostSub(user.id);
    const active = current && new Date(current.current_period_end) > new Date();
    return { applied: (pending || []).length, plan: active ? 'pro' : user.plan || 'free', until: active ? current.current_period_end : until };
}

// ─── Correos ──────────────────────────────────────────────────────────────────────────────────────────────────
const shell = (inner) => `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:560px">${inner}</div>`;
const fecha = (iso) => new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Lima' });

async function emailBuyer({ to, until, applied, n = null }) {
    if (!validEmail(to)) throw new Error('el correo del comprador no es válido');
    const cuota = n ? (n >= BEATPOST_INSTALLMENTS ? '¡Completaste tus 2 cuotas! 🎉' : `¡Gracias por tu cuota ${n} de ${BEATPOST_INSTALLMENTS}!`) : '¡Gracias por comprar Beat Post! 🎉';
    const html = shell(`
        <p>${cuota}</p>
        <p>Tu <b>Beat Post completo</b> y tu plan <b>PRO en OFFSZN</b> están activos hasta el <b>${esc(fecha(until))}</b>.</p>
        ${n && n < BEATPOST_INSTALLMENTS ? '<p style="color:#555;font-size:13px">Cuando se cobre tu segunda cuota se completa tu año de PRO. Si un cobro falla, el PRO se mantiene hasta el fin del mes pagado.</p>' : ''}
        <p><b>Cómo activarlo:</b></p>
        <ol>
            <li><a href="${esc(DOWNLOAD_URL())}">Descarga Beat Post para Windows</a> e instálalo.</li>
            <li>${applied ? 'Inicia sesión en Beat Post con este mismo correo.' : `Crea tu cuenta en <a href="${SITE}">offszn.lat</a> con <b>este mismo correo</b> y luego inicia sesión en Beat Post: se activa solo.`}</li>
        </ol>
        <p>¿Dudas? Escríbele a Willie por <a href="https://wa.me/51993525005">WhatsApp</a>.</p>`);
    await sendOffsznEmail({ to, subject: n && n < BEATPOST_INSTALLMENTS ? `🎧 Beat Post activo · cuota ${n} de ${BEATPOST_INSTALLMENTS}` : '🎧 Tu Beat Post y tu PRO de OFFSZN están activos', html, fromName: 'OFFSZN', type: 'transactional' });
}

async function deliverEmail(args) {
    let last = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        try { await emailBuyer(args); return { ok: true }; } catch (e) { last = e; if (attempt === 1) await new Promise((r) => setTimeout(r, 1500)); }
    }
    return { ok: false, error: String(last?.message || 'error desconocido').slice(0, 160) };
}

async function emailOwner({ subject, lines }) {
    await sendOffsznEmail({ to: OWNER_EMAIL, subject, fromName: 'OFFSZN Ventas', html: shell(lines.map((l) => `<p style="margin:4px 0">${l}</p>`).join('')) });
}

async function recordOrder({ email, ref, amountUsd, label }) {
    if (!BEATPOST_PRODUCT_ID) return;
    const { data: order, error } = await supabase.from('orders').insert({
        user_id: null, guest_email: email, total_price: amountUsd, amount: amountUsd, status: 'completed', transaction_id: ref, product_id: BEATPOST_PRODUCT_ID
    }).select('id').single();
    if (error) { console.warn('[BeatPost] orders:', error.message); return; }
    await supabase.from('order_items').insert({ order_id: order.id, product_id: BEATPOST_PRODUCT_ID, price_at_purchase: amountUsd, quantity: 1, license_name: label });
}

// Avisos al comprador y a Willie después de activar. Nunca rompen la activación.
async function notify({ email, grant, amountUsd, label, ref, n = null }) {
    const mail = await deliverEmail({ to: email, until: grant.until, applied: grant.applied, n }).catch((e) => ({ ok: false, error: e.message }));
    await emailOwner({
        subject: `${mail.ok ? '💸' : '⚠️ [CORREO NO ENVIADO]'} [BEAT POST · ${label.toUpperCase()}] $${Number(amountUsd).toFixed(2)} USD`,
        lines: [`<b>${esc(email)}</b> compró Beat Post (${esc(label)}).`,
            `PRO hasta: <b>${esc(fecha(grant.until))}</b> · ${grant.applied ? 'ya aplicado a su cuenta' : 'pendiente: aún no tiene cuenta en OFFSZN (se aplica al iniciar sesión)'}`,
            `Referencia: ${esc(ref)}`,
            mail.ok ? '✅ El correo de bienvenida sí salió.' : `⚠️ <b>El correo NO le llegó al cliente</b> (${esc(mail.error)}). Escríbele tú.`]
    }).catch((e) => console.warn('[BeatPost] correo owner:', e.message));
    return mail.ok;
}

// ─── Pago único ───────────────────────────────────────────────────────────────────────────────────────────────
export async function createOrder() {
    const order = await paypal('/v2/checkout/orders', { method: 'POST', body: orderBody() });
    return { id: order.id };
}

export async function captureOrder({ orderId, email, userId = null }) {
    if (!/^[A-Z0-9]{8,40}$/i.test(String(orderId || ''))) throw fail('Falta el pedido de PayPal.', 400);
    const ref = `order:${orderId}`;
    const { data: done } = await supabase.from('beatpost_grants').select('*').eq('ref', ref).maybeSingle();
    if (done) return { ok: true, duplicate: true, until: done.until, applied: Boolean(done.applied_at), email: done.email };

    let order = await paypal(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST', requestId: `beatpost-capture-${orderId}`, allow: [422] });
    if (order.status === 422) order = await paypal(`/v2/checkout/orders/${encodeURIComponent(orderId)}`); // ya capturado antes
    const unit = (order.purchase_units || []).find((u) => u.custom_id === 'BEATPOST' || u.reference_id === 'BEATPOST');
    const capture = unit?.payments?.captures?.find((c) => captureMatchesPrice(c));
    if (!capture) throw fail('PayPal no confirmó el pago de Beat Post.', 402);

    const buyer = validEmail(email) ? lower(email) : lower(order.payer?.email_address);
    if (!validEmail(buyer)) throw fail('Falta un correo válido.', 400);
    const grant = await grantPro({ email: buyer, userId, months: BEATPOST_PRO_MONTHS, source: 'paypal', ref, note: capture.id });
    if (grant.duplicate) return { ok: true, duplicate: true, until: grant.until, applied: grant.applied, email: grant.email };

    const b = capture.seller_receivable_breakdown || {};
    const num = (v) => (v === undefined || v === null || v === '' ? null : Math.round(Number(v) * 100) / 100);
    await recordOrder({ email: buyer, ref: capture.id, amountUsd: num(capture.amount.value), label: 'pago único' });
    await recordIncome({
        source: 'paypal', ref: String(capture.id), occurred_at: capture.create_time || new Date().toISOString(), email: buyer, product: 'Beat Post · pago único', product_id: BEATPOST_PRODUCT_ID,
        method: 'paypal', currency: 'USD', gross: num(capture.amount.value), fee: num(b.paypal_fee?.value), net: num(b.net_amount?.value), status: 'confirmed', verified: true, by_willie: false, note: null, order_id: null
    });
    await notify({ email: buyer, grant, amountUsd: capture.amount.value, label: 'pago único', ref: capture.id });
    return { ok: true, duplicate: false, until: grant.until, applied: grant.applied, email: buyer };
}

// ─── 2 cuotas (suscripción de PayPal) ─────────────────────────────────────────────────────────────────────────
const cfgGet = async (key) => (await supabase.from('star_config').select('value').eq('key', key).maybeSingle()).data?.value || null;

export async function getPlanId() {
    if (process.env.BEATPOST_PAYPAL_PLAN_ID) return process.env.BEATPOST_PAYPAL_PLAN_ID.trim();
    return cfgGet('beatpost_paypal_plan_id');
}

// Se llama una sola vez (clave de owner): crea el producto y el plan en PayPal y guarda el id.
export async function createPlan() {
    const existing = await getPlanId();
    if (existing) return { planId: existing, created: false };
    const product = await paypal('/v1/catalogs/products', { method: 'POST', body: productBody(), requestId: 'offszn-beatpost-product-v1' });
    const plan = await paypal('/v1/billing/plans', { method: 'POST', body: planBody(product.id), requestId: 'offszn-beatpost-plan-v1' });
    const now = new Date().toISOString();
    const { error } = await supabase.from('star_config').upsert([
        { key: 'beatpost_paypal_plan_id', value: plan.id, updated_at: now },
        { key: 'beatpost_paypal_product_id', value: product.id, updated_at: now }
    ], { onConflict: 'key' });
    if (error) throw error;
    return { planId: plan.id, productId: product.id, created: true };
}

const getSubscription = (id) => paypal(`/v1/billing/subscriptions/${encodeURIComponent(id)}`);

async function listTransactions(sub) {
    const start = new Date(new Date(sub.start_time || Date.now()).getTime() - 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const end = new Date(Date.now() + 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const data = await paypal(`/v1/billing/subscriptions/${encodeURIComponent(sub.id)}/transactions?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`);
    return data.transactions || [];
}

async function ensureSubscription({ id, email, planId, userId = null }) {
    const { data: existing } = await supabase.from('beatpost_subscriptions').select('*').eq('subscription_id', id).maybeSingle();
    if (existing) {
        const patch = {};
        if (validEmail(email) && existing.email !== lower(email)) patch.email = lower(email); // el correo del checkout manda
        if (userId && !existing.user_id) patch.user_id = userId;
        if (Object.keys(patch).length) {
            await supabase.from('beatpost_subscriptions').update({ ...patch, updated_at: new Date().toISOString() }).eq('subscription_id', id);
            Object.assign(existing, patch);
        }
        return existing;
    }
    const row = { subscription_id: id, email: lower(email), plan_id: planId, user_id: userId, status: 'active', payments_count: 0 };
    const { error } = await supabase.from('beatpost_subscriptions').upsert(row, { onConflict: 'subscription_id', ignoreDuplicates: true });
    if (error) throw error;
    return (await supabase.from('beatpost_subscriptions').select('*').eq('subscription_id', id).maybeSingle()).data;
}

// Procesa UNA cuota cobrada (idempotente por sale_id).
export async function processPayment({ subscription, saleId, amountUsd, feeUsd = null, netUsd = null, paidAt }) {
    const { data: already } = await supabase.from('beatpost_payments').select('*').eq('sale_id', saleId).maybeSingle();
    if (already) return { duplicate: true, n: already.n, until: already.pro_until };

    let n = null;
    for (let attempt = 0; attempt < 3 && n === null; attempt++) {
        const { count } = await supabase.from('beatpost_payments').select('sale_id', { count: 'exact', head: true }).eq('subscription_id', subscription.subscription_id);
        const candidate = (count || 0) + 1;
        const { error } = await supabase.from('beatpost_payments').insert({
            sale_id: saleId, subscription_id: subscription.subscription_id, n: candidate, amount_usd: amountUsd || BEATPOST_INSTALLMENT_USD, paid_at: paidAt || new Date().toISOString()
        });
        if (!error) n = candidate;
        else if (error.code === '23505') {
            const { data: again } = await supabase.from('beatpost_payments').select('*').eq('sale_id', saleId).maybeSingle();
            if (again) return { duplicate: true, n: again.n, until: again.pro_until };
        } else throw error;
    }
    if (n === null) throw new Error('No se pudo asignar el número de cuota.');

    const { data: first } = await supabase.from('beatpost_payments').select('paid_at').eq('subscription_id', subscription.subscription_id).eq('n', 1).maybeSingle();
    const until = proUntilForPayment(n, { firstPaidAt: first?.paid_at, paidAt: paidAt || new Date() });
    const grant = await grantPro({ email: subscription.email, userId: subscription.user_id, until, source: 'paypal_cuotas', ref: `sale:${saleId}`, note: subscription.subscription_id });
    await supabase.from('beatpost_payments').update({ pro_until: grant.until }).eq('sale_id', saleId);
    await supabase.from('beatpost_subscriptions').update({
        payments_count: n, status: n >= BEATPOST_INSTALLMENTS ? 'completed' : 'active', last_payment_at: paidAt || new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('subscription_id', subscription.subscription_id);

    const label = `cuota ${n} de ${BEATPOST_INSTALLMENTS}`;
    await recordOrder({ email: subscription.email, ref: saleId, amountUsd: amountUsd || BEATPOST_INSTALLMENT_USD, label });
    await recordIncome({
        source: 'subscription', ref: saleId, occurred_at: paidAt || new Date().toISOString(), email: subscription.email, product: `Beat Post · ${label}`, product_id: BEATPOST_PRODUCT_ID,
        method: 'paypal', currency: 'USD', gross: amountUsd || BEATPOST_INSTALLMENT_USD, fee: feeUsd, net: netUsd, status: 'confirmed', verified: true, by_willie: false, note: null, order_id: null
    });
    await notify({ email: subscription.email, grant, amountUsd: amountUsd || BEATPOST_INSTALLMENT_USD, label, ref: saleId, n });
    return { duplicate: false, n, until: grant.until, applied: grant.applied };
}

// Justo después de aprobar la suscripción en la página.
export async function confirmSubscription({ subscriptionId, email, userId }) {
    const planId = await getPlanId();
    if (!planId) throw fail('Las cuotas aún no están habilitadas.', 503);
    const sub = await getSubscription(subscriptionId);
    if (sub.plan_id !== planId) throw fail('Esta suscripción no es de Beat Post.', 400);
    if (!['ACTIVE', 'APPROVED', 'APPROVAL_PENDING'].includes(sub.status)) throw fail('La suscripción no está activa.', 400);
    const buyer = validEmail(email) ? email : sub.subscriber?.email_address;
    if (!validEmail(buyer)) throw fail('Falta un correo válido.', 400);
    const row = await ensureSubscription({ id: subscriptionId, email: buyer, planId, userId });

    // El primer cobro puede tardar unos segundos en aparecer; si no aparece, el webhook lo completa.
    for (let attempt = 0; attempt < 3; attempt++) {
        const [first] = completedSales(await listTransactions(sub));
        if (first) {
            const r = await processPayment({ subscription: row, ...first });
            return { ok: true, pending: false, n: r.n, until: r.until, applied: r.applied, email: row.email };
        }
        if (attempt < 2) await new Promise((res) => setTimeout(res, 2000));
    }
    return { ok: true, pending: true, email: row.email };
}

// Webhook de PayPal: true si el evento era de Beat Post (y ya se atendió).
export async function handleWebhook(event) {
    const type = event?.event_type || '';
    const isSale = type === 'PAYMENT.SALE.COMPLETED';
    if (!isSale && !type.startsWith('BILLING.SUBSCRIPTION.')) return false;
    const subscriptionId = isSale ? event.resource?.billing_agreement_id : event.resource?.id;
    if (!subscriptionId || !String(subscriptionId).startsWith('I-')) return false;
    const planId = await getPlanId();
    if (!planId) return false;

    // Antes de preguntar a PayPal: ¿la conocemos o el aviso trae el plan? (no gastar llamadas en otras suscripciones)
    const { data: known } = await supabase.from('beatpost_subscriptions').select('*').eq('subscription_id', subscriptionId).maybeSingle();
    if (!known && !isSale && event.resource?.plan_id && event.resource.plan_id !== planId) return false;

    const sub = await getSubscription(subscriptionId);
    if (sub.plan_id !== planId) return false;
    const row = known || await ensureSubscription({ id: subscriptionId, email: sub.subscriber?.email_address, planId });

    if (isSale) {
        let sale = null;
        for (let attempt = 1; attempt <= 3 && !sale; attempt++) {
            sale = findCompletedSale(await listTransactions(sub), event.resource?.id);
            if (!sale && attempt < 3) await new Promise((r) => setTimeout(r, 2000));
        }
        if (!sale) throw new Error(`pago ${event.resource?.id} aún no confirmado por PayPal`); // PayPal reintenta; uno falso nunca aparece
        await processPayment({ subscription: row, ...sale });
        return true;
    }
    if (type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED' || type === 'BILLING.SUBSCRIPTION.SUSPENDED') {
        if (row.status !== 'completed') {
            await supabase.from('beatpost_subscriptions').update({ status: 'past_due', last_failed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('subscription_id', subscriptionId);
            await emailOwner({ subject: `⚠️ [BEAT POST · PAGO FALLIDO] ${row.email}`, lines: [`Falló el cobro de la cuota 2 de <b>${esc(row.email)}</b>. Su PRO sigue hasta el fin del mes pagado y luego baja solo.`] }).catch(() => {});
        }
        return true;
    }
    if (type === 'BILLING.SUBSCRIPTION.CANCELLED') {
        await supabase.from('beatpost_subscriptions').update({ status: row.status === 'completed' ? 'completed' : 'cancelled', updated_at: new Date().toISOString() }).eq('subscription_id', subscriptionId);
        return true;
    }
    if (type === 'BILLING.SUBSCRIPTION.EXPIRED') {
        await supabase.from('beatpost_subscriptions').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('subscription_id', subscriptionId);
        return true;
    }
    return true;
}

// Repaso (cron): suscripciones abiertas sin cobro reciente → se mira directo en PayPal. Seguro de repetir.
export async function reconcile() {
    const out = { polled: 0, recovered: 0, failed: [] };
    const { data: subs } = await supabase.from('beatpost_subscriptions').select('*').eq('status', 'active');
    for (const row of subs || []) {
        const stale = !row.last_payment_at || Date.now() - new Date(row.last_payment_at).getTime() > 27 * 86400000;
        if (!stale || (row.payments_count || 0) >= BEATPOST_INSTALLMENTS) continue;
        out.polled++;
        try {
            const sub = await getSubscription(row.subscription_id);
            for (const sale of completedSales(await listTransactions(sub))) {
                const r = await processPayment({ subscription: row, ...sale });
                if (!r.duplicate) out.recovered++;
            }
        } catch (e) { out.failed.push({ subscriptionId: row.subscription_id, error: e.message }); }
    }
    return out;
}

export const BEATPOST_PUBLIC_CONFIG = async () => ({
    planId: await getPlanId(), priceUsd: BEATPOST_PRICE_USD, installments: BEATPOST_INSTALLMENTS, installmentUsd: BEATPOST_INSTALLMENT_USD, proMonths: BEATPOST_PRO_MONTHS,
    downloadUrl: process.env.BEATPOST_WIN_URL || null
});
