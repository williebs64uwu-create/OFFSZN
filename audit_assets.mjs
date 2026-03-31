
import 'dotenv/config'; // Loads from .env in current or parent dir
import { getPresignedDownloadUrl } from './server/src/infrastructure/services/r2-storage.service.js';
import { supabase } from './server/src/infrastructure/database/connection.js';

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
    console.log(`\n--- Checking key: ${key} ---`);
    const results = {};

    // 1. Check DB for full path & current version
    const { data: products } = await supabase
        .from('products')
        .select('image_url, r2_version, storage_version')
        .ilike('image_url', `%${key}`);
    
    const dbRecord = products?.[0];
    const fullPath = dbRecord?.image_url || key;
    
    console.log(`  DB Record: ${dbRecord ? `Found (${dbRecord.storage_version}/${dbRecord.r2_version})` : 'NOT FOUND'}`);
    console.log(`  Full Path: ${fullPath}`);

    // 2. Try R2 v2 (offsznlatbucket)
    try {
        const urlV2 = await getPresignedDownloadUrl(fullPath, 60, 'v2');
        const resV2 = await fetch(urlV2, { method: 'HEAD' });
        results.r2_v2 = resV2.status === 200 ? '✅ EXISTS' : `❌ ${resV2.status}`;
    } catch (e) {
        results.r2_v2 = `⚠️ ERROR: ${e.message}`;
    }
    console.log(`  R2 v2: ${results.r2_v2}`);

    // 3. Try R2 v1 (offszn-storage)
    try {
        const urlV1 = await getPresignedDownloadUrl(fullPath, 60, 'v1');
        const resV1 = await fetch(urlV1, { method: 'HEAD' });
        results.r2_v1 = resV1.status === 200 ? '✅ EXISTS' : `❌ ${resV1.status}`;
    } catch (e) {
        results.r2_v1 = `⚠️ ERROR: ${e.message}`;
    }
    console.log(`  R2 v1: ${results.r2_v1}`);

    // 4. Try Supabase (Public URL check)
    try {
        const { data } = supabase.storage.from('products').getPublicUrl(fullPath);
        const resSuba = await fetch(data.publicUrl, { method: 'HEAD' });
        results.supabase = resSuba.status === 200 ? '✅ EXISTS' : `❌ ${resSuba.status}`;
    } catch (e) {
        results.supabase = `⚠️ ERROR: ${e.message}`;
    }
    console.log(`  Supabase: ${results.supabase}`);

    return results;
}

async function run() {
    console.log("Starting bucket audit... (Verifying asset locations)");
    for (const key of keysToCheck) {
        await checkKey(key);
    }
    console.log("\nAudit complete.");
    process.exit(0);
}

run();
