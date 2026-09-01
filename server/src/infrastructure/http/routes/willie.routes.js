import { Router } from 'express';
import { createWilliePayPalOrder, captureWilliePayPalOrder } from '../controllers/WillieCheckoutController.js';

const router = Router();

// Willie Inspired dedicated PayPal endpoints (no auth required — guest checkout)
router.post('/willie/paypal/create', createWilliePayPalOrder);
router.post('/willie/paypal/capture', captureWilliePayPalOrder);

export default router;
