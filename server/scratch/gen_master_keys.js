import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function createMasterKeys() {
    // 1. Trial Key for Easy Master
    const trialSerial = `MASTER-TRIAL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3); // 3 days

    await supabase.from('plugin_licenses').insert({
        serial_key: trialSerial,
        license_type: 'trial',
        status: 'active',
        expires_at: expiresAt.toISOString(),
        max_devices: 3,
        plugin_name: 'Easy Master'
    });

    // 2. Full Key for Easy Master
    const fullSerial = `MASTER-FULL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    await supabase.from('plugin_licenses').insert({
        serial_key: fullSerial,
        license_type: 'lifetime',
        status: 'active',
        expires_at: null,
        max_devices: 3,
        plugin_name: 'Easy Master'
    });

    return { trialSerial, fullSerial, expiresAt };
}

createMasterKeys().then(({ trialSerial, fullSerial, expiresAt }) => {
    console.log("=== EASY MASTER KEYS GENERATED ===");
    console.log(`TRIAL Serial: ${trialSerial} (Expires: ${expiresAt.toLocaleString()})`);
    console.log(`FULL Serial:  ${fullSerial}`);
    console.log("=================================");
}).catch(console.error);
