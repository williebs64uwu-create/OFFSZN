
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { supabase } from './infrastructure/database/connection.js';

const productsToCheck = [
    { id: 266, name: "Maria Maria" },
    { id: 286, name: "MF DOOM x Alchemist" },
    { id: 228, name: "Kanye West Type Beat" },
    { id: 243, name: "School Days" }
];

async function checkInR2(fullPath, version) {
    const endpoint = version === 'v1' ? process.env.R2_ENDPOINT : process.env.R2_ENDPOINT_V2;
    const accessKeyId = version === 'v1' ? process.env.R2_ACCESS_KEY_ID : process.env.R2_ACCESS_KEY_ID_V2;
    const secretAccessKey = version === 'v1' ? process.env.R2_SECRET_ACCESS_KEY : process.env.R2_SECRET_ACCESS_KEY_V2;
    const bucket = version === 'v1' ? process.env.R2_BUCKET_NAME : process.env.R2_BUCKET_NAME_V2;

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
    console.log("Definitive Audit: Testing DB Paths vs R2 Buckets\n");

    for (const p of productsToCheck) {
        const { data: product } = await supabase.from('products').select('*').eq('id', p.id).single();
        if (!product) {
            console.log(`Product ${p.id} NOT FOUND in DB`);
            continue;
        }

        console.log(`Product ${p.id}: ${product.name}`);
        console.log(`  DB storage_version: ${product.storage_version}, r2_version: ${product.r2_version}`);
        console.log(`  DB image_url: ${product.image_url}`);

        const existsV1 = await checkInR2(product.image_url, 'v1');
        const existsV2 = await checkInR2(product.image_url, 'v2');

        console.log(`  R2 v1: ${existsV1 ? '✅ FOUND' : '❌ NO'}`);
        console.log(`  R2 v2: ${existsV2 ? '✅ FOUND' : '❌ NO'}`);
        
        if (!existsV1 && !existsV2) {
            // Check if maybe it's in Supabase but path is weird
            console.log(`  Checking Supabase...`);
            // We use the same path but check Supabase storage
            // ... (skipping for now, checking R2 first)
        }
        console.log("");
    }
    process.exit(0);
}

run();
