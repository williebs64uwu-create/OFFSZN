import { Router } from 'express';
import { optionalAuthenticateTokenMiddleware } from '../../middlewares/optionalAuthenticateTokenMiddleware.js';
import { createCokeOrder, captureCokeOrder } from '../controllers/CocaColaCheckoutController.js';

const router = Router();

// --- Coca-Cola Isolated Checkout (no multi-payee, no SDK merchant mismatch) ---
router.post('/orders/coke/create', optionalAuthenticateTokenMiddleware, createCokeOrder);
router.post('/orders/coke/capture', optionalAuthenticateTokenMiddleware, captureCokeOrder);

export default router;
