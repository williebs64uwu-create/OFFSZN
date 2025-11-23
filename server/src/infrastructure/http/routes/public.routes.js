import { Router } from 'express';

// Importamos los controladores
import { getUserByNickname, getProductsByNickname, getAllProducers } from '../controllers/UserController.js';
import { getAllProducts } from '../controllers/ProductController.js';

const router = Router();

// --- RUTAS PÚBLICAS (Cualquiera puede verlas sin login) ---

// 1. Obtener perfil público de usuario
router.get('/users/:nickname', getUserByNickname);

// 2. Obtener productos de un usuario específico
router.get('/users/:nickname/products', getProductsByNickname);

// 3. Obtener TODOS los productos (para el marketplace general)
router.get('/products', getAllProducts);

// 4. Obtener lista de PRODUCTORES (Esta es la que te fallaba)
router.get('/producers', getAllProducers); 

export default router;