/**
 * YouTubeSyncController.js
 * Handles the logic for the YouTube Pro Sync (Beta) functionality.
 * This is kept entirely separate from standard YouTube upload/quota logic
 * to ensure legacy operations are not affected.
 */

import { supabase } from '../../database/connection.js';

const PLAN_LIMITS = {
    free: { max_uploads: 30 },
    starter: { max_uploads: 60 },
    pro: { max_uploads: Infinity }
};

/**
 * GET /api/youtube-sync/quota
 * Returns the quota based on TOTAL ACTIVE PRODUCTS vs plan limit.
 */
export const getQuota = async (req, res) => {
    try {
        const userId = req.user.userId;

        // 1. Get user plan from users table
        const { data: profile, error: planError } = await supabase
            .from('users')
            .select('plan')
            .eq('id', userId)
            .single();

        if (planError && planError.code !== 'PGRST116') {
            console.warn("Error fetching plan:", planError);
        }

        const userPlan = (profile?.plan || 'free').toLowerCase();
        const limit = PLAN_LIMITS[userPlan]?.max_uploads || 30;

        // 2. Count active products
        const { count, error } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('producer_id', userId)
            .neq('status', 'deleted');

        if (error) throw error;

        res.status(200).json({
            success: true,
            used: count || 0,
            limit: limit === Infinity ? 'Ilimitado' : limit,
            plan: userPlan
        });

    } catch (error) {
        console.error("Error in getQuota:", error);
        res.status(500).json({ error: 'Error al obtener la cuota del catálogo' });
    }
};

/**
 * GET /api/youtube-sync/scan
 * Scans the user's YouTube channel for videos missing purchase links.
 * Currently returns mock data for the UI while Google Auth is being implemented.
 */
export const scanChannel = async (req, res) => {
    try {
        const userId = req.user.userId;

        // In a real implementation, we would:
        // 1. Fetch user's Google OAuth refresh_token from database.
        // 2. Call Google API `youtube.search.list` for the user's channel.
        // 3. Filter videos whose descriptions do not contain offszn.com links.

        // MOCK DATA using REAL USER PRODUCTS to make the demo realistic
        // We fetch 3 of their actual products to simulate found videos.
        const { data: realProducts, error } = await supabase
            .from('products')
            .select('id, name, image_url, storage_version')
            .eq('producer_id', userId)
            .order('created_at', { ascending: false })
            .limit(3);

        const videos = [];
        if (realProducts && realProducts.length > 0) {
            realProducts.forEach((p, index) => {
                // If it's an R2 URL, we'd normally get the signed URL, but here we can just pass the raw one
                // The frontend will handle AuthUtils if needed, but since it's an img tag, we should ideally sign it.
                // For simplicity in the mock, we pass the raw URL and let the frontend sign it if needed.
                videos.push({
                    id: `mock-video-${p.id}`,
                    title: p.name,
                    thumbnail: p.image_url || "",
                    status: "pending_sync",
                    storage_version: p.storage_version,
                    product_id: p.id
                });
            });
        } else {
            // Fallback if they have no products at all
            videos.push({
                id: "dQw4w9WgXcQ",
                title: "Lil Uzi Vert Type Beat 2024",
                thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
                status: "pending_sync"
            });
        }

        res.status(200).json({
            success: true,
            videos: videos,
            message: "Canal escaneado exitosamente."
        });

    } catch (error) {
        console.error("Error in scanChannel:", error);
        res.status(500).json({ error: 'Error al escanear el canal de YouTube' });
    }
};

/**
 * POST /api/youtube-sync/link-beat
 * Associates an OFFSZN product with a YouTube video.
 * Body requires: { videoId: 'string', productId: number }
 */
export const linkBeat = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { videoId, productId } = req.body;

        if (!videoId || !productId) {
            return res.status(400).json({ error: 'Faltan datos de vinculación (videoId, productId)' });
        }

        // Verify product belongs to user
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name')
            .eq('id', productId)
            .eq('producer_id', userId)
            .single();

        if (productError || !product) {
            return res.status(404).json({ error: 'Producto no encontrado o no te pertenece' });
        }

        // In a real implementation, we would:
        // 1. Call Google API `youtube.videos.update`
        // 2. Inject the `offszn.com/@producer/beat` link into the top of the description.
        // 3. Update the title with [SOLD OUT] if the beat was sold out.
        
        // MOCK PERSISTENCE: We just return success for the UI simulation
        res.status(200).json({
            success: true,
            message: `Video vinculado exitosamente al beat "${product.name}"`
        });

    } catch (error) {
        console.error("Error in linkBeat:", error);
        res.status(500).json({ error: 'Error al vincular el beat con el video' });
    }
};
