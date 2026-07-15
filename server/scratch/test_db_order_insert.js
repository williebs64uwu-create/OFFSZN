import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    const tempTxId = 'TEMP_TEST_TX_' + Date.now();
    console.log(`Testing orders table insert with transaction_id: ${tempTxId}...`);

    try {
        const { data: newOrder, error: orderError } = await supabase
            .from('orders')
            .insert({
                user_id: null,
                transaction_id: tempTxId,
                status: 'completed',
                total_price: 5.00,
                amount: 5.00,
                guest_email: 'test_purchaser@example.com'
            })
            .select()
            .single();

        if (orderError) {
            console.error('❌ Insert failed:', orderError);
        } else {
            console.log('✅ Insert succeeded! Order record created:', newOrder);

            // Now clean up
            const { error: delErr } = await supabase
                .from('orders')
                .delete()
                .eq('id', newOrder.id);

            if (delErr) {
                console.error('❌ Clean up failed:', delErr);
            } else {
                console.log('✅ Clean up succeeded (test order deleted).');
            }
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

main();
