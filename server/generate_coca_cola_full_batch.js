import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function generateCocaColaFullBatch() {
    const count = parseInt(process.argv[2] || '3', 10);
    const maxDevices = parseInt(process.argv[3] || '2', 10);

    console.log(`\n🔑 Generando ${count} licencias LIFETIME para Coca-Cola (Max dispositivos: ${maxDevices}) en Supabase...\n`);

    const licensesToInsert = [];
    for (let i = 0; i < count; i++) {
        const serialKey = `COKE-FULL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        licensesToInsert.push({
            plugin_name: 'Coca-Cola',
            serial_key: serialKey,
            license_type: 'lifetime',
            status: 'active',
            expires_at: null,
            max_devices: maxDevices
        });
    }

    const { data, error } = await supabase
        .from('plugin_licenses')
        .insert(licensesToInsert)
        .select('serial_key, max_devices, license_type, expires_at');

    if (error) {
        console.error('❌ Error al crear las licencias:', error.message);
        process.exit(1);
    }

    console.log(`=======================================================`);
    console.log(`✅ ${data.length} LICENCIAS FULL CREADAS EXITOSAMENTE (COCA-COLA):`);
    console.log(`=======================================================\n`);
    data.forEach((lic, idx) => {
        console.log(`[${idx + 1}] ${lic.serial_key}  |  Usos: ${lic.max_devices}  |  Expira: NUNCA`);
    });
    console.log(`\n=======================================================\n`);
}

generateCocaColaFullBatch();
