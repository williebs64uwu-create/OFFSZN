import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function generatePayhipBatch() {
    const count = parseInt(process.argv[2] || '10', 10);
    const maxDevices = parseInt(process.argv[3] || '3', 10); // 3 devices per lifetime key

    console.log(`\n🔑 Generando ${count} licencias LIFETIME para Easy Master en Supabase...\n`);

    const generatedKeys = [];

    for (let i = 0; i < count; i++) {
        const serialKey = `MASTER-FULL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const { data, error } = await supabase
            .from('plugin_licenses')
            .insert({
                plugin_name: 'Easy Master',
                serial_key: serialKey,
                license_type: 'lifetime',
                status: 'active',
                expires_at: null,
                max_devices: maxDevices
            })
            .select('serial_key')
            .single();

        if (error) {
            console.error(`❌ Error al crear la clave #${i + 1}:`, error.message);
        } else {
            generatedKeys.push(data.serial_key);
        }
    }

    console.log(`=======================================================`);
    console.log(`COPIA Y PEGA ESTAS ${generatedKeys.length} CLAVES EN PAYHIP:`);
    console.log(`=======================================================\n`);
    generatedKeys.forEach(key => console.log(key));
    console.log(`\n=======================================================\n`);
}

generatePayhipBatch();
