import { supabase } from '../src/infrastructure/database/connection.js';

async function listTrials() {
    console.log('Querying plugin_licenses for trials...');
    const { data: licenses, error } = await supabase
        .from('plugin_licenses')
        .select(`
            id,
            plugin_name,
            serial_key,
            license_type,
            status,
            expires_at,
            created_at,
            user_id,
            users (
                email,
                nickname
            )
        `);

    if (error) {
        console.error('Error fetching licenses:', error);
        process.exit(1);
    }

    console.log(`Total licenses retrieved: ${licenses?.length || 0}`);
    const now = new Date();

    const easyMixTrials = licenses.filter(lic => {
        const isEasyMix = lic.plugin_name?.toLowerCase().includes('mix');
        const isTrial = lic.license_type === 'trial';
        const isNotExpired = lic.expires_at ? new Date(lic.expires_at) > now : true;
        const isActive = lic.status === 'active';
        return isEasyMix && isTrial && isNotExpired && isActive;
    });

    console.log(`\n--- Active trials for EASY MIX (Total: ${easyMixTrials.length}) ---`);
    easyMixTrials.forEach((lic, index) => {
        console.log(`\n[${index + 1}] User ID: ${lic.user_id}`);
        console.log(`    User Nickname: ${lic.users?.nickname || 'N/A'}`);
        console.log(`    User Email: ${lic.users?.email || 'N/A'}`);
        console.log(`    Plugin Name: ${lic.plugin_name}`);
        console.log(`    Serial Key: ${lic.serial_key}`);
        console.log(`    Expires At: ${lic.expires_at}`);
        console.log(`    Status: ${lic.status}`);
    });
    process.exit(0);
}

listTrials();
