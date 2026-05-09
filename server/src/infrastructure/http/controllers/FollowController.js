import { supabase } from '../../database/connection.js';
import { syncUserStatsToEmailOctopus } from '../../services/email-octopus.service.js';

export const followUser = async (req, res) => {
    try {
        const { id: targetId } = req.params;
        const followerId = req.user.userId;

        if (!followerId) return res.status(401).json({ error: "Usuario no identificado" });

        if (targetId === followerId) {
            return res.status(400).json({ error: "No te puedes seguir a ti mismo" });
        }

        console.log(`👤 Follow: ${followerId} -> ${targetId}`);

        const { error } = await supabase
            .from('followers')
            .insert({
                user_id: targetId,
                follower_id: followerId
            });

        // Create Notification
        const { data: followerData } = await supabase
            .from('users')
            .select('nickname')
            .eq('id', followerId)
            .single();

        const followerName = followerData?.nickname || 'Alguien';
        const notifMessage = `<strong>${followerName}</strong> te empezó a seguir.`;

        // Check for existing unread dupes
        const { data: existingNotifs } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', targetId)
            .eq('type', 'new_follower')
            .eq('message', notifMessage)
            .eq('read', false)
            .limit(1);

        if (!existingNotifs || existingNotifs.length === 0) {
            await supabase.from('notifications').insert({
                user_id: targetId,
                type: 'new_follower',
                title: '¡Nuevo Seguidor!',
                message: notifMessage,
                read: false,
                created_at: new Date()
            });
        }

        if (error) {
            // Validate unique constraint (already following)
            if (error.code === '23505') {
                return res.status(200).json({ message: 'Ya sigues a este usuario' });
            }
            throw error;
        }

        // Fetch updated count
        const { count } = await supabase
            .from('followers')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', targetId);

        res.status(200).json({ message: 'Seguido correctamente', followersCount: count });

        // 🔄 SYNC TO EMAILOCTOPUS (Background)
        syncUserStatsToEmailOctopus(targetId).catch(err => console.error('[EmailOctopus] Follow sync failed:', err));

    } catch (error) {
        console.error("Error following user:", error);
        res.status(500).json({ error: error.message });
    }
};

export const unfollowUser = async (req, res) => {
    try {
        const { id: targetId } = req.params;
        const followerId = req.user.userId;

        console.log(`👤 Unfollow: ${followerId} -> ${targetId}`);

        const { error } = await supabase
            .from('followers')
            .delete()
            .match({
                user_id: targetId,
                follower_id: followerId
            });

        if (error) throw error;

        // Clean up unread notifications from this unfollow
        try {
            const { data: followerData } = await supabase
                .from('users')
                .select('nickname')
                .eq('id', followerId)
                .single();

            const followerName = followerData?.nickname || 'Alguien';
            const notifMessage = `<strong>${followerName}</strong> te empezó a seguir.`;

            await supabase
                .from('notifications')
                .delete()
                .eq('user_id', targetId)
                .eq('type', 'new_follower')
                .eq('message', notifMessage)
                .eq('read', false);
        } catch (e) {
            console.warn("Error cleaning up notification:", e);
        }

        // Fetch updated count
        const { count } = await supabase
            .from('followers')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', targetId);

        res.status(200).json({ message: 'Dejado de seguir', followersCount: count });

        // 🔄 SYNC TO EMAILOCTOPUS (Background)
        syncUserStatsToEmailOctopus(targetId).catch(err => console.error('[EmailOctopus] Unfollow sync failed:', err));

    } catch (error) {
        console.error("Error unfollowing user:", error);
        res.status(500).json({ error: error.message });
    }
};

export const getMyFollowing = async (req, res) => {
    try {
        const followerId = req.user.userId;
        if (!followerId) return res.status(200).json([]);

        const { data, error } = await supabase
            .from('followers')
            .select('user_id')
            .eq('follower_id', followerId);

        if (error) throw error;

        const ids = data.map(r => r.user_id);
        res.status(200).json(ids);

    } catch (error) {
        console.error("Error fetching following:", error);
        res.status(500).json([]);
    }
};

export const checkFollowStatus = async (req, res) => {
    try {
        const { id: targetId } = req.params;
        const followerId = req.user.userId; // Fixed from req.user.id


        const { data, error } = await supabase
            .from('followers')
            .select('id')
            .match({
                user_id: targetId,
                follower_id: followerId
            })
            .single();

        // PGRST116 = 0 rows (Not following)
        const isFollowing = !!data && !error;

        res.status(200).json({ isFollowing });

    } catch (error) {
        // If not found, it's just false, not a 500 error usually
        res.status(200).json({ isFollowing: false });
    }
};
