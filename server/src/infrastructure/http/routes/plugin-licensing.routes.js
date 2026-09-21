import express from 'express';
import { 
    requestTrial, 
    activateSerial, 
    generateWebLicense, 
    generateTrialWebLicense, 
    adminResetLicense, 
    adminDeleteLicense, 
    adminGetABStats, 
    adminVerifyPin, 
    adminGenerateFullKey,
    adminListLicenses,
    adminUpdateLicenseStatus,
    adminSendDispatchEmail,
    adminGetAnalyticsFull,
    adminGetTelemetryEvents
} from '../controllers/PluginLicensingController.js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';

const router = express.Router();

// Rutas usadas por el propio Plugin C++ en las peticiones HTTP (cURL/WebView)
router.post('/request-trial', requestTrial);
router.post('/activate', activateSerial);

// Rutas usadas por la Web para generar licencias gratis ligadas a la cuenta
router.post('/generate-web', authenticateTokenMiddleware, generateWebLicense);
router.post('/generate-trial-web', authenticateTokenMiddleware, generateTrialWebLicense);

// Endpoints Administrativos para Soporte y Despacho
router.post('/admin/reset-license', adminResetLicense);
router.post('/admin/delete-license', adminDeleteLicense);
router.get('/admin/ab-stats', adminGetABStats);

router.post('/admin/verify-pin', adminVerifyPin);
router.post('/admin/generate-key', adminGenerateFullKey);
router.get('/admin/licenses', adminListLicenses);
router.post('/admin/licenses', adminListLicenses);
router.post('/admin/update-status', adminUpdateLicenseStatus);
router.post('/admin/send-email', adminSendDispatchEmail);
// Admin: Estadísticas completas de trials, usuarios registrados y activaciones
router.get('/admin/analytics-full', adminGetAnalyticsFull);
router.get('/admin/telemetry-events', adminGetTelemetryEvents);

export default router;
