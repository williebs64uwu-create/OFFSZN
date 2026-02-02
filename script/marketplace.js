document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURACIÓN ---
    // Use the global client initialized by auth-utils.js
    const supabaseClient = window.supabaseClient;

    // Safety check
    if (!supabaseClient) {
        console.error("Critical: Global Supabase not found. Ensure auth-utils.js is loaded.");
    }

    let API_URL = '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_URL = 'http://localhost:3000/api';
    } else {
        API_URL = 'https://offszn-academy.onrender.com/api';
    }

    // --- 2. ESTADO GLOBAL ---
    let allProducts = []; // Guardamos todos los productos aquí
    let cart = []; // Nuestro carrito de compras

    // --- 3. SELECTORES DEL DOM ---
    const productGrid = document.getElementById('product-grid');
    // ... (selectores de filtros) ...

    // Selectores del Carrito
    const cartOverlay = document.getElementById('cart-overlay');
    const cartPanel = document.getElementById('cart-panel');
    const cartCloseBtn = document.getElementById('cart-close-btn');
    const cartItemsList = document.getElementById('cart-items-list');
    const cartTotalPriceEl = document.getElementById('cart-total-price');
    const cartEmptyMessage = document.getElementById('cart-empty-message');
    const navbarCartButton = document.querySelector('a[href="/pages/cart.html"]'); // El botón del carrito en el navbar

    // --- 4. FUNCIONES PRINCIPALES DE CARGA ---
    async function fetchAndRenderProducts() {
        // ... (Tu función fetchAndRenderProducts se queda EXACTAMENTE IGUAL que antes)
        // ... (No la pego aquí para no hacer el bloque tan largo, no la toques)
        productGrid.innerHTML = '<div class="product-card-placeholder">Cargando productos...</div>';

        try {
            const response = await fetch(`${API_URL}/products`);
            if (!response.ok) throw new Error(`Error ${response.status}: No se pudieron cargar los productos.`);

            allProducts = await response.json(); // Guardamos en el estado global

            const token = localStorage.getItem('authToken');
            let purchasedProductIds = new Set();
            if (token) {
                // (Opcional pero recomendado: cargar el carrito existente del usuario desde la API)
                // await loadUserCart(token); 

                const purchasedResponse = await fetch(`${API_URL}/my-products`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (purchasedResponse.ok) {
                    const purchasedProducts = await purchasedResponse.json();
                    purchasedProducts.forEach(p => p && p.id && purchasedProductIds.add(p.id));
                }
            }

            renderProducts(allProducts, purchasedProductIds);
            renderCartUI(); // Renderizar el carrito (estará vacío al inicio)

        } catch (error) {
            console.error(error);
            productGrid.innerHTML = '<div class="product-card-placeholder" style="color: red;">Error al cargar productos.</div>';
        }
    }

    // --- 5. RENDERIZADO DE PRODUCTOS (¡CON LISTENER DE CARRITO!) ---
    function renderProducts(products, purchasedIds) {
        productGrid.innerHTML = '';
        if (!products || products.length === 0) {
            productGrid.innerHTML = '<div class="product-card-placeholder">No se encontraron productos.</div>';
            return;
        }

        products.forEach(product => {
            const isPurchased = purchasedIds.has(product.id);
            const card = document.createElement('div');
            card.className = 'product-card';

            // --- Imagen (Corregida con la optimización) ---
            const imageContainer = document.createElement('div');
            imageContainer.className = 'product-card-image';
            const img = document.createElement('img');
            if (product.image_url) {
                const optimizedUrlBase = product.image_url.replace('/object/', '/render/image/');
                img.src = `${optimizedUrlBase}?width=400&quality=80&resize=contain`;
            }
            img.alt = product.name;
            imageContainer.append(img);
            card.append(imageContainer);

            // --- Contenido (Seguro) ---
            const content = document.createElement('div');
            content.className = 'product-card-content';

            const title = document.createElement('h3');
            title.className = 'product-card-title';
            title.textContent = product.name;
            content.append(title);

            const producer = document.createElement('p');
            producer.className = 'product-card-producer';
            producer.textContent = `Por ${product.producer_nickname || 'Usuario Anónimo'}`;
            content.append(producer);

            const description = document.createElement('p');
            description.className = 'product-card-description';
            description.textContent = product.description;
            content.append(description);

            // --- Footer de la Tarjeta ---
            const footer = document.createElement('div');
            footer.className = 'product-card-footer';

            const priceEl = document.createElement('div');
            priceEl.className = 'product-card-price';
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

            // --- Botón de Carrito (¡AHORA CON LISTENER!) ---
            if (isPurchased) {
                const purchasedBadge = document.createElement('span');
                purchasedBadge.className = 'btn-add-to-cart';
                purchasedBadge.style.background = 'var(--green-verified)';
                purchasedBadge.innerHTML = '<i class="bi bi-check-circle-fill"></i> Adquirido';
                footer.append(purchasedBadge);
            } else {
                const cartButton = document.createElement('button');
                cartButton.className = 'btn-add-to-cart';
                cartButton.dataset.productId = product.id;
                cartButton.innerHTML = '<i class="bi bi-cart-plus"></i> Añadir';

                // ¡¡AQUÍ CONECTAMOS EL BOTÓN!!
                cartButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Evita que se haga clic en la tarjeta
                    addToCart(product.id, cartButton);
                });

                // -- FAVORITES BUTTON --
                const likeBtn = document.createElement('button');
                likeBtn.className = 'btn-like-card';
                likeBtn.dataset.productId = product.id; // Store ID for updates
                likeBtn.innerHTML = '<i class="bi bi-heart"></i>';
                likeBtn.style.marginRight = '8px';
                likeBtn.style.background = 'transparent';
                likeBtn.style.border = '1px solid rgba(255,255,255,0.1)';
                likeBtn.style.color = '#ccc';
                likeBtn.style.width = '32px';
                likeBtn.style.height = '32px';
                likeBtn.style.borderRadius = '8px';
                likeBtn.style.cursor = 'pointer';
                likeBtn.style.display = 'flex';
                likeBtn.style.alignItems = 'center';
                likeBtn.style.justifyContent = 'center';

                // Initial State
                if (window.FavoritesManager && window.FavoritesManager.isLiked(product.id)) {
                    likeBtn.innerHTML = '<i class="bi bi-heart-fill"></i>';
                    likeBtn.style.color = '#ef4444';
                    likeBtn.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                }

                likeBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (window.FavoritesManager) {
                        // Pass product.user_id (producer)
                        const ownerId = product.user_id;
                        window.FavoritesManager.toggleLike(product.id, likeBtn, ownerId);

                        // Local instant toggle (manager handles sync, but visual feedback is good)
                        const isLiked = window.FavoritesManager.isLiked(product.id); // This will return NEW state if optimistic
                        if (isLiked) { // Logic inside manager toggles set immediately
                            likeBtn.innerHTML = '<i class="bi bi-heart-fill"></i>';
                            likeBtn.style.color = '#ef4444';
                        } else {
                            likeBtn.innerHTML = '<i class="bi bi-heart"></i>';
                            likeBtn.style.color = '#ccc';
                        }
                    }
                };

                // Add to container (creating a flex wrapper if needed, or just append)
                // Existing structure appends cartButton directly to footer.
                // Let's wrap buttons
                const btnContainer = document.createElement('div');
                btnContainer.style.display = 'flex';
                btnContainer.style.alignItems = 'center';
                btnContainer.append(likeBtn);
                btnContainer.append(cartButton);

                footer.append(btnContainer);
                // footer.append(cartButton); // Removed original append
            }

            // content.append(footer); // Existing
            // card.append(content);   // Existing

            content.append(footer);
            card.append(content);
            productGrid.append(card);
        });
    }

    // --- 6. LÓGICA DEL CARRITO (¡NUEVO!) ---

    function openCart() {
        if (cartPanel) cartPanel.classList.add('active');
        if (cartOverlay) cartOverlay.classList.add('active');
    }

    function closeCart() {
        if (cartPanel) cartPanel.classList.remove('active');
        if (cartOverlay) cartOverlay.classList.remove('active');
    }

    async function addToCart(productId, button) {
        const token = localStorage.getItem('authToken');

        // --- AUTH WALL ---
        if (!token) {
            alert('Debes crear una cuenta para comprar o añadir al carrito.');
            window.location.href = '/pages/register.html';
            return;
        }

        // Evitar duplicados
        if (cart.find(item => item.id === productId)) {
            showToast('Este producto ya está en tu carrito.', 'info');
            openCart();
            return;
        }

        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="bi bi-hourglass-split"></i>';
        }

        try {
            // Encontrar el producto completo
            const productToAdd = allProducts.find(p => p.id === productId);
            if (!productToAdd) throw new Error('Producto no encontrado');

            // --- SYNC DB (Fix for Checkout) ---
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session?.user) {
                const { error } = await supabaseClient
                    .from('cart_items')
                    .insert({
                        user_id: session.user.id,
                        product_id: productId,
                        quantity: 1,
                        license_name: 'Basic Lease', // Default for Grid Quick Add
                        variant_price: productToAdd.price_basic
                    });

                if (error) {
                    // Check for duplicate key error (if somehow check missed)
                    if (error.code !== '23505') throw error;
                }
            }

            // 3. Centralized Cart Addition
            if (window.CartManager) {
                window.CartManager.addToCart(productToAdd);

                // UI Feedback (Specific to marketplace buttons)
                if (button) {
                    button.innerHTML = '<i class="bi bi-check-lg"></i> Añadido';
                    button.classList.add('added');
                    setTimeout(() => {
                        button.innerHTML = '<i class="bi bi-cart-plus"></i> Añadir';
                        button.classList.remove('added');
                    }, 2000);
                }
            } else {
                // Local fallback if Manager fails
                cart.push(productToAdd);
                localStorage.setItem('offszn_cart', JSON.stringify(cart));
                if (window.toast) {
                    window.toast.success("Agregado a tu carrito", 4000, productId);
                }
            }
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        renderCartUI();
    }

    function renderCartUI() {
        if (!cartItemsList) return; // Salir si no estamos en la página del marketplace

        cartItemsList.innerHTML = ''; // Limpiar la lista

        if (cart.length === 0) {
            cartEmptyMessage.style.display = 'flex';
        } else {
            cartEmptyMessage.style.display = 'none';
            cart.forEach(product => {
                const itemEl = document.createElement('div');
                itemEl.className = 'cart-item';

                let imgUrl = ''; // Placeholder
                if (product.image_url) {
                    const optimizedUrlBase = product.image_url.replace('/object/', '/render/image/');
                    imgUrl = `${optimizedUrlBase}?width=160&quality=75&resize=contain`;
                }

                // Usamos el precio más bajo (basic) como precio del carrito
                // Esto lo mejoraremos cuando implementemos selección de licencia
                const price = (product.is_free ? 0 : (product.price_basic || 0)).toFixed(2);

                itemEl.innerHTML = `
                    <img src="${imgUrl}" alt="${product.name}" class="cart-item-image">
                    <div class="cart-item-info">
                        <span class="cart-item-title">${product.name}</span>
                        <span class="cart-item-producer">Por ${product.producer_nickname || 'Anónimo'}</span>
                        <span class="cart-item-price">$${price}</span> 
                    </div>
                    <button class="cart-item-remove-btn" data-product-id="${product.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                `;
                cartItemsList.append(itemEl);
            });
        }

        // Asignar listeners a los botones de borrar
        cartItemsList.querySelectorAll('.cart-item-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.productId;
                removeFromCart(parseInt(id)); // Asegurarse de que sea un número
            });
        });

        updateCartTotal();
    }

    function updateCartTotal() {
        if (!cartTotalPriceEl) return;

        const total = cart.reduce((sum, product) => {
            // (Simplificado: asume el precio 'basic')
            return sum + (product.is_free ? 0 : (parseFloat(product.price_basic) || 0));
        }, 0);

        cartTotalPriceEl.textContent = `$${total.toFixed(2)}`;
    }

    async function handleCheckout() {
        const token = localStorage.getItem('authToken');
        const checkoutButton = document.getElementById('btn-checkout');

        if (!token) {
            if (window.toast) window.toast.error('Debes iniciar sesión.');
            else alert('Debes iniciar sesión.');
            window.location.href = '/pages/login';
            return;
        }

        if (cart.length === 0) return;

        // 1. Feedback visual inmediato
        checkoutButton.disabled = true;
        checkoutButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Iniciando pago...';

        try {
            // 2. Preparar la nueva pestaña ANTES del fetch para evitar bloqueo de popups
            // (Abrimos una ventana en blanco que luego redirigiremos)
            const paymentWindow = window.open('', '_blank');

            if (paymentWindow) {
                paymentWindow.document.write(`
                    <html>
                        <head><title>Procesando...</title></head>
                        <body style="background:#0a0118; color:white; display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;">
                            <h2>Cargando pasarela de Mercado Pago...</h2>
                        </body>
                    </html>
                `);
            } else {
                if (window.toast) window.toast.error("Por favor permite las ventanas emergentes para pagar.");
                else alert("Por favor permite las ventanas emergentes para pagar.");
                checkoutButton.disabled = false;
                return;
            }

            // 3. Pedir la URL al backend
            const response = await fetch(`${API_URL}/orders/create-mercadopago-preference`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ cartItems: cart })
            });

            const data = await response.json();

            if (!response.ok) {
                if (paymentWindow) paymentWindow.close(); // Cerrar si falla
                throw new Error(data.error || 'Error al iniciar pago');
            }

            // 4. Redirigir la nueva pestaña a Mercado Pago
            if (paymentWindow) {
                paymentWindow.location.href = data.url;
            }

            // 5. CAMBIAR LA UI DEL MARKETPLACE A "ESPERANDO PAGO"
            showWaitingScreen();

            // 6. INICIAR EL MONITOREO (POLLING)
            startPollingPayment(paymentWindow);

        } catch (error) {
            console.error(error);
            checkoutButton.disabled = false;
            checkoutButton.innerHTML = 'Pagar Ahora';
            if (window.toast) window.toast.error(error.message);
            else showToast(error.message, 'error');
        }
    }

    function showWaitingScreen() {
        // Puedes reemplazar el contenido del carrito o poner un overlay
        const cartPanel = document.getElementById('cart-panel');
        cartPanel.innerHTML = `
            <div style="padding: 2rem; text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                <div class="spinner" style="border: 4px solid rgba(255,255,255,0.1); border-left-color: #7209b7; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
                <h3>Estamos verificando tu pago</h3>
                <p style="color: #999; margin-top: 10px;">Por favor completa el pago en la otra pestaña. Esta ventana se actualizará automáticamente.</p>
                <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
            </div>
        `;
    }

    let pollingInterval;

    function startPollingPayment(paymentWindow) {
        const token = localStorage.getItem('authToken');
        let attempts = 0;
        const maxAttempts = 60; // 3 minutos aprox (60 * 3s)

        pollingInterval = setInterval(async () => {
            attempts++;

            // Si el usuario cierra la ventana de pago manualmente, podríamos parar, 
            // pero mejor seguimos preguntando por si pagó justo antes de cerrar.
            if (paymentWindow.closed && attempts > 10) {
                // Opcional: avisar que se cerró la ventana
            }

            if (attempts >= maxAttempts) {
                clearInterval(pollingInterval);
                if (window.toast) window.toast.error("Tiempo de espera agotado. Si pagaste, revisa 'Mis Cursos'.");
                else alert("Tiempo de espera agotado. Si pagaste, revisa 'Mis Cursos'.");
                window.location.reload();
                return;
            }

            try {
                const res = await fetch(`${API_URL}/orders/status/latest`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const statusData = await res.json();

                console.log("Estado del pago:", statusData.status);

                if (statusData.status === 'completed') {
                    clearInterval(pollingInterval);
                    if (paymentWindow) paymentWindow.close(); // Cerramos MP

                    // ÉXITO!! Limpiamos carrito y mostramos confetti o mensaje
                    cart = [];
                    localStorage.removeItem('cart'); // Si usas persistencia

                    document.getElementById('cart-panel').innerHTML = `
                        <div style="padding: 2rem; text-align: center; color: #0cbc87;">
                            <i class="bi bi-check-circle-fill" style="font-size: 3rem;"></i>
                            <h3 style="margin-top: 1rem; color: white;">¡Pago Exitoso!</h3>
                            <p style="color: #ddd;">Tus productos ya están disponibles.</p>
                            <button onclick="window.location.reload()" style="margin-top: 1rem; padding: 10px 20px; background: #7209b7; border: none; color: white; border-radius: 8px; cursor: pointer;">Ver mis productos</button>
                        </div>
                    `;
                    if (window.toast) window.toast.success('¡Compra completada!');
                    else showToast('¡Compra completada!', 'success');
                }

            } catch (err) {
                console.error("Error polling:", err);
            }

        }, 3000); // Preguntar cada 3 segundos
    }

    // --- 7. INICIALIZAR LISTENERS DEL CARRITO ---
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);
    if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCart);

    if (navbarCartButton) {
        navbarCartButton.href = "#"; // Sobrescribir el enlace a cart.html
        navbarCartButton.addEventListener('click', (e) => {
            e.preventDefault();
            openCart();
        });
    }

    const checkoutButton = document.getElementById('btn-checkout');
    if (checkoutButton) {
        checkoutButton.addEventListener('click', handleCheckout);
    }

    // --- 8. CARGA INICIAL ---
    fetchAndRenderProducts();

    // --- 9. FUNCIÓN DE TOAST (para notificaciones) ---
    function showToast(message, type = 'info') {
        if (window.toast) {
            window.toast.show(message, type);
        } else {
            console.log("[Marketplace Toast Fallback]", message);
        }
    }

    // --- 10. FAVORITES SYNC ---
    if (window.FavoritesManager) {
        window.FavoritesManager.subscribe((likedIds) => {
            const btns = document.querySelectorAll('.btn-like-card');
            btns.forEach(btn => {
                const id = btn.dataset.productId;
                if (!id) return;

                const isLiked = likedIds.has(String(id));
                if (isLiked) {
                    btn.innerHTML = '<i class="bi bi-heart-fill"></i>';
                    btn.style.color = '#ef4444';
                    btn.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                } else {
                    btn.innerHTML = '<i class="bi bi-heart"></i>';
                    btn.style.color = '#ccc';
                    btn.style.borderColor = 'rgba(255,255,255,0.1)';
                }
            });
        });
    }
});