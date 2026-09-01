async function testProductionCredentials() {
    const accessToken = 'APP_USR-3149823083942106-083118-90df5f34038bf7eb4208fc29f733a5a8-3653881661';
    
    console.log('🔍 Testing Mercado Pago Production Token...');
    try {
        const userRes = await fetch('https://api.mercadopago.com/users/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const userData = await userRes.json();
        console.log('✅ User Info:', {
            id: userData.id,
            nickname: userData.nickname,
            email: userData.email,
            country_id: userData.country_id,
            site_id: userData.site_id
        });

        const pmRes = await fetch('https://api.mercadopago.com/v1/payment_methods', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const pmData = await pmRes.json();
        const yapePm = pmData.find(p => p.id.toLowerCase() === 'yape');
        console.log('✅ Yape Payment Method in Production:', yapePm);
    } catch (e) {
        console.error('❌ Error checking credentials:', e);
    }
}

testProductionCredentials();
