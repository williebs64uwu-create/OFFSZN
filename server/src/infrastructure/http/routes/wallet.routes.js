import { Router } from 'express';
import {
    createWalletPass,
    sendBroadcastPush,
    updateWalletPoints,
    getWalletMembers,
    getWalletStatus,
    saveWalletConfig
} from '../controllers/WalletController.js';

const router = Router();

// Public routes (Client enrollment)
router.post('/pass/create', createWalletPass);
router.get('/status', getWalletStatus);

// Management & Push routes
router.post('/push/broadcast', sendBroadcastPush);
router.post('/points/update', updateWalletPoints);
router.get('/members', getWalletMembers);
router.post('/config/save', saveWalletConfig);

export default router;
