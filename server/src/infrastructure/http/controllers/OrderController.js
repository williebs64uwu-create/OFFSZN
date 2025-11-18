import { supabase } from '../../database/connection.js';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

// --- CONFIGURACIÓN DE MERCADO PAGO ---
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

export const createMercadoPagoPreference = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { cartItems } = req.body; // Esperamos un array de { id: 1, ... }

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ error: 'El carrito está vacío.' });
        }

        // 1. OBTENER PRECIOS REALES DE LA BASE DE DATOS (SEGURIDAD)
        const productIds = cartItems.map(item => item.id);
        const { data: dbProducts, error } = await supabase
            .from('products')
            .select('id, name, price_basic, image_url, producer_id') // Asegúrate de traer el precio correcto
            .in('id', productIds);

        if (error || !dbProducts) {
            throw new Error('Error al validar productos en la base de datos.');
        }

        // 2. CONSTRUIR LOS ITEMS DE MERCADO PAGO
        const line_items = [];

        cartItems.forEach(cartItem => {
            // Buscamos el producto real en la DB
            const product = dbProducts.find(p => p.id === cartItem.id);
            
            if (product) {
                // Aquí asumimos precio básico. Si tienes licencias, el frontend debe enviar qué licencia es
                // y aquí validarías: if (cartItem.license === 'premium') price = product.price_premium
                const price = product.price_basic; 

                if (price > 0) { // Solo agregamos si tiene costo
                    line_items.push({
                        id: product.id.toString(), // ID REAL DEL PRODUCTO
                        title: product.name.substring(0, 250),
                        description: 'Producto Digital - OFFSZN',
                        picture_url: product.image_url,
                        quantity: 1,
                        currency_id: 'COP', // Moneda forzada a pesos colombianos
                        unit_price: parseFloat(price) // PRECIO REAL DE LA DB
                    });
                }
            }
        });

        if (line_items.length === 0) {
            return res.status(400).json({ error: 'No hay items válidos para procesar el pago.' });
        }

        // 3. CREAR PREFERENCIA
        const preference = new Preference(client);
        const preferenceData = {
            body: {
                items: line_items,
                payer: {
                    email: req.user.email // Pre-llenar el email del usuario ayuda a MP
                },
                back_urls: {
                    // Asegúrate que estas URLs existan en tu frontend o router
                    success: `https://offszn.onrender.com/pages/success.html`, 
                    failure: `https://offszn.onrender.com/pages/marketplace.html?status=failure`,
                    pending: `https://offszn.onrender.com/pages/marketplace.html?status=pending`
                },
                auto_return: 'approved',
                // Tu URL de producción para el webhook
                notification_url: `https://offszn-academy.onrender.com/api/orders/mercadopago-webhook`,
                external_reference: userId.toString(), // Guardamos el ID del usuario aquí
                statement_descriptor: "OFFSZN MARKET",
                metadata: {
                    user_id: userId // Metadata extra por si acaso
                }
            }
        };

        const result = await preference.create(preferenceData);

        res.status(200).json({ 
            url: result.init_point // 'init_point' es para PROD, 'sandbox_init_point' para pruebas
        });

    } catch (err) {
        console.error("Error createMercadoPagoPreference:", err);
        res.status(500).json({ error: 'Error al iniciar el pago.' });
    }
};

// ==========================================================
// WEBHOOK MEJORADO
// ==========================================================
export const handleMercadoPagoWebhook = async (req, res) => {
    const topic = req.query.topic || req.query.type;
    const id = req.query.id || req.query['data.id'];

    if (topic !== 'payment') {
        return res.status(200).send('OK');
    }

    try {
        // 1. Consultar el estado del pago en MP
        const payment = new Payment(client);
        const paymentInfo = await payment.get({ id: id });

        if (paymentInfo.status === 'approved') {
            const userId = paymentInfo.external_reference; // Recuperamos el ID del usuario
            const orderIdMP = paymentInfo.id;
            const itemsMP = paymentInfo.additional_info.items; // Items que envió MP
            const totalPaid = paymentInfo.transaction_amount;

            console.log(`Pago aprobado: ${orderIdMP} para usuario ${userId}`);

            // 2. Crear la Orden Principal
            const { data: newOrder, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: userId,
                    paypal_order_id: orderIdMP.toString(), // Usamos este campo para guardar el ID de MP
                    status: 'completed',
                    total_price: totalPaid
                })
                .select('id')
                .single();

            if (orderError) throw orderError;

            // 3. Mapear Items usando el ID (Mucho más seguro que el nombre)
            const orderItemsData = itemsMP.map(item => ({
                order_id: newOrder.id,
                product_id: parseInt(item.id), // El ID que pusimos en createPreference
                quantity: parseInt(item.quantity),
                price_at_purchase: parseFloat(item.unit_price)
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItemsData);

            if (itemsError) throw itemsError;
            
            console.log('Orden guardada exitosamente.');
        }

        res.status(200).send('OK');

    } catch (error) {
        console.error("Webhook Error:", error);
        // IMPORTANTE: Siempre responder 200 o 201 a MP, si no, te seguirá enviando el webhook.
        res.status(500).json({ error: error.message }); 
    }
};