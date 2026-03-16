
import 'dotenv/config';
import fetch from 'node-fetch';

async function testBulkSign() {
    // Assets for koimattoru
    const keys = [
        'beats/mp3/5deec33a-a343-4d1c-a659-607dce6aea21/1772868297360_PawPaw.mp3',
        'products/covers/5deec33a-a343-4d1c-a659-607dce6aea21/1773546870886_cover.jpg'
    ];

    console.log('Testing bulk-sign with keys:', keys);
    
    // Using local dev server
    const response = await fetch('http://localhost:3000/api/r2/bulk-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys })
    });

    const data = await response.json();
    console.log('Bulk Sign Response Status:', response.status);
    
    if (data.urls) {
        for (const url of data.urls) {
            console.log(`\nTesting URL: ${url}`);
            const res = await fetch(url, { method: 'HEAD' });
            console.log(`Access Status: ${res.status} ${res.statusText}`);
        }
    } else {
        console.error('No URLs returned:', data);
    }
}

testBulkSign();
