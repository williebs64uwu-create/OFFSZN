import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';
import crypto from 'crypto';

async function main() {
    // Generate key in the standard format: EASY-FULL-XXXX-XXXX
    const serialKey = `EASY-FULL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    const { data: newLic, error } = await supabase
        .from('plugin_licenses')
        .insert({
            serial_key: serialKey,
            license_type: 'lifetime',
            status: 'active',
            expires_at: null, // lifetime
            max_devices: 1, // single-use device limit
            plugin_name: 'Easy Mix',
            user_id: null // Unlinked so it can be given to anyone
        })
        .select('serial_key, max_devices')
        .single();

    if (error) {
        console.error('❌ Error creating license key:', error);
        process.exit(1);
    }

    console.log(`\n🔑 SUCCESS! Created new Easy Mix Lifetime license key:`);
    console.log(`👉 Serial Key: ${newLic.serial_key}`);
    console.log(`👉 Max Devices: ${newLic.max_devices}`);
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
