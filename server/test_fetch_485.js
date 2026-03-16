
import 'dotenv/config';
import { getPresignedDownloadUrl } from './src/infrastructure/services/r2-storage.service.js';
import { R2_BUCKET_NAME, R2_BUCKET_NAME_V2, R2_CURRENT_VERSION } from './src/shared/config/config.js';
import fetch from 'node-fetch';

const bucketNames = [R2_BUCKET_NAME, 'offsznlatbucket', 'offszn-storage'].filter(b => b);

async function testSignAndFetch485() {
    const rawKey = 'https://42fc23b11a6c329b76b2babc20afcbf7.r2.cloudflarestorage.com/offsznlatbucket/products/covers/5deec33a-a343-4d1c-a659-607dce6aea21/1773546870886_cover.jpg';
    
    let key = rawKey;
    let detectedVersion = 'v2'; // Forced for this test

    if (key.startsWith('http://') || key.startsWith('https://')) {
        try {
            if (key.includes('?')) key = key.split('?')[0];
            const urlObj = new URL(key);
            key = urlObj.pathname;
        } catch (e) {}
    }

    for (const b of bucketNames) {
        const normalizedPath = key.startsWith('/') ? key : `/${key}`;
        if (normalizedPath.startsWith(`/${b}/`)) {
            key = normalizedPath.substring(b.length + 2);
            break;
        }
    }

    while (key.startsWith('/')) key = key.substring(1);
    
    const itemVersion = detectedVersion || R2_CURRENT_VERSION || 'v2';
    const finalExpiresIn = 3600; 

    console.log(`Key: ${key}`);
    console.log(`Version: ${itemVersion}`);

    const downloadUrl = await getPresignedDownloadUrl(key, finalExpiresIn, itemVersion);
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

testSignAndFetch485();
