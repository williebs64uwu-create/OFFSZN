import { supabase } from '../database/connection.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../shared/config/config.js';

export const authenticateTokenMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // Bypass para rutas de descarga R2, links de orden, simulación y calendario
    const bypassRoutes = [
        '/r2/download-url',
        '/api/orders/download-link',
        '/api/test/simulate-purchase-email',
        '/api/content-calendar'
    ];
    
    if (bypassRoutes.some(route => req.originalUrl.includes(route))) {
        return next();
    }

    if (!token || token === 'undefined' || token === 'null') {
        return res.status(401).json({ error: 'Acceso denegado: No se proporcionó token válido' });
    }

    try {
        let user = null;

        // 🚀 FASE 1: Verificación de JWT Local (Super rápida ~0.1ms)
        if (JWT_SECRET) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                // Supabase JWT claims include sub (user id) and email
                if (decoded && decoded.sub) {
                    user = {
                        id: decoded.sub,
                        userId: decoded.sub,
                        email: decoded.email || ''
                    };
                    // console.log('⚡ [Auth] JWT Verificado localmente en 0ms');
                }
            } catch (jwtError) {
                if (jwtError.name === 'TokenExpiredError') {
                    throw new Error('Token expirado');
                } else if (jwtError.name === 'JsonWebTokenError') {
                    // Si el secret no coincide o el token está mal formado, 
                    // caemos en el fallback seguro (Supabase de red)
                    console.warn(`⚠️ [AuthMiddleware] JWT Local Verify falló (¿Secret incorrecto?). Fallback a Supabase Red.`);
                }
            }
        }

        // 🛡️ FALLBACK: Validación por red con Supabase (Segura pero lenta ~100ms)
        if (!user) {
            const { data, error } = await supabase.auth.getUser(token);
            if (error) {
                if (error.message && (error.message.includes('expired') || error.message.includes('missing'))) {
                    console.warn(`[AuthMiddleware] ${error.message} para ${req.url}`);
                } else {
                    console.error('❌ Supabase Auth Error checking token:', error.message);
                }
                throw new Error(error.message || 'Token inválido o expirado');
            }
            if (!data.user) throw new Error('Token inválido');
            
            user = {
                id: data.user.id,
                userId: data.user.id,
                email: data.user.email
            };
        }

        req.user = user;
        next();

    } catch (error) {
        return res.status(403).json({ error: error.message || 'Acceso denegado: Token inválido' });
    }
};