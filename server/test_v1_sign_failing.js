import fetch from 'node-fetch';

async function simulateBatchSignV1() {
    const apiUrl = 'http://localhost:3000/api/r2/bulk-sign';
    const payload = {
        keys: ['products/covers/5649b865-d447-4d4a-9208-171b0ef29603/1773515625045_cover.jpg'],
        version: 'v1'
    };

    console.log('Simulating V1 batch sign request to:', apiUrl);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Response Body:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

simulateBatchSignV1();
