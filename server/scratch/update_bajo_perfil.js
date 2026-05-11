import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updatePlan() {
    const { error } = await supabase
        .from('users')
        .update({ plan: 'starter' })
        .eq('id', 'c6d82b6d-4e1e-4064-9782-291d854311d5');
        
    if (error) console.error("Error:", error.message);
    else console.log("bajo perfil updated to starter.");
}

updatePlan();
