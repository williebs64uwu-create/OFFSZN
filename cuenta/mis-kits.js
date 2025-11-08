document.addEventListener('DOMContentLoaded', async () => {

    // ---------- ELEMENTOS DEL DOM ----------
    const profileAvatar = document.querySelector('.profile-avatar');
    const profileName = document.querySelector('.profile-name');
    const walletAmount = document.querySelector('.wallet-amount');
    const statsValues = document.querySelectorAll('.stat-value');
    const productsGrid = document.getElementById('products-grid');
    const emptyState = document.getElementById('empty-state');
    const token = localStorage.getItem('authToken');
    let userData = null;

    // ---------- GIFT CARDS STATE ----------
    const STORAGE_KEY = 'offszn_giftcards_state';
    const CACHE_KEY = 'offszn_user_cache';
    let appState = { totalBalance: 0, giftCards: [] };

    // ---------- API URL ----------
    let API_URL = '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_URL = 'http://localhost:3000/api';
    } else {
        API_URL = 'https://offszn-academy.onrender.com/api';
    }

    // ---------- VERIFICAR TOKEN ----------
    if (!token) {
        console.error("Mis Kits: No hay token, redirigiendo al login.");
        window.location.replace('/pages/login.html');
        return;
    }

    // ---------- SKELETON LOADING ----------
    function showSkeletonLoading() {
        // Skeleton en avatar
        if (profileAvatar) profileAvatar.classList.add('skeleton');
        
        // Skeleton en wallet
        if (walletAmount) {
            walletAmount.classList.add('skeleton');
            walletAmount.textContent = '$000.00';
        }

        // Skeleton en stats
        statsValues.forEach(el => {
            el.classList.add('skeleton');
            el.textContent = '000';
        });

        // Skeleton en productos
        if (productsGrid) {
            productsGrid.style.display = 'grid';
            productsGrid.innerHTML = `
                <div class="product-card skeleton" style="height:400px;"></div>
                <div class="product-card skeleton" style="height:400px;"></div>
                <div class="product-card skeleton" style="height:400px;"></div>
            `;
        }
        
        if (emptyState) emptyState.style.display = 'none';
    }

    function hideSkeletonLoading() {
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
                updateUserUI(cachedData, true);
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

    // ---------- ACTUALIZAR UI DE USUARIO ----------
    function updateUserUI(userData, fromCache = false) {
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

    // ---------- GIFT CARDS ----------
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

    // ---------- CARGAR DATOS DEL DASHBOARD ----------
    async function loadDashboardData() {
        try {
            // Cargar datos del usuario
            const userResponse = await fetch(`${API_URL}/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!userResponse.ok) {
                localStorage.removeItem('authToken');
                throw new Error(`Error ${userResponse.status}: No se pudieron obtener los datos del usuario.`);
            }

            userData = await userResponse.json();
            console.log("Datos del usuario:", userData);

            localStorage.setItem('userId', userData.id);
            saveUserCache(userData);
            updateUserUI(userData, false);
            loadGiftCardsState();

            // Cargar productos del productor
            await loadMyKits();

        } catch (error) {
            console.error("Error al cargar datos:", error);
            hideSkeletonLoading();

            if (error.message.includes('401') || error.message.includes('403')) {
                localStorage.removeItem('authToken');
                localStorage.removeItem(CACHE_KEY);
                window.location.replace('/pages/login.html');
            }
        }
    }

    // ---------- CARGAR PRODUCTOS ----------
    async function loadMyKits() {
        if (!productsGrid || !emptyState) return;

        try {
            const response = await fetch(`${API_URL}/me/products`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('No se pudieron cargar tus productos.');

            const products = await response.json();
            console.log("Productos cargados:", products);

            // Actualizar stats
            updateStats(products);

            if (products.length === 0) {
                // Mostrar empty state
                productsGrid.style.display = 'none';
                productsGrid.innerHTML = '';
                emptyState.style.display = 'block';
                hideSkeletonLoading();
            } else {
                // Mostrar productos
                emptyState.style.display = 'none';
                productsGrid.style.display = 'grid';
                renderProducts(products);
                hideSkeletonLoading();
            }

        } catch (error) {
            console.error("Error cargando productos:", error);
            productsGrid.innerHTML = `<p style="color:red;grid-column:1/-1;">Error al cargar tus productos: ${error.message}</p>`;
            hideSkeletonLoading();
        }
    }

    // ---------- ACTUALIZAR ESTADÍSTICAS ----------
    function updateStats(products) {
        const stats = {
            total: products.length,
            views: products.reduce((sum, p) => sum + (p.views || 0), 0),
            sales: products.reduce((sum, p) => sum + (p.sales || 0), 0),
            revenue: products.reduce((sum, p) => sum + ((p.sales || 0) * parseFloat(p.price || 0)), 0)
        };

        const statElements = document.querySelectorAll('.stat-value');
        if (statElements[0]) statElements[0].textContent = stats.total;
        if (statElements[1]) statElements[1].textContent = stats.views.toLocaleString();
        if (statElements[2]) statElements[2].textContent = stats.sales;
        if (statElements[3]) statElements[3].textContent = `$${stats.revenue.toFixed(2)}`;
    }

    // ---------- RENDERIZAR PRODUCTOS ----------
    function renderProducts(products) {
        const productHTML = products.map(product => `
            <div class="product-card fade-in">
                <div class="product-image" style="${product.image_url ? `background-image: url(${product.image_url}); background-size:cover; background-position:center;` : ''}">
                    ${!product.image_url ? '<i class="fas fa-music"></i>' : ''}
                    <span class="product-badge">${product.product_type || 'Kit'}</span>
                    <span class="product-status ${product.status || 'active'}">
                        <i class="fas fa-circle" style="font-size:.5rem;"></i>
                        ${product.status === 'draft' ? 'Borrador' : 'Activo'}
                    </span>
                </div>
                <div class="product-info">
                    <div class="product-title">${product.name}</div>
                    <div class="product-meta">
                        ${product.bpm ? `<span><i class="fas fa-tachometer-alt"></i> ${product.bpm} BPM</span>` : ''}
                        ${product.key ? `<span><i class="fas fa-music"></i> ${product.key}</span>` : ''}
                        ${!product.bpm && !product.key ? `<span><i class="fas fa-calendar"></i> ${new Date(product.created_at).toLocaleDateString()}</span>` : ''}
                    </div>
                    <div class="product-price">$${parseFloat(product.price || 0).toFixed(2)}</div>
                    <div class="product-stats">
                        <span><i class="fas fa-eye"></i> ${product.views || 0}</span>
                        <span><i class="fas fa-shopping-bag"></i> ${product.sales || 0}</span>
                        <span><i class="fas fa-heart"></i> ${product.likes || 0}</span>
                    </div>
                </div>
                <div class="product-actions">
                    <button class="action-btn" onclick="editProduct(${product.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="action-btn" onclick="viewProduct(${product.id})">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                    <button class="action-btn danger" onclick="deleteProduct(${product.id}, '${product.name}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        productsGrid.innerHTML = productHTML;
    }

    // ---------- FUNCIONES DE ACCIONES ----------
    window.editProduct = function(id) {
        console.log('Editar producto:', id);
        window.location.href = `editar-producto.html?id=${id}`;
    };

    window.viewProduct = function(id) {
        console.log('Ver producto:', id);
        window.location.href = `producto.html?id=${id}`;
    };

    window.deleteProduct = async function(id, name) {
        if (!confirm(`¿Estás seguro de eliminar "${name}"? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/products/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('No se pudo eliminar el producto.');

            alert('Producto eliminado exitosamente');
            loadMyKits(); // Recargar la lista

        } catch (error) {
            console.error('Error eliminando producto:', error);
            alert('Error al eliminar el producto: ' + error.message);
        }
    };

    // ---------- FILTROS ----------
    const filterType = document.getElementById('filter-type');
    const filterStatus = document.getElementById('filter-status');
    const filterSort = document.getElementById('filter-sort');

    if (filterType) {
        filterType.addEventListener('change', applyFilters);
    }
    if (filterStatus) {
        filterStatus.addEventListener('change', applyFilters);
    }
    if (filterSort) {
        filterSort.addEventListener('change', applyFilters);
    }

    async function applyFilters() {
        // Aquí puedes implementar la lógica de filtrado
        console.log('Aplicando filtros:', {
            type: filterType?.value,
            status: filterStatus?.value,
            sort: filterSort?.value
        });
        // Recargar productos con filtros
        await loadMyKits();
    }

    // ---------- VIEW TOGGLE ----------
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const view = btn.dataset.view;
            // Implementar cambio de vista aquí
            console.log('Cambiar vista a:', view);
        });
    });

    // ---------- LOGOUT HANDLER ----------
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

    // Attach logout handlers
    const sidebarLogoutButton = document.getElementById('sidebar-logout-btn');
    if (sidebarLogoutButton) {
        sidebarLogoutButton.addEventListener('click', handleLogout);
    }

    const navbarLogoutButton = document.getElementById('navbar-logout-btn');
    if (navbarLogoutButton) {
        navbarLogoutButton.addEventListener('click', handleLogout);
    }

    // ---------- DROPDOWN TOGGLE ----------
    window.toggleUserDropdown = function() {
        const dropdown = document.querySelector('.user-dropdown');
        dropdown.classList.toggle('active');
    };

    // Close dropdown on outside click
    document.addEventListener('click', e => {
        const userDropdown = document.querySelector('.user-dropdown');
        const userBtn = document.querySelector('.user-dropdown .navbar-icon-button');
        if (!userDropdown.contains(e.target) && e.target !== userBtn) {
            userDropdown.classList.remove('active');
        }
    });

    // ---------- INICIALIZACIÓN ----------
    showSkeletonLoading();
    loadCachedUser(); // Cargar caché primero (instantáneo)
    loadDashboardData(); // Luego cargar datos frescos

});
