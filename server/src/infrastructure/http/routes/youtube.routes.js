// server/src/infrastructure/http/routes/youtube.routes.js

import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { incrementYoutubeUpload, getYoutubeQuota } from '../controllers/YouTubeController.js';
import { renderVideo } from '../controllers/VideoRenderController.js';

import os from 'os';

const router = Router();

// Multer config: disk storage to prevent RAM exhaustion on Free Tier
const upload = multer({
    storage: multer.diskStorage({
        destination: os.tmpdir()
    }),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max per field (audio)
        files: 2 // Max 2 files (cover + audio)
    },
    fileFilter: (req, file, cb) => {
        // Strict MIME type check at multer level
        const allowed = [
            'image/jpeg', 'image/png', 'image/webp', 'image/jpg',
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav'
        ];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
        }
    }
});

// Rate limiter: 5 video renders per 15 minutes per user
const renderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.user?.userId || 'unknown',
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes de render. Intenta en 15 minutos.' },
    validate: { xForwardedForHeader: false }
});

// YouTube+OFFSZN Quota Routes (all authenticated)
router.post('/youtube/increment-upload', authenticateTokenMiddleware, incrementYoutubeUpload);
router.get('/youtube/quota', authenticateTokenMiddleware, getYoutubeQuota);

// Video Render Route (authenticated + rate limited + multer)
router.post('/youtube/render-video',
    authenticateTokenMiddleware,
    renderLimiter,
    upload.fields([
        { name: 'cover', maxCount: 1 },
        { name: 'audio', maxCount: 1 }
    ]),
    renderVideo
);

// Multer error handler
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'Archivo demasiado grande. Cover ≤10MB, Audio ≤50MB.' });
        }
        return res.status(400).json({ error: 'Error de archivo: ' + err.message });
    }
    if (err.message && err.message.includes('Tipo de archivo no permitido')) {
        return res.status(400).json({ error: err.message });
    }
    next(err);
});

export default router;
