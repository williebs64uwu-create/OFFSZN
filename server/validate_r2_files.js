import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
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

const s3ClientV2 = new S3Client({
    region: 'auto',
    endpoint: 'https://42fc23b11a6c329b76b2babc20afcbf7.r2.cloudflarestorage.com',
    credentials: {
        accessKeyId: '090fc361ac3433dfeacd5b062dc37e69',
        secretAccessKey: '82e3f0be0d50bd786b61ab36cfbc0f1d9dde953e2575672f3d20b62e8571dd6f',
    }
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'offszn-storage';
const R2_BUCKET_NAME_V2 = 'offsznlatbucket';

async function validate() {
    const keys = [
        '1772172136149_cover.jpg',
        '177189993380_cover.jpg',
        '1771787329337_cover.jpg',
        '1771208933318_cover.jpg',
        'products/covers/1772172136149_cover.jpg'
    ];

    for (const key of keys) {
        console.log(`\n--- Checking Key: ${key} ---`);
        
        // Check V1
        try {
            await s3Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
            console.log(`✅ FOUND in V1: ${key}`);
        } catch (e) {
            console.log(`❌ NOT in V1: ${key}`);
        }

        // Check V2
        try {
            await s3ClientV2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME_V2, Key: key }));
            console.log(`✅ FOUND in V2: ${key}`);
        } catch (e) {
            console.log(`❌ NOT in V2: ${key}`);
        }
    }
}

validate();
