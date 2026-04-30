import { supabase } from '../database/connection.js';

export const optionalAuthenticateTokenMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    try {
        // Token verificación (sin loggear fragmentos por seguridad)
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (!error && user) {
            // Usuario verificado exitosamente
            req.user = {
                userId: user.id,
                email: user.email,
            };
        } else if (error) {
            console.warn('[Auth] Token verification error:', error.message);
        }
        next();
    } catch (error) {
        console.error('[Auth] Trace error:', error.message);
        // Just proceed as guest
        next();
    }
};
