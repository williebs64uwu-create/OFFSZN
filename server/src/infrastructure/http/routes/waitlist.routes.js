import express from 'express';
import rateLimit from 'express-rate-limit';
import { geo, count, join, details, waitlistAdminAuth, adminList, adminUpdate, adminDelete } from '../controllers/WaitlistController.js';

const router = express.Router();

const joinLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Prueba en un rato.' }
});

router.get('/geo', geo);
router.get('/count', count);
router.post('/', joinLimiter, join);
router.post('/details', joinLimiter, details);

router.get('/admin/list', waitlistAdminAuth, adminList);
router.patch('/admin/:id', waitlistAdminAuth, adminUpdate);
router.delete('/admin/:id', waitlistAdminAuth, adminDelete);

export default router;
