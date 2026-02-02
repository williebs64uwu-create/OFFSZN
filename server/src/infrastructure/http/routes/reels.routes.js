import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';

const router = express.Router();

// Initialize Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// GET / - Fetch user's reels (Private)
router.get('/', async (req, res) => {
    try {
        const userId = req.headers['x-user-id']; // Assuming user ID comes from header

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data, error } = await supabase
            .from('reels')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ reels: data || [] });
    } catch (error) {
        console.error('Error fetching reels:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST / - Create new reel (Private)
router.post('/', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { title, url, trim_start, trim_end, scheduled_at } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Validate minimum duration (10 seconds)
        if (trim_end - trim_start < 10) {
            return res.status(400).json({
                error: 'El video debe tener al menos 10 segundos de duración'
            });
        }

        const { data, error } = await supabase
            .from('reels')
            .insert([{
                user_id: userId,
                title: title || '',
                url,
                trim_start: parseFloat(trim_start) || 0,
                trim_end: parseFloat(trim_end) || 0,
                scheduled_at: scheduled_at || null
            }])
            .select()
            .single();

        if (error) throw error;

        res.json({ reel: data });
    } catch (error) {
        console.error('Error creating reel:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /:id - Update reel (Private)
router.put('/:id', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { id } = req.params;
        const { title, trim_start, trim_end } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Validate minimum duration (10 seconds)
        if (trim_end - trim_start < 10) {
            return res.status(400).json({
                error: 'El video debe tener al menos 10 segundos de duración'
            });
        }

        const { data, error } = await supabase
            .from('reels')
            .update({
                title,
                trim_start: parseFloat(trim_start),
                trim_end: parseFloat(trim_end),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('user_id', userId) // Ensure user owns the reel
            .select()
            .single();

        if (error) throw error;

        res.json({ reel: data });
    } catch (error) {
        console.error('Error updating reel:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /:id - Delete reel (Private)
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user?.userId || req.headers['x-user-id'];
        const { id } = req.params;
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        console.log('🔍 DELETE - User:', userId, 'Reel:', id);

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // ⭐ Fix RLS: Create user-scoped Supabase client
        let scopedSupabase = supabase;

        if (token) {
            scopedSupabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_KEY,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );
        }

        // 1. Fetch reel using SCOPED client
        const { data: reel, error: fetchError } = await scopedSupabase
            .from('reels')
            .select('url, user_id')
            .eq('id', id)
            .single();

        if (fetchError) {
            console.error("Reel fetch error:", fetchError);
            return res.status(404).json({ error: "Reel not found" });
        }

        // 2. Check ownership
        console.log('🔍 Reel found - Owner:', reel.user_id, 'Request from:', userId);
        if (reel.user_id !== userId) {
            console.error("❌ Ownership mismatch!");
            return res.status(403).json({ error: "Forbidden: You don't own this reel" });
        }

        // 2. Delete from Cloudinary (if it's a Cloudinary URL)
        // 3. Delete from Cloudinary (Improved Logic)
        if (reel && reel.url && reel.url.includes('cloudinary.com')) {
            try {
                // Regex: Extract Public ID starting from 'reels/' folder
                // Ignores version (v123) and transformations (so_0, etc)
                // .../upload/so_0/v123/reels/video.mp4  => reels/video
                const regex = /\/v\d+\/(reels\/.+)\.[^.]+$/;
                const match = reel.url.match(regex);

                if (match && match[1]) {
                    const publicId = match[1];
                    console.log(`🗑️ Cloudinary Deleting - PID: ${publicId}`);

                    // Force invalidate to clear CDN cache
                    const result = await cloudinary.uploader.destroy(publicId, {
                        resource_type: 'video',
                        invalidate: true
                    });

                    console.log('✅ Cloudinary Result:', result);
                } else {
                    console.warn(`⚠️ PID Extraction Failed: ${reel.url}`);
                }
            } catch (cloudErr) {
                console.error("❌ Cloudinary Error:", cloudErr);
            }
        }

        // 3. Delete from Supabase using SCOPED client
        const { error } = await scopedSupabase
            .from('reels')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting reel:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /:id/view - Increment view count (Public)
router.post('/:id/view', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📈 View tracked for reel: ${id}`);

        // Try RPC first for atomicity
        const { error: rpcError } = await supabase.rpc('increment_reel_views', { reel_id: id });

        if (rpcError) {
            console.warn('RPC increment_reel_views failed, falling back to manual update:', rpcError.message);
            // Fallback manual increment
            const { data: reel } = await supabase
                .from('reels')
                .select('views_count')
                .eq('id', id)
                .single();

            if (reel) {
                await supabase
                    .from('reels')
                    .update({ views_count: (reel.views_count || 0) + 1 })
                    .eq('id', id);
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error incrementing reel views:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

export default router;
