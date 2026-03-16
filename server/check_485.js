
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkSpecificProduct() {
    const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', 485)
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('--- Product 485 Full Data ---');
    console.log(`Name: ${product.name}`);
    console.log(`Image URL: ${product.image_url}`);
    console.log(`R2 Version: ${product.r2_version}`);
}

checkSpecificProduct();
