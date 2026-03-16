
import 'dotenv/config';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fetch from 'node-fetch';

async function testVirtualHostStyle() {
    const accessKeyId = '090fc361ac3433dfeacd5b062dc37e69';
    const secretAccessKey = '82e3f0be0d50bd786b61ab36cfbc0f1d9dde953e2575672f3d20b62e8571dd6f';
    const endpoint = 'https://42fc23b11a6c329b76b2babc20afcbf7.r2.cloudflarestorage.com';
    const bucket = 'offsznlatbucket';
    const key = 'products/covers/5deec33a-a343-4d1c-a659-607dce6aea21/1773546870886_cover.jpg';

    // Virtual Host Style (forcePathStyle: false)
    const client = new S3Client({
        region: "auto",
        endpoint: endpoint,
        forcePathStyle: false,
        credentials: {
            accessKeyId,
            secretAccessKey,
        }
    });

    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
    });

    const url = await getSignedUrl(client, command, { expiresIn: 3600 });
    console.log(`Virtual Host URL: ${url}`);

    console.log('Fetching...');
    const res = await fetch(url, { method: 'HEAD' });
    console.log(`Status: ${res.status} ${res.statusText}`);
}

testVirtualHostStyle();
