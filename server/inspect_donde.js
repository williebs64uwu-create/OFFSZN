import { supabase } from './src/infrastructure/database/connection.js';

async function inspectProduct() {
    try {
        console.log('Searching for product: Donde...');
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .ilike('name', '%Donde%')
            .limit(1);

        if (error) {
            console.error('❌ Supabase Error:', error.message);
            return;
        }

        if (data && data.length > 0) {
            const product = data[0];
            console.log('✅ Product Found:');
            console.log(JSON.stringify(product, null, 2));
            
            // Also check the producer
            const { data: producer, error: pError } = await supabase
                .from('users')
                .select('*')
                .eq('id', product.user_id || product.producer_id);
            
            if (producer) {
                console.log('✅ Producer Metadata:');
                console.log(JSON.stringify(producer[0], null, 2));
            }
        } else {
            console.log('❌ Product not found.');
        }
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

inspectProduct();
