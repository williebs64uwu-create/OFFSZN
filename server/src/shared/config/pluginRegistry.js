// ─── Registro central de plugins OFFSZN ───────────────────────────────────────
// ÚNICA fuente de verdad de: prefijo de serial, nombres aceptados, IDs de producto de la tienda y días de prueba.
// Antes esta información estaba repetida en ~10 cadenas `if (plugin_name === ...)` dentro de PluginLicensingController:
// añadir un plugin exigía tocarlas todas y era fácil dejar una sin actualizar (y una licencia de un plugin
// acababa funcionando en otro). Para añadir un plugin nuevo solo hay que añadir una entrada aquí.

function idsFromEnv(name) {
    return String(process.env[name] || '')
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n));
}

export const PLUGINS = [
    { id: 'easy-mix',    prefix: 'EASY',   displayName: 'Easy Mix',     names: ['easy mix'],                 keywords: ['mix'],             productIds: [899, 901], trialDays: 3, exclusive: false },
    { id: 'easy-master', prefix: 'MASTER', displayName: 'Easy Master',  names: ['easy master'],              keywords: ['master'],          productIds: [900],      trialDays: 3, exclusive: false },
    { id: 'coca-cola',   prefix: 'COKE',   displayName: 'Coca-Cola', dbName: 'Coca Cola',    names: ['coca cola', 'coca-cola'],   keywords: ['coca', 'coke'],    productIds: [903],      trialDays: 3, exclusive: true  },
    { id: 'inka-kola',   prefix: 'INKA',   displayName: 'Inka Kola',    names: ['inka kola'],                keywords: ['inka'],            productIds: [902],      trialDays: 7, exclusive: true  },
    { id: 'vocal-preset',prefix: 'VOCA',   displayName: 'Vocal Preset', names: ['vocal preset'],             keywords: ['vocal', 'voca'],   productIds: [905],      trialDays: 3, exclusive: true  },
    { id: 'easy-pitch',  prefix: 'PITCH',  displayName: 'Easy Pitch',   names: ['easy pitch'],               keywords: ['pitch'],           productIds: [906, 907], trialDays: 3, exclusive: true  },
    // Omni Plugin: el/los IDs del producto en la tienda se definen con OMNI_PRODUCT_IDS (coma-separados) cuando exista en `products`.
    { id: 'omni',        prefix: 'OMNI',   displayName: 'Omni Plugin',  names: ['omni plugin', 'omni'],      keywords: ['omni'],            productIds: idsFromEnv('OMNI_PRODUCT_IDS'), trialDays: 3, exclusive: true },
    // Easy Level (nivelador de voces con Clover): IDs de tienda con LEVEL_PRODUCT_IDS (coma-separados) cuando exista en `products`.
    { id: 'easy-level',  prefix: 'LEVEL',  displayName: 'Easy Level',   names: ['easy level'],               keywords: ['level'],           productIds: idsFromEnv('LEVEL_PRODUCT_IDS'), trialDays: 3, exclusive: true },
    // Easy Deeser (de-esser por partes con Clover): IDs de tienda con DEESER_PRODUCT_IDS (coma-separados) cuando exista en `products`.
    { id: 'easy-deeser', prefix: 'DEESER', displayName: 'Easy Deeser',  names: ['easy deeser', 'easy de esser', 'easy deesser'], keywords: ['deeser', 'deesser', 'de esser'], productIds: idsFromEnv('DEESER_PRODUCT_IDS'), trialDays: 3, exclusive: true },
    // Easy Clean (quitar ruido de fondo con Clover): IDs de tienda con CLEAN_PRODUCT_IDS (coma-separados) cuando exista en `products`.
    { id: 'easy-clean',  prefix: 'CLEAN',  displayName: 'Easy Clean',   names: ['easy clean'],               keywords: ['clean'],           productIds: idsFromEnv('CLEAN_PRODUCT_IDS'), trialDays: 3, exclusive: true }
];

export const DEFAULT_PLUGIN = PLUGINS[0]; // Easy Mix: comportamiento histórico cuando no se indica plugin

// Orden de evaluación de palabras clave: los específicos primero ("Easy Master"/"Easy Pitch" contienen "easy"; "mix" va al final)
const KEYWORD_ORDER = ['omni', 'easy-clean', 'easy-deeser', 'easy-level', 'easy-pitch', 'easy-master', 'coca-cola', 'inka-kola', 'vocal-preset', 'easy-mix'];

export function normalizeName(name) {
    return String(name || '').toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Serial canónico: PREFIJO-(FULL|TRIAL|SUB)-XXXXXXXX-XXXXXXXX
export const SERIAL_REGEX = new RegExp(`(${PLUGINS.map((p) => p.prefix).join('|')})-(FULL|TRIAL|SUB)-[A-Z0-9]{4,8}-[A-Z0-9]{4,8}`, 'i');

// Extrae el serial aunque el usuario pegue "Omni Plugin: OMNI-FULL-...". Si no hay coincidencia devuelve el texto en mayúsculas.
export function extractSerial(raw) {
    const text = String(raw || '').trim();
    const m = text.match(SERIAL_REGEX);
    return m ? m[0].toUpperCase() : text.toUpperCase();
}

export function findPluginBySerial(serial) {
    const s = String(serial || '').toUpperCase();
    if (s.startsWith('EASY-PITCH')) return PLUGINS.find((p) => p.id === 'easy-pitch'); // formato histórico
    if (s.startsWith('EASY-MASTER')) return PLUGINS.find((p) => p.id === 'easy-master');
    // EASY es el prefijo de Easy Mix; los demás son inequívocos
    return PLUGINS.find((p) => s.startsWith(p.prefix + '-')) || null;
}

// Coincidencia exacta por nombre normalizado y, si no, por palabra clave (compatibilidad con nombres antiguos del plugin).
export function findPluginByName(name) {
    const n = normalizeName(name);
    if (!n) return null;
    const exact = PLUGINS.find((p) => p.names.includes(n) || normalizeName(p.displayName) === n);
    if (exact) return exact;
    for (const id of KEYWORD_ORDER) {
        const p = PLUGINS.find((x) => x.id === id);
        if (p.keywords.some((k) => n.includes(k))) return p;
    }
    return null;
}

export function prefixForName(name) {
    return (findPluginByName(name) || DEFAULT_PLUGIN).prefix;
}

// Resuelve el plugin de una licencia guardada: el prefijo del serial manda; el nombre registrado es respaldo.
export function resolveLicensePlugin(license) {
    return findPluginBySerial(license?.serial_key) || findPluginByName(license?.plugin_name) || null;
}

// ¿Puede esta licencia usarse en el plugin que la solicita?
//  · Ambos identificados y distintos            → wrong_product ("no pertenece a X")
//  · Plugin solicitante desconocido y licencia de un plugin exclusivo → wrong_product ("exclusiva para Y")
//  · En cualquier otro caso                     → ok
// (Sin nombre solicitado no se restringe: clientes antiguos que no envían plugin_name siguen funcionando.)
export function checkProductMatch({ serial, licensePluginName, requestedPluginName }) {
    if (!String(requestedPluginName || '').trim()) return { ok: true };

    const licPlugin = findPluginBySerial(serial) || findPluginByName(licensePluginName);
    const reqPlugin = findPluginByName(requestedPluginName);

    if (licPlugin && reqPlugin && licPlugin.id !== reqPlugin.id) {
        return { ok: false, code: 'wrong_product', message: `Esta licencia no pertenece a ${reqPlugin.displayName}.` };
    }
    if (licPlugin && !reqPlugin && licPlugin.exclusive) {
        return { ok: false, code: 'wrong_product', message: `Esta licencia es exclusiva para ${licPlugin.displayName} y no sirve para otros plugins.` };
    }
    return { ok: true };
}
