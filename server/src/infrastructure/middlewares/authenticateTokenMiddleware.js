import { supabase } from '../database/connection.js';

export const authenticateTokenMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // MODIFICADO: Bypass para rutas de descarga R2, links de orden y simulación de compra
    // Usamos originalUrl para que funcione aunque el router esté montado en un prefijo (ej: /api)
    const bypassRoutes = [
        '/r2/download-url',
        '/api/orders/download-link',
        '/api/test/simulate-purchase-email'
    ];
    
    if (bypassRoutes.some(route => req.originalUrl.includes(route))) {
        return next();
    }

    // Validar token: No solo null/undefined, sino también strings vacíos o literales 'undefined'/'null'
    if (!token || token === 'undefined' || token === 'null') {
        return res.status(401).json({ error: 'Acceso denegado: No se proporcionó token válido' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error) {
            // Reducir ruido en el log para errores de sesión comunes
            if (error.message && (error.message.includes('expired') || error.message.includes('missing'))) {
                console.warn(`[AuthMiddleware] ${error.message} para ${req.url}`);
            } else {
                console.error('❌ Supabase Auth Error checking token:', error.message);
            }
            throw new Error(error.message || 'Token inválido o expirado');
        }

        if (!user) {
            return res.status(403).json({ error: 'Acceso denegado: Token inválido' });
        }

        req.user = {
            id: user.id,
            userId: user.id,
            email: user.email,
        };

        next();

    } catch (error) {
        return res.status(403).json({ error: error.message || 'Acceso denegado: Token inválido' });
    }
};