import paypal from '@paypal/checkout-server-sdk';
import paypalClient from '../paypalClient.js';
import { supabase } from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';
 
// PayPal Recipient Credentials from environment
const EMAIL_CROCKER = process.env.CROCKER_PAYPAL_EMAIL || 'pagos.crockertheproducer@gmail.com';
const MERCHANT_ID_CROCKER = 'JZ28XQ5XLPFMA'; // Derived from Crocker's email
const MERCHANT_ID_WILLIE = process.env.PAYPAL_MERCHANT_ID_WILLIE || 'MXV5F6X8JXG4S';

/**
 * Creates a PayPal order for the X Flow - Analyzer with a hardcoded $10/$5 split.
 */
export const createAnalyzerOrder = async (req, res) => {
    try {
        const product_id = 'x-flow-analyzer';
        const price_total = 15.00;
        const amount_crocker = 10.00;
        const amount_willie = 5.00;


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
                    reference_id: `willie_split_${uuidv4().substring(0, 8)}`,
                    amount: {
                        currency_code: 'USD',
                        value: amount_willie.toFixed(2)
                    },
                    description: 'X Flow Analyzer - Part 1 (Platform)',
                    payee: { merchant_id: MERCHANT_ID_WILLIE }
                },
                {
                    reference_id: `crocker_split_${uuidv4().substring(0, 8)}`,
                    amount: {
                        currency_code: 'USD',
                        value: amount_crocker.toFixed(2)
                    },
                    description: 'X Flow Analyzer - Part 2 (Producer)',
                    payee: { email_address: EMAIL_CROCKER }
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
                        to: EMAIL_CROCKER,
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

/**
 * Records a free download for an authenticated user in the analyzer_sales table.
 */
export const createFreeAnalyzerOrder = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });

        const userEmail = req.user?.email || 'usuario@offszn.lat';

        // 1. Record Sale in Dedicated Table (Registration ONLY, no payment)
        const timestamp = Date.now();
        const { data, error: saleError } = await supabase
            .from('analyzer_sales')
            .insert([{
                paypal_order_id: `FREE-ANALYZER-${timestamp}-${userId.substring(0, 5)}`,
                user_id: userId,
                buyer_email: userEmail,
                amount: 0,
                status: 'completed'
            }])
            .select()
            .single();

        if (saleError) {
            console.error("[FreeAnalyzer] Error recording free sale:", saleError);
            return res.status(500).json({ error: 'Error al registrar descarga gratuita' });
        }

        // 2. Notify (Async) - Premium version for free download
        (async () => {
            try {
                // Fetch user data for personalization
                const { data: userData } = await supabase
                    .from('users')
                    .select('nickname')
                    .eq('id', userId)
                    .single();

                const userNickname = userData?.nickname || 'Usuario';

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
                                <div class="product-tag">🛠️ Software</div>
                                <h1>Descarga Procesada Correctamente</h1>
                                <p>Hola, ${userNickname}. Hemos procesado tu descarga de <strong>X Flow - Analyzer</strong> correctamente.</p>
                                <p>Ahora puedes encontrar este software siempre disponible en tu panel de usuario.</p>
                                
                                <a href="https://offszn.lat/mis-compras" class="button">Ver en mi panel</a>

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

                await sendOffsznEmail({
                    to: userEmail,
                    subject: `Procesamos tu descarga de X Flow - Analyzer`,
                    html: freeHtml,
                    fromName: 'OFFSZN'
                });
            } catch (e) {
                console.error("[FreeAnalyzerHub] Email error:", e);
            }
        })();

        res.status(200).json({ success: true, message: 'Descarga registrada correctamente' });

    } catch (err) {
        console.error("[FreeAnalyzer] Error:", err);
        res.status(500).json({ error: err.message });
    }
};
