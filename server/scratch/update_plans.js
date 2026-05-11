import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updatePlans() {
    console.log("Updating plans...");
    
    // 1. Give starter to prodbypurple
    const { error: error1 } = await supabase
        .from('users')
        .update({ plan: 'starter' })
        .eq('id', '14fe9f36-65d7-4970-a9d2-c14f077638a6');
        
    if (error1) console.error("Error updating prodbypurple:", error1.message);
    else console.log("prodbypurple updated to starter.");

    // 2. Ensure jdagust is free (it should be already or expiring)
    // The previous check showed jdagust had plan 'starter' in user table but sub expired.
    // I'll set his plan to 'free' in the user table too.
    const { error: error2 } = await supabase
        .from('users')
        .update({ plan: 'free' })
        .eq('id', '91dbeab3-deae-443c-b5c9-af14448884dc');
        
    if (error2) console.error("Error updating jdagust:", error2.message);
    else console.log("jdagust updated to free.");
}

updatePlans();
