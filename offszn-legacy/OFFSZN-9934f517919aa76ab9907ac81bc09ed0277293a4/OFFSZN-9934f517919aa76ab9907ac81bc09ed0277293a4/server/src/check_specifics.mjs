
import 'dotenv/config';
import { supabase } from './infrastructure/database/connection.js';
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

const names = [
    'Bayriton & El Joan Type Beat - "COMPATIBLES"',
    'CrzySht',
    '"THE NIGHT OF OUR LIVES" Detroit Sample TYPE BEAT',
    '007.(FREE) Rio Da Yung OG x Detroit Type Beat 2026',
    'Detroit Sample TYPE BEAT "Hasta Ayer"',
    'beat de trap alto flow',
    '001.(FREE) Rio Da Yung OG x Detroit Type Beat 2026'
];

async function checkInR2(fullPath, version) {
    const endpoint = version === 'v1' ? process.env.R2_ENDPOINT : process.env.R2_ENDPOINT_V2;
    const accessKeyId = version === 'v1' ? process.env.R2_ACCESS_KEY_ID : process.env.R2_ACCESS_KEY_ID_V2;
    const secretAccessKey = version === 'v1' ? process.env.R2_SECRET_ACCESS_KEY : process.env.R2_SECRET_ACCESS_KEY_V2;
    const bucket = version === 'v1' ? process.env.R2_BUCKET_NAME : process.env.R2_BUCKET_NAME_V2;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return false;

    try {
        const client = new S3Client({
            region: 'auto',
            endpoint: endpoint,
            credentials: { accessKeyId, secretAccessKey }
        });
        const command = new HeadObjectCommand({ Bucket: bucket, Key: fullPath });
        await client.send(command);
        return true;
    } catch (e) {
        return false;
    }
}

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.log("Checking 7 Specific Products...\n");

    const { data: products, error } = await supabase.from('products').select('*');
    if (error) {
        console.error("DB Error:", error.message);
        return;
    }

    const filtered = products.filter(p => names.some(n => p.name.toLowerCase().includes(n.toLowerCase().replace(/\"/g, ''))));

    for (const p of filtered) {
        console.log(`Product ${p.id}: ${p.name}`);
        console.log(`  DB storage_version: ${p.storage_version}, r2_version: ${p.r2_version}`);
        console.log(`  DB image_url: ${p.image_url}`);

        const existsV1 = await checkInR2(p.image_url, 'v1');
        const existsV2 = await checkInR2(p.image_url, 'v2');

        console.log(`  R2 v1: ${existsV1 ? '✅ FOUND' : '❌ NO'}`);
        console.log(`  R2 v2: ${existsV2 ? '✅ FOUND' : '❌ NO'}`);
        console.log("");
    }
    process.exit(0);
}

run();
