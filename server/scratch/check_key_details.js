import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    const key = 'EASY-FULL-C29581FA-8E55549C';
    console.log(`🔍 Checking details for license key: ${key}...`);

    // 1. Fetch license
    const { data: license, error: licErr } = await supabase
        .from('plugin_licenses')
        .select(`
            id,
            plugin_name,
            serial_key,
            license_type,
            status,
            max_devices,
            expires_at,
            user_id,
            users (
                email,
                nickname
            )
        `)
        .eq('serial_key', key)
        .maybeSingle();

    if (licErr) {
        console.error('❌ Error fetching license:', licErr);
        process.exit(1);
    }

    if (!license) {
        console.error('❌ License key not found in database.');
        process.exit(1);
    }

    // 2. Fetch activations
    const { data: activations, error: actErr } = await supabase
        .from('plugin_activations')
        .select('*')
        .eq('license_id', license.id);

    if (actErr) {
        console.error('❌ Error fetching activations:', actErr);
        process.exit(1);
    }

    console.log('\n====================================');
    console.log('         LICENSE DETAILS            ');
    console.log('====================================');
    console.log(`Plugin:       ${license.plugin_name}`);
    console.log(`Serial Key:   ${license.serial_key}`);
    console.log(`Type:         ${license.license_type}`);
    console.log(`Status:       ${license.status}`);
    console.log(`User ID:      ${license.user_id || 'N/A'}`);
    console.log(`User Email:   ${license.users?.email || 'N/A'}`);
    console.log(`User Nick:    ${license.users?.nickname || 'N/A'}`);
    console.log(`Expires At:   ${license.expires_at || 'Never'}`);
    console.log(`Max Devices:  ${license.max_devices || 1}`);

    console.log('\n====================================');
    console.log('       CURRENT ACTIVATIONS          ');
    console.log('====================================');
    console.log(`Count:        ${activations.length} active device(s)`);
    if (activations.length > 0) {
        activations.forEach((act, idx) => {
            console.log(`[${idx + 1}] Device Name:  ${act.device_name}`);
            console.log(`    HWID:         ${act.hwid}`);
            console.log(`    Activated At: ${act.created_at || act.activated_at || 'N/A'}`);
        });
    } else {
        console.log('No active devices registered yet.');
    }

    const max = license.max_devices || 1;
    const remaining = max - activations.length;
    console.log('\n====================================');
    console.log(`👉 Remaining attempts/slots: ${remaining > 0 ? remaining : 0}`);
    console.log('====================================');
}

main().catch(err => {
    console.error('Unhandled error:', err);
});
