import { supabase } from '../database/connection.js';

/**
 * Subscription Scavenger
 * Detects expired subscriptions and downgrades users to free plan automatically.
 * Safe for production: only touches expired active/canceled subscriptions.
 */
export async function runSubscriptionScavenger() {
    console.log(`[${new Date().toISOString()}] 🧹 Subscription Scavenger: Checking for expired plans...`);

    try {
        // 1. Find subscriptions that have passed their end date but are still marked as active or canceled
        const { data: expiredSubs, error } = await supabase
            .from('subscriptions')
            .select('id, user_id, plan_id, current_period_end')
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

        console.log(`📦 Scavenger: Found ${expiredSubs.length} expired subscriptions.`);

        for (const sub of expiredSubs) {
            // A. Mark subscription record as expired
            const { error: subUpdateError } = await supabase
                .from('subscriptions')
                .update({ status: 'expired' })
                .eq('id', sub.id);

            if (subUpdateError) {
                console.error(`  - Error updating sub status for user ${sub.user_id}:`, subUpdateError.message);
                continue;
            }

            // B. Downgrade user plan to free
            const { error: userUpdateError } = await supabase
                .from('users')
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
