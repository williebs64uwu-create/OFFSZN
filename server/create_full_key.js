import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
    // 1. Borrar TODAS las activaciones de tu HWID (limpia trials anteriores)
    console.log("1. Limpiando activaciones previas de tu HWID...");
    await supabase.from('plugin_activations').delete().ilike('hwid', '%DESKTOP-SI8EGCH%');

    // 2. Crear llave FULL lifetime
    const serialKey = `EASY-FULL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    const { data: newLic, error: licErr } = await supabase
        .from('plugin_licenses')
        .insert({
            plugin_name: 'Easy Mix',
            serial_key: serialKey,
            license_type: 'lifetime',
            status: 'active',
            expires_at: null,
            max_devices: 3
        })
        .select('*').single();
    
    if (licErr) {
        console.error("Error creating FULL key:", licErr);
    } else {
        console.log("🔑 NUEVA LLAVE FULL (LIFETIME):", serialKey);
        console.log("   Max dispositivos:", 3);
        console.log("   Expira: NUNCA");
    }
}
main();
