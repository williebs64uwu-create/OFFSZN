import { Router } from 'express';
import { optionalAuthenticateTokenMiddleware } from '../../middlewares/optionalAuthenticateTokenMiddleware.js';
import {
    createEasyPitchOfferOrder,
    captureEasyPitchOfferOrder,
    chargeEasyPitchOfferYape
} from '../controllers/EasyPitchOfferCheckoutController.js';

const router = Router();

// --- Easy Pitch purchase page (fixed $7 / $9 offers) ---
router.post('/orders/easy-pitch-offer/create', optionalAuthenticateTokenMiddleware, createEasyPitchOfferOrder);
router.post('/orders/easy-pitch-offer/capture', optionalAuthenticateTokenMiddleware, captureEasyPitchOfferOrder);
router.post('/orders/easy-pitch-offer/yape', chargeEasyPitchOfferYape);

export default router;
