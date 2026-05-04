import { Router } from 'express';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { subscribePayPalRecurring } from '../controllers/SubscriptionControllerV2.js';

const router = Router();

// --- PayPal V2 Routes (Suscripciones Recurrentes) ---
router.post(
    '/subscriptions/paypal/subscribe-v2',
    authenticateTokenMiddleware,
    subscribePayPalRecurring
);

export default router;
