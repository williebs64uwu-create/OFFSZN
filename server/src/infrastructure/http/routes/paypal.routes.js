import { Router } from 'express';
import { optionalAuthenticateTokenMiddleware } from '../../middlewares/optionalAuthenticateTokenMiddleware.js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import rateLimit from 'express-rate-limit';
import { getStarConfig, subscribeStar } from '../controllers/StarSubscriptionController.js';
import { createPayPalOrder, capturePayPalOrder, getCheckoutMerchants, getSecureDownloadUrl, linkGuestOrder, connectPayPal, callbackPayPal, handlePayPalWebhook } from '../controllers/PayPalController.js';

const router = Router();

// --- PayPal Checkout ---
router.post('/orders/paypal/merchants', optionalAuthenticateTokenMiddleware, getCheckoutMerchants);
router.post('/orders/paypal/create', optionalAuthenticateTokenMiddleware, createPayPalOrder);
router.post('/orders/paypal/capture', optionalAuthenticateTokenMiddleware, capturePayPalOrder);
router.post('/orders/paypal/link', authenticateTokenMiddleware, linkGuestOrder);
router.get('/orders/download-link', optionalAuthenticateTokenMiddleware, getSecureDownloadUrl);
router.post('/orders/paypal-webhook', handlePayPalWebhook);

// --- STAR CHAIN en 3 cuotas (suscripción de PayPal) ---
const starLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Demasiados intentos. Prueba en unos minutos.' } });
router.get('/orders/star/config', starLimiter, getStarConfig);
router.post('/orders/star/subscribe', starLimiter, optionalAuthenticateTokenMiddleware, subscribeStar);

// --- PayPal OAuth (Connect) ---
router.get('/auth/paypal/connect', authenticateTokenMiddleware, connectPayPal);
router.get('/auth/paypal/callback', callbackPayPal); // PayPal redirects here

// --- Admin Simulation/Test Tools ---
import { simulatePurchaseEmail } from '../controllers/PayPalController.js';
import { isAdminMiddleware } from '../../middlewares/isAdmin.middleware.js';
router.post('/test/simulate-purchase-email', isAdminMiddleware, simulatePurchaseEmail);

export default router;
