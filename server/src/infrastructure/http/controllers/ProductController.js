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
                users!products_producer_id_fkey ( nickname ) 
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

            // Creamos un nuevo objeto limpio para el frontend
            delete product.users; // Quitamos el objeto anidado 'users'

            return {
                ...product,
                producer_nickname: producerNickname
            };
        });

        res.status(200).json(formattedData); // Enviamos la data formateada

    } catch (err) {
        console.error("Error en getAllProducts (catch):", err.message);
        res.status(500).json({ error: err.message || 'Error al obtener los productos' });
    }
};

export const createProduct = async (req, res) => {
    try {
        const userId = req.user.userId;
        const {
            title,
            description,
            key,
            bpm,
            tags,
            genres,
            moods,
            isFree,
            licenses,
            artwork_url,
            mp3_url,
            wav_url,
            stems_url,
            product_type
        } = req.body;
        //const productFile = req.file;

        if (!title || !genres || !artwork_url) {
            return res.status(400).json({ error: 'Faltan datos clave (título, género o portada).' });
        }
        // Si no es gratis, DEBE tener un MP3
        if (isFree === false && !mp3_url) {
            return res.status(400).json({ error: 'Un producto de pago debe tener un archivo MP3.' });
        }

        const productData = {
            producer_id: userId,
            name: title,
            description: description || null,
            image_url: artwork_url,
            product_type: product_type || 'beat',
            status: 'approved',
            bpm: bpm ? parseInt(bpm) : null,
            key: key || null,
            tags: tags || null,
            genres: genres || null,
            moods: moods || null,

            download_url_mp3: mp3_url,
            download_url_wav: wav_url || null,
            download_url_stems: stems_url || null,

            is_free: isFree,
            price_basic: licenses?.basic || null,
            price_premium: licenses?.premium || null,
            price_stems: licenses?.stems || null,
            price_exclusive: licenses?.exclusive || null
        };

        const { data: newProduct, error: insertError } = await supabase
            .from('products')
            .insert(productData)
            .select()
            .single();

        if (insertError) throw insertError;

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
                    await supabase.from('listening_history').insert({ user_id: userId, product_id: productId, played_at: new Date() });
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
            .select('views')
            .eq('id', productId)
            .single();

        if (fetchError) throw fetchError;

        const newCount = (product.views || 0) + 1;

        const { error: updateError } = await supabase
            .from('products')
            .update({ views: newCount })
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