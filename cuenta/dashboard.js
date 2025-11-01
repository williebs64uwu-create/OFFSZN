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
                // ===============================================
                // NUEVA LÓGICA DEL DASHBOARD DE CLIENTE
                // ===============================================
                console.log("Usuario NO es productor. Construyendo dashboard de cliente...");

                // Ocultar elementos de productor en el SIDEBAR
                document.querySelectorAll('.producer-only').forEach(el => el.style.display = 'none');

                // 1. Inyectar el HTML del dashboard de cliente
                const mainContent = document.querySelector('.main-content');
                if (mainContent) {
                    mainContent.innerHTML = `
                        <div class="dashboard-header">
                            <h1 class="welcome-text">Bienvenido, ${userData.nickname || userData.first_name || 'Usuario'}</h1>
                            <p class="welcome-subtitle">Gestiona tus compras, descargas y perfil desde aquí.</p>
                        </div>
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-header">
                                    <div class="stat-icon"><i class="fas fa-shopping-bag" style="color:#8b5cf6;"></i></div>
                                </div>
                                <div class="stat-value skeleton" id="stat-compras">0</div>
                                <div class="stat-label">Productos Comprados</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-header">
                                    <div class="stat-icon"><i class="fas fa-heart" style="color:#8b5cf6;"></i></div>
                                </div>
                                <div class="stat-value" id="stat-favoritos">0</div>
                                <div class="stat-label">Favoritos Guardados</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-header">
                                    <div class="stat-icon"><i class="fas fa-gift" style="color:#8b5cf6;"></i></div>
                                </div>
                                <div class="stat-value skeleton" id="stat-saldo">$0.00</div>
                                <div class="stat-label">Saldo / Gift Cards</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-header">
                                    <div class="stat-icon"><i class="fas fa-user-circle" style="color:#8b5cf6;"></i></div>
                                </div>
                                <a href="account-settings.html" class="stat-value" style="font-size: 1.5rem; text-decoration: none; color: white;">Editar Perfil</a>
                                <div class="stat-label">Configuración de Cuenta</div>
                            </div>
                        </div>
                        <div class="section">
                            <div class="section-header">
                                <h2 class="section-title">Mis Compras Recientes</h2>
                                <a href="mis-compras.html" class="section-link">Ver todas →</a>
                            </div>
                            <div id="empty-compras-state" style="display:none; text-align:center;padding:48px 20px;background:rgba(255,255,255,.02);border:1px dashed rgba(255,255,255,.15);border-radius:12px;">
                                <div style="font-size:3.5rem;margin-bottom:18px;opacity:.5;color:#666;"><i class="fas fa-shopping-cart"></i></div>
                                <h3 style="color:#fff;margin-bottom:10px;font-size:1.2rem;font-weight:600;">Aún no has comprado nada</h3>
                                <p style="color:#666;margin-bottom:24px;line-height:1.6;font-size:.95rem;max-width:500px;margin-left:auto;margin-right:auto;">¡Tu librería de sonidos te espera! Explora el marketplace y encuentra tus próximos presets, beats y kits.</p>
                                <button onclick="window.location.href='/pages/presets-v2.html'" style="display:inline-flex;align-items:center;gap:8px;background:#8b5cf6;color:#fff;padding:12px 28px;border-radius:10px;font-weight:600;font-size:.9rem;border:none;cursor:pointer;transition:all .2s;" onmouseover="this.style.background='#7c3aed'" onmouseout="this.style.background='#8b5cf6'">
                                    <i class="fas fa-store"></i> Ir al Marketplace
                                </button>
                            </div>
                            <div class="products-grid" id="compras-grid">
                                </div>
                        </div>
                    `;
                }

                // 2. Ocultar skeletons que no se usarán
                hideSkeletonLoading(); // Limpia los skeletons del productor

                // 3. Cargar los datos del cliente
                loadGiftCardsState(); // Esta función ya la tenías, cargará el saldo
                loadMyPurchasedProducts(); // Esta es la nueva función que acabamos de añadir

                // (Opcional) Cargar favoritos (puedes crear una función para esto más adelante)
                const statFavoritos = document.getElementById('stat-favoritos');
                if (statFavoritos) statFavoritos.textContent = '0'; // Placeholder por ahora

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

    async function loadMyPurchasedProducts() {
        const grid = document.getElementById('compras-grid');
        const emptyState = document.getElementById('empty-compras-state');
        if (!grid || !emptyState) return;

        // Mostrar un skeleton simple mientras carga
        grid.innerHTML = `
            <div class="product-card skeleton" style="height:300px;"></div>
            <div class="product-card skeleton" style="height:300px;"></div>
            <div class="product-card skeleton" style="height:300px;"></div>
        `;
        emptyState.style.display = 'none';

        try {
            const response = await fetch(`${API_URL}/my-products`, { // ¡Este endpoint ya existe!
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('No se pudieron cargar tus compras.');

            const myProducts = await response.json();

            if (myProducts.length === 0) {
                // Mostrar estado vacío
                grid.innerHTML = '';
                emptyState.style.display = 'block';
                return;
            }

            // Si hay productos, ocultar estado vacío y construir la grilla
            emptyState.style.display = 'none';
            let productsHTML = '';

            // Mostrar solo los 3 más recientes en el dashboard
            myProducts.slice(0, 3).forEach(product => {
                productsHTML += `
                    <div class="product-card fade-in">
                        <div class="product-image" style="${product.image_url ? `background-image: url(${product.image_url}); background-size:cover;` : ''}">
                            ${!product.image_url ? '<i class="fas fa-music"></i>' : ''}
                            <span class="product-badge">${product.product_type || 'Preset'}</span>
                        </div>
                        <div class="product-info">
                            <div class="product-title">${product.name}</div>
                            <div class="product-meta">
                                </div>
                            <a href="${product.download_url || '#'}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:8px;background:#8b5cf6;color:#fff;padding:12px 28px;border-radius:10px;font-weight:600;font-size:.9rem;border:none;cursor:pointer;transition:all .2s;text-decoration:none;width:100%;justify-content:center;" onmouseover="this.style.background='#7c3aed'" onmouseout="this.style.background='#8b5cf6'">
                                <i class="fas fa-download"></i> Descargar
                            </a>
                        </div>
                    </div>
                `;
            });
            grid.innerHTML = productsHTML;

            // Actualizar la tarjeta de "Productos Comprados"
            const statCompras = document.getElementById('stat-compras');
            if (statCompras) {
                statCompras.textContent = myProducts.length;
                statCompras.classList.remove('skeleton');
            }

        } catch (error) {
            console.error("Error cargando productos comprados:", error);
            grid.innerHTML = `<p style="color:red;grid-column:1/-1;">Error al cargar tus compras: ${error.message}</p>`;
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