import { Router } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { uploadToImageKit, deleteFromImageKitByPath } from '../../services/imagekit.service.js';
import multer from 'multer';

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 30 * 1024 * 1024 } // 30MB
});

const router = Router();

// 🔥 Cloudinary Config (Keep for legacy deletions if necessary)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Supabase admin client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// 🔥 SIZE LIMIT — 30MB
const MAX_AVATAR_SIZE = 30 * 1024 * 1024;

// ============================================
// HELPERS
// ============================================

/**
 * Extracts the ImageKit path from a full URL.
 * Format: https://ik.imagekit.io/<id>/folder/file.ext?tr=...
 */
function extractPathFromIkUrl(url) {
    if (!url) return null;
    
    // Clean prefix if exists (used in banner/avatar storage)
    let cleanUrl = url.replace(/^url:/, '').replace(/^gif:/, '');
    
    // Check if it's an ImageKit URL
    if (!cleanUrl.includes('ik.imagekit.io')) return null;

    try {
        const parsed = new URL(cleanUrl);
        // Pathname is /<endpoint_id>/<folder>/<filename>
        // We need just /<folder>/<filename>
        const pathParts = parsed.pathname.split('/').filter(p => p.length > 0);
        
        if (pathParts.length >= 2) {
            // The first part is usually the endpoint ID (e.g., 6gzqp4xam)
            return '/' + pathParts.slice(1).join('/');
        }
    } catch (e) {
        return null;
    }
    return null;
}

// ============================================
// POST /api/imagekit/avatar — Upload avatar to ImageKit
// ============================================
router.post('/avatar', authenticateTokenMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { image, isGif, fileSize, crop, context } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'No se proporcionó imagen' });
        }

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

        const { data: currentUser } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', userId)
            .single();

        const oldUrl = currentUser?.avatar_url;

        const folder = context === 'group' ? 'groups' : 'avatars';
        const fileName = context === 'group' ? `group_${Date.now()}_${userId}` : `avatar_${userId}`;

        // 🔥 UPLOAD TO IMAGEKIT
        const uploadResult = await uploadToImageKit(image, fileName, folder);

        // 🔥 Build display URL (ImageKit transformations)
        // Use filePath (which includes /avatars/) to construct the correct URL
        // The SDK's .url field sometimes omits the folder, causing 404s
        const ikEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/6gzqp4xam';
        let displayUrl = `${ikEndpoint}${uploadResult.filePath}`;

        // Apply transformations if crop exists or default 500x500
        const ikTransformations = [];
        if (crop && crop.width && crop.height) {
            ikTransformations.push({
                raw: `cm-extract,x-${Math.round(crop.x)},y-${Math.round(crop.y)},w-${Math.round(crop.width)},h-${Math.round(crop.height)}`
            });
            ikTransformations.push({ width: 500, height: 500, cropType: 'force' });
        } else {
            ikTransformations.push({ width: 500, height: 500, cropType: 'maintain_ratio', focus: 'face' });
        }

        // Append version/timestamp to bypass cache
        const version = Date.now();
        displayUrl = `${uploadResult.url}?tr=${ikTransformations.map(t => Object.entries(t).map(([k, v]) => `${k}-${v}`).join(',')).join(':')}&v=${version}`;

        // 🔥 Update user profile
        if (context !== 'group') {
            const { error: updateError } = await supabase
                .from('users')
                .update({ avatar_url: displayUrl })
                .eq('id', userId);

            if (updateError) throw updateError;
        }

        res.json({
            success: true,
            url: displayUrl,
            message: 'Avatar actualizado correctamente'
        });

        // 🔥 CLEANUP: Delete previous avatar if exists (Strictly after success)
        if (oldUrl) {
            const oldPath = extractPathFromIkUrl(oldUrl);
            if (oldPath) {
                console.log(`🧹 [Avatar Cleanup] Triggering deletion for: ${oldPath}`);
                // Use fire-and-forget or await? 
                // Since this is cleanup and logic is finished, we don't block the client
                deleteFromImageKitByPath(oldPath).catch(err => 
                    console.error('❌ Error in background cleanup:', err)
                );
            }
        }

    } catch (error) {
        console.error('❌ Error uploading avatar to ImageKit:', error);
        res.status(500).json({ error: 'Error al subir el avatar' });
    }
});

// ============================================
// POST /api/imagekit/banner — Upload banner to ImageKit
// ============================================
router.post('/banner', authenticateTokenMiddleware, upload.single('imageFile'), async (req, res) => {
    try {
        const userId = req.user.userId;
        let { image, isGif, fileSize, crop } = req.body;

        // Fetch current banner before update for cleanup
        const { data: currentUser } = await supabase
            .from('users')
            .select('banner_url')
            .eq('id', userId)
            .single();

        const oldUrl = currentUser?.banner_url;

        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            image = `data:${req.file.mimetype};base64,${b64}`;
            fileSize = req.file.size;
            isGif = isGif === 'true' || isGif === true;
        }

        if (!image) {
            return res.status(400).json({ error: 'No se proporcionó imagen' });
        }

        if (fileSize && fileSize > MAX_AVATAR_SIZE) {
            return res.status(413).json({ error: 'El archivo excede el límite de 30MB' });
        }

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

        const fileName = `banner_${userId}`;
        const folder = 'banners';

        // 🔥 UPLOAD TO IMAGEKIT
        const uploadResult = await uploadToImageKit(image, fileName, folder);

        const version = Date.now();
        const ikEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/6gzqp4xam';
        let displayUrl = `${ikEndpoint}${uploadResult.filePath}`;

        const ikTransformations = [];
        if (crop && crop.width && crop.height) {
            ikTransformations.push({
                raw: `cm-extract,x-${Math.round(crop.x)},y-${Math.round(crop.y)},w-${Math.round(crop.width)},h-${Math.round(crop.height)}`
            });
            ikTransformations.push({ width: 1500, height: 380, cropType: 'force' });
        } else {
            ikTransformations.push({ width: 1500, height: 380, cropType: 'maintain_ratio', focus: 'center' });
        }

        displayUrl = `${uploadResult.url}?tr=${ikTransformations.map(t => Object.entries(t).map(([k, v]) => `${k}-${v}`).join(',')).join(':')}&v=${version}`;

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

        // 🔥 CLEANUP: Delete previous banner if exists (Strictly after success)
        if (oldUrl) {
            const oldPath = extractPathFromIkUrl(oldUrl);
            if (oldPath) {
                console.log(`🧹 [Banner Cleanup] Triggering deletion for: ${oldPath}`);
                deleteFromImageKitByPath(oldPath).catch(err => 
                    console.error('❌ Error in background cleanup:', err)
                );
            }
        }

    } catch (error) {
        console.error('❌ Error uploading banner to ImageKit:', error);
        res.status(500).json({ error: 'Error al subir el banner' });
    }
});

export default router;
