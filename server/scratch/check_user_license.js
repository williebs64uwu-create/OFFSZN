import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('Searching for user "traslacortinaestudio"...');
    
    // Find user by nickname or email
    const { data: users, error: userErr } = await supabase
        .from('users')
        .select('id, email, nickname, created_at')
        .or('nickname.ilike.%traslacortina%,email.ilike.%traslacortina%');

    if (userErr) {
        console.error('❌ Error finding user:', userErr);
        process.exit(1);
    }

    if (!users || users.length === 0) {
        console.log('❌ User not found in database.');
        process.exit(0);
    }

    for (const user of users) {
        console.log(`\n👤 User found: Nickname: ${user.nickname} | Email: ${user.email} | Registered: ${user.created_at}`);
        
        // Find their licenses
        const { data: licenses, error: licErr } = await supabase
            .from('plugin_licenses')
            .select('*')
            .eq('user_id', user.id);

        if (licErr) {
            console.error('❌ Error fetching licenses:', licErr);
            continue;
        }

        if (!licenses || licenses.length === 0) {
            console.log('   No licenses associated with this user.');
            continue;
        }

        console.log('   licenses:');
        for (const lic of licenses) {
            console.log(`   👉 Plugin: ${lic.plugin_name}`);
            console.log(`      Key: ${lic.serial_key}`);
            console.log(`      Type: ${lic.license_type}`);
            console.log(`      Status: ${lic.status}`);
            console.log(`      Created: ${lic.created_at}`);
            console.log(`      Expires: ${lic.expires_at || 'Never'}`);
            
            // Check activations
            const { data: acts } = await supabase
                .from('plugin_activations')
                .select('*')
                .eq('license_id', lic.id);
            
            if (acts && acts.length > 0) {
                console.log(`      Activations (Total: ${acts.length}):`);
                acts.forEach(a => console.log(`        - Device: ${a.device_name} (HWID: ${a.hwid}) at ${a.activated_at}`));
            } else {
                console.log(`      Activations: None`);
            }
        }
    }
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
