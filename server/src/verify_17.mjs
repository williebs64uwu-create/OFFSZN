
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const s3V1 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const s3V2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT_V2,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID_V2,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY_V2,
    },
});

const BUCKET_V1 = process.env.R2_BUCKET_NAME;
const BUCKET_V2 = process.env.R2_BUCKET_NAME_V2;

async function checkKey(s3, bucket, key) {
    if (!key) return false;
    try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
    } catch (e) {
        return false;
    }
}

async function run() {
    const ids = [470, 498, 502, 487, 488, 501, 495, 494, 482, 485, 500, 469, 486, 479, 499, 483, 463];
    const { data: rows, error } = await supabase.from('products').select('id, name, image_url, r2_version').in('id', ids);
    
    if (error) {
        console.error("DB Error:", error);
        return;
    }

    console.log(`Checking ${rows.length} products...`);
    
    for (const row of rows) {
        const inV1 = await checkKey(s3V1, BUCKET_V1, row.image_url);
        const inV2 = await checkKey(s3V2, BUCKET_V2, row.image_url);
        
        console.log(`ID: ${row.id} | Name: ${row.name}`);
        console.log(`  Path: ${row.image_url}`);
        console.log(`  DB Version: ${row.r2_version}`);
        console.log(`  Exists in V1: ${inV1 ? 'YES' : 'NO'}`);
        console.log(`  Exists in V2: ${inV2 ? 'YES' : 'NO'}`);
        
        if (!inV1 && !inV2) {
            // Try without prefix
            if (row.image_url.includes('products/covers/')) {
                const parts = row.image_url.split('/');
                const filename = parts[parts.length - 1];
                const inV1_bare = await checkKey(s3V1, BUCKET_V1, filename);
                const inV2_bare = await checkKey(s3V2, BUCKET_V2, filename);
                if (inV1_bare || inV2_bare) {
                    console.log(`  FOUND BARE: V1: ${inV1_bare}, V2: ${inV2_bare}`);
                }
            }
        }
    }
}

run();
