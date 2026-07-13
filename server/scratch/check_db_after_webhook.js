import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
    const txId = '7JF12778BE116424H';
    const email = 'liricasvagas@gmail.com';

    console.log('1. Checking orders table...');
    const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('transaction_id', txId)
        .maybeSingle();

    if (orderErr) console.error('Order query error:', orderErr);
    console.log('Order Record:', order);

    console.log('\n2. Checking plugin_licenses table...');
    const { data: license, error: licErr } = await supabase
        .from('plugin_licenses')
        .select('*')
        .eq('plugin_name', 'Easy Mix')
        // Find by serial prefix since we don't have transaction_id in this table
        .ilike('serial_key', 'EASY-FULL-%')
        .order('created_at', { ascending: false })
        .limit(1);

    if (licErr) console.error('License query error:', licErr);
    console.log('Latest Easy Mix License Record:', license);
}

main();
