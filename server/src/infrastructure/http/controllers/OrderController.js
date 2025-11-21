import { supabase } from '../../database/connection.js';

import { MercadoPagoConfig, Preference } from 'mercadopago';



// Validar cliente al inicio

const token = process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!token) console.error("🔥 [CRITICAL] NO TOKEN FOUND IN CONTROLLER INIT");



const client = new MercadoPagoConfig({ accessToken: token });



// ------------------------------------------------------------------

// 1. CREAR PREFERENCIA (CON DEBUG DE PRECIO Y URL)

// ------------------------------------------------------------------

export const createMercadoPagoPreference = async (req, res) => {

    const traceId = Date.now(); // ID para rastrear logs de esta petición

    console.log(`🔵 [${traceId}] START: createMercadoPagoPreference`);



    try {

        const userId = req.user.userId;

        const { cartItems } = req.body;



        if (!cartItems?.length) {

            console.warn(`⚠️ [${traceId}] Carrito vacío recibido`);

            return res.status(400).json({ error: 'Carrito vacío.' });

        }



        console.log(`🛒 [${traceId}] User: ${userId} | Items: ${cartItems.length}`);



        // Validar en DB

        const productIds = cartItems.map(item => item.id);

        const { data: dbProducts, error } = await supabase

            .from('products')

            .select('id, name, price_basic, image_url')

            .in('id', productIds);



        if (error) {

            console.error(`🔴 [${traceId}] Error DB:`, error);

            throw new Error('Error DB');

        }



        const line_items = [];

        cartItems.forEach(cartItem => {

            const product = dbProducts.find(p => p.id === cartItem.id);

            if (product) {

                let finalPrice = parseFloat(product.price_basic);

                // LOG DE PRECIO

                console.log(`💲 [${traceId}] Prod ID ${product.id}: Precio DB ${finalPrice}`);



                if (finalPrice < 1000) {

                    console.warn(`⚠️ [${traceId}] Precio bajo detectado. Ajustando a 10000.`);

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



        const uniqueRef = `${userId}_${traceId}`;

        console.log(`🔑 [${traceId}] External Reference generado: ${uniqueRef}`);



        const preference = new Preference(client);

        const preferenceData = {

            body: {

                items: line_items,

                binary_mode: true,

                payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }], installments: 1 },

                back_urls: {

                    success: `https://offszn.onrender.com/pages/success.html`,

                    failure: `https://offszn.onrender.com/pages/marketplace.html`,

                    pending: `https://offszn.onrender.com/pages/marketplace.html`

                },

                auto_return: 'approved',

                notification_url: `https://offszn-academy.onrender.com/api/orders/mercadopago-webhook`,

                external_reference: uniqueRef,

                statement_descriptor: "OFFSZN"

            }

        };



        const result = await preference.create(preferenceData);

        const paymentUrl = result.init_point;



        console.log(`✅ [${traceId}] Preferencia Creada OK`);

        console.log(`🔗 [${traceId}] URL: ${paymentUrl}`);



        res.status(200).json({ url: paymentUrl, externalReference: uniqueRef });



    } catch (err) {

        console.error(`🔴 [${traceId}] EXCEPTION:`, err);

        res.status(500).json({ error: err.message });

    }

};



// ------------------------------------------------------------------

// 2. WEBHOOK (CON AUDITORÍA DE RAW REQUEST)

// ------------------------------------------------------------------

export const handleMercadoPagoWebhook = async (req, res) => {

    const id = req.query.id || req.query['data.id'];

    const topic = req.query.topic || req.query.type;



    console.log(`🔔 [Webhook IN] Topic: ${topic} | ID: ${id}`);



    // Logueamos el body completo por si acaso viene algo raro

    if (Object.keys(req.body).length > 0) {

        console.log(`📦 [Webhook Body]:`, JSON.stringify(req.body));

    }



    if (topic === 'payment') {

        res.status(200).send('OK');

        processPaymentAudit(id); // Función especial de auditoría

    } else {

        console.log(`ℹ️ [Webhook] Ignorando topic no-pago: ${topic}`);

        res.status(200).send('OK');

    }

};



// ------------------------------------------------------------------

// 3. PROCESAMIENTO DE PAGO (CON TRAZA DE API EXTERNA)

// ------------------------------------------------------------------

const processPaymentAudit = async (paymentId) => {

    console.log(`🕵️ [AUDIT START] Iniciando investigación para pago ${paymentId}`);



    // Verificamos QUÉ token estamos usando en este preciso instante

    const currentToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    const maskedToken = currentToken ? `${currentToken.substring(0, 10)}...` : 'NULL';

    console.log(`🔑 [AUDIT TOKEN] Usando token: ${maskedToken}`);



    const maxRetries = 5;

    let attempt = 0;



    while (attempt < maxRetries) {

        attempt++;

        const delay = 5000; // 5 segundos fijos para probar

        console.log(`⏳ [AUDIT LOOP] Intento ${attempt}/${maxRetries} - Esperando ${delay}ms...`);



        await new Promise(r => setTimeout(r, delay));



        try {

            const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;

            console.log(`🚀 [AUDIT FETCH] GET ${url}`);



            const response = await fetch(url, {

                method: 'GET',

                headers: {

                    'Authorization': `Bearer ${currentToken}`,

                    'Content-Type': 'application/json'

                }

            });



            console.log(`📡 [AUDIT RESPONSE] Status Code: ${response.status}`);



            if (response.ok) {

                const data = await response.json();

                console.log(`✅ [AUDIT SUCCESS] Pago encontrado! Status: ${data.status}`);

                console.log(`👤 [AUDIT REF] External Reference: ${data.external_reference}`);



                if (data.status === 'approved') {

                    await saveOrderToDB(data);

                }

                return; // Terminamos

            } else {

                // SI FALLA, QUEREMOS VER EL ERROR EXACTO DE MP

                const errorText = await response.text();

                console.warn(`⚠️ [AUDIT FAIL] MP Respondió: ${errorText}`);

            }



        } catch (e) {

            console.error(`🔴 [AUDIT ERROR] Fallo de red/código:`, e);

        }

    }

    console.error(`❌ [AUDIT END] Se rindió la búsqueda del pago ${paymentId}`);

};



// ------------------------------------------------------------------

// 4. GUARDADO EN DB (SEPARADO PARA LIMPIEZA)

// ------------------------------------------------------------------

async function saveOrderToDB(paymentInfo) {

    const userId = paymentInfo.external_reference?.split('_')[0];

    if (!userId) {

        console.error("❌ [DB] No UserID in reference");

        return;

    }



    console.log(`💾 [DB] Guardando orden para User: ${userId}`);



    const { data: order, error: errOrder } = await supabase

        .from('orders')

        .insert({

            user_id: userId,

            paypal_order_id: paymentInfo.id.toString(),

            status: 'completed',

            total_price: paymentInfo.transaction_amount

        })

        .select('id')

        .single();



    if (errOrder) {

        if (errOrder.code === '23505') {

            console.log("⚠️ [DB] Orden ya existía (Duplicado controlado).");

            return;

        }

        console.error("🔴 [DB] Error insertando orden:", errOrder);

        return;

    }



    // Items

    const items = paymentInfo.additional_info?.items || [];

    if (items.length) {

        const itemsData = items.map(i => ({

            order_id: order.id,

            product_id: parseInt(i.id),

            quantity: 1,

            price_at_purchase: parseFloat(i.unit_price)

        }));

        const { error: errItems } = await supabase.from('order_items').insert(itemsData);

        if (errItems) console.error("🔴 [DB] Error insertando items:", errItems);

        else console.log("🎉 [DB] Items guardados correctamente.");

    }

}



// 5. POLLING (Sin cambios, pero exportada)

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



// 6. RUTA DE EMERGENCIA (LA NECESITARÁS)

export const forceCheckPayment = async (req, res) => {

    const { paymentId } = req.params;

    console.log(`🚨 [FORCE] Iniciando forzado manual para ${paymentId}`);

    processPaymentAudit(paymentId); // Reutilizamos la lógica de auditoría

    res.json({ message: "Proceso forzado iniciado en background. Revisa logs." });

};