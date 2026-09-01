import { Router } from 'express';
import { getYapeConfig, chargeYape } from '../controllers/YapeController.js';

const router = Router();

// Public routes for Yape checkout
router.get('/config', getYapeConfig);
router.post('/charge', chargeYape);

export default router;
