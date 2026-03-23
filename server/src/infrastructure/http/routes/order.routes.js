import { Router } from 'express';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import {
    createMercadoPagoPreference,
    handleMercadoPagoWebhook,
    checkPaymentStatus,
    forceCheckPayment,
    createFreeOrder,
    handleFreeGuestDownload
} from '../controllers/OrderController.js';

const router = Router();

router.post('/orders/mercadopago-webhook', handleMercadoPagoWebhook);

router.post(
    '/orders/create-mercadopago-preference',
    authenticateTokenMiddleware,
    createMercadoPagoPreference
);

router.post(
    '/orders/free',
    authenticateTokenMiddleware,
    createFreeOrder
);

router.post(
    '/orders/free-guest',
    handleFreeGuestDownload
);

// --- NUEVA RUTA DE POLLING ---
router.get(
    '/orders/status/latest',
    authenticateTokenMiddleware,
    checkPaymentStatus
);

router.get('/orders/debug/force/:paymentId', forceCheckPayment);

export default router;