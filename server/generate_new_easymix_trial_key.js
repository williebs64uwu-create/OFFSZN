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
    const serialKey = `EASY-TRIAL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 5);
    const expiresAt = expiryDate.toISOString();
    
    const { data: newLic, error: licErr } = await supabase
        .from('plugin_licenses')
        .insert({
            plugin_name: 'Easy Mix',
            serial_key: serialKey,
            license_type: 'trial',
            status: 'active',
            expires_at: expiresAt,
            max_devices: 1
        })
        .select('*').single();
    
    if (licErr) {
        console.error("❌ Error creando licencia TRIAL:", licErr);
    } else {
        console.log("==========================================");
        console.log("🔑 NUEVA LICENCIA TRIAL (5 DÍAS) EASY MIX:");
        console.log("   Serial Key: " + serialKey);
        console.log("   Tipo:       TRIAL (5 Días)");
        console.log("   Expira:     " + expiresAt);
        console.log("==========================================");
    }
}
main();
