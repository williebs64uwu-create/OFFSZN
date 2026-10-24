// Ventas propias de pago (sin beats, sin productos de otros productores). Funciones puras, sin red.
//   node --test tests/store-sales.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSalesReport, buildProductPrices, classify } from '../src/shared/store/salesReport.js';

const ME = 'me';
const products = [
    { id: 1, name: 'Easy Mix', product_type: 'preset', price_basic: 10, producer_id: ME },
    { id: 2, name: 'Preset gratis', product_type: 'preset', price_basic: 0, producer_id: ME },
    { id: 3, name: 'Beat mío', product_type: 'beat', price_basic: 20, producer_id: ME },
    { id: 4, name: 'Preset de otro', product_type: 'preset', price_basic: 15, producer_id: 'otro' },
    { id: 5, name: 'PEACE - VOCAL MIXING TEMPLATE + MASTER', product_type: 'preset', price_basic: 25, producer_id: ME },
    { id: 6, name: 'PRESET DE ALEJO', product_type: 'preset', price_basic: 5, producer_id: ME }
];
const orders = [
    { id: 10, status: 'completed', created_at: '2026-09-02T10:00:00Z' },
    { id: 11, status: 'completed', created_at: '2026-10-03T10:00:00Z' },
    { id: 12, status: 'completed', created_at: '2026-10-04T10:00:00Z' },
    { id: 13, status: 'failed', created_at: '2026-10-05T10:00:00Z' }
];
const items = [
    { order_id: 10, product_id: 1, quantity: 1, price_at_purchase: 10 },
    { order_id: 11, product_id: 1, quantity: 1, price_at_purchase: 5 },
    { order_id: 12, product_id: 2, quantity: 1, price_at_purchase: 0 },   // gratis: no cuenta
    { order_id: 12, product_id: 3, quantity: 1, price_at_purchase: 20 },  // beat: no cuenta
    { order_id: 12, product_id: 4, quantity: 1, price_at_purchase: 15 },  // de otro productor: no cuenta
    { order_id: 12, product_id: 5, quantity: 1, price_at_purchase: 25 },
    { order_id: 13, product_id: 6, quantity: 1, price_at_purchase: 5 }    // orden fallida: no cuenta
];

test('ventas: solo productos propios, de pago, sin beats y en órdenes completadas', () => {
    const r = buildSalesReport({ orders, items, products, producerIds: [ME], clicks: [{ method: 'Yape', product: 'Easy Mix' }, { method: 'Yape', product: 'Easy Mix' }, { method: 'PayPal', product: 'X' }] });
    assert.equal(r.totals.revenueUsd, 40);
    assert.equal(r.totals.units, 3);
    assert.equal(r.totals.orders, 3);
    assert.equal(r.totals.avgTicketUsd, 13.33);
    assert.deepEqual(r.byMonth.map((m) => [m.month, m.revenueUsd]), [['2026-09', 10], ['2026-10', 30]]);
    assert.deepEqual(r.byClass.map((c) => [c.type, c.revenueUsd]), [['plantilla', 25], ['plugin', 15]]);
    assert.equal(r.interest.byMethod[0].clicks, 2);
});

test('clasificación: plugins, plantillas y presets por nombre', () => {
    assert.equal(classify({ name: 'Easy Master' }), 'plugin');
    assert.equal(classify({ name: 'Omni Plugin' }), 'plugin');
    assert.equal(classify({ name: 'PEACE - VOCAL MIXING TEMPLATE  + MASTER' }), 'plantilla');
    assert.equal(classify({ name: 'PRESET DE TORRES', product_type: 'preset' }), 'preset');
});

test('precios: marca lo cobrado a un precio distinto al de lista y deja fuera lo ajeno', () => {
    const list = buildProductPrices({ products, items, orders, producerIds: [ME] });
    const mix = list.find((p) => p.name === 'Easy Mix');
    assert.equal(mix.revenueUsd, 15);
    assert.equal(mix.minPaidUsd, 5);
    assert.equal(mix.maxPaidUsd, 10);
    assert.equal(mix.mismatch, true);
    assert.ok(!list.some((p) => p.name === 'Beat mío' || p.name === 'Preset de otro'));
});
