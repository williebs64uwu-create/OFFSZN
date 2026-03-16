
import 'dotenv/config';
import { S3Client, ListBucketsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

async function checkBuckets() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;

    const client = new S3Client({
        region: "auto",
        endpoint: endpoint,
        credentials: { accessKeyId, secretAccessKey }
    });

    // Try listing buckets (might fail if token doesn't have account-level perms)
    try {
        const data = await client.send(new ListBucketsCommand({}));
        console.log('All buckets in this account:', data.Buckets.map(b => b.Name));
    } catch (err) {
        console.log('Cannot list buckets (permission restricted):', err.message);
    }

    // Try accessing offsznlatbucket directly
    try {
        const data = await client.send(new ListObjectsV2Command({
            Bucket: 'offsznlatbucket',
            MaxKeys: 3
        }));
        console.log('\n✅ offsznlatbucket EXISTS! Objects:', data.Contents?.map(o => o.Key) || 'empty');
    } catch (err) {
        console.log('\n❌ offsznlatbucket:', err.name, err.message);
    }

    // Confirm offszn-storage works
    try {
        const data = await client.send(new ListObjectsV2Command({
            Bucket: 'offszn-storage',
            MaxKeys: 3
        }));
        console.log('\n✅ offszn-storage EXISTS! Objects:', data.Contents?.map(o => o.Key));
    } catch (err) {
        console.log('\n❌ offszn-storage:', err.name, err.message);
    }

    // Try secure-products
    try {
        const data = await client.send(new ListObjectsV2Command({
            Bucket: 'secure-products',
            MaxKeys: 3
        }));
        console.log('\n✅ secure-products EXISTS! Objects:', data.Contents?.map(o => o.Key) || 'empty');
    } catch (err) {
        console.log('\n❌ secure-products:', err.name, err.message);
    }
}

checkBuckets().catch(console.error);
