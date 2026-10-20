// Pruebas de Astra en la nube para Orb (planes Pro / Max) contra un Supabase simulado en memoria y un modelo simulado.
// No toca la base de datos ni ningún proveedor de IA.
//   node --test --experimental-test-module-mocks tests/orb-astra.test.mjs
import test, { mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const { privateKey } = crypto.generateKeyPairSync('ed25519');
process.env.PLUGIN_PRIVATE_KEY = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
process.env.OFFSZN_VARIABLE_PANEL = 'clave-de-prueba';
process.env.ORB_LLM_API_KEY = 'clave-modelo-prueba';
process.env.ORB_LLM_BASE_URL = 'https://modelo.prueba/v1';
process.env.ORB_PRO_MODEL = 'qwen-pro-prueba';
process.env.ORB_MAX_MODEL = 'qwen-max-prueba';
process.env.ORB_TRIAL_MODEL = 'qwen-trial-prueba';

// ── Supabase en memoria (tablas + las tres funciones de cuota con la misma semántica que el SQL) ──────────────────
function makeFakeSupabase() {
    const db = { plugin_licenses: [], plugin_activations: [], users: [], orders: [], order_items: [], subscriptions: [], astra_usage: [], profiles: [] };
    let nextId = 1;
    class Query {
        constructor(table) { this.table = table; this.op = 'select'; this.filters = []; this.cols = '*'; this.max = Infinity; this.mode = 'many'; }
        select(cols = '*') { this.cols = cols; return this; }
        insert(row) { this.op = 'insert'; this.row = row; return this; }
        update(patch) { this.op = 'update'; this.patch = patch; return this; }
        delete() { this.op = 'delete'; return this; }
        eq(c, v) { this.filters.push(['eq', c, v]); return this; }
        ilike(c, p) { this.filters.push(['ilike', c, p]); return this; }
        in(c, arr) { this.filters.push(['in', c, arr]); return this; }
        lt(c, v) { this.filters.push(['lt', c, v]); return this; }
        not() { return this; } gte() { return this; } order() { return this; } range() { return this; }
        limit(n) { this.max = n; return this; }
        single() { this.mode = 'single'; return this._run(); }
        maybeSingle() { this.mode = 'maybe'; return this._run(); }
        then(res, rej) { return this._run().then(res, rej); }
        _match(row) {
            return this.filters.every(([k, c, v]) => {
                const x = row[c];
                if (k === 'eq') return x === v;
                if (k === 'in') return v.includes(x);
                if (k === 'lt') return x < v;
                if (k === 'ilike') return new RegExp('^' + String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i').test(String(x ?? ''));
                return true;
            });
        }
        async _run() {
            const rows = db[this.table] || (db[this.table] = []);
            let result;
            if (this.op === 'insert') { const r = { id: nextId++, created_at: new Date().toISOString(), ...this.row }; rows.push(r); result = [r]; }
            else {
                const matched = rows.filter((r) => this._match(r));
                if (this.op === 'update') { matched.forEach((m) => Object.assign(m, this.patch)); result = matched; }
                else if (this.op === 'delete') { matched.forEach((m) => rows.splice(rows.indexOf(m), 1)); result = matched; }
                else result = matched.slice(0, this.max);
            }
            if (this.mode === 'single') return result.length ? { data: result[0], error: null } : { data: null, error: { message: 'no rows' } };
            if (this.mode === 'maybe') return { data: result[0] ?? null, error: null };
            return { data: result, error: null };
        }
    }
    const usage = (lic, period) => db.astra_usage.find((u) => u.license_id === lic && u.period === period);
    const rpc = async (fn, a) => {
        if (fn === 'consume_astra_quota') {
            let u = usage(a.p_license, a.p_period);
            if (!u) { u = { license_id: a.p_license, period: a.p_period, requests: 0, tokens_in: 0, tokens_out: 0 }; db.astra_usage.push(u); }
            if (u.requests >= a.p_limit) return { data: null, error: null };   // ON CONFLICT ... WHERE falla → sin fila
            u.requests += 1; return { data: a.p_limit - u.requests, error: null };
        }
        if (fn === 'refund_astra_quota') { const u = usage(a.p_license, a.p_period); if (u) u.requests = Math.max(0, u.requests - 1); return { data: null, error: null }; }
        if (fn === 'record_astra_tokens') { const u = usage(a.p_license, a.p_period); if (u) { u.tokens_in += a.p_in; u.tokens_out += a.p_out; } return { data: null, error: null }; }
        return { data: null, error: { message: 'función desconocida ' + fn } };
    };
    return { db, client: { from: (t) => new Query(t), rpc } };
}

const fake = makeFakeSupabase();
mock.module(new URL('../src/infrastructure/database/connection.js', import.meta.url).href, { namedExports: { supabase: fake.client } });
mock.module(new URL('../src/shared/utils/mailer.js', import.meta.url).href, { namedExports: { sendOffsznEmail: async () => {} } });

// ── Modelo simulado (API compatible con OpenAI) ───────────────────────────────────────────────────────────────────
let modelCalls = [], modelMode = 'ok';
globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    modelCalls.push({ url, auth: init.headers.Authorization, model: body.model, user: body.messages[1].content });
    if (modelMode === 'down') return { ok: false, status: 503, json: async () => ({ error: 'caído' }) };
    const content = modelMode === 'junk' ? 'no es json'
        : '```json\n' + JSON.stringify({ reply: 'Listo, más oscuro.', action: 'edit', family: 'none', preset: '', name: '',
            changes: [{ param: 'filt.cutoff', op: 'mul', value: 0.6 }, { param: 'parametro.inventado', op: 'set', value: '9' }] }) + '\n```';
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }], usage: { prompt_tokens: 1500, completion_tokens: 90 } }) };
};

let L, A, R;
before(async () => {
    L = await import('../src/infrastructure/http/controllers/PluginLicensingController.js');
    A = await import('../src/infrastructure/http/controllers/AstraController.js');
    R = await import('../src/shared/config/pluginRegistry.js');
});
beforeEach(() => { modelCalls = []; modelMode = 'ok'; process.env.ORB_PRO_REQUESTS = ''; process.env.ORB_LLM_API_KEY = 'clave-modelo-prueba'; });

async function call(handler, body) {
    const res = { code: 200, body: null, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } };
    await handler({ body, query: {}, headers: {} }, res);
    return res;
}
const ADMIN = 'clave-de-prueba';
let devN = 0;
const newDevice = () => `PC-ORB_${(++devN).toString(16).padStart(16, 'a')}`;
// Licencia de Orb activada en un equipo, opcionalmente asociada a un usuario
async function orbLicense({ trial = false, userId = null } = {}) {
    const hwid = newDevice();
    let serial;
    if (trial) {
        const t = await call(L.requestTrial, { hwid, plugin_name: 'Orb' });
        assert.equal(t.code, 200, JSON.stringify(t.body));
        serial = t.body.serial_key || t.body.serial;
    } else {
        const g = await call(L.adminGenerateFullKey, { admin_key: ADMIN, plugin_name: 'Orb' });
        assert.equal(g.code, 200, JSON.stringify(g.body));
        serial = g.body.serial_key;
    }
    const act = await call(L.activateSerial, { serial_key: serial, hwid, plugin_name: 'Orb', nonce: 'n', device_name: 'PC-ORB' });
    assert.equal(act.code, 200, JSON.stringify(act.body));
    const lic = fake.db.plugin_licenses.find((l) => l.serial_key === serial);
    if (userId) lic.user_id = userId;
    return { serial, hwid, lic };
}
const ask = (k, text = 'hazlo más oscuro') => call(A.astraAsk, { serial_key: k.serial, hwid: k.hwid, text, current: { name: '808 Classic', fam: 'bass', patch: { 'filt.cutoff': 700 } } });
const status = (k) => call(A.astraStatus, { serial_key: k.serial, hwid: k.hwid });
const setTier = (k, tier, days) => call(A.adminSetOrbTier, { admin_key: ADMIN, serial_key: k.serial, tier, days });

// ── Pruebas ───────────────────────────────────────────────────────────────────────────────────────────────────────
test('registro: Orb tiene prefijo ORB y no pisa a los demás', () => {
    assert.equal(R.findPluginBySerial('ORB-FULL-AB12CD34-EF56AB78').id, 'orb');
    assert.equal(R.findPluginByName('Orb').id, 'orb');
    assert.equal(R.prefixForName('Easy Mix'), 'EASY');
    const prefixes = R.PLUGINS.map((p) => p.prefix);
    assert.equal(new Set(prefixes).size, prefixes.length);
});

test('Orb sin suscripción: plan local, sin cupo en la nube (402)', async () => {
    const k = await orbLicense({ userId: 'u-local' });
    const s = await status(k);
    assert.equal(s.code, 200); assert.equal(s.body.tier, 'local'); assert.equal(s.body.limit, 0);
    const r = await ask(k);
    assert.equal(r.code, 402); assert.equal(r.body.code, 'no_plan');
    assert.equal(modelCalls.length, 0);
});

test('prueba de 3 días: 30 pedidos de prueba con el modelo de prueba', async () => {
    const k = await orbLicense({ trial: true });
    const s = await status(k);
    assert.equal(s.body.tier, 'trial'); assert.equal(s.body.limit, 30); assert.equal(s.body.remaining, 30);
    const r = await ask(k);
    assert.equal(r.code, 200, JSON.stringify(r.body));
    assert.equal(r.body.remaining, 29); assert.equal(r.body.tier, 'trial');
    assert.equal(modelCalls[0].model, 'qwen-trial-prueba');
    assert.equal(modelCalls[0].auth, 'Bearer clave-modelo-prueba');
    assert.equal(modelCalls[0].url, 'https://modelo.prueba/v1/chat/completions');
    const u = fake.db.astra_usage.find((x) => x.license_id === k.lic.id && x.period === 'trial');
    assert.deepEqual([u.requests, u.tokens_in, u.tokens_out], [1, 1500, 90]);
});

test('respuesta del modelo saneada: parámetros inventados fuera, valores como texto', async () => {
    const k = await orbLicense({ trial: true });
    const r = await ask(k);
    assert.equal(r.body.action, 'edit');
    assert.deepEqual(r.body.changes, [{ param: 'filt.cutoff', op: 'mul', value: '0.6' }]);
});

test('Pro por administrador: 1000 pedidos al mes con el modelo Pro', async () => {
    const k = await orbLicense({ userId: 'u-pro' });
    const t = await setTier(k, 'pro', 30);
    assert.equal(t.code, 200, JSON.stringify(t.body));
    const s = await status(k);
    assert.equal(s.body.tier, 'pro'); assert.equal(s.body.limit, 1000); assert.match(s.body.period, /^\d{4}-\d{2}$/);
    assert.ok(s.body.renews_at);
    const r = await ask(k);
    assert.equal(r.code, 200); assert.equal(r.body.remaining, 999);
    assert.equal(modelCalls[0].model, 'qwen-pro-prueba');
    // La suscripción no toca el plan del sitio
    assert.equal(fake.db.subscriptions.filter((x) => x.user_id === 'u-pro' && x.status === 'active')[0].plan_id, 'orb_pro_manual');
});

test('Max reemplaza a Pro y usa el modelo Max; "none" lo quita', async () => {
    const k = await orbLicense({ userId: 'u-max' });
    await setTier(k, 'pro'); await setTier(k, 'max');
    assert.equal((await status(k)).body.tier, 'max');
    assert.equal((await status(k)).body.limit, 3000);
    await ask(k);
    assert.equal(modelCalls.at(-1).model, 'qwen-max-prueba');
    await setTier(k, 'none');
    assert.equal((await status(k)).body.tier, 'local');
});

test('suscripción vencida: vuelve a local', async () => {
    const k = await orbLicense({ userId: 'u-venc' });
    fake.db.subscriptions.push({ id: 9001, user_id: 'u-venc', plan_id: 'orb_pro_monthly', status: 'active', current_period_end: new Date(Date.now() - 1000).toISOString() });
    assert.equal((await status(k)).body.tier, 'local');
});

test('planes del sitio (pro_monthly) no dan Astra en la nube', async () => {
    const k = await orbLicense({ userId: 'u-sitio' });
    fake.db.subscriptions.push({ id: 9002, user_id: 'u-sitio', plan_id: 'pro_monthly', status: 'active', current_period_end: new Date(Date.now() + 86400000).toISOString() });
    assert.equal((await status(k)).body.tier, 'local');
});

test('cupo agotado: 429 y no se llama al modelo', async () => {
    process.env.ORB_PRO_REQUESTS = '2';
    const k = await orbLicense({ userId: 'u-cupo' });
    await setTier(k, 'pro');
    assert.equal((await ask(k)).code, 200);
    assert.equal((await ask(k)).code, 200);
    const n = modelCalls.length;
    const r = await ask(k);
    assert.equal(r.code, 429); assert.equal(r.body.code, 'quota_exhausted'); assert.equal(r.body.remaining, 0);
    assert.equal(modelCalls.length, n);
});

test('pedidos simultáneos no superan el cupo', async () => {
    process.env.ORB_PRO_REQUESTS = '3';
    const k = await orbLicense({ userId: 'u-carrera' });
    await setTier(k, 'pro');
    const rs = await Promise.all(Array.from({ length: 6 }, () => ask(k)));
    assert.equal(rs.filter((r) => r.code === 200).length, 3);
    assert.equal(rs.filter((r) => r.code === 429).length, 3);
});

test('si el modelo falla, el pedido se devuelve (502)', async () => {
    const k = await orbLicense({ trial: true });
    modelMode = 'down';
    const r = await ask(k);
    assert.equal(r.code, 502); assert.equal(r.body.code, 'model_error');
    assert.equal(fake.db.astra_usage.find((x) => x.license_id === k.lic.id).requests, 0);
    modelMode = 'junk';
    assert.equal((await ask(k)).code, 502);
    assert.equal(fake.db.astra_usage.find((x) => x.license_id === k.lic.id).requests, 0);
});

test('sin clave del proveedor: 503 sin descontar', async () => {
    const k = await orbLicense({ trial: true });
    delete process.env.ORB_LLM_API_KEY;
    const r = await ask(k);
    assert.equal(r.code, 503);
    assert.equal(fake.db.astra_usage.filter((x) => x.license_id === k.lic.id).length, 0);
});

test('seguridad: otro plugin, otro equipo, licencia revocada', async () => {
    const g = await call(L.adminGenerateFullKey, { admin_key: ADMIN, plugin_name: 'Cassette' });
    const cas = await call(A.astraStatus, { serial_key: g.body.serial_key, hwid: newDevice() });
    assert.equal(cas.code, 403); assert.equal(cas.body.code, 'wrong_product');
    const k = await orbLicense({ trial: true });
    const other = await call(A.astraAsk, { serial_key: k.serial, hwid: newDevice(), text: 'hola' });
    assert.equal(other.code, 403); assert.equal(other.body.code, 'device_not_registered');
    k.lic.status = 'revoked';
    assert.equal((await ask(k)).code, 403);
    assert.equal((await call(A.astraAsk, { serial_key: k.serial, hwid: k.hwid, text: '' })).code, 400);
});

test('admin: clave inválida 403; licencia sin usuario 400', async () => {
    const k = await orbLicense();
    assert.equal((await call(A.adminSetOrbTier, { admin_key: 'mala', serial_key: k.serial, tier: 'pro' })).code, 403);
    assert.equal((await setTier(k, 'pro')).code, 400);
});

test('limpiador: una suscripción de Orb vencida no baja el plan del sitio', async () => {
    fake.db.users.push({ id: 'u-scav', plan: 'pro' });
    fake.db.subscriptions.push({ id: 9100, user_id: 'u-scav', plan_id: 'orb_pro_monthly', status: 'active', provider: 'manual', current_period_end: new Date(Date.now() - 5000).toISOString() });
    const { runSubscriptionScavenger } = await import('../src/infrastructure/services/subscription-scavenger.js');
    await runSubscriptionScavenger();
    assert.equal(fake.db.subscriptions.find((s) => s.id === 9100).status, 'expired');
    assert.equal(fake.db.users.find((u) => u.id === 'u-scav').plan, 'pro');
});
