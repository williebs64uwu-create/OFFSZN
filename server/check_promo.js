import { supabase } from './src/infrastructure/database/connection.js';

async function checkPromo() {
    try {
        const { data: products } = await supabase
            .from('products')
            .select('producer_id, user_id')
            .ilike('name', '%Donde%')
            .limit(1);

        if (products && products.length > 0) {
            const pid = products[0].producer_id || products[0].user_id;
            const { data: user } = await supabase
                .from('users')
                .select('nickname, promotion_settings')
                .eq('id', pid)
                .single();
            
            if (user) {
                console.log('--- PROMOTIONS for ' + user.nickname + ' ---');
                console.log(JSON.stringify(user.promotion_settings, null, 2));
            }
        }
    } catch (e) {
        console.error(e);
    }
}
checkPromo();
