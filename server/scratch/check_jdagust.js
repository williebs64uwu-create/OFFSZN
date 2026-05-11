import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkUser() {
    console.log("Checking user jdagust...");
    
    // Check by nickname
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('nickname', 'jdagust')
        .single();
    
    if (error) {
        console.error("Error fetching user by nickname:", error.message);
        
        // Try by ID
        console.log("Trying by ID 91dbeab3-deae-443c-b5c9-af14448884dc...");
        const { data: userById, error: errorId } = await supabase
            .from('users')
            .select('*')
            .eq('id', '91dbeab3-deae-443c-b5c9-af14448884dc')
            .single();
            
        if (errorId) {
            console.error("Error fetching user by ID:", errorId.message);
            return;
        }
        processUser(userById);
    } else {
        processUser(user);
    }
}

async function processUser(user) {
    console.log("\n--- User Info ---");
    console.log(`ID: ${user.id}`);
    console.log(`Nickname: ${user.nickname}`);
    console.log(`Email: ${user.email}`);
    console.log(`Plan Status (from user table): ${user.plan || 'N/A'}`);
    
    // Check subscription
    console.log("\n--- Subscription Info ---");
    const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
    if (subError) {
        console.error("Error fetching subscriptions:", subError.message);
    } else if (sub && sub.length > 0) {
        sub.forEach((s, i) => {
            console.log(`Sub ${i+1}: status=${s.status}, plan_id=${s.plan_id}, current_period_end=${s.current_period_end}, provider=${s.provider}`);
        });
    } else {
        console.log("No subscriptions found.");
    }
}

checkUser();
