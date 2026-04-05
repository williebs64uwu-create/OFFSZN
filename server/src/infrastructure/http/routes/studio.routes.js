import express from 'express';
import { generateSample, chatWithIA } from '../controllers/AiStudioController.js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';

const router = express.Router();

/**
 * @route   POST /api/studio/generate
 * @desc    Generate an AI sample from text prompt
 * @access  Private (Costs 10 credits)
 */
router.post('/generate', authenticateTokenMiddleware, generateSample);

/**
 * @route   POST /api/studio/chat
 * @desc    Get AI conversational response via NVIDIA NIM
 * @access  Private
 */
router.post('/chat', authenticateTokenMiddleware, chatWithIA);

export default router;
