import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const s3Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkExistence(key) {
    try {
        await s3Client.send(new HeadObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME || 'offszn-storage',
            Key: key
        }));
        return true;
    } catch (e) {
        return false;
    }
}

async function fixAres() {
    try {
        console.log("🛠️ Starting Fix for 'ares'...");

        // 1. Get products for ares
        // Try getting user ID first
        const { data: user } = await supabase.from('users').select('id').ilike('nickname', 'ares').maybeSingle();
        if (!user) {
            console.error("User 'ares' not found (by nickname).");
            // Fallback to searching all products with producer nickname logic if needed, but let's assume nickname works.
            // Actually, the previous script found a producer ID: a07ba6ef-278c-489b-b6be-c27259874898
            return;
        }

        const userId = user.id;
        console.log(`👤 Checking products for User ID: ${userId}`);

        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('producer_id', userId);

        if (error) throw error;

        let fixedCount = 0;

        for (const p of products) {
            const updates = {};
            let hasChanges = false;

            // Fields to check
            const r2Fields = ['mp3_url', 'audio_url', 'download_url_mp3', 'image_url'];

            for (const f of r2Fields) {
                const url = p[f];
                if (url && url.includes('.r2.cloudflarestorage.com')) {
                    const key = url.split('.r2.cloudflarestorage.com/')[1];
                    if (!key) continue;

                    // Check if current key exists
                    const exists = await checkExistence(key);

                    if (!exists) {
                        // Try double underscore variant (timestamp pattern)
                        const parts = key.split('/');
                        const filename = parts.pop();
                        const path = parts.join('/');
                        // Replace first _ after digits with __
                        const doubleFilename = filename.replace(/^(\d+)_/, '$1__');
                        const doubleKey = path + '/' + doubleFilename;

                        if (doubleKey !== key) {
                            const existsDouble = await checkExistence(doubleKey);
                            if (existsDouble) {
                                console.log(`   ✅ Fixing [${p.name}] ${f}:`);
                                console.log(`      From: ${key} (404)`);
                                console.log(`      To:   ${doubleKey} (FOUND)`);
                                updates[f] = url.replace(key, doubleKey);
                                hasChanges = true;
                            } else {
                                console.log(`   ⚠️ [${p.name}] ${f}: Neither single nor double underscore found.`);
                                console.log(`      Checked: ${key} AND ${doubleKey}`);
                            }
                        }
                    }
                }
            }

            if (hasChanges) {
                const { error: uError } = await supabase.from('products').update(updates).eq('id', p.id);
                if (uError) console.error(`❌ Update failed for product ${p.id}:`, uError.message);
                else {
                    console.log(`✅ Product ${p.id} updated.`);
                    fixedCount++;
                }
            }
        }

        console.log(`\n🎉 Fix complete! Updated ${fixedCount} products.`);

    } catch (err) {
        console.error("💥 Fix Error:", err);
    }
}

fixAres();
