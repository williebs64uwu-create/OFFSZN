document.addEventListener('DOMContentLoaded', async () => {
    
    const token = localStorage.getItem('authToken');
    const CACHE_KEY = 'offszn_user_cache';
    
    // ===== CONFIGURACIÓN DE API =====
    let API_URL = '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_URL = 'http://localhost:3000/api';
    } else {
        API_URL = 'https://offszn-academy.onrender.com/api';
    }

    // ===== VERIFICAR AUTH =====
    if (!token) {
        console.error("No hay token, redirigiendo al login.");
        window.location.replace('/pages/login.html');
        return;
    }

    // ===== CARGAR DATOS DEL USUARIO DESDE API =====
    async function loadUserData() {
        try {
            // Intentar cargar desde caché primero (para skeleton loading rápido)
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const cachedData = JSON.parse(cached);
                updateUserUI(cachedData);
            }

            // Cargar datos frescos del servidor
            const response = await fetch(`${API_URL}/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem(CACHE_KEY);
                    window.location.replace('/pages/login.html');
                    return;
                }
                throw new Error('Error al cargar datos del usuario');
            }

            const userData = await response.json();
            console.log('✅ Datos del usuario cargados desde API:', userData);
            
            // Guardar en caché
            localStorage.setItem(CACHE_KEY, JSON.stringify(userData));
            updateUserUI(userData);

        } catch (error) {
            console.error('❌ Error cargando usuario desde API:', error);
        }
    }

    // ===== ACTUALIZAR UI CON DATOS DEL USUARIO =====
    function updateUserUI(userData) {
        const userInitial = (userData.first_name || userData.nickname || 'U').charAt(0).toUpperCase();
        
        // Actualizar avatares en navbar
        const navbarAvatar = document.querySelector('.navbar-user-avatar');
        if (navbarAvatar) {
            navbarAvatar.classList.remove('skeleton-avatar');
            navbarAvatar.textContent = userInitial;
        }

        const navbarAvatarDropdown = document.querySelector('.navbar-user-avatar-dropdown');
        if (navbarAvatarDropdown) {
            navbarAvatarDropdown.classList.remove('skeleton-avatar');
            navbarAvatarDropdown.textContent = userInitial;
        }

        // Actualizar nombre en navbar dropdown
        const navbarUserName = document.querySelector('.navbar-user-name');
        if (navbarUserName) {
            navbarUserName.classList.remove('skeleton-text');
            navbarUserName.textContent = userData.nickname || userData.first_name || 'Usuario';
        }

        // Actualizar email en navbar dropdown
        const navbarUserEmail = document.querySelector('.navbar-user-email');
        if (navbarUserEmail) {
            navbarUserEmail.classList.remove('skeleton-text');
            navbarUserEmail.textContent = userData.email || 'usuario@offszn.com';
        }

        // Actualizar avatar en sidebar
        const sidebarAvatar = document.querySelector('.sidebar-user-avatar');
        if (sidebarAvatar) {
            sidebarAvatar.classList.remove('skeleton-avatar');
            sidebarAvatar.textContent = userInitial;
        }

        // Actualizar nombre en sidebar
        const sidebarUserName = document.querySelector('.sidebar-user-name');
        if (sidebarUserName) {
            sidebarUserName.classList.remove('skeleton-text');
            sidebarUserName.textContent = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.nickname || 'Usuario';
        }

        // Actualizar balance en sidebar
        const sidebarBalance = document.querySelector('.sidebar-wallet-balance');
        if (sidebarBalance) {
            sidebarBalance.classList.remove('skeleton-text', 'skeleton-balance');
            // TODO: Conectar con balance real cuando esté disponible en el backend
            sidebarBalance.textContent = '$0.00';
        }
    }

    // ===== TOGGLE USER DROPDOWN =====
    window.toggleUserDropdown = function() {
        const dropdown = document.querySelector('.user-dropdown-menu');
        if (dropdown) {
            dropdown.classList.toggle('hidden');
        }
    };

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', function(e) {
        const dropdown = document.querySelector('.user-dropdown-menu');
        const button = document.querySelector('.navbar-user-avatar');
        
        if (dropdown && !dropdown.contains(e.target) && e.target !== button) {
            dropdown.classList.add('hidden');
        }
    });

    // ===== LOGOUT =====
    const logoutBtns = document.querySelectorAll('.logout-btn');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            localStorage.removeItem(CACHE_KEY);
            alert('¡Has cerrado sesión!');
            window.location.replace('/pages/login.html');
        });
    });

    // ===== MOCK DATA PARA FAVORITOS (TEMPORAL) =====
    // TODO: Reemplazar con llamada real a API cuando esté disponible
    // Endpoint sugerido: GET /api/favorites
    const generateMockKits = () => {
        const kitNames = [
            "Reggaeton Flow Vol. 1", 
            "Trap Essentials 2024", 
            "Lo-Fi Dreams", 
            "Synthwave Odyssey",
            "Drill UK Madness"
        ];
        
        return kitNames.map((name, index) => ({
            id: `kit-${index + 1}`,
            name: name,
            imageUrl: `https://picsum.photos/seed/${name.replace(/\s+/g, '-')}/400/300`,
            price: parseFloat((Math.random() * 20 + 10).toFixed(2)),
            sales: Math.floor(Math.random() * 500),
            createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        }));
    };

    let favoriteKits = [];

    // ===== CARGAR FAVORITOS =====
    async function loadFavoriteKits() {
        try {
            console.log('📦 Cargando favoritos...');
            
            // TODO: Reemplazar con llamada real a la API
            // const response = await fetch(`${API_URL}/favorites`, {
            //     headers: { 'Authorization': `Bearer ${token}` }
            // });
            // const data = await response.json();
            // favoriteKits = data.favorites;
            
            // Simulando carga con datos mock
            await new Promise(resolve => setTimeout(resolve, 1500));
            favoriteKits = generateMockKits();
            
            console.log('✅ Favoritos cargados:', favoriteKits.length, 'kits');
            renderKits(favoriteKits);
        } catch (error) {
            console.error('❌ Error cargando favoritos:', error);
            renderEmptyState();
        }
    }

    // ===== RENDERIZAR KITS =====
    function renderKits(kits) {
        const container = document.getElementById('kits-container');
        
        if (!container) {
            console.error('❌ Container #kits-container no encontrado');
            return;
        }
        
        if (kits.length === 0) {
            renderEmptyState();
            return;
        }

        console.log('🎨 Renderizando', kits.length, 'kits');

        const html = `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                ${kits.map(kit => `
                    <div class="bg-[#131313] border border-white/10 rounded-xl overflow-hidden group transition-all duration-300 hover:border-violet-500/50 hover:shadow-2xl hover:shadow-violet-900/20">
                        <div class="relative">
                            <img src="${kit.imageUrl}" alt="${kit.name}" class="w-full h-40 object-cover" loading="lazy">
                            <div class="absolute top-2 right-2 text-red-500 bg-black/50 rounded-full h-8 w-8 flex items-center justify-center">
                                <i class="fas fa-heart"></i>
                            </div>
                        </div>
                        <div class="p-4">
                            <div class="flex justify-between items-start">
                                <h3 class="font-bold text-white mb-1 truncate pr-2" title="${kit.name}">${kit.name}</h3>
                                <div class="relative">
                                    <button class="text-gray-500 hover:text-white transition-colors h-6 w-6 rounded-full flex items-center justify-center hover:bg-white/10 kit-menu-btn" data-kit-id="${kit.id}">
                                        <i class="fas fa-ellipsis-v"></i>
                                    </button>
                                    <div class="kit-dropdown hidden absolute right-0 mt-2 w-48 bg-[#1f1f1f] border border-white/10 rounded-lg shadow-xl z-10 p-1.5">
                                        <a href="#" class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 rounded-md">
                                            <i class="fas fa-eye w-4"></i> Ver producto
                                        </a>
                                        <a href="#" class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 rounded-md">
                                            <i class="fas fa-shopping-cart w-4"></i> Añadir al carrito
                                        </a>
                                        <button class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 rounded-md mt-1 text-left remove-favorite-btn" data-kit-id="${kit.id}">
                                            <i class="fas fa-heart-broken w-4"></i> Quitar de Favoritos
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="flex justify-between items-center text-sm mt-3 pt-3 border-t border-white/10">
                                <div class="flex flex-col">
                                    <span class="text-xs text-gray-500">Precio</span>
                                    <span class="font-semibold text-green-400">${kit.price.toFixed(2)}</span>
                                </div>
                                <div class="flex flex-col items-end">
                                    <span class="text-xs text-gray-500">Ventas</span>
                                    <span class="font-semibold text-white">${kit.sales}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = html;

        // Agregar event listeners para los dropdowns de kits
        const menuBtns = document.querySelectorAll('.kit-menu-btn');
        menuBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = btn.nextElementSibling;
                
                // Cerrar otros dropdowns
                document.querySelectorAll('.kit-dropdown').forEach(d => {
                    if (d !== dropdown) d.classList.add('hidden');
                });
                
                dropdown.classList.toggle('hidden');
            });
        });

        // Agregar event listeners para quitar de favoritos
        const removeBtns = document.querySelectorAll('.remove-favorite-btn');
        removeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const kitId = btn.dataset.kitId;
                removeFavorite(kitId);
            });
        });

        // Cerrar dropdowns al hacer clic fuera
        const closeDropdowns = (e) => {
            if (!e.target.closest('.kit-menu-btn') && !e.target.closest('.kit-dropdown')) {
                document.querySelectorAll('.kit-dropdown').forEach(d => d.classList.add('hidden'));
            }
        };
        
        document.removeEventListener('click', closeDropdowns);
        document.addEventListener('click', closeDropdowns);
        
        console.log('✅ Kits renderizados correctamente');
    }

    // ===== RENDERIZAR ESTADO VACÍO =====
    function renderEmptyState() {
        const container = document.getElementById('kits-container');
        container.innerHTML = `
            <div class="text-center py-20 bg-white/5 rounded-xl border border-dashed border-white/10">
                <i class="far fa-heart text-6xl text-gray-600 mb-4"></i>
                <h3 class="text-2xl font-bold text-white">Tu lista de favoritos está vacía</h3>
                <p class="text-gray-400 mt-2 mb-6 max-w-md mx-auto">
                    Explora el marketplace y presiona el ícono del corazón en los kits que te gusten para guardarlos aquí.
                </p>
                <a href="/marketplace" class="inline-flex items-center gap-2 bg-violet-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-violet-700 transition-all transform hover:scale-105">
                    <i class="fas fa-store"></i> Explorar Marketplace
                </a>
            </div>
        `;
    }

    // ===== QUITAR DE FAVORITOS =====
    async function removeFavorite(kitId) {
        try {
            // TODO: Implementar llamada real a API
            // await fetch(`${API_URL}/favorites/${kitId}`, {
            //     method: 'DELETE',
            //     headers: { 'Authorization': `Bearer ${token}` }
            // });
            
            favoriteKits = favoriteKits.filter(kit => kit.id !== kitId);
            renderKits(favoriteKits);
            
            if (favoriteKits.length === 0) {
                renderEmptyState();
            }
        } catch (error) {
            console.error('❌ Error al quitar favorito:', error);
        }
    }

    // ===== BÚSQUEDA Y FILTRADO =====
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');

    function filterAndSortKits() {
        const searchTerm = searchInput.value.toLowerCase();
        const sortOrder = sortSelect.value;

        let filtered = favoriteKits.filter(kit => 
            kit.name.toLowerCase().includes(searchTerm)
        );

        filtered.sort((a, b) => {
            switch (sortOrder) {
                case 'createdAt_desc':
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case 'createdAt_asc':
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                case 'price_desc':
                    return b.price - a.price;
                case 'price_asc':
                    return a.price - b.price;
                default:
                    return 0;
            }
        });

        renderKits(filtered);
    }

    searchInput.addEventListener('input', filterAndSortKits);
    sortSelect.addEventListener('change', filterAndSortKits);

    // ===== INICIALIZACIÓN =====
    async function initApp() {
        console.log('🚀 Iniciando Favoritos...');
        
        // 1. Cargar datos del usuario desde API (con skeleton loading)
        await loadUserData();
        
        // 2. Cargar kits favoritos
        await loadFavoriteKits();
        
        console.log('✅ Favoritos inicializado correctamente');
        console.log('💡 TODO: Conectar con endpoints de backend cuando estén listos');
    }

    // Iniciar la app
    await initApp();
});
