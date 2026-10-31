import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    requestTrial, 
    activateSerial, 
    validateLicense,
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
import { receiveDiag, adminListDiag, diagLimiter } from '../controllers/PluginDiagController.js';
import { receiveChatLog, adminListChatLog, chatLogLimiter } from '../controllers/PluginChatLogController.js';
import { receivePaymentClick, adminListPaymentClicks, paymentClickLimiter } from '../controllers/PaymentClickController.js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { astraAsk, astraStatus, adminSetOrbTier, astraLimiter } from '../controllers/AstraController.js';

import { adminRecordDispatchPayment } from '../controllers/FinanceController.js';
const router = express.Router();

// Límites por IP (además del limitador global de /api): sin esto se podían fabricar pruebas gratis enviando HWID inventados
// y adivinar claves a ritmo de 500 intentos por cada 15 min. Las respuestas siguen el formato { error, code } que entiende el plugin.
const limitBody = (error) => ({ error, code: 'rate_limited' });
const trialLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: limitBody('Demasiadas solicitudes de prueba desde esta conexión. Inténtalo más tarde.') });
const activateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false, message: limitBody('Demasiados intentos de activación. Espera unos minutos e inténtalo de nuevo.') });

// Rutas usadas por el propio Plugin C++ en las peticiones HTTP (cURL/WebView)
router.post('/request-trial', trialLimiter, requestTrial);
router.post('/activate', activateLimiter, activateSerial);
router.post('/validate', validateLicense);
// Orb · Astra en la nube (planes Pro / Max)
router.post('/astra/status', astraLimiter, astraStatus);
router.post('/astra', astraLimiter, astraAsk);
router.post('/admin/orb-tier', adminSetOrbTier);
router.post('/diag', diagLimiter, receiveDiag);
router.get('/admin/diag', adminListDiag);
router.post('/chatlog', chatLogLimiter, receiveChatLog);
router.get('/admin/chatlog', adminListChatLog);
router.post('/payment-click', paymentClickLimiter, receivePaymentClick);
router.get('/admin/payment-clicks', adminListPaymentClicks);

// Rutas usadas por la Web para generar licencias gratis ligadas a la cuenta
router.post('/generate-web', authenticateTokenMiddleware, generateWebLicense);
router.post('/generate-trial-web', authenticateTokenMiddleware, generateTrialWebLicense);

// Endpoints Administrativos para Soporte y Despacho
router.post('/admin/reset-license', adminResetLicense);
router.post('/admin/delete-license', adminDeleteLicense);
router.get('/admin/ab-stats', adminGetABStats);

router.post('/admin/verify-pin', adminVerifyPin);
router.post('/admin/generate-key', adminGenerateFullKey);
router.post('/admin/create-license', adminGenerateFullKey);
router.get('/admin/licenses', adminListLicenses);
router.post('/admin/licenses', adminListLicenses);
router.post('/admin/ledger', adminRecordDispatchPayment);
router.post('/admin/update-status', adminUpdateLicenseStatus);
router.post('/admin/send-email', adminSendDispatchEmail);
// Admin: Estadísticas completas de trials, usuarios registrados y activaciones
router.get('/admin/analytics-full', adminGetAnalyticsFull);
router.get('/admin/telemetry-events', adminGetTelemetryEvents);

export default router;
