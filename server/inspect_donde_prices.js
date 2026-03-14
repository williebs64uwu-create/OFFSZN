import { supabase } from './src/infrastructure/database/connection.js';

async function inspectDondePrices() {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, price_basic, licenses, producer_id, mp3_url')
            .ilike('name', '%Donde%')
            .limit(1);

        if (products && products.length > 0) {
            const p = products[0];
            console.log('--- PRODUCT: ' + p.name + ' ---');
            console.log('Price Basic:', p.price_basic);
            console.log('Licenses:', JSON.stringify(p.licenses, null, 2));

            const { data: producer } = await supabase
                .from('users')
                .select('id, nickname, license_settings, r2_version, promotion_settings') // Added promotion_settings
                .eq('id', p.producer_id);
            
            if (producer && producer[0]) {
                console.log('\n--- PRODUCER: ' + producer[0].nickname + ' ---');
                console.log('Producer ID:', producer[0].id);
                console.log('Global License Settings:', JSON.stringify(producer[0].license_settings, null, 2));
                console.log('Promotion Settings:', JSON.stringify(producer[0].promotion_settings, null, 2));
            }
        }
    } catch (e) {
        console.error(e);
    }
}
inspectDondePrices();
