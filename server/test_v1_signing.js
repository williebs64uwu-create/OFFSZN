import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '.env') });

const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true, // Try forcing path style
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'offszn-storage';

async function test() {
    const key = 'products/covers/ed20378e-7c14-4472-946c-89a27f53d191/1771886528431_cover.jpg';
    
    console.log(`Signing key: ${key} for bucket: ${R2_BUCKET_NAME} (FORCED PATH STYLE)`);
    
    try {
        const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key
        });
        
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        console.log('\n--- SIGNED URL ---');
        console.log(url);
        console.log('------------------\n');
        
        if (url.includes(`/${R2_BUCKET_NAME}/`)) {
            console.log('✅ URL contains bucket name in PATH correctly.');
        }

    } catch (e) {
        console.error('Signing failed:', e.message);
    }
}

test();
