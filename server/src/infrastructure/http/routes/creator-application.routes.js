import { Router } from 'express';
import { applyCreator } from '../controllers/CreatorApplicationController.js';

const router = Router();
router.post('/apply', applyCreator);

export default router;
