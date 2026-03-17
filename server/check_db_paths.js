
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkPaths() {
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('nickname', 'koimattoru')
        .single();
        
    const { data: products } = await supabase
        .from('products')
        .select('id, name, image_url, audio_url')
        .eq('producer_id', user.id);

    console.log(`Checking ${products.length} products for koimattoru (ID: ${user.id})`);
    
    for (const p of products) {
        console.log(`[${p.id}] ${p.name}`);
        console.log(`  IMG: ${p.image_url}`);
        console.log(`  AUDIO: ${p.audio_url}`);
    }
}

checkPaths().catch(console.error);
