
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
// Point explicitly to server/.env if running from root
dotenv.config({ path: 'server/.env' });

// Config
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tu-url.supabase.co';
// Use SUPABASE_SERVICE_KEY as defined in .env
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase Credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    console.log("--- Debugging Likes for Target 72 ---");

    const { data, error } = await supabase
        .from('likes')
        .select('*')
        .eq('target_id', '72') // Explicit string to match DB text type
        .order('created_at', { ascending: true }); // See history order

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${data.length} rows.`);

    const userCounts = {};

    data.forEach(row => {
        console.log(`[${row.id}] User: ${row.user_id} | Created: ${row.created_at}`);
        userCounts[row.user_id] = (userCounts[row.user_id] || 0) + 1;
    });

    console.log("\n--- Duplicate Analysis ---");
    Object.keys(userCounts).forEach(uid => {
        if (userCounts[uid] > 1) {
            console.log(`⚠️ DUPLICATE FOUND: User ${uid} has ${userCounts[uid]} likes.`);
        }
    });

    if (data.length === Object.keys(userCounts).length) {
        console.log("✅ No duplicates found by User ID.");
    }
}

run();
