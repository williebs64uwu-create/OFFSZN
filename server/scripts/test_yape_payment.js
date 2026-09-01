import fetch from 'node-fetch';

const publicKey = 'TEST-70d4423f-6d23-4bb3-807a-0b9565693d83';
const accessToken = 'TEST-3149823083942106-083118-c0b263a2bf20a381441ef931aba2b3d2-3653881661';

async function testYapeTokenAndPayment() {
    try {
        console.log('--- 1. Testing Token Creation for Yape ---');
        const tokenRes = await fetch(`https://api.mercadopago.com/v1/tokens?public_key=${publicKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber: '987654321',
                otp: '123456'
            })
        });

        const tokenData = await tokenRes.json();
        console.log('Token Status:', tokenRes.status);
        console.log('Token Response:', tokenData);

        if (tokenData.id) {
            console.log('\n--- 2. Testing Payment with Yape Token ---');
            const paymentRes = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': 'yape-pay-' + Date.now()
                },
                body: JSON.stringify({
                    token: tokenData.id,
                    transaction_amount: 16.50, // 5 USD * 3.30 = 16.50 PEN
                    description: 'Easy Mix VST - Licencia Vitalicia (Test Yape)',
                    payment_method_id: 'yape',
                    payer: {
                        email: 'comprador_test@gmail.com'
                    }
                })
            });

            const paymentData = await paymentRes.json();
            console.log('Payment Status HTTP:', paymentRes.status);
            console.log('Payment Result:', JSON.stringify(paymentData, null, 2));
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

testYapeTokenAndPayment();
