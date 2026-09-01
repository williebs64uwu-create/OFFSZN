import fetch from 'node-fetch';

async function testYapeRoutes() {
    try {
        console.log('--- 1. Testing GET /api/orders/yape/config ---');
        const resConfig = await fetch('http://localhost:3000/api/orders/yape/config');
        const configData = await resConfig.json();
        console.log('Status:', resConfig.status);
        console.log('Config Data:', configData);

        console.log('\n--- 2. Testing POST /api/orders/yape/charge (Validation check) ---');
        const resCharge = await fetch('http://localhost:3000/api/orders/yape/charge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: '',
                email: 'bademail',
                phoneNumber: '123'
            })
        });
        const chargeData = await resCharge.json();
        console.log('Status:', resCharge.status);
        console.log('Charge Error Response:', chargeData);

    } catch (e) {
        console.error('Error:', e);
    }
}

testYapeRoutes();
