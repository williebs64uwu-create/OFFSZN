import { verifyToken } from '../auth/jwt/jwtUtil.js'; 
export const isAdminMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ error: 'Acceso denegado: No se proporcionó token' });
    }

    try {
        const userPayload = await verifyToken(token);

        if (!userPayload || userPayload.isAdmin !== true) {
            return res.status(403).json({ error: 'Acceso denegado: Permisos insuficientes (No eres administrador)' });
        }
        req.user = userPayload;
        next();

    } catch (error) {
        return res.status(403).json({ error: error.message || 'Acceso denegado: Token inválido o expirado' });
    }
};