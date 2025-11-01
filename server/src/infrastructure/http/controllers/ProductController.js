import { supabase } from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export const getAllProducts = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*'); 

        if (error) {
            throw error;
        }

        res.status(200).json(data);

    } catch (err) {
        console.error("Error en getAllProducts:", err.message);
        res.status(500).json({ error: err.message || 'Error al obtener los productos' });
    }
};

export const createProduct = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, description, price_usd, price_pen, product_type, bpm, key, tags } = req.body;
        const productFile = req.file;

        if (!name || !price_usd || !product_type || !productFile) {
            return res.status(400).json({ error: 'Nombre, precio USD, tipo y archivo son requeridos.' });
        }
        if (isNaN(parseFloat(price_usd)) || parseFloat(price_usd) < 0) {
             return res.status(400).json({ error: 'Precio USD inválido.' });
        }

        const fileExt = path.extname(productFile.originalname);
        const fileName = `${uuidv4()}${fileExt}`;
        const filePath = `${userId}/${fileName}`; 

        console.log(`Subiendo archivo a Storage: ${filePath}`);

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('product_files')
            .upload(filePath, productFile.buffer, {
                contentType: productFile.mimetype,
            });

        if (uploadError) {
            console.error("Error al subir a Supabase Storage:", uploadError);
            throw new Error('Error al subir el archivo del producto.');
        }
         if (!uploadData || !uploadData.path) {
             throw new Error('La subida del archivo no devolvió una ruta válida.');
         }

        console.log("Archivo subido exitosamente:", uploadData);

        const { data: urlData } = supabase.storage
             .from('product_files')
             .getPublicUrl(filePath);
             
        const fileUrl = urlData?.publicUrl || '';
         if (!fileUrl) {
              console.warn("No se pudo obtener la URL pública del archivo. ¿El bucket es público?");
         }

        const productData = {
            producer_id: userId,
            name: name,
            description: description || null,
            price_usd: parseFloat(price_usd),
            price_pen: price_pen ? parseFloat(price_pen) : null,
            product_type: product_type,
            bpm: bpm ? parseInt(bpm) : null,
            key: key || null,
            tags: tags ? tags.split(',').map(t => t.trim()) : null,
            image_url: req.body.image_url || null,
            download_url: fileUrl,
            status: 'pending'
        };

        const { data: newProduct, error: insertError } = await supabase
            .from('products')
            .insert(productData)
            .select()
            .single();

        if (insertError) {
            console.error("Error al guardar producto en BD:", insertError);
            throw new Error('Error al guardar la información del producto.');
        }

        res.status(201).json({ message: 'Producto subido exitosamente. Pendiente de aprobación.', product: newProduct });

    } catch (err) {
        console.error("Error en createProduct:", err.message);
        res.status(500).json({ error: err.message || 'Error al subir el producto.' });
    }
};