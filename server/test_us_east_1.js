
import 'dotenv/config';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fetch from 'node-fetch';

async function testUsEast1() {
    const accessKeyId = 'fde8e2b1c3e4471a6fac78031d5e4160';
    const secretAccessKey = '34f402635a754ec4abad5d18763f414c54587d7df438a6fa1d9e91ba43b47489';
    const endpoint = 'https://41d0f49121d02c88f71fdb4da54a791d.r2.cloudflarestorage.com';
    const bucket = 'offszn-storage';
    const key = 'beats/mp3/5deec33a-a343-4d1c-a659-607dce6aea21/1772868297360_PawPaw.mp3';

    // Use us-east-1 instead of auto
    const client = new S3Client({
        region: "us-east-1",
        endpoint: endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey }
    });

    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
    });

    const url = await getSignedUrl(client, command, { expiresIn: 3600 });
    console.log(`URL: ${url}`);

    console.log('Fetching...');
    const res = await fetch(url, { method: 'HEAD' });
    console.log(`Status: ${res.status} ${res.statusText}`);
}

testUsEast1();
