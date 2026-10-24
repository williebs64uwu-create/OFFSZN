// La clave de los paneles owner sale solo de la variable de entorno (sin claves escritas en el código).
//   node --test tests/admin-key.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

delete process.env.OFFSZN_VARIABLE_PANEL;
delete process.env.PLUGIN_ADMIN_KEY;
const { isAdminKey, getAdminKeys, adminKeyConfigured } = await import('../src/shared/config/adminKey.js');

test('sin variable de entorno nadie entra', () => {
    assert.equal(adminKeyConfigured(), false);
    for (const k of ['admin', '1234', 'cualquier-clave', '', undefined, null]) assert.equal(isAdminKey(k), false, String(k));
});

test('con OFFSZN_VARIABLE_PANEL entra solo esa clave (acepta comillas del .env y espacios)', () => {
    process.env.OFFSZN_VARIABLE_PANEL = '"mi-clave-unica"';
    assert.equal(isAdminKey('mi-clave-unica'), true);
    assert.equal(isAdminKey('  mi-clave-unica '), true);
    assert.equal(isAdminKey('mi-clave-unic'), false);
    assert.equal(isAdminKey('otra-clave'), false);
    assert.equal(getAdminKeys().length, 1);
});

test('el código fuente no contiene claves de administrador escritas', () => {
    const src = fs.readFileSync(new URL('../src/shared/config/adminKey.js', import.meta.url), 'utf8');
    const literals = (src.match(/(?<![\w\]])'[A-Za-z0-9_.-]{8,}'/g) || []).filter((l) => !/^'[A-Z_]+'$/.test(l));
    assert.deepEqual(literals, [], 'no debe haber claves escritas, solo nombres de variables de entorno');
});
