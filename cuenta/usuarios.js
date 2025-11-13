document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. CONFIGURACIÓN ---
    let API_URL = '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_URL = 'http://localhost:3000/api';
    } else {
        API_URL = 'https://offszn-academy.onrender.com/api';
    }

    // --- 2. SELECTORES DEL DOM ---
    const profileNameEl = document.getElementById('profile-name');
    const profileBioEl = document.getElementById('profile-bio');
    const profileAvatarEl = document.getElementById('profile-avatar');
    const profileJoinDateEl = document.getElementById('profile-join-date');
    const profileSocialsEl = document.getElementById('profile-socials');
    const productGridEl = document.getElementById('product-grid');
    const productsTitleEl = document.getElementById('products-title');

    // --- 3. OBTENER NICKNAME DE LA URL ---
    function getNicknameFromURL() {
        const path = window.location.pathname; // Ej: "/@willieinspired" o "/cuenta/usuarios.html"
        
        if (path.startsWith('/@')) {
            return path.substring(2); // Devuelve "willieinspired"
        }
        
        // Fallback para la ruta vieja (ej: /usuarios.html?nickname=...)
        const params = new URLSearchParams(window.location.search);
        return params.get('nickname');
    }

    // --- 4. CARGAR DATOS DEL PERFIL ---
    async function loadProfile(nickname) {
        try {
            const response = await fetch(`${API_URL}/users/${nickname}`);
            if (!response.ok) throw new Error('Usuario no encontrado');
            
            const user = await response.json();

            // Rellenar cabecera
            profileNameEl.textContent = user.nickname || 'Usuario';
            profileBioEl.textContent = user.bio || 'Este productor aún no ha añadido una biografía.';
            productsTitleEl.textContent = `Productos de ${user.nickname || 'Usuario'}`;
            
            const initial = (user.first_name || user.nickname || 'U').charAt(0).toUpperCase();
            profileAvatarEl.textContent = initial;
            profileAvatarEl.classList.remove('skeleton'); // Quitar skeleton

            // Formatear fecha de registro
            const joinDate = new Date(user.created_at);
            profileJoinDateEl.textContent = `Miembro desde ${joinDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;

            // Rellenar redes sociales (¡Asumiendo que 'user.socials' es un objeto jsonb!)
            profileSocialsEl.innerHTML = ''; // Limpiar
            if (user.socials) {
                if (user.socials.youtube) {
                    profileSocialsEl.innerHTML += `<a href="${user.socials.youtube}" target="_blank" title="YouTube"><i class="bi bi-youtube"></i></a>`;
                }
                if (user.socials.instagram) {
                    profileSocialsEl.innerHTML += `<a href="${user.socials.instagram}" target="_blank" title="Instagram"><i class="bi bi-instagram"></i></a>`;
                }
                if (user.socials.tiktok) {
                    profileSocialsEl.innerHTML += `<a href="${user.socials.tiktok}" target="_blank" title="TikTok"><i class="bi bi-tiktok"></i></a>`;
                }
                 if (user.socials.spotify) {
                    profileSocialsEl.innerHTML += `<a href="${user.socials.spotify}" target="_blank" title="Spotify"><i class="bi bi-spotify"></i></a>`;
                }
            }

        } catch (error) {
            console.error("Error al cargar perfil:", error);
            profileNameEl.textContent = "Error";
            profileBioEl.textContent = error.message;
        }
    }

    // --- 5. CARGAR PRODUCTOS DEL PERFIL ---
    async function loadProducts(nickname) {
        try {
            const response = await fetch(`${API_URL}/users/${nickname}/products`);
            if (!response.ok) throw new Error('No se pudieron cargar los productos');
            
            const products = await response.json();
            
            // Reutilizamos la lógica de renderizado de marketplace.js
            renderProducts(products); 

        } catch (error) {
            console.error("Error al cargar productos:", error);
            productGridEl.innerHTML = `<div class="product-card-placeholder" style="color: red;">${error.message}</div>`;
        }
    }

    // --- 6. FUNCIÓN DE RENDERIZADO (Copiada de marketplace.js) ---
    function renderProducts(products) {
        productGridEl.innerHTML = '';
        
        if (!products || products.length === 0) {
            productGridEl.innerHTML = '<div class="product-card-placeholder">Este productor aún no tiene productos.</div>';
            return;
        }

        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';

            const imageContainer = document.createElement('div');
            imageContainer.className = 'product-card-image';
            const img = document.createElement('img');
            img.src = product.image_url; 
            img.alt = product.name; 
            imageContainer.append(img);
            card.append(imageContainer);

            const content = document.createElement('div');
            content.className = 'product-card-content';

            const title = document.createElement('h3');
            title.className = 'product-card-title';
            title.textContent = product.name;
            content.append(title);

            // (Omitimos el 'producer_nickname' ya que estamos en su perfil)
            const description = document.createElement('p');
            description.className = 'product-card-description';
            description.textContent = product.description;
            content.append(description);

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

            // (¡PENDIENTE! Aquí irá la lógica de 'Añadir al Carrito' y 'PayPal')
            const cartButton = document.createElement('button');
            cartButton.className = 'btn-add-to-cart';
            cartButton.dataset.productId = product.id;
            cartButton.innerHTML = '<i class="bi bi-cart-plus"></i> Añadir';
            footer.append(cartButton);
            
            content.append(footer);
            card.append(content);
            productGridEl.append(card);
        });
    }

    // --- 7. EJECUCIÓN INICIAL ---
    const nickname = getNicknameFromURL();
    if (nickname) {
        loadProfile(nickname);
        loadProducts(nickname);
    } else {
        profileNameEl.textContent = "Usuario no especificado";
        profileBioEl.textContent = "Por favor, ingresa un nombre de usuario en la URL (ej. /@willieinspired)";
    }
});