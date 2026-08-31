import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials missing in server/.env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function generateSerialKey() {
    const p1 = crypto.randomBytes(4).toString('hex').toUpperCase();
    const p2 = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `COKE-FULL-${p1}-${p2}`;
}

async function generateCokePayhipBatch() {
    const count = parseInt(process.argv[2] || '10', 10);
    const maxDevices = parseInt(process.argv[3] || '3', 10);

    const generatedKeys = [];

    for (let i = 0; i < count; i++) {
        const serialKey = generateSerialKey();
        const { data, error } = await supabase
            .from('plugin_licenses')
            .insert({
                plugin_name: 'Coca-Cola',
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
    console.log(`COPIA Y PEGA ESTAS ${generatedKeys.length} CLAVES PARA COCA COLA EN PAYHIP:`);
    console.log(`=======================================================\n`);
    generatedKeys.forEach(key => console.log(key));
    console.log(`\n=======================================================\n`);
}

generateCokePayhipBatch();
