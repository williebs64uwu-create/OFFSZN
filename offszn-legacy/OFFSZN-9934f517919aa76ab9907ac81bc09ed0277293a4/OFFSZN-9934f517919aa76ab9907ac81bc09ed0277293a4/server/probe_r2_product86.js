/**
 * R2 Diagnostic: List ALL objects matching the UUID for product 86
 * Run: node probe_r2_product86.js
 */
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '.env') });

const clean = (val) => val ? val.replace(/^[A-Z0-9_]+:\s*/, '').trim() : val;

// V1
const clientV1 = new S3Client({
    region: 'auto',
    endpoint: clean(process.env.R2_ENDPOINT),
    forcePathStyle: false,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
        accessKeyId: clean(process.env.R2_ACCESS_KEY_ID),
        secretAccessKey: clean(process.env.R2_SECRET_ACCESS_KEY),
    }
});
const bucketV1 = clean(process.env.R2_BUCKET_NAME) || 'offszn-storage';

// V2
const clientV2 = new S3Client({
    region: 'auto',
    endpoint: clean(process.env.R2_ENDPOINT_V2),
    forcePathStyle: false,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
        accessKeyId: clean(process.env.R2_ACCESS_KEY_ID_V2),
        secretAccessKey: clean(process.env.R2_SECRET_ACCESS_KEY_V2),
    }
});
const bucketV2 = clean(process.env.R2_BUCKET_NAME_V2) || 'offsznlatbucket';

const UUID = '2d575b37-ea6a-4708-9cd5-e658e99708ff';
const FILENAME = '1770165324909_Nuevo_proyecto.wav';

async function listPrefix(client, bucket, prefix, label) {
    console.log(`\n🔍 [${label}] Listing: ${bucket} / prefix="${prefix}"`);
    try {
        const result = await client.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            MaxKeys: 50
        }));
        if (!result.Contents || result.Contents.length === 0) {
            console.log(`   (vacío - no hay objetos con este prefijo)`);
            return [];
        }
        result.Contents.forEach(obj => {
            console.log(`   📦 ${obj.Key}  (${(obj.Size / 1024).toFixed(1)} KB)`);
        });
        return result.Contents;
    } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        return [];
    }
}

async function headKey(client, bucket, key, label) {
    try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        console.log(`   ✅ EXISTS in ${label}: ${key}`);
        return true;
    } catch {
        return false;
    }
}

async function main() {
    console.log('========================================');
    console.log('  R2 DIAGNOSTIC: Product 86 (Duki)');
    console.log(`  UUID: ${UUID}`);
    console.log(`  File: ${FILENAME}`);
    console.log('========================================');

    // --- V2 BUCKET ---
    console.log('\n\n===== V2 BUCKET =====');
    await listPrefix(clientV2, bucketV2, `products/${UUID}`, 'V2');
    await listPrefix(clientV2, bucketV2, `secure-products/beats/wav/${UUID}`, 'V2');
    await listPrefix(clientV2, bucketV2, `secure-products/beats/wav_untagged/${UUID}`, 'V2');
    await listPrefix(clientV2, bucketV2, `secure-products/${UUID}`, 'V2');
    await listPrefix(clientV2, bucketV2, `beats/wav/${UUID}`, 'V2');
    // Try searching by filename
    await listPrefix(clientV2, bucketV2, `secure-products/beats/wav/1770165`, 'V2-byfile');

    // --- V1 BUCKET ---
    console.log('\n\n===== V1 BUCKET =====');
    await listPrefix(clientV1, bucketV1, `products/${UUID}`, 'V1');
    await listPrefix(clientV1, bucketV1, `secure-products/beats/wav/${UUID}`, 'V1');
    await listPrefix(clientV1, bucketV1, `secure-products/beats/wav_untagged/${UUID}`, 'V1');
    await listPrefix(clientV1, bucketV1, `secure-products/${UUID}`, 'V1');
    await listPrefix(clientV1, bucketV1, `beats/wav/${UUID}`, 'V1');
    await listPrefix(clientV1, bucketV1, `beats/${UUID}`, 'V1');

    // --- BROAD SEARCH V2 ---
    console.log('\n\n===== BROAD SEARCH (top-level prefixes) =====');
    await listPrefix(clientV2, bucketV2, 'products/', 'V2-broad');
    await listPrefix(clientV2, bucketV2, 'secure-products/beats/', 'V2-broad-beats');
    await listPrefix(clientV1, bucketV1, 'secure-products/beats/wav/', 'V1-broad-wav');

    // --- EXPLICIT HEAD CHECKS ---
    console.log('\n\n===== EXPLICIT HEAD CHECKS =====');
    const keysToCheck = [
        `products/${UUID}/wav_untagged/${FILENAME}`,
        `products/${UUID}/${FILENAME}`,
        `secure-products/beats/wav/${UUID}/${FILENAME}`,
        `secure-products/beats/wav_untagged/${UUID}/${FILENAME}`,
        `secure-products/${UUID}/${FILENAME}`,
        `beats/wav/${UUID}/${FILENAME}`,
        `${UUID}/${FILENAME}`,
        `${UUID}/wav_untagged/${FILENAME}`,
        FILENAME,
    ];

    for (const key of keysToCheck) {
        const foundV2 = await headKey(clientV2, bucketV2, key, 'V2');
        if (!foundV2) {
            await headKey(clientV1, bucketV1, key, 'V1');
        }
    }

    console.log('\n\n✅ Diagnostic complete.');
}

main().catch(console.error);
