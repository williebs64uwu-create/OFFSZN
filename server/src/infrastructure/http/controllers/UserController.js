import { supabase } from '../../database/connection.js';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';
import { syncUserToEmailOctopus, syncUserStatsToEmailOctopus } from '../../services/email-octopus.service.js';

export const getMyPurchasedProducts = async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select(`
                *, 
                orders!inner (user_id, status), 
                products (id, name, description, image_url, r2_version, download_url_mp3, download_url_wav, download_url_stems) 
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
        const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        const {
            nickname,
            role,
            firstName,
            lastName,
            socials,
            genres,
            daws,
            experience,
            goals,
            interests,
            source,
            paypalEmail,
            referralCode // Added referral code
        } = req.body;

        if (!nickname) {
            return res.status(400).json({ error: 'El nickname es obligatorio.' });
        }

        // 1. Check Nickname Availability
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

        // 2. Prepare Update Data
        const updateData = {
            nickname: nickname,
            ip_address: userIp // Log the IP
        };
        if (role) updateData.role = role;
        if (firstName) updateData.first_name = firstName;
        if (lastName) updateData.last_name = lastName;
        if (socials && typeof socials === 'object') updateData.socials = socials;
        if (genres) updateData.genres = genres;
        if (daws) updateData.daws = daws;
        if (experience) updateData.experience = experience;
        if (goals) updateData.goals = goals;
        if (interests) updateData.interests = interests;
        if (source) updateData.source = source;
        if (paypalEmail) updateData.paypal_email = paypalEmail;
        updateData.onboarding_completed = true;

        // Supabase Auth signup does not hit /api/register — grant welcome credits on first onboarding
        const WELCOME_CREDITS = 40;
        const { data: creditRow } = await supabase
            .from('users')
            .select('reward_balance, onboarding_completed')
            .eq('id', userId)
            .maybeSingle();

        const hadCompletedOnboarding = creditRow?.onboarding_completed === true;
        const currentCredits = creditRow?.reward_balance ?? 0;
        if (!hadCompletedOnboarding && currentCredits < WELCOME_CREDITS) {
            updateData.reward_balance = WELCOME_CREDITS;
        }

        const producerRoles = ['Productor Musical', 'Artista / Cantante', 'Compositor / Songwriter', 'Ingeniero de Mezcla/Master', 'Músico / Instrumentista', 'Otro Rol Musical'];
        updateData.is_producer = role ? producerRoles.includes(role) : false;

        // 3. Handle Referral Logic (If code provided)
        if (referralCode) {
            console.log(`[Referral] User ${userId} used code ${referralCode}`);

            // Validate Referral Code
            const { data: referrer, error: referrerError } = await supabase
                .from('users')
                .select('id, email, ip_address')
                .eq('referral_code', referralCode)
                .single();

            if (!referrerError && referrer) {
                // Security Checks
                const sameUser = referrer.id === userId;
                const sameIp = referrer.ip_address === userIp;

                // Robust VPN/Proxy Check (Headers)
                const isSuspicious =
                    req.headers['via'] ||
                    req.headers['forwarded'] ||
                    req.headers['x-real-ip'] ||
                    req.headers['proxy-client-ip'] ||
                    req.headers['wl-proxy-client-ip'] ||
                    (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',').length > 1);

                if (sameUser || sameIp || isSuspicious) {
                    let reason = '';
                    if (sameUser) reason = 'Self-referral';
                    else if (sameIp) reason = 'Same IP';
                    else if (isSuspicious) reason = 'VPN/Proxy detected';

                    console.warn(`[Referral] Blocked: ${reason} attempt by ${userId} for referrer ${referrer.id}`);

                    // Log failed attempt
                    const { error: insertError } = await supabase.from('referrals').insert([{
                        referrer_id: referrer.id,
                        referred_user_id: userId,
                        status: 'rejected',
                        failure_reason: reason
                    }]);
                    if (insertError) {
                        if (insertError.code !== '23505') console.error('[Referral] Error logging failure:', insertError);
                    }
                } else {
                    // Create Referral Record
                    const { error: refError } = await supabase
                        .from('referrals')
                        .insert([{
                            referrer_id: referrer.id,
                            referred_user_id: userId,
                            status: 'verified',
                            verified_at: new Date().toISOString()
                        }]);

                    if (!refError) {
                        console.log(`[Referral] Success: User ${userId} referred by ${referrer.id}`);

                        // Check 30 Referrals Trigger
                        const { count, error: countError } = await supabase
                            .from('referrals')
                            .select('*', { count: 'exact', head: true })
                            .eq('referrer_id', referrer.id)
                            .eq('status', 'verified');

                        if (!countError && count >= 30) {
                            // Logic for 30 referrals threshold
                            if (count === 30) {
                                console.log(`[Referral] Threshold: Referrer ${referrer.email} reached 30 referrals! Sending emails...`);

                                const emailHtml = `
                                    <div style="font-family: sans-serif; padding: 20px; background: #000; color: #fff; border-radius: 10px;">
                                        <h2 style="color: #fff; text-align: center;">🚀 ¡Meta de Referidos Alcanzada!</h2>
                                        <p>El usuario <strong>${referrer.email}</strong> ha alcanzado los <strong>30 referidos verificados</strong>.</p>
                                        <p>Por favor, verifica su cuenta y activa el plan Pro manualmente tras revisar la legitimidad de los referidos.</p>
                                        <hr style="border: 0; border-top: 1px solid #333; margin: 20px 0;">
                                        <p style="font-size: 12px; color: #aaa; text-align: center;">Sistema de Referidos Automático - OFFSZN Studio</p>
                                    </div>
                                `;

                                await Promise.all([
                                    sendOffsznEmail({ to: 'offszn.studio@gmail.com', subject: 'Meta 30 Referidos - OFFSZN', html: emailHtml, type: 'personal' }),
                                    sendOffsznEmail({ to: 'williebeatsyt@gmail.com', subject: 'Meta 30 Referidos - OFFSZN', html: emailHtml, type: 'personal' })
                                ]).catch(err => console.error('[Referral] Email error:', err));
                            }
                        }
                    } else if (refError.code !== '23505') {
                        console.error('[Referral] Error creating record:', refError);
                    }
                }
            } else {
                console.warn(`[Referral] Invalid code used: ${referralCode}`);
            }
        }

        // 4. Update User Profile
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select('*');

        if (updateError) throw updateError;

        res.status(200).json({
            message: 'Perfil completado exitosamente.',
            user: updatedUser[0],
            referralApplied: true // Always true even if ignored for security to avoid leaking info
        });

        // 🔄 SYNC TO EMAILOCTOPUS (Background)
        syncUserStatsToEmailOctopus(userId).catch(err => console.error('[EmailOctopus] Onboarding sync failed:', err));

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
            .select('id, email, nickname, role, first_name, last_name, created_at, is_admin, is_producer, paypal_email, r2_version, preferred_currency, plan, plan_start_date')
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
            paypalEmail,
            preferredCurrency
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
        if (preferredCurrency !== undefined) updateData.preferred_currency = preferredCurrency;

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

        // Check if identifier is a UUID (UUIDv4 pattern)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nickname);

        let query = supabase
            .from('users')
            .select('id, nickname, first_name, last_name, avatar_url, bio, role, socials, socials_order, is_verified, is_producer, created_at, experience, daws, banner_url, r2_version, storage_version, template, plan, plan_start_date');

        if (isUuid) {
            query = query.eq('id', nickname);
        } else {
            query = query.ilike('nickname', nickname);
        }

        const { data: user, error } = await query.maybeSingle();

        if (error) {
            console.error("❌ UserController DB Error:", error);
            throw error;
        }

        if (!user) {
            console.warn(`⚠️ UserController: '${nickname}' NO encontrado en DB.`);
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Fetch counts manually to ensure accuracy
        const [followersRes, productsRes, productStatsRes, ratingsRes] = await Promise.all([
            supabase.from('followers').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('products').select('*', { count: 'exact', head: true }).eq('producer_id', user.id).eq('status', 'approved').eq('visibility', 'public'),
            supabase.from('products').select('plays_count, sales_count, downloads_count, views_count').eq('producer_id', user.id).eq('status', 'approved'),
            supabase.from('profile_ratings').select('rating').eq('producer_id', user.id)
        ]);

        user.followers_count = followersRes.count || 0;
        user.products_count = productsRes.count || 0;
        
        const stats = productStatsRes.data || [];
        user.total_plays = stats.reduce((acc, curr) => acc + (curr.plays_count || 0), 0);
        user.total_sales = stats.reduce((acc, curr) => acc + (curr.sales_count || 0), 0);
        user.total_downloads = stats.reduce((acc, curr) => acc + (curr.downloads_count || 0), 0);

        const ratings = ratingsRes.data || [];
        user.total_ratings = ratings.length;
        user.average_rating = ratings.length > 0 
            ? parseFloat((ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length).toFixed(1)) 
            : 0;

        // 4. Calculate Ranking (Fair Algorithm)
        try {
            // Fetch all producers to calculate rank
            const { data: allProducers } = await supabase
                .from('users')
                .select('id, is_verified, banner_url, bio')
                .eq('is_producer', true);

            if (allProducers) {
                // Fetch stats for all producers
                const { data: allProductStats } = await supabase
                    .from('products')
                    .select('producer_id, views_count, plays_count, downloads_count, sales_count')
                    .eq('status', 'approved');

                const { data: allFollowers } = await supabase
                    .from('followers')
                    .select('user_id');

                const { data: allRatings } = await supabase
                    .from('profile_ratings')
                    .select('producer_id, rating');

                // Map data for fast access
                const followerCounts = {};
                allFollowers?.forEach(f => followerCounts[f.user_id] = (followerCounts[f.user_id] || 0) + 1);

                const prodStats = {};
                allProductStats?.forEach(ps => {
                    if (!prodStats[ps.producer_id]) prodStats[ps.producer_id] = { views: 0, plays: 0, downloads: 0, sales: 0, uploads: 0 };
                    prodStats[ps.producer_id].views += (ps.views_count || 0);
                    prodStats[ps.producer_id].plays += (ps.plays_count || 0);
                    prodStats[ps.producer_id].downloads += (ps.downloads_count || 0);
                    prodStats[ps.producer_id].sales += (ps.sales_count || 0);
                    prodStats[ps.producer_id].uploads += 1;
                });

                const ratingStats = {};
                allRatings?.forEach(r => {
                    if (!ratingStats[r.producer_id]) ratingStats[r.producer_id] = { total: 0, count: 0 };
                    ratingStats[r.producer_id].total += r.rating;
                    ratingStats[r.producer_id].count += 1;
                });

                // Calculate scores for everyone
                const leaderboard = allProducers.map(p => {
                    const stats = prodStats[p.id] || { views: 0, plays: 0, downloads: 0, sales: 0, uploads: 0 };
                    const fCount = followerCounts[p.id] || 0;
                    const rStat = ratingStats[p.id] || { total: 0, count: 0 };
                    const avgR = rStat.count > 0 ? rStat.total / rStat.count : 0;

                    let score = 0;
                    score += stats.views * 1;
                    score += stats.plays * 2;
                    score += stats.downloads * 20;
                    score += stats.sales * 50;
                    score += stats.uploads * 10;
                    score += fCount * 10;
                    score += avgR * 100; // Average rating bonus
                    if (p.is_verified) score += 100;
                    if (p.banner_url || (p.bio && p.bio.length > 10)) score += 50;

                    return { id: p.id, score };
                });

                leaderboard.sort((a, b) => b.score - a.score);
                const rank = leaderboard.findIndex(p => p.id === user.id) + 1;
                user.ranking = rank > 0 ? rank : 'N/A';
            }
        } catch (rankErr) {
            console.error("Error calculating rank:", rankErr);
            user.ranking = 'N/A';
        }

        console.log(`✅ UserController: Found '${user.nickname}' (ID: ${user.id}) | Followers: ${user.followers_count} | Sales: ${user.total_sales} | Rating: ${user.average_rating}`);
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
                    users!fk_collab_collaborator_public_users ( id, nickname, avatar_url, is_verified, r2_version, storage_version )
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
                r2_version: inv.users.r2_version || 'v1',
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
            .select('id, nickname, first_name, last_name, avatar_url, profile_cover:banner_url, bio, role, is_verified, genres, specialty, r2_version, storage_version', { count: 'exact' });

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
                .select('id, nickname, avatar_url, is_verified, r2_version, storage_version')
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
                        prod.producer_r2_version = producer.r2_version || 'v1';
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

export const getUsersBulk = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: 'Se requiere una lista de IDs de usuario.' });
        }

        const { data: users, error } = await supabase
            .from('users')
            .select('id, nickname, avatar_url, is_verified, is_producer, r2_version, storage_version, plan, plan_start_date')
            .in('id', ids);

        if (error) throw error;

        // Fetch counts for each user (Optional but good for hover cards)
        const countsPromises = users.map(async (u) => {
            const [followersRes, productsRes] = await Promise.all([
                supabase.from('followers').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
                supabase.from('products').select('*', { count: 'exact', head: true }).eq('producer_id', u.id).eq('status', 'approved').eq('visibility', 'public')
            ]);
            u.followers_count = followersRes.count || 0;
            u.products_count = productsRes.count || 0;
        });

        await Promise.all(countsPromises);

        res.status(200).json(users);
    } catch (err) {
        console.error("Error en getUsersBulk:", err.message);
        res.status(500).json({ error: 'Error al obtener información de usuarios' });
    }
};

export const rateProducerProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { producerId, rating, comment } = req.body;

        if (!producerId || !rating) {
            return res.status(400).json({ error: 'Faltan datos obligatorios (producerId, rating).' });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'La calificación debe estar entre 1 y 5.' });
        }

        // Check if rating self
        if (userId === producerId) {
            return res.status(400).json({ error: 'No puedes calificarte a ti mismo.' });
        }

        // 1. Check for 24-hour rate limit
        const { data: existingRating, error: fetchError } = await supabase
            .from('profile_ratings')
            .select('created_at')
            .eq('user_id', userId)
            .eq('producer_id', producerId)
            .single();

        if (existingRating) {
            const lastRated = new Date(existingRating.created_at);
            const now = new Date();
            const diffMs = now - lastRated;
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours < 24) {
                const remainingHours = Math.ceil(24 - diffHours);
                return res.status(429).json({ 
                    error: `Ya has calificado a este productor. Debes esperar ${remainingHours} ${remainingHours === 1 ? 'hora' : 'horas'} para volver a hacerlo.` 
                });
            }
        }

        // 2. Upsert rating (resets created_at to now)
        const { data, error } = await supabase
            .from('profile_ratings')
            .upsert({
                user_id: userId,
                producer_id: producerId,
                rating: rating,
                comment: comment || null,
                created_at: new Date().toISOString()
            }, { onConflict: 'user_id, producer_id' })
            .select();

        if (error) throw error;

        // 3. Send Notification to Producer
        try {
            // Fetch actor's nickname
            const { data: actorData } = await supabase
                .from('users')
                .select('nickname')
                .eq('id', userId)
                .single();

            const actorNickname = actorData?.nickname || 'Alguien';
            const stars = '⭐'.repeat(rating);

            await supabase.from('notifications').insert([{
                user_id: producerId,
                actor_id: userId,
                type: 'new_rating',
                title: 'Nueva Calificación',
                message: `<strong>${actorNickname}</strong> te ha dado una calificación de <strong>${rating}</strong> estrellas ${stars}`,
                link: `/@${actorNickname}`,
                data: { rating, rater_id: userId, rater_nickname: actorNickname },
                read: false
            }]);
        } catch (notifErr) {
            console.error("Error sending notification:", notifErr.message);
            // Don't fail the request if notification fails
        }

        res.status(200).json({
            message: 'Calificación enviada correctamente.',
            data: data[0]
        });

    } catch (err) {
        console.error("Error en rateProducerProfile:", err.message);
        res.status(500).json({ error: 'Error al procesar la calificación.' });
    }
};
