import express from 'express';
import { createAnalyzerOrder, captureAnalyzerOrder } from '../controllers/AnalyzerController.js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';

const router = express.Router();

// Publicly accessible for creation, but can capture with auth if logged in
router.post('/analyzer/create-order', createAnalyzerOrder);
router.post('/analyzer/capture-order', captureAnalyzerOrder);

export default router;
