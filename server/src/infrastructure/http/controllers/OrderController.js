import { supabase } from '../../database/connection.js';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

// --- CONFIGURACIÓN DE MERCADO PAGO ---
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

// 1. CREAR PREFERENCIA (CON LOGS DETALLADOS)
export const createMercadoPagoPreference = async (req, res) => {
    console.log("🔵 [OrderController] Iniciando createMercadoPagoPreference");

    try {
        const userId = req.user.userId;
        const { cartItems } = req.body;

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ error: 'El carrito está vacío.' });
        }

        // --- A. Validar precios en DB ---
        const productIds = cartItems.map(item => item.id);
        const { data: dbProducts, error } = await supabase
            .from('products')
            .select('id, name, price_basic, image_url')
            .in('id', productIds);

        if (error) throw new Error('Error consultando DB.');

        // --- B. Construir Items ---
        const line_items = [];
        cartItems.forEach(cartItem => {
            const product = dbProducts.find(p => p.id === cartItem.id);
            if (product) {
                // ⚠️ CORRECCIÓN DE PRECIO: 
                // Si el precio es muy bajo (ej. pruebas), lo forzamos a 10.000 COP
                // para que Mercado Pago no lo rechace.
                let finalPrice = parseFloat(product.price_basic);
                if (finalPrice < 1000) {
                    console.warn(`⚠️ Precio muy bajo (${finalPrice}). Ajustando a 10000 para prueba.`);
                    finalPrice = 10000;
                }

                line_items.push({
                    id: product.id.toString(),
                    title: product.name.substring(0, 250),
                    description: 'Producto Digital - OFFSZN',
                    picture_url: product.image_url,
                    quantity: 1,
                    currency_id: 'COP',
                    unit_price: finalPrice // Usamos el precio corregido
                });
            }
        });

        // --- C. Crear Preferencia ---
        const preference = new Preference(client);
        const uniqueExternalReference = `${userId}_${Date.now()}`;

        const preferenceData = {
            body: {
                items: line_items,
                binary_mode: true,
                // Importante: Deja payer vacío o pon un email válido
                payer: {
                    // email: "test_user_..." // Opcional, a veces ayuda pre-llenarlo
                },
                payment_methods: {
                    excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
                    installments: 1
                },
                back_urls: {
                    success: `https://offszn.onrender.com/pages/success.html`,
                    failure: `https://offszn.onrender.com/pages/marketplace.html`,
                    pending: `https://offszn.onrender.com/pages/marketplace.html`
                },
                auto_return: 'approved',
                notification_url: `https://offszn-academy.onrender.com/api/orders/mercadopago-webhook`,
                external_reference: uniqueExternalReference,
                statement_descriptor: "OFFSZN MARKET"
            }
        };

        console.log("🚀 [OrderController] Enviando a MP...");
        const result = await preference.create(preferenceData);

        // ⚠️ CORRECCIÓN DE URL:
        // El SDK devuelve 'init_point' (Prod) y 'sandbox_init_point' (Test).
        // Si estamos usando un token TEST, deberíamos usar sandbox_init_point.
        const paymentUrl = result.sandbox_init_point || result.init_point;

        console.log("✅ [OrderController] Preferencia Creada.");
        console.log("🔗 [OrderController] URL enviada al front:", paymentUrl);

        res.status(200).json({
            url: paymentUrl, // Enviamos la de Sandbox explícitamente
            externalReference: uniqueExternalReference
        });

    } catch (err) {
        console.error("🔴 [OrderController] ERROR:", err);
        res.status(500).json({ error: 'Error creando pago.' });
    }
};

// 2. WEBHOOK (CON LOGS DETALLADOS)
export const handleMercadoPagoWebhook = async (req, res) => {
    const id = req.query.id || req.query['data.id'];
    const topic = req.query.topic || req.query.type;

    console.log(`🔔 [Webhook] Recibido. Topic: ${topic}, ID: ${id}`);

    if (topic !== 'payment') {
        return res.status(200).send('OK');
    }

    try {
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log(`⏳ [Webhook] Consultando pago ${id} después de la espera...`);

        const payment = new Payment(client);
        const paymentInfo = await payment.get({ id: id });

        console.log(`💳 [Webhook] Estado del pago: ${paymentInfo.status}`);
        console.log(`Paper Reference: ${paymentInfo.external_reference}`);

        if (paymentInfo.status === 'approved') {
            const externalRefParts = paymentInfo.external_reference ? paymentInfo.external_reference.split('_') : [];
            const userId = externalRefParts[0];
            const totalPaid = paymentInfo.transaction_amount;
            const itemsMP = paymentInfo.additional_info.items;

            if (!userId) {
                console.error("🔴 [Webhook] No vino external_reference (UserID).");
                return res.status(200).send('OK'); // Respondemos OK para que no reintente infinitamente
            }

            console.log(`✅ [Webhook] Procesando orden para UserID: ${userId}`);

            // 1. Guardar Orden
            const { data: newOrder, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: userId,
                    paypal_order_id: paymentInfo.id.toString(),
                    status: 'completed',
                    total_price: totalPaid
                })
                .select('id')
                .single();

            if (orderError) {
                // Si la orden ya existe (duplicado), no es un error fatal
                if (orderError.code === '23505') {
                    console.log("⚠️ [Webhook] La orden ya fue procesada anteriormente.");
                    return res.status(200).send('OK');
                }
                throw orderError;
            }

            // 2. Guardar Items
            if (itemsMP && itemsMP.length > 0) {
                const orderItemsData = itemsMP.map(item => ({
                    order_id: newOrder.id,
                    product_id: parseInt(item.id),
                    quantity: 1,
                    price_at_purchase: parseFloat(item.unit_price)
                }));

                const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData);
                if (itemsError) throw itemsError;
            }

            console.log("🎉 [Webhook] ¡Orden guardada exitosamente en Supabase!");
        }

        res.status(200).send('OK');

    } catch (error) {
        console.error("🔴 [Webhook] Error procesando:", error);
        res.status(200).json({ error: error.message });
    }
};

// 3. NUEVO ENDPOINT: CONSULTAR ESTADO (POLLING)
export const checkPaymentStatus = async (req, res) => {
    try {
        const userId = req.user.userId;
        // Buscamos la orden completada más reciente de este usuario (últimos 5 minutos)
        const { data, error } = await supabase
            .from('orders')
            .select('id, status, created_at')
            .eq('user_id', userId)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // Error real (no "no encontrado")
            throw error;
        }

        if (data) {
            // Verificamos que la orden sea RECIENTE (menos de 5 minutos) para no traer órdenes viejas
            const orderTime = new Date(data.created_at).getTime();
            const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

            if (orderTime > fiveMinutesAgo) {
                return res.status(200).json({ status: 'completed', orderId: data.id });
            }
        }

        // Si no hay orden reciente completada
        res.status(200).json({ status: 'pending' });

    } catch (err) {
        console.error("Error polling status:", err);
        res.status(500).json({ error: 'Error verificando estado' });
    }
};