import { Router } from 'express';
import { isAdminMiddleware } from '../../middlewares/isAdmin.middleware.js';
import { validateRequest } from '../../middlewares/validateRequest.middleware.js';
import { productSchema, paramIdSchema } from '../../validators/admin.validator.js';
import { getAllAdminProducts, getAllAdminOrders, getAllAdminUsers, createAdminProduct, updateAdminProduct, deleteAdminProduct } from '../controllers/AdminController.js';

const router = Router();

router.use(isAdminMiddleware);

router.get('/products', getAllAdminProducts);

router.get('/orders', getAllAdminOrders);

router.get('/users', getAllAdminUsers);

router.post('/products', validateRequest(productSchema, 'body'), createAdminProduct);

router.put('/products/:id', validateRequest(paramIdSchema, 'params'), validateRequest(productSchema, 'body'), updateAdminProduct);

router.delete('/products/:id', validateRequest(paramIdSchema, 'params'), deleteAdminProduct);

export default router;