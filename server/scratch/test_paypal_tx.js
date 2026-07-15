import 'dotenv/config';
import fetch from 'node-fetch';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'sandbox';

const PAYPAL_API_BASE = PAYPAL_ENVIRONMENT === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken() {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    if (!res.ok) {
        throw new Error('Failed to get access token');
    }
    const data = await res.json();
    return data.access_token;
}

async function main() {
    const txId = '9SX84687JR344483S';
    console.log(`ENV: ${PAYPAL_ENVIRONMENT}`);
    console.log(`BASE: ${PAYPAL_API_BASE}`);
    
    try {
        const token = await getPayPalAccessToken();
        console.log('✅ Access token acquired.');

        // Test 1: Try v2 Captures endpoint
        console.log('\n--- TEST 1: v2/payments/captures ---');
        const resV2 = await fetch(`${PAYPAL_API_BASE}/v2/payments/captures/${txId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`v2 Status: ${resV2.status}`);
        const dataV2 = await resV2.json().catch(() => ({}));
        console.log(JSON.stringify(dataV2, null, 2));

        // Test 2: Try v1 Sales endpoint
        console.log('\n--- TEST 2: v1/payments/sale ---');
        const resV1 = await fetch(`${PAYPAL_API_BASE}/v1/payments/sale/${txId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`v1 Status: ${resV1.status}`);
        const dataV1 = await resV1.json().catch(() => ({}));
        console.log(JSON.stringify(dataV1, null, 2));

        if (dataV1.parent_payment) {
            console.log(`\nParent Payment detected: ${dataV1.parent_payment}`);
            console.log('--- TEST 3: v1/payments/payment ---');
            const resPayment = await fetch(`${PAYPAL_API_BASE}/v1/payments/payment/${dataV1.parent_payment}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`Payment Status: ${resPayment.status}`);
            const dataPayment = await resPayment.json().catch(() => ({}));
            console.log(JSON.stringify(dataPayment, null, 2));
        }

        if (dataV2.supplementary_data?.related_ids?.order_id) {
            const orderId = dataV2.supplementary_data.related_ids.order_id;
            console.log(`\nOrder ID detected: ${orderId}`);
            console.log('--- TEST 4: v2/checkout/orders ---');
            const resOrder = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`Order Status: ${resOrder.status}`);
            const dataOrder = await resOrder.json().catch(() => ({}));
            console.log(JSON.stringify(dataOrder, null, 2));
        }

    } catch (error) {
        console.error('Error during execution:', error);
    }
}

main();
