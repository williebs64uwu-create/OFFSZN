import { MercadoPagoConfig } from 'mercadopago';
// Si no usas módulos en este script suelto, podrías necesitar require. 
// Pero asumiendo tu setup actual:
const accessToken = 'TEST-4571013284466720-111713-a2e789e7fc3d441ba779d2d37780feb4-1909936279'; // Pégalo directo para este script rápido

async function create() {
    try {
        const response = await fetch('https://api.mercadopago.com/users/test_user', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                site_id: "MCO", // Forzamos Colombia
                description: "Comprador Colombia Nuevo"
            })
        });
        const data = await response.json();
        console.log("✅ Nuevo Comprador Colombia:", data);
        console.log("Email:", data.email);
        console.log("Password:", data.password);
    } catch (e) { console.error(e); }
}
create();