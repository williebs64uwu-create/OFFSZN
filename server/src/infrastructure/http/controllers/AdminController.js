import { supabase } from '../../database/connection.js'; 

export const getAllAdminProducts = async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').select('*');
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    console.error("Error en getAllAdminProducts:", err.message);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

export const getAllAdminOrders = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, created_at, paypal_order_id, status, total_price,
        users ( email ), 
        order_items ( quantity, price_at_purchase, products ( name ) )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    console.error("Error en getAllAdminOrders:", err.message);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
};

export const getAllAdminUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, created_at, email, first_name, last_name, is_admin');
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    console.error("Error en getAllAdminUsers:", err.message);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

export const createAdminProduct = async (req, res) => {
    try {
        const { name, description, price, image_url, download_url } = req.body;

        if (!name || !description || !price || !image_url || !download_url) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }
        if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
             return res.status(400).json({ error: 'El precio debe ser un número válido.' });
        }

        const { data, error } = await supabase
            .from('products')
            .insert({
                name: name,
                description: description,
                price: parseFloat(price), 
                image_url: image_url,
                download_url: download_url
            })
            .select() 
            .single();

        if (error) {
            throw error;
        }

        res.status(201).json({ message: 'Producto creado exitosamente', product: data });

    } catch (err) {
        console.error("Error en createAdminProduct:", err.message);
        res.status(500).json({ error: err.message || 'Error al crear el producto' });
    }
};

export const updateAdminProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, image_url, download_url } = req.body;

        if (!name || !description || !price || !image_url || !download_url) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }
         if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
             return res.status(400).json({ error: 'El precio debe ser un número válido.' });
        }
         if (!id) {
            return res.status(400).json({ error: 'Se requiere el ID del producto.' });
         }


        const { data, error } = await supabase
            .from('products')
            .update({
                name: name,
                description: description,
                price: parseFloat(price),
                image_url: image_url,
                download_url: download_url
            })
            .eq('id', id) 
            .select() 
            .single();

        if (error) {
             if (error.code === 'PGRST204') { 
                 return res.status(404).json({ error: 'Producto no encontrado.' });
             }
            throw error;
        }
         if (!data) {
              return res.status(404).json({ error: 'Producto no encontrado.' });
         }


        res.status(200).json({ message: 'Producto actualizado exitosamente', product: data });

    } catch (err) {
        console.error("Error en updateAdminProduct:", err.message);
        res.status(500).json({ error: err.message || 'Error al actualizar el producto' });
    }
};

export const deleteAdminProduct = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'Se requiere el ID del producto.' });
        }

        const { error, count } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) {
            throw error;
        }

        res.status(200).json({ message: 'Producto eliminado exitosamente' });

    } catch (err) {
        console.error("Error en deleteAdminProduct:", err.message);
         if (err.code === '23503') { 
             return res.status(409).json({ error: 'No se puede eliminar el producto porque está referenciado en pedidos existentes.' }); // 409 Conflict
         }
        res.status(500).json({ error: err.message || 'Error al eliminar el producto' });
    }
};