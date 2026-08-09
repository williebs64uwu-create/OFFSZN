import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function getABReport() {
    console.log("==========================================================");
    console.log("📊 REPORTE DE VENTAS Y A/B TESTING (OFFSZN PLUGINS)");
    console.log("==========================================================\n");

    // 1. Fetch plugin purchases from order_items and orders
    const { data: orderItems, error: itemsErr } = await supabase
        .from('order_items')
        .select(`
            id,
            price_at_purchase,
            created_at,
            order_id,
            orders (
                id,
                total_price,
                status,
                created_at,
                guest_email,
                user_id
            ),
            products (
                id,
                name
            )
        `)
        .in('product_id', [899, 900, 902])
        .order('created_at', { ascending: false });

    if (itemsErr) {
        console.error("❌ Error fetching orders:", itemsErr);
        return;
    }

    const stats = {
        'Easy Mix': { count5: 0, rev5: 0, count10: 0, rev10: 0, otherCount: 0, otherRev: 0 },
        'Easy Master': { count5: 0, rev5: 0, count10: 0, rev10: 0, otherCount: 0, otherRev: 0 },
        'Inka Kola': { count5: 0, rev5: 0, count10: 0, rev10: 0, otherCount: 0, otherRev: 0 },
        'Total Global': { count5: 0, rev5: 0, count10: 0, rev10: 0, totalRev: 0 }
    };

    const recentSales = [];

    orderItems.forEach(item => {
        const prodName = item.products?.name || (item.product_id === 902 ? 'Inka Kola' : (item.product_id === 900 ? 'Easy Master' : 'Easy Mix'));
        let groupKey = 'Easy Mix';
        if (prodName.toLowerCase().includes('master')) groupKey = 'Easy Master';
        if (prodName.toLowerCase().includes('inka')) groupKey = 'Inka Kola';

        const price = parseFloat(item.price_at_purchase || item.orders?.total_price || 0);

        if (price === 5) {
            stats[groupKey].count5++;
            stats[groupKey].rev5 += 5;
            stats['Total Global'].count5++;
            stats['Total Global'].rev5 += 5;
        } else if (price === 10) {
            stats[groupKey].count10++;
            stats[groupKey].rev10 += 10;
            stats['Total Global'].count10++;
            stats['Total Global'].rev10 += 10;
        } else {
            stats[groupKey].otherCount++;
            stats[groupKey].otherRev += price;
        }
        stats['Total Global'].totalRev += price;

        recentSales.push({
            date: item.created_at || item.orders?.created_at,
            plugin: groupKey,
            price: `$${price.toFixed(2)} USD`,
            email: item.orders?.guest_email || 'Usuario Registrado',
            status: item.orders?.status || 'completed'
        });
    });

    console.log("📈 RESUMEN POR PRODUCTO:");
    console.log("----------------------------------------------------------");
    ['Easy Mix', 'Easy Master', 'Inka Kola'].forEach(plugin => {
        const p = stats[plugin];
        const totalSales = p.count5 + p.count10 + p.otherCount;
        const totalRevenue = p.rev5 + p.rev10 + p.otherRev;
        console.log(`🔹 ${plugin.toUpperCase()}:`);
        console.log(`   • Ventas a $5 USD:   ${p.count5} ventas  (+$${p.rev5} USD)`);
        console.log(`   • Ventas a $10 USD:  ${p.count10} ventas  (+$${p.rev10} USD)`);
        if (p.otherCount > 0) {
            console.log(`   • Otras tarifas:     ${p.otherCount} ventas (+$${p.otherRev} USD)`);
        }
        console.log(`   👉 Total Plugin:     ${totalSales} ventas | Total Facturado: $${totalRevenue} USD\n`);
    });

    console.log("----------------------------------------------------------");
    console.log(`🏆 RESUMEN GLOBAL DEL A/B TESTING:`);
    console.log(`   • Total Ganado con Variante $5 USD:  $${stats['Total Global'].rev5} USD (${stats['Total Global'].count5} ventas)`);
    console.log(`   • Total Ganado con Variante $10 USD: $${stats['Total Global'].rev10} USD (${stats['Total Global'].count10} ventas)`);
    console.log(`   💰 Facturación Total Plugins:        $${stats['Total Global'].totalRev.toFixed(2)} USD`);
    console.log("----------------------------------------------------------\n");

    console.log("🕒 ÚLTIMAS 10 VENTAS REGISTRADAS:");
    console.log("----------------------------------------------------------");
    recentSales.slice(0, 10).forEach((s, idx) => {
        console.log(`[${idx + 1}] ${s.date ? new Date(s.date).toLocaleString('es-PE') : 'N/A'} | ${s.plugin} | Monto: ${s.price} | Estado: ${s.status}`);
    });
    console.log("==========================================================\n");
}

getABReport();
