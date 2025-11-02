import { supabase } from '../../database/connection.js';
import { client as paypalClient } from '../../services/paypal/paypalClient.js';
import paypal from '@paypal/checkout-server-sdk';

export const createOrder = async (req, res) => {
    try {
        const { cartItems, productId, description } = req.body; // Aceptamos 'productId' O 'cartItems'
        const userId = req.user.userId;

        let itemsParaGuardar = [];
        let precioTotalCalculado = 0;
        let descripcionOrden;

        if (productId) {
            // --- LÓGICA DE "COMPRAR AHORA" (UN SOLO PRODUCTO) ---

            // 1. OBTENER EL PRECIO REAL DESDE LA BASE DE DATOS
            const { data: product, error } = await supabase
                .from('products')
                .select('id, name, price_usd')
                .eq('id', productId)
                .single();

            if (error || !product) {
                return res.status(404).json({ error: 'Producto no encontrado.' });
            }

            // 2. Armar los datos del pedido
            precioTotalCalculado = parseFloat(product.price_usd);
            descripcionOrden = description || product.name;
            itemsParaGuardar = [{
                productId: product.id,
                quantity: 1,
                price: precioTotalCalculado // Precio real de la BBDD
            }];

        } else if (cartItems && cartItems.length > 0) {
            // --- LÓGICA DE CARRITO (LA QUE TENÍAS PENSADA) ---

            // 1. OBTENER PRECIOS REALES DEL CARRITO (¡NUNCA CONFÍES EN EL PRECIO DEL CLIENTE!)
            const productIds = cartItems.map(item => item.productId);
            const { data: products, error } = await supabase
                .from('products')
                .select('id, price_usd')
                .in('id', productIds);

            if (error) throw new Error('Error al verificar precios del carrito.');

            // 2. Calcular el total en el servidor
            precioTotalCalculado = 0;
            itemsParaGuardar = cartItems.map(item => {
                const product = products.find(p => p.id === item.productId);
                if (!product) throw new Error(`Producto ID ${item.productId} no encontrado.`);

                const itemPrice = parseFloat(product.price_usd);
                precioTotalCalculado += itemPrice * (item.quantity || 1);

                return {
                    productId: item.productId,
                    quantity: item.quantity || 1,
                    price: itemPrice // Precio real de la BBDD
                };
            });
            descripcionOrden = description || 'Compra de varios items';

        } else {
            return res.status(400).json({ error: 'No se proporcionaron items para comprar.' });
        }

        // --- LÓGICA DE PAYPAL (USA LOS DATOS CALCULADOS) ---
        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return=representation");
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                description: descripcionOrden,
                amount: {
                    currency_code: 'USD',
                    value: precioTotalCalculado.toFixed(2) // Usamos el precio 100% seguro del servidor
                }
            }]
        });

        const order = await paypalClient().execute(request);
        const paypalOrderId = order.result.id;

        // --- GUARDAR EN BASE DE DATOS (USA LOS DATOS CALCULADOS) ---
        const { data: newOrderData, error: orderInsertError } = await supabase
            .from('orders')
            .insert({
                user_id: userId,
                paypal_order_id: paypalOrderId,
                status: 'created',
                total_price: precioTotalCalculado // Precio seguro del servidor
            })
            .select('id')
            .single();

        if (orderInsertError || !newOrderData) {
            throw new Error('Error al guardar la orden: ' + orderInsertError?.message);
        }
        const newOrderId = newOrderData.id;

        // Mapear los items para guardar en 'order_items'
        const itemsToInsert = itemsParaGuardar.map(item => ({
            order_id: newOrderId,
            product_id: item.productId,
            quantity: item.quantity,
            price_at_purchase: item.price // Precio seguro del servidor
        }));

        const { error: itemsInsertError } = await supabase
            .from('order_items')
            .insert(itemsToInsert);

        if (itemsInsertError) {
            throw new Error('Error al guardar los items de la orden: ' + itemsInsertError?.message);
        }

        res.status(201).json({ orderID: paypalOrderId });

    } catch (err) {
        console.error("Error en createOrder:", err.message);
        res.status(500).json({ error: err.message || 'Error al crear la orden' });
    }
};

export const captureOrder = async (req, res) => {
    try {
        const { orderID } = req.body;

        const userId = req.user.userId;

        if (!orderID) {
            return res.status(400).json({ error: 'PayPal Order ID es requerido.' });
        }

        const request = new paypal.orders.OrdersCaptureRequest(orderID);
        request.requestBody({});

        const capture = await paypalClient().execute(request);
        const captureStatus = capture.result.status;

        if (captureStatus === 'COMPLETED') {
            const { error: updateError } = await supabase
                .from('orders')
                .update({ status: 'completed' })
                .eq('paypal_order_id', orderID);

            if (updateError) {
                console.error("ALERTA: Error al actualizar la orden en Supabase después del pago:", updateError);
            } else {
                try {
                    console.log(`Pago completado para orden ${orderID}. Vaciando carrito para usuario ${userId}...`);
                    const { error: deleteCartError } = await supabase
                        .from('cart_items')
                        .delete()
                        .eq('user_id', userId);

                    if (deleteCartError) {
                        console.error(`ALERTA: Error al vaciar el carrito para user ${userId} después de orden ${orderID}:`, deleteCartError.message);
                    } else {
                        console.log(`Carrito vaciado exitosamente para user ${userId}.`);
                    }
                } catch (cartClearErr) {
                    console.error(`ALERTA: Excepción al vaciar carrito para user ${userId}:`, cartClearErr.message);
                }
            }

            res.status(200).json({ status: 'COMPLETED', capture: capture.result });

        } else {
            console.warn("Captura de PayPal no completada:", capture.result);
            res.status(400).json({ status: 'NOT_COMPLETED', capture: capture.result });
        }

    } catch (err) {
        console.error("Error en captureOrder:", err.message);
        if (err.statusCode && err.message) {
            try {
                const errorDetails = JSON.parse(err.message);
                return res.status(err.statusCode).json({ error: 'Error de PayPal', details: errorDetails });
            } catch (parseError) {
                return res.status(err.statusCode || 500).json({ error: 'Error al capturar el pago', details: err.message });
            }
        }
        res.status(500).json({ error: err.message || 'Error al capturar el pago' });
    }
};