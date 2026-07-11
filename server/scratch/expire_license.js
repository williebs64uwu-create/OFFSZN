import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    const serialKey = 'EASY-TRIAL-F19E60FE-94105C99';
    console.log(`Expiring license key ${serialKey} in database...`);
    
    // Set expires_at to 10 days ago and status to expired
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('plugin_licenses')
        .update({
            expires_at: tenDaysAgo,
            status: 'expired'
        })
        .eq('serial_key', serialKey)
        .select('*')
        .single();

    if (error) {
        console.error('❌ Error expiring license:', error);
        process.exit(1);
    }

    console.log(`\n✅ Success! License ${serialKey} is now expired.`);
    console.log(`👉 Status: ${data.status}`);
    console.log(`👉 Expires At: ${data.expires_at}`);
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
