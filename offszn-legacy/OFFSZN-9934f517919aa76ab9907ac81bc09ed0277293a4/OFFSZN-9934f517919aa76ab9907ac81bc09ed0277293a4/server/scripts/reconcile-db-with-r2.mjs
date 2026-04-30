import fs from 'fs';
import { supabase } from '../src/infrastructure/database/connection.js';
import dotenv from 'dotenv';
dotenv.config();

/**
 * RECONCILE DB WITH R2 INVENTORY
 * matches products URLs with actual files in R2 buckets.
 */
const INVENTORY_PATH = './server/scripts/r2_inventory.json';

async function run() {
    console.log('🚀 Starting Database Reconciliation...');

    // 1. Load Inventory
    if (!fs.existsSync(INVENTORY_PATH)) {
        console.error('❌ Inventory file not found. Run r2-inventory.js first.');
        process.exit(1);
    }
    const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf-8'));
    const allKeys = [
        ...inventory.v1.keys.map(k => ({ key: k, ver: 'v1' })),
        ...inventory.v2.keys.map(k => ({ key: k, ver: 'v2' }))
    ];


    console.log(`📦 Loaded ${allKeys.length} keys from inventory.`);

    // 2. Fetch Products
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, image_url, audio_url, r2_version, producer_id');

    if (error) {
        console.error('❌ Error fetching products:', error);
        process.exit(1);
    }

    console.log(`🔍 Checking ${products.length} products...`);

    let updates = 0;
    const dryRun = process.argv.includes('--dry-run');
    if (dryRun) console.log('⚠️ DRY RUN MODE - No changes will be saved');

    for (const prod of products) {
        let needsUpdate = false;
        let newImageUrl = prod.image_url;
        let newAudioUrl = prod.audio_url;
        let newVer = prod.r2_version;

        // Helper to find best key match
        const findBestMatch = (originalUrl, producerId) => {
            if (!originalUrl) return null;
            // Clean URL (remove ?v=v1 etc)
            let clean = originalUrl.split('?')[0];
            while (clean.startsWith('/')) clean = clean.substring(1);
            
            const filename = clean.split('/').pop();

            // 1. Try exact match
            let match = allKeys.find(k => k.key === clean);
            if (match) return match;

            // 2. Try UUID-aware prefixes (Highest precision)
            if (producerId) {
                const uuidPrefixes = [
                    `beats/mp3/${producerId}/`,
                    `products/audio/${producerId}/`,
                    `products/covers/${producerId}/`,
                    `audio/${producerId}/`,
                    `mp3_tagged/${producerId}/`
                ];
                for (const p of uuidPrefixes) {
                    match = allKeys.find(k => k.key === `${p}${filename}`);
                    if (match) return match;
                }
            }

            // 3. Try generic prefixes
            const genericPrefixes = ['products/audio/', 'audio/', 'beats/mp3/', 'mp3_tagged/', 'products/covers/'];
            for (const p of genericPrefixes) {
                match = allKeys.find(k => k.key === `${p}${filename}`);
                if (match) return match;
            }

            // 4. Try filename toggle (legacy)
            const alt = clean.startsWith('products/') ? clean.substring(9) : `products/${clean}`;
            match = allKeys.find(k => k.key === alt);
            if (match) return match;

            // 5. Last resort: ANY key that ends with the filename
            match = allKeys.find(k => k.key.toLowerCase().endsWith(`/${filename.toLowerCase()}`));
            if (match) return match;

            return null;
        };

        // Check Image
        const imgMatch = findBestMatch(prod.image_url, prod.producer_id);
        if (imgMatch) {
            if (prod.image_url !== imgMatch.key || prod.r2_version !== imgMatch.ver) {
                newImageUrl = imgMatch.key;
                newVer = imgMatch.ver;
                needsUpdate = true;
            }
        }

        // Check Audio
        const audioMatch = findBestMatch(prod.audio_url, prod.producer_id);
        if (audioMatch) {
            if (prod.audio_url !== audioMatch.key || prod.r2_version !== audioMatch.ver) {
                newAudioUrl = audioMatch.key;
                newVer = audioMatch.ver; // Version from image or audio (usually Same)
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            console.log(`✨ [${prod.id}] ${prod.name}:`);
            if (prod.image_url !== newImageUrl) console.log(`   IMG: ${prod.image_url} -> ${newImageUrl}`);
            if (prod.audio_url !== newAudioUrl) console.log(`   AUD: ${prod.audio_url} -> ${newAudioUrl}`);
            if (prod.r2_version !== newVer) console.log(`   VER: ${prod.r2_version} -> ${newVer}`);

            if (!dryRun) {
                const { error: upErr } = await supabase
                    .from('products')
                    .update({
                        image_url: newImageUrl,
                        audio_url: newAudioUrl,
                        r2_version: newVer,
                        storage_version: 'r2'
                    })
                    .eq('id', prod.id);
                
                if (upErr) console.error(`   ❌ Failed to update:`, upErr.message);
                else updates++;
            } else {
                updates++;
            }
        }
    }

    console.log(`\n✅ Finished! ${updates} products ${dryRun ? 'would be' : ''} updated.`);
}

run();
