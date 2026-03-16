
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkOtherProducers() {
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, image_url, r2_version, profiles(username)')
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    products.forEach(p => {
        console.log(`[${p.id}] ${p.profiles?.username || 'Unknown'}: ${p.name} - Version: ${p.r2_version} - URL: ${p.image_url?.substring(0, 50)}...`);
    });
}

checkOtherProducers();
