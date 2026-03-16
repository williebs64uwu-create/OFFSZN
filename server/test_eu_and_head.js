
import 'dotenv/config';
import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fetch from 'node-fetch';

async function testEuEndpoint() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = 'https://41d0f49121d02c88f71fdb4da54a791d.eu.r2.cloudflarestorage.com';
    const bucket = process.env.R2_BUCKET_NAME;
    const key = 'beats/mp3/047faefe-c743-456c-bfe2-7b5f670b0834/1772388754126_DENIAL.mp3';

    console.log(`--- Testing EU Endpoint: ${endpoint} ---`);
    const client = new S3Client({
        region: "auto",
        endpoint: endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey }
    });

    try {
        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        const url = await getSignedUrl(client, command, { expiresIn: 3600 });
        console.log(`EU Signed URL: ${url}`);

        const res = await fetch(url, { method: 'HEAD' });
        console.log(`Status: ${res.status} ${res.statusText}`);
        
        console.log('\n--- Testing Signed HeadObject ---');
        const headCommand = new HeadObjectCommand({ Bucket: bucket, Key: key });
        const headUrl = await getSignedUrl(client, headCommand, { expiresIn: 3600 });
        console.log(`Head URL: ${headUrl}`);
        const headRes = await fetch(headUrl, { method: 'HEAD' });
        console.log(`Head Status: ${headRes.status} ${headRes.statusText}`);

    } catch (err) {
        console.error(`❌ FAILED: ${err.name} - ${err.message}`);
    }
}

testEuEndpoint();
