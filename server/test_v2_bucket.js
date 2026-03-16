
import 'dotenv/config';
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

async function testV2Bucket() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = 'offsznlatbucket';

    const client = new S3Client({
        region: "auto",
        endpoint: endpoint,
        credentials: { accessKeyId, secretAccessKey }
    });

    try {
        console.log(`Testing ListObjectsV2 for V2 bucket: ${bucket}...`);
        const data = await client.send(new ListObjectsV2Command({
            Bucket: bucket,
            MaxKeys: 5
        }));
        console.log('✅ Success! Found objects:', data.Contents.map(o => o.Key));
    } catch (err) {
        console.error('❌ V2 BUCKET TEST FAILED:', err.name, err.message);
    }
}

testV2Bucket();
