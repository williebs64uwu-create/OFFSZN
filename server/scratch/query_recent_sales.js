import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getRecentSales() {
    console.log("Fetching orders from the last 3 days...");
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
        .from('orders')
        .select(`
            id,
            created_at,
            amount,
            total_price,
            status,
            guest_email,
            producer_id,
            product_id,
            transaction_id
        `)
        .gte('created_at', threeDaysAgo)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }

    console.log(`Found ${data.length} orders:`);
    for (const order of data) {
        // Fetch product and producer info to see if we can identify it
        let product = null;
        if (order.product_id) {
            const { data: prodData } = await supabase
                .from('products')
                .select('name, price_basic, price_premium, price_unlimited')
                .eq('id', order.product_id)
                .single();
            product = prodData;
        }

        let producer = null;
        if (order.producer_id) {
            const { data: prodUser } = await supabase
                .from('users')
                .select('nickname, email')
                .eq('id', order.producer_id)
                .single();
            producer = prodUser;
        }

        console.log(`\n----------------------------------------`);
        console.log(`Order ID:       ${order.id}`);
        console.log(`Created At:     ${order.created_at}`);
        console.log(`Amount:         $${order.amount}`);
        console.log(`Total Price:    $${order.total_price}`);
        console.log(`Status:         ${order.status}`);
        console.log(`Guest Email:    ${order.guest_email}`);
        console.log(`Transaction ID: ${order.transaction_id}`);
        if (product) {
            console.log(`Product:        ${product.name} (Basic: $${product.price_basic}, Premium: $${product.price_premium})`);
        } else {
            console.log(`Product ID:     ${order.product_id}`);
        }
        if (producer) {
            console.log(`Producer:       ${producer.nickname} (${producer.email})`);
        } else {
            console.log(`Producer ID:    ${order.producer_id}`);
        }
    }
}

getRecentSales();
