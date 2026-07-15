import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    const key = 'EASY-FULL-C29581FA-8E55549C';
    console.log(`Updating license key: ${key}...`);

    // 1. Fetch current details
    const { data: license, error: fetchErr } = await supabase
        .from('plugin_licenses')
        .select('id, max_devices')
        .eq('serial_key', key)
        .maybeSingle();

    if (fetchErr) {
        console.error('❌ Error fetching license:', fetchErr);
        process.exit(1);
    }

    if (!license) {
        console.error('❌ License key not found.');
        process.exit(1);
    }

    const currentMax = license.max_devices || 1;
    const newMax = currentMax + 1;

    console.log(`Current max_devices: ${currentMax}`);
    console.log(`Updating max_devices to: ${newMax}...`);

    // 2. Update max_devices
    const { data: updated, error: updateErr } = await supabase
        .from('plugin_licenses')
        .update({ max_devices: newMax })
        .eq('id', license.id)
        .select('*')
        .single();

    if (updateErr) {
        console.error('❌ Error updating license:', updateErr);
        process.exit(1);
    }

    console.log('\n====================================');
    console.log('       LICENSE UPDATED SUCCESSFULLY ');
    console.log('====================================');
    console.log(`Serial Key:   ${updated.serial_key}`);
    console.log(`New Max:      ${updated.max_devices}`);
    console.log('====================================');
}

main().catch(err => {
    console.error('Unhandled error:', err);
});
