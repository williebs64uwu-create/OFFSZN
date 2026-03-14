import { supabase } from './src/infrastructure/database/connection.js';

async function checkProduct() {
    const key = 'products/covers/5649b865-d447-4d4a-9208-171b0ef29603/1773515625045_cover.jpg';
    console.log('Searching for product with image_url containing:', key);
    
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, image_url, r2_version')
        .ilike('image_url', `%${key}%`);

    if (error) {
        console.error('❌ Supabase Error:', error.message);
        return;
    }

    if (products.length === 0) {
        console.log('No product found with that image_url. Trying to search by ID...');
        const productId = '5649b865-d447-4d4a-9208-171b0ef29603';
        const { data: pById, error: e2 } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId);
            
        if (e2) console.error(e2);
        else console.log('Products by ID:', JSON.stringify(pById, null, 2));
    } else {
        console.log('Product(s) found:', JSON.stringify(products, null, 2));
    }
}

checkProduct();
