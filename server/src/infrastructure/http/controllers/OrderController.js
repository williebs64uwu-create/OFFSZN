import { supabase } from '../../database/connection.js';
import { client as paypalClient } from '../../services/paypal/paypalClient.js';
import paypal from '@paypal/checkout-server-sdk';

export const createOrder = async (req, res) => {
    try {
        const { totalPrice, description, cartItems } = req.body;
        const userId = req.user.userId;

        if (!totalPrice || isNaN(parseFloat(totalPrice)) || parseFloat(totalPrice) <= 0) {
            return res.status(400).json({ error: 'Precio total inválido' });
        }
        if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
            return res.status(400).json({ error: 'No hay items en el carrito' });
        }

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return=representation");
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                description: description || 'Compra en OFFSZN Academy',
                amount: { currency_code: 'USD', value: totalPrice }
            }]
        });

        const order = await paypalClient().execute(request);
        const paypalOrderId = order.result.id;

        const { data: newOrderData, error: orderInsertError } = await supabase
            .from('orders')
            .insert({ user_id: userId, paypal_order_id: paypalOrderId, status: 'created', total_price: parseFloat(totalPrice) })
            .select('id')
            .single();

        if (orderInsertError || !newOrderData) {
            console.error("Error al guardar orden principal:", orderInsertError);
            throw new Error('Error al guardar la orden principal.');
        }
        const newOrderId = newOrderData.id;

        const itemsToInsert = cartItems.map(item => ({
            order_id: newOrderId,
            product_id: item.productId,
            quantity: item.quantity,
            price_at_purchase: item.price
        }));
        const { error: itemsInsertError } = await supabase
            .from('order_items')
            .insert(itemsToInsert);

        if (itemsInsertError) {
            console.error("Error al guardar items de la orden:", itemsInsertError);
            throw new Error('Error al guardar los detalles de la orden.');
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