// Finanzas del CRM: reglas de moneda, resumen del mes y lectura de lo que informan PayPal y Mercado Pago. Sin red.
//   node --test tests/finance.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeManualIncome, summarize, usdOf, paypalCaptureRows, mercadoPagoRow, monthRange, limaMonth, allocateSettlement, FX_DEFAULT } from '../src/shared/store/finance.js';

test('despacho manual: dólares = lo que te dieron (PayPal), soles = neto (Yape), pesos argentinos = pendiente', () => {
    const usd = normalizeManualIncome({ serial: 'EASY-FULL-AAAA', currency: 'USD', amount: 17, email: 'A@B.com', product: 'Easy Mix' }).row;
    assert.deepEqual([usd.method, usd.currency, usd.gross, usd.net, usd.status, usd.by_willie, usd.email], ['paypal', 'USD', 17, 17, 'confirmed', true, 'a@b.com']);
    const pen = normalizeManualIncome({ serial: 'K2', currency: 'PEN', amount: 65 }).row;
    assert.deepEqual([pen.method, pen.gross, pen.net, pen.status], ['yape', 65, 65, 'confirmed']);
    const ars = normalizeManualIncome({ serial: 'K3', currency: 'ARS', amount: 15000 }).row;
    assert.deepEqual([ars.method, ars.gross, ars.net, ars.status], ['mp_argentina', 15000, null, 'pending_review']);
    assert.equal(normalizeManualIncome({ serial: 'K4', currency: 'PEN', amount: 38, method: 'binance' }).row.method, 'binance'); // se puede cambiar el método
});

test('despacho manual: nunca se inventa un monto; "sin dato" queda marcado para revisar', () => {
    const nd = normalizeManualIncome({ serial: 'K5', noDetail: true }).row;
    assert.deepEqual([nd.status, nd.gross, nd.net], ['no_detail', null, null]);
    for (const bad of [{ serial: 'K', currency: 'USD', amount: 0 }, { serial: 'K', currency: 'USD', amount: 'abc' }, { serial: 'K', currency: 'EUR', amount: 5 }, { serial: '', currency: 'USD', amount: 5 }, { serial: 'K', amount: 5 }]) {
        assert.equal(normalizeManualIncome(bad).ok, false, JSON.stringify(bad));
    }
});

test('meses en hora de Lima: el 31 oct a las 23:00 en Lima sigue siendo octubre aunque en UTC ya sea noviembre', () => {
    assert.equal(limaMonth('2026-11-01T04:00:00Z'), '2026-10');
    assert.equal(limaMonth('2026-11-01T05:00:00Z'), '2026-11');
    assert.deepEqual(monthRange('2026-10'), { month: '2026-10', from: '2026-10-01T05:00:00.000Z', to: '2026-11-01T05:00:00.000Z' });
    assert.equal(monthRange('2026-12').to, '2027-01-01T05:00:00.000Z');
});

const row = (o) => ({ status: 'confirmed', by_willie: false, fee: null, ...o });

test('resumen: bruto, comisión, neto y resultado; los pesos argentinos y "sin dato" no suman', () => {
    const rows = [
        row({ currency: 'USD', method: 'paypal', product: 'Easy Mix', gross: 17, fee: 1.0, net: 16 }),
        row({ currency: 'USD', method: 'paypal', product: 'Easy Mix', gross: 25, fee: 1.5, net: 23.5 }),
        row({ currency: 'PEN', method: 'yape', product: 'Easy Pitch', gross: 33.7, net: 33.7, by_willie: true }),
        row({ currency: 'ARS', method: 'mercadopago', product: 'Vocal Preset', gross: 15000, net: null, status: 'pending_review', by_willie: true }),
        row({ currency: 'USD', method: 'otro', gross: null, net: null, status: 'no_detail', by_willie: true })
    ];
    const s = summarize(rows, [{ category: 'GASEOSA', amount_pen: 5 }, { category: 'COMIDA RÁPIDA', amount_pen: 20 }], 3.37);
    assert.equal(s.income.count, 3);
    assert.equal(s.income.netUsd, 16 + 23.5 + 10);          // 33.7 soles ÷ 3.37 = 10 US$
    assert.equal(s.income.grossUsd, 17 + 25 + 10);
    assert.equal(s.income.feeUsd, 2.5);
    assert.equal(s.income.netPen, Math.round((33.7 + 39.5 * 3.37) * 100) / 100); // soles netos + dólares netos × 3.37
    assert.deepEqual([s.pendingArs.count, s.pendingArs.pesos, s.noDetail.count], [1, 15000, 1]);
    assert.equal(s.expenses.totalPen, 25);
    assert.equal(s.expenses.byCategory.find((c) => c.category === 'GASEOSA').totalPen, 5);
    assert.equal(s.result.pen, Math.round((s.income.netPen - 25) * 100) / 100);
    assert.equal(s.income.bySource.manual, 1);
    assert.equal(s.byProduct[0].product, 'Easy Mix');
    assert.equal(usdOf(rows[3]), null);
    assert.equal(FX_DEFAULT, 3.37);
});

test('PayPal: una fila por cobro con bruto, comisión y neto reales; la parte de otros productores no cuenta', () => {
    const result = {
        payer: { email_address: 'Cliente@Correo.com' },
        purchase_units: [
            { payee: { merchant_id: 'MXV5F6X8JXG4S' }, payments: { captures: [{ id: 'CAP1', status: 'COMPLETED', create_time: '2026-10-31T20:00:00Z', amount: { currency_code: 'USD', value: '17.00' }, seller_receivable_breakdown: { gross_amount: { value: '17.00' }, paypal_fee: { value: '1.03' }, net_amount: { value: '15.97' } } }] } },
            { payee: { merchant_id: 'OTRO', email_address: 'otro@x.com' }, payments: { captures: [{ id: 'CAP2', status: 'COMPLETED', amount: { currency_code: 'USD', value: '30.00' } }] } },
            { payments: { captures: [{ id: 'CAP3', status: 'PENDING', amount: { currency_code: 'USD', value: '9.00' } }] } }
        ]
    };
    const rows = paypalCaptureRows(result, { product: 'Easy Mix', productId: 899, orderId: 2300 });
    assert.equal(rows.length, 1);
    assert.deepEqual([rows[0].ref, rows[0].gross, rows[0].fee, rows[0].net, rows[0].verified, rows[0].email, rows[0].order_id], ['CAP1', 17, 1.03, 15.97, true, 'cliente@correo.com', 2300]);
});

test('Mercado Pago (Yape): soles con el neto que informa MP; un pago no aprobado no se anota', () => {
    const r = mercadoPagoRow({ id: 184149112479, status: 'approved', currency_id: 'PEN', transaction_amount: 65, date_approved: '2026-10-31T18:00:00Z', fee_details: [{ fee_payer: 'collector', amount: 2.5 }], transaction_details: { net_received_amount: 62.5 } }, { email: 'A@b.com', product: 'Easy Mix', productId: 899 });
    assert.deepEqual([r.ref, r.currency, r.gross, r.fee, r.net, r.method, r.email], ['184149112479', 'PEN', 65, 2.5, 62.5, 'yape', 'a@b.com']);
    assert.equal(mercadoPagoRow({ id: 1, status: 'rejected', transaction_amount: 65 }), null);
    // sin neto informado: bruto menos comisión
    assert.equal(mercadoPagoRow({ id: 2, status: 'approved', transaction_amount: 38, fee_details: [{ fee_payer: 'collector', amount: 1.5 }] }).net, 36.5);
});

test('pesos argentinos: cuentan solo cuando llegan los soles; el depósito se reparte exacto entre los pagos', () => {
    const pending = [{ id: 'a', gross: 15000 }, { id: 'b', gross: 30000 }, { id: 'c', gross: 15000 }];
    const out = allocateSettlement(pending, 100);
    assert.deepEqual(out.allocations.map((a) => a.settled_pen), [25, 50, 25]);
    const odd = allocateSettlement([{ id: 'a', gross: 1 }, { id: 'b', gross: 1 }, { id: 'c', gross: 1 }], 100); // 33.33 + 33.33 + 33.34
    assert.equal(odd.allocations.reduce((a, x) => a + x.settled_pen, 0).toFixed(2), '100.00');
    assert.equal(allocateSettlement([], 100).ok, false);
    assert.equal(allocateSettlement(pending, 0).ok, false);

    const ars = (o) => ({ status: 'pending_review', by_willie: true, currency: 'ARS', method: 'mp_argentina', product: 'Easy Mix', fee: null, net: null, ...o });
    const pend = summarize([ars({ gross: 15000 })], [], 3.37);
    assert.deepEqual([pend.income.count, pend.pendingArs.count, pend.income.netPen], [0, 1, 0]);   // pendiente: no suma
    const done = summarize([ars({ gross: 15000, status: 'confirmed', settled_pen: 101.1 })], [], 3.37);
    assert.deepEqual([done.income.count, done.income.netPen, done.income.netUsd, done.pendingArs.count], [1, 101.1, 30, 0]); // confirmado: 101.1 soles ÷ 3.37 = 30 US$
    assert.equal(done.income.byCurrency.ARS.settledPen, 101.1);
    assert.equal(usdOf(ars({ gross: 15000 })), null);
});

// ─── Bolsillos, retiro de PayPal y servicios ───────────────────────────────────────────────────────────────────
import { paypalPocket, pockets, kindOf, byDay } from '../src/shared/store/finance.js';
const ppRow = (net, fee = 0) => ({ status: 'confirmed', method: 'paypal', currency: 'USD', gross: net + fee, fee, net });
test('PayPal por debajo de 120 US$: solo se convierte a 3,3, sin costo de retiro', () => {
    const p = paypalPocket([ppRow(46.05, 2.95), ppRow(15.78, 1.22)]);
    assert.equal(p.balanceUsd, 61.83); assert.equal(p.blocks, 0); assert.equal(p.withdrawCostUsd, 0); assert.equal(p.provisional, false);
    assert.equal(p.estPen, Math.round(61.83 * 3.3 * 100) / 100); assert.equal(p.remainingUsd, 138.17);
});
test('PayPal entre 120 y 200 US$: se prevé el costo de 4 US$ (previsión, no es retiro real)', () => {
    const p = paypalPocket([ppRow(138.96, 10.37)]);
    assert.equal(p.provisional, true); assert.equal(p.provisionUsd, 4); assert.equal(p.blocks, 0); assert.equal(p.withdrawCostUsd, 0);
    assert.equal(p.estPen, Math.round((138.96 - 4) * 3.3 * 100) / 100);   // ≈ 445,37 (tu demostración: 449,44 con 3,3292)
});
test('PayPal con 200 US$: se descuentan 4 US$ y se cambia a 3,3 (646,80 soles)', () => {
    const p = paypalPocket([ppRow(200)]);
    assert.equal(p.blocks, 1); assert.equal(p.withdrawCostUsd, 4); assert.equal(p.estPen, 646.8);
});
test('PayPal con 250 US$: el retiro cuenta solo por los 200 completos', () => {
    const p = paypalPocket([ppRow(250)]);
    assert.equal(p.estPen, Math.round((196 * 3.3 + 50 * 3.3) * 100) / 100); assert.equal(p.provisional, false);
});
test('Bolsillos: Yape y Binance no pagan retiro; el banco no se mueve', () => {
    const rows = [ppRow(100, 5), { status: 'confirmed', method: 'yape', currency: 'PEN', gross: 50, net: 50 }, { status: 'confirmed', method: 'binance', currency: 'PEN', gross: 45, net: 45 }, { status: 'pending_review', method: 'binance', currency: 'PEN', gross: 85, net: 85 }];
    const k = pockets(rows, 27000, undefined, 3);
    assert.equal(k.bankPen, 27000); assert.equal(k.soles.netPen, 95); assert.equal(k.paypal.balanceUsd, 100);
    assert.equal(k.real.netPen, 330 + 95); assert.equal(k.real.grossPen, Math.round((105 * 3.3 + 95) * 100) / 100); assert.equal(k.real.resultPen, 422);
});
test('Servicios, Payhip y plugins se reconocen por el nombre', () => {
    assert.equal(kindOf({ product: 'MIX Y MASTER' }), 'Servicio');
    assert.equal(kindOf({ product: 'Pago directo BINANCE - MEZCLA, MASTER Y BEAT' }), 'Servicio');
    assert.equal(kindOf({ product: 'Easy Mix' }), 'Plugin');
    assert.equal(kindOf({ product: 'Preset de Omar Courtz (Payhip)' }), 'Payhip');
    assert.equal(kindOf({ product: 'BEAT REMAKE' }), 'Servicio');
});
test('Ingresos por día en hora de Lima', () => {
    const d = byDay([{ status: 'confirmed', currency: 'PEN', net: 50, occurred_at: '2026-11-04T03:03:00Z' }, { status: 'confirmed', currency: 'USD', net: 10, occurred_at: '2026-11-03T20:00:00Z' }]);
    assert.deepEqual(d.map((x) => [x.date, x.pen]), [['2026-11-03', 83]]);
});
test('Un cobro en soles "por revisar" no se confunde con pesos argentinos por confirmar', () => {
    const s = summarize([{ status: 'pending_review', currency: 'PEN', gross: 85, net: 85, method: 'binance' }, { status: 'pending_review', currency: 'ARS', gross: 15000, method: 'mp_argentina' }], [], 3.37);
    assert.equal(s.pendingArs.count, 1); assert.equal(s.pendingArs.pesos, 15000);
});
