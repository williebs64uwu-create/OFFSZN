
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkPallooou() {
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, nickname')
        .eq('nickname', 'pallooou')
        .single();
    
    if (userError || !user) {
        console.error('User not found');
        return;
    }

    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, image_url, r2_version')
        .eq('producer_id', user.id);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Products for ${user.nickname}:`);
    products.forEach(p => {
        console.log(`[${p.id}] ${p.name} - Version: ${p.r2_version} - URL: ${p.image_url}`);
    });
}

checkPallooou();
