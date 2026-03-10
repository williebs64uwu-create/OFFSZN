import { supabase } from '../../database/connection.js';

// Get My Favorites
export const getMyFavorites = async (req, res) => {
    try {
        const userId = req.user.userId;

        // 1. Get Liked Product IDs
        const { data: likes, error: likesError } = await supabase
            .from('likes')
            .select('target_id')
            .eq('user_id', userId)
            .eq('target_type', 'product');

        if (likesError) throw likesError;

        if (!likes || likes.length === 0) {
            return res.status(200).json([]);
        }

        const productIds = likes.map(l => l.target_id).filter(id => id != null && id !== undefined && id !== 'undefined');

        if (productIds.length === 0) {
            return res.status(200).json([]);
        }

        // 2. Fetch Products (simplified - no FK join to avoid schema errors)
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('*')
            .in('id', productIds);

        if (productsError) throw productsError;

        // 3. Fetch producer data separately
        const producerIds = [...new Set((products || []).map(p => p.producer_id).filter(Boolean))];
        let producerMap = {};

        if (producerIds.length > 0) {
            const { data: producers } = await supabase
                .from('users')
                .select('id, nickname, avatar_url, is_verified')
                .in('id', producerIds);

            if (producers) {
                producers.forEach(p => { producerMap[p.id] = p; });
            }
        }

        // 4. Merge producer data into products
        const enriched = (products || []).map(p => ({
            ...p,
            artist_users: producerMap[p.producer_id] || null
        }));

        res.status(200).json(enriched);

    } catch (err) {
        console.error("Error getMyFavorites:", err.message);
        res.status(500).json({ error: 'Error al obtener favoritos' });
    }
};

// Toggle Like (Like/Unlike)
export const toggleProductLike = async (req, res) => {
    try {
        const userId = req.user.userId;
        const productId = req.params.id;

        // Check if already liked
        const { data: existing, error: checkError } = await supabase
            .from('likes')
            .select('id')
            .eq('user_id', userId)
            .eq('target_id', productId)
            .eq('target_type', 'product')
            .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
            // UNLIKE
            const { error: deleteError } = await supabase
                .from('likes')
                .delete()
                .eq('id', existing.id);

            if (deleteError) throw deleteError;
            return res.status(200).json({ liked: false });
        } else {
            // LIKE
            const { error: insertError } = await supabase
                .from('likes')
                .insert({
                    user_id: userId,
                    target_id: productId,
                    target_type: 'product'
                });

            if (insertError) throw insertError;

            // --- SERVER-SIDE NOTIFICATION ---
            try {
                // 1. Get Product Owner
                const { data: product } = await supabase
                    .from('products')
                    .select('producer_id, name')
                    .eq('id', productId)
                    .single();

                if (product && product.producer_id) {
                    // 2. Get Liker Nickname
                    const { data: liker } = await supabase
                        .from('users')
                        .select('nickname')
                        .eq('id', userId)
                        .single();

                    const likerName = liker?.nickname || 'Alguien';

                    // 3. Create Notification
                    await supabase.from('notifications').insert({
                        user_id: product.producer_id,
                        type: 'product_like',
                        title: '¡Nuevo Me Gusta!',
                        message: `A <strong>${likerName}</strong> le gustó tu producto <strong>${product.name}</strong>.`,
                        data: { product_id: productId, liker_id: userId },
                        read: false
                    });
                }
            } catch (notifErr) {
                console.warn("FavoritesController: Failed to send notification", notifErr.message);
            }

            return res.status(200).json({ liked: true });
        }

    } catch (err) {
        console.error("Error toggleProductLike:", err.message);
        res.status(500).json({ error: 'Error al actualizar like' });
    }
};
