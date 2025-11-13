// server/src/infrastructure/http/routes/product.routes.js

import { Router } from 'express';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
// ¡YA NO IMPORTAMOS 'getAllProducts'!
import { createProduct } from '../controllers/ProductController.js';

const router = Router();

// ¡YA NO ESTÁ LA RUTA 'GET /products' AQUÍ!

// Esta ruta es privada y usa el middleware individualmente (¡perfecto!)
router.post('/products', 
    authenticateTokenMiddleware, 
    createProduct 
);

export default router;