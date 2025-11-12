import { Router } from 'express';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { getMyPurchasedProducts, completeOnboarding, getCurrentUser, getMyProducts, updateMyProfile } from '../controllers/UserController.js'; 

const router = Router();

router.use(authenticateTokenMiddleware);

router.get('/my-products', getMyPurchasedProducts);

router.put('/complete-onboarding', completeOnboarding);

router.get('/me', getCurrentUser);

router.put('/me/onboarding', completeOnboarding);

router.get('/me/products', getMyProducts);

router.put('/me', updateMyProfile);

export default router;