
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, './.env') });

const clean = (val) => val ? val.replace(/^[A-Z0-9_]+:\s*/, '').trim() : val;

const v1Config = {
    endpoint: clean(process.env.R2_ENDPOINT),
    credentials: {
        accessKeyId: clean(process.env.R2_ACCESS_KEY_ID),
        secretAccessKey: clean(process.env.R2_SECRET_ACCESS_KEY),
    },
    bucket: clean(process.env.R2_BUCKET_NAME) || 'offszn-storage'
};

const testKey = 'products/covers/a760d327-ab0b-43e6-8247-811279adc859/1772172136149_cover.jpg';

async function testV1() {
    console.log(`--- Testing signing/fetching from V1 ---`);
    const client = new S3Client({
        region: "auto",
        endpoint: v1Config.endpoint,
        credentials: v1Config.credentials,
        forcePathStyle: true
    });

    const command = new GetObjectCommand({
        Bucket: v1Config.bucket,
        Key: testKey
    });

    try {
        const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
        console.log(`Signed URL: ${signedUrl}`);

        const response = await fetch(signedUrl);
        console.log(`Response Status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            const text = await response.text();
            console.log(`Response Body: ${text.substring(0, 500)}`);
        } else {
            console.log(`✅ Fetch successful! Size: ${response.headers.get('content-length')}`);
        }
    } catch (err) {
        console.error(`Error in test:`, err);
    }
}

testV1();
