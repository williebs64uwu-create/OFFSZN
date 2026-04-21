import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { config } from 'dotenv';
config();

const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const bucket = 'offsznlatbucket';

async function scan(prefix) {
    console.log(`--- SCANNING: ${prefix} ---`);
    try {
        const data = await client.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            MaxKeys: 20
        }));
        if (data.Contents) {
            data.Contents.forEach(obj => console.log(`[FILE] ${obj.Key}`));
        } else {
            console.log("No files found.");
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

async function start() {
    await scan('secure-products/');
    await scan('secure-products/beats/');
    await scan('secure-products/beats/wav/');
}
start();
