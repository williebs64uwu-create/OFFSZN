const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const v1Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const v2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_V2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_V2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_V2_SECRET_ACCESS_KEY,
    },
});

const v1Bucket = process.env.R2_BUCKET_NAME; // offszn-storage
const v2Bucket = process.env.R2_V2_BUCKET_NAME; // offsznlatbucket

async function checkFile(key) {
    console.log(`Checking key: ${key}`);
    
    // Check V2
    try {
        await v2Client.send(new HeadObjectCommand({ Bucket: v2Bucket, Key: key }));
        console.log(`[V2] FOUND: ${key}`);
        return 'v2';
    } catch (e) {
        console.log(`[V2] NOT FOUND: ${key}`);
    }

    // Check V1
    try {
        await v1Client.send(new HeadObjectCommand({ Bucket: v1Bucket, Key: key }));
        console.log(`[V1] FOUND: ${key}`);
        return 'v1';
    } catch (e) {
        console.log(`[V1] NOT FOUND: ${key}`);
    }

    return null;
}

const targetKey = 'products/covers/5deec33a-a343-4d1c-a659-607dce6aea21/1773420050429_cover.jpg';
checkFile(targetKey).then(() => {
    // Try without products prefix
    return checkFile('covers/5deec33a-a343-4d1c-a659-607dce6aea21/1773420050429_cover.jpg');
});
