
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import 'dotenv/config';

const clientV1 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
});

const clientV2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT_V2,
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID_V2,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY_V2,
    }
});

const V1_BUCKET = process.env.R2_BUCKET_NAME;
const V2_BUCKET = process.env.R2_BUCKET_NAME_V2;

async function checkExists(client, bucket, key) {
    try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
    } catch (e) {
        return false;
    }
}

// Test keys from the screenshot errors:
const testKeys = [
    // Product 407 (Field - koimattoru) - from sample clean products
    'products/covers/5deec33a-a343-4d1c-a659-607dce6aea21/1772672996697_cover.jpg',
    // Product 328 - v1
    'products/covers/b9f65803-6299-426a-9d47-733b2130efc9/1771985307610_cover.jpg',
    // Product 286 - v1
    'products/covers/18f1d12c-8268-4898-bf6a-a660b9df117d/1771787329337_cover.jpg',
    // Product 488 - v2
    'products/covers/18f1d12c-8268-4898-bf6a-a660b9df117d/1773613995812_cover.jpg',
];

async function main() {
    for (const key of testKeys) {
        const v1 = await checkExists(clientV1, V1_BUCKET, key);
        const v2 = await checkExists(clientV2, V2_BUCKET, key);
        console.log(`${key}`);
        console.log(`  V1 (${V1_BUCKET}): ${v1 ? '✅ EXISTS' : '❌ NOT FOUND'}`);
        console.log(`  V2 (${V2_BUCKET}): ${v2 ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    }
}

main().catch(console.error);
