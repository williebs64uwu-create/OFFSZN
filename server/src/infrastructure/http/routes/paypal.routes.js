import { Router } from 'express';
import { optionalAuthenticateTokenMiddleware } from '../../middlewares/optionalAuthenticateTokenMiddleware.js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { createPayPalOrder, capturePayPalOrder, getSecureDownloadUrl, linkGuestOrder, connectPayPal, callbackPayPal, handlePayPalWebhook } from '../controllers/PayPalController.js';

const router = Router();

// --- PayPal Checkout ---
router.post('/orders/paypal/create', optionalAuthenticateTokenMiddleware, createPayPalOrder);
router.post('/orders/paypal/capture', optionalAuthenticateTokenMiddleware, capturePayPalOrder);
router.post('/orders/paypal/link', authenticateTokenMiddleware, linkGuestOrder);
router.get('/orders/download-link', optionalAuthenticateTokenMiddleware, getSecureDownloadUrl);
router.post('/orders/paypal-webhook', handlePayPalWebhook);

// --- PayPal OAuth (Connect) ---
router.get('/auth/paypal/connect', authenticateTokenMiddleware, connectPayPal);
router.get('/auth/paypal/callback', callbackPayPal); // PayPal redirects here

// --- Simulation/Test Tools ---
import { simulatePurchaseEmail } from '../controllers/PayPalController.js';
router.post('/test/simulate-purchase-email', simulatePurchaseEmail);

export default router;
