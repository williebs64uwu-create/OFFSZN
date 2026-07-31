import express from 'express';
import { requestTrial, activateSerial, generateWebLicense, generateTrialWebLicense, adminResetLicense, adminDeleteLicense } from '../controllers/PluginLicensingController.js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';

const router = express.Router();

// Rutas usadas por el propio Plugin C++ en las peticiones HTTP (cURL/WebView)
router.post('/request-trial', requestTrial);
router.post('/activate', activateSerial);

// Rutas usadas por la Web para generar licencias gratis ligadas a la cuenta
router.post('/generate-web', authenticateTokenMiddleware, generateWebLicense);
router.post('/generate-trial-web', authenticateTokenMiddleware, generateTrialWebLicense);

// Admin: Borrar licencia vieja + generar nueva FULL (protegida por admin_key)
router.post('/admin/reset-license', adminResetLicense);
// Admin: Solo borrar licencia (sin crear reemplazo)
router.post('/admin/delete-license', adminDeleteLicense);

export default router;
