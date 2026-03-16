
import 'dotenv/config';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fetch from 'node-fetch';

async function testNoChecksum() {
    const accessKeyId = 'fde8e2b1c3e4471a6fac78031d5e4160';
    const secretAccessKey = '34f402635a754ec4abad5d18763f414c54587d7df438a6fa1d9e91ba43b47489';
    const endpoint = 'https://41d0f49121d02c88f71fdb4da54a791d.r2.cloudflarestorage.com';
    const bucket = 'offszn-storage';
    const key = 'beats/mp3/5deec33a-a343-4d1c-a659-607dce6aea21/1772153328551_Bluehair.mp3';

    // Disable checksums
    const client = new S3Client({
        region: "auto",
        endpoint: endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey },
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED"
    });

    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
    });

    const url = await getSignedUrl(client, command, { expiresIn: 3600 });
    console.log(`URL: ${url}`);

    if (url.includes('checksum')) {
        console.log('--- WARNING: Checksum still present in URL ---');
    }

    console.log('Fetching...');
    const res = await fetch(url, { method: 'HEAD' });
    console.log(`Status: ${res.status} ${res.statusText}`);
}

testNoChecksum();
