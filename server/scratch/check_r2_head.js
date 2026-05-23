import { getClientAndBucket } from '../src/infrastructure/services/r2-storage.service.js';
import { HeadObjectCommand } from '@aws-sdk/client-s3';

async function testHead(version) {
    console.log(`\n--- Testing Head on ${version} ---`);
    const { client, bucket } = getClientAndBucket(version);
    console.log(`Bucket: ${bucket}, Client exists: ${!!client}`);
    
    const start = Date.now();
    try {
        const command = new HeadObjectCommand({
            Bucket: bucket,
            Key: 'nonexistent-test-file-12345.jpg'
        });
        await client.send(command);
        console.log(`[${version}] Result: Success (Unexpected!) in ${Date.now() - start}ms`);
    } catch (err) {
        console.log(`[${version}] Result: Caught Error in ${Date.now() - start}ms:`, err.name || err.message);
    }
}

async function run() {
    await testHead('v1');
    await testHead('v2');
    await testHead('v3');
}

run();
