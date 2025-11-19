import { Router } from 'express';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { 
    createMercadoPagoPreference, 
    handleMercadoPagoWebhook,
    checkPaymentStatus // <--- IMPORTAR ESTO
} from '../controllers/OrderController.js';

const router = Router();

router.post('/orders/mercadopago-webhook', handleMercadoPagoWebhook);

router.post(
    '/orders/create-mercadopago-preference', 
    authenticateTokenMiddleware, 
    createMercadoPagoPreference
);

// --- NUEVA RUTA DE POLLING ---
router.get(
    '/orders/status/latest', 
    authenticateTokenMiddleware, 
    checkPaymentStatus
);

export default router;