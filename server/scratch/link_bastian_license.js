import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    const key = 'EASY-FULL-96EC8BAA-4FD7F351';
    const userId = 'a74a0477-1524-44ca-80d1-b02b7d6e5635';
    const txId = '9SX84687JR344483S';
    const email = 'velosogonzalezb@gmail.com';

    console.log(`Syncing Bastian's account in DB...`);

    // 1. Link the manual license key to his user ID
    const { data: updatedLic, error: licErr } = await supabase
        .from('plugin_licenses')
        .update({ user_id: userId })
        .eq('serial_key', key)
        .select('*')
        .single();

    if (licErr) {
        console.error('❌ Error linking license:', licErr);
    } else {
        console.log('✅ License linked successfully:', updatedLic);
    }

    // 2. Insert the completed order record
    const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
            user_id: userId,
            transaction_id: txId,
            status: 'completed',
            total_price: 5.00,
            amount: 5.00,
            guest_email: null
        })
        .select()
        .single();

    if (orderErr) {
        console.error('❌ Error creating order record:', orderErr);
    } else {
        console.log('✅ Order record created successfully:', newOrder);
    }
}

main().catch(err => {
    console.error('Unhandled error:', err);
});
