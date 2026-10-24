// Ventas propias de pago (sin beats, sin productos de otros productores). Funciones puras, sin red.
//   node --test tests/store-sales.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSalesReport, buildProductPrices, classify } from '../src/shared/store/salesReport.js';
import { parsePayhipPlugins, parseCsv, pluginNameOf } from '../src/shared/store/payhip.js';

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

const CSV = [
    '"Order ID",Email,Status,"Items In Cart","Num of Items In Cart","Amount Gross","Payhip Collected Sales Tax Amount","Payhip Fee","Coupon Code",Date',
    'a1,x@x.com,COMPLETED,"EASY MIX PLUGIN - WIN Y MAC",1,5.00,0.00,0.25,,2026-09-21',
    'a2,x@x.com,COMPLETED,"EASY MASTER PLUGIN - WIN Y MAC",1,5.35,0.35,0.25,,2026-10-08',
    'a3,x@x.com,COMPLETED,"PRESET de Zell",1,5.00,0,0.25,,2026-10-09',
    'a4,x@x.com,COMPLETED,"INSTALACIÓN DE PLUGINS",1,5.00,0,0.25,,2026-10-09',
    'a5,x@x.com,COMPLETED,"PLANTILLA PROFESIONAL DE MEZCLA - FL STUDIO, EASY MIX PLUGIN - WIN Y MAC",2,28.00,0,1.40,voces,2026-08-31',
    'a6,x@x.com,COMPLETED,"EASY MIX PLUGIN - WIN Y MAC",1,50.00,0,2.5,,2026-10-10',
    'a7,x@x.com,REFUNDED,"EASY MIX PLUGIN - WIN Y MAC",1,5.00,0,0.25,,2026-10-11'
].join('\n');

test('payhip: solo plugins reales (no presets, plantillas ni instalaciones), sin impuestos y sin reembolsos', () => {
    const r = parsePayhipPlugins(CSV);
    assert.equal(r.totalOrders, 7);
    assert.deepEqual(r.rows.map((x) => [x.order_id, x.plugin, x.unit_price_usd, x.mixed]), [['a1', 'Easy Mix', 5, false], ['a2', 'Easy Master', 5, false], ['a5', 'Easy Mix', null, true], ['a6', 'Easy Mix', 50, false]]);
    assert.equal(pluginNameOf('INSTALACIÓN DE PLUGINS'), null);
    assert.equal(pluginNameOf('COCA COLA PLUGIN - WIN Y MAC'), 'Coca Cola');
    assert.equal(parseCsv('a,"b,c","d ""e"""\n1,2,3').length, 2);
});

test('plugins: precio entre 2 y 30 US$ la unidad, Payhip se suma y los pedidos mixtos no llevan monto', () => {
    const payhip = parsePayhipPlugins(CSV).rows;
    const r = buildSalesReport({ orders, items, products, producerIds: [ME], payhip });
    // OFFSZN: Easy Mix 10 + 5 y plantilla 25 = 40 · Payhip: Easy Mix 5 + Easy Master 5 = 10 (el de 50 US$ queda fuera de rango)
    assert.equal(r.sources.offszn.revenueUsd, 40);
    assert.equal(r.sources.payhip.revenueUsd, 10);
    assert.equal(r.sources.payhip.units, 2);
    assert.equal(r.sources.payhip.mixedOrders, 1);
    assert.equal(r.totals.revenueUsd, 50);
    assert.deepEqual(r.outOfRange.map((x) => [x.source, x.price]), [['Payhip', 50]]);
    const mix = r.best.find((p) => p.name === 'Easy Mix');
    assert.equal(mix.units, 3, 'Easy Mix de OFFSZN y de Payhip se junta en una sola fila');
    assert.equal(r.byMonth.find((m) => m.month === '2026-09').payhip, 5);
});

test('payhip: un pedido mixto con precio estimado a mano sí suma y se marca como estimado', () => {
    const payhip = [{ order_id: 'm1', sold_on: '2026-08-31', plugin: 'Easy Mix', unit_price_usd: 12, mixed: true, price_estimated: true }, { order_id: 'm2', sold_on: '2026-08-01', plugin: 'Easy Mix', unit_price_usd: null, mixed: true }];
    const r = buildSalesReport({ orders: [], items: [], products: [], producerIds: [ME], payhip });
    assert.equal(r.sources.payhip.revenueUsd, 12);
    assert.equal(r.sources.payhip.estimatedUnits, 1);
    assert.equal(r.sources.payhip.mixedOrders, 1);
});
