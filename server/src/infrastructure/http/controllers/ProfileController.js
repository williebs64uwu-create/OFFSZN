import { supabase } from '../../database/connection.js';

// Obtener perfil público de un usuario por nickname
export const getUserProfile = async (req, res) => {
    try {
        const { nickname } = req.params;

        const { data: user, error } = await supabase
            .from('users')
            .select('id, nickname, first_name, last_name, avatar_url, bio, role, socials, is_verified, created_at')
            .eq('nickname', nickname)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }
            throw error;
        }

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.status(200).json(user);

    } catch (err) {
        console.error("Error en getUserProfile:", err.message);
        res.status(500).json({ error: err.message || 'Error al obtener el perfil' });
    }
};

// Obtener productos públicos de un usuario
export const getUserProducts = async (req, res) => {
    try {
        const { nickname } = req.params;

        // Primero obtener el user_id desde el nickname
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('nickname', nickname)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Obtener productos aprobados del usuario
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('*')
            .eq('producer_id', user.id)
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        if (productsError) throw productsError;

        res.status(200).json(products || []);

    } catch (err) {
        console.error("Error en getUserProducts:", err.message);
        res.status(500).json({ error: err.message || 'Error al obtener productos' });
    }
};
