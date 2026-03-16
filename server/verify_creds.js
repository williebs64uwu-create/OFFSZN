
import 'dotenv/config';
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

async function verifyV1() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;

    const client = new S3Client({
        region: "auto",
        endpoint: endpoint,
        credentials: { accessKeyId, secretAccessKey }
    });

    try {
        console.log('Testing R2 credentials from .env...');
        const data = await client.send(new ListBucketsCommand({}));
        console.log('Success! Buckets found:', data.Buckets.map(b => b.Name));
    } catch (err) {
        console.error('R2 VERIFICATION FAILED:', err.name, err.message);
    }
}

verifyV1();
