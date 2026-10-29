// Uso: node generate_starchain_keys.js full|trial|sub [N]   (necesita server/.env con SUPABASE_URL y SUPABASE_SERVICE_KEY)
// full = de por vida (3 equipos) · trial = prueba de 3 días (1 equipo; el plazo empieza al activarla) · sub = suscripción de 30 días
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltan credenciales de Supabase en server/.env');
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const kind = (process.argv[2] || '').toLowerCase();
const count = Math.max(1, Math.min(100, parseInt(process.argv[3] || '1', 10) || 1));
const KINDS = {
    full: { tag: 'FULL', license_type: 'lifetime', max_devices: 3, expires: () => null },
    trial: { tag: 'TRIAL', license_type: 'trial', max_devices: 1, expires: () => null },
    sub: { tag: 'SUB', license_type: 'subscription', max_devices: 3, expires: () => new Date(Date.now() + 30 * 864e5).toISOString() }
};
const cfg = KINDS[kind];
if (!cfg) {
    console.error('Uso: node generate_starchain_keys.js full|trial|sub [N]');
    process.exit(1);
}

const part = () => crypto.randomBytes(4).toString('hex').toUpperCase();

for (let i = 0; i < count; i++) {
    const serial_key = `STAR-${cfg.tag}-${part()}-${part()}`;
    const { error } = await supabase.from('plugin_licenses').insert({
        plugin_name: 'STAR CHAIN',
        serial_key,
        license_type: cfg.license_type,
        status: 'active',
        expires_at: cfg.expires(),
        max_devices: cfg.max_devices
    });
    if (error) {
        console.error(`❌ ${serial_key}: ${error.message}`);
        process.exit(1);
    }
    console.log(serial_key);
}
