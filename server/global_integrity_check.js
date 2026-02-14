import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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

const REPORT_FILE = path.join(__dirname, 'missing_files_report.json');

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

async function globalAudit() {
    try {
        console.log("🌍 Starting Global R2 Integrity Audit...");

        // 1. Fetch ALL products
        let allProducts = [];
        let page = 0;
        const limit = 1000;

        while (true) {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .range(page * limit, (page + 1) * limit - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;

            allProducts = allProducts.concat(data);
            page++;
        }

        console.log(`📊 Processing ${allProducts.length} products...`);

        const missingFiles = [];
        let fixedCount = 0;
        let checkedCount = 0;

        for (const p of allProducts) {
            const updates = {};
            let hasChanges = false;

            // Fields to check
            const r2Fields = ['mp3_url', 'audio_url', 'wav_url', 'image_url'];

            for (const f of r2Fields) {
                const url = p[f];
                if (url && url.includes('.r2.cloudflarestorage.com')) {
                    const key = url.split('.r2.cloudflarestorage.com/')[1];
                    if (!key) continue;
                    checkedCount++;

                    // Check if current key exists
                    const exists = await checkExistence(key);

                    if (!exists) {
                        // Try variants
                        // 1. Single underscore
                        const singleKey = key.replace(/_+/g, '_');
                        // 2. Double underscore (timestamp pattern) specifically for filename
                        const parts = key.split('/');
                        const filename = parts.pop();
                        const pathStr = parts.join('/');
                        const doubleFilename = filename.replace(/^(\d+)_/, '$1__');
                        const doubleKey = pathStr + '/' + doubleFilename;

                        // 3. Simple double restore (if naive single failed)
                        const simpleDoubleKey = key.replace(/_/g, '__'); // Risky? Maybe just specific spots

                        let foundVariant = null;

                        if (singleKey !== key && await checkExistence(singleKey)) foundVariant = singleKey;
                        else if (doubleKey !== key && await checkExistence(doubleKey)) foundVariant = doubleKey;
                        // else if (simpleDoubleKey !== key && await checkExistence(simpleDoubleKey)) foundVariant = simpleDoubleKey;

                        if (foundVariant) {
                            console.log(`🛠️ FIXING [${p.name}] (ID: ${p.id}) Field: ${f}`);
                            console.log(`   From: ${key} (404)`);
                            console.log(`   To:   ${foundVariant} (FOUND)`);
                            updates[f] = url.replace(key, foundVariant);
                            hasChanges = true;
                        } else {
                            console.log(`❌ MSSING FILE [${p.name}] (ID: ${p.id}) Field: ${f}`);
                            console.log(`   Key: ${key}`);
                            missingFiles.push({
                                id: p.id,
                                name: p.name,
                                field: f,
                                key: key,
                                producer_id: p.producer_id,
                                url: url
                            });
                        }
                    }
                }
            }

            if (hasChanges) {
                const { error: uError } = await supabase.from('products').update(updates).eq('id', p.id);
                if (uError) console.error(`   ❌ Update failed for product ${p.id}:`, uError.message);
                else {
                    console.log(`   ✅ Product ${p.id} updated.`);
                    fixedCount++;
                }
            }
        }

        console.log(`\n🎉 Audit Complete! Checked ${checkedCount} URLs.`);
        console.log(`✅ Fixed: ${fixedCount} products.`);
        console.log(`❌ Missing Files: ${missingFiles.length}`);

        fs.writeFileSync(REPORT_FILE, JSON.stringify(missingFiles, null, 2));
        console.log(`📄 Report saved to ${REPORT_FILE}`);

    } catch (err) {
        console.error("💥 Audit Error:", err);
    }
}

globalAudit();
