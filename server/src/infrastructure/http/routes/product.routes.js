import { Router } from 'express';
//import multer from 'multer';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { getAllProducts, createProduct } from '../controllers/ProductController.js';

const router = Router();

router.get('/products', getAllProducts);
router.post('/products', 
    authenticateTokenMiddleware,
    createProduct 
);

export default router;