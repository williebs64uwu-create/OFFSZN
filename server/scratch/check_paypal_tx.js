import 'dotenv/config';
import fetch from 'node-fetch'; // If node doesn't have global fetch in this version, import it
// Note: Node 18+ has global fetch, but let's see. Node 24 definitely has it.

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'sandbox';

const PAYPAL_API_BASE = PAYPAL_ENVIRONMENT === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const getPayPalAccessToken = async () => {
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
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error_description || 'Failed to get PayPal access token');
    }
    const data = await res.json();
    return data.access_token;
};

const getSaleDetails = async (saleId, accessToken) => {
    const res = await fetch(`${PAYPAL_API_BASE}/v1/payments/sale/${saleId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch PayPal sale details for ID: ${saleId}`);
    }
    return await res.json();
};

const getPaymentDetails = async (paymentId, accessToken) => {
    const res = await fetch(`${PAYPAL_API_BASE}/v1/payments/payment/${paymentId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch PayPal payment details for ID: ${paymentId}`);
    }
    return await res.json();
};

async function main() {
    try {
        console.log('1. Fetching PayPal Access Token...');
        const token = await getPayPalAccessToken();
        console.log('Token retrieved successfully.');

        // Let's query the live transaction ID from the screenshot: 7JF12778BE116424H
        const saleId = '7JF12778BE116424H';
        console.log(`\n2. Fetching Sale Details for ID: ${saleId}...`);
        const sale = await getSaleDetails(saleId, token);
        console.log('Sale Details:', JSON.stringify(sale, null, 2));

        const parentPaymentId = sale.parent_payment;
        if (parentPaymentId) {
            console.log(`\n3. Fetching Parent Payment Details for ID: ${parentPaymentId}...`);
            const payment = await getPaymentDetails(parentPaymentId, token);
            console.log('Payment Details:', JSON.stringify(payment, null, 2));
        } else {
            console.log('No parent payment found in sale resource.');
        }

    } catch (err) {
        console.error('Error querying PayPal API:', err);
    }
}

main();
