
import 'dotenv/config';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fetch from 'node-fetch';

async function verifySignedUrls() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET_NAME;
    const key = 'beats/mp3/047faefe-c743-456c-bfe2-7b5f670b0834/1772388754126_DENIAL.mp3';

    console.log('=== V1 SIGNED URL VERIFICATION ===');
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Bucket: ${bucket}`);
    console.log(`Key: ${key}`);
    console.log(`Access Key: ${accessKeyId.substring(0, 5)}...`);

    const client = new S3Client({
        region: "auto",
        endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey }
    });

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(client, command, { expiresIn: 3600 });
    
    // Test with GET (how browser actually fetches)
    console.log('\nTesting signed URL with GET...');
    const getRes = await fetch(url);
    console.log(`GET Status: ${getRes.status} ${getRes.statusText}`);
    console.log(`Content-Length: ${getRes.headers.get('content-length')}`);
    console.log(`Content-Type: ${getRes.headers.get('content-type')}`);
    // Don't consume body, just abort
    getRes.body.destroy();

    // Test with HEAD
    console.log('\nTesting signed URL with HEAD...');
    const headRes = await fetch(url, { method: 'HEAD' });
    console.log(`HEAD Status: ${headRes.status} ${headRes.statusText}`);
    
    console.log('\n=== KOIMATTORU COVER TEST ===');
    const coverKey = 'products/covers/5deec33a-a343-4d1c-a659-607dce6aea21/1773546870886_cover.jpg';
    const coverCmd = new GetObjectCommand({ Bucket: bucket, Key: coverKey });
    const coverUrl = await getSignedUrl(client, coverCmd, { expiresIn: 86400 });
    
    const coverRes = await fetch(coverUrl);
    console.log(`Cover GET Status: ${coverRes.status} ${coverRes.statusText}`);
    console.log(`Cover Content-Length: ${coverRes.headers.get('content-length')}`);
    coverRes.body.destroy();

    console.log('\n=== KOIMATTORU MP3 TEST ===');
    const mp3Key = 'beats/mp3/5deec33a-a343-4d1c-a659-607dce6aea21/1772868297360_PawPaw.mp3';
    const mp3Cmd = new GetObjectCommand({ Bucket: bucket, Key: mp3Key });
    const mp3Url = await getSignedUrl(client, mp3Cmd, { expiresIn: 86400 });
    
    const mp3Res = await fetch(mp3Url);
    console.log(`MP3 GET Status: ${mp3Res.status} ${mp3Res.statusText}`);
    console.log(`MP3 Content-Length: ${mp3Res.headers.get('content-length')}`);
    mp3Res.body.destroy();

    console.log('\n✅ ALL DONE');
}

verifySignedUrls().catch(console.error);
