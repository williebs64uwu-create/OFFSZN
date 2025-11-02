document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURACIÓN ---
    // (Asegúrate de que la librería de Supabase <script src=...> esté en el <head> de marketplace.html)
    const SUPABASE_URL = "https://qtjpvztpgfymjhhpoouq.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";
    
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let API_URL = '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_URL = 'http://localhost:3000/api';
    } else {
        API_URL = 'https://offszn-academy.onrender.com/api';
    }

    // --- 2. SELECTORES DEL DOM ---
    const productGrid = document.getElementById('product-grid');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    // (Añadiremos los filtros y ordenamiento después)


    // --- 3. FUNCIÓN PRINCIPAL DE CARGA ---
    async function fetchAndRenderProducts() {
        productGrid.innerHTML = '<div class="product-card-placeholder">Cargando productos...</div>';
        
        try {
            // Obtener productos del backend
            const response = await fetch(`${API_URL}/products`);
            if (!response.ok) {
                throw new Error(`Error ${response.status}: No se pudieron cargar los productos.`);
            }
            const products = await response.json();

            // (Esta lógica es de tu 'presets.js' anterior, la mantenemos)
            const token = localStorage.getItem('authToken');
            let purchasedProductIds = new Set();
            if (token) {
                try {
                    const purchasedResponse = await fetch(`${API_URL}/my-products`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (purchasedResponse.ok) {
                        const purchasedProducts = await purchasedResponse.json();
                        purchasedProducts.forEach(p => p && p.id && purchasedProductIds.add(p.id));
                    }
                } catch (e) {
                    console.warn("No se pudo obtener la lista de productos comprados.", e.message);
                }
            }

            renderProducts(products, purchasedProductIds);

        } catch (error) {
            console.error(error);
            productGrid.innerHTML = '<div class="product-card-placeholder" style="color: red;">Error al cargar productos.</div>';
        }
    }

    // --- 4. FUNCIÓN DE RENDERIZADO (SEGURA) ---
    function renderProducts(products, purchasedIds) {
        productGrid.innerHTML = ''; // Limpiar el "Cargando..."
        
        if (!products || products.length === 0) {
            productGrid.innerHTML = '<div class="product-card-placeholder">No se encontraron productos.</div>';
            return;
        }

        products.forEach(product => {
            const isPurchased = purchasedIds.has(product.id);

            const card = document.createElement('div');
            card.className = 'product-card';

            // --- Imagen ---
            const imageContainer = document.createElement('div');
            imageContainer.className = 'product-card-image';
            const img = document.createElement('img');
            img.src = product.image_url; 
            img.alt = product.name; 
            imageContainer.append(img);
            card.append(imageContainer);

            // --- Contenido ---
            const content = document.createElement('div');
            content.className = 'product-card-content';

            const title = document.createElement('h3');
            title.className = 'product-card-title';
            title.textContent = product.name; // <-- SEGURO
            content.append(title);

            const producer = document.createElement('p');
            producer.className = 'product-card-producer';
            // ¡¡IMPORTANTE!! Necesitamos el 'nickname' del productor.
            // Lo arreglaremos en el backend en el siguiente paso.
            producer.textContent = `Por ${product.producer_nickname || 'Usuario Anónimo'}`; 
            content.append(producer);

            const description = document.createElement('p');
            description.className = 'product-card-description';
            description.textContent = product.description; // <-- SEGURO
            content.append(description);

            // --- Footer de la Tarjeta ---
            const footer = document.createElement('div');
            footer.className = 'product-card-footer';

            const priceEl = document.createElement('div');
            priceEl.className = 'product-card-price';

            // Lógica de precios que arreglamos
            if (product.is_free) {
                priceEl.textContent = 'Gratis';
                priceEl.classList.add('free');
            } else {
                const prices = [product.price_basic, product.price_premium, product.price_stems, product.price_exclusive].filter(p => p > 0);
                
                if (prices.length > 0) {
                    const lowestPrice = Math.min(...prices);
                    priceEl.textContent = `Desde $${parseFloat(lowestPrice).toFixed(2)}`;
                } else {
                    priceEl.textContent = 'No disponible';
                }
            }
            footer.append(priceEl);

            // Botón de Añadir al Carrito (o Adquirido)
            if (isPurchased) {
                const purchasedBadge = document.createElement('span');
                purchasedBadge.className = 'btn-add-to-cart'; // Reutilizamos el estilo
                purchasedBadge.style.background = 'var(--green-verified)';
                purchasedBadge.innerHTML = '<i class="bi bi-check-circle-fill"></i> Adquirido';
                footer.append(purchasedBadge);
            } else {
                const cartButton = document.createElement('button');
                cartButton.className = 'btn-add-to-cart';
                cartButton.dataset.productId = product.id;
                cartButton.innerHTML = '<i class="bi bi-cart-plus"></i> Añadir';
                footer.append(cartButton);
            }
            
            content.append(footer);
            card.append(content);
            productGrid.append(card);
        });

        // 5. --- (PENDIENTE) Inicializar Botones ---
        // addCartButtonListeners(); 
    }

    // --- 6. --- Carga Inicial ---
    fetchAndRenderProducts();
});