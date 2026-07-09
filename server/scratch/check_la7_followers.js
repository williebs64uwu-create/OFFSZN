import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkFollowers() {
    const producerId = '6f32de17-8338-4e40-bc9e-fee3ca1d0799';
    console.log(`Checking followers for producer la7beatz (${producerId})...`);

    const { data: followers, error: folErr } = await supabase
        .from('followers')
        .select(`
            follower_id,
            created_at
        `)
        .eq('user_id', producerId)
        .order('created_at', { ascending: false });

    if (folErr) {
        console.error("Error getting followers:", folErr.message);
        return;
    }

    console.log(`\nFollowers Count: ${followers?.length || 0}`);
    for (const f of followers || []) {
        // Fetch the user details of the follower
        const { data: user } = await supabase
            .from('users')
            .select('nickname, email')
            .eq('id', f.follower_id)
            .single();

        console.log(`- Follower: ${user?.nickname || f.follower_id} (${user?.email || 'N/A'}) | Followed on: ${f.created_at}`);
    }
}

checkFollowers();
