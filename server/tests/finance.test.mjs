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
