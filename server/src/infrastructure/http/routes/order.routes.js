import { Router } from 'express';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { 
    createMercadoPagoPreference
} from '../controllers/OrderController.js';

const router = Router();

//router.post('/orders/mercadopago-webhook', handleMercadoPagoWebhook);

//router.use(authenticateTokenMiddleware);

// Ruta de Mercado Pago
router.post(
    '/orders/create-mercadopago-preference', 
    authenticateTokenMiddleware, // <--- Aplicamos el middleware aquí
    createMercadoPagoPreference
);

export default router;