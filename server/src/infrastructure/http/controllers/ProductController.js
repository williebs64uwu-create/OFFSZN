import { supabase } from '../../database/connection.js';
//import { v4 as uuidv4 } from 'uuid';
//import path from 'path';

export const getAllProducts = async (req, res) => {
    try {
        // --- ¡CONSULTA CORREGIDA V3! (Usando el nombre de la Foreign Key) ---
        const { data, error } = await supabase
            .from('products')
            // Le decimos a Supabase que use la "relación" llamada 'products_producer_id_fkey'
            // para traer los datos de 'users'.
            .select(`
                *, 
                users!products_producer_id_fkey ( nickname, avatar_url, r2_version, storage_version ) 
            `)
            .eq('status', 'approved')
            .eq('visibility', 'public');

        if (error) {
            // Si esto vuelve a fallar, el error saldrá aquí
            console.error("Error en getAllProducts (JOIN v3):", error.message);
            throw error;
        }

        // --- APLANAR LOS DATOS ---
        // Con esta sintaxis, los datos del productor vienen en un objeto 'users'
        const formattedData = data.map(product => {
            const producerNickname = (product.users && product.users.nickname)
                ? product.users.nickname
                : 'Anónimo';

            const producerR2Version = (product.users && product.users.r2_version)
                ? product.users.r2_version
                : 'v1';

            const producerStorageVersion = (product.users && product.users.storage_version)
                ? product.users.storage_version
                : 'v1';

            const producerAvatarUrl = (product.users && product.users.avatar_url)
                ? product.users.avatar_url
                : null;

            const p = { ...product };
            delete p.users;

            return {
                ...p,
                id: String(p.id),
                producer_id: String(p.producer_id),
                producer_nickname: producerNickname,
                producer_r2_version: producerR2Version,
                producer_storage_version: producerStorageVersion,
                producer_avatar_url: producerAvatarUrl
            };
        });

        res.status(200).json(formattedData);

    } catch (err) {
        console.error("Error en getAllProducts (catch):", err.message);
        res.status(500).json({ error: err.message || 'Error al obtener los productos' });
    }
};

export const createProduct = async (req, res) => {
    try {
        const userId = req.user.userId;
        const {
            // Support both old formatted vars and new direct DB column names
            name, title,
            description,
            key,
            bpm,
            tags,
            genres,
            moods,
            is_free, isFree,
            licenses,
            price_basic, price_premium, price_stems, price_exclusive,
            image_url, artwork_url,
            mp3_url, audio_url,
            wav_url,
            stems_url,
            product_type,
            r2_version,
            release_date,
            visibility,
            status
        } = req.body;

        const finalTitle = name || title;
        const finalArtwork = image_url || artwork_url;
        const finalIsFree = is_free !== undefined ? is_free : (isFree || false);
        const finalMp3Url = mp3_url || audio_url;

        if (!finalTitle || !finalArtwork) {
            return res.status(400).json({ error: 'Faltan datos clave (título o portada).' });
        }
        // Si no es gratis, DEBE tener un MP3
        if (finalIsFree === false && !finalMp3Url) {
            return res.status(400).json({ error: 'Un producto de pago debe tener un archivo MP3 o Audio.' });
        }

        // 🔥 PLAN-BASED UPLOAD LIMIT ENFORCEMENT
        const PLAN_LIMITS = { free: 30, starter: 60, pro: Infinity };

        const { data: profile } = await supabase
            .from('profiles')
            .select('plan')
            .eq('id', userId)
            .single();

        const userPlan = profile?.plan || 'free';
        const maxLimit = PLAN_LIMITS[userPlan] || PLAN_LIMITS.free;

        if (maxLimit !== Infinity) {
            // Count all products + drafts
            const countTables = [
                supabase.from('products').select('*', { count: 'exact', head: true }).eq('producer_id', userId).neq('status', 'deleted'),
                supabase.from('beat_drafts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
                supabase.from('drumkit_drafts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
                supabase.from('loopkit_drafts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
                supabase.from('preset_drafts').select('*', { count: 'exact', head: true }).eq('user_id', userId)
            ];

            const results = await Promise.all(countTables);
            const totalCount = results.reduce((sum, r) => sum + (r.count || 0), 0);

            if (totalCount >= maxLimit) {
                return res.status(403).json({
                    error: `Has alcanzado el límite de ${maxLimit} productos para tu plan "${userPlan}". Mejora tu plan para subir más.`
                });
            }
        }

        const productData = {
            producer_id: userId,
            name: finalTitle,
            description: description || null,
            image_url: finalArtwork,
            product_type: product_type || 'beat',
            status: status || 'approved',
            bpm: bpm ? parseInt(bpm) : null,
            key: key || null,
            tags: tags || null,
            genres: genres || null,
            moods: moods || null,

            download_url_mp3: finalMp3Url,
            download_url_wav: wav_url || null,
            download_url_stems: stems_url || null,
            r2_version: r2_version || 'v1',
            storage_version: 'supabase', // Default to supabase for new high-quality uploads

            is_free: finalIsFree,
            price_basic: price_basic !== undefined ? price_basic : (licenses?.basic || null),
            price_premium: price_premium !== undefined ? price_premium : (licenses?.premium || null),
            price_stems: price_stems !== undefined ? price_stems : (licenses?.stems || null),
            price_exclusive: price_exclusive !== undefined ? price_exclusive : (licenses?.exclusive || null),
            
            release_date: release_date || null,
            visibility: visibility || 'public'
        };

        const { data: newProduct, error: insertError } = await supabase
            .from('products')
            .insert(productData)
            .select()
            .single();

        if (insertError) throw insertError;

        if (newProduct) {
            newProduct.id = String(newProduct.id);
            newProduct.producer_id = String(newProduct.producer_id);
        }

        res.status(201).json({ message: '¡Producto publicado exitosamente!', product: newProduct });

    } catch (err) {
        console.error("Error en createProduct:", err.message);
        if (err.code === '22P02') {
            return res.status(400).json({ error: 'Error en los datos enviados. Revisa los tipos de datos (ej: BPM debe ser un número).' });
        }
        res.status(500).json({ error: err.message || 'Error al crear el producto.' });
    }
};

// --- PLAY COUNT LOGIC (In-Memory Rate Limit) ---
const playRateLimit = new Map(); // Key: "IP:ProductID", Value: Timestamp

export const incrementPlayCount = async (req, res) => {
    try {
        const productId = req.params.id;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // --- HISTORY TRACKING (Auth Users) ---
        // Attempt to identify user via Token (Manual Cookie/Header parsing or req.user if middleware used)
        // Since this route is currently PUBLIC in routes (no middleware), we verify largely manually or check cookies.
        let userId = null;
        const authHeader = req.headers['authorization'];
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            if (token) {
                const { data: authData, error: authError } = await supabase.auth.getUser(token);
                if (authData && authData.user) userId = authData.user.id;
            }
        }

        if (userId) {
            // Log for History (Async - don't block response)
            (async () => {
                // Remove previous entry for this product to keep only "latest" view
                // Or just insert new one? Let's keep one entry per product per user for "Recently Played" list simplicity
                // Actually, history usually implies a list. If I play it twice, it goes to top.
                // DELETE old if exists, then INSERT new is a clean way to "Move to Top".
                try {
                    await supabase.from('listening_history').delete().match({ user_id: userId, product_id: productId });
                    await supabase.from('listening_history').insert({ user_id: userId, product_id: productId, played_at: new Date().toISOString() });
                } catch (e) {
                    console.error("History tracking error", e);
                }
            })();
        }

        // --- EXISTING VIEW COUNT LOGIC ---
        const limitKey = `${ip}:${productId}`;
        const now = Date.now();
        const COOLDOWN_MS = 300000; // 5 Minutes per IP per Product

        // 1. Rate Limit Check
        if (playRateLimit.has(limitKey)) {
            const lastPlay = playRateLimit.get(limitKey);
            if (now - lastPlay < COOLDOWN_MS) {
                // Too soon, ignore silently
                return res.status(200).json({ message: 'Play recorded (rate limited)', counted: false });
            }
        }

        // Update Timestamp
        playRateLimit.set(limitKey, now);

        // Simple cleanup if map gets too large
        if (playRateLimit.size > 5000) playRateLimit.clear();

        // 2. Database Update (Fetch -> Increment -> Update)
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('plays_count')
            .eq('id', productId)
            .single();

        if (fetchError) throw fetchError;

        const newCount = (product.plays_count || 0) + 1;

        const { error: updateError } = await supabase
            .from('products')
            .update({ plays_count: newCount })
            .eq('id', productId);

        if (updateError) throw updateError;

        res.status(200).json({ message: 'Play counted', views: newCount, counted: true });

    } catch (err) {
        console.error("Error incrementing play count:", err.message);
        res.status(500).json({ error: 'Error counting play' });
    }
};

// --- DOWNLOAD COUNT LOGIC (With Rate Limit) ---
const downloadRateLimit = new Map();

export const incrementDownloadCount = async (req, res) => {
    try {
        const productId = req.params.id;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // 1. Identify User (Optional for history)
        let userId = null;
        const authHeader = req.headers['authorization'];
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            if (token) {
                const { data: authData, error: authError } = await supabase.auth.getUser(token);
                if (authData && authData.user) userId = authData.user.id;
            }
        }

        // 2. IP Rate Limit (Cooldown 5 mins)
        const limitKey = `dl:${ip}:${productId}`;
        const now = Date.now();
        const COOLDOWN_MS = 300000;

        if (downloadRateLimit.has(limitKey)) {
            const lastDl = downloadRateLimit.get(limitKey);
            if (now - lastDl < COOLDOWN_MS) {
                return res.status(200).json({ message: 'Download recorded (rate limited)', counted: false });
            }
        }
        downloadRateLimit.set(limitKey, now);

        // 3. Increment in DB
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('downloads_count')
            .eq('id', productId)
            .single();

        if (fetchError) throw fetchError;

        const newCount = (product.downloads_count || 0) + 1;

        const { error: updateError } = await supabase
            .from('products')
            .update({ downloads_count: newCount })
            .eq('id', productId);

        if (updateError) throw updateError;

        // 4. Log in Download History (If we have a table, or just skip for now)
        // For now, we mainly ensure the products table is updated correctly.

        res.status(200).json({ message: 'Download counted', downloads_count: newCount, counted: true });

    } catch (err) {
        console.error("Error incrementing download count:", err.message);
        res.status(500).json({ error: 'Error counting download' });
    }
};

// --- VIEW COUNT LOGIC (Fixes direct Supabase 400 error) ---
const viewRateLimit = new Map();

export const incrementViewCount = async (req, res) => {
    try {
        const productId = req.params.id;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // 1. Rate Limit (Cooldown 1 minute)
        const limitKey = `vw:${ip}:${productId}`;
        const now = Date.now();
        const COOLDOWN_MS = 60000;

        if (viewRateLimit.has(limitKey)) {
            const lastView = viewRateLimit.get(limitKey);
            if (now - lastView < COOLDOWN_MS) {
                return res.status(200).json({ message: 'View recorded (rate limited)', counted: false });
            }
        }
        viewRateLimit.set(limitKey, now);

        // 2. Fetch Product to get current views & producer_id
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('views_count, producer_id')
            .eq('id', productId)
            .single();

        if (fetchError || !product) throw new Error("Producto no encontrado");

        // 3. Increment in DB
        const newCount = (product.views_count || 0) + 1;
        await supabase
            .from('products')
            .update({ views_count: newCount })
            .eq('id', productId);

        // 4. Log in page_views (for Analytics Dashboard)
        await supabase
            .from('page_views')
            .insert({
                user_id: product.producer_id,
                path: `/producto/${productId}`,
                viewed_at: new Date().toISOString()
            });

        res.status(200).json({ message: 'View counted', views_count: newCount, counted: true });

    } catch (err) {
        console.error("Error in incrementViewCount:", err.message);
        res.status(500).json({ error: 'Error logging view' });
    }
};