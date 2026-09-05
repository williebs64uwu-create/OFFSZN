import { Router } from 'express';
import {
  authLicensePanel,
  verifyLicensePanelToken,
  licensePanelAuthMiddleware,
  generateLicensePdfEndpoint
} from '../controllers/LicensePanelController.js';

const router = Router();

// Public auth endpoints
router.post('/auth', authLicensePanel);
router.get('/verify', verifyLicensePanelToken);

// Protected generator endpoint
router.post('/generate', licensePanelAuthMiddleware, generateLicensePdfEndpoint);

export default router;
