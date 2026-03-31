
const { getPresignedDownloadUrl } = require('./server/src/infrastructure/services/r2-storage.service');
const { supabase } = require('./server/src/infrastructure/config/supabase');
const axios = require('axios');

const keysToCheck = [
    '1771706193704_cover.jpg',
    '1771787329337_cover.jpg',
    '1771308839462_cover_edit.jpg',
    '1771445935851_cover.jpg',
    '1771803299995_cover.jpg',
    '1771368464689_cover.jpg',
    '1771802747635_cover.jpg',
    '1772024001466_cover.jpg',
    '1770768758750_cover.jpg',
    '1771224321585_cover.jpg'
];

async function checkKey(key) {
    console.log(`\nChecking key: ${key}`);
    const results = {};

    // 1. Check DB for full path
    const { data: products } = await supabase
        .from('products')
        .select('image_url, r2_version, storage_version')
        .ilike('image_url', `%${key}`);
    
    if (products && products.length > 0) {
        results.db = products[0];
        console.log(`  DB Path: ${products[0].image_url}`);
    } else {
        results.db = 'NOT_FOUND';
        console.log(`  DB: NOT_FOUND`);
    }

    const fullPath = products?.[0]?.image_url || key;

    // 2. Try R2 v2 (offsznlatbucket)
    try {
        const urlV2 = await getPresignedDownloadUrl(fullPath, 60, 'v2');
        const resV2 = await axios.head(urlV2);
        results.r2_v2 = resV2.status === 200 ? 'EXISTS' : resV2.status;
    } catch (e) {
        results.r2_v2 = e.response?.status || 'ERROR';
    }
    console.log(`  R2 v2: ${results.r2_v2}`);

    // 3. Try R2 v1 (offszn-storage)
    try {
        const urlV1 = await getPresignedDownloadUrl(fullPath, 60, 'v1');
        const resV1 = await axios.head(urlV1);
        results.r2_v1 = resV1.status === 200 ? 'EXISTS' : resV1.status;
    } catch (e) {
        results.r2_v1 = e.response?.status || 'ERROR';
    }
    console.log(`  R2 v1: ${results.r2_v1}`);

    // 4. Try Supabase
    try {
        const { data } = supabase.storage.from('products').getPublicUrl(fullPath);
        const resSuba = await axios.head(data.publicUrl);
        results.supabase = resSuba.status === 200 ? 'EXISTS' : resSuba.status;
    } catch (e) {
        results.supabase = e.response?.status || 'ERROR';
    }
    console.log(`  Supabase: ${results.supabase}`);

    return results;
}

async function run() {
    for (const key of keysToCheck) {
        await checkKey(key);
    }
    process.exit(0);
}

run();
