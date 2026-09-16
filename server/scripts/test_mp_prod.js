import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testProductionCredentials() {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
        console.error('❌ MERCADOPAGO_ACCESS_TOKEN not found in .env');
        return;
    }
    
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
