import express from 'express';
import { generateSample, chatWithIA, getChatHistory, getStudioHistory, downloadWithMetadata } from '../controllers/AiStudioController.js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';

const router = express.Router();

/**
 * @route   GET /api/studio/download
 * @desc    Download audio with injected metadata (Title/Artist)
 */
router.get('/download', downloadWithMetadata);

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
