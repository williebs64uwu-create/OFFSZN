// Pruebas del motor de precios y del catálogo de la tienda Willie Inspired (sin BD ni red).
//   node --test tests/store-pricing.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRegion, priceFor, quoteCart, trialFollowupPrice, countryFromTimezone } from '../src/shared/store/pricing.js';
import { loadCatalog, getProduct, deliverablesFor, publicProduct } from '../src/shared/store/catalog.js';

const preset = getProduct('preset-bad-bunny');
const plantilla = getProduct('plantilla-trap-definitivo');

test('catálogo: une presets de artistas y productos, acepta ids antiguos', () => {
    const { products } = loadCatalog();
    assert.ok(products.length > 60);
    assert.equal(preset.delivery, 'files');
    assert.equal(getProduct('bad-bunny').id, 'preset-bad-bunny');
    assert.equal(getProduct('899').id, 'plugin-easy-mix');
    assert.equal(getProduct('bundle-all-presets').id, 'bundle-todos-los-presets');
    assert.equal(getProduct('preset-maluma'), null, 'presets sin archivo del catálogo viejo ya no se venden');
    assert.equal(getProduct('no-existe'), null);
});

test('catálogo: la API pública no expone rutas del bucket', () => {
    const pub = publicProduct(preset);
    assert.equal(pub.files, undefined);
    assert.ok(pub.fileCount >= 1);
});

test('catálogo: el pack de todos los presets entrega cada preset con archivo', () => {
    const items = deliverablesFor('bundle-todos-los-presets');
    assert.ok(items.length >= 40);
    assert.ok(items.every((p) => p.files.length));
});

test('región: Perú es base y se muestra en soles', () => {
    const r = resolveRegion({ ipCountry: 'PE', timezone: 'America/Lima' });
    assert.equal(r.tier, 'base');
    assert.equal(r.currency.code, 'PEN');
    assert.equal(priceFor(preset, r).usd, 5);
});

test('región: México es high (5 → 10 USD) y se muestra en pesos', () => {
    const r = resolveRegion({ ipCountry: 'MX', timezone: 'America/Mexico_City' });
    assert.equal(r.tier, 'high');
    assert.equal(r.currency.code, 'MXN');
    const p = priceFor(preset, r);
    assert.equal(p.usd, 10);
    assert.equal(p.compareAtUsd, 30);
    assert.equal(p.local.currency, 'MXN');
});

test('región: VPN a un país barato no baja el precio', () => {
    const r = resolveRegion({ ipCountry: 'CO', timezone: 'America/Argentina/Buenos_Aires' });
    assert.equal(r.vpnSuspected, true);
    assert.equal(r.tier, 'high');
    assert.equal(r.country, 'AR');
});

test('región: el país declarado en la cuenta no puede bajar el precio', () => {
    const r = resolveRegion({ ipCountry: 'MX', timezone: 'America/Mexico_City', declaredCountry: 'PE' });
    assert.equal(r.tier, 'high');
});

test('región: Venezuela y Cuba siempre base, aunque pague un familiar desde EE. UU.', () => {
    const r = resolveRegion({ ipCountry: 'US', timezone: 'America/New_York', declaredCountry: 'VE' });
    assert.equal(r.tier, 'base');
    assert.equal(r.country, 'VE');
    assert.equal(resolveRegion({ ipCountry: 'CU' }).tier, 'base');
});

test('región: sin datos cae en base y USD', () => {
    const r = resolveRegion({});
    assert.equal(r.tier, 'base');
    assert.equal(r.currency.code, 'USD');
    assert.equal(countryFromTimezone('Europe/Berlin'), 'DE');
    assert.equal(countryFromTimezone('Mars/Base'), null);
});

const base = resolveRegion({ ipCountry: 'PE', timezone: 'America/Lima' });
const high = resolveRegion({ ipCountry: 'US', timezone: 'America/New_York' });

test('carrito: ignora duplicados, desconocidos, lead magnets y próximos', () => {
    const q = quoteCart({
        items: [{ id: 'preset-bad-bunny' }, { id: 'preset-bad-bunny' }, { id: 'nada' }, { id: 'lead-graba-tus-maquetas' }, { id: 'plugin-vocal-preset' }],
        getProduct, region: base
    });
    assert.equal(q.lines.length, 1);
    assert.equal(q.totalUsd, 5);
    assert.deepEqual(q.errors.map((e) => e.error), ['not_found', 'not_buyable', 'not_buyable']);
});

test('carrito: 2x1 deja gratis el de igual o menor precio aunque el cliente elija el caro', () => {
    const q = quoteCart({
        items: [{ id: 'preset-bad-bunny' }, { id: 'plantilla-trap-definitivo' }],
        getProduct, region: base, offer: { type: '2x1', freeIds: ['plantilla-trap-definitivo'] }
    });
    assert.deepEqual(q.offerApplied.freeIds, ['preset-bad-bunny']);
    assert.equal(q.totalUsd, plantilla.price.base);
});

test('carrito: 2x1 respeta la elección cuando el precio es igual', () => {
    const q = quoteCart({
        items: [{ id: 'preset-bad-bunny' }, { id: 'preset-feid' }],
        getProduct, region: high, offer: { type: '2x1', freeIds: ['preset-feid'] }
    });
    assert.deepEqual(q.offerApplied.freeIds, ['preset-feid']);
    assert.equal(q.totalUsd, 10);
});

test('carrito: 2x1 con un solo producto no aplica', () => {
    const q = quoteCart({ items: [{ id: 'preset-bad-bunny' }], getProduct, region: base, offer: { type: '2x1' } });
    assert.equal(q.offerApplied, null);
    assert.equal(q.totalUsd, 5);
    assert.equal(q.errors[0].error, 'need_two_items');
});

test('carrito: bienvenida 50% con tope y solo en productos elegibles', () => {
    const q = quoteCart({
        items: [{ id: 'plantilla-grabacion-y-mezcla-profesional' }, { id: 'plantilla-trap-definitivo' }, { id: 'servicio-mezcla-de-voces' }],
        getProduct, region: base, offer: { type: 'welcome50' }
    });
    assert.equal(q.subtotalUsd, 20 + 15 + 25);
    assert.equal(q.discountUsd, 10, 'tope de 10 USD');
    assert.equal(q.totalUsd, 50);
});

test('carrito: código de oferta de prueba vencida fija el precio del plugin', () => {
    const q = quoteCart({
        items: [{ id: 'plugin-easy-master', os: 'mac' }],
        getProduct, region: high, offer: { type: 'code', productId: 'plugin-easy-master', priceUsd: 10 }
    });
    assert.equal(q.lines[0].os, 'mac');
    assert.equal(q.totalUsd, 10);
    assert.equal(q.discountUsd, 5);
});

test('carrito: cupón antiguo y total en soles', () => {
    const q = quoteCart({ items: [{ id: 'preset-definitivo' }], getProduct, region: base, offer: { type: 'coupon', code: 'willie10' } });
    assert.equal(q.totalUsd, 13.5);
    assert.equal(q.totalPen, Math.round(13.5 * 3.3), 'soles enteros, igual a lo que se muestra');
});

test('cupón VOCES = 20% (sin distinguir mayúsculas)', () => {
    const q = quoteCart({ items: [{ id: 'preset-definitivo' }], getProduct, region: base, offer: { type: 'coupon', code: 'voces' } });
    assert.equal(q.totalUsd, 12);
    assert.equal(q.discountUsd, 3);
});

test('oferta de prueba vencida según país', () => {
    assert.equal(trialFollowupPrice('US'), 15);
    assert.equal(trialFollowupPrice('MX'), 10);
    assert.equal(trialFollowupPrice('PE'), 5);
    assert.equal(trialFollowupPrice('VE'), 5);
    assert.equal(trialFollowupPrice(null), 5);
});
