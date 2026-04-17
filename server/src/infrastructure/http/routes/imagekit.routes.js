import { Router } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { uploadToImageKit } from '../../services/imagekit.service.js';
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

    } catch (error) {
        console.error('❌ Error uploading banner to ImageKit:', error);
        res.status(500).json({ error: 'Error al subir el banner' });
    }
});

export default router;
