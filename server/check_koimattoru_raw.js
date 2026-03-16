
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkKoimattoruRaw() {
    const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('nickname', 'koimattoru')
        .single();

    if (user) {
        console.log('--- USER: koimattoru ---');
        console.log('ID:', user.id);
        
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('producer_id', user.id); // It might be producer_id instead of author_id

        if (error) console.error(error);
        if (products && products.length > 0) {
            console.log('\n--- PRODUCTS ---');
            products.forEach(p => {
                console.log(`[${p.id}] ${p.name}`);
                console.log('  Image URL:', p.image_url);
                console.log('  Audio URL:', p.audio_url);
                console.log('  R2 Version:', p.r2_version);
            });
        } else {
            console.log("No products found for this user using producer_id.");
            
            const { data: products2, error2 } = await supabase
                .from('products')
                .select('*')
                .eq('author_id', user.id);
            if (products2 && products2.length > 0) {
                 products2.forEach(p => {
                    console.log(`[${p.id}] ${p.name}`);
                    console.log('  Image URL:', p.image_url);
                    console.log('  R2 Version:', p.r2_version);
                 });
            } else {
                 console.log("No products found using author_id either.");
            }
        }
    }
}

checkKoimattoruRaw();
