import { Router } from 'express';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { scanChannel, linkBeat, getQuota } from '../controllers/YouTubeSyncController.js';

const router = Router();

// Todas las rutas de sincronización están protegidas
router.use(authenticateTokenMiddleware);

// Rutas dedicadas para YouTube Pro Sync (Beta) - Separadas de youtube.routes.js
router.get('/youtube-sync/quota', getQuota);
router.get('/youtube-sync/scan', scanChannel);
router.post('/youtube-sync/link-beat', linkBeat);

export default router;
