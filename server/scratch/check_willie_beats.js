import { supabase } from '../src/infrastructure/database/connection.js';

async function run() {
    const { data: user } = await supabase
        .from('users')
        .select('id, nickname')
        .ilike('nickname', '%willie%')
        .limit(5);

    console.log('Users:', user);

    if (!user?.length) return;

    const producerId = user.find(u => u.nickname?.toLowerCase().includes('willie'))?.id || user[0].id;

    const { data: beats } = await supabase
        .from('products')
        .select('id, name, image_url, r2_version, storage_version, product_type')
        .eq('producer_id', producerId)
        .eq('product_type', 'BEAT')
        .ilike('name', '%Alone%')
        .limit(5);

    console.log('\nAlone beats:', beats);

    const { data: mileage } = await supabase
        .from('products')
        .select('id, name, image_url, r2_version, storage_version')
        .eq('producer_id', producerId)
        .ilike('name', '%Mileage%')
        .limit(5);

    console.log('\nMileage beats:', mileage);

    const { data: recentBeats } = await supabase
        .from('products')
        .select('id, name, image_url, r2_version, storage_version')
        .eq('producer_id', producerId)
        .eq('product_type', 'BEAT')
        .order('created_at', { ascending: false })
        .limit(8);

    console.log('\nRecent beats:', recentBeats);
}

run();
