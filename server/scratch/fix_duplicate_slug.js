import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixSlug() {
    console.log("Renaming public_slug for older duplicate product (ID: 823)...");
    
    const { data, error } = await supabase
        .from('products')
        .update({ public_slug: 'trust-who-drumless-823' })
        .eq('id', 823)
        .select();

    if (error) {
        console.error("Error updating slug:", error);
    } else {
        console.log("Success! Updated product:", data);
    }
}

fixSlug();
