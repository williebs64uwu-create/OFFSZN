import { supabase } from '../../database/connection.js';

export const validateCoupon = async (req, res) => {
    try {
        const { code, subtotal, cartItems } = req.body;

        if (!code) {
            return res.status(400).json({ valid: false, message: 'Falta el código del cupón.' });
        }

        const { data: coupon, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('code', code.toUpperCase())
            .single();

        if (error || !coupon) {
            // Check Welcome Coupons Table
            const { data: welcome, error: welcomeError } = await supabase
                .from('cupones_bienvenida_offszn')
                .select('*')
                .eq('codigo_offszn', code.toUpperCase())
                .eq('status_offszn', 'unclaimed')
                .maybeSingle();

            if (!welcomeError && welcome) {
                return res.status(200).json({
                    valid: true,
                    discount_percent: 10,
                    applies_to: 'all',
                    message: 'Cupón de bienvenida aplicado.'
                });
            }

            // Legacy check for pattern
            if (code.toUpperCase().startsWith('OFFSZN-')) {
                return res.status(200).json({
                    valid: true,
                    discount_percent: 10,
                    applies_to: 'all',
                    message: 'Cupón de bienvenida aplicado.'
                });
            }
            return res.status(200).json({ valid: false, message: 'Cupón no encontrado o inválido.' });
        }

        const now = new Date();
        const from = coupon.valid_from ? new Date(coupon.valid_from) : null;
        const to = coupon.valid_to ? new Date(coupon.valid_to) : null;

        if (from && now < from) return res.status(200).json({ valid: false, message: 'El cupón aún no es válido.' });
        if (to && now > to) return res.status(200).json({ valid: false, message: 'El cupón ha expirado.' });

        if (coupon.uses_limit && coupon.times_used >= coupon.uses_limit) {
            return res.status(200).json({ valid: false, message: 'El cupón ha alcanzado su límite de usos.' });
        }

        if (coupon.min_purchase_amount && subtotal < coupon.min_purchase_amount) {
            return res.status(200).json({ valid: false, message: `Este cupón requiere una compra mínima de $${coupon.min_purchase_amount}.` });
        }

        // Return coupon details for frontend to calculate
        return res.status(200).json({
            valid: true,
            id: coupon.id,
            discount_percent: coupon.discount_percent,
            discount_amount: coupon.discount_amount,
            applies_to: coupon.applies_to,
            specific_products: coupon.specific_products,
            message: 'Cupón aplicado correctamente.'
        });

    } catch (err) {
        console.error('[CouponValidate] Error:', err);
        res.status(500).json({ valid: false, message: 'Error interno al validar el cupón.' });
    }
};
