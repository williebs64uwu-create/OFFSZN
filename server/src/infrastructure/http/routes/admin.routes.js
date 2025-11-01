import { Router } from 'express';
import { isAdminMiddleware } from '../../middlewares/isAdmin.middleware.js';
import { getAllAdminProducts, getAllAdminOrders, getAllAdminUsers, createAdminProduct, updateAdminProduct, deleteAdminProduct } from '../controllers/AdminController.js';

const router = Router();

router.use(isAdminMiddleware);

router.get('/products', getAllAdminProducts);

router.get('/orders', getAllAdminOrders);

router.get('/users', getAllAdminUsers);

router.post('/products', createAdminProduct);

router.put('/products/:id', updateAdminProduct);

router.delete('/products/:id', deleteAdminProduct);

export default router;