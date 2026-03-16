
import 'dotenv/config';
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

async function verifyV1() {
    const accessKeyId = 'fde8e2b1c3e4471a6fac78031d5e4160';
    const secretAccessKey = '34f402635a754ec4abad5d18763f414c54587d7df438a6fa1d9e91ba43b47489';
    const endpoint = 'https://41d0f49121d02c88f71fdb4da54a791d.r2.cloudflarestorage.com';

    const client = new S3Client({
        region: "auto",
        endpoint: endpoint,
        credentials: { accessKeyId, secretAccessKey }
    });

    try {
        console.log('Testing V1 credentials... listing buckets...');
        const data = await client.send(new ListBucketsCommand({}));
        console.log('Success! Buckets found:', data.Buckets.map(b => b.Name));
    } catch (err) {
        console.error('V1 VERIFICATION FAILED:', err.name, err.message);
    }
}

verifyV1();
