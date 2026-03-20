import paypal from '@paypal/checkout-server-sdk';
import paypalClient from '../paypalClient.js';
import { supabase } from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';

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
                    const userNickname = (response.result.payer?.name?.given_name) || 'Comprador';
                    const buyerHtml = `
                        <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px;">
                            <h2 style="color: #10B981; margin-bottom:20px;">¡Gracias por tu compra!</h2>
                            <p style="color:#ccc; line-height:1.6;">Hola <b>${userNickname}</b>, procesamos correctamente el pago por <b style="color:#fff;">X Flow - Analyzer</b>.</p>
                            <p style="color:#888; line-height:1.5;">Puedes encontrar y descargar todos tus archivos desde la sección "Mis Transacciones" en tu cuenta.</p>
                            <a href="https://offszn.lat/cuenta/transacciones" style="display:inline-block; background:#10B981; color:#fff; padding:14px 30px; border-radius:10px; text-decoration:none; font-weight:700; margin-top:15px;">VER MIS DESCARGAS</a>
                            <hr style="border:0; border-top:1px solid #222; margin:25px 0;">
                            <p style="font-size:0.75rem; color:#555;">Este es un recibo automático de OFFSZN.</p>
                        </div>
                    `;
                    await sendOffsznEmail({
                        to: payerEmail,
                        subject: `✅ Confirmación de Compra - X Flow Analyzer`,
                        html: buyerHtml,
                        fromName: 'OFFSZN'
                    });

                    // Notify Crocker
                    const crockerHtml = `
                        <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px;">
                            <h2 style="color: #8B5CF6; margin-bottom:20px;">¡Nueva Venta Realizada! 💰</h2>
                            <p style="color:#ccc; line-height:1.6;">Hola <b>Crocker</b>, el usuario <b>${userNickname}</b> ha comprado tu producto <b style="color:#fff;">X Flow - Analyzer</b>.</p>
                            <div style="background:#111; border:1px solid #333; border-radius:10px; padding:20px; margin:20px 0;">
                                <p style="color:#888; margin:0;"><b style="color:#fff;">Tu parte:</b> $10.00 USD</p>
                            </div>
                            <hr style="border:0; border-top:1px solid #222; margin:25px 0;">
                            <p style="font-size:0.75rem; color:#555;">¡Sigue así! OFFSZN.</p>
                        </div>
                    `;
                    await sendOffsznEmail({
                        to: 'pagos.crockertheproducer@gmail.com',
                        subject: `💸 ¡Venta Confirmada! Alguien compró X Flow - Analyzer`,
                        html: crockerHtml,
                        fromName: 'OFFSZN Notificaciones'
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
