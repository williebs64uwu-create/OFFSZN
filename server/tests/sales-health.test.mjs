// Prueba de ventas: reglas del semáforo + correo por Brevo (sin red: fetch simulado).
//   node --test --experimental-test-module-mocks tests/sales-health.test.mjs
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { checkStarSales, checkLedger, summarizeBrevoEvents, buildHealthReport } from '../src/shared/store/salesHealth.js';

const NOW = Date.parse('2026-11-25T12:00:00Z');
const pay = (o = {}) => ({ sale_id: 'S1', subscription_id: 'I-1', n: 1, license_serial: 'STAR-SUB-AAAA', paid_at: '2026-11-24T10:00:00Z', ...o });
const lic = (o = {}) => ({ serial_key: 'STAR-SUB-AAAA', status: 'active', expires_at: '2026-12-24T00:00:00Z', ...o });
const sub = (o = {}) => ({ subscription_id: 'I-1', email: 'c@x.com', status: 'active', payments_count: 1, ...o });
const inc = (o = {}) => ({ ref: 'S1', source: 'subscription', method: 'paypal', currency: 'USD', fee: 1.18, occurred_at: '2026-11-24T10:00:00Z', ...o });

test('STAR: una cuota completa (licencia activa + finanzas + correo del cliente) pasa', () => {
    const r = checkStarSales({ payments: [pay()], licenses: [lic()], subscriptions: [sub()], income: [inc()], now: NOW });
    assert.deepEqual([r.total, r.bad, r.items[0].ok], [1, 0, true]);
});
test('STAR: detecta cuota sin licencia, licencia revocada/vencida, sin finanzas y sin correo', () => {
    const sinLic = checkStarSales({ payments: [pay({ license_serial: null })], licenses: [], subscriptions: [sub()], income: [inc()], now: NOW });
    assert.match(sinLic.items[0].problems[0], /NO tiene licencia/);
    const revocada = checkStarSales({ payments: [pay()], licenses: [lic({ status: 'revoked' })], subscriptions: [sub()], income: [inc()], now: NOW });
    assert.match(revocada.items[0].problems[0], /revoked/);
    const vencida = checkStarSales({ payments: [pay()], licenses: [lic({ expires_at: '2026-11-01T00:00:00Z' })], subscriptions: [sub()], income: [inc()], now: NOW });
    assert.match(vencida.items[0].problems[0], /venció/);
    const sinFin = checkStarSales({ payments: [pay()], licenses: [lic()], subscriptions: [sub()], income: [], now: NOW });
    assert.match(sinFin.items[0].problems[0], /finanzas/);
    const sinMail = checkStarSales({ payments: [pay()], licenses: [lic()], subscriptions: [sub({ email: null })], income: [inc()], now: NOW });
    assert.match(sinMail.items[0].problems[0], /correo/);
});
test('STAR: avisa de quien canceló antes de la cuota 3', () => {
    const r = checkStarSales({ payments: [], licenses: [], subscriptions: [sub({ status: 'cancelled', payments_count: 1 }), sub({ subscription_id: 'I-2', status: 'cancelled', payments_count: 3 })], income: [], now: NOW });
    assert.equal(r.cancelled.length, 1);
});
test('Libro: detecta USD sin comisión, Yape en dólares y ventas viejas', () => {
    const l = checkLedger({ income: [inc({ fee: null, ref: 'A' }), inc({ method: 'yape', currency: 'USD', ref: 'B' })], now: NOW });
    assert.equal(l.usdNoFee.length, 1); assert.equal(l.badCurrency.length, 1);
    assert.equal(checkLedger({ income: [], now: NOW }).lastAt, null);
});
test('Brevo: cuenta entregados y separa los que NO llegaron', () => {
    const s = summarizeBrevoEvents([{ event: 'delivered', email: 'a@x.com' }, { event: 'requests', email: 'a@x.com' }, { event: 'hardBounces', email: 'b@x.com', subject: 'Tu clave' }, { event: 'blocked', email: 'c@x.com' }]);
    assert.equal(s.delivered, 1); assert.equal(s.failures.length, 2); assert.equal(s.failures[0].subject, 'Tu clave');
});
test('Semáforo: todo bien = verde; correo rebotado = rojo; sin llave de Brevo = rojo', () => {
    const env = { BREVO_API_KEY: 1, PAYPAL_CLIENT_ID: 1, PAYPAL_CLIENT_SECRET: 1, SUPABASE_SERVICE_KEY: 1, STORE_CRON_SECRET: 1, MERCADOPAGO_ACCESS_TOKEN: 1 };
    const star = checkStarSales({ payments: [pay()], licenses: [lic()], subscriptions: [sub()], income: [inc()], now: NOW });
    const ledger = checkLedger({ income: [inc()], now: NOW });
    const ok = buildHealthReport({ env, star, ledger, brevo: { account: 'w@x.com', summary: summarizeBrevoEvents([{ event: 'delivered' }]) }, now: NOW });
    assert.equal(ok.status, 'ok');
    const bad = buildHealthReport({ env, star, ledger, brevo: { summary: summarizeBrevoEvents([{ event: 'hardBounces', email: 'z@x.com' }]) }, now: NOW });
    assert.equal(bad.status, 'bad');
    const noKey = buildHealthReport({ env: { ...env, BREVO_API_KEY: 0 }, star, ledger, now: NOW });
    assert.equal(noKey.status, 'bad');
    const noBrevoRead = buildHealthReport({ env, star, ledger, brevo: { error: '401' }, now: NOW });
    assert.equal(noBrevoRead.status, 'warn');
});

// ─── Correo real por Brevo (fetch simulado) ───────────────────────────────────────────────────────────────────
test('Mailer: manda por la API de Brevo con el remitente de OFFSZN y devuelve el messageId', async () => {
    const calls = [];
    mock.module('../src/shared/config/config.js', { namedExports: { BREVO_USER: '', BREVO_PASS: '', BREVO_HOST: 'localhost', BREVO_PORT: '587', BREVO_API_KEY: 'k', GMAIL_USER: '', GMAIL_PASS: '', GMAIL_HOST: 'localhost', GMAIL_PORT: '587' } });
    globalThis.fetch = async (url, opts) => { calls.push({ url: String(url), opts }); return url.includes('/smtp/email') ? { ok: true, json: async () => ({ messageId: '<abc@brevo>' }) } : { ok: true, json: async () => ({}) }; };
    const { sendOffsznEmail } = await import('../src/shared/utils/mailer.js');
    const r = await sendOffsznEmail({ to: 'cliente@x.com', subject: 'Tu clave', html: '<b>STAR-SUB-1</b>' });
    assert.equal(r.messageId, '<abc@brevo>');
    const send = calls.find((c) => c.url.includes('/smtp/email'));
    const body = JSON.parse(send.opts.body);
    assert.equal(send.opts.headers['api-key'], 'k'); assert.equal(body.to[0].email, 'cliente@x.com'); assert.equal(body.sender.email, 'no-reply@offszn.lat'); assert.match(body.htmlContent, /STAR-SUB-1/);
});
test('Mailer: si Brevo responde error, el envío FALLA (no se hace pasar por enviado)', async () => {
    globalThis.fetch = async (url) => (String(url).includes('/smtp/email') ? { ok: false, text: async () => 'unauthorized' } : { ok: true, json: async () => ({}) });
    const { sendOffsznEmail } = await import('../src/shared/utils/mailer.js');
    await assert.rejects(() => sendOffsznEmail({ to: 'cliente@x.com', subject: 's', html: 'h' }), /Brevo|unauthorized/i);
});
