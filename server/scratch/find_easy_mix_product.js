import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('Querying plugins in products table...');
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .or('product_type.eq.plugin,product_type.eq.preset,name.ilike.%easy%');

    if (error) {
        console.error('Error:', error);
        process.exit(1);
    }

    console.log(`Found ${products?.length || 0} products:`);
    products?.forEach(p => {
        console.log(`- [${p.id}] Name: ${p.name} | Type: ${p.product_type} | Price: $${p.price_basic || 0}`);
    });
}
main();
