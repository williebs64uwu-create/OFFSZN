
import 'dotenv/config';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fetch from 'node-fetch';

async function testVhv2() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET_NAME;
    const key = 'beats/mp3/047faefe-c743-456c-bfe2-7b5f670b0834/1772388754126_DENIAL.mp3';

    console.log(`--- Testing Virtual Host Style (forcePathStyle: false) ---`);
    const client = new S3Client({
        region: "auto",
        endpoint: endpoint,
        forcePathStyle: false, // Virtual Host Style
        credentials: { accessKeyId, secretAccessKey }
    });

    try {
        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        const url = await getSignedUrl(client, command, { expiresIn: 3600 });
        console.log(`VH Signed URL: ${url}`);

        const res = await fetch(url, { method: 'HEAD' });
        console.log(`Status: ${res.status} ${res.statusText}`);
        
        if (res.status === 403) {
            const text = await res.text();
            console.log('Error Body:', text);
        }
    } catch (err) {
        console.error(`❌ FAILED: ${err.name} - ${err.message}`);
    }
}

testVhv2();
