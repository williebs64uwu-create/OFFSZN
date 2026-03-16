
import 'dotenv/config';
import { getPresignedDownloadUrl } from './src/infrastructure/services/r2-storage.service.js';
import { R2_BUCKET_NAME, R2_ENDPOINT } from './src/shared/config/config.js';
import fetch from 'node-fetch';

async function testSignAndFetch363() {
    // [363] Bluehair - Version: v1
    const rawKey = 'https://offszn-storage.41d0f49121d02c88f71fdb4da54a791d.r2.cloudflarestorage.com/beats/mp3/5deec33a-a343-4d1c-a659-607dce6aea21/1772153328551_Bluehair.mp3';
    
    let key = rawKey;
    let detectedVersion = 'v1';

    if (key.startsWith('http://') || key.startsWith('https://')) {
        try {
            if (key.includes('?')) key = key.split('?')[0];
            const urlObj = new URL(key);
            key = urlObj.pathname;
        } catch (e) {}
    }

    const bucketName = 'offszn-storage';
    const normalizedPath = key.startsWith('/') ? key : `/${key}`;
    if (normalizedPath.startsWith(`/${bucketName}/`)) {
        key = normalizedPath.substring(bucketName.length + 2);
    }

    while (key.startsWith('/')) key = key.substring(1);
    
    const finalExpiresIn = 3600; 

    console.log(`Key: ${key}`);
    console.log(`Version: ${detectedVersion}`);

    const downloadUrl = await getPresignedDownloadUrl(key, finalExpiresIn, detectedVersion);
    console.log(`URL: ${downloadUrl}`);

    console.log('Fetching...');
    const res = await fetch(downloadUrl, { method: 'HEAD' });
    console.log(`Status: ${res.status} ${res.statusText}`);
    
    if (res.status !== 200) {
        const text = await res.text();
        console.log('Body:', text);
    } else {
        console.log('Headers:', JSON.stringify(res.headers.raw(), null, 2));
    }
}

testSignAndFetch363();
