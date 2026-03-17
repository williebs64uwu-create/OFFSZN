
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkSpecificProducts() {
    console.log('Checking problematic products...');
    const ids = [91, 87, 96, 127];
    const { data, error } = await supabase
        .from('products')
        .select('id, image_url, audio_url, r2_version, name')
        .in('id', ids);
    
    if (error) { 
        console.error('Supabase Error:', error); 
        return; 
    }
    
    if (!data || data.length === 0) {
        console.log('No products found with these IDs.');
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
    process.exit(0);
}

checkSpecificProducts().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
