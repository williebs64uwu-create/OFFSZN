import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTracks() {
    const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('producer_id', 'c6d82b6d-4e1e-4064-9782-291d854311d5');
    
    if (error) {
        console.error("Error:", error.message);
        return;
    }
    console.log(`Products count: ${count}`);
}

checkTracks();
