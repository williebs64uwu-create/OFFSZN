// Ruta /preset/:slug: con ?v=2 sirve el diseño nuevo (solo presets, sin archivos de descarga); sin ?v=2 todo sigue igual. Sin red.
//   node --test --experimental-test-module-mocks tests/preset-route.test.mjs
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

const PRODUCTS = {
    'preset-de-remers': { id: 921, name: 'PRESET DE REMERS', public_slug: 'preset-de-remers', product_type: 'preset', price_basic: 10, is_free: false, image_url: 'products/covers/x.jpg', audio_before_url: 'a.mp3', audio_after_url: 'b.mp3', storage_version: 'v3', r2_version: 'v3', tags: ['fl studio'], description: 'Hola </script><b>x</b>', sales_count: 9, kit_url: 'SECRETO-kit.zip', wav_url: 'SECRETO-wav', users: { nickname: 'willie', avatar_url: null } },
    'beat-x': { id: 5, name: 'Beat X', public_slug: 'beat-x', product_type: 'beat', price_basic: 20, is_free: false, image_url: 'x.jpg', users: { nickname: 'p' } }
};
const chain = (table) => {
    let slug = null;
    const q = { select: () => q, neq: () => q, order: () => q, limit: () => q, in: () => q, gte: () => q, lt: () => q, not: () => q, is: () => q, eq: (c, v) => { if (c === 'public_slug') slug = v; return q; },
        maybeSingle: async () => ({ data: table === 'products' ? PRODUCTS[slug] || null : null, error: null }), single: async () => ({ data: null, error: null }),
        then: (res) => Promise.resolve({ data: [], error: null }).then(res) };
    return q;
};
mock.module('../src/infrastructure/database/connection.js', { namedExports: { supabase: { from: chain, rpc: async () => ({ data: null, error: null }), auth: {} }, checkConnection: async () => true } });
Object.assign(process.env, { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_KEY: 'x', SUPABASE_KEY: 'x', JWT_SECRET: 'x', OFFSZN_VARIABLE_PANEL: 't', IMAGEKIT_PRIVATE_KEY: 'x', IMAGEKIT_PUBLIC_KEY: 'x', IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/x' });

const { default: app } = await import('../src/app.js');
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const get = async (p) => { const r = await fetch(base + p); return { status: r.status, html: await r.text() }; };
test.after(() => server.close());

test('/preset/slug?v=2 sirve el diseño nuevo con datos públicos del preset, sin archivos de descarga y a prueba de </script>', async () => {
    const { status, html } = await get('/preset/preset-de-remers?v=2');
    assert.equal(status, 200);
    assert.match(html, /id="presetData">\{/);
    const json = html.match(/id="presetData">(\{.*?\})<\/script>/s)[1];
    const data = JSON.parse(json);
    assert.deepEqual([data.id, data.name, data.public_slug, data.audio_before_url, data.audio_after_url], [921, 'PRESET DE REMERS', 'preset-de-remers', 'a.mp3', 'b.mp3']);
    assert.equal(data.description, 'Hola </script><b>x</b>');           // el texto se conserva, pero escapado dentro del HTML
    assert.ok(!html.includes('SECRETO'), 'nunca se inyectan archivos de descarga');
    assert.match(html, /preset-page\.js/);
    assert.match(html, /<title>PRESET DE REMERS - willie \| OFFSZN<\/title>/);          // etiquetas SEO también en el diseño nuevo
    assert.match(html, /<link rel="canonical" href="https:\/\/offszn\.lat\/preset\/preset-de-remers">/);
    assert.match(html, /og:title/);
});

test('sin ?v=2 el preset sigue sirviéndose con la página de siempre', async () => {
    const { status, html } = await get('/preset/preset-de-remers');
    assert.equal(status, 200);
    assert.match(html, /product-core\.js/);
    assert.ok(!html.includes('presetData'));
});

test('un producto que no es preset con ?v=2 sigue con la página de siempre, y uno que no existe da 404', async () => {
    const beat = await get('/beat/beat-x?v=2');
    assert.equal(beat.status, 200);
    assert.match(beat.html, /product-core\.js/);
    assert.ok(!beat.html.includes('presetData'));
    assert.equal((await get('/preset/no-existe?v=2')).status, 404);
});

test('/presets/remers sirve el diseño nuevo directo (sin ?v=2), acepta el nombre corto y el slug largo, y no es para otros productos', async () => {
    const short = await get('/presets/remers');
    assert.equal(short.status, 200);
    assert.match(short.html, /id="presetData">\{/);
    assert.match(short.html, /<link rel="canonical" href="https:\/\/offszn\.lat\/presets\/remers">/);
    assert.ok(!short.html.includes('SECRETO'));
    assert.equal((await get('/presets/preset-de-remers')).status, 200);
    assert.equal((await get('/presets/beat-x')).status, 404);          // no es preset
    assert.equal((await get('/presets/no-existe')).status, 404);
});

test('/presets/remers es un preset de la tienda de Willie: se compra con su id del catálogo y no expone archivos', async () => {
    const { html } = await get('/presets/remers');
    const data = JSON.parse(html.match(/id="presetData">(\{.*?\})<\/script>/s)[1]);
    assert.deepEqual([data.store, data.id, data.public_slug], [true, 'preset-remers', 'remers']);
    assert.ok(!/bucket_key|\.fst/i.test(html), 'nunca se inyectan archivos de entrega');
});
