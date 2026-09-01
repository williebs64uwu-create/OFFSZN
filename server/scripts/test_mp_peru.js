import fetch from 'node-fetch';

const accessToken = 'TEST-3149823083942106-083118-c0b263a2bf20a381441ef931aba2b3d2-3653881661';

async function testMP() {
    try {
        console.log('Testing New Mercado Pago API Credentials...');
        
        // 1. Get Payment Methods
        const resMethods = await fetch('https://api.mercadopago.com/v1/payment_methods', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const methods = await resMethods.json();
        console.log('Payment Methods response status:', resMethods.status);
        if (Array.isArray(methods)) {
            console.log('Available Payment Methods:');
            methods.forEach(m => {
                console.log(`- ID: ${m.id} | Name: ${m.name} | Type: ${m.payment_type_id} | Status: ${m.status}`);
            });
        } else {
            console.log('Methods:', methods);
        }

        // 2. Test User Info
        const resUser = await fetch('https://api.mercadopago.com/users/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const user = await resUser.json();
        console.log('\nAccount Info:');
        console.log('User ID:', user.id);
        console.log('Nickname:', user.nickname);
        console.log('Country:', user.site_id); // e.g. MPE (Mercado Pago Peru)
        console.log('Currency:', user.default_currency_id);

    } catch (e) {
        console.error('Error:', e);
    }
}

testMP();
