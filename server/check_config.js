
import * as cfg from './src/shared/config/config.js';

console.log('--- CONFIG CHECK ---');
console.log(`R2_ENDPOINT (V1): ${cfg.R2_ENDPOINT ? 'PRESENT' : 'MISSING'}`);
console.log(`R2_ACCESS_KEY_ID (V1): ${cfg.R2_ACCESS_KEY_ID ? 'PRESENT' : 'MISSING'}`);
console.log(`R2_SECRET_ACCESS_KEY (V1): ${cfg.R2_SECRET_ACCESS_KEY ? 'PRESENT' : 'MISSING'}`);

console.log(`\nR2_ENDPOINT_V2: ${cfg.R2_ENDPOINT_V2 ? 'PRESENT' : 'MISSING'}`);
if (cfg.R2_ENDPOINT_V2 === 'https://42fc23b11a6c329b76b2babc20afcbf7.r2.cloudflarestorage.com') {
    console.log('   (Note: Using hardcoded fallback for V2)');
}
