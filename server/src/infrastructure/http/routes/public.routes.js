import { Router } from 'express';

// Importamos los controladores que necesitamos
import { getUserByNickname, getProductsByNickname } from '../controllers/UserController.js';
import { getAllProducts } from '../controllers/ProductController.js';

const router = Router();

// --- RUTAS PÚBLICAS DE PERFILES ---
router.get('/users/:nickname', getUserByNickname);
router.get('/users/:nickname/products', getProductsByNickname);

// --- RUTAS PÚBLICAS DE PRODUCTOS ---
// (Movemos esta ruta aquí también para tener todo lo público junto)
router.get('/products', getAllProducts);

export default router;