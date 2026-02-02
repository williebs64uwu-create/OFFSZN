import { supabase } from './src/infrastructure/database/connection.js';

async function testProfileStats(nickname) {
    console.log(`Fetching stats for ${nickname}...`);

    const { data: userData, error } = await supabase
        .from('users')
        .select(`
            id, 
            nickname, 
            followers:followers!followers_user_id_fkey(count),
            products:products!products_producer_id_fkey(count)
        `)
        .ilike('nickname', nickname)
        .single();

    if (error) {
        console.error(error);
    } else {
        const result = {
            nickname: userData.nickname,
            followers_count: userData.followers?.[0]?.count || 0,
            products_count: userData.products?.[0]?.count || 0,
            raw_followers: userData.followers,
            raw_products: userData.products
        };
        console.log("Result:", JSON.stringify(result, null, 2));
    }
}

testProfileStats('willieinspired');
