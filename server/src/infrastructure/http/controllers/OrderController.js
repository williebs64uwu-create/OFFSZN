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

        console.log(`👤 [OrderController] Usuario: ${userId}`);
        console.log(`🛒 [OrderController] Items recibidos: ${cartItems?.length}`);

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ error: 'El carrito está vacío.' });
        }

        // --- A. Validar precios en DB ---
        const productIds = cartItems.map(item => item.id);
        const { data: dbProducts, error } = await supabase
            .from('products')
            .select('id, name, price_basic, image_url')
            .in('id', productIds);

        if (error) {
            console.error("🔴 [OrderController] Error DB:", error);
            throw new Error('Error consultando DB.');
        }

        // --- B. Construir Items ---
        const line_items = [];
        cartItems.forEach(cartItem => {
            const product = dbProducts.find(p => p.id === cartItem.id);
            if (product && product.price_basic > 0) {
                line_items.push({
                    id: product.id.toString(),
                    title: product.name.substring(0, 250),
                    description: 'Producto Digital - OFFSZN',
                    picture_url: product.image_url,
                    quantity: 1,
                    currency_id: 'COP', 
                    unit_price: parseFloat(product.price_basic)
                });
            }
        });

        console.log("📦 [OrderController] Items procesados para MP:", JSON.stringify(line_items, null, 2));

        // --- C. Crear Preferencia ---
        const preference = new Preference(client);
        
        // Usamos un ID de referencia único para monitorear este intento de pago específico
        // Concatenamos ID usuario + Timestamp
        const uniqueExternalReference = `${userId}_${Date.now()}`;

        const preferenceData = {
            body: {
                items: line_items,
                binary_mode: true, // Pago inmediato (Aprueba o Rechaza, sin pendientes)
                payer: {
                    email: req.user.email // Ayuda a pre-llenar, pero NO bloquea si es diferente
                },
                payment_methods: {
                    excluded_payment_types: [{ id: "ticket" }, { id: "atm" }], // Solo tarjetas
                    installments: 1
                },
                back_urls: {
                    // Estas URLs son a donde vuelve la PESTAÑA NUEVA.
                    success: `https://offszn.onrender.com/pages/success.html`, 
                    failure: `https://offszn.onrender.com/pages/marketplace.html`,
                    pending: `https://offszn.onrender.com/pages/marketplace.html`
                },
                auto_return: 'approved',
                notification_url: `https://offszn-academy.onrender.com/api/orders/mercadopago-webhook`,
                external_reference: uniqueExternalReference, // CLAVE PARA EL MONITOREO
                statement_descriptor: "OFFSZN MARKET"
            }
        };

        console.log("🚀 [OrderController] Enviando a Mercado Pago...");
        const result = await preference.create(preferenceData);
        
        console.log("✅ [OrderController] Respuesta MP Exitosa. ID Preferencia:", result.id);
        console.log("🔗 [OrderController] Init Point:", result.init_point);

        res.status(200).json({ 
            url: result.init_point, // URL para abrir en nueva pestaña
            externalReference: uniqueExternalReference // ID para que el frontend monitoree
        });

    } catch (err) {
        console.error("🔴 [OrderController] CRITICAL ERROR:", err);
        res.status(500).json({ error: 'Error interno al crear pago.', details: err.message });
    }
};

// 2. WEBHOOK (CON LOGS DETALLADOS)
export const handleMercadoPagoWebhook = async (req, res) => {
    const id = req.query.id || req.query['data.id'];
    const topic = req.query.topic || req.query.type;

    console.log(`🔔 [Webhook] Recibido. Topic: ${topic}, ID: ${id}`);

    if (topic !== 'payment') return res.status(200).send('OK');

    try {
        const payment = new Payment(client);
        const paymentInfo = await payment.get({ id: id });

        console.log(`💳 [Webhook] Estado del pago: ${paymentInfo.status}`);
        console.log(`Paper Reference: ${paymentInfo.external_reference}`);

        if (paymentInfo.status === 'approved') {
            // external_reference viene como "USERID_TIMESTAMP". Extraemos el ID del usuario.
            const externalRefParts = paymentInfo.external_reference.split('_');
            const userId = externalRefParts[0]; 
            const totalPaid = paymentInfo.transaction_amount;
            const itemsMP = paymentInfo.additional_info.items;

            console.log(`✅ [Webhook] Aprobado para UserID: ${userId}`);

            // Guardar Orden
            const { data: newOrder, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: userId,
                    paypal_order_id: paymentInfo.id.toString(), // Guardamos ID de MP
                    status: 'completed',
                    total_price: totalPaid,
                    // Guardamos la referencia completa para que el frontend pueda encontrarla
                    // (Asegúrate de tener una columna para notas o usar el campo paypal_order_id temporalmente si no tienes otro)
                    // Ojo: Para simplificar, usamos el paypal_order_id para el match, 
                    // pero el polling buscará por "última orden del usuario".
                })
                .select('id')
                .single();

            if (orderError) {
                console.error("🔴 [Webhook] Error guardando orden:", orderError);
                throw orderError;
            }

            // Guardar Items (Lógica simplificada por ID)
            const orderItemsData = itemsMP.map(item => ({
                order_id: newOrder.id,
                product_id: parseInt(item.id),
                quantity: 1,
                price_at_purchase: parseFloat(item.unit_price)
            }));

            await supabase.from('order_items').insert(orderItemsData);
            console.log("🎉 [Webhook] Orden y items guardados en DB.");
        }

        res.status(200).send('OK');

    } catch (error) {
        console.error("🔴 [Webhook] Error procesando:", error);
        res.status(500).json({ error: error.message });
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