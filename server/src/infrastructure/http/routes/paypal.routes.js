import { Router } from 'express';
import { optionalAuthenticateTokenMiddleware } from '../../middlewares/optionalAuthenticateTokenMiddleware.js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { createPayPalOrder, capturePayPalOrder, getSecureDownloadUrl, linkGuestOrder } from '../controllers/PayPalController.js';

const router = Router();

router.post('/orders/paypal/create', optionalAuthenticateTokenMiddleware, createPayPalOrder);
router.post('/orders/paypal/capture', optionalAuthenticateTokenMiddleware, capturePayPalOrder);
router.post('/orders/paypal/link', authenticateTokenMiddleware, linkGuestOrder);
router.get('/orders/download-link', optionalAuthenticateTokenMiddleware, getSecureDownloadUrl);

export default router;
