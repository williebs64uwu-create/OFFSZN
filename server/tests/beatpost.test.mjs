// Beat Post: pago único, 2 cuotas, compras sin cuenta (pendientes) y Scavenger, con base de datos y PayPal simulados.
//   node --test --test-force-exit --experimental-test-module-mocks tests/beatpost.test.mjs
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

// ─── Base de datos en memoria ─────────────────────────────────────────────────────────────────────────────────
const tables = {};
const reset = () => { for (const k of Object.keys(tables)) delete tables[k]; };
const T = (name) => (tables[name] ||= []);
const UNIQUE = { beatpost_grants: [['ref']], beatpost_subscriptions: [['subscription_id']], beatpost_payments: [['sale_id'], ['subscription_id', 'n']], star_config: [['key']], finance_income: [['source', 'ref']] };
let autoId = 1;

class Query {
    constructor(table) { this.table = table; this.filters = []; this.op = 'select'; this.opts = {}; this.sort = null; this.max = null; }
    select(_c, opts = {}) { if (this.op === 'select') this.opts = opts; return this; }
    insert(row) { this.op = 'insert'; this.rows = [].concat(row); return this; }
    upsert(rows, o = {}) { this.op = 'upsert'; this.rows = [].concat(rows); this.conflict = o; return this; }
    update(patch) { this.op = 'update'; this.patch = patch; return this; }
    eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
    in(c, vals) { this.filters.push((r) => vals.includes(r[c])); return this; }
    is(c, v) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
    ilike(c, v) { this.filters.push((r) => String(r[c] || '').toLowerCase() === String(v).toLowerCase()); return this; }
    gt(c, v) { this.filters.push((r) => r[c] > v); return this; }
    lt(c, v) { this.filters.push((r) => r[c] < v); return this; }
    order(c, { ascending = true } = {}) { this.sort = { c, ascending }; return this; }
    limit(n) { this.max = n; return this; }
    match() { return T(this.table).filter((r) => this.filters.every((f) => f(r))); }
    run() {
        const rows = T(this.table);
        if (this.op === 'insert' || this.op === 'upsert') {
            const out = [];
            for (const raw of this.rows) {
                const row = { id: autoId++, ...raw };
                const keys = UNIQUE[this.table] || [];
                const dupRow = rows.find((r) => keys.some((cols) => cols.every((c) => r[c] === row[c])));
                if (dupRow) {
                    if (this.op === 'upsert' && this.conflict.ignoreDuplicates) continue;
                    if (this.op === 'upsert') { Object.assign(dupRow, raw); out.push(dupRow); continue; }
                    return { data: null, error: { code: '23505', message: 'duplicate key' } };
                }
                rows.push(row); out.push(row);
            }
            return { data: out, error: null };
        }
        if (this.op === 'update') { const hit = this.match(); hit.forEach((r) => Object.assign(r, this.patch)); return { data: hit, error: null }; }
        let hit = this.match();
        if (this.sort) hit = [...hit].sort((a, b) => (String(a[this.sort.c]) < String(b[this.sort.c]) ? -1 : 1) * (this.sort.ascending ? 1 : -1));
        if (this.max) hit = hit.slice(0, this.max);
        return { data: hit, error: null, count: hit.length };
    }
    then(res, rej) { const r = this.run(); if (this.opts.head) r.data = null; return Promise.resolve(r).then(res, rej); }
    maybeSingle() { const r = this.run(); return Promise.resolve({ ...r, data: r.data?.[0] ?? null }); }
    single() { const r = this.run(); return Promise.resolve({ ...r, data: r.data?.[0] ?? null, error: r.data?.[0] ? null : r.error || { message: 'no rows' } }); }
}
const supabase = { from: (t) => new Query(t) };

const emails = [];
mock.module('../src/infrastructure/database/connection.js', { namedExports: { supabase } });
mock.module('../src/shared/utils/mailer.js', { namedExports: { sendOffsznEmail: async (m) => { emails.push(m); } } });
mock.module('../src/shared/config/config.js', { namedExports: { PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'secret', PAYPAL_ENVIRONMENT: 'live' } });

const svc = await import('../src/infrastructure/services/beatpostService.js');
const { runSubscriptionScavenger } = await import('../src/infrastructure/services/subscription-scavenger.js');

// ─── PayPal simulado ──────────────────────────────────────────────────────────────────────────────────────────
const SUB_ID = 'I-BEATPOST0001';
let captureAmount = '39.00';
let captured = new Set();
let paypalTx = [];
const calls = [];
globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push(`${opts.method || 'GET'} ${u.replace('https://api-m.paypal.com', '')}`);
    const json = (b, status = 200) => ({ ok: status < 400, status, json: async () => b });
    if (u.includes('/oauth2/token')) return json({ access_token: 'tok' });
    if (u.endsWith('/v2/checkout/orders') && opts.method === 'POST') {
        const body = JSON.parse(opts.body);
        assert.equal(body.purchase_units[0].amount.value, '39.00'); // el precio lo pone el servidor
        return json({ id: 'ORDER12345' });
    }
    const m = u.match(/\/v2\/checkout\/orders\/([A-Z0-9]+)(\/capture)?$/);
    if (m) {
        const order = {
            id: m[1], status: 'COMPLETED', payer: { email_address: 'paypal@correo.com' },
            purchase_units: [{ custom_id: 'BEATPOST', payments: { captures: [{ id: `CAP-${m[1]}`, status: 'COMPLETED', amount: { value: captureAmount, currency_code: 'USD' }, seller_receivable_breakdown: { paypal_fee: { value: '2.10' }, net_amount: { value: '36.90' } } }] } }]
        };
        if (m[2]) { if (captured.has(m[1])) return json({ name: 'UNPROCESSABLE_ENTITY' }, 422); captured.add(m[1]); }
        return json(order);
    }
    if (u.includes('/transactions')) return json({ transactions: paypalTx });
    if (u.includes(`/subscriptions/${SUB_ID}`)) return json({ id: SUB_ID, plan_id: 'P-BEATPOST', status: 'ACTIVE', start_time: '2026-11-01T00:00:00Z', subscriber: { email_address: 'cuotas@correo.com' } });
    if (u.includes('/subscriptions/I-OTHER')) return json({ id: 'I-OTHER', plan_id: 'P-OTRO', status: 'ACTIVE' });
    return json({}, 404);
};
const sale = (id, time) => ({ id, status: 'COMPLETED', time, amount_with_breakdown: { gross_amount: { value: '20.00' }, fee_amount: { value: '1.30' }, net_amount: { value: '18.70' } } });
const saleEvent = (id) => ({ event_type: 'PAYMENT.SALE.COMPLETED', resource: { id, billing_agreement_id: SUB_ID } });
const DAY = 86400000;
const subOf = (userId) => T('subscriptions').filter((s) => s.user_id === userId && s.provider === 'beatpost');
const user = (id, email, plan = 'free') => { T('users').push({ id, email, plan }); T('profiles').push({ id, plan }); };
const fresh = () => { reset(); emails.length = 0; calls.length = 0; captured = new Set(); captureAmount = '39.00'; paypalTx = []; process.env.BEATPOST_PAYPAL_PLAN_ID = 'P-BEATPOST'; };

test('pago único: cobra 39, da PRO 12 meses, anota finanzas, manda correos y no se repite', async () => {
    fresh(); user('u1', 'Comprador@Correo.com');
    assert.equal((await svc.createOrder()).id, 'ORDER12345');
    const r = await svc.captureOrder({ orderId: 'ORDER12345', email: 'comprador@correo.com' });
    assert.equal(r.ok, true); assert.equal(r.applied, true);
    const months = (new Date(r.until) - Date.now()) / DAY;
    assert.ok(months > 360 && months < 370, `hasta ${r.until}`);
    assert.equal(T('users')[0].plan, 'pro'); assert.equal(T('profiles')[0].plan, 'pro');
    assert.equal(subOf('u1').length, 1); assert.equal(subOf('u1')[0].plan_id, 'pro_beatpost');
    assert.equal(T('finance_income').length, 1); assert.equal(T('finance_income')[0].gross, 39); assert.equal(T('finance_income')[0].net, 36.9);
    assert.equal(emails.length, 2); // comprador + Willie
    assert.ok(emails.some((e) => e.to === 'comprador@correo.com' && /activos/.test(e.subject)));

    // El navegador repite la confirmación (doble clic, recarga): nada se duplica
    const again = await svc.captureOrder({ orderId: 'ORDER12345', email: 'comprador@correo.com' });
    assert.equal(again.duplicate, true);
    assert.equal(subOf('u1').length, 1); assert.equal(T('beatpost_grants').length, 1); assert.equal(emails.length, 2);
});

test('pago único: si PayPal cobró menos de 39 no se activa nada', async () => {
    fresh(); user('u1', 'a@correo.com'); captureAmount = '1.00';
    await assert.rejects(svc.captureOrder({ orderId: 'ORDERCHEAP1', email: 'a@correo.com' }), /no confirmó/);
    assert.equal(T('users')[0].plan, 'free'); assert.equal(T('beatpost_grants').length, 0);
});

test('comprar de nuevo extiende desde el fin del PRO vigente', async () => {
    fresh(); user('u1', 'a@correo.com');
    const first = await svc.captureOrder({ orderId: 'ORDERAAAA1', email: 'a@correo.com' });
    const second = await svc.captureOrder({ orderId: 'ORDERBBBB2', email: 'a@correo.com' });
    const gain = (new Date(second.until) - new Date(first.until)) / DAY;
    assert.ok(gain > 360 && gain < 370);
    assert.equal(subOf('u1').length, 1);
});

test('compra con un correo sin cuenta: queda pendiente y se aplica al iniciar sesión en Beat Post', async () => {
    fresh();
    const r = await svc.captureOrder({ orderId: 'ORDERNEW01', email: 'Nuevo@Correo.com' });
    assert.equal(r.applied, false);
    assert.equal(T('beatpost_grants')[0].email, 'nuevo@correo.com');
    assert.ok(emails.some((e) => e.to === 'nuevo@correo.com' && /mismo correo/.test(e.html)));

    user('u9', 'nuevo@correo.com');
    const claim = await svc.claimPendingGrants({ userId: 'u9', email: 'nuevo@correo.com' });
    assert.equal(claim.applied, 1); assert.equal(claim.plan, 'pro');
    assert.equal(T('users')[0].plan, 'pro');
    assert.ok(T('beatpost_grants')[0].applied_at);
    // Otra vez: ya no hay nada pendiente, sigue en PRO
    const again = await svc.claimPendingGrants({ userId: 'u9', email: 'nuevo@correo.com' });
    assert.equal(again.applied, 0); assert.equal(again.plan, 'pro');
});

test('cuotas: la 1 da 33 días, la 2 completa el año desde la 1; avisos repetidos no duplican', async () => {
    fresh(); user('u5', 'cuotas@correo.com');
    const t1 = new Date(Date.now() - 2 * DAY).toISOString();
    paypalTx = [sale('S1', t1)];
    assert.equal(await svc.handleWebhook(saleEvent('S1')), true);
    let s = subOf('u5')[0];
    const d1 = (new Date(s.current_period_end) - new Date(t1)) / DAY;
    assert.ok(Math.abs(d1 - 33) < 0.01, `cuota 1 → ${d1} días`);
    assert.equal(T('users')[0].plan, 'pro');

    assert.equal(await svc.handleWebhook(saleEvent('S1')), true); // PayPal repite el aviso
    assert.equal(T('beatpost_payments').length, 1);

    const t2 = new Date().toISOString();
    paypalTx = [sale('S1', t1), sale('S2', t2)];
    await svc.handleWebhook(saleEvent('S2'));
    s = subOf('u5')[0];
    const year = new Date(t1); year.setUTCMonth(year.getUTCMonth() + 12);
    assert.equal(s.current_period_end, year.toISOString());
    assert.equal(T('beatpost_subscriptions')[0].status, 'completed');
    assert.equal(T('finance_income').length, 2);
    assert.equal(subOf('u5').length, 1);
});

test('confirmación desde la página justo después de aprobar las cuotas', async () => {
    fresh(); user('u5', 'checkout@correo.com');
    paypalTx = [sale('S1', new Date().toISOString())];
    const r = await svc.confirmSubscription({ subscriptionId: SUB_ID, email: 'checkout@correo.com' });
    assert.equal(r.pending, false); assert.equal(r.n, 1); assert.equal(r.applied, true);
    assert.equal(T('beatpost_subscriptions')[0].email, 'checkout@correo.com'); // el correo del checkout manda
});

test('suscripciones de otros productos no se tocan; sin plan configurado tampoco', async () => {
    fresh();
    assert.equal(await svc.handleWebhook({ event_type: 'PAYMENT.SALE.COMPLETED', resource: { id: 'X', billing_agreement_id: 'I-OTHER' } }), false);
    assert.equal(await svc.handleWebhook({ event_type: 'CHECKOUT.ORDER.APPROVED', resource: {} }), false);
    delete process.env.BEATPOST_PAYPAL_PLAN_ID;
    assert.equal(await svc.handleWebhook(saleEvent('S1')), false);
    assert.equal(T('beatpost_grants').length, 0);
});

test('PRO a mano (Yape, regalo): con y sin cuenta', async () => {
    fresh(); user('u1', 'yape@correo.com');
    const a = await svc.grantPro({ email: 'yape@correo.com', months: 12, source: 'manual', ref: 'manual:1' });
    assert.equal(a.applied, true); assert.equal(T('users')[0].plan, 'pro');
    const b = await svc.grantPro({ email: 'sincuenta@correo.com', months: 12, source: 'manual', ref: 'manual:2' });
    assert.equal(b.applied, false);
});

test('Scavenger: al vencer Beat Post baja a free, pero no si le queda otro plan vigente', async () => {
    fresh();
    user('u1', 'solo@correo.com', 'pro'); user('u2', 'doble@correo.com', 'pro');
    const past = new Date(Date.now() - DAY).toISOString(), future = new Date(Date.now() + 30 * DAY).toISOString();
    T('subscriptions').push({ id: 101, user_id: 'u1', plan_id: 'pro_beatpost', provider: 'beatpost', status: 'active', current_period_end: past });
    T('subscriptions').push({ id: 102, user_id: 'u2', plan_id: 'pro_beatpost', provider: 'beatpost', status: 'active', current_period_end: past });
    T('subscriptions').push({ id: 103, user_id: 'u2', plan_id: 'pro_monthly', provider: 'manual', status: 'active', current_period_end: future });
    await runSubscriptionScavenger();
    assert.equal(T('users').find((u) => u.id === 'u1').plan, 'free');
    assert.equal(T('users').find((u) => u.id === 'u2').plan, 'pro');
    assert.equal(T('subscriptions').find((s) => s.id === 102).status, 'expired');
});
