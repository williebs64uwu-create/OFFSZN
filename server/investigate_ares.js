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

async function investigateAres() {
    try {
        console.log("🔍 Investigating 'ares' and 'Time_F#minor_128'...");

        // 1. Find the product (using slug guess from user or name like)
        // User screenshot showed 'Time_F#minor_128'
        const { data: products, error: pError } = await supabase
            .from('products')
            .select('*, producer:producer_id (id, nickname)')
            .ilike('name', '%Time_F#minor_128%');

        if (pError) console.error("❌ Error fetching product:", pError);
        else if (products.length === 0) {
            console.warn("⚠️ No product found with name like 'Time_F#minor_128'. Trying slug 'ares-time-fminor-128'.");
            const { data: pSlug } = await supabase.from('products').select('*').eq('public_slug', 'ares-time-fminor-128').maybeSingle();
            if (pSlug) products.push(pSlug);
        }

        if (products.length === 0) {
            console.error("❌ Product NOT FOUND.");
            return;
        }

        const p = products[0];
        console.log(`📦 Found Product: [${p.name}] (ID: ${p.id})`);
        console.log(`   Slug: ${p.public_slug}`);
        console.log(`   Producer: ${p.producer?.nickname} (${p.producer_id})`);

        // 2. Check R2 for this product's audio
        const fields = ['mp3_url', 'audio_url', 'wav_url'];
        for (const f of fields) {
            const url = p[f];
            if (url && url.includes('.r2.cloudflarestorage.com')) {
                const key = url.split('.r2.cloudflarestorage.com/')[1];
                if (!key) continue;

                // Generating variants
                const singleUnderscoreKey = key.replace(/_+/g, '_');

                // Manual double underscore construction logic (as per maidana fix)
                // If filename starts with timestamp like 177..., replace first _ with __
                const parts = key.split('/');
                const filename = parts.pop();
                const path = parts.join('/');
                // This time, I'll try restoring ALL underscores if single failed
                // Or try the "timestamp__" pattern specifically
                const doublekeyTimestamp = path + '/' + filename.replace(/^(\d+)_/, '$1__');

                // Check variants
                const existsOriginal = await checkExistence(key);
                const existsSingle = await checkExistence(singleUnderscoreKey);
                const existsDouble = await checkExistence(doublekeyTimestamp);

                console.log(`   Field: ${f}`);
                console.log(`   - DB Key:   ${key} [${existsOriginal ? 'FOUND' : '404'}]`);
                if (key !== singleUnderscoreKey)
                    console.log(`   - Single _: ${singleUnderscoreKey} [${existsSingle ? 'FOUND' : '404'}]`);
                if (key !== doublekeyTimestamp)
                    console.log(`   - Double _: ${doublekeyTimestamp} [${existsDouble ? 'FOUND' : '404'}]`);

                if (existsDouble && !existsOriginal) {
                    console.log(`   💡 ADVICE: Update to double underscore (TIMESTAMP pattern).`);
                }
            } else {
                console.log(`   Field: ${f} -> ${url} (Not R2 or Empty)`);
            }
        }

    } catch (err) {
        console.error("💥 Investigation Error:", err);
    }
}

investigateAres();
