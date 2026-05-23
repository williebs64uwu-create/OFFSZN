import { getClientAndBucket, existsInR2, checkKeyExists, resolveScavengerKey } from '../src/infrastructure/services/r2-storage.service.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { R2_CURRENT_VERSION } from '../src/shared/config/config.js';

async function run() {
    console.log('R2 CURRENT VERSION:', R2_CURRENT_VERSION);
    const testKey = 'products/covers/0382a813-85c7-46c3-8d2c-61a5692adffd/1776036163980_cover.jpg';
    console.log('Testing key:', testKey);

    const discovery = await resolveScavengerKey(testKey, R2_CURRENT_VERSION);
    console.log('Discovery result:', discovery);

    const { client, bucket } = getClientAndBucket(discovery.version);
    console.log('Using bucket:', bucket, 'with version:', discovery.version);

    try {
        const command = new GetObjectCommand({ Bucket: bucket, Key: discovery.key });
        const response = await client.send(command);
        console.log('GetObject response success!');
        console.log('ContentType:', response.ContentType);
        console.log('ContentLength:', response.ContentLength);
        console.log('Body constructor name:', response.Body ? response.Body.constructor.name : 'null/undefined');
        console.log('Body type:', typeof response.Body);
        console.log('Has pipe method:', response.Body && typeof response.Body.pipe === 'function');
    } catch (err) {
        console.error('GetObject error:', err);
    }
}

run();
