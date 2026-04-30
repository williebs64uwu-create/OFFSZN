
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env manually to avoid dependencies
const envPath = path.join(__dirname, 'server', '.env');
const envConfig = fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .reduce((acc, line) => {
        const [key, value] = line.split('=');
        if (key && value) acc[key.trim()] = value.trim();
        return acc;
    }, {});

const clientId = envConfig.PAYPAL_CLIENT_ID;
const secret = envConfig.PAYPAL_CLIENT_SECRET;
const env = envConfig.PAYPAL_ENVIRONMENT || 'sandbox';

const API_BASE = env === 'sandbox' 
    ? 'api-m.sandbox.paypal.com' 
    : 'api-m.paypal.com';

function request(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) reject(parsed);
                    else resolve(parsed);
                } catch (e) {
                    reject(data);
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function getAccessToken() {
    const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: API_BASE,
            path: '/v1/oauth2/token',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const parsed = JSON.parse(data);
                resolve(parsed.access_token);
            });
        });
        req.on('error', reject);
        req.write('grant_type=client_credentials');
        req.end();
    });
}

async function createProduct(token) {
    console.log('Creating Product...');
    const res = await request({
        hostname: API_BASE,
        path: '/v1/catalogs/products',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    }, {
        name: 'OFFSZN Subscriptions',
        description: 'Acceso Premium a la plataforma OFFSZN',
        type: 'SERVICE',
        category: 'SOFTWARE'
    });
    console.log('Product Created:', res.id);
    return res.id;
}

async function createPlan(token, productId, name, description, price) {
    console.log(`Creating Plan: ${name} ($${price}/year)...`);
    const res = await request({
        hostname: API_BASE,
        path: '/v1/billing/plans',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    }, {
        product_id: productId,
        name: name,
        description: description,
        status: 'ACTIVE',
        billing_cycles: [
            {
                frequency: {
                    interval_unit: 'YEAR',
                    interval_count: 1
                },
                tenure_type: 'REGULAR',
                sequence: 1,
                total_cycles: 0,
                pricing_scheme: {
                    fixed_price: {
                        value: price,
                        currency_code: 'USD'
                    }
                }
            }
        ],
        payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee: {
                value: '0',
                currency_code: 'USD'
            },
            setup_fee_failure_action: 'CONTINUE',
            payment_failure_threshold: 3
        }
    });
    console.log(`Plan Created (${name}):`, res.id);
    return res.id;
}

async function main() {
    try {
        console.log(`Using Environment: ${env}`);
        const token = await getAccessToken();
        const productId = await createProduct(token);

        const starterId = await createPlan(token, productId, 'Starter Annual', 'Suscripción Starter Anual - OFFSZN', '20.00');
        const proId = await createPlan(token, productId, 'PRO Annual', 'Suscripción PRO Anual - OFFSZN', '30.00');

        console.log('\n--- SUCCESS! ---');
        console.log(`STARTER_ANNUAL_PLAN_ID: ${starterId}`);
        console.log(`PRO_ANNUAL_PLAN_ID: ${proId}`);
        console.log('----------------\n');
    } catch (e) {
        console.error('Error:', e);
    }
}

main();
