import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { optionalAuthenticateTokenMiddleware } from '../../middlewares/optionalAuthenticateTokenMiddleware.js';
import {
    catalog, geo, quote, lead, events, claimWelcome, me, onboarding, requestTrial, offerRedirect,
    cronAuth, trialFollowups, adminAuth, adminCustomers, adminAbReport, unsubscribe, saveCart, getCart
} from '../controllers/StoreController.js';
import * as crm from '../controllers/CrmController.js';
import { createPlanAdmin, starPlanStatus } from '../controllers/StarSubscriptionController.js';
import { financeMonth, financeAddExpense, financeDeleteExpense, financeSaveBank, financeVerify, paypalWebhookSetup } from '../controllers/FinanceController.js';
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

// ── CRM del owner (x-admin-key). Solo cuentan los intentos fallidos: 30 cada 15 min en todo /admin y 8 en la pantalla de acceso.
router.use('/admin', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, skipSuccessfulRequests: true, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Demasiados intentos. Prueba en 15 minutos.' } }));
router.post('/admin/verify', rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, skipSuccessfulRequests: true, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Demasiados intentos. Prueba en 15 minutos.' } }), adminAuth, crm.verify);
router.get('/admin/system', adminAuth, crm.system);
router.get('/admin/star-plan', adminAuth, starPlanStatus);
router.post('/admin/star-plan', adminAuth, createPlanAdmin);
router.get('/admin/finance', adminAuth, financeMonth);
router.post('/admin/finance/expenses', adminAuth, financeAddExpense);
router.delete('/admin/finance/expenses/:id', adminAuth, financeDeleteExpense);
router.put('/admin/finance/bank', adminAuth, financeSaveBank);
router.post('/admin/finance/income/:id/verify', adminAuth, financeVerify);
router.post('/admin/paypal-webhook-setup', adminAuth, paypalWebhookSetup);
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
router.get('/admin/sales', adminAuth, crm.sales);
router.post('/admin/payhip-import', adminAuth, express.text({ type: '*/*', limit: '5mb' }), crm.payhipImport);
router.get('/admin/product-prices', adminAuth, crm.productPrices);

router.get('/admin/customers', adminAuth, adminCustomers);
router.get('/admin/ab-report', adminAuth, adminAbReport);

export default router;
