// OFFSZN Widget: Yape solo acepta el precio vigente (9 USD) para los ids de WIDGET_PRODUCT_IDS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WIDGET_PRICES, pricesForProduct } from '../src/shared/store/yapePricing.js';

test('OFFSZN Widget cuesta 9 USD por Yape (y ya no 5)', () => {
    assert.deepEqual(WIDGET_PRICES, [9]);
    assert.deepEqual(pricesForProduct('7777', { widgetIds: ['7777'] }), [9]);
    assert.ok(!pricesForProduct('7777', { widgetIds: ['7777'] }).includes(5));
});
