
import { supabase } from './src/infrastructure/database/connection.js';

async function inspect() {
    console.log("--- RAW PRODUCT DATA (ID: 172) ---");
    const { data: product, error: pError } = await supabase
        .from('products')
        .select('*')
        .eq('id', 172)
        .single();
    if (pError) {
        console.error("Product fetch error:", pError);
        return;
    }
    console.log(JSON.stringify(product, null, 2));

    if (product?.producer_id) {
        console.log("\n--- RAW PRODUCER DATA ---");
        const { data: producer, error: uError } = await supabase
            .from('users')
            .select('*')
            .eq('id', product.producer_id)
            .single();
        if (uError) console.error("Producer fetch error:", uError);
        else console.log(JSON.stringify(producer[0] || producer, null, 2));
    }
}

inspect();
