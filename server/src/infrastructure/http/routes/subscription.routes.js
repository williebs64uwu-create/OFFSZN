import { Router } from 'express';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { processSubscriptionPayment, handleSubscriptionWebhook, createSubscriptionPreference, getPublicKey, createPayPalSubscriptionOrder, capturePayPalSubscriptionOrder } from '../controllers/SubscriptionController.js';

const router = Router();

// Route to get public key safely
router.post('/subscriptions/public-key', getPublicKey);

// Route to create a preference for the MP Payment Brick
router.post(
    '/subscriptions/create-preference',
    authenticateTokenMiddleware,
    createSubscriptionPreference
);

// Route to process a payment directly from the MP Payment Brick
router.post(
    '/subscriptions/process-payment',
    authenticateTokenMiddleware,
    processSubscriptionPayment
);

// Route to handle Mercado Pago Webhooks for subscriptions
router.post('/subscriptions/mercadopago-webhook', handleSubscriptionWebhook);

// --- PayPal Subscription Routes ---
router.post(
    '/subscriptions/paypal/create',
    authenticateTokenMiddleware,
    createPayPalSubscriptionOrder
);

router.post(
    '/subscriptions/paypal/capture',
    authenticateTokenMiddleware,
    capturePayPalSubscriptionOrder
);

export default router;
