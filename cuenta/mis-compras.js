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

    // ===== ESTADO GLOBAL =====
    let allPurchases = [];
    let currentFilter = 'all';

    // ===== CARGAR DATOS DEL USUARIO DESDE API =====
    async function loadUserData() {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const cachedData = JSON.parse(cached);
                updateUserUI(cachedData);
            }

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

    // ===== CARGAR BALANCE DESDE GIFT CARDS =====
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
        
        // Sidebar
        const profileAvatar = document.querySelector('.profile-avatar');
        if (profileAvatar) {
            profileAvatar.classList.remove('skeleton-avatar');
            const initial = (userData.first_name || userData.nickname || 'U').charAt(0).toUpperCase();
            profileAvatar.textContent = initial;
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
            const initial = (userData.first_name || userData.nickname || 'U').charAt(0).toUpperCase();
            dropdownAvatar.textContent = initial;
        }

        console.log('✅ UI actualizada con datos reales');
    }

    // ===== CARGAR COMPRAS DEL USUARIO =====
    async function loadPurchases() {
        try {
            // TODO: Cuando el backend esté listo, hacer:
            // const response = await fetch(`${API_URL}/purchases/my-purchases`, {
            //     headers: { 'Authorization': `Bearer ${token}` }
            // });
            // const purchases = await response.json();
            
            // Por ahora, datos de ejemplo realistas:
            const purchases = [
                {
                    id: 1,
                    name: "Dark Trap Essentials",
                    type: "kits",
                    seller: "ProdByNova",
                    price: 29.99,
                    purchaseDate: "2024-10-15",
                    image: "https://via.placeholder.com/300x300/8b5cf6/ffffff?text=Trap+Kit",
                    downloadUrl: "#"
                },
                {
                    id: 2,
                    name: "Melodic Drill Beat Pack",
                    type: "beats",
                    seller: "BeatsByLeo",
                    price: 49.99,
                    purchaseDate: "2024-10-20",
                    image: "https://via.placeholder.com/300x300/6366f1/ffffff?text=Drill+Beat",
                    downloadUrl: "#"
                },
                {
                    id: 3,
                    name: "Serum Lo-Fi Presets",
                    type: "presets",
                    seller: "SoundDesignPro",
                    price: 19.99,
                    purchaseDate: "2024-11-01",
                    image: "https://via.placeholder.com/300x300/ec4899/ffffff?text=Presets",
                    downloadUrl: "#"
                },
                {
                    id: 4,
                    name: "Vocal Chops & Samples",
                    type: "samples",
                    seller: "SampleLab",
                    price: 24.99,
                    purchaseDate: "2024-11-03",
                    image: "https://via.placeholder.com/300x300/f59e0b/ffffff?text=Samples",
                    downloadUrl: "#"
                },
                {
                    id: 5,
                    name: "808 Bass Collection",
                    type: "samples",
                    seller: "BassFactory",
                    price: 15.99,
                    purchaseDate: "2024-11-05",
                    image: "https://via.placeholder.com/300x300/10b981/ffffff?text=808s",
                    downloadUrl: "#"
                }
            ];
            
            allPurchases = purchases;
            updateStats(purchases);
            renderPurchases(purchases);
            
        } catch (error) {
            console.error('❌ Error cargando compras:', error);
            renderEmptyState();
        }
    }

    // ===== ACTUALIZAR ESTADÍSTICAS =====
    function updateStats(purchases) {
        const totalSpent = purchases.reduce((sum, p) => sum + p.price, 0);
        const totalProducts = purchases.length;
        const lastPurchase = purchases.length > 0 ? 
            new Date(purchases[purchases.length - 1].purchaseDate).toLocaleDateString('es-ES', { 
                day: 'numeric', 
                month: 'short' 
            }) : '-';

        document.getElementById('total-spent').textContent = `$${totalSpent.toFixed(2)}`;
        document.getElementById('total-products').textContent = totalProducts;
        document.getElementById('last-purchase').textContent = lastPurchase;
    }

    // ===== RENDERIZAR COMPRAS =====
    function renderPurchases(purchases) {
        const container = document.getElementById('purchases-container');
        
        if (purchases.length === 0) {
            renderEmptyState();
            return;
        }

        const typeLabels = {
            'kits': 'Drum Kit',
            'beats': 'Beat',
            'presets': 'Preset Pack',
            'samples': 'Sample Pack'
        };

        const typeColors = {
            'kits': 'from-violet-600 to-violet-500',
            'beats': 'from-blue-600 to-blue-500',
            'presets': 'from-pink-600 to-pink-500',
            'samples': 'from-amber-600 to-amber-500'
        };

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${purchases.map(purchase => `
                    <div class="purchase-card bg-[rgba(26,10,46,0.4)] border border-violet-900/40 rounded-xl overflow-hidden">
                        <div class="relative aspect-square bg-gradient-to-br from-violet-900/30 to-violet-600/20 overflow-hidden">
                            <img src="${purchase.image}" alt="${purchase.name}" class="w-full h-full object-cover" />
                            <div class="absolute top-3 left-3">
                                <span class="inline-block px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${typeColors[purchase.type]} text-white">
                                    ${typeLabels[purchase.type]}
                                </span>
                            </div>
                            <div class="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                <button onclick="downloadProduct('${purchase.name}')" class="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors">
                                    <i class="fas fa-download"></i>
                                    Descargar
                                </button>
                                <button onclick="viewDetails('${purchase.name}')" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors">
                                    <i class="fas fa-eye"></i>
                                    Ver
                                </button>
                            </div>
                        </div>
                        <div class="p-4">
                            <h3 class="font-bold text-white text-lg mb-1 truncate">${purchase.name}</h3>
                            <p class="text-sm text-zinc-400 mb-3">
                                <i class="fas fa-user mr-1"></i>
                                ${purchase.seller}
                            </p>
                            <div class="flex items-center justify-between pt-3 border-t border-white/10">
                                <div>
                                    <span class="text-xs text-zinc-500 block">Comprado el</span>
                                    <span class="text-sm text-white font-semibold">
                                        ${new Date(purchase.purchaseDate).toLocaleDateString('es-ES', { 
                                            day: 'numeric', 
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                                <div class="text-right">
                                    <span class="text-xs text-zinc-500 block">Precio</span>
                                    <span class="text-xl font-bold text-violet-400">$${purchase.price}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ===== RENDERIZAR ESTADO VACÍO =====
    function renderEmptyState() {
        const container = document.getElementById('purchases-container');
        container.innerHTML = `
            <div class="text-center py-20">
                <div class="mb-8">
                    <i class="fas fa-shopping-bag text-8xl text-violet-500/30"></i>
                </div>
                <h3 class="text-3xl font-bold text-white mb-4">Aún no has comprado nada</h3>
                <p class="text-zinc-400 text-lg mb-8 max-w-2xl mx-auto">
                    Explora beats, drum kits, presets y samples de productores talentosos.<br>
                    Todo lo que compres se guardará aquí para acceder fácilmente.
                </p>
                <a href="feed" class="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-violet-500 text-white px-8 py-4 rounded-lg font-bold text-lg hover:shadow-lg hover:shadow-violet-500/50 hover:-translate-y-0.5 transition-all">
                    <i class="fas fa-search"></i>
                    Explorar Contenido
                </a>
                
                <div class="bg-[rgba(26,10,46,0.4)] border border-violet-900/40 rounded-xl p-8 mt-12 max-w-4xl mx-auto">
                    <h4 class="text-xl font-bold text-violet-400 mb-6 flex items-center justify-center gap-2">
                        <i class="fas fa-lightbulb"></i>
                        Consejos para tu primera compra
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        <div class="flex gap-4">
                            <div class="flex-shrink-0 w-10 h-10 bg-violet-500/10 rounded-lg flex items-center justify-center">
                                <i class="fas fa-certificate text-violet-400"></i>
                            </div>
                            <div>
                                <h5 class="font-semibold text-white mb-1">Licencias Comerciales</h5>
                                <p class="text-sm text-zinc-400">Verifica las licencias si planeas usar en lanzamientos oficiales.</p>
                            </div>
                        </div>
                        <div class="flex gap-4">
                            <div class="flex-shrink-0 w-10 h-10 bg-violet-500/10 rounded-lg flex items-center justify-center">
                                <i class="fas fa-star text-violet-400"></i>
                            </div>
                            <div>
                                <h5 class="font-semibold text-white mb-1">Revisa Valoraciones</h5>
                                <p class="text-sm text-zinc-400">Lee reviews de otros productores antes de comprar.</p>
                            </div>
                        </div>
                        <div class="flex gap-4">
                            <div class="flex-shrink-0 w-10 h-10 bg-violet-500/10 rounded-lg flex items-center justify-center">
                                <i class="fas fa-gift text-violet-400"></i>
                            </div>
                            <div>
                                <h5 class="font-semibold text-white mb-1">Usa Gift Cards</h5>
                                <p class="text-sm text-zinc-400">Paga de forma segura y obtén descuentos exclusivos.</p>
                            </div>
                        </div>
                        <div class="flex gap-4">
                            <div class="flex-shrink-0 w-10 h-10 bg-violet-500/10 rounded-lg flex items-center justify-center">
                                <i class="fas fa-download text-violet-400"></i>
                            </div>
                            <div>
                                <h5 class="font-semibold text-white mb-1">Acceso Instantáneo</h5>
                                <p class="text-sm text-zinc-400">Descarga tus productos inmediatamente después de comprar.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ===== FILTRAR COMPRAS =====
    window.filterPurchases = function(type) {
        currentFilter = type;
        const buttons = document.querySelectorAll('.purchase-filter');
        buttons.forEach(btn => {
            btn.classList.remove('bg-violet-600', 'text-white');
            btn.classList.add('bg-white/5', 'text-zinc-400');
        });
        event.target.classList.remove('bg-white/5', 'text-zinc-400');
        event.target.classList.add('bg-violet-600', 'text-white');

        const filtered = type === 'all' 
            ? allPurchases 
            : allPurchases.filter(p => p.type === type);
        
        renderPurchases(filtered);
        console.log('📊 Filtrando por:', type);
    };

    // ===== ACCIONES DE PRODUCTOS =====
    window.downloadProduct = function(productName) {
        console.log('📥 Descargando:', productName);
        alert(`Descargando: ${productName}\n\nEn producción, esto iniciará la descarga del archivo.`);
        // TODO: Implementar descarga real desde backend
    };

    window.viewDetails = function(productName) {
        console.log('👁️ Viendo detalles de:', productName);
        alert(`Viendo detalles de: ${productName}\n\nEn producción, esto abrirá la página del producto.`);
        // TODO: Redirigir a página de detalles del producto
    };

    // ===== FUNCIONES DE UI =====
    window.toggleUserDropdown = function() {
        const dropdown = document.querySelector('.user-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('active');
        }
    };

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', function(e) {
        const userDropdown = document.querySelector('.user-dropdown');
        if (userDropdown && !userDropdown.contains(e.target)) {
            userDropdown.classList.remove('active');
        }
    });

    // ===== LOGOUT =====
    const logoutLinks = document.querySelectorAll('a[href="logout"], .logout-btn');
    logoutLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            localStorage.removeItem(CACHE_KEY);
            alert('¡Has cerrado sesión!');
            window.location.replace('/pages/login.html');
        });
    });

    // ===== INICIALIZACIÓN =====
    async function initApp() {
        console.log('🚀 Iniciando Mis Compras...');
        
        // Cargar datos del usuario desde API
        await loadUserData();
        
        // Cargar compras del usuario
        await loadPurchases();
        
        console.log('✅ Mis Compras inicializado correctamente');
        console.log('💡 TODO: Conectar con endpoint /api/purchases/my-purchases cuando esté listo');
    }

    // Iniciar la app
    await initApp();

    // ===== AUTO-ACTUALIZAR BALANCE =====
    setInterval(() => {
        const balance = loadBalance();
        const sidebarWallet = document.querySelector('.wallet-amount');
        if (sidebarWallet && !sidebarWallet.classList.contains('skeleton-text')) {
            sidebarWallet.textContent = `$${balance.toFixed(2)}`;
        }
    }, 5000);
});
