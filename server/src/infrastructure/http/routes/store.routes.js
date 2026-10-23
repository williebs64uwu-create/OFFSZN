import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { optionalAuthenticateTokenMiddleware } from '../../middlewares/optionalAuthenticateTokenMiddleware.js';
import {
    catalog, geo, quote, lead, events, claimWelcome, me, onboarding, requestTrial, offerRedirect,
    cronAuth, trialFollowups, adminAuth, adminCustomers, adminAbReport, unsubscribe, saveCart, getCart
} from '../controllers/StoreController.js';
import * as crm from '../controllers/CrmController.js';
import { runAutomations } from '../../services/crmService.js';

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

router.post('/cart', formLimiter, optionalAuthenticateTokenMiddleware, saveCart);
router.get('/cart/:id', limiter(60, 10, 'Demasiadas consultas.'), getCart);
router.get('/unsubscribe', unsubscribe);

// Todas las automatizaciones (carrito abandonado, nutrición, upsell, recompra). Se llama cada hora junto a las pruebas.
router.all('/cron/automations', cronAuth, async (req, res) => res.json({ ok: true, results: await runAutomations() }));

// ── CRM del owner (x-admin-key)
router.get('/admin/overview', adminAuth, crm.overview);
router.get('/admin/contacts', adminAuth, crm.contacts);
router.get('/admin/contacts/:email', adminAuth, crm.contact);
router.patch('/admin/contacts/:email', adminAuth, crm.updateContact);
router.post('/admin/contacts/:email/notes', adminAuth, crm.addNote);
router.patch('/admin/notes/:id', adminAuth, crm.updateNote);
router.get('/admin/tasks', adminAuth, crm.tasks);
router.get('/admin/deals', adminAuth, crm.deals);
router.post('/admin/deals', adminAuth, crm.createDeal);
router.patch('/admin/deals/:id', adminAuth, crm.updateDeal);
router.get('/admin/automations', adminAuth, crm.automations);
router.patch('/admin/automations/:key', adminAuth, crm.toggleAutomation);
router.post('/admin/automations/run', adminAuth, crm.runNow);
router.post('/admin/manual-sale', adminAuth, crm.manualSale);

router.get('/admin/customers', adminAuth, adminCustomers);
router.get('/admin/ab-report', adminAuth, adminAbReport);

export default router;
