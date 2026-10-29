// Motor de automatizaciones del CRM contra una base falsa en memoria (sin red ni correo real).
//   node --test tests/store-crm.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// El módulo crea el cliente de Supabase al importarse: se le da una URL de mentira (nunca se usa).
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_KEY = 'x';
const { runAutomations } = await import('../src/infrastructure/services/crmService.js');
const { signEmail, verifyEmailSig } = await import('../src/infrastructure/services/storeService.js');

const NOW = Date.parse('2026-10-23T12:00:00Z');
const ago = (h) => new Date(NOW - h * 3600 * 1000).toISOString();

function fakeDb(tables) {
    class Q {
        constructor(name) { this.name = name; this.op = 'select'; this.f = []; this.max = Infinity; }
        select() { return this; }
        insert(row) { this.op = 'insert'; this.row = row; return this._p(); }
        update(patch) { this.op = 'update'; this.patch = patch; return this; }
        delete() { this.op = 'delete'; return this; }
        eq(c, v) { this.f.push((r) => r[c] === v); return this; }
        is(c, v) { this.f.push((r) => (r[c] ?? null) === v); return this; }
        gte(c, v) { this.f.push((r) => r[c] != null && r[c] >= v); return this; }
        lte(c, v) { this.f.push((r) => r[c] != null && r[c] <= v); return this; }
        in(c, arr) { this.f.push((r) => arr.includes(r[c])); return this; }
        limit(n) { this.max = n; return this; }
        maybeSingle() { this.single = true; return this; }
        _rows() { return (tables[this.name] ||= []).filter((r) => this.f.every((fn) => fn(r))); }
        _p() {
            // Índice único de store_automation_log (rule, email, ref)
            if (this.op === 'insert' && this.name === 'store_automation_log') {
                const dup = tables.store_automation_log.some((r) => r.rule === this.row.rule && r.email === this.row.email && r.ref === this.row.ref);
                if (dup) return Promise.resolve({ error: { code: '23505' } });
            }
            if (this.op === 'insert') (tables[this.name] ||= []).push({ ...this.row });
            return Promise.resolve({ error: null });
        }
        then(res, rej) {
            let out;
            if (this.op === 'update') { this._rows().forEach((r) => Object.assign(r, this.patch)); out = { error: null }; }
            else if (this.op === 'delete') {
                const hit = new Set(this._rows());
                tables[this.name] = tables[this.name].filter((r) => !hit.has(r));
                out = { error: null };
            } else {
                const rows = this._rows().slice(0, this.max);
                out = { data: this.single ? rows[0] || null : rows, error: null };
            }
            return Promise.resolve(out).then(res, rej);
        }
    }
    return { from: (name) => new Q(name) };
}

const baseTables = () => ({
    store_automation_log: [],
    store_automation_rules: [],
    store_carts: [{ id: '11111111-1111-1111-1111-111111111111', email: 'ana@x.com', items: [{ id: 'preset-duki' }], updated_at: ago(3), reminder_sent_at: null, recovered_at: null }],
    store_customers: [
        { email: 'leo@x.com', segment: 'FREE', purchase_count: 0, unsubscribed: false, lead_magnets: ['lead-graba-maquetas-con-nativos'], created_at: ago(100) },
        { email: 'baja@x.com', segment: 'FREE', purchase_count: 0, unsubscribed: true, lead_magnets: ['lead-x'], created_at: ago(100) },
        { email: 'vip@x.com', segment: 'COMPRADOR V1', purchase_count: 1, unsubscribed: false, last_purchase_at: ago(24 * 60), created_at: ago(24 * 90) }
    ],
    store_orders: [{ payment_ref: 'PP-1', email: 'compro@x.com', status: 'completed', created_at: ago(30), lines: [{ id: 'preset-bad-bunny' }] }]
});

test('envía cada regla una vez, con enlace de baja, y no repite en la segunda corrida', async () => {
    const tables = baseTables();
    const sent = [];
    const d = { supabase: fakeDb(tables), sendEmail: async (m) => { sent.push(m); } };

    const first = await runAutomations(NOW, d);
    assert.equal(first.abandoned_cart.sent, 1);
    assert.equal(first.lead_nurture.sent, 1, 'solo leo: baja@x.com se salta');
    assert.equal(first.post_purchase_upsell.sent, 1);
    assert.equal(first.winback.sent, 1);
    assert.deepEqual(sent.map((m) => m.to).sort(), ['ana@x.com', 'compro@x.com', 'leo@x.com', 'vip@x.com']);
    assert.ok(sent.every((m) => m.html.includes('/api/store/unsubscribe?e=')), 'todos llevan baja');
    assert.ok(sent.find((m) => m.to === 'ana@x.com').html.includes('/willieinspired/checkout?cart=1111'));
    assert.ok(tables.store_carts[0].reminder_sent_at, 'el carrito queda marcado como recordado');

    sent.length = 0;
    const second = await runAutomations(NOW, d);
    assert.equal(sent.length, 0, 'segunda corrida no manda nada');
    assert.equal(second.lead_nurture.skipped, 1);
});

test('si el correo falla se libera la reserva y se reintenta en la siguiente corrida', async () => {
    const tables = baseTables();
    let fail = true;
    const d = { supabase: fakeDb(tables), sendEmail: async () => { if (fail) throw new Error('brevo caído'); } };

    const r1 = await runAutomations(NOW, d);
    assert.equal(r1.winback.failed, 1);
    assert.equal(tables.store_automation_log.length, 0, 'nada reservado tras el fallo');
    assert.equal(tables.store_carts[0].reminder_sent_at, null, 'el carrito sigue pendiente');

    fail = false;
    const r2 = await runAutomations(NOW, d);
    assert.equal(r2.winback.sent, 1);
    assert.equal(r2.abandoned_cart.sent, 1);
});

test('una regla pausada no envía', async () => {
    const tables = baseTables();
    tables.store_automation_rules.push({ key: 'winback', enabled: false });
    const sent = [];
    const r = await runAutomations(NOW, { supabase: fakeDb(tables), sendEmail: async (m) => { sent.push(m.to); } });
    assert.equal(r.winback.enabled, false);
    assert.ok(!sent.includes('vip@x.com'));
});

test('el enlace de baja está firmado: otro correo o firma falsa no valen', () => {
    const sig = signEmail('Leo@X.com');
    assert.ok(verifyEmailSig('leo@x.com', sig));
    assert.ok(!verifyEmailSig('otro@x.com', sig));
    assert.ok(!verifyEmailSig('leo@x.com', 'a'.repeat(32)));
    assert.ok(!verifyEmailSig('leo@x.com', ''));
});
