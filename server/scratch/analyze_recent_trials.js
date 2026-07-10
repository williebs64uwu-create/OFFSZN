import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('Querying trials generated in the last 48 hours...');
    
    // Calculate timestamp for 48 hours ago
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    // Fetch licenses created in the last 48 hours
    const { data: licenses, error: licError } = await supabase
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
        `)
        .eq('license_type', 'trial')
        .gte('created_at', fortyEightHoursAgo)
        .order('created_at', { ascending: false });

    if (licError) {
        console.error('Error fetching licenses:', licError);
        process.exit(1);
    }

    const easyMixLicenses = licenses.filter(lic => 
        lic.plugin_name?.toLowerCase().includes('mix')
    );

    console.log(`\n=== EASY MIX TRIALS CREATED IN THE LAST 48 HOURS (Total: ${easyMixLicenses.length}) ===`);

    const unusedTrials = [];
    const usedTrials = [];

    for (const lic of easyMixLicenses) {
        // Check if there are activations for this license
        const { data: activations, error: actError } = await supabase
            .from('plugin_activations')
            .select('id, hwid, device_name, activated_at')
            .eq('license_id', lic.id);

        if (actError) {
            console.error(`Error checking activations for license ${lic.id}:`, actError);
            continue;
        }

        const isUsed = activations && activations.length > 0;
        const record = {
            id: lic.id,
            nickname: lic.users?.nickname || 'N/A',
            email: lic.users?.email || 'N/A',
            serialKey: lic.serial_key,
            createdAt: lic.created_at,
            expiresAt: lic.expires_at,
            status: lic.status,
            activations: activations || []
        };

        if (isUsed) {
            usedTrials.push(record);
        } else {
            unusedTrials.push(record);
        }
    }

    console.log(`\n💡 Unused Trials (Serial key generated but not activated on any DAW): ${unusedTrials.length}`);
    unusedTrials.forEach((t, i) => {
        console.log(`[${i+1}] Nickname: ${t.nickname} | Email: ${t.email}`);
        console.log(`    Key: ${t.serialKey} | Created: ${t.createdAt}`);
    });

    console.log(`\n✅ Activated Trials (Already activated on DAW): ${usedTrials.length}`);
    usedTrials.forEach((t, i) => {
        console.log(`[${i+1}] Nickname: ${t.nickname} | Email: ${t.email}`);
        console.log(`    Key: ${t.serialKey} | Activated: ${t.activations[0]?.activated_at} on ${t.activations[0]?.device_name || 'unknown device'}`);
    });

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
