import { supabase } from '../database/connection.js';

export const optionalAuthenticateTokenMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    try {
        console.log('[Auth] Verifying token:', token.substring(0, 10) + '...');
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (!error && user) {
            console.log('[Auth] User verified:', user.email);
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
