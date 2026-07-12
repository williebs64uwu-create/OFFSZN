import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const uid = 'ecf0e90d-8309-4a10-b090-f83ce45a1522';

// Check licenses
const { data: lics } = await supabase.from('plugin_licenses').select('*').eq('user_id', uid);
console.log('=== LICENCIAS de sanxgarcia (novagxv3@gmail.com) ===');
if (lics && lics.length > 0) {
    lics.forEach(l => {
        const expired = l.expires_at && new Date(l.expires_at) < new Date();
        console.log(`  Serial: ${l.serial_key}`);
        console.log(`  Type: ${l.license_type} | Status: ${l.status}`);
        console.log(`  Expires: ${l.expires_at || 'NEVER'} ${expired ? '⚠️ EXPIRED' : '✅ ACTIVE'}`);
        console.log(`  Plugin: ${l.plugin_name} | Max devices: ${l.max_devices}`);
        console.log('');
    });
} else {
    console.log('  No plugin licenses found for this user');
}

// Check orders
const { data: orders } = await supabase.from('orders').select('*').eq('user_id', uid);
console.log('\n=== ORDERS ===');
if (orders && orders.length > 0) {
    orders.forEach(o => console.log(JSON.stringify(o, null, 2)));
} else {
    console.log('  No orders found');
    // Also check guest_email
    const { data: guestOrders } = await supabase.from('orders').select('*').ilike('guest_email', '%novag%');
    if (guestOrders && guestOrders.length > 0) {
        console.log('  Found guest orders:');
        guestOrders.forEach(o => console.log(JSON.stringify(o, null, 2)));
    }
}

// Check transactions
const { data: txns } = await supabase.from('transactions').select('*').eq('user_id', uid);
console.log('\n=== TRANSACTIONS ===');
if (txns && txns.length > 0) {
    txns.forEach(t => console.log(JSON.stringify(t, null, 2)));
} else {
    console.log('  No transactions found');
}
