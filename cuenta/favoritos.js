document.addEventListener('DOMContentLoaded', async () => {
    
    const token = localStorage.getItem('authToken');
    const CACHE_KEY = 'offszn_user_cache';
    const STORAGE_KEY = 'offszn_giftcards_state';
    
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
            // Intentar cargar desde caché primero
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
            
            localStorage.setItem(CACHE_KEY, JSON.stringify(userData));
            updateUserUI(userData);

        } catch (error) {
            console.error('❌ Error cargando usuario desde API:', error);
        }
    }

    // ===== CARGAR BALANCE =====
    function loadBalance() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const giftCardsState = JSON.parse(saved);
                return giftCardsState.totalBalance || 0;
            }
        } catch (error) {
            console.error('❌ Error al cargar balance:', error);
        }
        return 0;
    }

    // ===== ACTUALIZAR UI CON DATOS DEL USUARIO =====
    function updateUserUI(userData) {
        const balance = loadBalance();
        const userInitial = (userData.first_name || userData.nickname || 'U').charAt(0).toUpperCase();
        
        // Sidebar
        const profileAvatar = document.querySelector('.profile-avatar');
        if (profileAvatar) {
            profileAvatar.classList.remove('skeleton-avatar');
            profileAvatar.textContent = userInitial;
        }

        const profileName = document.querySelector('.profile-name');
        if (profileName) {
            profileName.classList.remove('skeleton-text');
            profileName.textContent = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.nickname || 'Usuario';
        }

        const sidebarWallet = document.querySelector('.wallet-amount');
        if (sidebarWallet) {
            sidebarWallet.classList.remove('skeleton-text');
            sidebarWallet.textContent = `$${balance.toFixed(2)}`;
        }

        // Navbar Dropdown
        const dropdownName = document.querySelector('.user-dropdown-name');
        const dropdownEmail = document.querySelector('.user-dropdown-email');
        const dropdownAvatar = document.querySelector('.user-dropdown-avatar');

        if (dropdownName) {
            dropdownName.classList.remove('skeleton-text');
            dropdownName.textContent = userData.nickname || userData.first_name || 'Usuario';
        }
        if (dropdownEmail) {
            dropdownEmail.classList.remove('skeleton-text');
            dropdownEmail.textContent = userData.email || 'usuario@offszn.com';
        }
        if (dropdownAvatar) {
            dropdownAvatar.classList.remove('skeleton-avatar');
            dropdownAvatar.textContent = userInitial;
        }

        console.log('✅ UI actualizada con datos reales');
    }

    // ===== MOCK DATA PARA FAVORITOS =====
    const generateMockKits = () => {
        const kitNames = [
            "Reggaeton Flow Vol. 1", 
            "Trap Essentials 2024", 
            "Lo-Fi Dreams", 
            "Synthwave Odyssey",
            "Drill UK Madness",
            "Future Bass Anthems",
            "EDM Power Pack",
            "Urban Latin Vibes"
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
            
            // Simulando carga
            await new Promise(resolve => setTimeout(resolve, 1500));
            favoriteKits = generateMockKits();
            
            console.log('✅ Favoritos cargados:', favoriteKits.length, 'kits');
            
            // Actualizar contador
            const totalFavs = document.getElementById('total-favorites');
            if (totalFavs) {
                totalFavs.textContent = favoriteKits.length;
            }
            
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
                    <div class="kit-card bg-gradient-to-br from-[rgba(26,10,46,0.6)] to-[rgba(15,10,35,0.6)] border border-pink-900/40 rounded-2xl overflow-hidden hover:border-pink-700 hover:shadow-2xl hover:shadow-pink-900/50 transition-all duration-300 relative group">
                        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-600 via-pink-500 to-pink-600" style="background-size: 200% 100%; animation: gradientShift 3s ease infinite;"></div>
                        
                        <div class="relative overflow-hidden">
                            <img src="${kit.imageUrl}" alt="${kit.name}" class="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy">
                            <div class="absolute top-3 right-3">
                                <button class="heart-pulse w-10 h-10 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-pink-500 hover:bg-pink-500 hover:text-white transition-all duration-300 remove-favorite-btn" data-kit-id="${kit.id}">
                                    <i class="fas fa-heart"></i>
                                </button>
                            </div>
                            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        </div>
                        
                        <div class="p-5">
                            <h3 class="font-bold text-white text-lg mb-2 truncate" title="${kit.name}">${kit.name}</h3>
                            
                            <div class="flex justify-between items-center pt-4 border-t border-white/10">
                                <div>
                                    <span class="block text-xs text-zinc-400 uppercase tracking-wide mb-0.5">Precio</span>
                                    <span class="text-xl font-bold text-pink-400">$${kit.price.toFixed(2)}</span>
                                </div>
                                <div class="text-right">
                                    <span class="block text-xs text-zinc-400 uppercase tracking-wide mb-0.5">Ventas</span>
                                    <span class="text-xl font-bold text-violet-400">${kit.sales}</span>
                                </div>
                            </div>
                            
                            <button class="mt-4 w-full bg-gradient-to-r from-pink-600 to-pink-500 text-white py-2.5 rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-pink-500/50 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2">
                                <i class="fas fa-shopping-cart"></i> Añadir al Carrito
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = html;

        // Event listeners para quitar de favoritos
        const removeBtns = document.querySelectorAll('.remove-favorite-btn');
        removeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const kitId = btn.dataset.kitId;
                removeFavorite(kitId);
            });
        });
        
        console.log('✅ Kits renderizados correctamente');
    }

    // ===== RENDERIZAR ESTADO VACÍO =====
    function renderEmptyState() {
        const container = document.getElementById('kits-container');
        container.innerHTML = `
            <div class="text-center py-20 bg-gradient-to-br from-[rgba(26,10,46,0.4)] to-[rgba(15,10,35,0.4)] border-2 border-dashed border-pink-900/40 rounded-2xl">
                <i class="fas fa-heart-broken text-7xl text-pink-500/30 mb-6"></i>
                <h3 class="font-montserrat text-3xl font-bold text-white mb-3">Tu lista de favoritos está vacía</h3>
                <p class="text-zinc-400 text-lg mb-8 max-w-md mx-auto leading-relaxed">
                    Explora el marketplace y presiona el <i class="fas fa-heart text-pink-500"></i> en los kits que te gusten para guardarlos aquí.
                </p>
                <a href="/marketplace" class="inline-flex items-center gap-3 bg-gradient-to-r from-pink-600 to-pink-500 text-white font-bold px-8 py-3.5 rounded-lg hover:shadow-lg hover:shadow-pink-500/50 hover:-translate-y-0.5 transition-all">
                    <i class="fas fa-store"></i> Explorar Marketplace
                </a>
            </div>
        `;
    }

    // ===== QUITAR DE FAVORITOS =====
    async function removeFavorite(kitId) {
        try {
            console.log('🗑️ Quitando favorito:', kitId);
            
            favoriteKits = favoriteKits.filter(kit => kit.id !== kitId);
            console.log('✅ Favorito eliminado. Quedan:', favoriteKits.length);
            
            // Actualizar contador
            const totalFavs = document.getElementById('total-favorites');
            if (totalFavs) {
                totalFavs.textContent = favoriteKits.length;
            }
            
            if (favoriteKits.length === 0) {
                renderEmptyState();
            } else {
                renderKits(favoriteKits);
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

    // ===== TOGGLE USER DROPDOWN =====
    window.toggleUserDropdown = function() {
        const dropdown = document.querySelector('.user-dropdown-menu');
        if (dropdown) {
            dropdown.classList.toggle('opacity-0');
            dropdown.classList.toggle('invisible');
            dropdown.classList.toggle('-translate-y-2');
        }
    };

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', function(e) {
        const dropdown = document.querySelector('.user-dropdown-menu');
        const userDropdown = document.querySelector('.user-dropdown');
        
        if (dropdown && userDropdown && !userDropdown.contains(e.target)) {
            dropdown.classList.add('opacity-0', 'invisible', '-translate-y-2');
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

    // ===== INICIALIZACIÓN =====
    async function initApp() {
        console.log('🚀 Iniciando Favoritos...');
        
        // 1. Cargar datos del usuario
        await loadUserData();
        
        // 2. Cargar kits favoritos
        await loadFavoriteKits();
        
        console.log('✅ Favoritos inicializado correctamente');
        console.log('💡 TODO: Conectar con endpoints de backend cuando estén listos');
    }

    // Iniciar la app
    await initApp();

    // Auto-actualizar balance cada 5 segundos
    setInterval(() => {
        const balance = loadBalance();
        const sidebarWallet = document.querySelector('.wallet-amount');
        if (sidebarWallet && !sidebarWallet.classList.contains('skeleton-text')) {
            sidebarWallet.textContent = `$${balance.toFixed(2)}`;
        }
    }, 5000);
});
