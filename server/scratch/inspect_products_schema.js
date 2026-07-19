import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching schema sample:', error);
        process.exit(1);
    }

    if (data && data.length > 0) {
        console.log('Sample product keys and values:');
        console.log(JSON.stringify(data[0], null, 2));
    } else {
        console.log('No products found to inspect.');
    }
}
main();
