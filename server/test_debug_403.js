
import 'dotenv/config';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fetch from 'node-fetch';

async function debug403() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET_NAME;
    const key = 'beats/mp3/047faefe-c743-456c-bfe2-7b5f670b0834/1772388754126_DENIAL.mp3';

    const client = new S3Client({
        region: "auto",
        endpoint: endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey }
    });

    try {
        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        // Use a very short expiration to minimize drift window if that's an issue
        const url = await getSignedUrl(client, command, { expiresIn: 60 });
        console.log(`Testing URL: ${url}`);

        const res = await fetch(url);
        console.log(`Status: ${res.status} ${res.statusText}`);
        
        const text = await res.text();
        console.log('--- ERROR BODY ---');
        console.log(text);
        console.log('------------------');

    } catch (err) {
        console.error('Test script error:', err);
    }
}

debug403();
