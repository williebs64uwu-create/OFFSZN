import { Router } from 'express';
import { getUserProfile, getUserProducts } from '../controllers/ProfileController.js';

const router = Router();

// Rutas PÚBLICAS - NO requieren autenticación
router.get('/:nickname', getUserProfile);
router.get('/:nickname/products', getUserProducts);

export default router;
