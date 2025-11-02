import { supabase } from '../database/connection.js';

export const authenticateTokenMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ error: 'Acceso denegado: No se proporcionó token' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error) {
            console.error('Error de Supabase al verificar token:', error.message);
            throw new Error('Token inválido o expirado');
        }

        if (!user) {
             return res.status(403).json({ error: 'Acceso denegado: Token inválido' });
        }
        
        req.user = { 
            userId: user.id,
            email: user.email,
        };
        
        next();

    } catch (error) {
        return res.status(403).json({ error: error.message || 'Acceso denegado: Token inválido' });
    }
};