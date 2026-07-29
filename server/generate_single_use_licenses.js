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
    // Easy Master
    const masterSerial = `MASTER-FULL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const { data: masterData, error: masterErr } = await supabase
        .from('plugin_licenses')
        .insert({
            plugin_name: 'Easy Master',
            serial_key: masterSerial,
            license_type: 'lifetime',
            status: 'active',
            expires_at: null,
            max_devices: 1
        })
        .select('*')
        .single();

    if (masterErr) {
        console.error('❌ Error creando licencia Easy Master:', masterErr);
    } else {
        console.log(`✅ Easy Master: ${masterData.serial_key} (Max Dispositivos: ${masterData.max_devices}, Expira: Nunca)`);
    }

    console.log('\n¡Proceso finalizado!\n');
}

main();
