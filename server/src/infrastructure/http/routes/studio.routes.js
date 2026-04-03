import express from 'express';
import { generateSample } from '../controllers/AiStudioController.js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';

const router = express.Router();

/**
 * @route   POST /api/studio/generate
 * @desc    Generate an AI sample from text prompt
 * @access  Private (Costs 10 credits)
 */
router.post('/generate', authenticateTokenMiddleware, generateSample);

export default router;
