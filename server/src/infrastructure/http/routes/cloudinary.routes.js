import { Router } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import multer from 'multer';

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 30 * 1024 * 1024 } // 30MB
});

const router = Router();

// 🔥 Cloudinary Config (reuses same env vars as Reels)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Supabase admin client (for cleanup of old avatars from Supabase bucket)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// 🔥 SIZE LIMIT — 30MB for all avatar uploads
const MAX_AVATAR_SIZE = 30 * 1024 * 1024;

// ============================================
// POST /api/cloudinary/avatar — Upload avatar to Cloudinary
// Stores the ORIGINAL image. Display optimization via URL transforms.
// ============================================
router.post('/avatar', authenticateTokenMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { image, isGif, fileSize, crop } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'No se proporcionó imagen' });
        }

        // 🔥 Size validation
        if (fileSize && fileSize > MAX_AVATAR_SIZE) {
            return res.status(413).json({ error: 'El archivo excede el límite de 30MB' });
        }

        // 🔥 GIF = Pro only
        if (isGif) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('plan')
                .eq('id', userId)
                .maybeSingle();

            if (!profile || profile.plan !== 'pro') {
                return res.status(403).json({
                    error: 'Los avatars GIF son exclusivos del plan Pro',
                    upgrade: true
                });
            }
        }

        // 🔥 Get old avatar URL to check for Supabase cleanup
        const { data: currentUser } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', userId)
            .single();

        const oldUrl = currentUser?.avatar_url;
        const publicId = userId; // Simpler ID, folder 'avatars/' handles separation

        // 🔥 ALWAYS UPLOAD NEW IMAGE
        const uploadResult = await cloudinary.uploader.upload(image, {
            folder: 'avatars',
            public_id: publicId,
            overwrite: true,
            invalidate: true,
            resource_type: 'auto',
        });

        // 🔥 Build display URL
        let displayUrl;

        // Version is CRITICAL to bypass browser cache after re-cropping
        const version = uploadResult ? uploadResult.version : Date.now();

        if (crop && crop.width && crop.height) {
            const transforms = [
                {
                    x: Math.round(crop.x),
                    y: Math.round(crop.y),
                    width: Math.round(crop.width),
                    height: Math.round(crop.height),
                    crop: 'crop'
                },
                { width: 500, height: 500, crop: 'fill' }
            ];

            const options = {
                transformation: transforms,
                secure: true,
                version: version
            };

            if (isGif) {
                options.flags = 'animated';
                displayUrl = cloudinary.url(`avatars/${publicId}.gif`, options);
            } else {
                displayUrl = cloudinary.url(`avatars/${publicId}`, {
                    ...options,
                    quality: 'auto',
                    fetch_format: 'auto'
                });
            }
        } else if (isGif) {
            displayUrl = uploadResult ? uploadResult.secure_url : oldUrl;
        } else {
            // Regular auto-cropped version
            displayUrl = cloudinary.url(`avatars/${publicId}`, {
                width: 500,
                height: 500,
                crop: 'fill',
                gravity: 'face',
                quality: 'auto',
                fetch_format: 'auto',
                secure: true,
                version: version
            });
        }

        // 🔥 Update user profile with display URL
        const { error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: displayUrl })
            .eq('id', userId);

        if (updateError) throw updateError;

        // 🔥 CLEANUP: Delete old avatar from Supabase bucket (if it was there)
        if (oldUrl && oldUrl.includes('supabase')) {
            try {
                const oldFileName = oldUrl.split('/').pop();
                if (oldFileName) {
                    const { error: delErr } = await supabase.storage
                        .from('avatars')
                        .remove([oldFileName]);
                    if (!delErr) {
                        console.log('🗑️ Old Supabase avatar deleted:', oldFileName);
                    }
                }
            } catch (cleanupErr) {
                console.warn('⚠️ Supabase cleanup error (non-fatal):', cleanupErr.message);
            }
        }
        res.json({
            success: true,
            url: displayUrl,
            message: 'Avatar actualizado correctamente'
        });

    } catch (error) {
        console.error('❌ Error uploading avatar to Cloudinary:', error);
        res.status(500).json({ error: 'Error al subir el avatar' });
    }
});

// ============================================
// POST /api/cloudinary/banner — Upload banner to Cloudinary
// ============================================
router.post('/banner', authenticateTokenMiddleware, upload.single('imageFile'), async (req, res) => {
    try {
        const userId = req.user.userId;
        let { image, isGif, fileSize, crop } = req.body;

        // If uploaded via FormData file
        if (req.file) {
            // Convert buffer to data URI for Cloudinary
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            image = `data:${req.file.mimetype};base64,${b64}`;
            fileSize = req.file.size;
            // isGif might be a string "true"/"false" in FormData
            isGif = isGif === 'true' || isGif === true;
        }

        if (!image) {
            return res.status(400).json({ error: 'No se proporcionó imagen' });
        }

        // 🔥 Size validation (30MB for banners too)
        if (fileSize && fileSize > MAX_AVATAR_SIZE) {
            return res.status(413).json({ error: 'El archivo excede el límite de 30MB' });
        }

        // 🔥 GIFs = Pro only. Static images = Free.
        if (isGif) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('plan')
                .eq('id', userId)
                .maybeSingle();

            if (!profile || profile.plan !== 'pro') {
                return res.status(403).json({
                    error: 'Los banners GIF son exclusivos del plan Pro',
                    upgrade: true
                });
            }
        }

        const publicId = `banner_${userId}`;

        // 🔥 Upload to 'banners' folder
        const uploadResult = await cloudinary.uploader.upload(image, {
            folder: 'banners',
            public_id: publicId,
            overwrite: true,
            invalidate: true,
            resource_type: 'auto',
        });

        const version = uploadResult ? uploadResult.version : Date.now();
        let displayUrl;

        if (crop && crop.width && crop.height) {
            // Server-side crop based on frontend coordinates
            const transforms = [
                {
                    x: Math.round(crop.x),
                    y: Math.round(crop.y),
                    width: Math.round(crop.width),
                    height: Math.round(crop.height),
                    crop: 'crop'
                },
                { width: 1500, height: 380, crop: 'fill' } // Target exact header height
            ];

            const options = {
                transformation: transforms,
                secure: true,
                version: version
            };

            if (isGif) {
                options.flags = 'animated';
                displayUrl = cloudinary.url(`banners/${publicId}.gif`, options);
            } else {
                displayUrl = cloudinary.url(`banners/${publicId}`, {
                    ...options,
                    quality: 'auto',
                    fetch_format: 'auto'
                });
            }
        } else {
            // Fallback: Automatic fill if no crop data
            displayUrl = cloudinary.url(`banners/${publicId}`, {
                width: 1500,
                height: 380,
                crop: 'fill',
                gravity: 'center',
                quality: 'auto',
                fetch_format: 'auto',
                secure: true,
                version: version
            });
        }

        // 🔥 Update users table (banner_url)
        const { error: updateError } = await supabase
            .from('users')
            .update({ banner_url: `url:${displayUrl}` })
            .eq('id', userId);

        if (updateError) throw updateError;

        res.json({
            success: true,
            url: displayUrl,
            message: 'Banner actualizado correctamente'
        });

    } catch (error) {
        console.error('❌ Error uploading banner to Cloudinary:', error);
        res.status(500).json({ error: 'Error al subir el banner' });
    }
});

export default router;
