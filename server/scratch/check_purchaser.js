import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    const txId = '9SX84687JR344483S';
    const email = 'velosogonzalezb@gmail.com';

    console.log(`Checking DB records for Transaction ID: ${txId} and Email: ${email}...`);

    // 1. Check orders table
    const { data: orders, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('transaction_id', txId);

    if (orderErr) {
        console.error('❌ Error fetching orders:', orderErr);
    } else {
        console.log('\n--- ORDERS FOUND ---');
        console.log(orders);
    }

    // 2. Check plugin_licenses table for the email or serials associated
    const { data: licenses, error: licErr } = await supabase
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
        .or(`user_id.eq.null,users.email.eq.${email}`);

    // Wait, let's just query by email or do a broad search
    const { data: allLics, error: allLicsErr } = await supabase
        .from('plugin_licenses')
        .select('*');

    if (allLicsErr) {
        console.error('❌ Error fetching plugin_licenses:', allLicsErr);
    } else {
        console.log('\n--- ALL LICENSES IN DB ---');
        // Let's filter licenses manually or print matches
        const matches = allLics.filter(l => l.serial_key.includes('EASY-FULL-96EC8BAA-4FD7F351') || (l.user_id && l.user_id.includes(email)));
        console.log(`Total licenses in DB: ${allLics.length}`);
        
        // Let's query users table to see if user exists with this email
        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (userErr) {
            console.error('❌ Error checking user:', userErr);
        } else {
            console.log('\n--- USER RECORD ---');
            console.log(user);

            if (user) {
                const userLics = allLics.filter(l => l.user_id === user.id);
                console.log('\n--- LICENSES FOR THIS USER ---');
                console.log(userLics);
            }
        }
    }
}

main().catch(err => {
    console.error('Unhandled error:', err);
});
