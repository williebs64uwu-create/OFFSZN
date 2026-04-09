-- Simulación de Orden de Prueba para Checkout Success (v2)
-- Producto: Engualichaste (ID 618)
-- Precio: $10.00
-- Objetivo: Verificar Navbar modular, precio correcto y lógica de "No Licencia".

DO $$ 
DECLARE 
    v_order_id BIGINT;
    v_product_id BIGINT := 618; -- Engualichaste Preset
    v_producer_id UUID;
    v_transaction_id TEXT := 'SIMULATED_TEST_' || floor(random() * 1000000)::text;
BEGIN
    -- 1. Obtener el productor del producto
    SELECT producer_id INTO v_producer_id FROM public.products WHERE id = v_product_id;
    
    -- 2. Crear la orden con las columnas CORRECTAS
    INSERT INTO public.orders (
        user_id, 
        transaction_id, 
        status, 
        total_price, 
        producer_id,
        product_id,
        amount,
        guest_email,
        created_at
    )
    VALUES (
        NULL, -- Simular Guest para probar si detecta sesión del navegador via auth_utils
        v_transaction_id, 
        'completed', 
        10.00, 
        v_producer_id,
        v_product_id,
        10.00,
        'guest_test@offszn.lat',
        NOW()
    )
    RETURNING id INTO v_order_id;

    -- 3. Insertar el item en 'order_items'
    INSERT INTO public.order_items (
        order_id, 
        product_id, 
        quantity, 
        price_at_purchase, 
        license_name
    )
    VALUES (
        v_order_id, 
        v_product_id, 
        1, 
        10.00, 
        'Premium Lease' -- Aunque se ponga aquí, la UI debe ocultarlo por tipo
    );

    RAISE NOTICE 'Orden % creada con éxito.', v_transaction_id;
END $$;

-- Ver la URL generada
SELECT 'http://localhost:3000/pages/purchase-success?order=' || transaction_id as test_url
FROM orders 
WHERE transaction_id LIKE 'SIMULATED_TEST_%' 
ORDER BY created_at DESC 
LIMIT 1;
