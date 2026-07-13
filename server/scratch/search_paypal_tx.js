import 'dotenv/config';
import fetch from 'node-fetch';

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
        throw new Error('Failed to get token');
    }
    const data = await res.json();
    return data.access_token;
};

async function main() {
    try {
        const token = await getPayPalAccessToken();
        const txId = '7JF12778BE116424H';
        
        // Transaction Search API
        // Format: GET /v1/reporting/transactions?transaction_id=XXX&start_date=2026-07-01T00:00:00Z&end_date=2026-07-13T23:59:59Z
        const start = '2026-07-01T00:00:00Z';
        const end = '2026-07-13T23:59:59Z';
        
        console.log(`Searching for transaction: ${txId} from ${start} to ${end}...`);
        const url = `${PAYPAL_API_BASE}/v1/reporting/transactions?transaction_id=${txId}&start_date=${start}&end_date=${end}`;
        
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response status:', res.status);
        const data = await res.json();
        console.log('Transaction Data:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

main();
