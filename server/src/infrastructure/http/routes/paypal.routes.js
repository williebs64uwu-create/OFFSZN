import { Router } from 'express';
import { optionalAuthenticateTokenMiddleware } from '../../middlewares/optionalAuthenticateTokenMiddleware.js';
import { createPayPalOrder, capturePayPalOrder, getSecureDownloadUrl } from '../controllers/PayPalController.js';

const router = Router();

router.post('/orders/paypal/create', optionalAuthenticateTokenMiddleware, createPayPalOrder);
router.post('/orders/paypal/capture', optionalAuthenticateTokenMiddleware, capturePayPalOrder);
router.get('/orders/download-link', optionalAuthenticateTokenMiddleware, getSecureDownloadUrl);

export default router;
