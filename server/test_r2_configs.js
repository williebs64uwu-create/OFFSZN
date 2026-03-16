
import 'dotenv/config';
import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fetch from 'node-fetch';

async function testConfigurations() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET_NAME;

    // Use a known existing key from the ListObjects test
    const key = 'beats/mp3/047faefe-c743-456c-bfe2-7b5f670b0834/1772388754126_DENIAL.mp3';

    const configs = [
        { name: 'Path Style, Auto Region', forcePathStyle: true, region: 'auto' },
        { name: 'Virtual Host Style, Auto Region', forcePathStyle: false, region: 'auto' },
        { name: 'Path Style, US-East-1', forcePathStyle: true, region: 'us-east-1' }
    ];

    for (const config of configs) {
        console.log(`\n--- Testing: ${config.name} ---`);
        const client = new S3Client({
            region: config.region,
            endpoint: endpoint,
            forcePathStyle: config.forcePathStyle,
            credentials: { accessKeyId, secretAccessKey }
        });

        try {
            // First, verify object exists with HEAD
            await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
            console.log('✅ Object exists (HeadObject success)');

            const command = new GetObjectCommand({ Bucket: bucket, Key: key });
            const url = await getSignedUrl(client, command, { expiresIn: 3600 });
            console.log(`URL: ${url}`);

            const res = await fetch(url, { method: 'HEAD' });
            console.log(`Status: ${res.status} ${res.statusText}`);
        } catch (err) {
            console.error(`❌ FAILED: ${err.name} - ${err.message}`);
        }
    }
}

testConfigurations();
