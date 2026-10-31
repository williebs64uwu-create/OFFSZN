import { Router } from 'express';
import { getYapeConfig, chargeYape, quoteYape } from '../controllers/YapeController.js';

const router = Router();

// Public routes for Yape checkout
router.get('/config', getYapeConfig);
router.get('/quote', quoteYape);
router.post('/charge', chargeYape);

export default router;
