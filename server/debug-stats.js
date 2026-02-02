import { supabase } from './src/infrastructure/database/connection.js';

async function testStats(nickname) {
    console.log(`Testing Stats for: ${nickname}`);

    // Try to get user ID first
    const { data: user } = await supabase.from('users').select('id').ilike('nickname', nickname).single();

    if (!user) {
        console.log('User not found');
        return;
    }
    console.log('User ID:', user.id);

    // Test Counts
    // Requirement: Count followers (where user_id = target)
    // Requirement: Count products (where producer_id = target)
    // Note: 'followers!followers_user_id_fkey' might be needed if multiple keys exists (there are 2).
    // The schema says: 
    // followers_user_id_fkey (user_id -> users.id) [The one being followed]
    // followers_follower_id_fkey (follower_id -> users.id) [The follower]

    const { data, error } = await supabase
        .from('users')
        .select(`
            nickname,
            followers:followers!followers_user_id_fkey(count),
            products:products!products_producer_id_fkey(count)
        `)
        .eq('id', user.id)
        .single();

    if (error) console.error(error);
    else console.log('Stats:', JSON.stringify(data, null, 2));
}

testStats('willieinspired');
