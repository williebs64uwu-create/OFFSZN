// Reporte de ventas históricas y comisiones (funciones puras, sin red).
//   node --test tests/store-sales.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSalesReport, buildProductPrices, summarizeCommissions } from '../src/shared/store/salesReport.js';

const products = [
    { id: 1, name: 'Easy Mix', product_type: 'preset', price_basic: 10, is_free: false, status: 'published' },
    { id: 2, name: 'Preset gratis', product_type: 'preset', price_basic: 0, is_free: true, status: 'published' },
    { id: 3, name: 'Beat', product_type: 'beat', price_basic: 20, is_free: false, status: 'published' }
];
const orders = [
    { id: 10, status: 'completed', total_price: 10, created_at: '2026-09-02T10:00:00Z' },
    { id: 11, status: 'completed', total_price: 5, created_at: '2026-10-03T10:00:00Z' },
    { id: 12, status: 'completed', total_price: 0, created_at: '2026-10-04T10:00:00Z' },
    { id: 13, status: 'failed', total_price: 99, created_at: '2026-10-05T10:00:00Z' }
];
const items = [
    { id: 1, order_id: 10, product_id: 1, quantity: 1, price_at_purchase: 10 },
    { id: 2, order_id: 11, product_id: 1, quantity: 1, price_at_purchase: 5 },
    { id: 3, order_id: 12, product_id: 2, quantity: 1, price_at_purchase: 0 },
    { id: 4, order_id: 13, product_id: 3, quantity: 1, price_at_purchase: 99 }
];

test('ventas: solo cuentan las órdenes completadas y separa pagadas de gratis', () => {
    const r = buildSalesReport({ orders, items, products, transactions: [{ type: 'sale', amount: 15 }], clicks: [{ method: 'Yape', product: 'Easy Mix' }, { method: 'Yape', product: 'Easy Mix' }, { method: 'PayPal', product: 'Beat' }], referrals: [{ status: 'verified' }, { status: 'rejected' }] });
    assert.equal(r.totals.orders, 3);
    assert.equal(r.totals.paidOrders, 2);
    assert.equal(r.totals.revenueUsd, 15);
    assert.equal(r.totals.freeItems, 1);
    assert.equal(r.totals.paidItems, 2);
    assert.equal(r.totals.avgTicketUsd, 7.5);
    assert.deepEqual(r.byMonth.map((m) => [m.month, m.revenueUsd]), [['2026-09', 10], ['2026-10', 5]]);
    assert.equal(r.interest.byMethod[0].key, 'Yape');
    assert.equal(r.interest.byMethod[0].clicks, 2);
    assert.deepEqual(r.referrals, { verified: 1, rejected: 1 });
});

test('precios: marca los productos cobrados a un precio distinto al de lista', () => {
    const list = buildProductPrices({ products, items, orders });
    const mix = list.find((p) => p.name === 'Easy Mix');
    assert.equal(mix.revenueUsd, 15);
    assert.equal(mix.minPaidUsd, 5);
    assert.equal(mix.maxPaidUsd, 10);
    assert.equal(mix.mismatch, true);
    assert.equal(list.find((p) => p.name === 'Beat').units, 0, 'la orden fallida no cuenta');
});

test('comisiones: totales, pendientes y por mes', () => {
    const s = summarizeCommissions([
        { amount_usd: 1, status: 'pendiente', earned_at: '2026-10-01' },
        { amount_usd: 2.5, status: 'cobrada', earned_at: '2026-10-15' },
        { amount_usd: 1, status: 'cobrada', earned_at: '2026-09-20' }
    ]);
    assert.equal(s.totalUsd, 4.5);
    assert.equal(s.pendingUsd, 1);
    assert.equal(s.paidUsd, 3.5);
    assert.deepEqual(s.byMonth, [{ month: '2026-09', usd: 1 }, { month: '2026-10', usd: 3.5 }]);
});
