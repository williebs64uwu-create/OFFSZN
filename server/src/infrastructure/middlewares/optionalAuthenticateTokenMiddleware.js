import { supabase } from '../database/connection.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../shared/config/config.js';

export const optionalAuthenticateTokenMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || token === 'undefined' || token === 'null') {
        return next();
    }

    try {
        let user = null;

        // 🚀 FASE 1: Verificación Local
        if (JWT_SECRET) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                if (decoded && decoded.sub) {
                    user = {
                        userId: decoded.sub,
                        email: decoded.email || ''
                    };
                }
            } catch (jwtError) {
                // If it fails, we ignore it and let the fallback handle it
            }
        }

        // 🛡️ FALLBACK: Validación por red
        if (!user) {
            const { data, error } = await supabase.auth.getUser(token);
            if (!error && data.user) {
                user = {
                    userId: data.user.id,
                    email: data.user.email,
                };
            } else if (error) {
                console.warn('[OptionalAuth] Token verification error:', error.message);
            }
        }

        if (user) {
            req.user = user;
        }

        next();
    } catch (error) {
        console.error('[OptionalAuth] Trace error:', error.message);
        // Just proceed as guest
        next();
    }
};
