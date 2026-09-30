// Pruebas de los endpoints REALES de licencias de plugins (activate / validate / request-trial / admin) contra un Supabase
// simulado en memoria. No toca la base de datos ni el correo.
//   npm run test:licensing        (node --test --experimental-test-module-mocks)
import test, { mock, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// ── Entorno de prueba: clave de firma y clave de administrador propias ────────────────────────────────────────────
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
process.env.PLUGIN_PRIVATE_KEY = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
process.env.OFFSZN_VARIABLE_PANEL = 'clave-de-prueba';
process.env.OMNI_PRODUCT_IDS = '';               // Omni aún sin producto en la tienda

// ── Supabase en memoria (solo lo que usa PluginLicensingController) ───────────────────────────────────────────────
function makeFakeSupabase() {
    const db = { plugin_licenses: [], plugin_activations: [], users: [], orders: [], order_items: [] };
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
        gte() { return this; } order() { return this; } range() { return this; }
        limit(n) { this.max = n; return this; }
        single() { this.mode = 'single'; return this._run(); }
        maybeSingle() { this.mode = 'maybe'; return this._run(); }
        then(res, rej) { return this._run().then(res, rej); }

        _embed(row) {
            if (this.table === 'plugin_activations' && String(this.cols).includes('plugin_licenses')) {
                return { ...row, plugin_licenses: db.plugin_licenses.find((l) => l.id === row.license_id) };
            }
            return row;
        }
        _get(row, col) { return col.split('.').reduce((o, k) => (o == null ? undefined : o[k]), row); }
        _match(row) {
            return this.filters.every(([kind, col, val]) => {
                const v = this._get(row, col);
                if (kind === 'eq') return v === val;
                if (kind === 'in') return val.includes(v);
                if (kind === 'ilike') {
                    const re = new RegExp('^' + String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i');
                    return re.test(String(v ?? ''));
                }
                return true;
            });
        }
        async _run() {
            const rows = db[this.table] || (db[this.table] = []);
            let result;
            if (this.op === 'insert') {
                const r = { id: nextId++, created_at: new Date().toISOString(), ...this.row };
                rows.push(r);
                result = [r];
            } else {
                const matched = rows.map((r) => this._embed(r)).filter((r) => this._match(r));
                if (this.op === 'update') { matched.forEach((m) => Object.assign(rows.find((r) => r.id === m.id), this.patch)); result = matched; }
                else if (this.op === 'delete') { matched.forEach((m) => rows.splice(rows.findIndex((r) => r.id === m.id), 1)); result = matched; }
                else result = matched.slice(0, this.max);
            }
            if (this.mode === 'single') return result.length ? { data: result[0], error: null } : { data: null, error: { message: 'no rows' } };
            if (this.mode === 'maybe') return { data: result[0] ?? null, error: null };
            return { data: result, error: null };
        }
    }
    return { db, client: { from: (t) => new Query(t) } };
}

const fake = makeFakeSupabase();
mock.module(new URL('../src/infrastructure/database/connection.js', import.meta.url).href, { namedExports: { supabase: fake.client } });
mock.module(new URL('../src/shared/utils/mailer.js', import.meta.url).href, { namedExports: { sendOffsznEmail: async () => {} } });

let C;   // controller
before(async () => { C = await import('../src/infrastructure/http/controllers/PluginLicensingController.js'); });

// ── Utilidades ────────────────────────────────────────────────────────────────────────────────────────────────────
async function call(handler, body) {
    const res = { code: 200, body: null, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } };
    await handler({ body, query: {}, headers: {} }, res);
    return res;
}
const ADMIN = 'clave-de-prueba';
async function newKey(plugin, extra = {}) {
    const r = await call(C.adminGenerateFullKey, { admin_key: ADMIN, plugin_name: plugin, ...extra });
    assert.equal(r.code, 200, JSON.stringify(r.body));
    return r.body.serial_key;
}
const HW = (name, id) => `${name}_${id}`;
const DEV_A = 'a1b2c3d4e5f60718', DEV_B = 'b1b2c3d4e5f60718', DEV_C = 'c1b2c3d4e5f60718';
function verifyV2(r, { serial, hwid, nonce }) {
    const b = r.body;
    const payload = ['v2', serial, b.license_type, b.expires_at, hwid, nonce, b.server_time, b.status].join('|');
    return crypto.verify(null, Buffer.from(payload, 'utf8'), publicKey, Buffer.from(b.signature_v2, 'hex'));
}

// ── Registro de plugins ───────────────────────────────────────────────────────────────────────────────────────────
test('registro: prefijos, nombres y serial pegado con texto', async () => {
    const R = await import('../src/shared/config/pluginRegistry.js');
    assert.equal(R.prefixForName('Omni Plugin'), 'OMNI');
    assert.equal(R.prefixForName('OMNI PLUGIN'), 'OMNI');
    assert.equal(R.prefixForName('EASY PITCH'), 'PITCH');
    assert.equal(R.prefixForName('Easy Master'), 'MASTER');
    assert.equal(R.prefixForName('COCA COLA'), 'COKE');
    assert.equal(R.prefixForName('INKA KOLA'), 'INKA');
    assert.equal(R.prefixForName('Vocal Preset'), 'VOCA');
    assert.equal(R.prefixForName('Easy Mix'), 'EASY');
    assert.equal(R.prefixForName(''), 'EASY');
    assert.equal(R.findPluginBySerial('OMNI-FULL-AB12CD34-EF56AB78').id, 'omni');
    assert.equal(R.findPluginBySerial('PITCH-TRIAL-AB12CD34-EF56AB78').id, 'easy-pitch');
    assert.equal(R.extractSerial('Omni Plugin: omni-full-ab12cd34-ef56ab78 '), 'OMNI-FULL-AB12CD34-EF56AB78');
    assert.equal(R.extractSerial('basura'), 'BASURA');
    // Los prefijos no se pisan entre sí
    const prefixes = R.PLUGINS.map((p) => p.prefix);
    assert.equal(new Set(prefixes).size, prefixes.length);
});

// ── Omni: generación y activación ─────────────────────────────────────────────────────────────────────────────────
test('admin genera clave OMNI-FULL y queda registrada como "Omni Plugin"', async () => {
    const serial = await newKey('Omni Plugin');
    assert.match(serial, /^OMNI-FULL-[A-F0-9]{8}-[A-F0-9]{8}$/);
    assert.equal(fake.db.plugin_licenses.find((l) => l.serial_key === serial).plugin_name, 'Omni Plugin');
    const denied = await call(C.adminGenerateFullKey, { admin_key: 'mala', plugin_name: 'Omni Plugin' });
    assert.equal(denied.code, 403);
});

test('activar Omni: OK, firma v2 verificable con la clave pública, atada a hwid y nonce', async () => {
    const serial = await newKey('Omni Plugin');
    const hwid = HW('PC-WILLIE', DEV_A), nonce = 'nonce-123';
    const r = await call(C.activateSerial, { serial_key: serial, hwid, plugin_name: 'Omni Plugin', nonce, device_name: 'PC-WILLIE' });
    assert.equal(r.code, 200, JSON.stringify(r.body));
    assert.equal(r.body.license_type, 'lifetime');
    assert.equal(r.body.status, 'active');
    assert.equal(r.body.nonce, nonce);
    assert.ok(verifyV2(r, { serial, hwid, nonce }), 'la firma v2 debe verificar');
    // Cambiar cualquier dato invalida la firma (un servidor falso no puede reciclar la respuesta)
    assert.ok(!verifyV2(r, { serial, hwid: HW('PC-WILLIE', DEV_B), nonce }));
    assert.ok(!verifyV2(r, { serial, hwid, nonce: 'otro' }));
});

test('una licencia de Omni NO sirve en otros plugins (y viceversa)', async () => {
    const omni = await newKey('Omni Plugin');
    const pitch = await newKey('Easy Pitch');
    const mix = await newKey('Easy Mix');
    const hwid = HW('PC', DEV_A);

    for (const other of ['Easy Pitch', 'EASY MIX', 'EASY MASTER', 'INKA KOLA', 'COCA COLA', 'Vocal Preset']) {
        const r = await call(C.activateSerial, { serial_key: omni, hwid, plugin_name: other });
        assert.equal(r.code, 403, `Omni no debe activarse en ${other}`);
        assert.equal(r.body.code, 'wrong_product');
    }
    const a = await call(C.activateSerial, { serial_key: pitch, hwid, plugin_name: 'Omni Plugin' });
    assert.equal(a.code, 403); assert.equal(a.body.code, 'wrong_product');
    const b = await call(C.activateSerial, { serial_key: mix, hwid, plugin_name: 'Omni Plugin' });
    assert.equal(b.code, 403); assert.equal(b.body.code, 'wrong_product');
    // Un plugin sin nombre reconocible tampoco puede usar una licencia exclusiva
    const c = await call(C.activateSerial, { serial_key: omni, hwid, plugin_name: 'Plugin Raro' });
    assert.equal(c.code, 403);
    // Y con su propio nombre sí
    const ok = await call(C.activateSerial, { serial_key: omni, hwid, plugin_name: 'OMNI PLUGIN' });
    assert.equal(ok.code, 200);
});

test('regresión: los demás plugins siguen activando con su propio nombre', async () => {
    for (const name of ['Easy Pitch', 'Easy Mix', 'Easy Master', 'Inka Kola', 'Coca Cola', 'Vocal Preset']) {
        const serial = await newKey(name);
        const r = await call(C.activateSerial, { serial_key: serial, hwid: HW('PC', DEV_A), plugin_name: name.toUpperCase() });
        assert.equal(r.code, 200, `${name}: ${JSON.stringify(r.body)}`);
    }
});

test('límite de dispositivos y reactivación en el mismo equipo (renombrado de PC)', async () => {
    const serial = await newKey('Omni Plugin', { max_devices: 2 });
    const activate = (hwid) => call(C.activateSerial, { serial_key: serial, hwid, plugin_name: 'Omni Plugin' });
    assert.equal((await activate(HW('PC1', DEV_A))).code, 200);
    assert.equal((await activate(HW('PC2', DEV_B))).code, 200);
    const third = await activate(HW('PC3', DEV_C));
    assert.equal(third.code, 403); assert.equal(third.body.code, 'device_limit');
    // Mismo equipo con otro nombre: NO gasta cupo ni se rechaza
    assert.equal((await activate(HW('NOMBRE-NUEVO', DEV_A))).code, 200);
    assert.equal(fake.db.plugin_activations.filter((a) => a.license_id === fake.db.plugin_licenses.find((l) => l.serial_key === serial).id).length, 2);
});

test('activar: serial inexistente, revocado y mal formado', async () => {
    const r404 = await call(C.activateSerial, { serial_key: 'OMNI-FULL-00000000-00000000', hwid: HW('PC', DEV_A), plugin_name: 'Omni Plugin' });
    assert.equal(r404.code, 404); assert.equal(r404.body.code, 'not_found');
    const serial = await newKey('Omni Plugin');
    fake.db.plugin_licenses.find((l) => l.serial_key === serial).status = 'revoked';
    const rev = await call(C.activateSerial, { serial_key: serial, hwid: HW('PC', DEV_A), plugin_name: 'Omni Plugin' });
    assert.equal(rev.code, 403); assert.equal(rev.body.code, 'revoked');
    assert.equal((await call(C.activateSerial, { hwid: HW('PC', DEV_A) })).code, 400);
});

// ── Omni: validación (auditoría de 5 h) ───────────────────────────────────────────────────────────────────────────
test('validar: válida solo en el equipo activado, con firma v2', async () => {
    const serial = await newKey('Omni Plugin');
    const hwid = HW('PC-WILLIE', DEV_A);
    await call(C.activateSerial, { serial_key: serial, hwid, plugin_name: 'Omni Plugin' });

    const ok = await call(C.validateLicense, { serial_key: serial, hwid, plugin_name: 'Omni Plugin', nonce: 'n-1' });
    assert.equal(ok.code, 200); assert.equal(ok.body.valid, true);
    assert.ok(verifyV2(ok, { serial, hwid, nonce: 'n-1' }));

    // Mismo equipo, PC renombrado
    assert.equal((await call(C.validateLicense, { serial_key: serial, hwid: HW('OTRO-NOMBRE', DEV_A), plugin_name: 'Omni Plugin' })).code, 200);

    // Otro equipo que nunca activó → definitivo: device_not_registered
    const other = await call(C.validateLicense, { serial_key: serial, hwid: HW('PC-AJENO', DEV_B), plugin_name: 'Omni Plugin' });
    assert.equal(other.code, 403); assert.equal(other.body.code, 'device_not_registered');

    // Sin plugin_name (cliente antiguo) sigue funcionando
    assert.equal((await call(C.validateLicense, { serial_key: serial, hwid })).code, 200);
});

test('validar: not_found, revoked, expired, wrong_product, datos faltantes', async () => {
    const hwid = HW('PC', DEV_A);
    const nf = await call(C.validateLicense, { serial_key: 'OMNI-FULL-11111111-22222222', hwid, plugin_name: 'Omni Plugin' });
    assert.equal(nf.code, 404); assert.equal(nf.body.code, 'not_found');

    const serial = await newKey('Omni Plugin');
    await call(C.activateSerial, { serial_key: serial, hwid, plugin_name: 'Omni Plugin' });
    const lic = fake.db.plugin_licenses.find((l) => l.serial_key === serial);

    const wrong = await call(C.validateLicense, { serial_key: serial, hwid, plugin_name: 'Easy Pitch' });
    assert.equal(wrong.code, 403); assert.equal(wrong.body.code, 'wrong_product');

    lic.expires_at = new Date(Date.now() - 86400000).toISOString();
    const exp = await call(C.validateLicense, { serial_key: serial, hwid, plugin_name: 'Omni Plugin' });
    assert.equal(exp.code, 403); assert.equal(exp.body.code, 'expired');
    lic.expires_at = null;

    lic.status = 'suspended';
    const rev = await call(C.validateLicense, { serial_key: serial, hwid, plugin_name: 'Omni Plugin' });
    assert.equal(rev.code, 403); assert.equal(rev.body.code, 'revoked');

    assert.equal((await call(C.validateLicense, { serial_key: serial })).code, 400);
});

test('validar NO registra dispositivos ni arranca contadores (solo audita)', async () => {
    const serial = await newKey('Omni Plugin', { license_type: 'trial' });
    const before = fake.db.plugin_activations.length;
    const r = await call(C.validateLicense, { serial_key: serial, hwid: HW('PC', DEV_A), plugin_name: 'Omni Plugin' });
    assert.equal(r.code, 403); assert.equal(r.body.code, 'device_not_registered');
    assert.equal(fake.db.plugin_activations.length, before);
    assert.equal(fake.db.plugin_licenses.find((l) => l.serial_key === serial).expires_at, null);
});

// ── Pruebas gratuitas ─────────────────────────────────────────────────────────────────────────────────────────────
test('trial: una por equipo y por plugin, para siempre; renombrar el PC no la resetea', async () => {
    const t1 = await call(C.requestTrial, { hwid: HW('PC-1', DEV_A), plugin_name: 'Omni Plugin' });
    assert.equal(t1.code, 200); assert.match(t1.body.serial_key, /^OMNI-TRIAL-/);

    // Mismo equipo (otro nombre): devuelve LA MISMA prueba, no una nueva
    const t2 = await call(C.requestTrial, { hwid: HW('PC-RENOMBRADO', DEV_A), plugin_name: 'Omni Plugin' });
    assert.equal(t2.body.serial_key, t1.body.serial_key);

    // Otro plugin en el mismo equipo: prueba independiente
    const tp = await call(C.requestTrial, { hwid: HW('PC-1', DEV_A), plugin_name: 'Easy Pitch' });
    assert.match(tp.body.serial_key, /^PITCH-TRIAL-/);

    // Expirada: no hay segunda oportunidad
    fake.db.plugin_licenses.find((l) => l.serial_key === t1.body.serial_key).expires_at = new Date(Date.now() - 1000).toISOString();
    const t3 = await call(C.requestTrial, { hwid: HW('PC-OTRO-NOMBRE', DEV_A), plugin_name: 'Omni Plugin' });
    assert.equal(t3.code, 403); assert.equal(t3.body.trial_expired, true);
});

test('trial por clave: arranca al activar (3 días; Inka 7) y un equipo con prueba previa no usa otra clave', async () => {
    const k1 = await newKey('Omni Plugin', { license_type: 'trial' });
    const a1 = await call(C.activateSerial, { serial_key: k1, hwid: HW('PC', DEV_C), plugin_name: 'Omni Plugin' });
    assert.equal(a1.code, 200);
    const days = Math.round((new Date(a1.body.expires_at) - Date.now()) / 86400000);
    assert.equal(days, 3);

    const k2 = await newKey('Omni Plugin', { license_type: 'trial' });
    const a2 = await call(C.activateSerial, { serial_key: k2, hwid: HW('PC-NUEVO-NOMBRE', DEV_C), plugin_name: 'Omni Plugin' });
    assert.equal(a2.code, 403); assert.equal(a2.body.code, 'trial_used');

    const inka = await newKey('Inka Kola', { license_type: 'trial' });
    const ai = await call(C.activateSerial, { serial_key: inka, hwid: HW('PC', DEV_B), plugin_name: 'INKA KOLA' });
    assert.equal(Math.round((new Date(ai.body.expires_at) - Date.now()) / 86400000), 7);

    // Las pruebas exigen un HWID real
    const k3 = await newKey('Omni Plugin', { license_type: 'trial' });
    assert.equal((await call(C.activateSerial, { serial_key: k3, plugin_name: 'Omni Plugin' })).code, 400);
});

// ── Web: generar licencia tras comprar ────────────────────────────────────────────────────────────────────────────
test('generate-web de Omni: sin producto configurado no emite licencias', async () => {
    const res = { code: 200, body: null, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } };
    await C.generateWebLicense({ body: { plugin_name: 'Omni Plugin' }, user: { id: 'u1' } }, res);
    assert.equal(res.code, 403);
    assert.match(res.body.error, /no está disponible/i);
    const res2 = { code: 200, body: null, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } };
    await C.generateWebLicense({ body: { plugin_name: 'Plugin Inventado' }, user: { id: 'u1' } }, res2);
    assert.equal(res2.code, 400);
});
