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

function generateSerialKey(prefix) {
    const p1 = crypto.randomBytes(4).toString('hex').toUpperCase();
    const p2 = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}-FULL-${p1}-${p2}`;
}

async function createLicense(pluginName, prefix) {
    const serialKey = generateSerialKey(prefix);
    const { data, error } = await supabase
        .from('plugin_licenses')
        .insert({
            plugin_name: pluginName,
            serial_key: serialKey,
            license_type: 'lifetime',
            status: 'active',
            expires_at: null,
            max_devices: 3
        })
        .select('id, serial_key, plugin_name, license_type, status, max_devices, created_at')
        .single();

    if (error) {
        throw new Error(`Error insertando ${pluginName} (${serialKey}): ${error.message}`);
    }
    return data;
}

async function run() {
    try {
        const plugins = [
            { name: 'Easy Mix', prefix: 'EASY', count: 4 },
            { name: 'Easy Master', prefix: 'MASTER', count: 4 },
            { name: 'Inka Kola', prefix: 'INKA', count: 4 },
            { name: 'Coca-Cola', prefix: 'COKE', count: 4 }
        ];

        const results = {};

        for (const p of plugins) {
            results[p.name] = [];
            for (let i = 0; i < p.count; i++) {
                const lic = await createLicense(p.name, p.prefix);
                results[p.name].push(lic.serial_key);
            }
        }

        console.log(JSON.stringify(results, null, 2));
    } catch (e) {
        console.error('❌ Error generando licencias:', e);
        process.exit(1);
    }
}

run();
