import { supabase } from '../../database/connection.js';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

// --- 1. CREAR PREFERENCIA (Tu código actual, sin cambios grandes) ---
export const createMercadoPagoPreference = async (req, res) => {
    console.log("🔵 [OrderController] Iniciando createMercadoPagoPreference");
    try {
        const userId = req.user.userId;
        const { cartItems } = req.body;

        if (!cartItems || cartItems.length === 0) return res.status(400).json({ error: 'Carrito vacío.' });

        // Validar precios
        const productIds = cartItems.map(item => item.id);
        const { data: dbProducts, error } = await supabase.from('products').select('id, name, price_basic, image_url').in('id', productIds);
        if (error) throw new Error('Error DB');

        const line_items = [];
        cartItems.forEach(cartItem => {
            const product = dbProducts.find(p => p.id === cartItem.id);
            if (product) {
                let finalPrice = parseFloat(product.price_basic);
                if (finalPrice < 1000) {
                    console.warn(`⚠️ Precio bajo (${finalPrice}). Ajustando a 10000.`);
                    finalPrice = 10000;
                }
                line_items.push({
                    id: product.id.toString(),
                    title: product.name.substring(0, 250),
                    description: 'Producto OFFSZN',
                    picture_url: product.image_url,
                    quantity: 1,
                    currency_id: 'COP',
                    unit_price: finalPrice
                });
            }
        });

        const preference = new Preference(client);
        const uniqueExternalReference = `${userId}_${Date.now()}`;

        const preferenceData = {
            body: {
                items: line_items,
                binary_mode: true,
                payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }], installments: 1 },
                back_urls: {
                    success: `https://offszn.onrender.com/pages/success.html`, // ¡Asegúrate de crear este archivo!
                    failure: `https://offszn.onrender.com/pages/marketplace.html`,
                    pending: `https://offszn.onrender.com/pages/marketplace.html`
                },
                auto_return: 'approved',
                notification_url: `https://offszn-academy.onrender.com/api/orders/mercadopago-webhook`,
                external_reference: uniqueExternalReference,
                statement_descriptor: "OFFSZN"
            }
        };

        const result = await preference.create(preferenceData);
        const paymentUrl = result.sandbox_init_point || result.init_point;

        console.log("✅ Preferencia creada:", uniqueExternalReference);
        res.status(200).json({ url: paymentUrl, externalReference: uniqueExternalReference });

    } catch (err) {
        console.error("🔴 Error creando preferencia:", err);
        res.status(500).json({ error: 'Error iniciando pago' });
    }
};

// --- 2. WEBHOOK MEJORADO (CON REINTENTOS) ---
export const handleMercadoPagoWebhook = async (req, res) => {
    const id = req.query.id || req.query['data.id'];
    const topic = req.query.topic || req.query.type;

    if (topic === 'payment') {
        res.status(200).send('OK'); // Responder OK rápido
        processPaymentWithRetries(id); // Procesar en background
    } else {
        res.status(200).send('OK');
    }
};

// Función de Reintento Inteligente
const processPaymentWithRetries = async (paymentId) => {
    console.log(`🔔 [Background] Iniciando reintentos para pago ID: ${paymentId}`);
    
    const maxRetries = 5; // Aumentamos a 5 intentos
    let attempt = 0;
    let paymentInfo = null;

    while (attempt < maxRetries) {
        attempt++;
        // Espera progresiva más agresiva: 5s, 10s, 15s, 20s, 25s
        const delay = attempt * 5000; 
        console.log(`⏳ Intento ${attempt}/${maxRetries}: Esperando ${delay/1000}s...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            // 1. Intentar buscar por ID
            const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                paymentInfo = await response.json();
                console.log(`🔎 [POR ID] Estado encontrado: ${paymentInfo.status}`);
                break;
            } else {
                console.warn(`⚠️ Intento ${attempt}: Búsqueda por ID falló (404). Intentando búsqueda alternativa...`);
                
                // 2. PLAN B: Buscar en la lista de pagos recientes
                // A veces el GET /payments/ID falla, pero el GET /payments/search funciona
                const searchResponse = await fetch(`https://api.mercadopago.com/v1/payments/search?id=${paymentId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (searchResponse.ok) {
                    const searchData = await searchResponse.json();
                    if (searchData.results && searchData.results.length > 0) {
                        paymentInfo = searchData.results[0];
                        console.log(`🔎 [POR SEARCH] Estado encontrado: ${paymentInfo.status}`);
                        break;
                    }
                }
            }
        } catch (e) {
            console.error(`🔴 Intento ${attempt} falló por red:`, e.message);
        }
    }

    if (!paymentInfo) {
        console.error("❌ [Background] Se agotaron los intentos. No se pudo recuperar el pago.");
        return;
    }

    // --- LÓGICA DE GUARDADO (Idéntica a la anterior) ---
    if (paymentInfo.status === 'approved') {
        // ... (Tu código de guardar en Supabase va aquí, igual que antes)
        const externalRefParts = paymentInfo.external_reference ? paymentInfo.external_reference.split('_') : [];
        const userId = externalRefParts[0];
        
        if (!userId) return console.error("❌ No hay UserID en external_reference");

        console.log(`✅ Guardando orden para User: ${userId}`);

        const { data: newOrder, error: orderError } = await supabase
            .from('orders')
            .insert({
                user_id: userId,
                paypal_order_id: paymentInfo.id.toString(),
                status: 'completed',
                total_price: paymentInfo.transaction_amount
            })
            .select('id')
            .single();

        if (orderError) {
            if (orderError.code === '23505') return console.log("⚠️ Orden ya existe.");
            return console.error("🔴 Error DB Orden:", orderError);
        }

        const itemsMP = paymentInfo.additional_info.items;
        if (itemsMP && itemsMP.length > 0) {
            const orderItemsData = itemsMP.map(item => ({
                order_id: newOrder.id,
                product_id: parseInt(item.id),
                quantity: 1,
                price_at_purchase: parseFloat(item.unit_price)
            }));
            const { error: iErr } = await supabase.from('order_items').insert(orderItemsData);
            if (iErr) console.error("🔴 Error DB Items:", iErr);
        }
        console.log("🎉 ¡TODO COMPLETADO EXITOSAMENTE!");
    }
};

// 3. POLLING (Igual que antes)
export const checkPaymentStatus = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { data } = await supabase.from('orders').select('id, status, created_at').eq('user_id', userId).eq('status', 'completed').order('created_at', { ascending: false }).limit(1).single();
        
        if (data) {
             const isRecent = new Date(data.created_at).getTime() > (Date.now() - 5 * 60 * 1000);
             if (isRecent) return res.status(200).json({ status: 'completed', orderId: data.id });
        }
        res.status(200).json({ status: 'pending' });
    } catch (err) { res.status(500).json({ error: 'Error' }); }
};

export const forceCheckPayment = async (req, res) => {
    const { paymentId } = req.params;
    console.log(`🚨 [MANUAL FORCE] Forzando verificación para ID: ${paymentId}`);

    try {
        // Usamos la misma lógica de búsqueda directa
        const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return res.status(404).json({ error: 'Pago no encontrado en API MP', details: await response.json() });
        }

        const paymentInfo = await response.json();

        if (paymentInfo.status === 'approved') {
            const externalRefParts = paymentInfo.external_reference ? paymentInfo.external_reference.split('_') : [];
            const userId = externalRefParts[0];

            if (!userId) return res.status(400).json({ error: 'Sin UserID' });

            // Guardar Orden
            const { data: newOrder, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: userId,
                    paypal_order_id: paymentInfo.id.toString(),
                    status: 'completed',
                    total_price: paymentInfo.transaction_amount
                })
                .select('id')
                .single();
            
            // Si ya existe, no pasa nada, buscamos la existente
            let finalOrderId = newOrder?.id;
            
            if (orderError) {
                if (orderError.code === '23505') {
                    // Ya existe, buscamos el ID para asegurar items
                    const { data: existing } = await supabase.from('orders').select('id').eq('paypal_order_id', paymentInfo.id.toString()).single();
                    finalOrderId = existing.id;
                    console.log("⚠️ Orden ya existía, verificando items...");
                } else {
                    throw orderError;
                }
            }

            // Guardar Items
            const itemsMP = paymentInfo.additional_info.items;
            if (itemsMP && itemsMP.length > 0) {
                const orderItemsData = itemsMP.map(item => ({
                    order_id: finalOrderId,
                    product_id: parseInt(item.id),
                    quantity: 1,
                    price_at_purchase: parseFloat(item.unit_price)
                }));
                // Insertar ignorando duplicados si es posible (o dejar que falle si ya están)
                await supabase.from('order_items').insert(orderItemsData).catch(e => console.log("Items ya existían o error:", e.message));
            }

            return res.status(200).json({ message: '¡Orden recuperada y guardada manualmente!', orderId: finalOrderId });
        }

        res.status(200).json({ message: 'El pago existe pero no está aprobado', status: paymentInfo.status });

    } catch (error) {
        console.error("🔴 Error manual:", error);
        res.status(500).json({ error: error.message });
    }
};

