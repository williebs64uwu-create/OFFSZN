import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('Searching for Easy Mix products...');
    const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, name, price_basic, price_premium, licenses')
        .ilike('name', '%mix%');

    if (prodError) {
        console.error('Error fetching products:', prodError);
        process.exit(1);
    }

    const easyMixProducts = products.filter(p => p.name?.toLowerCase().includes('easy mix'));
    console.log('Easy Mix Products found:', easyMixProducts);

    if (easyMixProducts.length === 0) {
        console.log('No products matching "Easy Mix" found.');
        process.exit(0);
    }

    const productIds = easyMixProducts.map(p => p.id);

    console.log(`\nQuerying completed orders for product IDs: ${productIds.join(', ')}...`);
    
    const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select(`
            id,
            created_at,
            amount,
            total_price,
            status,
            guest_email,
            user_id,
            product_id,
            transaction_id
        `)
        .in('product_id', productIds)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

    if (orderError) {
        console.error('Error fetching orders:', orderError);
        process.exit(1);
    }

    console.log(`\n=== COMPRAS DE EASY MIX EN ENCARGOS (ORDERS) ===`);
    console.log(`Total ventas encontradas: ${orders.length}`);

    for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        
        // Fetch user email if available
        let userEmail = order.guest_email;
        let userNickname = 'Invitado';
        if (order.user_id) {
            const { data: u } = await supabase
                .from('users')
                .select('email, nickname')
                .eq('id', order.user_id)
                .single();
            if (u) {
                userEmail = u.email;
                userNickname = u.nickname;
            }
        }

        const prod = easyMixProducts.find(p => p.id === order.product_id);

        console.log(`\n[Venta #${i + 1}]`);
        console.log(`   Fecha:      ${order.created_at}`);
        console.log(`   Email:      ${userEmail}`);
        console.log(`   Nickname:   ${userNickname}`);
        console.log(`   Monto:      $${order.amount || order.total_price}`);
        console.log(`   Tx ID:      ${order.transaction_id || 'N/A'}`);
        console.log(`   Producto:   ${prod?.name || 'Easy Mix'}`);
    }

    // Let's also check all lifetime licenses in plugin_licenses to see who has them
    console.log(`\n=== LICENCIAS LIFETIME/SUBCRIPCIÓN ACTIVAS DE EASY MIX ===`);
    const { data: licenses, error: licError } = await supabase
        .from('plugin_licenses')
        .select(`
            id,
            plugin_name,
            serial_key,
            license_type,
            status,
            expires_at,
            created_at,
            users (
                email,
                nickname
            )
        `)
        .eq('license_type', 'lifetime');

    if (licError) {
        console.error('Error fetching licenses:', licError);
    } else {
        const easyMixLifetimes = licenses.filter(lic => lic.plugin_name?.toLowerCase().includes('mix'));
        easyMixLifetimes.forEach((lic, idx) => {
            console.log(`\n[Licencia #${idx + 1}]`);
            console.log(`   Fecha Creado: ${lic.created_at}`);
            console.log(`   Usuario:      ${lic.users?.nickname || 'N/A'} (${lic.users?.email || 'N/A'})`);
            console.log(`   Serial Key:   ${lic.serial_key}`);
            console.log(`   Status:       ${lic.status}`);
        });
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
