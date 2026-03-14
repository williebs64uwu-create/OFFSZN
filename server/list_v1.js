import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '.env') });

const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'offszn-storage';

async function list() {
    console.log(`Listing all objects in V1 (${R2_BUCKET_NAME})...`);
    try {
        const cmd = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            MaxKeys: 1000
        });
        const data = await s3Client.send(cmd);
        if (data.Contents) {
            console.log(`Found ${data.Contents.length} items:`);
            data.Contents.forEach(item => {
                if (item.Key.includes('cover')) {
                    console.log(` - ${item.Key}`);
                }
            });
        } else {
            console.log('No items found.');
        }
    } catch (e) {
        console.error('Error listing V1:', e.message);
    }
}

list();
