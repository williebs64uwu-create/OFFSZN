import { supabase } from '../../database/connection.js';

export const getMyPurchasedProducts = async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select(`
                *, 
                orders!inner (user_id, status), 
                products (id, name, description, image_url, download_url_mp3, download_url_wav, download_url_stems) 
            `)
            .eq('orders.user_id', userId)
            .eq('orders.status', 'completed');

        if (itemsError) {
            throw itemsError;
        }

        const purchasedProductsMap = new Map();
        items.forEach(item => {
            if (item.products && !purchasedProductsMap.has(item.products.id)) {
                purchasedProductsMap.set(item.products.id, item.products);
            }
        });
        const uniquePurchasedProducts = Array.from(purchasedProductsMap.values());

        res.status(200).json(uniquePurchasedProducts);

    } catch (err) {
        console.error("Error en getMyPurchasedProducts:", err.message);
        res.status(500).json({ error: err.message || 'Error al obtener los productos comprados' });
    }
};

export const completeOnboarding = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { nickname, role, firstName, lastName, socials } = req.body;

        if (!nickname) {
            return res.status(400).json({ error: 'El nickname es obligatorio.' });
        }

        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('nickname', nickname)
            .neq('id', userId)
            .maybeSingle();

        if (checkError) throw checkError;
        if (existingUser) {
            return res.status(409).json({ error: 'Ese nickname ya está en uso. Elige otro.' });
        }

        const updateData = { nickname: nickname };
        if (role) updateData.role = role;
        if (firstName) updateData.first_name = firstName;
        if (lastName) updateData.last_name = lastName;
        if (socials && typeof socials === 'object' && Object.keys(socials).length > 0) {
            updateData.socials = socials;
        }

        const producerRoles = ['Productor', 'Artista', 'Compositor', 'Ingeniero', 'Musico'];

        if (role && producerRoles.includes(role)) {
            updateData.is_producer = true;
        } else {
            updateData.is_producer = false;
        }

        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select('id, email, nickname, role, first_name, last_name, created_at, is_admin, socials, is_producer');

        if (updateError) throw updateError;
        if (!updatedUser || updatedUser.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado para actualizar.' });
        }


        res.status(200).json({ message: 'Perfil completado exitosamente.', user: updatedUser[0] });

    } catch (err) {
        console.error("Error en completeOnboarding:", err.message);
        res.status(500).json({ error: err.message || 'Error al completar el perfil.' });
    }
};

export const getCurrentUser = async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, nickname, role, first_name, last_name, created_at, is_admin, is_producer')
            .eq('id', userId)
            .single();

        if (error) throw error;
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

        res.status(200).json(user);

    } catch (err) {
        console.error("Error en getCurrentUser:", err.message);
        res.status(500).json({ error: err.message || 'Error al obtener datos del usuario.' });
    }
};

export const getMyProducts = async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('producer_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.status(200).json(data || []);

    } catch (err) {
        console.error("Error en getMyProducts:", err.message);
        res.status(500).json({ error: err.message || 'Error al obtener mis productos' });
    }
};

export const updateMyProfile = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Obtenemos los datos del formulario de "Información Personal"
        const {
            firstName,
            lastName,
            nickname,
            bio,
            socials // También podemos manejar las redes sociales aquí
        } = req.body;

        // Construimos el objeto de actualización
        const updateData = {};

        // Solo añadimos los campos que el usuario envió
        if (firstName !== undefined) updateData.first_name = firstName;
        if (lastName !== undefined) updateData.last_name = lastName;
        if (nickname !== undefined) updateData.nickname = nickname;
        if (bio !== undefined) updateData.bio = bio; // Asumiendo que tienes una columna 'bio'
        if (socials !== undefined) updateData.socials = socials; // Asumiendo columna 'socials' (jsonb)

        // Validar que el nickname no esté en uso por OTRO usuario
        if (nickname) {
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('id')
                .eq('nickname', nickname)
                .neq('id', userId) // .neq() = Not Equal (que no sea yo mismo)
                .maybeSingle();

            if (checkError) throw checkError;
            if (existingUser) {
                return res.status(409).json({ error: 'Ese nickname ya está en uso. Elige otro.' });
            }
        }

        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select(); // Devuelve el perfil actualizado

        if (updateError) throw updateError;
        if (!updatedUser || updatedUser.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado para actualizar.' });
        }

        // ¡Importante! Actualizamos el caché del usuario en el frontend
        // Enviando los nuevos datos.
        res.status(200).json({
            message: 'Perfil actualizado exitosamente.',
            user: updatedUser[0]
        });

    } catch (err) {
        console.error("Error en updateMyProfile:", err.message);
        res.status(500).json({ error: err.message || 'Error al actualizar el perfil.' });
    }
};

export const getUserByNickname = async (req, res) => {
    try {
        const { nickname } = req.params;

        const { data: user, error } = await supabase
            .from('users')
            .select('id, nickname, first_name, last_name, bio, socials, created_at')
            .eq('nickname', nickname)
            .single();

        if (error || !user) {
            throw new Error('Usuario no encontrado');
        }

        res.status(200).json(user);

    } catch (err) {
        console.error("Error en getUserByNickname:", err.message);
        res.status(404).json({ error: err.message || 'Usuario no encontrado' });
    }
};

export const getProductsByNickname = async (req, res) => {
    try {
        const { nickname } = req.params;

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('nickname', nickname)
            .single();

        if (userError || !user) {
            throw new Error('Usuario no encontrado');
        }

        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('*')
            .eq('producer_id', user.id)
            .eq('status', 'approved');

        if (productsError) {
            throw new Error('Error al buscar productos: ' + productsError.message);
        }

        res.status(200).json(products);

    } catch (err) {
        console.error("Error en getProductsByNickname:", err.message);
        res.status(404).json({ error: err.message || 'Error al obtener datos' });
    }
};

export const getAllProducers = async (req, res) => {
    try {
        const { data: producers, error } = await supabase
            .from('users')
            .select('id, nickname, first_name, last_name, avatar_url, bio, role')
            .eq('is_producer', true) // Asegúrate de tener esta columna o filtra por rol
            .limit(20); // Limitamos para no cargar miles

        if (error) throw error;

        res.status(200).json(producers);
    } catch (err) {
        console.error("Error getAllProducers:", err.message);
        res.status(500).json({ error: 'Error al cargar productores' });
    }
};