import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    console.log('--- Starting Cloudinary to Supabase Migration ---');

    // 1. Fetch products with Cloudinary URLs
    const { data: products, error: pError } = await supabase
        .from('products')
        .select('id, name, producer_id, image_url, mp3_url')
        .ilike('image_url', '%cloudinary%');

    if (pError) {
        console.error('Error fetching products:', pError);
        return;
    }

    console.log(`Found ${products.length} products with Cloudinary URLs.`);

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const product of products) {
        try {
            console.log(`\n[Product ${product.id}] ${product.name}`);
            
            // 2. Identify timestamp from mp3_url if available
            let targetTimestamp = null;
            if (product.mp3_url) {
                const match = product.mp3_url.match(/(\d{13})/);
                if (match) {
                    targetTimestamp = match[1];
                    console.log(`  Target timestamp from MP3: ${targetTimestamp}`);
                }
            }

            // 3. Search for covers in Supabase for this producer
            const { data: objects, error: sError } = await supabase.storage
                .from('products')
                .list(`${product.producer_id}/covers`);

            if (sError) {
                console.error(`  Error listing storage for producer ${product.producer_id}:`, sError);
                failCount++;
                continue;
            }

            if (!objects || objects.length === 0) {
                console.warn(`  No covers found in Supabase for producer ${product.producer_id}`);
                skipCount++;
                continue;
            }

            let bestMatch = null;
            if (targetTimestamp) {
                const targetTime = parseInt(targetTimestamp);
                bestMatch = objects.find(obj => {
                    const objMatch = obj.name.match(/(\d{13})/);
                    if (objMatch) {
                        const objTime = parseInt(objMatch[1]);
                        return Math.abs(objTime - targetTime) < 600000; // 10 minutes grace period
                    }
                    return false;
                });
            } else if (objects.length === 1) {
                bestMatch = objects[0];
            }

            if (!bestMatch) {
                // Try matching by product ID in filename as fallback
                bestMatch = objects.find(obj => obj.name.includes(`prod_${product.id}`));
            }

            if (bestMatch) {
                const newPath = `${product.producer_id}/covers/${bestMatch.name}`;
                console.log(`  MATCH FOUND: Updating image_url to: ${newPath}`);

                const { error: uError } = await supabase
                    .from('products')
                    .update({ 
                        image_url: newPath,
                        r2_version: 'supabase'
                    })
                    .eq('id', product.id);

                if (uError) {
                    console.error(`  Error updating product ${product.id}:`, uError);
                    failCount++;
                } else {
                    console.log(`  SUCCESS: Product ${product.id} updated.`);
                    successCount++;
                }
            } else {
                console.warn(`  SKIPPING: No suitable cover found in Supabase.`);
                skipCount++;
            }

        } catch (err) {
            console.error(`  Unexpected error processing product ${product.id}:`, err);
            failCount++;
        }
    }

    console.log('\n--- Migration Summary ---');
    console.log(`Total processed: ${products.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Skipped (no match): ${skipCount}`);
    console.log(`Failed (error): ${failCount}`);
}

migrate();
