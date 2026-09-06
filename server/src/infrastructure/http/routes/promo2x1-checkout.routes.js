import { Router } from 'express';
import { optionalAuthenticateTokenMiddleware } from '../../middlewares/optionalAuthenticateTokenMiddleware.js';
import { createPromo2x1Order, capturePromo2x1Order } from '../controllers/Promo2x1CheckoutController.js';

const router = Router();

// --- Dedicated Promo 2x1 Isolated Checkout Routes ---
router.post('/orders/promo-2x1/create', optionalAuthenticateTokenMiddleware, createPromo2x1Order);
router.post('/orders/promo-2x1/capture', optionalAuthenticateTokenMiddleware, capturePromo2x1Order);

export default router;
