// Servicio de finanzas con una base de datos en memoria: no duplica, nunca rompe un cobro y respeta el corte del 31 de octubre.
//   node --test --experimental-test-module-mocks tests/finance-service.test.mjs
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

const tables = {};
const T = (n) => (tables[n] ||= []);
const UNIQUE = { finance_income: [['source', 'ref']], finance_settings: [['key']], finance_deposits: [['ref']], finance_expenses: [['ref']] };
let id = 1;
let breakIncome = false;

class Query {
    constructor(table) { this.table = table; this.filters = []; this.op = 'select'; }
    select() { this.returning = true; return this; }
    insert(row) { this.op = 'insert'; this.rows = [].concat(row); return this; }
    upsert(rows, o = {}) { this.op = 'upsert'; this.rows = [].concat(rows); this.o = o; return this; }
    update(p) { this.op = 'update'; this.patch = p; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(c, v) { this.filters.push((r) => String(r[c]) === String(v)); return this; }
    gte(c, v) { this.filters.push((r) => String(r[c]) >= String(v)); return this; }
    lt(c, v) { this.filters.push((r) => String(r[c]) < String(v)); return this; }
    order() { return this; }
    limit() { return this; }
    run() {
        if (breakIncome && this.table === 'finance_income') return { data: null, error: { message: 'base caída' } };
        const rows = T(this.table);
        if (this.op === 'insert' || this.op === 'upsert') {
            const out = [];
            for (const raw of this.rows) {
                const row = { id: `id${id++}`, ...raw };
                const dup = (UNIQUE[this.table] || []).some((cols) => cols.every((c) => row[c] !== undefined && row[c] !== null) && rows.some((r) => cols.every((c) => r[c] === row[c])));
                if (dup) { if (this.op === 'upsert' && this.o.ignoreDuplicates) continue; return { data: null, error: { code: '23505', message: 'duplicate' } }; }
                rows.push(row); out.push(row);
            }
            return { data: out, error: null };
        }
        const hit = rows.filter((r) => this.filters.every((f) => f(r)));
        if (this.op === 'update') { hit.forEach((r) => Object.assign(r, this.patch)); return { data: hit, error: null }; }
        if (this.op === 'delete') { for (const r of hit) rows.splice(rows.indexOf(r), 1); return { data: hit, error: null }; }
        return { data: hit, error: null };
    }
    then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }
    single() { const r = this.run(); return Promise.resolve({ ...r, data: r.data?.[0] ?? null }); }
    maybeSingle() { return this.single(); }
}
mock.module('../src/infrastructure/database/connection.js', { namedExports: { supabase: { from: (t) => new Query(t) } } });
mock.module('../src/shared/config/config.js', { namedExports: { PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 's', PAYPAL_ENVIRONMENT: 'live' } });
const svc = await import('../src/infrastructure/services/financeService.js');

const capture = (id, gross = '17.00', fee = '1.03', net = '15.97', when = '2026-10-31T20:00:00Z') => ({
    payer: { email_address: 'c@x.com' },
    purchase_units: [{ payee: { merchant_id: 'MXV5F6X8JXG4S' }, payments: { captures: [{ id, status: 'COMPLETED', create_time: when, amount: { currency_code: 'USD', value: gross }, seller_receivable_breakdown: { gross_amount: { value: gross }, paypal_fee: { value: fee }, net_amount: { value: net } } }] } }]
});
const reset = () => { for (const k of Object.keys(tables)) delete tables[k]; breakIncome = false; };

test('un mismo pago anotado dos veces (captura + aviso + reintento) queda una sola vez', async () => {
    reset();
    const a = await svc.recordPayPalCaptures(capture('CAP1'), { product: 'Easy Mix', productId: 899 });
    const b = await svc.recordPayPalCaptures(capture('CAP1'), { product: 'Easy Mix', productId: 899 });
    assert.deepEqual([a.saved, b.saved], [1, 0]);
    assert.equal(T('finance_income').length, 1);
    const r = T('finance_income')[0];
    assert.deepEqual([r.gross, r.fee, r.net, r.verified, r.by_willie, r.product], [17, 1.03, 15.97, true, false, 'Easy Mix']);
});

test('despacho manual: se anota una vez por clave; si faltan datos se avisa y no se inventa nada', async () => {
    reset();
    const ok = await svc.recordManualIncome({ serial: 'EASY-FULL-1', email: 'A@b.com', product: 'Easy Mix', currency: 'PEN', amount: 65 });
    assert.equal(ok.ok, true);
    const again = await svc.recordManualIncome({ serial: 'EASY-FULL-1', email: 'A@b.com', product: 'Easy Mix', currency: 'PEN', amount: 65 });
    assert.equal(again.duplicate, true);
    assert.equal(T('finance_income').length, 1);
    assert.deepEqual([T('finance_income')[0].net, T('finance_income')[0].method, T('finance_income')[0].by_willie], [65, 'yape', true]);
    const bad = await svc.recordManualIncome({ serial: 'EASY-FULL-2', currency: 'USD', amount: -3 });
    assert.equal(bad.ok, false);
    assert.equal(T('finance_income').length, 1);
});

test('si la base falla, anotar un pago NO lanza error (el cobro nunca se rompe)', async () => {
    reset(); breakIncome = true;
    const out = await svc.recordPayPalCaptures(capture('CAP9'), { product: 'X' });
    assert.equal(out.ok, false);
    await assert.doesNotReject(() => svc.recordIncome({ source: 'paypal', ref: 'Z', method: 'paypal', currency: 'USD' }));
});

test('gastos: solo en soles, con las 3 categorías; la suscripción importante exige decir cuál es', async () => {
    reset();
    await assert.rejects(() => svc.addExpense({ category: 'ROPA', amountPen: 10 }), /categoría/);
    await assert.rejects(() => svc.addExpense({ category: 'GASEOSA', amountPen: 0 }), /monto/);
    await assert.rejects(() => svc.addExpense({ category: 'SUSCRIPCIÓN IMPORTANTE', amountPen: 50 }), /suscripción/);
    const g = await svc.addExpense({ category: 'gaseosa', amountPen: 4.5, spentAt: '2026-11-02' });
    assert.deepEqual([g.category, g.amount_pen], ['GASEOSA', 4.5]);
    const s = await svc.addExpense({ category: 'SUSCRIPCIÓN IMPORTANTE', amountPen: 59.9, note: 'Hosting', spentAt: '2026-11-02' });
    assert.equal(s.note, 'Hosting');
    await svc.deleteExpense(g.id);
    assert.equal(T('finance_expenses').length, 1);
});

test('el mes cuenta desde el 31 de octubre (hora de Lima): lo anterior no entra, ni en el mes ni en el resumen', async () => {
    reset();
    T('finance_settings').push({ key: 'start_at', value: '2026-10-31T05:00:00.000Z' }, { key: 'fx_pen_per_usd', value: 3.37 }, { key: 'bank_base', value: { pen: 26824, as_of: '2026-10-31' } });
    await svc.recordPayPalCaptures(capture('OLD', '10.00', '0.64', '9.36', '2026-10-30T20:00:00Z'), { product: 'Viejo' });   // antes del corte
    await svc.recordPayPalCaptures(capture('NEW1', '17.00', '1.03', '15.97', '2026-10-31T20:00:00Z'), { product: 'Easy Mix' });
    await svc.recordPayPalCaptures(capture('NOV1', '25.00', '1.45', '23.55', '2026-11-02T15:00:00Z'), { product: 'Easy Mix' });
    await svc.addExpense({ category: 'COMIDA RÁPIDA', amountPen: 20, spentAt: '2026-10-31' });
    const oct = await svc.monthData('2026-10');
    assert.deepEqual(oct.income.map((r) => r.ref), ['NEW1']);
    assert.equal(oct.summary.income.netUsd, 15.97);
    assert.equal(oct.summary.expenses.totalPen, 20);
    assert.equal(oct.settings.bank.pen, 26824);
    const nov = await svc.monthData('2026-11');
    assert.deepEqual(nov.income.map((r) => r.ref), ['NOV1']);
    assert.equal(nov.summary.income.netUsd, 23.55);
});

test('cuenta del banco: se guarda lo que escribes y rechaza montos inválidos', async () => {
    reset();
    const b = await svc.saveBank({ pen: 27000.456, asOf: '2026-11-30' });
    assert.deepEqual(b, { pen: 27000.46, as_of: '2026-11-30' });
    await assert.rejects(() => svc.saveBank({ pen: 'x' }), /saldo/);
    await assert.rejects(() => svc.saveBank({ pen: -1 }), /saldo/);
});

test('gastos con número de operación: la misma captura dos veces no duplica', async () => {
    reset();
    await svc.addExpense({ category: 'COMIDA RÁPIDA', amountPen: 18, spentAt: '2026-11-03', ref: 'OP-123' });
    await assert.rejects(() => svc.addExpense({ category: 'COMIDA RÁPIDA', amountPen: 18, spentAt: '2026-11-03', ref: 'OP-123' }), /ya estaba registrado/);
    await svc.addExpense({ category: 'GASEOSA', amountPen: 4, spentAt: '2026-11-03' });   // sin número: se permite
    await svc.addExpense({ category: 'GASEOSA', amountPen: 4, spentAt: '2026-11-03' });
    assert.equal(T('finance_expenses').length, 3);
});

test('pesos argentinos: el depósito de soles los confirma, se reparte exacto y no se aplica dos veces', async () => {
    reset();
    const ars = (ref, pesos) => svc.recordManualIncome({ serial: ref, email: `${ref}@x.com`, product: 'Easy Mix', currency: 'ARS', amount: pesos });
    await ars('S1', 15000); await ars('S2', 30000); await ars('S3', 15000);
    const month = await svc.monthData('2026-10');
    assert.equal(month.pendingArs.length, 3);
    assert.equal(month.summary.income.count, 0);                       // sin depósito, nada suma

    const first = await svc.settleArs({ label: 'Depósito de Sayko', pen: 202.2, ref: 'YAPE-OP-1' });
    assert.deepEqual([first.ok, first.settled, first.pen], [true, 3, 202.2]);
    const rows = T('finance_income');
    assert.deepEqual(rows.map((r) => r.settled_pen), [50.55, 101.1, 50.55]);
    assert.ok(rows.every((r) => r.status === 'confirmed' && /Depósito de Sayko/.test(r.note)));
    assert.equal(T('finance_deposits').length, 1);

    const again = await svc.settleArs({ label: 'Depósito de Sayko', pen: 202.2, ref: 'YAPE-OP-1' });   // misma captura
    assert.equal(again.duplicate, true);
    assert.equal(T('finance_deposits').length, 1);

    const after = await svc.monthData('2026-10');
    assert.equal(after.pendingArs.length, 0);
    assert.equal(after.summary.income.netPen, 202.2);                  // los soles que de verdad llegaron
    assert.equal(after.summary.income.netUsd, Math.round((202.2 / 3.37) * 100) / 100);
    await assert.rejects(() => svc.settleArs({ label: 'x', pen: 50, ref: 'OP-2' }), /No hay pagos en pesos/);
});

test('pesos argentinos: se puede confirmar solo una parte de los pagos', async () => {
    reset();
    for (const [ref, pesos] of [['A', 10000], ['B', 10000]]) await svc.recordManualIncome({ serial: ref, currency: 'ARS', amount: pesos, product: 'Easy Mix' });
    const idA = T('finance_income').find((r) => r.ref === 'A').id;
    await svc.settleArs({ label: 'Depósito de Sayko', pen: 70, ref: 'OP-9', ids: [idA] });
    assert.deepEqual(T('finance_income').map((r) => [r.ref, r.status]), [['A', 'confirmed'], ['B', 'pending_review']]);
});
