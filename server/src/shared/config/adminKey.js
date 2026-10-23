import crypto from 'crypto';
import './config.js'; // asegura que dotenv ya cargó server/.env

// Clave única de TODOS los paneles owner (CRM /crm, offszn.html, licencias, pagos manuales, pan/lic, system-logs,
// lista de espera, notas, diagnóstico). Se define solo con la variable de entorno OFFSZN_VARIABLE_PANEL.
// PLUGIN_ADMIN_KEY es una variable antigua: si todavía existe en el servidor se acepta, pero conviene borrarla para
// manejar una sola clave. NUNCA hay valor por defecto: sin variable, nadie entra.
const clean = (v) => String(v ?? '').trim().replace(/^["']|["']$/g, '');

const digest = (v) => crypto.createHash('sha256').update(v).digest();

export function getAdminKeys() {
    return [
        process.env.OFFSZN_VARIABLE_PANEL,
        process.env.PLUGIN_ADMIN_KEY
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
