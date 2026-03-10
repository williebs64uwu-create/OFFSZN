import { Router } from 'express';
import { createRequest, respondRequest, getMyRequests, getPublicRequests, claimRequest } from '../controllers/RequestController.js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';

const router = Router();

// Public feed of pending requests
router.get('/custom-requests/public', getPublicRequests);

// Create a new custom request (Buyer)
router.post('/custom-requests', authenticateTokenMiddleware, createRequest);

// Respond to a custom request (Producer)
router.post('/custom-requests/:id/respond', authenticateTokenMiddleware, respondRequest);

// Get my requests (Buyer or Producer depending on ?type=buyer|producer)
router.get('/custom-requests', authenticateTokenMiddleware, getMyRequests);

// Claim an open request
router.post('/custom-requests/:id/claim', authenticateTokenMiddleware, claimRequest);

export default router;
