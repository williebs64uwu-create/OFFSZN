
import 'dotenv/config';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

async function testDirectGet() {
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
        console.log(`Attempting direct GetObject for key: ${key}...`);
        const data = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        console.log('✅ Success! ContentLength:', data.ContentLength);
    } catch (err) {
        console.error(`❌ DIRECT GET FAILED: ${err.name} - ${err.message}`);
    }
}

testDirectGet();
