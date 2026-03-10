import { Router } from 'express';
import { registerUser, loginUser, checkNicknameAvailability, checkEmailAvailability } from '../controllers/AuthController.js';
import { validateRequest } from '../../middlewares/validateRequest.middleware.js';
import { authLimiter } from '../../middlewares/rateLimiter.middleware.js';
import {
    registerSchema,
    loginSchema,
    checkEmailSchema,
    checkNicknameSchema
} from '../../validators/auth.validator.js';

const router = Router();

// Aplica limitador estricto (15 reqs/15 min) a to-das las rutas de autenticación
router.use(authLimiter);

router.post('/register', validateRequest(registerSchema), registerUser);
router.post('/login', validateRequest(loginSchema), loginUser);
router.post('/check-nickname', validateRequest(checkNicknameSchema), checkNicknameAvailability);
router.post('/check-email', validateRequest(checkEmailSchema), checkEmailAvailability);

export default router;