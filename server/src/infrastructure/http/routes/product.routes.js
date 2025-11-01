import { Router } from 'express';
import multer from 'multer';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { getAllProducts, createProduct } from '../controllers/ProductController.js';

const storage = multer.memoryStorage(); 
const upload = multer({ 
     storage: storage,
     limits: { fileSize: 50 * 1024 * 1024 }
});
const router = Router();

router.get('/products', getAllProducts);
router.post('/products', 
    authenticateTokenMiddleware,
    upload.single('productFile'),
    createProduct 
);

export default router;