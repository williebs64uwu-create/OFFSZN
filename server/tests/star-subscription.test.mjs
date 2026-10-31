// STAR CHAIN en 3 cuotas: ciclo completo con una base de datos y un PayPal simulados (sin red).
//   node --test --experimental-test-module-mocks tests/star-subscription.test.mjs
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

// ─── Base de datos en memoria (solo lo que usa el servicio) ───────────────────────────────────────────────────
const tables = {};
const reset = () => { for (const k of Object.keys(tables)) delete tables[k]; };
const T = (name) => (tables[name] ||= []);
const UNIQUE = { star_subscriptions: [['subscription_id']], star_subscription_payments: [['sale_id'], ['subscription_id', 'n']], star_config: [['key']] };
let autoId = 1;

class Query {
    constructor(table) { this.table = table; this.filters = []; this.op = 'select'; this.opts = {}; }
    select(_cols, opts = {}) { if (this.op === 'select') this.opts = opts; this.returning = true; return this; }
    insert(row) { this.op = 'insert'; this.row = row; return this; }
    upsert(rows, o = {}) { this.op = 'upsert'; this.rows = [].concat(rows); this.conflict = o; return this; }
    update(patch) { this.op = 'update'; this.patch = patch; return this; }
    eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
    in(c, vals) { this.filters.push((r) => vals.includes(r[c])); return this; }
    match() { return T(this.table).filter((r) => this.filters.every((f) => f(r))); }
    run() {
        const rows = T(this.table);
        if (this.op === 'insert' || this.op === 'upsert') {
            const incoming = this.op === 'insert' ? [this.row] : this.rows;
            const out = [];
            for (const raw of incoming) {
                const row = { id: autoId++, ...raw };
                const dup = (UNIQUE[this.table] || []).some((cols) => rows.some((r) => cols.every((c) => r[c] === row[c])));
                if (dup) {
                    if (this.op === 'upsert' && this.conflict.ignoreDuplicates) continue;
                    return { data: null, error: { code: '23505', message: 'duplicate key' } };
                }
                rows.push(row); out.push(row);
            }
            return { data: out, error: null };
        }
        if (this.op === 'update') { const hit = this.match(); hit.forEach((r) => Object.assign(r, this.patch)); return { data: hit, error: null }; }
        const hit = this.match();
        return { data: hit, error: null, count: hit.length };
    }
    then(res, rej) {
        const r = this.run();
        if (this.opts.head) r.data = null;
        return Promise.resolve(r).then(res, rej);
    }
    maybeSingle() { const r = this.run(); return Promise.resolve({ ...r, data: r.data?.[0] ?? null }); }
    single() { const r = this.run(); return Promise.resolve({ ...r, data: r.data?.[0] ?? null, error: r.data?.[0] ? null : r.error || { message: 'no rows' } }); }
}
const supabase = { from: (t) => new Query(t) };

const emails = [];
mock.module('../src/infrastructure/database/connection.js', { namedExports: { supabase } });
mock.module('../src/shared/utils/mailer.js', { namedExports: { sendOffsznEmail: async (m) => { emails.push(m); } } });
mock.module('../src/shared/config/config.js', { namedExports: { PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'secret', PAYPAL_ENVIRONMENT: 'live' } });

const svc = await import('../src/infrastructure/services/starSubscriptionService.js');

// ─── PayPal simulado ──────────────────────────────────────────────────────────────────────────────────────────
const SUB_ID = 'I-TESTSTAR0001';
let paypalTx = [];
globalThis.fetch = async (url) => {
    const u = String(url);
    const json = (b) => ({ ok: true, status: 200, json: async () => b });
    if (u.includes('/oauth2/token')) return json({ access_token: 'tok' });
    if (u.includes('/transactions')) return json({ transactions: paypalTx });
    if (u.includes(`/subscriptions/${SUB_ID}`)) return json({ id: SUB_ID, plan_id: 'P-STAR', status: 'ACTIVE', start_time: '2026-11-01T00:00:00Z', subscriber: { email_address: 'comprador@correo.com' } });
    if (u.includes('/subscriptions/I-OTHER')) return json({ id: 'I-OTHER', plan_id: 'P-OTRO', status: 'ACTIVE' });
    return { ok: false, status: 404, json: async () => ({}) };
};
const sale = (id, status = 'COMPLETED') => ({ id, status, time: '2026-11-01T00:00:00Z', amount_with_breakdown: { gross_amount: { value: '16.33' } } });
const saleEvent = (id) => ({ event_type: 'PAYMENT.SALE.COMPLETED', resource: { id, billing_agreement_id: SUB_ID } });
const licenses = () => T('plugin_licenses').filter((l) => l.plugin_name === 'STAR CHAIN');
const byStatus = (s) => licenses().filter((l) => l.status === s);

test('cuotas: 1 y 2 dan clave SUB de un mes (la anterior se revoca), un cobro fallido las suspende y la 3 da FULL', async () => {
    reset(); emails.length = 0; process.env.STAR_PAYPAL_PLAN_ID = 'P-STAR';
    T('products').push({ id: 5003, sales_count: 0 });

    // Cuota 1
    paypalTx = [sale('S1')];
    assert.equal(await svc.handleStarWebhook(saleEvent('S1')), true);
    assert.equal(licenses().length, 1);
    assert.match(licenses()[0].serial_key, /^STAR-SUB-/);
    assert.equal(licenses()[0].license_type, 'subscription');
    assert.ok(licenses()[0].expires_at);
    assert.equal(T('orders').length, 1);
    assert.equal(T('orders')[0].total_price, 16.33);
    assert.equal(T('products')[0].sales_count, 1);
    assert.ok(emails.some((m) => m.to === 'comprador@correo.com' && /cuota 1 de 3/.test(m.subject)));
    assert.ok(emails.some((m) => m.to === 'willie2008garay@gmail.com' && /CUOTA 1\/3/.test(m.subject)));

    // El mismo cobro llegando otra vez (navegador + webhook) no duplica nada
    await svc.handleStarWebhook(saleEvent('S1'));
    assert.equal(licenses().length, 1);
    assert.equal(T('orders').length, 1);

    // Cuota 2: clave nueva y la del mes anterior queda revocada
    paypalTx = [sale('S1'), sale('S2')];
    await svc.handleStarWebhook(saleEvent('S2'));
    assert.equal(licenses().length, 2);
    assert.equal(byStatus('active').length, 1);
    assert.equal(byStatus('revoked').length, 1);
    assert.match(byStatus('active')[0].serial_key, /^STAR-SUB-/);

    // Cobro fallido: se revoca la clave activa hasta que se pague
    await svc.handleStarWebhook({ event_type: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED', resource: { id: SUB_ID } });
    assert.equal(byStatus('active').length, 0);
    assert.equal(T('star_subscriptions')[0].status, 'past_due');
    assert.ok(emails.some((m) => /no se pudo cobrar/.test(m.subject)));

    // Cuota 3 (pagada después del fallo): FULL de por vida
    paypalTx = [sale('S1'), sale('S2'), sale('S3')];
    await svc.handleStarWebhook(saleEvent('S3'));
    const full = byStatus('active');
    assert.equal(full.length, 1);
    assert.match(full[0].serial_key, /^STAR-FULL-/);
    assert.equal(full[0].license_type, 'lifetime');
    assert.equal(full[0].expires_at, null);
    assert.equal(T('star_subscriptions')[0].status, 'completed');
    assert.equal(T('orders').length, 3);
    assert.equal(T('products')[0].sales_count, 1); // solo la cuota 1 cuenta como venta nueva del producto
});

test('un webhook falso (cobro que PayPal no confirma) no crea licencias, y otras suscripciones no se tocan', async () => {
    reset(); emails.length = 0; process.env.STAR_PAYPAL_PLAN_ID = 'P-STAR';
    paypalTx = [];
    assert.equal(await svc.handleStarWebhook(saleEvent('FAKE')), true); // es de STAR, pero PayPal no lo confirma
    assert.equal(licenses().length, 0);
    assert.equal(T('orders').length, 0);
    // Una suscripción de otro plan la atiende el flujo de siempre
    assert.equal(await svc.handleStarWebhook({ event_type: 'PAYMENT.SALE.COMPLETED', resource: { id: 'X', billing_agreement_id: 'I-OTHER' } }), false);
    // Eventos que no son de suscripción tampoco
    assert.equal(await svc.handleStarWebhook({ event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'O1' } }), false);
});

test('confirmar desde el navegador entrega la clave de la cuota 1 y es idempotente', async () => {
    reset(); emails.length = 0; process.env.STAR_PAYPAL_PLAN_ID = 'P-STAR';
    paypalTx = [sale('S1')];
    const a = await svc.confirmStarSubscription({ subscriptionId: SUB_ID, email: 'cliente@correo.com', userId: null });
    assert.equal(a.pending, false);
    assert.match(a.serialKey, /^STAR-SUB-/);
    assert.equal(a.email, 'cliente@correo.com'); // manda el correo escrito en el checkout
    const b = await svc.confirmStarSubscription({ subscriptionId: SUB_ID, email: 'cliente@correo.com', userId: null });
    assert.equal(b.serialKey, a.serialKey);
    assert.equal(licenses().length, 1);
});
