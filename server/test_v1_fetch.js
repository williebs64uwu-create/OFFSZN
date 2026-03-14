import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '.env') });

const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'offszn-storage';

async function test() {
    // This key was definitely in the list earlier
    const key = 'products/covers/ed20378e-7c14-4472-946c-89a27f53d191/1771886528431_cover.jpg';
    
    console.log(`Testing with key: ${key}`);
    
    try {
        const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key
        });
        
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        console.log(`Signed URL: ${url}`);
        
        const response = await fetch(url);
        console.log(`Response Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
            console.log('✅ FETCH SUCCESSFUL!');
        } else {
            console.log('❌ FETCH FAILED.');
            // Try virtual-hosted style as fallback
            const vhClient = new S3Client({
                region: 'auto',
                endpoint: process.env.R2_ENDPOINT,
                forcePathStyle: false,
                credentials: {
                    accessKeyId: process.env.R2_ACCESS_KEY_ID,
                    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
                }
            });
            const vhUrl = await getSignedUrl(vhClient, command, { expiresIn: 3600 });
            console.log(`Trying Virtual-Hosted URL: ${vhUrl}`);
            const vhResponse = await fetch(vhUrl);
            console.log(`VH Response Status: ${vhResponse.status} ${vhResponse.statusText}`);
        }

    } catch (e) {
        console.error('Test failed:', e.message);
    }
}

test();
