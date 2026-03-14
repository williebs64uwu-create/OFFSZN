import { supabase } from './src/infrastructure/database/connection.js';

async function listAllTaquitos() {
    try {
        const { data: users } = await supabase
            .from('users')
            .select('id, nickname')
            .ilike('nickname', '%taquitos%');
        
        if (!users || users.length === 0) return;
        const pid = users[0].id;

        const { data: products } = await supabase
            .from('products')
            .select('id, name, price_basic, mp3_url, licenses, r2_version')
            .eq('producer_id', pid);
        
        console.log('--- PRODUCTS for ' + users[0].nickname + ' ---');
        console.log(JSON.stringify(products, null, 2));

    } catch (e) {
        console.error(e);
    }
}
listAllTaquitos();
