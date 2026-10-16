import { Router } from 'express';
import {
    requestDeviceCode,
    checkDeviceCode,
    confirmDevice,
    pollDeviceCode
} from '../controllers/DeviceAuthController.js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';

const router = Router();

// Endpoint público para que el plugin solicite el código
router.post('/code', requestDeviceCode);

// Endpoint público para que la web verifique el código en pantalla
router.get('/check', checkDeviceCode);

// Endpoint para que el usuario confirme desde el navegador (con token opcional o cookie)
router.post('/confirm', (req, res, next) => {
    // Si viene encabezado de autorización, ejecutar middleware; si no, continuar
    if (req.headers.authorization) {
        return authenticateTokenMiddleware(req, res, next);
    }
    next();
}, confirmDevice);

// Endpoint de sondeo periódico (polling cada 2s) que ejecuta el plugin
router.post('/poll', pollDeviceCode);

export default router;