import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkLa7() {
    const producerId = '6f32de17-8338-4e40-bc9e-fee3ca1d0799';
    console.log(`Fetching all products for producer la7beatz (${producerId})...`);

    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('producer_id', producerId);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${products.length} products total:`);
    for (const p of products) {
        console.log(`\n- ID: ${p.id} | Name: "${p.name}" | Status: ${p.status} | Visibility: ${p.visibility}`);
        console.log(`  Slug:       ${p.public_slug}`);
        console.log(`  Price Basic: $${p.price_basic} | Premium: $${p.price_premium} | Exclusive: $${p.price_exclusive}`);
        console.log(`  Licenses Settings:`, JSON.stringify(p.licenses, null, 2));
    }
}

checkLa7();
