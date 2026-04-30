
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
    console.log("Fetching products marked as v1...");
    const { data: rows, error } = await supabase.from('products').select('id, image_url, r2_version').eq('r2_version', 'v1');
    
    if (error) {
        console.error("DB Error:", error);
        return;
    }

    console.log(`Checking ${rows.length} products...`);
    
    let toUpdateToV2 = [];
    
    for (const row of rows) {
        const inV1 = await checkKey(s3V1, BUCKET_V1, row.image_url);
        if (!inV1) {
            const inV2 = await checkKey(s3V2, BUCKET_V2, row.image_url);
            if (inV2) {
                console.log(`ID: ${row.id} - Not in V1, but FOUND in V2. Path: ${row.image_url}`);
                toUpdateToV2.push(row.id);
            } else {
                console.log(`ID: ${row.id} - Missing from BOTH buckets! Path: ${row.image_url}`);
            }
        }
    }
    
    console.log(`\nFound ${toUpdateToV2.length} products that should be V2.`);
    console.log("IDs to update to v2:", JSON.stringify(toUpdateToV2));
}

run();
