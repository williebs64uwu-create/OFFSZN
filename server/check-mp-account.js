import dotenv from 'dotenv';
dotenv.config();

async function checkAccount() {
    console.log('🔍 Verificando cuenta de Mercado Pago...');
    console.log('📍 Token:', process.env.MERCADOPAGO_ACCESS_TOKEN?.substring(0, 20) + '...');
    
    try {
        const response = await fetch('https://api.mercadopago.com/users/me', {
            headers: { 
                'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const account = await response.json();
        console.log('✅ Información de la cuenta:');
        console.log('   País:', account.country_id);
        console.log('   Sitio:', account.site_id);
        console.log('   Email:', account.email);
        console.log('   Tipo:', account.account_type);
        console.log('   Status:', account.status);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkAccount();