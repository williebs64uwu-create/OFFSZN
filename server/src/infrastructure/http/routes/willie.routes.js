import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuthenticateTokenMiddleware } from '../../middlewares/optionalAuthenticateTokenMiddleware.js';
import { createWilliePayPalOrder, captureWilliePayPalOrder, chargeWillieYape } from '../controllers/WillieCheckoutController.js';
import {
    getOrderDelivery,
    downloadPresetFile,
    createDeliverySession
} from '../controllers/WilliePresetDeliveryController.js';

const router = Router();

const payLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 40,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de pago. Espera unos minutos.' }
});

// Checkout Willie Inspired (invitado o con cuenta; la cuenta solo hace falta para el 50% de bienvenida)
router.post('/willie/paypal/create', payLimiter, optionalAuthenticateTokenMiddleware, createWilliePayPalOrder);
router.post('/willie/paypal/capture', payLimiter, optionalAuthenticateTokenMiddleware, captureWilliePayPalOrder);
router.post('/willie/yape/charge', payLimiter, optionalAuthenticateTokenMiddleware, chargeWillieYape);

// Entrega segura de presets (créditos de descarga en R2 bucket2026)
router.get('/willie/delivery/:token', getOrderDelivery);
router.post('/willie/delivery/:token/download', downloadPresetFile);
router.post('/willie/delivery/create-session', createDeliverySession); // solo owner (x-admin-key)

export default router;
