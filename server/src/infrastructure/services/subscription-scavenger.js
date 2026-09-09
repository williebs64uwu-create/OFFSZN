import { supabase } from '../database/connection.js';
import { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT } from '../../shared/config/config.js';

/**
 * Helper to check real-time subscription status directly from PayPal API
 */
async function checkPayPalSubscription(subscriptionId) {
    try {
        if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) return null;
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
        if (!tokenData.access_token) return null;

        const subRes = await fetch(`${baseUrl}/v1/billing/subscriptions/${subscriptionId}`, {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!subRes.ok) return null;
        return await subRes.json();
    } catch (err) {
        console.error(`[Scavenger] Error checking PayPal sub ${subscriptionId}:`, err.message);
        return null;
    }
}

/**
 * Subscription Scavenger
 * Detects expired subscriptions and downgrades users to free plan automatically.
 * Safe for production: verifies real status with PayPal before expiring active subscriptions.
 */
export async function runSubscriptionScavenger() {
    console.log(`[${new Date().toISOString()}] 🧹 Subscription Scavenger: Checking for expired plans...`);

    try {
        // 1. Find subscriptions that have passed their end date but are still marked as active or canceled
        const { data: expiredSubs, error } = await supabase
            .from('subscriptions')
            .select('id, user_id, plan_id, current_period_end, provider, provider_subscription_id')
            .in('status', ['active', 'canceled'])
            .lt('current_period_end', new Date().toISOString());

        if (error) {
            console.error("❌ Scavenger Error fetching expired subs:", error.message);
            return;
        }

        if (!expiredSubs || expiredSubs.length === 0) {
            console.log("✅ Scavenger: No expired subscriptions found.");
            return;
        }

        console.log(`📦 Scavenger: Found ${expiredSubs.length} candidates for expiration.`);

        for (const sub of expiredSubs) {
            // Check PayPal live status first to prevent false downgrades if renewed
            if (sub.provider === 'paypal' && sub.provider_subscription_id) {
                const liveSub = await checkPayPalSubscription(sub.provider_subscription_id);
                if (liveSub && liveSub.status === 'ACTIVE') {
                    const nextBilling = liveSub.billing_info?.next_billing_time;
                    if (nextBilling && new Date(nextBilling) > new Date()) {
                        console.log(`  - 🔄 [Scavenger] PayPal sub ${sub.provider_subscription_id} was renewed until ${nextBilling}! Updating DB instead of expiring.`);
                        await supabase
                            .from('subscriptions')
                            .update({
                                current_period_end: nextBilling,
                                status: 'active'
                            })
                            .eq('id', sub.id);
                        continue; // Keep user active, do not downgrade!
                    }
                }
            }

            // A. Mark subscription record as expired
            const { error: subUpdateError } = await supabase
                .from('subscriptions')
                .update({ status: 'expired' })
                .eq('id', sub.id);

            if (subUpdateError) {
                console.error(`  - Error updating sub status for user ${sub.user_id}:`, subUpdateError.message);
                continue;
            }

            // B. Downgrade user plan to free in users and profiles
            const { error: userUpdateError } = await supabase
                .from('users')
                .update({ plan: 'free' })
                .eq('id', sub.user_id);

            await supabase
                .from('profiles')
                .update({ plan: 'free' })
                .eq('id', sub.user_id);

            if (userUpdateError) {
                console.error(`  - Error downgrading user ${sub.user_id}:`, userUpdateError.message);
            } else {
                console.log(`  - ✅ User ${sub.user_id} plan downgraded to free (Expired: ${sub.current_period_end})`);
            }
        }

        console.log(`[${new Date().toISOString()}] ✨ Scavenger task completed.`);

    } catch (err) {
        console.error("🔴 Scavenger Critical Failure:", err.message);
    }
}
