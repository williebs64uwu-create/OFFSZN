import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';
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

const getPayPalCaptureDetails = async (captureId, accessToken) => {
    const res = await fetch(`${PAYPAL_API_BASE}/v2/payments/captures/${captureId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch PayPal capture details for ID: ${captureId}`);
    }
    return await res.json();
};

const getOrderDetails = async (orderId, accessToken) => {
    const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch PayPal order details for ID: ${orderId}`);
    }
    return await res.json();
};

async function simulateWebhook(transactionId) {
    console.log(`🚀 Simulating PAYMENT.SALE.COMPLETED webhook for ${transactionId}...`);

    try {
        // Fetch official API details to secure verification
        const accessToken = await getPayPalAccessToken();
        let payerEmail = '';
        let amountPaid = 0;
        let isEasyMixPurchase = false;

        // Simulate logic
        const captureDetails = await getPayPalCaptureDetails(transactionId, accessToken);
        console.log('Capture Details fetched successfully.');
        
        const orderId = captureDetails.supplementary_data?.related_ids?.order_id;
        console.log(`Related Order ID: ${orderId}`);

        if (orderId) {
            const orderDetails = await getOrderDetails(orderId, accessToken);
            console.log('Order Details fetched successfully.');
            
            payerEmail = orderDetails.payer?.email_address;
            const purchaseUnit = orderDetails.purchase_units?.[0];
            amountPaid = parseFloat(purchaseUnit?.amount?.value || '0');
            
            const description = purchaseUnit?.description || '';
            const items = purchaseUnit?.items || [];
            
            console.log('Items in purchase:', items);
            const hasEasyMixInItems = items.some(item => 
                item.name?.toLowerCase().includes('easy mix') || 
                item.name?.toLowerCase().includes('easymix')
            );
            
            isEasyMixPurchase = description.toLowerCase().includes('easy mix') || 
                                description.toLowerCase().includes('easymix') || 
                                hasEasyMixInItems;
        }

        console.log(`Email resolved: ${payerEmail}`);
        console.log(`Amount: ${amountPaid}`);
        console.log(`Is Easy Mix purchase? ${isEasyMixPurchase}`);

        if (isEasyMixPurchase) {
            // Find matched user
            let matchedUserId = null;
            const { data: matchedUser } = await supabase
                .from('users')
                .select('id')
                .eq('email', payerEmail)
                .maybeSingle();
            
            if (matchedUser) {
                matchedUserId = matchedUser.id;
                console.log(`Matched user in DB: ${matchedUserId}`);
            } else {
                console.log('No matched user in DB (will process as guest).');
            }

            console.log('✅ Simulation completed. Webhook logic is capable of processing this payment.');
        } else {
            console.log('❌ Not an Easy Mix purchase, skipped.');
        }

    } catch (err) {
        console.error('❌ Error during simulation:', err);
    }
}

simulateWebhook('9SX84687JR344483S');
