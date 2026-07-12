import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function createKey() {
    const serial = `EASY-FULL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const { data, error } = await supabase
        .from('plugin_licenses')
        .insert({
            serial_key: serial,
            license_type: 'lifetime',
            status: 'active',
            expires_at: null,
            max_devices: 1,
            plugin_name: 'Easy Mix'
        })
        .select('*').single();
    if (error) throw error;
    return serial;
}

const key1 = await createKey();
const key2 = await createKey();

console.log('═══════════════════════════════════════════');
console.log('  2 NUEVAS LICENCIAS FULL GENERADAS');
console.log('═══════════════════════════════════════════');
console.log(`  1) ${key1}`);
console.log(`  2) ${key2}`);
console.log('');
console.log('  Tipo: Lifetime | Max devices: 1 | Plugin: Easy Mix');
console.log('═══════════════════════════════════════════');
