import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

const MODE = process.argv[2] || 'dry-run'; // 'dry-run' or 'execute'

async function main() {
    console.log(`🚀 Starting trial extension script in [${MODE.toUpperCase()}] mode...`);
    
    // July 10, 2026 in UTC-5 (User's timezone offset)
    // Starts at 2026-07-10T05:00:00Z (which is 00:00:00 local time)
    // Ends at 2026-07-11T05:00:00Z (which is 24:00:00 local time)
    const localStart = '2026-07-10T05:00:00.000Z';
    const localEnd = '2026-07-11T05:00:00.000Z';

    console.log(`Filtering users registered between ${localStart} and ${localEnd}...`);

    // Fetch users created today
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, email, nickname, created_at')
        .gte('created_at', localStart)
        .lt('created_at', localEnd);

    if (userError) {
        console.error('❌ Error fetching users:', userError);
        process.exit(1);
    }

    console.log(`👤 Found ${users.length} users registered on July 10.`);
    if (users.length === 0) {
        console.log('✅ No users registered today.');
        process.exit(0);
    }

    const userIds = users.map(u => u.id);

    // Fetch trial licenses belonging to these users
    const { data: licenses, error: licError } = await supabase
        .from('plugin_licenses')
        .select('id, serial_key, expires_at, created_at, user_id, plugin_name')
        .eq('license_type', 'trial')
        .in('user_id', userIds);

    if (licError) {
        console.error('❌ Error fetching licenses:', licError);
        process.exit(1);
    }

    const easyMixLicenses = licenses.filter(lic => 
        lic.plugin_name?.toLowerCase().includes('mix')
    );

    console.log(`🔑 Found ${easyMixLicenses.length} Easy Mix trial licenses matching these users.`);
    if (easyMixLicenses.length === 0) {
        console.log('✅ No Easy Mix trial licenses to extend.');
        process.exit(0);
    }

    console.log('\n--- TARGET LICENSES ---');
    for (const lic of easyMixLicenses) {
        const user = users.find(u => u.id === lic.user_id);
        const currentExpiry = new Date(lic.expires_at);
        // Add 2 days (48 hours)
        const newExpiry = new Date(currentExpiry.getTime() + 2 * 24 * 60 * 60 * 1000);
        
        console.log(`User: ${user?.nickname || 'N/A'} (${user?.email})`);
        console.log(`  Key: ${lic.serial_key}`);
        console.log(`  Current Expiry: ${currentExpiry.toISOString()}`);
        console.log(`  New Expiry:     ${newExpiry.toISOString()}`);
        
        if (MODE === 'execute') {
            const { error: updateErr } = await supabase
                .from('plugin_licenses')
                .update({ expires_at: newExpiry.toISOString() })
                .eq('id', lic.id);

            if (updateErr) {
                console.error(`  ❌ Error updating license ${lic.serial_key}:`, updateErr.message);
            } else {
                console.log(`  ✅ Successfully extended!`);
            }
        }
    }

    if (MODE === 'dry-run') {
        console.log('\n💡 To apply these changes, run: node server/scratch/extend_trials_july10.js execute');
    } else {
        console.log('\n🎉 Finished updating matching licenses!');
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
