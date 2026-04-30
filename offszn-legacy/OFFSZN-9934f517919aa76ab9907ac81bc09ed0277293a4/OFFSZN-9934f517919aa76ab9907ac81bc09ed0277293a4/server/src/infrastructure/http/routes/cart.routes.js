import { Router } from 'express';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js'; 
import { addItemToCart, getCart, removeItemFromCart } from '../controllers/cartController.js'; 

const router = Router();

router.use(authenticateTokenMiddleware); 

router.post('/cart', addItemToCart);
router.get('/cart', getCart);
router.delete('/cart/:cartItemId', removeItemFromCart);

export default router;