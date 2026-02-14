import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const userId = '699fbf86-d976-44bb-9396-32889fb7df86';

async function listEverything() {
    try {
        console.log("🔍 Listing EVERYTHING for user in Supabase Storage...");

        const { data: buckets } = await supabase.storage.listBuckets();

        for (const bucket of buckets) {
            console.log(`\n📦 Bucket: ${bucket.name}`);

            // Try to list the whole bucket or common user folders
            const { data: files, error } = await supabase.storage.from(bucket.name).list(userId, { limit: 100 });
            if (error) continue;

            files.forEach(f => {
                console.log(`   - Path: ${userId}/${f.name}`);
            });

            // Also check 'products/USERID'
            const { data: pFiles, error: pError } = await supabase.storage.from(bucket.name).list(`products/${userId}`, { limit: 100 });
            if (!pError) {
                pFiles.forEach(f => {
                    console.log(`   - Path: products/${userId}/${f.name}`);
                });
            }
        }

    } catch (err) {
        console.error("💥 Error:", err);
    }
}

listEverything();
