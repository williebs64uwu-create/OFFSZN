import { supabase } from '../../database/connection.js';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

// --- CONFIGURACIÓN DE MERCADO PAGO ---
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

export const createMercadoPagoPreference = async (req, res) => {
    console.log("--- INICIANDO createMercadoPagoPreference ---");
    console.log("Token usado:", process.env.MERCADOPAGO_ACCESS_TOKEN.substring(0, 15) + "...");

    try {
        const userId = req.user.userId;
        const userEmail = req.user.email;
        const { cartItems } = req.body;

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ error: 'El carrito está vacío.' });
        }

        // --- 1. VALIDACIÓN DE PRECIOS ---
        const productIds = cartItems.map(item => item.id);
        const { data: productsInDB, error: dbError } = await supabase
            .from('products')
            .select('id, name, price_basic, is_free, image_url')
            .in('id', productIds);
        if (dbError) throw new Error('Error al verificar productos: ' + dbError.message);

        // --- 2. TRANSFORMAR ITEMS (FORZADO A COP) ---
        const line_items = productsInDB.map(product => {
            if (product.is_free) return null;
            
            return {
                id: product.id.toString(),
                title: product.name,
                description: 'Producto digital - OFFSZN',
                picture_url: product.image_url,
                category_id: 'art',
                quantity: 1,
                currency_id: 'COP', // ¡COLOMBIA!
                unit_price: 10000 // 10,000 COP para pruebas
            };
        }).filter(item => item !== null);

        if (line_items.length === 0) {
            return res.status(400).json({ error: 'No hay items pagables.' });
        }

        // --- 3. CREAR LA PREFERENCIA DE PAGO ---
        const preference = new Preference(client);
        const preferenceData = {
            body: {
                items: line_items,
                payer: { 
                    email: userEmail,
                },
                // 🔥 CONFIGURACIÓN CRÍTICA PARA COLOMBIA
                payment_methods: {
                    excluded_payment_types: [],
                    installments: 1,
                    default_installments: 1
                },
                back_urls: {
                    success: `https://offszn.onrender.com/pago-exitoso`,
                    failure: `https://offszn.onrender.com/pages/marketplace.html`,
                    pending: `https://offszn.onrender.com/pages/marketplace.html`
                },
                auto_return: 'approved',
                notification_url: `https://offszn-academy.onrender.com/api/orders/mercadopago-webhook?userId=${userId}`,
                external_reference: userId.toString(),
                purpose: 'wallet_purchase',
                // 🔥 FORZAR SITIO COLOMBIA
                site_id: 'MCO'
            }
        };

        console.log("🎯 Preferencia Colombia:", JSON.stringify({
            items: preferenceData.body.items,
            site_id: preferenceData.body.site_id,
            currency: preferenceData.body.items[0]?.currency_id
        }, null, 2));

        const result = await preference.create(preferenceData);

        console.log("✅ Preferencia creada exitosamente");
        console.log("🔗 URL de checkout:", result.sandbox_init_point);

        res.status(200).json({ 
            url: result.sandbox_init_point || result.init_point 
        });

    } catch (err) {
        console.error("❌ Error en createMercadoPagoPreference:", {
            message: err.message,
            api_response: err.api_response
        });
        res.status(500).json({
            error: 'Error al crear la preferencia de pago.',
            details: err.message
        });
    }
};

// ==========================================================
// WEBHOOK (sin cambios)
// ==========================================================
export const handleMercadoPagoWebhook = async (req, res) => {
    console.log("🔔 ¡Webhook de Mercado Pago recibido!");

    const paymentId = req.query['data.id'];
    const type = req.query.type;

    if (type !== 'payment') {
        console.log("No es un evento de pago, ignorando.");
        return res.status(200).send('Webhook ignorado (no es de tipo pago).');
    }
    if (!paymentId) {
        console.warn("No se recibió 'data.id' en el webhook.");
        return res.status(400).send("Falta el ID del pago.");
    }

    try {
        const payment = new Payment(client);
        const paymentInfo = await payment.get({ id: paymentId });

        console.log("Información del pago obtenida:", paymentInfo);

        if (paymentInfo.status === 'approved') {
            const userId = paymentInfo.external_reference;
            const orderId = paymentInfo.id;
            const itemsComprados = paymentInfo.additional_info.items;
            const totalPagado = paymentInfo.transaction_amount;

            console.log(`✅ Pago aprobado para usuario: ${userId}`);
            console.log(`   Items:`, itemsComprados.map(item => item.title));

            // Buscar los IDs de los productos de Supabase
            const productNames = itemsComprados.map(item => item.title);
            const { data: products, error: pError } = await supabase
                .from('products')
                .select('id, name')
                .in('name', productNames);
            if (pError) throw new Error(`Error buscando IDs de productos: ${pError.message}`);

            // Crear la orden en nuestra tabla 'orders'
            const { data: newOrder, error: oError } = await supabase
                .from('orders')
                .insert({
                    user_id: userId,
                    paypal_order_id: orderId,
                    status: 'completed',
                    total_price: totalPagado
                })
                .select('id')
                .single();
            if (oError) throw new Error(`Error creando orden: ${oError.message}`);

            // Registrar los items comprados en 'order_items'
            const orderItemsData = products.map(product => {
                const purchasedItem = itemsComprados.find(item => item.title === product.name);
                return {
                    order_id: newOrder.id,
                    product_id: product.id,
                    quantity: 1,
                    price_at_purchase: purchasedItem ? parseFloat(purchasedItem.unit_price) : 0
                };
            });

            const { error: oiError } = await supabase
                .from('order_items')
                .insert(orderItemsData);
            if (oiError) throw new Error(`Error guardando items: ${oiError.message}`);

            console.log(`🎉 Orden ${newOrder.id} guardada exitosamente en la BBDD.`);
        } else {
            console.log(`⚠️ Estado del pago: ${paymentInfo.status}`);
        }

        res.status(200).send('Webhook recibido correctamente.');

    } catch (err) {
        console.error("Error en handleMercadoPagoWebhook:", err.message);
        res.status(500).json({ error: err.message || 'Error al procesar el webhook.' });
    }
};