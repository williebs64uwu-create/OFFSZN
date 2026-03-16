
import 'dotenv/config';
import { getPresignedDownloadUrl } from './src/infrastructure/services/r2-storage.service.js';
import { R2_BUCKET_NAME, R2_BUCKET_NAME_V2, R2_CURRENT_VERSION } from './src/shared/config/config.js';

const bucketNames = [R2_BUCKET_NAME, 'offsznlatbucket', 'offszn-storage'].filter(b => b);

async function testSign485() {
    const rawKey = 'https://42fc23b11a6c329b76b2babc20afcbf7.r2.cloudflarestorage.com/offsznlatbucket/products/covers/5deec33a-a343-4d1c-a659-607dce6aea21/1773546870886_cover.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=090fc361ac3433dfeacd5b062dc37e69%2F20260315%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260315T035459Z&X-Amz-Expires=86400&X-Amz-Signature=04014169ea936ca1f72cec4321e6608ec935ac1641e31db361f72ed027c5eec3&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject';
    
    let key = rawKey;
    let detectedVersion = null;

    if (key.includes('offsznlatbucket') || key.includes('42fc23b11a6c329b76b2babc20afcbf7')) {
        detectedVersion = 'v2';
    } else if (key.includes('offszn-storage') || key.includes('41d0f49121d02c88f71fdb4da54a791d')) {
        detectedVersion = 'v1';
    }

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
    
    // This is the logic I added to r2.routes.js
    const itemVersion = detectedVersion || R2_CURRENT_VERSION || 'v2';
    const finalExpiresIn = 86400; // public
    const signVersion = itemVersion;

    console.log(`Key to sign: ${key}`);
    console.log(`Version: ${signVersion}`);

    const downloadUrl = await getPresignedDownloadUrl(key, finalExpiresIn, signVersion);
    console.log(`NEW SIGNED URL: ${downloadUrl}`);
}

testSign485();
