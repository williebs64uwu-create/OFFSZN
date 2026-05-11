import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkProducts() {
    const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('producer_id', '14fe9f36-65d7-4970-a9d2-c14f077638a6');
    
    if (error) {
        console.error("Error:", error.message);
        return;
    }
    console.log(`Products count: ${count}`);
}

checkProducts();
