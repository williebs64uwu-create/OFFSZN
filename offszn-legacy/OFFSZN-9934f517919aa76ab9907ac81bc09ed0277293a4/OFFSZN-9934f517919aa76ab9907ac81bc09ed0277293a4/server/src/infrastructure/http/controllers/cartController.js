import { supabase } from '../../database/connection.js';

export const addItemToCart = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { productId, quantity = 1 } = req.body;

        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        const { data, error } = await supabase
            .from('cart_items')
            .insert({ user_id: userId, product_id: productId, quantity: quantity })
            .select();

        if (error && error.code === '23505') {
            return res.status(409).json({ error: 'Item already in cart' });
        } else if (error) {
            throw error;
        }

        res.status(201).json({ message: 'Item added to cart', item: data[0] });

    } catch (err) {
        console.error("Error en addItemToCart:", err.message);
        res.status(500).json({ error: err.message || 'Error adding item to cart' });
    }
};

export const getCart = async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data: cartItems, error } = await supabase
            .from('cart_items')
            .select(`id, quantity, products (id, name, price, image_url)`)
            .eq('user_id', userId);

        if (error) {
            throw error;
        }

        const formattedCart = cartItems.map(item => ({
            cartItemId: item.id,
            quantity: item.quantity,
            product: item.products 
        }));

        res.status(200).json(formattedCart);

    } catch (err) {
        console.error("Error en getCart:", err.message);
        res.status(500).json({ error: err.message || 'Error fetching cart contents' });
    }
};

export const removeItemFromCart = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { cartItemId } = req.params;

        if (!cartItemId) {
             return res.status(400).json({ error: 'Cart Item ID is required in URL parameter.' });
        }

        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('user_id', userId)
            .eq('id', cartItemId);

        if (error) {
            throw error;
        }

        res.status(200).json({ message: 'Item removed from cart' });

    } catch (err) {
        console.error("Error en removeItemFromCart:", err.message);
        res.status(500).json({ error: err.message || 'Error removing item from cart' });
    }
};