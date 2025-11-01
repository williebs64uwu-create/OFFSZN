import { verifyToken } from '../auth/jwt/jwtUtil.js';

export const authenticateTokenMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ error: 'Acceso denegado: No se proporcionó token' });
    }

    try {
        const userPayload = await verifyToken(token); 
        req.user = userPayload;
        next();
    } catch (error) {
        return res.status(403).json({ error: error.message || 'Acceso denegado: Token inválido' });
    }
};