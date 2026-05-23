/**
 * Repara ventas PayPal donde el pago y el email se enviaron
 * pero faltan order_items o producer_id en orders.
 *
 * Uso:
 *   node server/scripts/repair-paypal-sale.js
 *   node server/scripts/repair-paypal-sale.js --email rulishelby@gmail.com
 *   node server/scripts/repair-paypal-sale.js --producer willieinspired
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const args = process.argv.slice(2);
const buyerEmail = args.includes('--email')
    ? args[args.indexOf('--email') + 1]
    : 'rulishelby@gmail.com';
const producerNickname = args.includes('--producer')
    ? args[args.indexOf('--producer') + 1]
    : 'willieinspired';
const productSearch = args.includes('--product')
    ? args[args.indexOf('--product') + 1]
    : 'OMAR COURTZ';

async function run() {
    console.log(`\n🔧 Reparación de venta PayPal`);
    console.log(`   Comprador: ${buyerEmail}`);
    console.log(`   Productor: ${producerNickname}`);
    console.log(`   Producto:  %${productSearch}%\n`);

    const { data: producer, error: prodUserErr } = await supabase
        .from('users')
        .select('id, nickname, email')
        .ilike('nickname', producerNickname)
        .single();

    if (prodUserErr || !producer) {
        console.error('❌ No se encontró el productor:', prodUserErr?.message);
        process.exit(1);
    }
    console.log(`✅ Productor: ${producer.nickname} (${producer.id})`);

    const { data: products } = await supabase
        .from('products')
        .select('id, name, producer_id, price_basic, status')
        .eq('producer_id', producer.id)
        .ilike('name', `%${productSearch}%`);

    if (!products?.length) {
        console.error('❌ No se encontró el producto.');
        process.exit(1);
    }
    const product = products[0];
    console.log(`✅ Producto: ${product.name} (${product.id}) — status: ${product.status}`);

    const { data: orders } = await supabase
        .from('orders')
        .select('id, transaction_id, status, amount, total_price, guest_email, producer_id, product_id, created_at')
        .or(`guest_email.ilike.${buyerEmail},guest_email.ilike.%${buyerEmail.split('@')[0]}%`)
        .order('created_at', { ascending: false })
        .limit(10);

    console.log(`\n📋 Órdenes encontradas para ese email: ${orders?.length || 0}`);
    (orders || []).forEach(o => {
        console.log(`   - #${o.id} | $${o.amount} | producer_id=${o.producer_id || 'NULL'} | ${o.created_at}`);
    });

    const forceCreate = args.includes('--create');
    const paypalTxn = args.includes('--txn') ? args[args.indexOf('--txn') + 1] : null;

    let targetOrder = (orders || []).find(o => parseFloat(o.amount) > 0);

    if (!targetOrder && !forceCreate) {
        console.log('\n⚠️  No hay orden pagada para este email. Buscando por monto ~$5 en las últimas 48h...');
        const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data: recentPaid } = await supabase
            .from('orders')
            .select('*')
            .gte('amount', 4)
            .lte('amount', 6)
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(20);

        targetOrder = (recentPaid || []).find(o => !o.producer_id) || recentPaid?.[0];
        if (targetOrder) {
            console.log(`   Usando orden #${targetOrder.id} ($${targetOrder.amount}) — verifica que sea el comprador correcto`);
        }
    }

    if (!targetOrder) {

        if (!forceCreate) {
            console.error('\n❌ No se encontró ninguna orden para este comprador.');
            console.error('   PayPal cobró pero el capture no llegó a guardarse en la DB.');
            console.error('   Corre: node scripts/repair-paypal-sale.js --create --txn <ID> --email <email>\n');
            process.exit(1);
        }

        const txnId = paypalTxn || `PAYPAL-MANUAL-${Date.now()}`;
        console.log(`\n📝 Creando orden manual (txn: ${txnId})...`);

        const { data: newOrder, error: createErr } = await supabase
            .from('orders')
            .insert({
                transaction_id: txnId,
                status: 'completed',
                total_price: 5,
                amount: 5,
                guest_email: buyerEmail,
                producer_id: producer.id,
                product_id: product.id
            })
            .select()
            .single();

        if (createErr) {
            console.error('❌ Error creando orden:', createErr.message);
            process.exit(1);
        }
        targetOrder = newOrder;
        console.log(`✅ Orden creada #${targetOrder.id}`);
    }

    const { data: existingItems } = await supabase
        .from('order_items')
        .select('id, product_id, price_at_purchase')
        .eq('order_id', targetOrder.id);

    console.log(`\n📦 order_items existentes: ${existingItems?.length || 0}`);

    const updates = {};
    if (!targetOrder.producer_id) {
        updates.producer_id = producer.id;
        console.log('   → Se asignará producer_id en orders');
    }
    if (!targetOrder.product_id) {
        updates.product_id = product.id;
        console.log('   → Se asignará product_id en orders');
    }

    if (Object.keys(updates).length > 0) {
        const { error: updErr } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', targetOrder.id);
        if (updErr) {
            console.error('❌ Error actualizando orders:', updErr.message);
            process.exit(1);
        }
        console.log('✅ orders actualizado');
    } else {
        console.log('ℹ️  orders ya tiene producer_id y product_id');
    }

    const hasProductItem = (existingItems || []).some(i => String(i.product_id) === String(product.id));

    if (!hasProductItem) {
        const saleAmount = parseFloat(targetOrder.amount) || 5;
        const { error: itemErr } = await supabase.from('order_items').insert({
            order_id: targetOrder.id,
            product_id: product.id,
            quantity: 1,
            price_at_purchase: saleAmount,
            license_name: 'Standard'
        });
        if (itemErr) {
            console.error('❌ Error insertando order_items:', itemErr.message);
            process.exit(1);
        }
        console.log(`✅ order_items creado ($${saleAmount})`);

        const { data: prod } = await supabase
            .from('products')
            .select('sales_count')
            .eq('id', product.id)
            .single();
        if (prod) {
            await supabase
                .from('products')
                .update({ sales_count: (prod.sales_count || 0) + 1 })
                .eq('id', product.id);
            console.log('✅ sales_count incrementado');
        }
    } else {
        console.log('ℹ️  order_items ya existe para este producto');
    }

    console.log('\n🎉 Reparación completada. Recarga:');
    console.log('   https://offszn.lat/transacciones');
    console.log('   https://offszn.lat/cuenta/dashboard');
    console.log('   https://offszn.lat/cuenta/analiticas\n');
    process.exit(0);
}

run().catch(err => {
    console.error('❌ ERROR:', err);
    process.exit(1);
});
