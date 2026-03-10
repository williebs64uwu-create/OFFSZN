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
        const {
            nickname,
            role,
            firstName,
            lastName,
            socials,
            // New fields from onboarding
            genres,
            daws,
            experience,
            goals,
            interests,
            source,
            paypalEmail
        } = req.body;

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

        // Save new onboarding fields
        // Assumes columns exist in 'users' table or Supabase allows flexible schema if configured
        if (genres) updateData.genres = genres;
        if (daws) updateData.daws = daws;
        if (experience) updateData.experience = experience;
        if (goals) updateData.goals = goals;
        if (interests) updateData.interests = interests;
        if (source) updateData.source = source;
        if (paypalEmail) updateData.paypal_email = paypalEmail;

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
            .select('id, email, nickname, role, first_name, last_name, created_at, is_admin, socials, is_producer, paypal_email');

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
            .select('id, email, nickname, role, first_name, last_name, created_at, is_admin, is_producer, paypal_email')
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
            socials,
            paypalEmail
        } = req.body;

        // Construimos el objeto de actualización
        const updateData = {};

        // Solo añadimos los campos que el usuario envió
        if (firstName !== undefined) updateData.first_name = firstName;
        if (lastName !== undefined) updateData.last_name = lastName;
        if (nickname !== undefined) updateData.nickname = nickname;
        if (bio !== undefined) updateData.bio = bio; // Asumiendo que tienes una columna 'bio'
        if (socials !== undefined) updateData.socials = socials; // Asumiendo columna 'socials' (jsonb)
        if (paypalEmail !== undefined) updateData.paypal_email = paypalEmail;

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
        console.log(`🔎 UserController: Buscando '${nickname}'`);

        const { data: user, error } = await supabase
            .from('users')
            .select('id, nickname, first_name, last_name, avatar_url, bio, role, socials, socials_order, is_verified, is_producer, created_at, experience, daws, banner_url')
            .ilike('nickname', nickname)
            .maybeSingle();

        if (error) {
            console.error("❌ UserController DB Error:", error);
            throw error;
        }

        if (!user) {
            console.warn(`⚠️ UserController: '${nickname}' NO encontrado en DB.`);
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Fetch counts manually to ensure accuracy
        const [followersRes, productsRes] = await Promise.all([
            supabase.from('followers').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('products').select('*', { count: 'exact', head: true }).eq('producer_id', user.id).eq('status', 'approved').eq('visibility', 'public')
        ]);

        user.followers_count = followersRes.count || 0;
        user.products_count = productsRes.count || 0;

        console.log(`✅ UserController: Found '${user.nickname}' (ID: ${user.id}) | Followers: ${user.followers_count} | Products: ${user.products_count}`);
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

        const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select(`
                *,
                collab_invitations (
                    status,
                    users!fk_collab_collaborator_public_users ( id, nickname, avatar_url, is_verified )
                )
            `)
            .eq('producer_id', user.id)
            .eq('status', 'approved')
            .eq('visibility', 'public') // Only show public products on profile
            .order('created_at', { ascending: false });

        if (productsError) {
            throw new Error('Error al buscar productos: ' + productsError.message);
        }

        // Transform Data
        const products = productsData.map(prod => {
            // Map invitations to collaborators format (Source of Truth)
            const realCollabs = (prod.collab_invitations || []).map(inv => ({
                id: inv.users.id,
                nickname: inv.users.nickname,
                avatar_url: inv.users.avatar_url,
                is_verified: inv.users.is_verified,
                status: inv.status // Pass status so frontend can filter
            }));

            // Overwrite the JSONB column with real relational data
            const cleanProd = { ...prod };
            delete cleanProd.collab_invitations;
            cleanProd.collaborators = realCollabs;

            return cleanProd;
        });

        res.status(200).json(products);

    } catch (err) {
        console.error("Error en getProductsByNickname:", err.message);
        res.status(404).json({ error: err.message || 'Error al obtener datos' });
    }
};

export const getAllProducers = async (req, res) => {
    try {
        const { genre, specialty, search, sort = 'trending', role } = req.query;
        const limit = parseInt(req.query.limit) || 20;
        const page = parseInt(req.query.page) || 1;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('users')
            .select('id, nickname, first_name, last_name, avatar_url, profile_cover:banner_url, bio, role, is_verified, genres, specialty', { count: 'exact' });

        if (!role) {
            query = query.eq('is_producer', true);
        }

        if (genre) {
            query = query.contains('genres', [genre]);
        }
        if (specialty) {
            query = query.eq('specialty', specialty);
        }

        // --- Search Sanitization (Improved) ---
        // Splits by space and matches all keywords in nickname OR first_name OR last_name
        if (search && search.trim()) {
            const keywords = search.trim().split(/\s+/).filter(k => k.length > 0);
            if (keywords.length > 0) {
                // If single word, simple ilike. If multiple, we match ALL keywords.
                // Note: For simplicity and performance, we'll use single keyword logic or ilike nickname
                // but we can join them with .or() if we want "willie inspired" to match "willieinspired"
                // A better approach for "willie inspired" matches "willieinspired" is to remove spaces from nickname column in DB during comparison, 
                // but since we only have ilike here, we'll try to match parts.

                const terms = keywords.map(k => `nickname.ilike.%${k}%`);
                query = query.or(terms.join(','));
            }
        }

        // --- Role Filtering (Realistic & Accurate) ---
        if (role) {
            const roleList = role.split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
            if (roleList.length > 0) {
                const orParts = roleList.map(lowRole => {
                    if (lowRole === 'productores') {
                        return 'role.ilike.%Productor%';
                    } else if (lowRole === 'artistas') {
                        return 'role.ilike.%Artista%';
                    } else if (lowRole === 'compositores') {
                        return 'role.ilike.%Compositor%';
                    } else if (lowRole === 'ingenieros' || lowRole === 'ingenieros de mezcla/master') {
                        return 'role.ilike.%Ingeniero%';
                    } else if (lowRole === 'instrumentistas' || lowRole === 'instrumentista') {
                        return 'role.ilike.%Músico%,role.ilike.%Instrumentista%';
                    } else if (lowRole === 'oyentes' || lowRole === 'fan y consumidor' || lowRole === 'fan / consumidor') {
                        return 'role.ilike.%Fan%,role.ilike.%Consumidor%,role.ilike.%Oyente%';
                    }
                    return `role.ilike.%${lowRole}%`;
                });
                query = query.or(orParts.join(','));
            }
        }

        // Sorting Logic: Photo-First Rule
        // Push users without photos (avatar_url and banner_url) to the end
        // EXCEPTION: If sort is 'recent' or 'a-z', we prioritize chronology/alphabet over photos
        if (sort !== 'recent' && sort !== 'a-z') {
            query = query.order('avatar_url', { ascending: false, nullsFirst: false })
                .order('banner_url', { ascending: false, nullsFirst: false });
        }

        if (sort === 'a-z') {
            query = query.order('nickname', { ascending: true });
        } else if (sort === 'recent') {
            query = query.order('created_at', { ascending: false });
        } else if (sort === 'popular') {
            query = query.order('is_verified', { ascending: false }).order('created_at', { ascending: false });
        } else {
            // Trending/Default
            query = query.order('is_verified', { ascending: false }).order('created_at', { ascending: false });
        }

        const { data: producers, count, error } = await query
            .range(from, to);

        if (error) throw error;

        // --- BULK FETCH METADATA (Optimization to avoid 500/503 errors) ---
        const producerIds = producers.map(p => p.id);
        const [followersData, productsData] = await Promise.all([
            supabase.from('followers').select('user_id').in('user_id', producerIds),
            supabase.from('products').select('producer_id').in('producer_id', producerIds).eq('status', 'approved')
        ]);

        const followersCountMap = {};
        followersData.data?.forEach(f => {
            followersCountMap[f.user_id] = (followersCountMap[f.user_id] || 0) + 1;
        });

        const productsCountMap = {};
        productsData.data?.forEach(p => {
            productsCountMap[p.producer_id] = (productsCountMap[p.producer_id] || 0) + 1;
        });

        const formattedProducers = producers.map(p => ({
            ...p,
            followers_count: followersCountMap[p.id] || 0,
            products_count: productsCountMap[p.id] || 0
        }));

        res.status(200).json({
            producers: formattedProducers,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / limit)
        });
    } catch (err) {
        console.error("Error getAllProducers:", err.message);
        res.status(500).json({ error: 'Error al cargar productores' });
    }
};

export const getMyListenHistory = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Fetch history with product details
        const { data: history, error } = await supabase
            .from('listening_history')
            .select(`
                played_at,
                product_id,
                products!inner (
                    *
                )
            `)
            .eq('user_id', userId)
            .order('played_at', { ascending: false })
            .limit(50); // Limit to last 50 played

        if (error) throw error;

        // Simplify structure and fetch producer details manually if needed 
        // (Supabase deep join limitation sometimes, but let's try mapping first)

        // We need producer info (nickname) for the UI.
        // Let's gather producer IDs and fetch them efficiently.
        const productIds = [];
        const producerIds = new Set();
        const simplifiedList = history.map(item => {
            const p = item.products;
            if (p.producer_id) producerIds.add(p.producer_id);
            return {
                ...p,
                // Ensure product_id is always present (client uses this, not just 'id')
                product_id: String(item.product_id || p.id),
                id: String(p.id),    // Convert to string to prevent BigInt precision loss in JSON
                played_at: item.played_at
            };
        });

        if (producerIds.size > 0) {
            const { data: producers } = await supabase
                .from('users')
                .select('id, nickname, avatar_url, is_verified')
                .in('id', Array.from(producerIds));

            const producerMap = new Map();
            producers?.forEach(u => producerMap.set(u.id, u));

            // Attach producer info
            simplifiedList.forEach(prod => {
                if (prod.producer_id) {
                    const producer = producerMap.get(prod.producer_id);
                    if (producer) {
                        prod.producer_nickname = producer.nickname;
                        prod.producer_name = producer.nickname; // Add for StickyPlayer fallback
                        prod.producer_avatar = producer.avatar_url;
                        prod.producer_verified = producer.is_verified;
                        // Construct minimal user object for existing frontend helpers
                        prod.artist_users = producer; // Matches StickyPlayer.js expects
                    }
                }
            });
        }

        res.status(200).json(simplifiedList);

    } catch (err) {
        console.error("Error getMyListenHistory:", err.message);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
};

export const clearMyListenHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { error } = await supabase
            .from('listening_history')
            .delete()
            .eq('user_id', userId);

        if (error) throw error;
        res.status(200).json({ message: 'History cleared successfully' });
    } catch (e) {
        console.error('Clear history error:', e);
        res.status(500).json({ error: 'Failed to clear history' });
    }
};

// --- WELCOME COUPON LOGIC (Unique Server-Side Generation) ---
export const claimWelcomeCoupon = async (req, res) => {
    try {
        const userId = req.user.userId;

        // 1. Get User email
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('email')
            .eq('id', userId)
            .single();

        if (userError || !user) throw new Error("Usuario no encontrado");

        // 2. Check if already has a coupon
        const { data: existing, error: checkError } = await supabase
            .from('cupones_bienvenida_offszn')
            .select('*')
            .eq('email_offszn', user.email)
            .maybeSingle();

        if (existing) {
            return res.status(200).json({
                message: 'Cupón ya generado anteriormente',
                coupon: existing.codigo_offszn,
                status: existing.status_offszn
            });
        }

        // 3. Generate UNIQUE code
        let isUnique = false;
        let code = '';
        while (!isUnique) {
            code = 'OFFSZN' + Math.random().toString(36).substring(2, 6).toUpperCase();
            const { data: collision } = await supabase
                .from('cupones_bienvenida_offszn')
                .select('codigo_offszn')
                .eq('codigo_offszn', code)
                .maybeSingle();
            if (!collision) isUnique = true;
        }

        // 4. Record in DB
        const { error: insertError } = await supabase
            .from('cupones_bienvenida_offszn')
            .insert({
                email_offszn: user.email,
                codigo_offszn: code,
                status_offszn: 'unclaimed',
                created_at_offszn: new Date().toISOString()
            });

        if (insertError) throw insertError;

        res.status(201).json({
            message: 'Cupón de bienvenida generado!',
            coupon: code
        });

    } catch (err) {
        console.error("Error en claimWelcomeCoupon:", err.message);
        res.status(500).json({ error: 'Error al generar cupón' });
    }
};