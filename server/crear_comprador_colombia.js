// crear_usuario_test.js
import { MercadoPagoConfig } from 'mercadopago';

// PEGA AQUÍ TU ACCESS TOKEN (El que empieza con TEST-457...)
const accessToken = 'TEST-4571013284466720-111713-a2e789e7fc3d441ba779d2d37780feb4-1909936279';

const client = new MercadoPagoConfig({ accessToken: accessToken });

async function createTestUser() {
    try {
        console.log("⏳ Creando usuario de prueba para Colombia...");
        
        const response = await fetch('https://api.mercadopago.com/users/test_user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                site_id: 'MCO', // FORZAMOS COLOMBIA
                description: 'Comprador Test OFFSZN'
            })
        });

        const data = await response.json();

        if (data.id) {
            console.log("\n✅ ¡USUARIO CREADO EXITOSAMENTE!");
            console.log("=========================================");
            console.log(`📧 EMAIL:    ${data.email}`);
            console.log(`🔑 PASSWORD: ${data.password}`);
            console.log("=========================================");
            console.log("⚠️ GUARDA ESTOS DATOS. LOS USARÁS PARA PAGAR.");
        } else {
            console.log("❌ Error creando usuario:", data);
        }

    } catch (error) {
        console.error("Error fatal:", error);
    }
}

createTestUser();