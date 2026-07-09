import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getOrderDetails() {
    const orderId = 1781;
    console.log(`Fetching details for Order ID: ${orderId}...`);

    // Fetch order
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (orderError) {
        console.error("Error fetching order:", orderError);
        return;
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

    // Fetch product
    let product = null;
    if (order.product_id) {
        const { data: prodData } = await supabase
            .from('products')
            .select('*')
            .eq('id', order.product_id)
            .single();
        product = prodData;
    }

    // Fetch producer user details
    let producer = null;
    if (order.producer_id) {
        const { data: prodUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', order.producer_id)
            .single();
        producer = prodUser;
    }

    console.log("\n================ ORDER ================");
    console.log(JSON.stringify(order, null, 2));

    console.log("\n================ ORDER ITEMS ================");
    console.log(JSON.stringify(items, null, 2));

    if (product) {
        console.log("\n================ PRODUCT ================");
        console.log(JSON.stringify(product, null, 2));
    }

    if (producer) {
        console.log("\n================ PRODUCER ================");
        console.log(JSON.stringify(producer, null, 2));
    }
}

getOrderDetails();
