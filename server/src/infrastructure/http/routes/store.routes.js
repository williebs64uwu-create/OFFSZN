import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { optionalAuthenticateTokenMiddleware } from '../../middlewares/optionalAuthenticateTokenMiddleware.js';
import {
    catalog, geo, quote, lead, events, claimWelcome, me, onboarding, requestTrial, offerRedirect,
    cronAuth, trialFollowups, adminAuth, adminCustomers, adminAbReport
} from '../controllers/StoreController.js';

const router = express.Router();

const limiter = (limit, windowMin, message) => rateLimit({
    windowMs: windowMin * 60 * 1000, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: message }
});
const formLimiter = limiter(15, 60, 'Demasiados intentos. Prueba en un rato.');
const eventLimiter = limiter(120, 10, 'Demasiados eventos.');

router.get('/catalog', optionalAuthenticateTokenMiddleware, catalog);
router.get('/geo', optionalAuthenticateTokenMiddleware, geo);
router.post('/quote', limiter(120, 10, 'Demasiadas consultas.'), optionalAuthenticateTokenMiddleware, quote);
router.post('/leads', formLimiter, lead);
router.post('/events', eventLimiter, optionalAuthenticateTokenMiddleware, events);
router.post('/trials', formLimiter, requestTrial);
router.get('/r/:code', offerRedirect);

router.post('/welcome/claim', authenticateTokenMiddleware, claimWelcome);
router.get('/me', authenticateTokenMiddleware, me);
router.post('/onboarding', authenticateTokenMiddleware, onboarding);

// Cron horario (GitHub Actions o Vercel Cron): Authorization: Bearer STORE_CRON_SECRET
router.get('/cron/trial-followups', cronAuth, trialFollowups);
router.post('/cron/trial-followups', cronAuth, trialFollowups);

router.get('/admin/customers', adminAuth, adminCustomers);
router.get('/admin/ab-report', adminAuth, adminAbReport);

export default router;
