import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkFreeDownload() {
    const ids = [779, 780, 781];
    
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, is_free, free_download_type')
        .in('id', ids);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Free download status for la7beatz beats:");
    products.forEach(p => {
        console.log(`- ID: ${p.id} | Name: "${p.name}" | is_free: ${p.is_free} | free_download_type: ${p.free_download_type}`);
    });
}

checkFreeDownload();
