import { supabase } from './src/infrastructure/database/connection.js';

async function inspectProduct() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, price_basic, mp3_url, demo_file, licenses, user_id, producer_id, r2_version')
            .ilike('name', '%Donde%')
            .limit(1);

        if (data && data.length > 0) {
            const product = data[0];
            console.log('--- PRODUCT DATA ---');
            console.log(JSON.stringify(product, null, 2));
            
            const { data: producer } = await supabase
                .from('users')
                .select('id, nickname, license_settings')
                .eq('id', product.user_id || product.producer_id);
            
            if (producer) {
                console.log('\n--- PRODUCER LICENSE SETTINGS ---');
                console.log(JSON.stringify(producer[0].license_settings, null, 2));
            }
        }
    } catch (e) {
        console.error(e);
    }
}
inspectProduct();
