import { Router } from 'express';
import { registerUser, loginUser, checkNicknameAvailability, checkEmailAvailability } from '../controllers/AuthController.js';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/check-nickname', checkNicknameAvailability);
router.post('/check-email', checkEmailAvailability);

export default router;