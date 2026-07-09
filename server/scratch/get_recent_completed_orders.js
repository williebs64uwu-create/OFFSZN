import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('Querying recent completed orders...');
    const { data: orders, error } = await supabase
        .from('orders')
        .select(`
            id,
            created_at,
            amount,
            total_price,
            status,
            guest_email,
            user_id,
            product_id,
            transaction_id
        `)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error(error);
        process.exit(1);
    }

    console.log(`\n=== RECENT COMPLETED ORDERS (Total: ${orders.length}) ===`);
    for (const order of orders) {
        // Fetch user email if user_id exists
        let email = order.guest_email || 'N/A';
        let nickname = 'N/A';
        if (order.user_id) {
            const { data: u } = await supabase.from('users').select('email, nickname').eq('id', order.user_id).single();
            if (u) {
                email = u.email;
                nickname = u.nickname;
            }
        }

        // Fetch product name
        let productName = 'N/A';
        if (order.product_id) {
            const { data: p } = await supabase.from('products').select('name').eq('id', order.product_id).single();
            if (p) {
                productName = p.name;
            }
        }

        // We are interested in Easy Mix, which could be an order with a particular amount (e.g. $10 or $20) or referencing it
        console.log(`- Order #${order.id} | Date: ${order.created_at} | Amount: $${order.amount || order.total_price} | User: ${nickname} (${email}) | Product: ${productName} | Tx: ${order.transaction_id}`);
    }
    process.exit(0);
}
main();
