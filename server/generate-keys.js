import 'dotenv/config';
import { supabase } from './src/infrastructure/database/connection.js';

async function generateKeys() {
    // 1. Insert new trial key
    const { data: d1, error: e1 } = await supabase.from('plugin_licenses').insert({
        serial_key: 'TRIAL-NEWTRIAL123',
        license_type: 'trial',
        status: 'active',
        max_devices: 1,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days
    });

    if (e1) console.error("Error creating trial:", e1);
    else console.log("Trial key created: TRIAL-NEWTRIAL123");

    // 2. Insert new full key
    const { data: d2, error: e2 } = await supabase.from('plugin_licenses').insert({
        serial_key: 'EASY-FULL-1234567',
        license_type: 'lifetime',
        status: 'active',
        max_devices: 2,
        expires_at: null
    });

    if (e2) console.error("Error creating full key:", e2);
    else console.log("Full key created: EASY-FULL-1234567");

    process.exit(0);
}

generateKeys();
