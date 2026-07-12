import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
    const { data: licenses } = await supabase
        .from('plugin_licenses')
        .select('serial_key, license_type, plugin_name')
        .eq('license_type', 'trial')
        .ilike('plugin_name', '%mix%');

    console.log('=== EASY MIX TRIAL KEYS ===');
    let nonStandard = [];
    licenses.forEach(l => {
        const key = l.serial_key.toUpperCase();
        if (!key.includes('TRIAL-')) {
            nonStandard.push(l);
        }
    });

    if (nonStandard.length > 0) {
        console.log(`Found ${nonStandard.length} non-standard trial keys:`);
        nonStandard.forEach(l => {
            console.log(`- ${l.serial_key} (${l.plugin_name})`);
        });
    } else {
        console.log('All trial keys contain "TRIAL-". The JS check using .indexOf("TRIAL-") !== -1 is 100% safe and covers all of them.');
    }
}

main().catch(console.error);
