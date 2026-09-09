import { supabase } from '../../database/connection.js';
import fetch from 'node-fetch'; // Requires node-fetch or native fetch in node 18+
import { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT } from '../../../shared/config/config.js';
import { syncUserStatsToEmailOctopus } from '../../services/email-octopus.service.js';

const PAYPAL_PLAN_PRICES = {
    starter: { 
        monthly: { credits: 150 },
        annual: { credits: 1800 }
    },
    pro: { 
        monthly: { credits: 300 },
        annual: { credits: 3600 }
    }
};

export const subscribePayPalRecurring = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { subscriptionID, plan = 'pro', interval = 'monthly' } = req.body;

        if (!subscriptionID) {
            return res.status(400).json({ error: 'Falta ID de suscripción de PayPal.' });
        }

        console.log(`[V2] Verifying PayPal Subscription ${subscriptionID} for user ${userId} (${plan} - ${interval})`);

        // 0. Idempotency Check: if this exact subscription was already saved
        const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('id, plan_id, status, current_period_end')
            .eq('provider_subscription_id', subscriptionID)
            .maybeSingle();

        if (existingSub) {
            console.log(`[V2] Subscription ${subscriptionID} already processed.`);
            return res.status(200).json({
                success: true,
                message: 'Suscripción ya activa.',
                next_billing: existingSub.current_period_end
            });
        }

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

        // 3. Asignar fecha del next_billing_time de PayPal
        let nextBilling = subData.billing_info?.next_billing_time;
        if (!nextBilling) {
            let daysToAdd = 30;
            if (interval === 'annual') {
                daysToAdd = 365;
            } else if (plan === 'pro') {
                daysToAdd = 7; // Trial
            }

            const d = new Date();
            d.setDate(d.getDate() + daysToAdd);
            nextBilling = d.toISOString();
        }

        // 4. Insertar en tabla subscriptions con las columnas correctas
        const { error: subError } = await supabase
            .from('subscriptions')
            .insert({
                user_id: userId,
                plan_id: `${plan}_${interval}`,
                status: 'active',
                provider: 'paypal',
                provider_subscription_id: subscriptionID,
                current_period_end: nextBilling
            });

        if (subError) {
            console.error('[V2] Database insert error:', subError);
            throw subError;
        }

        // 5. Actualizar plan en users
        await supabase
            .from('users')
            .update({ 
                plan: plan,
                plan_start_date: new Date().toISOString()
            })
            .eq('id', userId);

        // 6. Otorgar créditos correspondientes
        const creditsToGive = PAYPAL_PLAN_PRICES[plan]?.[interval]?.credits || (plan === 'pro' ? 300 : 150);
        const { data: profile } = await supabase
            .from('users')
            .select('reward_balance')
            .eq('id', userId)
            .single();

        const currentBalance = parseInt(profile?.reward_balance || 0, 10) || 0;
        await supabase
            .from('users')
            .update({ reward_balance: currentBalance + creditsToGive })
            .eq('id', userId);

        // 7. Sincronizar EmailOctopus en segundo plano
        syncUserStatsToEmailOctopus(userId).catch(err => console.error('[EmailOctopus] V2 Sync failed:', err));

        console.log(`✅ [V2] PayPal Subscription ${subscriptionID} successfully activated for user ${userId} (${plan} - ${interval}). Credits added: ${creditsToGive}`);

        return res.status(200).json({
            success: true,
            message: 'Suscripción recurrente (V2) activada con éxito.',
            next_billing: nextBilling,
            credits: creditsToGive
        });

    } catch (error) {
        console.error("❌ Error en subscribePayPalRecurring V2:", error);
        res.status(500).json({ error: 'Error interno verificando la suscripción recurrente.', details: error.message });
    }
};