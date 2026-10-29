// Conversaciones del chat de STAR CHAIN: recibir (POST /chatlog) y listar con clave (GET /admin/chatlog). Supabase simulado.
//   node --test --experimental-test-module-mocks tests/plugin-chatlog.test.mjs
import test, { mock, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.OFFSZN_VARIABLE_PANEL = 'clave-de-prueba';
const table = [];
let failInsert = false;
const client = {
    from: (name) => {
        assert.equal(name, 'plugin_chat_logs');
        const q = { filters: [], max: Infinity };
        q.insert = async (rows) => { if (failInsert) return { error: { message: 'no existe la tabla' } }; rows.forEach((r, i) => table.push({ id: table.length + 1, created_at: new Date(Date.now() + i).toISOString(), ...r })); return { error: null }; };
        q.select = () => q; q.order = () => q; q.limit = (n) => { q.max = n; return q; };
        q.eq = (c, v) => { q.filters.push((r) => r[c] === v); return q; };
        q.ilike = (c, p) => { const s = p.replace(/%/g, '').toLowerCase(); q.filters.push((r) => String(r[c]).toLowerCase().includes(s)); return q; };
        q.then = (res, rej) => Promise.resolve({ data: table.filter((r) => q.filters.every((f) => f(r))).slice(0, q.max), error: null }).then(res, rej);
        return q;
    }
};
mock.module(new URL('../src/infrastructure/database/connection.js', import.meta.url).href, { namedExports: { supabase: client } });
let C;
before(async () => { C = await import('../src/infrastructure/http/controllers/PluginChatLogController.js'); });

const res = () => { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
const send = async (body) => { const r = res(); await C.receiveChatLog({ body }, r); return r; };
const list = async (query, headers = {}) => { const r = res(); await C.adminListChatLog({ query, headers }, r); return r; };

test('guarda los mensajes y recorta lo largo', async () => {
    const r = await send({ plugin: 'STAR CHAIN', version: '0.1.0', hwid: 'PC_1', license: 'prueba', items: [
        { t: '2026-10-28T01:00:00Z', usuario: 'quiero una cadena como bad bunny', ruta: 'IA', respuesta: 'Va, la armo así.', acciones: [{ type: 'build' }] },
        { t: 'fecha rara', usuario: 'x'.repeat(900), ruta: 'reglas', respuesta: 'ok', acciones: 'no-es-lista' },
        { usuario: '   ', ruta: 'IA', respuesta: 'vacío: se descarta' }] });
    assert.deepEqual(r.body, { ok: true, saved: 2 });
    assert.equal(table[1].usuario.length, 500); assert.equal(table[1].said_at, null); assert.deepEqual(table[1].acciones, []);
});
test('sin hwid o sin mensajes no guarda nada', async () => {
    assert.equal((await send({ items: [{ usuario: 'hola' }] })).body.saved, 0);
    assert.equal((await send({ hwid: 'PC_1', items: [] })).body.saved, 0);
});
test('máximo 50 mensajes por envío', async () => {
    const before = table.length;
    await send({ hwid: 'PC_2', items: Array.from({ length: 80 }, (_, i) => ({ usuario: 'm' + i, ruta: 'IA', respuesta: 'r' })) });
    assert.equal(table.length - before, 50);
});
test('si la base falla responde ok:false (el plugin conserva sus líneas)', async () => {
    failInsert = true; const r = await send({ hwid: 'PC_3', items: [{ usuario: 'hola', ruta: 'IA', respuesta: 'r' }] }); failInsert = false;
    assert.equal(r.body.ok, false);
});
test('listar exige la clave del panel', async () => {
    assert.equal((await list({})).code, 403);
    assert.equal((await list({ admin_key: 'mala' })).code, 403);
    const ok = await list({ admin_key: 'clave-de-prueba' });
    assert.equal(ok.code, 200); assert.ok(ok.body.count >= 2);
    assert.equal((await list({}, { 'x-admin-key': 'clave-de-prueba' })).code, 200);
});
test('filtra por usuario, ruta y texto', async () => {
    const k = { admin_key: 'clave-de-prueba' };
    assert.ok((await list({ ...k, hwid: 'PC_1' })).body.logs.every((l) => l.hwid === 'PC_1'));
    assert.ok((await list({ ...k, ruta: 'reglas' })).body.logs.every((l) => l.ruta === 'reglas'));
    assert.equal((await list({ ...k, q: 'BAD BUNNY' })).body.count, 1);
});
