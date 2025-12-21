import { supabase } from '../../database/connection.js';
import { MercadoPagoConfig, Preference } from 'mercadopago';
// Validar cliente al inicio
const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
if (!token) console.error("🔥 [CRITICAL] NO TOKEN FOUND IN CONTROLLER INIT");
const client = new MercadoPagoConfig({ accessToken: token });
// ------------------------------------------------------------------
// 1. CREAR PREFERENCIA (CON DEBUG DE PRECIO Y URL)
// ------------------------------------------------------------------
const TASA_CAMBIO_USD_PEN = 3.80; 

export const createMercadoPagoPreference = async (req, res) => {
    try {
        const userId = req.user.userId; // Asumiendo que tu middleware pone esto aquí
        const { cartItems } = req.body;

        if (!cartItems?.length) return res.status(400).json({ error: 'Carrito vacío' });

        // 1. Obtener productos reales de la BD para seguridad (no confiar en el frontend)
        const productIds = cartItems.map(item => item.id);
        
        // OJO: Tu ID es bigint (numero), asegurate que productIds sean numeros
        const { data: dbProducts, error } = await supabase
            .from('products')
            .select('id, name, price_basic, image_url, currency') // Traemos la moneda original
            .in('id', productIds);

        if (error) throw error;

        const line_items = [];
        let totalEnSoles = 0;

        dbProducts.forEach(product => {
            let unitPrice = parseFloat(product.price_basic);
            
            // --- CONVERSIÓN DE MONEDA ---
            // Si el producto está en USD, lo pasamos a PEN
            if (product.currency === 'USD') {
                unitPrice = unitPrice * TASA_CAMBIO_USD_PEN;
            }
            // Si el producto ya está en PEN, lo dejamos igual.

            // Validación de mínimo de Mercado Pago Perú (aprox 1 Sol)
            if (unitPrice < 1) unitPrice = 1;

            totalEnSoles += unitPrice;

            line_items.push({
                id: product.id.toString(),
                title: product.name,
                picture_url: product.image_url,
                quantity: 1,
                currency_id: 'PEN', // ¡SIEMPRE PEN PORQUE TU CUENTA ES PERUANA!
                unit_price: Number(unitPrice.toFixed(2))
            });
        });

        // Referencia externa para saber quién compró cuando llegue el Webhook
        // Usamos JSON string para pasar metadata útil
        const externalRef = JSON.stringify({
            u_id: userId,
            ts: Date.now()
        });

        const preference = new Preference(client);
        
        const result = await preference.create({
            body: {
                items: line_items,
                // URLs a las que MP redirige al usuario
                back_urls: {
                    success: "https://offszn.onrender.com/pages/pago-exitoso.html",
                    failure: "https://offszn.onrender.com/pages/cart.html",
                    pending: "https://offszn.onrender.com/pages/cart.html"
                },
                auto_return: "approved",
                external_reference: externalRef, // Aquí guardamos el ID del usuario
                statement_descriptor: "OFFSZN",
                binary_mode: true // Solo acepta pagos aprobados o rechazados (no pendientes)
            }
        });

        res.status(200).json({ url: result.init_point });

    } catch (err) {
        console.error("Error creando preferencia:", err);
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

async function saveOrderToDB(paymentData) {
    // paymentData viene de la API de Mercado Pago
    
    // Decodificar referencia para sacar el User ID
    const metadata = JSON.parse(paymentData.external_reference);
    const userId = metadata.u_id;

    // 1. Insertar Orden
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            user_id: userId,
            transaction_id: paymentData.id.toString(), // ID de Mercado Pago
            status: paymentData.status, // 'approved'
            total_price: paymentData.transaction_amount
        })
        .select()
        .single();

    if (orderError) {
        console.error("Error guardando orden:", orderError);
        return;
    }

    // 2. Insertar Items (Necesitamos saber qué compró)
    // Mercado Pago a veces no devuelve los items en el webhook de pago simple.
    // ESTRATEGIA: Como ya cobramos, asumimos que son los items de la preferencia.
    // O mejor: Guardar los items en una tabla 'pending_orders' antes de ir a MP y moverlos aquí.
    
    // PARA MVP RÁPIDO:
    // El 'paymentData.additional_info.items' suele traer la info si se configuró bien.
    const items = paymentData.additional_info?.items || [];
    
    if (items.length > 0) {
        const orderItems = items.map(item => ({
            order_id: order.id, // ID bigint generado
            product_id: parseInt(item.id),
            quantity: 1,
            price_at_purchase: item.unit_price
        }));

        await supabase.from('order_items').insert(orderItems);
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