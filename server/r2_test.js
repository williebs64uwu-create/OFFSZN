
import dotenv from 'dotenv';
import { getPresignedUploadUrl, getPresignedDownloadUrl, getPublicUrl } from './src/infrastructure/services/r2-storage.service.js';
import * as config from './src/shared/config/config.js';

dotenv.config();

async function runTests() {
  console.log('?? Starting R2 Dual Account Integration Tests...\n');

  try {
    // 1. Test V1 (Read-Only Legacy)
    console.log('--- Testing R2 V1 (Legacy) ---');
    const uploadUrlV1 = await getPresignedUploadUrl('test-v1.txt', 'text/plain', 'v1');
    const downloadUrlV1 = await getPresignedDownloadUrl('test-v1.txt', 3600, 'v1');
    const publicUrlV1 = getPublicUrl('test-v1.txt', 'v1');

    console.log('Bucket V1:', config.R2_BUCKET_NAME);
    console.log('Upload URL includes V1 Bucket:', uploadUrlV1.includes(config.R2_BUCKET_NAME));
    console.log('Public URL V1:', publicUrlV1);
    console.log('');

    // 2. Test V2 (New Uploads)
    console.log('--- Testing R2 V2 (New) ---');
    const uploadUrlV2 = await getPresignedUploadUrl('test-v2.txt', 'text/plain', 'v2');
    const downloadUrlV2 = await getPresignedDownloadUrl('test-v2.txt', 3600, 'v2');
    const publicUrlV2 = getPublicUrl('test-v2.txt', 'v2');

    console.log('Bucket V2:', config.R2_BUCKET_NAME_V2);
    console.log('Upload URL includes V2 Bucket:', uploadUrlV2.includes(config.R2_BUCKET_NAME_V2));
    console.log('Public URL V2:', publicUrlV2);
    console.log('');

    // 3. Verify Redirection logic
    if (uploadUrlV1.includes(config.R2_BUCKET_NAME) && uploadUrlV2.includes(config.R2_BUCKET_NAME_V2)) {
      console.log('✅ SUCCESS: Versioned routing is working correctly!');
    } else {
      console.log('❌ FAILURE: Versioned routing is NOT working as expected.');
    }

  } catch (error) {
    console.error('❌ TEST FAILED with error:', error);
  }
}

runTests();
