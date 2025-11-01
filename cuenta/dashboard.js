document.addEventListener('DOMContentLoaded', async () => {

    const welcomeText = document.querySelector('.welcome-text');
    const profileAvatar = document.querySelector('.profile-avatar');
    const profileName = document.querySelector('.profile-name');
    const walletAmount = document.querySelector('.wallet-amount');
    const statsGrid = document.querySelector('.stats-grid');
    const productsGrid = document.querySelector('.products-grid');
    const uploadButton = document.querySelector('.upload-btn');
    const token = localStorage.getItem('authToken');

    // ---------- GIFT CARDS STATE ----------
    const STORAGE_KEY = 'offszn_giftcards_state';
    const CACHE_KEY = 'offszn_user_cache';
    let appState = { totalBalance: 0, giftCards: [] };

    function loadGiftCardsState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                appState = JSON.parse(saved);
                updateWalletAmount();
            }
        } catch (err) { 
            console.error('Error al cargar estado de gift cards:', err); 
        }
    }

    function updateWalletAmount() {
        if (walletAmount) {
            walletAmount.textContent = `$${appState.totalBalance.toFixed(2)}`;
            walletAmount.classList.remove('skeleton');
        }
    }

    // ---------- SKELETON LOADING ----------
    function showSkeletonLoading() {
        // Agregar skeleton a elementos principales
        if (profileAvatar) profileAvatar.classList.add('skeleton');
        if (walletAmount) walletAmount.classList.add('skeleton');
        
        // Skeleton en stats
        document.querySelectorAll('.stat-value').forEach(el => {
            el.classList.add('skeleton');
            el.textContent = '000';
        });
        
        // Skeleton en streak
        document.querySelectorAll('.streak-value').forEach(el => {
            el.classList.add('skeleton');
        });
    }

    function hideSkeletonLoading() {
        // Remover skeleton con fade-in
        document.querySelectorAll('.skeleton').forEach(el => {
            el.classList.remove('skeleton');
            el.classList.add('fade-in');
        });
    }

    // ---------- CACHÉ DE USUARIO ----------
    function loadCachedUser() {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const cachedData = JSON.parse(cached);
                console.log('Cargando datos desde caché...');
                updateUserUI(cachedData, true); // true = desde caché
                return true;
            }
        } catch (err) {
            console.error('Error al cargar caché:', err);
        }
        return false;
    }

    function saveUserCache(userData) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(userData));
        } catch (err) {
            console.error('Error al guardar caché:', err);
        }
    }

    // ---------- ACTUALIZAR UI ----------
    function updateUserUI(userData, fromCache = false) {
        if (welcomeText) {
            welcomeText.textContent = `Bienvenido, ${userData.nickname || userData.first_name || 'Usuario'}`;
            welcomeText.classList.add('fade-in');
        }
        
        if (profileName) {
            profileName.textContent = `${userData.first_name || ''} ${userData.lastName || ''}`.trim() || userData.nickname;
        }
        
        if (profileAvatar) {
            const initial = (userData.first_name || userData.nickname || 'U').charAt(0).toUpperCase();
            profileAvatar.textContent = initial;
            profileAvatar.classList.remove('skeleton');
            profileAvatar.classList.add('fade-in');
        }

        if (!fromCache) {
            hideSkeletonLoading();
        }
    }

    let API_URL = '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_URL = 'http://localhost:3000/api';
    } else {
        API_URL = 'https://offszn-academy.onrender.com/api';
    }

    if (!token) {
        console.error("Dashboard: No hay token, redirigiendo al login.");
        window.location.replace('/pages/login.html');
        return;
    }

    // ---------- MOSTRAR SKELETON INICIAL ----------
    showSkeletonLoading();
    
    // ---------- CARGAR CACHÉ PRIMERO (INSTANTÁNEO) ----------
    const hasCachedData = loadCachedUser();

    async function loadDashboardData() {
        try {
            const userResponse = await fetch(`${API_URL}/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!userResponse.ok) {
                localStorage.removeItem('authToken');
                throw new Error(`Error ${userResponse.status}: No se pudieron obtener los datos del usuario.`);
            }
            
            const userData = await userResponse.json();
            console.log("Datos del usuario (frescos):", userData);

            // Guardar en caché para próxima visita
            saveUserCache(userData);

            // Actualizar UI con datos frescos
            updateUserUI(userData, false);

            // Cargar saldo de gift cards
            loadGiftCardsState();

            if (userData.is_producer === true) {
                console.log("Usuario es productor. Cargando datos de productor...");
                document.querySelectorAll('.producer-only').forEach(el => el.style.display = '');

                if (productsGrid) {
                    await loadProducerProducts(userData.id);
                }

            } else {
                console.log("Usuario NO es productor.");
                document.querySelectorAll('.producer-only').forEach(el => el.style.display = 'none');
                
                if (document.querySelector('.main-content')) {
                    document.querySelector('.main-content').innerHTML = `
                           <h1>Bienvenido ${userData.nickname || 'Usuario'}</h1>
                           <p>Explora el marketplace o revisa tus compras.</p>
                           <a href="/pages/my-products.html" class="btn">Ver Mis Productos</a>
                           <a href="/pages/presets-v2.html" class="btn btn-secondary">Ir al Marketplace</a>
                      `;
                }
            }

        } catch (error) {
            console.error("Error al cargar datos del dashboard:", error);
            hideSkeletonLoading();
            
            if (error.message.includes('401') || error.message.includes('403')) {
                localStorage.removeItem('authToken');
                localStorage.removeItem(CACHE_KEY);
                window.location.replace('/pages/login.html');
            } else if (document.querySelector('.main-content')) {
                document.querySelector('.main-content').innerHTML = `<h1 style="color:red;">Error al cargar dashboard</h1><p>${error.message}</p>`;
            }
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId || 'modal');
        if (modal) modal.classList.remove('active');
    }

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.onclick = null;
            closeBtn.addEventListener('click', () => closeModal(modal.id));
        }
    });

    async function loadProducerProducts(userId) {
        if (!productsGrid) return;
        
        // Mostrar skeleton de productos
        productsGrid.innerHTML = `
            <div class="product-card skeleton" style="height:300px;"></div>
            <div class="product-card skeleton" style="height:300px;"></div>
            <div class="product-card skeleton" style="height:300px;"></div>
        `;
        
        try {
            const response = await fetch(`${API_URL}/me/products`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error('No se pudieron cargar tus productos.');
            
            const myProducts = await response.json();

            if (myProducts.length === 0) {
                productsGrid.innerHTML = '<p style="grid-column: 1/-1;">Aún no has subido ningún producto.</p>';
                return;
            }

            let productsHTML = '';
            myProducts.slice(0, 3).forEach(product => {
                productsHTML += `
                     <div class="product-card fade-in">
                         <div class="product-image" style="${product.image_url ? `background-image: url(${product.image_url}); background-size:cover;` : ''}">
                             ${!product.image_url ? '<i class="fas fa-music"></i>' : ''}
                             <span class="product-badge">${product.product_type || 'Preset'}</span>
                         </div>
                         <div class="product-info">
                             <div class="product-title">${product.name}</div>
                             <div class="product-meta"></div>
                             <div class="product-price">$${product.price}</div>
                             <div class="product-stats">
                                 <div><i class="fas fa-shopping-bag"></i> --</div>
                                 <div><i class="fas fa-eye"></i> --</div>
                             </div>
                         </div>
                     </div>
                 `;
            });
            productsGrid.innerHTML = productsHTML;

        } catch (error) {
            console.error("Error cargando productos del productor:", error);
            productsGrid.innerHTML = `<p style="color:red;grid-column:1/-1;">Error al cargar tus productos: ${error.message}</p>`;
        }
    }

    // ---------- EJECUTAR CARGA ----------
    loadDashboardData();

    function handleLogout(e) {
        e.preventDefault();
        console.log("Iniciando cierre de sesión...");

        const overlay = document.getElementById('logout-overlay');
        const messageEl = document.getElementById('logout-message');
        const iconEl = overlay.querySelector('i');

        if (!overlay || !messageEl || !iconEl) {
            console.warn("Faltan elementos del DOM para el logout animado. Usando fallback.");
            localStorage.removeItem('authToken');
            window.location.replace('/index.html'); 
            return;
        }

        messageEl.textContent = "Te veremos pronto..."; 
        iconEl.className = 'fas fa-spinner fa-spin';
        overlay.classList.add('active');
        setTimeout(() => {

            localStorage.removeItem('authToken');
            console.log("Sesión cerrada. Mostrando mensaje de despedida.");
            messageEl.textContent = "¡Cerraste sesión!";
            iconEl.className = 'fas fa-check-circle'; 

        }, 1500); 

        setTimeout(() => {

            console.log("Desvaneciendo overlay...");
            overlay.classList.add('fading-out');

        }, 3000); 
        setTimeout(() => {

            console.log("Redirigiendo a index.html");
            window.location.replace('/index.html');

        }, 3500);
    }

    const sidebarLogoutButton = document.querySelector('.logout-btn');
    if (sidebarLogoutButton) {
        sidebarLogoutButton.addEventListener('click', handleLogout);
    }

    const navbarLogoutButton = document.getElementById('navbar-logout-btn');
    if (navbarLogoutButton) {
        navbarLogoutButton.addEventListener('click', handleLogout);
    }

});