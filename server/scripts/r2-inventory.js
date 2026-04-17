import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const createClient = (prefix = '') => {
    const endpoint = process.env[`R2_ENDPOINT${prefix}`];
    const accessKeyId = process.env[`R2_ACCESS_KEY_ID${prefix}`];
    const secretAccessKey = process.env[`R2_SECRET_ACCESS_KEY${prefix}`];

    if (!endpoint || !accessKeyId || !secretAccessKey) {
        console.warn(`⚠️ Warning: Missing credentials for R2 ${prefix || 'V1'}`);
        return null;
    }

    return new S3Client({
        region: "auto",
        endpoint: endpoint,
        credentials: {
            accessKeyId,
            secretAccessKey,
        }
    });
};

async function listBucket(client, bucketName, label) {
    if (!client) return [];
    console.log(`\n📦 Listing objects in ${label} (${bucketName})...`);
    let isTruncated = true;
    let nextContinuationToken = null;
    const keys = [];

    try {
        while (isTruncated) {
            const command = new ListObjectsV2Command({
                Bucket: bucketName,
                ContinuationToken: nextContinuationToken
            });
            const response = await client.send(command);
            
            if (response.Contents) {
                response.Contents.forEach(obj => keys.push(obj.Key));
            }
            
            isTruncated = response.IsTruncated;
            nextContinuationToken = response.NextContinuationToken;
            process.stdout.write(`  Found ${keys.length} items...\r`);
        }
        console.log(`\n✅ Finished listing ${label}. Total: ${keys.length}`);
        return keys;
    } catch (err) {
        console.error(`\n❌ Error listing ${label}:`, err.message);
        return [];
    }
}

async function run() {
    const v1Client = createClient('');
    const v2Client = createClient('_V2');
    
    const v1Bucket = process.env.R2_BUCKET_NAME || 'offszn-storage';
    const v2Bucket = process.env.R2_BUCKET_NAME_V2 || 'offsznlatbucket';

    const v1Keys = await listBucket(v1Client, v1Bucket, 'V1 Bucket');
    const v2Keys = await listBucket(v2Client, v2Bucket, 'V2 Bucket');

    const result = {
        timestamp: new Date().toISOString(),
        v1: { bucket: v1Bucket, count: v1Keys.length, keys: v1Keys },
        v2: { bucket: v2Bucket, count: v2Keys.length, keys: v2Keys }
    };

    const outputPath = path.join(__dirname, 'r2_inventory.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n✨ Inventory saved to: ${outputPath}`);
}

run();
