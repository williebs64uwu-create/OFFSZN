// Reglas de automatización y resumen del dashboard (sin BD ni red).
//   node --test tests/store-automations.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickAbandonedCarts, pickNurture, pickPostPurchase, pickWinback, winbackRef } from '../src/shared/store/automations.js';
import { buildOverview } from '../src/shared/store/analytics.js';

const NOW = Date.parse('2026-10-23T12:00:00Z');
const ago = (h) => new Date(NOW - h * 3600 * 1000).toISOString();

test('carrito abandonado: entre 2 h y 48 h, con productos y sin recordatorio previo', () => {
    const base = { email: 'a@x.com', items: [{ id: 'preset-duki' }] };
    const out = pickAbandonedCarts([
        { ...base, updated_at: ago(1) },                                  // muy reciente
        { ...base, email: 'b@x.com', updated_at: ago(3) },                // sí
        { ...base, email: 'c@x.com', updated_at: ago(60) },               // muy viejo
        { ...base, email: 'd@x.com', updated_at: ago(5), reminder_sent_at: ago(2) },
        { ...base, email: 'e@x.com', updated_at: ago(5), recovered_at: ago(1) },
        { ...base, email: 'f@x.com', items: [], updated_at: ago(5) }
    ], NOW);
    assert.deepEqual(out.map((c) => c.email), ['b@x.com']);
});

test('lead sin comprar: FREE, con regalo, entre 3 y 14 días y sin baja', () => {
    const c = { email: 'a@x.com', segment: 'FREE', purchase_count: 0, lead_magnets: ['lead-x'], unsubscribed: false };
    const out = pickNurture([
        { ...c, created_at: ago(24) },
        { ...c, email: 'b@x.com', created_at: ago(80) },
        { ...c, email: 'c@x.com', created_at: ago(24 * 20) },
        { ...c, email: 'd@x.com', created_at: ago(80), unsubscribed: true },
        { ...c, email: 'e@x.com', created_at: ago(80), segment: 'COMPRADOR V1', purchase_count: 1 },
        { ...c, email: 'f@x.com', created_at: ago(80), lead_magnets: [] }
    ], NOW);
    assert.deepEqual(out.map((x) => x.email), ['b@x.com']);
});

test('post-compra: órdenes completadas entre 24 h y 72 h', () => {
    const out = pickPostPurchase([
        { email: 'a@x.com', status: 'completed', created_at: ago(2) },
        { email: 'b@x.com', status: 'completed', created_at: ago(30) },
        { email: 'c@x.com', status: 'pending', created_at: ago(30) },
        { email: 'd@x.com', status: 'completed', created_at: ago(100) }
    ], NOW);
    assert.deepEqual(out.map((o) => o.email), ['b@x.com']);
});

test('recompra: compradores inactivos 45+ días, una vez cada 60 días', () => {
    const out = pickWinback([
        { email: 'a@x.com', purchase_count: 1, last_purchase_at: ago(24 * 10) },
        { email: 'b@x.com', purchase_count: 2, last_purchase_at: ago(24 * 50) },
        { email: 'c@x.com', purchase_count: 1, last_purchase_at: ago(24 * 90), unsubscribed: true },
        { email: 'd@x.com', purchase_count: 0, last_purchase_at: null }
    ], NOW);
    assert.deepEqual(out.map((x) => x.email), ['b@x.com']);
    assert.equal(winbackRef(NOW), winbackRef(NOW + 5 * 86400000));
    assert.notEqual(winbackRef(NOW), winbackRef(NOW + 70 * 86400000));
});

test('resumen: ingresos, ticket medio, serie sin huecos y fuentes', () => {
    const o = buildOverview({
        orders: [
            { status: 'completed', created_at: '2026-10-23T10:00:00Z', total_usd: 10, country: 'MX', payment_method: 'paypal', utm: { utm_source: 'meta' }, offer_type: '2x1', lines: [{ title: 'A' }, { title: 'B' }] },
            { status: 'completed', created_at: '2026-10-21T10:00:00Z', total_usd: 5, country: 'PE', payment_method: 'yape', lines: [{ title: 'A' }] },
            { status: 'pending', created_at: '2026-10-22T10:00:00Z', total_usd: 99 }
        ],
        events: [
            { event: 'page_view', session_id: 's1' }, { event: 'page_view', session_id: 's1' }, { event: 'page_view', session_id: 's2' },
            { event: 'add_to_cart', session_id: 's1' }, { event: 'purchase', session_id: 's1' }
        ],
        customers: [{ purchase_count: 2, segment: 'COMPRADOR V2' }, { purchase_count: 1, segment: 'COMPRADOR V1' }, { purchase_count: 0, segment: 'FREE' }],
        trials: [{ converted_at: '2026-10-22' }, {}],
        carts: [{ reminder_sent_at: 'x' }, { recovered_at: 'y' }]
    }, 5, NOW);
    assert.equal(o.revenueUsd, 15);
    assert.equal(o.orders, 2);
    assert.equal(o.aovUsd, 7.5);
    assert.equal(o.series.length, 5);
    assert.equal(o.series.at(-1).revenueUsd, 10);
    assert.equal(o.series.find((s) => s.day === '2026-10-22').revenueUsd, 0);
    assert.deepEqual(o.funnel.map((f) => f.sessions), [2, 1, 0, 1]);
    assert.equal(o.byProduct[0].key, 'A');
    assert.equal(o.bySource.find((s) => s.key === 'meta').revenueUsd, 10);
    assert.equal(o.customers.repeatRate, 50);
    assert.equal(o.trials.rate, 50);
    assert.deepEqual(o.carts, { open: 1, recovered: 1, reminded: 1 });
});
