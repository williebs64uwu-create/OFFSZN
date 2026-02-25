// server/src/infrastructure/http/routes/user.routes.js

import { Router } from 'express';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';

// ¡YA NO IMPORTAMOS NADA PÚBLICO AQUÍ!
import {
    getMyPurchasedProducts,
    completeOnboarding,
    getCurrentUser,
    getMyProducts,
    updateMyProfile,
    getMyListenHistory,
    clearMyListenHistory,
    claimWelcomeCoupon
} from '../controllers/UserController.js';
import {
    followUser,
    unfollowUser,
    checkFollowStatus,
    getMyFollowing
} from '../controllers/FollowController.js';
import {
    getMyFavorites,
    toggleProductLike
} from '../controllers/FavoritesController.js';

const router = Router();

// ===================================
// --- ¡APLICA EL MIDDLEWARE AL INICIO! ---
// (Ahora TODO en este archivo es PRIVADO)
// ===================================
router.use(authenticateTokenMiddleware);

// ===================================
// --- RUTAS PRIVADAS (AUTENTICADAS) ---
// ===================================
router.get('/me', getCurrentUser);
router.put('/me', updateMyProfile);
router.get('/my-products', getMyPurchasedProducts);
router.get('/me/products', getMyProducts);
router.get('/me/history', getMyListenHistory); // New History Route
router.delete('/me/history', clearMyListenHistory); // Clear History
router.get('/me/following', getMyFollowing);
router.get('/me/favorites', getMyFavorites); // New
router.post('/products/:id/like', toggleProductLike); // New
router.put('/complete-onboarding', completeOnboarding);
router.put('/me/onboarding', completeOnboarding);
router.post('/me/claim-welcome-coupon', claimWelcomeCoupon);

// ¡YA NO ESTÁN LAS RUTAS PÚBLICAS AQUÍ!

// Follow System
router.post('/users/:id/follow', followUser);
router.delete('/users/:id/follow', unfollowUser);
router.get('/users/:id/follow', checkFollowStatus);

export default router;