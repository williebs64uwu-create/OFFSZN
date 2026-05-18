import { supabase } from '../../database/connection.js';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';
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

    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
        attempt++;
        const delay = 5000; // 5 segundos fijos para probar
        console.log(`⏳ [AUDIT LOOP] Intento ${attempt}/${maxRetries} - Esperando ${delay}ms...`);

        await new Promise(r => setTimeout(r, delay));

        try {
            const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;
            const currentToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ [AUDIT SUCCESS] Pago encontrado! Status: ${data.status}`);
                if (data.status === 'approved') {
                    await saveOrderToDB(data);
                }
                return;
            } else {
                const errorText = await response.text();
                console.warn(`⚠️ [AUDIT FAIL] MP Respondió: ${errorText}`);
            }
        } catch (e) {
            console.error(`🔴 [AUDIT ERROR] Fallo de red/código:`, e);
        }
    }
};

// ------------------------------------------------------------------
// 4. GUARDADO EN DB (SEPARADO PARA LIMPIEZA)
// ------------------------------------------------------------------
async function saveOrderToDB(paymentData) {
    const metadata = JSON.parse(paymentData.external_reference);
    const userId = metadata.u_id;

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            user_id: userId,
            transaction_id: paymentData.id.toString(),
            status: paymentData.status,
            total_price: paymentData.transaction_amount
        })
        .select()
        .single();

    if (orderError) {
        console.error("Error guardando orden:", orderError);
        return;
    }

    const items = paymentData.additional_info?.items || [];

    if (items.length > 0) {
        const orderItems = items.map(item => ({
            order_id: order.id,
            product_id: parseInt(item.id),
            quantity: 1,
            price_at_purchase: item.unit_price
        }));

        await supabase.from('order_items').insert(orderItems);

        const downloadLogs = orderItems.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            user_id: userId,
            ip_address: 'mercadopago_webhook',
            user_agent: 'MercadoPago/Webhook'
        }));
        await supabase.from('download_logs').insert(downloadLogs);

        for (const item of orderItems) {
            try {
                const { data: prod } = await supabase.from('products').select('sales_count').eq('id', item.product_id).single();
                if (prod) {
                    await supabase.from('products').update({ sales_count: (prod.sales_count || 0) + 1 }).eq('id', item.product_id);
                }
            } catch (e) {
                console.warn(`[SalesCount] Error incrementing for ${item.product_id}:`, e);
            }
        }
    }
}

// 5. POLLING
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

// 6. RUTA DE EMERGENCIA
export const forceCheckPayment = async (req, res) => {
    const { paymentId } = req.params;
    processPaymentAudit(paymentId);
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

        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('id, name, is_free, price_basic, downloads_count, producer_id')
            .eq('id', productId)
            .single();

        if (fetchError || !product) return res.status(404).json({ error: 'Producto no encontrado' });

        if (product.is_free !== true && parseFloat(product.price_basic) > 0) {
            return res.status(403).json({ error: 'Este producto no es gratuito' });
        }

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

        await supabase.from('order_items').insert({
            order_id: order.id,
            product_id: product.id,
            quantity: 1,
            price_at_purchase: 0
        });

        try {
            await supabase.from('download_logs').insert({
                order_id: order.id,
                product_id: product.id,
                user_id: userId,
                ip_address: req.ip || req.headers['x-forwarded-for'],
                user_agent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.error("[Log] Error creating download log:", logErr);
        }

        await supabase.rpc('increment_product_downloads', { row_id: product.id });

        try {
            const { data: userData } = await supabase.from('users').select('email, nickname').eq('id', userId).single();
            if (userData?.email) {
                const userNickname = userData.nickname || 'Usuario';
                const freeHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000000; color: #ffffff; margin: 0; padding: 0; }
                        .wrapper { width: 100%; table-layout: fixed; background-color: #000000; padding: 60px 0; }
                        .container { max-width: 500px; margin: 0 auto; background-color: #000000; padding: 0 20px; }
                        .header { padding-bottom: 40px; text-align: left; }
                        .content { text-align: left; }
                        .footer { padding-top: 60px; text-align: left; color: #555555; font-size: 12px; border-top: 1px solid #111; margin-top: 60px; }
                        .logo { height: 32px; filter: brightness(0) invert(1); }
                        h1 { font-size: 28px; font-weight: 700; color: #ffffff; margin: 0 0 20px 0; letter-spacing: -0.5px; }
                        p { font-size: 16px; color: #888888; line-height: 1.6; margin-bottom: 30px; }
                        .product-tag { display: inline-block; background: #111; color: #fff; padding: 6px 14px; border-radius: 6px; font-size: 14px; margin-bottom: 20px; border: 1px solid #222; }
                        .button { background-color: #ffffff; color: #000000; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; margin-bottom: 40px; }
                        a { color: #ffffff; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <div class="wrapper">
                        <div class="container">
                            <div class="header">
                                <img src="https://offszn.lat/images/logo.webp" alt="OFFSZN" class="logo">
                            </div>
                            <div class="content">
                                <div class="product-tag">🎹 ${product.name}</div>
                                <h1>Hola, ${userNickname}</h1>
                                <p>Tu nuevo recurso ha sido añadido con éxito a tu colección de <strong>OFFSZN</strong>.</p>
                                
                                <a href="https://offszn.lat/mis-compras" class="button">Ver mis descargas</a>

                                <p style="font-size: 14px; color: #444444; margin-top: 20px;">
                                    Recuerda que puedes acceder a tus archivos en cualquier momento desde tu panel de usuario.
                                </p>
                            </div>
                            <div class="footer">
                                <p>© 2026 OFFSZN. The Premium Producer Marketplace.<br>
                                <a href="https://instagram.com/offszn.lat">Instagram</a> • <a href="https://tiktok.com/@offszn.lat">TikTok</a> • <a href="https://offszn.lat">Web</a></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
                `;
                await sendOffsznEmail({ to: userData.email, subject: `🎁 Descarga Lista - ${product.name}`, html: freeHtml, fromName: 'OFFSZN' })
                    .catch(e => console.error("[Email] Background receipt failed:", e));

                if (product.producer_id) {
                    const { data: prodData } = await supabase.from('users').select('email, nickname').eq('id', product.producer_id).single();
                    if (prodData?.email) {
                        const prodHtml = `<div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px;">
                            <h2 style="color: #3B82F6; margin-bottom:20px;">¡Nueva Descarga! 📥</h2>
                            <p><b>${userNickname}</b> descargó gratis <b style="color:#fff;">${product.name}</b>.</p>
                        </div>`;
                        sendOffsznEmail({ to: prodData.email, subject: `🚀 ¡Nueva descarga gratuita! - ${product.name}`, html: prodHtml, fromName: 'OFFSZN No-Reply' })
                            .catch(e => console.error("[Email] Background producer notification failed:", e));
                    }
                }
            }
        } catch (emailErr) { console.error("[Email] Error sending free download receipt:", emailErr); }

        res.status(201).json({ message: 'Descarga registrada en tu dashboard correctamente', orderId: order.id });

    } catch (err) {
        console.error("Error creating free order:", err.message);
        res.status(500).json({ error: 'Error al registrar la descarga gratuita' });
    }
};

// ------------------------------------------------------------------
// 8. GUEST DOWNLOAD FLOW
// ------------------------------------------------------------------
export const handleFreeGuestDownload = async (req, res) => {
    try {
        const { productId, guestEmail } = req.body;
        if (!productId || !guestEmail) return res.status(400).json({ error: 'Faltan datos' });

        // A. Product info with fallback for Analyzer
        let product;
        const isAnalyzer = productId === 'x-flow-analyzer';

        if (isAnalyzer) {
            product = { id: 'x-flow-analyzer', name: 'X Flow - Analyzer', is_free: true, producer_id: 'offszn-official' };
        } else {
            const { data, error: fetchError } = await supabase.from('products').select('*').eq('id', productId).single();
            if (fetchError || !data) return res.status(404).json({ error: 'Producto no encontrado' });
            if (data.is_free !== true) return res.status(403).json({ error: 'No es gratuito' });
            product = data;
        }

        // B. Incrementar contador y Persistencia
        let orderId = null;
        try {
            if (!isAnalyzer) {
                await supabase.rpc('increment_product_downloads', { row_id: product.id });
                const { data: newOrder } = await supabase.from('orders').insert([{
                    guest_email: guestEmail,
                    status: 'completed',
                    total_price: 0,
                    producer_id: product.producer_id,
                    product_id: parseInt(productId),
                    transaction_id: `GUEST-${Date.now()}`
                }]).select('id').single();

                if (newOrder) {
                    orderId = newOrder.id;
                    await supabase.from('order_items').insert([{ order_id: orderId, product_id: parseInt(productId), price_at_purchase: 0, quantity: 1 }]);
                    await supabase.from('download_logs').insert([{ order_id: orderId, product_id: parseInt(productId), ip_address: req.ip || '0.0.0.0', user_agent: req.headers['user-agent'] || 'Guest' }]);
                    await supabase.from('free_downloads').insert([{ product_id: parseInt(productId), email: guestEmail, ip_address: req.ip || '0.0.0.0' }]);
                }
            } else {
                console.log(`[GuestDownload] Analyzer free guest download recorded for ${guestEmail}`);
            }
        } catch (dbErr) { console.error("[GuestDownload] DB Error:", dbErr.message); }

        // RESPUESTA RÁPIDA
        res.status(200).json({ message: 'OK' });

        // EMAILS (BACKGROUND)
        (async () => {
            try {
                console.log(`[GuestDownload] Starting background tasks for: ${guestEmail}`);
                const { data: existingUser } = await supabase.from('users')
                    .select('nickname')
                    .eq('email', guestEmail)
                    .maybeSingle();
                    let subject;
                    if (isAnalyzer) {
                        subject = `Procesamos tu descarga de X Flow - Analyzer`;
                    } else {
                        subject = existingUser ? `✨ ¡Hola de nuevo, ${existingUser.nickname}! Tu descarga está lista 🎹` : `📥 ¡Tu descarga de ${product.name} está lista! ✨`;
                    }
                    
                    const productTypeLabel = isAnalyzer ? '🛠️ Software' : `🎹 ${product.name}`;
                    const productActionLabel = isAnalyzer ? 'Descarga Procesada Correctamente' : 'Tu producto está listo para descargar';

                    const html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000000; color: #ffffff; margin: 0; padding: 0; }
                            .wrapper { width: 100%; table-layout: fixed; background-color: #000000; padding: 60px 0; }
                            .container { max-width: 500px; margin: 0 auto; background-color: #000000; padding: 0 20px; }
                            .header { padding-bottom: 40px; text-align: left; }
                            .content { text-align: left; }
                            .footer { padding-top: 60px; text-align: left; color: #555555; font-size: 12px; border-top: 1px solid #111; margin-top: 60px; }
                            .logo { height: 32px; filter: brightness(0) invert(1); }
                            h1 { font-size: 28px; font-weight: 700; color: #ffffff; margin: 0 0 20px 0; letter-spacing: -0.5px; }
                            p { font-size: 16px; color: #888888; line-height: 1.6; margin-bottom: 30px; }
                            .product-tag { display: inline-block; background: #111; color: #fff; padding: 6px 14px; border-radius: 6px; font-size: 14px; margin-bottom: 20px; border: 1px solid #222; }
                            .button { background-color: #ffffff; color: #000000; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; margin-bottom: 40px; }
                            .benefits-title { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #ffffff; margin-bottom: 20px; }
                            .benefits-list { list-style: none; padding: 0; margin: 0 0 40px 0; }
                            .benefit-item { display: flex; align-items: center; font-size: 15px; color: #888888; margin-bottom: 12px; }
                            .benefit-icon { color: #ffffff; margin-right: 12px; font-weight: bold; }
                            a { color: #ffffff; text-decoration: none; }
                        </style>
                    </head>
                    <body>
                        <div class="wrapper">
                            <div class="container">
                                <div class="header">
                                    <img src="https://offszn.lat/images/logo.webp" alt="OFFSZN" class="logo">
                                </div>
                                <div class="content">
                                    <div class="product-tag">${productTypeLabel}</div>
                                    <h1>${productActionLabel}</h1>
                                    <p>Gracias por confiar en <strong>OFFSZN</strong>. Hemos procesado tu descarga correctamente.</p>
                                    
                                    <a href="https://offszn.lat/register" class="button">Crear mi cuenta en OFFSZN</a>

                                    <div class="benefits-title">Al tener una cuenta podrás:</div>
                                    <div class="benefits-list">
                                        <div class="benefit-item"><span class="benefit-icon">✓</span> Guardar tus descargas para siempre</div>
                                        <div class="benefit-item"><span class="benefit-icon">✓</span> Conectar con productores y artistas</div>
                                        <div class="benefit-item"><span class="benefit-icon">✓</span> Vender tus productos y personalizar tu perfil</div>
                                        <div class="benefit-item"><span class="benefit-icon">✓</span> Y mucho más...</div>
                                    </div>
                                </div>
                                <div class="footer">
                                    <p>© 2026 OFFSZN. The Premium Producer Marketplace.<br>
                                    <a href="https://instagram.com/offszn.lat">Instagram</a> • <a href="https://tiktok.com/@offszn.lat">TikTok</a> • <a href="https://offszn.lat">Web</a></p>
                                </div>
                            </div>
                        </div>
                    </body>
                    </html>
                    `;

                    await sendOffsznEmail({ to: guestEmail, subject, html, fromName: 'OFFSZN' });
            } catch (e) { console.error("[GuestDownload] Email Flow Error:", e.message); }
        })();

    } catch (err) {
        console.error("[GuestDownload] Critical Error:", err);
        if (!res.headersSent) res.status(500).json({ error: 'Internal Error' });
    }
};