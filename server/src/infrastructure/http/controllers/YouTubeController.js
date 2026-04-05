/**
 * YouTubeController.js
 * Handles YouTube+OFFSZN upload quota enforcement.
 * 
 * SECURITY: All quota increments happen server-side only.
 * The client calls this endpoint AFTER a successful YouTube upload.
 * The trigger on profiles protects these columns from client-side tampering.
 */

import { supabase } from '../../database/connection.js';

// 🔥 Plan limits (must match auth-utils.js PLAN_LIMITS)
const YT_PLAN_LIMITS = {
    free: 3,
    starter: 10,
    pro: 30
};

/**
 * POST /api/youtube/increment-upload
 * Increments the user's monthly YouTube+OFFSZN upload counter.
 * Enforces plan-based limits and handles monthly reset.
 */
export const incrementYoutubeUpload = async (req, res) => {
    try {
        const userId = req.user.userId;

        // 1. Get user's plan and current quota
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('plan, youtube_uploads_this_month, youtube_quota_reset_date')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'Perfil no encontrado' });
        }

        const userPlan = profile.plan || 'free';
        const maxLimit = YT_PLAN_LIMITS[userPlan] || YT_PLAN_LIMITS.free;
        let currentCount = profile.youtube_uploads_this_month || 0;
        const resetDate = profile.youtube_quota_reset_date ? new Date(profile.youtube_quota_reset_date) : null;

        // 2. Monthly Reset: if reset date has passed, reset counter
        const now = new Date();
        let needsReset = false;

        if (!resetDate || now > resetDate) {
            currentCount = 0;
            needsReset = true;
        }

        // 3. Enforce limit
        if (currentCount >= maxLimit) {
            return res.status(403).json({
                error: `Has alcanzado el límite de ${maxLimit} subidas YouTube+OFFSZN para tu plan "${userPlan}" este mes.`,
                used: currentCount,
                limit: maxLimit,
                remaining: 0,
                resetDate: resetDate?.toISOString()
            });
        }

        // 4. Increment counter + set next reset date (30 days from now if resetting)
        const newCount = currentCount + 1;
        const updateData = {
            youtube_uploads_this_month: newCount,
            youtube_import_done: true // Legacy compat
        };

        if (needsReset) {
            // Set next reset to 30 days from now
            const nextReset = new Date();
            nextReset.setDate(nextReset.getDate() + 30);
            updateData.youtube_quota_reset_date = nextReset.toISOString();
        }

        const { error: updateError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

        if (updateError) throw updateError;

        const remaining = maxLimit - newCount;

        res.status(200).json({
            message: 'YouTube upload contado exitosamente',
            used: newCount,
            limit: maxLimit,
            remaining: remaining,
            plan: userPlan
        });

    } catch (err) {
        console.error("Error in incrementYoutubeUpload:", err.message);
        res.status(500).json({ error: 'Error al contar la subida de YouTube' });
    }
};

/**
 * GET /api/youtube/quota
 * Returns the user's current YouTube+OFFSZN upload quota status.
 */
export const getYoutubeQuota = async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('plan, youtube_uploads_this_month, youtube_quota_reset_date')
            .eq('id', userId)
            .single();

        if (error || !profile) {
            return res.status(404).json({ error: 'Perfil no encontrado' });
        }

        const userPlan = profile.plan || 'free';
        const maxLimit = YT_PLAN_LIMITS[userPlan] || YT_PLAN_LIMITS.free;
        let currentCount = profile.youtube_uploads_this_month || 0;
        const resetDate = profile.youtube_quota_reset_date ? new Date(profile.youtube_quota_reset_date) : null;

        // Check if reset is needed
        if (resetDate && new Date() > resetDate) {
            currentCount = 0;
        }

        res.status(200).json({
            used: currentCount,
            limit: maxLimit,
            remaining: Math.max(0, maxLimit - currentCount),
            plan: userPlan,
            resetDate: resetDate?.toISOString()
        });

    } catch (err) {
        console.error("Error in getYoutubeQuota:", err.message);
        res.status(500).json({ error: 'Error al obtener cuota de YouTube' });
    }
};
