import fetch from 'node-fetch';

async function simulateBatchSign() {
    const apiUrl = 'http://localhost:3000/api/r2/bulk-sign';
    const payload = {
        keys: ['products/covers/5649b865-d447-4d4a-9208-171b0ef29603/1773515625045_cover.jpg'],
        version: 'v2'
    };

    console.log('Simulating batch sign request to:', apiUrl);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log('Response Status:', response.status);
        const data = await response.json();
        console.log('Response Body:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

simulateBatchSign();
