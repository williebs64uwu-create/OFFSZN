import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkPluginImages() {
    console.log('=== CHECKING EASY MIX & EASY MASTER PRODUCTS ===');
    
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .or('name.ilike.%Easy Mix%,name.ilike.%Easy Master%');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    console.log(`Found ${products.length} products:`);
    products.forEach(p => {
        console.log(`\nID: ${p.id} | Name: ${p.name}`);
        console.log(`image_url: ${p.image_url}`);
        console.log(`cover_url / other keys:`, {
            image_url: p.image_url,
            cover_url: p.cover_url,
            product_type: p.product_type
        });
    });
}

checkPluginImages();
