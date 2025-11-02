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
            .eq('status', 'approved');

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