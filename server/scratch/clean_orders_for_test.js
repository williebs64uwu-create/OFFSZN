import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
    const txId = '7JF12778BE116424H';
    
    // Check if order exists
    const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('transaction_id', txId)
        .maybeSingle();
        
    if (order) {
        console.log(`Order found for transaction ${txId}:`, order);
        console.log('Deleting order for clean test...');
        const { error: delError } = await supabase
            .from('orders')
            .delete()
            .eq('transaction_id', txId);
        if (delError) {
            console.error('Failed to delete order:', delError);
        } else {
            console.log('Order deleted successfully.');
        }
    } else {
        console.log(`No order found for transaction ${txId}. Clean slate for testing.`);
    }
}

main();
