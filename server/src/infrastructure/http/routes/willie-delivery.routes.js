import { Router } from 'express';
import {
    getOrderDelivery,
    downloadPresetFile,
    createDeliverySession
} from '../controllers/WilliePresetDeliveryController.js';

const router = Router();

// Consultar compras y créditos por token
router.get('/delivery/:token', getOrderDelivery);

// Descargar archivo seguro (descuenta crédito y genera link firmado Bucket 4)
router.post('/delivery/:token/download', downloadPresetFile);

// Crear sesión de entrega post-pago
router.post('/delivery/create-session', createDeliverySession);

export default router;
