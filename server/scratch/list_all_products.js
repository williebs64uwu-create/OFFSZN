import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('Querying all products in the database...');
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, product_type');

    if (error) {
        console.error('Error:', error);
        process.exit(1);
    }

    console.log(`Total products: ${products?.length || 0}`);
    products?.forEach(p => {
        console.log(`- [${p.id}] ${p.name} (${p.product_type})`);
    });
    process.exit(0);
}
main();
