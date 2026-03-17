import { supabase } from '../../database/connection.js';
import { MercadoPagoConfig, Preference } from 'mercadopago';
// Validar cliente al inicio
const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
if (!token) console.error("🔥 [CRITICAL] NO TOKEN FOUND IN CONTROLLER INIT");
const client = token ? new MercadoPagoConfig({ accessToken: token }) : null;
// ------------------------------------------------------------------
// 1. CREAR PREFERENCIA (CON DEBUG DE PRECIO Y URL)
// ------------------------------------------------------------------
const TASA_CAMBIO_USD_COP = 4200;

export const createMercadoPagoPreference = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { cartItems } = req.body;

        if (!cartItems?.length) return res.status(400).json({ error: 'Carrito vacío' });

        const productIds = cartItems.map(item => item.id);

        const { data: dbProducts, error } = await supabase
            .from('products')
            .select('id, name, price_basic, image_url, currency')
            .in('id', productIds)
            .eq('status', 'approved');

        if (error) throw error;

        const line_items = [];
        let totalEnPesos = 0;

        dbProducts.forEach(product => {
            let unitPrice = parseFloat(product.price_basic);

            if (isNaN(unitPrice)) unitPrice = 10; // Protección contra NaN

            if (product.currency === 'USD' || !product.currency) {
                unitPrice = unitPrice * TASA_CAMBIO_USD_COP;
            }

            if (unitPrice < 500) unitPrice = 500;

            totalEnPesos += unitPrice;

            line_items.push({
                id: product.id.toString(),
                title: product.name,
                picture_url: product.image_url,
                quantity: 1,
                currency_id: 'COP',
                unit_price: Number(unitPrice.toFixed(2)) // Aseguramos que sea número
            });
        });

        const externalRef = JSON.stringify({
            u_id: userId,
            ts: Date.now()
        });

        // --- DETECCIÓN DE URL ---
        let clientURL = req.headers.origin || req.headers.referer;

        // Si no detecta URL o es localhost, usamos una por defecto limpia
        if (!clientURL || clientURL.includes('localhost') || clientURL.includes('127.0.0.1')) {
            // NOTA: Asegúrate de que este es el puerto donde ves tu página web
            clientURL = "http://127.0.0.1:5501";
        }

        // Limpiar trailing slash
        if (clientURL.endsWith('/')) clientURL = clientURL.slice(0, -1);

        console.log("🔗 URL Base:", clientURL);

        // --- CONSTRUCCIÓN DEL OBJETO ---
        const preferenceBody = {
            items: line_items,
            back_urls: {
                success: `${clientURL}/pages/purchase-succes.html`, // Tu archivo con 's' simple
                failure: `${clientURL}/pages/cart.html`,
                pending: `${clientURL}/pages/cart.html`
            },
            auto_return: "approved",
            external_reference: externalRef,
            statement_descriptor: "OFFSZN",
            binary_mode: true
        };

        // Preference body construido (no loggear por seguridad)

        const preference = new Preference(client);
        const result = await preference.create({ body: preferenceBody });

        res.status(200).json({ url: result.init_point });

    } catch (err) {
        // Logueamos el error completo
        console.error("❌ Error MP Detallado:", JSON.stringify(err, null, 2));
        res.status(500).json({
            error: err.message,
            details: err.cause || err
        });
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

        console.log(`📦 [Webhook Body]: ${Object.keys(req.body).length} keys`);

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

    // Token verificado internamente (sin loggear fragmentos)



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

        // 3. Increment sales_count for each product
        for (const item of orderItems) {
            try {
                const { data: prod } = await supabase
                    .from('products')
                    .select('sales_count')
                    .eq('id', item.product_id)
                    .single();

                if (prod) {
                    await supabase
                        .from('products')
                        .update({ sales_count: (prod.sales_count || 0) + 1 })
                        .eq('id', item.product_id);
                }
            } catch (e) {
                console.warn(`[SalesCount] Error incrementing for ${item.product_id}:`, e);
            }
        }
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

// ------------------------------------------------------------------
// 7. ORDENES GRATUITAS (DASHBOARD PERSISTENCE)
// ------------------------------------------------------------------
export const createFreeOrder = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { productId } = req.body;

        if (!productId) return res.status(400).json({ error: 'Falta ID del producto' });

        // 1. Verificar que el producto sea gratis
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('id, name, is_free, price_basic, downloads_count')
            .eq('id', productId)
            .single();

        if (fetchError || !product) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        if (product.is_free !== true && parseFloat(product.price_basic) > 0) {
            return res.status(403).json({ error: 'Este producto no es gratuito' });
        }

        // 2. Crear Orden $0
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                user_id: userId,
                transaction_id: `FREE-${Date.now()}-${userId.substring(0, 5)}`,
                status: 'completed',
                total_price: 0
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // 3. Crear Item de Orden
        const { error: itemError } = await supabase
            .from('order_items')
            .insert({
                order_id: order.id,
                product_id: product.id,
                quantity: 1,
                price_at_purchase: 0
            });

        if (itemError) throw itemError;

        // 4. Incrementar contador de descargas
        await supabase.rpc('increment_product_downloads', { row_id: product.id });

        res.status(201).json({
            message: 'Descarga registrada en tu dashboard correctamente',
            orderId: order.id
        });

    } catch (err) {
        console.error("Error creating free order:", err.message);
        res.status(500).json({ error: 'Error al registrar la descarga gratuita' });
    }
};