import { supabase } from '../../database/connection.js';
import fetch from 'node-fetch'; // Requires node-fetch or native fetch in node 18+
import { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT } from '../../../shared/config/config.js';

export const subscribePayPalRecurring = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { subscriptionID, plan, interval } = req.body;

        if (!subscriptionID) {
            return res.status(400).json({ error: 'Falta ID de suscripción de PayPal.' });
        }

        console.log(`[V2] Verifying PayPal Subscription ${subscriptionID} for user ${userId}`);

        // 1. Obtener Access Token de PayPal
        const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
        const baseUrl = PAYPAL_ENVIRONMENT === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
        
        const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });
        
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            throw new Error("Failed to authenticate with PayPal API");
        }

        // 2. Obtener detalles de la suscripción
        const subRes = await fetch(`${baseUrl}/v1/billing/subscriptions/${subscriptionID}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const subData = await subRes.json();

        if (subData.status !== 'ACTIVE' && subData.status !== 'APPROVAL_PENDING') {
            return res.status(400).json({ error: 'La suscripción no está activa ni pendiente de aprobación.', paypal_status: subData.status });
        }

        // 3. Lógica de Supabase: Asignar plan y fecha
        // Como es recurrente, vamos a añadir el tiempo.
        // Si es PRO, PayPal nos dio un trial de 7 días. Si es Starter, un ciclo normal.
        // Asignaremos la fecha del "next_billing_time" que nos da PayPal si existe.
        
        let nextBilling = subData.billing_info?.next_billing_time;
        if (!nextBilling) {
            // Fallback si paypal no lo envió
            let daysToAdd = 30; // Default mensual
            if (interval === 'annual') {
                daysToAdd = 365;
            } else if (plan === 'pro') {
                daysToAdd = 7; // Trial
            }
            
            const d = new Date();
            d.setDate(d.getDate() + daysToAdd);
            nextBilling = d.toISOString();
        }

        const { error: subError } = await supabase
            .from('subscriptions')
            .upsert({
                user_id: userId,
                plan_id: plan,
                status: 'active',
                current_period_end: nextBilling,
                paypal_subscription_id: subscriptionID
            }, { onConflict: 'user_id' });

        if (subError) throw subError;

        // Actualizar tabla users
        await supabase
            .from('users')
            .update({ plan: plan })
            .eq('id', userId);

        return res.status(200).json({ 
            success: true, 
            message: 'Suscripción recurrente (V2) activada con éxito.',
            next_billing: nextBilling
        });

    } catch (error) {
        console.error("❌ Error en subscribePayPalRecurring V2:", error);
        res.status(500).json({ error: 'Error interno verificando la suscripción recurrente.' });
    }
};
