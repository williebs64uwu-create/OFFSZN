import { supabase } from './src/infrastructure/database/connection.js';

async function listProducts() {
    try {
        console.log('Listing products with correct columns...');
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .ilike('name', '%Donde%')
            .limit(5);

        if (error) {
            console.error('❌ Supabase Error:', error.message);
            return;
        }

        console.log('--- PRODUCT DATA ---');
        console.log(JSON.stringify(products, null, 2));

    } catch (e) {
        console.error(e);
    }
}
listProducts();
