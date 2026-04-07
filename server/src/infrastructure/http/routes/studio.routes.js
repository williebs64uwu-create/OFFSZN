import express from 'express';
import { generateSample, chatWithIA, getChatHistory, getStudioHistory } from '../controllers/AiStudioController.js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';

const router = express.Router();

/**
 * @route   POST /api/studio/generate
 * @desc    Generate an AI sample from text prompt
 */
router.post('/generate', authenticateTokenMiddleware, generateSample);

/**
 * @route   POST /api/studio/chat
 * @desc    Get AI conversational response
 */
router.post('/chat', authenticateTokenMiddleware, chatWithIA);

/**
 * @route   GET /api/studio/messages
 * @desc    Get user chat history
 */
router.get('/messages', authenticateTokenMiddleware, getChatHistory);

/**
 * @route   GET /api/studio/history
 * @desc    Get user generated sounds history
 */
router.get('/history', authenticateTokenMiddleware, getStudioHistory);

export default router;
