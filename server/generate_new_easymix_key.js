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
    const serialKey = `EASY-FULL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    const { data: newLic, error: licErr } = await supabase
        .from('plugin_licenses')
        .insert({
            plugin_name: 'Easy Mix',
            serial_key: serialKey,
            license_type: 'lifetime',
            status: 'active',
            expires_at: null,
            max_devices: 5
        })
        .select('*').single();
    
    if (licErr) {
        console.error("❌ Error creando licencia FULL:", licErr);
    } else {
        console.log("==========================================");
        console.log("🔑 NUEVA LICENCIA FULL (LIFETIME) EASY MIX:");
        console.log("   Serial Key: " + serialKey);
        console.log("   Tipo:       LIFETIME (De por vida)");
        console.log("   Dispositivos max: 5");
        console.log("==========================================");
    }
}
main();
