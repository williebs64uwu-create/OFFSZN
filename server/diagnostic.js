// server/diagnostic.js
import { MercadoPagoConfig } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();

async function diagnose() {
    console.log('🔍 Diagnóstico Mercado Pago');
    
    // 1. Verificar token
    console.log('📍 Token:', process.env.MERCADOPAGO_ACCESS_TOKEN.substring(0, 20) + '...');
    
    try {
        // 2. Verificar cuenta
        const response = await fetch('https://api.mercadopago.com/users/me', {
            headers: { 
                'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        const account = await response.json();
        console.log('✅ Cuenta MP:', { 
            country: account.country_id, 
            site: account.site_id,
            email: account.email,
            status: account.status
        });
        
        // 3. Verificar si es sandbox
        console.log('🎯 Modo Sandbox:', process.env.MERCADOPAGO_ACCESS_TOKEN.startsWith('TEST-'));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

diagnose();