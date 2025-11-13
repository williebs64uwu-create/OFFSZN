import express from 'express';
import { getUserProfile, getUserProducts } from '../controllers/ProfileController.js';

const router = express.Router();

// Rutas públicas (sin autenticación)
router.get('/profile/:nickname', getUserProfile);
router.get('/profile/:nickname/products', getUserProducts);

export default router;
