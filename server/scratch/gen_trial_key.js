import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function createTrialKey() {
    const serial = `EASY-TRIAL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Expires in exactly 24 hours (1 day)

    const { data, error } = await supabase
        .from('plugin_licenses')
        .insert({
            serial_key: serial,
            license_type: 'trial',
            status: 'active',
            expires_at: expiresAt.toISOString(),
            max_devices: 1,
            plugin_name: 'Easy Mix'
        })
        .select('*').single();
        
    if (error) throw error;
    return { serial, expiresAt };
}

createTrialKey()
    .then(({ serial, expiresAt }) => {
        console.log('═══════════════════════════════════════════');
        console.log('  NUEVA LICENCIA TRIAL GENERADA');
        console.log('═══════════════════════════════════════════');
        console.log(`  Serial:     ${serial}`);
        console.log(`  Tipo:       Trial (Prueba 24 Horas)`);
        console.log(`  Expiración: ${expiresAt.toLocaleString()}`);
        console.log(`  Max Devs:   1`);
        console.log('═══════════════════════════════════════════');
    })
    .catch(console.error);
