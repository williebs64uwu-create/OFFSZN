import { supabase } from './src/infrastructure/database/connection.js';

async function listProducts() {
    try {
        console.log('Listing some products to find the right one...');
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, price_basic, mp3_url, user_id, licenses')
            .eq('visibility', 'public')
            .limit(10);

        if (error) {
            console.error('❌ Supabase Error:', error.message);
            return;
        }

        console.log('--- PRODUCTS (Last 10) ---');
        products.forEach(p => {
            console.log(`[${p.id}] ${p.name} - Price: ${p.price_basic}`);
        });

        const { data: searchDonde } = await supabase
            .from('products')
            .select('id, name, price_basic, mp3_url, licenses, user_id')
            .ilike('name', '%Donde%');
        
        console.log('\n--- SEARCH "Donde" RESULTS ---');
        console.log(JSON.stringify(searchDonde, null, 2));

    } catch (e) {
        console.error(e);
    }
}
listProducts();
