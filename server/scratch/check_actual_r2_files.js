import { existsInR2 } from '../src/infrastructure/services/r2-storage.service.js';

async function run() {
    const keys = [
        'products/covers/0382a813-85c7-46c3-8d2c-61a5692adffd/1777849573752_cover.jpg',
        'products/covers/0382a813-85c7-46c3-8d2c-61a5692adffd/1775697725025_cover.jpg',
        'products/covers/0382a813-85c7-46c3-8d2c-61a5692adffd/1774225861578_cover_edit.jpg',
        'products/covers/0382a813-85c7-46c3-8d2c-61a5692adffd/1774722797874_cover_edit.jpg',
        'products/covers/0382a813-85c7-46c3-8d2c-61a5692adffd/1776970895394_cover.jpg',
        'products/covers/0382a813-85c7-46c3-8d2c-61a5692adffd/1776642666014_cover.jpg'
    ];

    console.log('Checking existence of actual files in R2 buckets...');
    
    for (const key of keys) {
        console.log(`\nKey: ${key}`);
        for (const version of ['v1', 'v2', 'v3']) {
            const exists = await existsInR2(key, version);
            console.log(`  - Version ${version}: ${exists ? '✅ FOUND' : '❌ NOT FOUND'}`);
        }
    }
}

run();
