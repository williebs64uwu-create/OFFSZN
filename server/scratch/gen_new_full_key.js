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

createKey()
    .then(key => {
        console.log('═══════════════════════════════════════════');
        console.log('  NUEVA LICENCIA FULL GENERADA');
        console.log('═══════════════════════════════════════════');
        console.log(`  Serial: ${key}`);
        console.log('  Tipo: Lifetime | Max devices: 1 | Plugin: Easy Mix');
        console.log('═══════════════════════════════════════════');
    })
    .catch(console.error);
