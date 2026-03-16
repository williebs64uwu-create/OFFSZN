
import * as config from './src/shared/config/config.js';

console.log('--- Config Verification ---');
console.log(`R2_ENDPOINT: ${config.R2_ENDPOINT}`);
console.log(`R2_ACCESS_KEY_ID: ${config.R2_ACCESS_KEY_ID ? 'PRESENT (First 5: ' + config.R2_ACCESS_KEY_ID.substring(0, 5) + '...)' : 'MISSING'}`);
console.log(`R2_BUCKET_NAME: ${config.R2_BUCKET_NAME}`);
console.log(`R2_ENDPOINT_V2: ${config.R2_ENDPOINT_V2}`);
console.log(`R2_ACCESS_KEY_ID_V2: ${config.R2_ACCESS_KEY_ID_V2 ? 'PRESENT (First 5: ' + config.R2_ACCESS_KEY_ID_V2.substring(0, 5) + '...)' : 'MISSING'}`);
console.log(`R2_BUCKET_NAME_V2: ${config.R2_BUCKET_NAME_V2}`);
console.log(`R2_CURRENT_VERSION: ${config.R2_CURRENT_VERSION}`);
