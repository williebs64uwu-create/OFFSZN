
import { supabase } from './src/infrastructure/database/connection.js';

async function listDonde() {
    console.log("--- SEARCHING FOR 'Donde' ---");
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, price_basic, licenses, producer_id, r2_version, audio_url')
        .ilike('name', '%Donde%');
    
    if (error) {
        console.error("Search error:", error);
    } else {
        console.log(JSON.stringify(products, null, 2));
    }
}

listDonde();
