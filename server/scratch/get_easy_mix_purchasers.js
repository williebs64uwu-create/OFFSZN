import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('Querying all lifetime licenses of Easy Mix...');
    const { data: licenses, error: licError } = await supabase
        .from('plugin_licenses')
        .select(`
            id,
            plugin_name,
            serial_key,
            license_type,
            status,
            created_at,
            user_id,
            users (
                email,
                nickname
            )
        `)
        .eq('license_type', 'lifetime');

    if (licError) {
        console.error('Error fetching licenses:', licError);
        process.exit(1);
    }

    const easyMixLifetimes = licenses.filter(lic => 
        lic.plugin_name?.toLowerCase().includes('mix')
    );

    console.log(`\n=== LIFETIME LICENSES FOR EASY MIX (Total: ${easyMixLifetimes.length}) ===`);

    for (let i = 0; i < easyMixLifetimes.length; i++) {
        const lic = easyMixLifetimes[i];
        const userEmail = lic.users?.email;
        const userNickname = lic.users?.nickname || 'N/A';
        const userId = lic.user_id;

        console.log(`\n----------------------------------------`);
        console.log(`[Licencia #${i + 1}]`);
        console.log(`Usuario:      ${userNickname} (${userEmail})`);
        console.log(`Serial Key:   ${lic.serial_key}`);
        console.log(`Creado el:    ${lic.created_at}`);
        console.log(`Status:       ${lic.status}`);

        if (userId) {
            // Find orders for this user
            const { data: orders, error: orderError } = await supabase
                .from('orders')
                .select('id, created_at, amount, total_price, status, transaction_id, product_id')
                .eq('user_id', userId)
                .eq('status', 'completed');

            if (orderError) {
                console.error(`Error querying orders for user ${userId}:`, orderError);
            } else if (orders && orders.length > 0) {
                console.log(`Órdenes de compra completadas encontradas:`);
                orders.forEach(o => {
                    console.log(`   - Orden ID: ${o.id}`);
                    console.log(`     Fecha:    ${o.created_at}`);
                    console.log(`     Monto:    $${o.amount || o.total_price}`);
                    console.log(`     Tx ID:    ${o.transaction_id || 'N/A'}`);
                    console.log(`     Prod ID:  ${o.product_id}`);
                });
            } else {
                console.log(`No se encontraron órdenes de compra completadas en la tabla 'orders' para este user_id.`);
            }
        }
    }
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
