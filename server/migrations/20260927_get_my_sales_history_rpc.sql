-- ============================================================
-- OFFSZN - RPC: get_my_sales_history
-- Permite a un productor consultar el historial de ventas de sus productos
-- con los emails de compradores (guest_email o users.email) de forma
-- 100% segura mediante SECURITY DEFINER y filtrado por auth.uid().
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_sales_history()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_sales jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    INTO v_sales
    FROM (
        SELECT 
            oi.id,
            oi.price_at_purchase,
            oi.created_at,
            jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'producer_id', p.producer_id
            ) AS product,
            jsonb_build_object(
                'id', o.id,
                'transaction_id', o.transaction_id,
                'status', o.status,
                'user_id', o.user_id,
                'guest_email', COALESCE(o.guest_email, u.email),
                'buyer', jsonb_build_object(
                    'nickname', u.nickname,
                    'email', COALESCE(u.email, o.guest_email)
                )
            ) AS "order"
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN users u ON u.id = o.user_id
        WHERE p.producer_id = v_user_id
        ORDER BY oi.created_at DESC
    ) item;

    RETURN v_sales;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_sales_history() TO authenticated;
NOTIFY pgrst, 'reload schema';
