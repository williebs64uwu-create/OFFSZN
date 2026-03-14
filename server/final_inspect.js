import { supabase } from './src/infrastructure/database/connection.js';

async function finalInspect() {
    try {
        const { data: products } = await supabase
            .from('products')
            .select('*')
            .ilike('name', '%Donde%')
            .limit(1);

        if (products && products.length > 0) {
            const p = products[0];
            console.log('--- RAW PRODUCT DATA ---');
            console.log(JSON.stringify(p, null, 2));

            const { data: producer } = await supabase
                .from('users')
                .select('*')
                .eq('id', p.producer_id || p.user_id);
            
            if (producer && producer[0]) {
                console.log('\n--- RAW PRODUCER DATA ---');
                console.log(JSON.stringify(producer[0], null, 2));
            }
        }
    } catch (e) {
        console.error(e);
    }
}
finalInspect();
