// server/src/infrastructure/http/routes/user.routes.js

import { Router } from 'express';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';

// ¡YA NO IMPORTAMOS NADA PÚBLICO AQUÍ!
import { 
    getMyPurchasedProducts, 
    completeOnboarding,
    getCurrentUser, 
    getMyProducts,
    updateMyProfile
} from '../controllers/UserController.js'; 

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
router.put('/complete-onboarding', completeOnboarding); 
router.put('/me/onboarding', completeOnboarding);

// ¡YA NO ESTÁN LAS RUTAS PÚBLICAS AQUÍ!

export default router;