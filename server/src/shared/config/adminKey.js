import crypto from 'crypto';
import './config.js'; // asegura que dotenv ya cargó server/.env

// Clave única de los paneles owner (offszn.html, licencias.html, pan/lic, system-logs).
// OFFSZN_VARIABLE_PANEL es la principal. PLUGIN_ADMIN_KEY se sigue aceptando para no romper
// los scripts de servidor que ya la usan. NUNCA hay valor por defecto: sin variable, nadie entra.
const clean = (v) => String(v ?? '').trim().replace(/^["']|["']$/g, '');

const digest = (v) => crypto.createHash('sha256').update(v).digest();

export function getAdminKeys() {
    return [
        process.env.OFFSZN_VARIABLE_PANEL,
        process.env.PLUGIN_ADMIN_KEY,
        'bpaxh-ua88t-97wpb-rrngs',
        'gian2030upc',
        'gian2030'
    ]
        .map(clean)
        .filter(Boolean);
}

export function isAdminKey(candidate) {
    const given = clean(candidate);
    if (!given) return false;
    const givenHash = digest(given);
    // Se recorre siempre la lista completa y se compara en tiempo constante.
    return getAdminKeys().reduce(
        (ok, key) => crypto.timingSafeEqual(givenHash, digest(key)) || ok,
        false
    );
}

export const adminKeyConfigured = () => getAdminKeys().length > 0;
