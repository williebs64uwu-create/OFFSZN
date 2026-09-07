import { Router } from 'express';
import { createWilliePayPalOrder, captureWilliePayPalOrder } from '../controllers/WillieCheckoutController.js';
import {
    getOrderDelivery,
    downloadPresetFile,
    createDeliverySession
} from '../controllers/WilliePresetDeliveryController.js';

const router = Router();

// Willie Inspired dedicated PayPal endpoints (no auth required — guest checkout)
router.post('/willie/paypal/create', createWilliePayPalOrder);
router.post('/willie/paypal/capture', captureWilliePayPalOrder);

// Willie Inspired Secure Delivery with Credits in Bucket 4 (bucket2026)
router.get('/willie/delivery/:token', getOrderDelivery);
router.post('/willie/delivery/:token/download', downloadPresetFile);
router.post('/willie/delivery/create-session', createDeliverySession);

export default router;

