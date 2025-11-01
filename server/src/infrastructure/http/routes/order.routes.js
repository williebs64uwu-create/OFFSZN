import { Router } from 'express';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { createOrder, captureOrder } from '../controllers/OrderController.js'; 

const router = Router();

router.use(authenticateTokenMiddleware);

router.post('/orders/create', createOrder);
router.post('/orders/capture', captureOrder);

export default router;