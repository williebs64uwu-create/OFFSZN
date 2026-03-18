import paypal from '@paypal/checkout-server-sdk';
import paypalClient from '../paypalClient.js';
import { supabase } from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';
import { sendReceiptEmail } from '../../../shared/utils/email.js';

/**
 * Creates a PayPal order for the X Flow - Analyzer with a hardcoded $10/$5 split.
 */
export const createAnalyzerOrder = async (req, res) => {
    try {
        const product_id = 'x-flow-analyzer';
        const price_total = 15.00;
        const amount_crocker = 10.00;
        const amount_willie = 5.00;

        // Recipient details
        const email_crocker = 'pagos.crockertheproducer@gmail.com';
        const merchant_id_willie = 'MXV5F6X8JXG4S'; // Provided by user

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return=representation");
        request.requestBody({
            intent: 'CAPTURE',
            application_context: {
                shipping_preference: "NO_SHIPPING",
                user_action: 'PAY_NOW'
            },
            purchase_units: [
                {
                    reference_id: `crocker_split_${uuidv4().substring(0, 8)}`,
                    amount: {
                        currency_code: 'USD',
                        value: amount_crocker.toFixed(2)
                    },
                    description: 'X Flow Analyzer - Part 1 (Producer)',
                    payee: { email_address: email_crocker }
                },
                {
                    reference_id: `willie_split_${uuidv4().substring(0, 8)}`,
                    amount: {
                        currency_code: 'USD',
                        value: amount_willie.toFixed(2)
                    },
                    description: 'X Flow Analyzer - Part 2 (Platform/Owner)',
                    payee: { merchant_id: merchant_id_willie }
                }
            ]
        });

        const response = await paypalClient.client().execute(request);
        console.log(`[AnalyzerOrder] Created Order: ${response.result.id}`);
        res.status(200).json({ id: response.result.id });

    } catch (err) {
        console.error("[AnalyzerOrder] Create Error:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Captures the PayPal order and records the sale in the dedicated analyzer_sales table.
 */
export const captureAnalyzerOrder = async (req, res) => {
    const { orderID } = req.body;
    const userId = req.user?.userId;

    try {
        const request = new paypal.orders.OrdersCaptureRequest(orderID);
        request.requestBody({});

        const response = await paypalClient.client().execute(request);
        console.log(`[AnalyzerCapture] Order ${orderID} Status: ${response.result.status}`);

        if (response.result.status === 'COMPLETED' || response.result.status === 'APPROVED') {
            const payerEmail = response.result.payer?.email_address;
            const amount = 15.00; // Total for this product

            // 1. Record Sale in Dedicated Table
            const { error: saleError } = await supabase
                .from('analyzer_sales')
                .insert([{
                    paypal_order_id: orderID,
                    user_id: userId || null,
                    buyer_email: payerEmail,
                    amount: amount,
                    status: 'completed'
                }]);

            if (saleError) {
                console.error("[AnalyzerCapture] Error recording sale:", saleError);
            }

            // 2. Notify (Async)
            (async () => {
                try {
                    // Notify Buyer
                    await sendReceiptEmail({
                        to_email: payerEmail,
                        downloader_name: (response.result.payer?.name?.given_name) || 'Comprador',
                        product_name: 'X Flow - Analyzer',
                        activity_type: 'compra confirmada'
                    });

                    // Notify Crocker
                    await sendReceiptEmail({
                        to_email: 'pagos.crockertheproducer@gmail.com',
                        to_name: 'Crocker',
                        product_name: 'X Flow - Analyzer',
                        downloader_name: (response.result.payer?.name?.given_name) || 'Comprador',
                        activity_type: 'Venta Confirmada',
                        amount: '$10.00'
                    });

                } catch (emailErr) {
                    console.error("[AnalyzerCapture] Async notify error:", emailErr);
                }
            })();

            return res.status(200).json({
                ...response.result,
                is_analyzer: true
            });
        }

        res.status(400).json({ error: 'Pago no completado', status: response.result.status });

    } catch (err) {
        console.error("[AnalyzerCapture] Capture Error:", err);
        res.status(500).json({ error: err.message });
    }
};
