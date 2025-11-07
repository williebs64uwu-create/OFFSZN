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
        
        // ===== ACTUALIZAR SIDEBAR =====
        // Avatar en sidebar
        const profileAvatar = document.querySelector('.profile-avatar');
        if (profileAvatar) {
            profileAvatar.classList.remove('skeleton-avatar');
            const initial = (userData.first_name || userData.nickname || 'U').charAt(0).toUpperCase();
            profileAvatar.textContent = initial;
        }

        // Nombre en sidebar
        const profileName = document.querySelector('.profile-name');
        if (profileName) {
            profileName.classList.remove('skeleton-text');
            profileName.textContent = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.nickname || 'Usuario';
        }

        // Balance en sidebar
        const sidebarWallet = document.querySelector('.wallet-amount');
        if (sidebarWallet) {
            sidebarWallet.classList.remove('skeleton-text');
            sidebarWallet.textContent = `$${balance.toFixed(2)}`;
        }

        // ===== ACTUALIZAR NAVBAR DROPDOWN =====
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

    // ===== CARGAR KITS DEL USUARIO (TODO: Conectar con backend) =====
    async function loadUserKits() {
        try {
            // TODO: Cuando el backend esté listo, hacer:
            // const response = await fetch(`${API_URL}/kits/my-kits`, {
            //     headers: { 'Authorization': `Bearer ${token}` }
            // });
            // const kits = await response.json();
            
            // Por ahora, datos de ejemplo:
            const kits = [
                {
                    id: 1,
                    name: "Trap Essentials Vol. 1",
                    price: 29.99,
                    sales: 156,
                    status: "Published",
                    createdAt: "2024-01-15",
                    image: "https://via.placeholder.com/300x300/8b5cf6/ffffff?text=Trap+Kit"
                },
                {
                    id: 2,
                    name: "Melodic Drill Pack",
                    price: 39.99,
                    sales: 89,
                    status: "Published",
                    createdAt: "2024-02-10",
                    image: "https://via.placeholder.com/300x300/6366f1/ffffff?text=Drill+Kit"
                },
                {
                    id: 3,
                    name: "Lo-Fi Dreams Bundle",
                    price: 19.99,
                    sales: 234,
                    status: "Draft",
                    createdAt: "2024-03-05",
                    image: "https://via.placeholder.com/300x300/ec4899/ffffff?text=LoFi+Kit"
                }
            ];
            
            renderKits(kits);
            
        } catch (error) {
            console.error('❌ Error cargando kits:', error);
        }
    }

    // ===== RENDERIZAR KITS =====
    function renderKits(kits) {
        const container = document.getElementById('kits-container');
        
        if (kits.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-16">
                    <i class="fas fa-music text-6xl text-zinc-600 mb-4"></i>
                    <h3 class="text-xl font-bold text-white mb-2">No tienes kits publicados</h3>
                    <p class="text-zinc-400 mb-6">Comienza subiendo tu primer kit al marketplace</p>
                    <button onclick="window.location.href='subir-kit.html'" class="bg-gradient-to-r from-violet-600 to-violet-500 text-white px-8 py-3 rounded-lg font-bold hover:shadow-lg hover:shadow-violet-500/50 transition-all">
                        <i class="fas fa-cloud-upload-alt mr-2"></i>
                        Subir Mi Primer Kit
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = kits.map(kit => {
            const statusColors = {
                'Published': 'bg-green-500/10 text-green-400 border-green-500/20',
                'Draft': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
                'Archived': 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
            };
            
            return `
                <div class="bg-[rgba(26,10,46,0.4)] border border-violet-900/40 rounded-xl overflow-hidden transition-all duration-300 hover:border-violet-700 hover:shadow-xl hover:shadow-violet-900/40 hover:-translate-y-1">
                    <div class="relative aspect-square bg-gradient-to-br from-violet-900/30 to-violet-600/20 overflow-hidden">
                        <img src="${kit.image}" alt="${kit.name}" class="w-full h-full object-cover" />
                        <div class="absolute top-3 right-3">
                            <span class="inline-block px-3 py-1 rounded-full text-xs font-bold border ${statusColors[kit.status]}">
                                ${kit.status}
                            </span>
                        </div>
                    </div>
                    <div class="p-4">
                        <h3 class="font-bold text-white text-lg mb-2 truncate">${kit.name}</h3>
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-2xl font-bold text-violet-400">$${kit.price}</span>
                            <span class="text-sm text-zinc-400">
                                <i class="fas fa-shopping-cart mr-1"></i>
                                ${kit.sales} ventas
                            </span>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="openEditModal('${kit.name}')" class="flex-1 bg-violet-500/10 border border-violet-500/20 text-violet-300 py-2 rounded-lg text-sm font-semibold hover:bg-violet-500/20 transition-colors">
                                <i class="fas fa-edit mr-1"></i> Editar
                            </button>
                            <button class="px-3 bg-white/5 border border-white/10 text-zinc-400 rounded-lg text-sm hover:bg-white/10 transition-colors">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ===== MODAL DE EDICIÓN =====
    window.openEditModal = function(kitName) {
        document.getElementById('editing-kit-name').textContent = kitName;
        document.getElementById('edit-modal').classList.remove('hidden');
    };

    window.closeEditModal = function() {
        document.getElementById('edit-modal').classList.add('hidden');
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

    // ===== FILTROS Y BÚSQUEDA =====
    window.filterStatus = function(status) {
        const buttons = document.querySelectorAll('.status-filter');
        buttons.forEach(btn => {
            btn.classList.remove('bg-violet-600', 'text-white');
            btn.classList.add('bg-white/5', 'text-zinc-400');
        });
        event.target.classList.remove('bg-white/5', 'text-zinc-400');
        event.target.classList.add('bg-violet-600', 'text-white');
        console.log('📊 Filtrando por:', status);
        // TODO: Implementar lógica de filtrado
    };

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            console.log('🔍 Buscando:', e.target.value);
            // TODO: Implementar lógica de búsqueda
        });
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            console.log('🔄 Ordenando por:', e.target.value);
            // TODO: Implementar lógica de ordenamiento
        });
    }

    // ===== INICIALIZACIÓN =====
    async function initApp() {
        console.log('🚀 Iniciando Mis Kits...');
        
        // Cargar datos del usuario desde API (con skeleton loading)
        await loadUserData();
        
        // Cargar kits del usuario
        await loadUserKits();
        
        console.log('✅ Mis Kits inicializado correctamente');
    }

    // Iniciar la app
    await initApp();

    // ===== AUTO-GUARDAR PERIÓDICO =====
    setInterval(() => {
        // Recargar balance por si cambió en otra pestaña
        const balance = loadBalance();
        const sidebarWallet = document.querySelector('.wallet-amount');
        if (sidebarWallet && !sidebarWallet.classList.contains('skeleton-text')) {
            sidebarWallet.textContent = `$${balance.toFixed(2)}`;
        }
    }, 5000); // Cada 5 segundos
});
