
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, 'server', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Or Service Role if needed

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase Env Vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Testing Leaderboard Query...");

    // 1. Fetch Producers with Avatars
    const { data: producers, error: userError } = await supabase
        .from('users')
        .select('id, nickname, avatar_url, is_verified')
        .eq('is_producer', true)
        .not('avatar_url', 'is', null) // Must have avatar
        .neq('avatar_url', '');      // Must not be empty string

    if (userError) {
        console.error("User Error:", userError);
        return;
    }

    console.log(`Found ${producers ? producers.length : 0} producers with avatars.`);
    if (producers && producers.length > 0) {
        console.log("Sample:", producers[0]);
    } else {
        console.log("No producers found matching criteria.");

        // Debug: Check count without filters
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_producer', true);
        console.log(`Total Producers: ${count}`);
    }
}

test();
