import { supabase } from '../../database/connection.js';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import paypal from '@paypal/checkout-server-sdk';
import paypalClient from '../paypalClient.js';
import { PLATFORM_PAYPAL_EMAIL } from '../../../shared/config/config.js';

export const getPublicKey = async (req, res) => {
    return res.json({ publicKey: process.env.MERCADOPAGO_PUBLIC_KEY });
};

export const createSubscriptionPreference = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { plan } = req.body;

        if (!plan || (plan !== 'starter' && plan !== 'pro')) {
            return res.status(400).json({ error: 'Plan inválido. Debe ser starter o pro.' });
        }

        // Definir precios basados en nuestra lógica
        // MP requiere montos exactos, asumiremos USD o PEN dependiendo de la lógica de negocio.
        // Como vimos en la página de precios, Starter es $5 o S/19, y Pro $7 o S/25.
        // Dado el screenshot del checkout, cobramos en Soles usando Mercado Pago Perú.

        let unitPricePen = 0;
        let planTitle = '';

        if (plan === 'starter') {
            unitPricePen = 19.00;
            planTitle = 'OFFSZN Starter Plan (1 Mes)';
        } else if (plan === 'pro') {
            unitPricePen = 25.00;
            planTitle = 'OFFSZN PRO Plan (1 Mes)';
        }

        const externalRef = JSON.stringify({
            u_id: userId,
            plan_type: plan,
            ts: Date.now()
        });

        // Detectar base URL
        let clientURL = req.headers.origin || req.headers.referer;
        // clientURL detectado internamente
        if (!clientURL || clientURL.includes('localhost') || clientURL.includes('127.0.0.1')) {
            clientURL = "https://offszn.lat"; // FORCE a valid HTTPS URL for testing MP validation
            // Override a HTTPS para produccción
        }
        if (clientURL.endsWith('/')) clientURL = clientURL.slice(0, -1);

        const preferenceBody = {
            items: [
                {
                    id: `plan_${plan}`,
                    title: planTitle,
                    quantity: 1,
                    currency_id: 'PEN',
                    unit_price: unitPricePen
                }
            ],
            back_urls: {
                success: `${clientURL}/cuenta/planes.html?upgrade=success&plan=${plan}`,
                failure: `${clientURL}/cuenta/checkout.html?plan=${plan}&error=payment_failed`,
                pending: `${clientURL}/cuenta/checkout.html?plan=${plan}&status=pending`
            },
            auto_return: "approved",
            external_reference: externalRef,
            statement_descriptor: "OFFSZN SUB",
            payment_methods: {
                excluded_payment_methods: [],
                excluded_payment_types: [],
                installments: 1
            }
        };

        // Inicializar SDK de Mercado Pago
        const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!token) {
            console.error("🔥 [CRITICAL] NO TOKEN FOUND IN SUBSCRIPTION CONTROLLER");
            return res.status(500).json({ error: 'Falta configuración del servidor de pagos.' });
        }

        const client = new MercadoPagoConfig({ accessToken: token });
        const preference = new Preference(client);

        // Preference body construido (no loggear por seguridad)

        // Crear preferencia
        const result = await preference.create({ body: preferenceBody });
        console.log("📦 MP Preference Creada para Subscripción:", result.id);

        res.status(200).json({ url: result.init_point, preferenceId: result.id });

    } catch (err) {
        console.error("❌ Error MP Subscription Preference:", err);
        res.status(500).json({
            error: 'Error interno conectando con Mercado Pago.',
            details: err.message
        });
    }
};

export const processSubscriptionPayment = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { plan, formData } = req.body;

        if (!plan || (plan !== 'starter' && plan !== 'pro')) {
            return res.status(400).json({ error: 'Plan inválido.' });
        }

        let planTitle = '';
        if (plan === 'starter') {
            planTitle = 'OFFSZN Starter Plan (1 Mes)';
        } else if (plan === 'pro') {
            planTitle = 'OFFSZN PRO Plan (1 Mes)';
        }

        const externalRef = JSON.stringify({
            u_id: userId,
            plan_type: plan,
            ts: Date.now()
        });

        const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!token) {
            console.error("🔥 [CRITICAL] NO TOKEN FOUND IN SUBSCRIPTION CONTROLLER");
            return res.status(500).json({ error: 'Falta configuración del servidor de pagos.' });
        }

        const client = new MercadoPagoConfig({ accessToken: token });

        // Use Payment instead of Preference
        // Note: we need to import Payment at the top.
        const PaymentAPI = (await import('mercadopago')).Payment;
        const payment = new PaymentAPI(client);

        const paymentBody = {
            transaction_amount: formData.transaction_amount,
            token: formData.token,
            description: planTitle,
            installments: formData.installments,
            payment_method_id: formData.payment_method_id,
            issuer_id: formData.issuer_id,
            payer: {
                email: formData.payer?.email || 'no-reply@offszn.lat', // Safe fallback if MP doesn't provide email
                ...(formData.payer?.identification && { identification: formData.payer.identification })
            },
            external_reference: externalRef
        };

        const result = await payment.create({ body: paymentBody });
        console.log("💳 MP Payment Create Result:", result.id, result.status);

        // If the payment is immediately approved (e.g. Yape or sufficient funds)
        if (result.status === 'approved') {
            await processSubscriptionAudit(result.id);
        }

        res.status(200).json({
            status: result.status,
            status_detail: result.status_detail,
            id: result.id
        });

    } catch (err) {
        console.error("❌ Error MP Payment Create:", err);
        res.status(500).json({ error: 'Error procesando el pago interno.', details: err.message });
    }
};

// Webhook handling for subscriptions
export const handleSubscriptionWebhook = async (req, res) => {
    const id = req.query.id || req.query['data.id'];
    const topic = req.query.topic || req.query.type;

    console.log(`🔔 [SUB Webhook IN] Topic: ${topic} | ID: ${id}`);

    if (topic === 'payment') {
        res.status(200).send('OK');
        processSubscriptionAudit(id);
    } else {
        res.status(200).send('OK');
    }
};

const processSubscriptionAudit = async (paymentId) => {
    try {
        const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
        const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();

            if (data.status === 'approved') {
                const metadata = JSON.parse(data.external_reference);
                const userId = metadata.u_id;
                const newPlan = metadata.plan_type; // 'starter' o 'pro'

                console.log(`✅ [SUB SUCCESS] Aprobado! Usuario ${userId} sube a ${newPlan}`);

                // Guardar la subscripción
                await supabase.from('subscriptions').insert({
                    user_id: userId,
                    plan_id: newPlan + '_monthly',
                    status: 'active',
                    provider: 'mercadopago',
                    provider_subscription_id: data.id.toString(),
                    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                });

                // Actualizar profile (rol)
                await supabase.from('profiles').update({ plan: newPlan }).eq('id', userId);

                // Dar los créditos iniciales
                const creditsMap = { 'starter': 60, 'pro': 100 };
                const creditsToGive = creditsMap[newPlan];

                // Asumiendo que existe una columna 'reward_balance' según task.md
                // O se inserta un registro de transaccion de tarjeta/crédito
                const { data: profile } = await supabase.from('profiles').select('reward_balance').eq('id', userId).single();
                const currentBalance = profile?.reward_balance || 0;
                await supabase.from('profiles').update({ reward_balance: currentBalance + creditsToGive }).eq('id', userId);

                console.log(`✅ [SUB SUCCESS] Plan actualizado y ${creditsToGive} créditos otorgados.`);
            }
        }
    } catch (e) {
        console.error(`🔴 [SUB Webhook Error]:`, e);
    }
};

// ==========================================
// PAYPAL SUBSCRIPTION FLOW (USD)
// ==========================================

const PAYPAL_PLAN_PRICES = {
    starter: { 
        monthly: { amount: '5.00', title: 'OFFSZN Starter Plan (1 Month)', durationDays: 30, credits: 60 },
        annual: { amount: '20.00', title: 'OFFSZN Starter Plan (1 Year)', durationDays: 365, credits: 720 }
    },
    pro: { 
        monthly: { amount: '7.00', title: 'OFFSZN PRO Plan (1 Month)', durationDays: 30, credits: 100 },
        annual: { amount: '30.00', title: 'OFFSZN PRO Plan (1 Year)', durationDays: 365, credits: 1200 }
    }
};

export const createPayPalSubscriptionOrder = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { plan, interval = 'monthly' } = req.body;

        if (!plan || !PAYPAL_PLAN_PRICES[plan] || !PAYPAL_PLAN_PRICES[plan][interval]) {
            return res.status(400).json({ error: 'Plan o intervalo inválido.' });
        }

        const planData = PAYPAL_PLAN_PRICES[plan][interval];

        // Payee = platform email from .env (NEVER from frontend)
        const platformPayee = PLATFORM_PAYPAL_EMAIL && PLATFORM_PAYPAL_EMAIL.includes('@')
            ? { email_address: PLATFORM_PAYPAL_EMAIL }
            : { merchant_id: 'MXV5F6X8JXG4S' }; // fallback merchant ID

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
            intent: 'CAPTURE',
            application_context: {
                shipping_preference: 'NO_SHIPPING',
                brand_name: 'OFFSZN',
                user_action: 'PAY_NOW'
            },
            purchase_units: [{
                reference_id: `offszn_sub_${plan}_${userId}`,
                amount: {
                    currency_code: 'USD',
                    value: planData.amount
                },
                description: planData.title,
                payee: platformPayee
            }]
        });

        const response = await paypalClient.client().execute(request);
        console.log(`[PayPal Sub] Order created: ${response.result.id} for ${plan} ($${planData.amount}) - User: ${userId}`);

        res.status(200).json({ id: response.result.id });

    } catch (err) {
        console.error('❌ [PayPal Sub] Create Order Error:', err);
        res.status(500).json({ error: 'Error creating PayPal subscription order.', details: err.message });
    }
};

export const capturePayPalSubscriptionOrder = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { orderID, plan, interval = 'monthly' } = req.body;

        if (!orderID) return res.status(400).json({ error: 'orderID es requerido.' });
        if (!plan || !PAYPAL_PLAN_PRICES[plan] || !PAYPAL_PLAN_PRICES[plan][interval]) return res.status(400).json({ error: 'Plan o intervalo inválido.' });

        // 0. IDEMPOTENCY CHECK: Check if this order was already processed
        // This prevents duplicate records if the frontend retries or if PayPal's transient 500 happened AFTER success.
        const { data: existingSub, error: checkError } = await supabase
            .from('subscriptions')
            .select('id, plan_id')
            .eq('provider_subscription_id', orderID)
            .maybeSingle();

        if (checkError) {
            console.error('[PayPal Sub] Error checking idempotency:', checkError);
        }

        if (existingSub) {
            console.log(`[PayPal Sub] Order ${orderID} already processed. Returning success to client.`);
            return res.status(200).json({
                status: 'approved',
                plan: plan,
                message: 'Subscription already active'
            });
        }

        // 1. Capture the payment
        const captureReq = new paypal.orders.OrdersCaptureRequest(orderID);
        captureReq.requestBody({});

        let response;
        try {
            response = await paypalClient.client().execute(captureReq);
            console.log(`[PayPal Sub] Capture response: ${response.result.status} for order ${orderID}`);
        } catch (captureErr) {
            // Detailed Logging for 500/Internal Server Errors from PayPal
            console.error('❌ [PayPal Sub] PayPal API Capture Error:');
            if (captureErr.message) {
                try {
                    const parsedError = JSON.parse(captureErr.message);
                    console.error('Full PayPal Error:', JSON.stringify(parsedError, null, 2));
                } catch (e) {
                    console.error('Error Message:', captureErr.message);
                }
            }
            if (captureErr.statusCode) console.error('Status Code:', captureErr.statusCode);
            
            // Re-throw to be caught by the outer catch block
            throw captureErr;
        }

        if (response.result.status !== 'COMPLETED') {
            return res.status(400).json({
                error: 'El pago no fue completado.',
                status: response.result.status
            });
        }

        // 2. Verify the captured amount matches the plan price (ANTI-TAMPER)
        const capturedAmount = response.result.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
        const planData = PAYPAL_PLAN_PRICES[plan][interval];
        const expectedAmount = planData.amount;

        if (!capturedAmount || capturedAmount.value !== expectedAmount || capturedAmount.currency_code !== 'USD') {
            console.error(`[PayPal Sub] AMOUNT MISMATCH! Expected $${expectedAmount} USD, got $${capturedAmount?.value} ${capturedAmount?.currency_code}`);
            return res.status(400).json({ error: 'Error de verificación de monto.' });
        }

        console.log(`✅ [PayPal Sub] Payment verified: $${capturedAmount.value} USD for ${plan} (${interval}). Upgrading user ${userId}...`);

        // 3. Upgrade user plan
        const { error: insertError } = await supabase.from('subscriptions').insert({
            user_id: userId,
            plan_id: `${plan}_${interval}`,
            status: 'active',
            provider: 'paypal',
            provider_subscription_id: orderID,
            current_period_end: new Date(Date.now() + planData.durationDays * 24 * 60 * 60 * 1000).toISOString()
        });

        if (insertError) {
            // If we hit a unique constraint here, it means another process just finished it
            if (insertError.code === '23505') {
                 console.log(`[PayPal Sub] Race condition: Order ${orderID} handled by parallel request.`);
                 return res.status(200).json({ status: 'approved', plan: plan });
            }
            throw insertError;
        }

        await supabase.from('profiles').update({ plan: plan }).eq('id', userId);

        // 4. Give credits
        const creditsToGive = planData.credits;
        const { data: profile } = await supabase.from('profiles').select('reward_balance').eq('id', userId).single();
        const currentBalance = profile?.reward_balance || 0;
        await supabase.from('profiles').update({ reward_balance: currentBalance + creditsToGive }).eq('id', userId);

        console.log(`✅ [PayPal Sub] Plan upgraded to ${plan} (${interval}), ${creditsToGive} credits given.`);

        res.status(200).json({
            status: 'approved',
            plan: plan,
            credits: creditsToGive
        });

    } catch (err) {
        console.error('❌ [PayPal Sub] General Exception during Capture:', err.message);
        res.status(500).json({ error: 'Error capturing PayPal subscription payment.', details: err.message });
    }
};

export const subscribePayPalSubscription = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { subscriptionID, plan, interval } = req.body;

        if (!subscriptionID) return res.status(400).json({ error: 'subscriptionID es requerido.' });
        if (!plan || !PAYPAL_PLAN_PRICES[plan] || !PAYPAL_PLAN_PRICES[plan][interval]) return res.status(400).json({ error: 'Plan o intervalo inválido.' });
        if (interval !== 'annual') return res.status(400).json({ error: 'Solo se soporta billing anual via suscripciones.' });

        console.log(`✅ [PayPal Sub] Subscription Created: ${subscriptionID} for ${plan}. Upgrading user ${userId}...`);

        const planData = PAYPAL_PLAN_PRICES[plan][interval];

        // Upgrade user plan
        await supabase.from('subscriptions').insert({
            user_id: userId,
            plan_id: `${plan}_${interval}`,
            status: 'active',
            provider: 'paypal',
            provider_subscription_id: subscriptionID,
            current_period_end: new Date(Date.now() + planData.durationDays * 24 * 60 * 60 * 1000).toISOString()
        });

        await supabase.from('profiles').update({ plan: plan }).eq('id', userId);

        // Give credits
        const creditsToGive = planData.credits;
        const { data: profile } = await supabase.from('profiles').select('reward_balance').eq('id', userId).single();
        const currentBalance = profile?.reward_balance || 0;
        await supabase.from('profiles').update({ reward_balance: currentBalance + creditsToGive }).eq('id', userId);

        console.log(`✅ [PayPal Sub] Plan upgraded to ${plan} (${interval}), ${creditsToGive} credits given.`);

        res.status(200).json({
            status: 'approved',
            plan: plan,
            credits: creditsToGive
        });

    } catch (err) {
        console.error('❌ [PayPal Sub] Subscribe Error:', err);
        res.status(500).json({ error: 'Error procesando suscripción PayPal.', details: err.message });
    }
};
