import { supabase } from '../../database/connection.js';

// Obtener perfil público de un usuario por nickname
export const getUserProfile = async (req, res) => {
    try {
        const { nickname } = req.params;
        console.log(`🔍 ProfileController: Buscando nickname '${nickname}'`);

        const { data: userData, error } = await supabase
            .from('users')
            .select(`
                id, 
                nickname, 
                first_name, 
                last_name, 
                avatar_url, 
                bio, 
                role, 
                socials, 
                is_verified, 
                is_producer, 
                created_at,
                followers:followers!followers_user_id_fkey(count),
                following:followers!followers_follower_id_fkey(count),
                products:products!products_producer_id_fkey(count)
            `)
            .ilike('nickname', nickname)
            .single();

        if (error) {
            console.error("❌ ProfileController Supabase Error:", error);
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Usuario no encontrado (0 rows)' });
            }
            if (error.code === 'PGRST301') { // 401 from DB?
                return res.status(401).json({ error: 'Unauthorized by DB (RLS?)' });
            }
            // Log full error
            console.log(JSON.stringify(error));
            throw error;
        }

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }
            throw error;
        }

        if (!userData) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Flatten counts
        const user = {
            ...userData,
            followers_count: userData.followers?.[0]?.count || 0,
            following_count: userData.following?.[0]?.count || 0,
            products_count: userData.products?.[0]?.count || 0
        };
        // Remove raw arrays 
        delete user.followers;
        delete user.following;
        delete user.products;

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
            .ilike('nickname', nickname)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Obtener productos aprobados del usuario junto con colaboradores aceptados
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
            .order('created_at', { ascending: false });

        if (productsError) throw productsError;

        // Process data to flatten collaborators
        const products = productsData.map(prod => {
            const acceptedCollabs = (prod.collab_invitations || [])
                .filter(inv => {
                    const s = (inv.status || '').toLowerCase().trim();
                    return s === 'accepted' && inv.users && inv.users.nickname;
                })
                .map(inv => ({
                    id: inv.users.id,
                    nickname: inv.users.nickname,
                    avatar_url: inv.users.avatar_url,
                    is_verified: inv.users.is_verified
                }));

            // Clean up the object to send clean JSON
            delete prod.collab_invitations;

            return {
                ...prod,
                collaborators: acceptedCollabs
            };
        });

        if (productsError) throw productsError;

        res.status(200).json(products || []);

    } catch (err) {
        console.error("Error en getUserProducts:", err.message);
        res.status(500).json({ error: err.message || 'Error al obtener productos' });
    }
};
