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
        // Sidebar
        const sidebarName = document.getElementById('sidebar-name');
        const sidebarAvatar = document.getElementById('sidebar-avatar');
        const sidebarWallet = document.getElementById('sidebar-wallet');

        if (sidebarName) {
            sidebarName.classList.remove('skeleton-text');
            sidebarName.textContent = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.nickname || 'Usuario';
        }

        if (sidebarAvatar) {
            sidebarAvatar.classList.remove('skeleton-avatar');
            const initial = (userData.first_name || userData.nickname || 'U').charAt(0).toUpperCase();
            sidebarAvatar.textContent = initial;
        }

        if (sidebarWallet) {
            sidebarWallet.classList.remove('skeleton-text');
            sidebarWallet.textContent = `$${(userData.walletBalance || 0).toFixed(2)}`;
        }

        // Navbar dropdown
        const navbarAvatar = document.getElementById('navbar-avatar');
        const dropdownAvatar = document.getElementById('dropdown-avatar');
        const dropdownName = document.getElementById('dropdown-name');
        const dropdownEmail = document.getElementById('dropdown-email');

        const initial = (userData.first_name || userData.nickname || 'U').charAt(0).toUpperCase();

        if (navbarAvatar) {
            navbarAvatar.textContent = initial;
        }

        if (dropdownAvatar) {
            dropdownAvatar.classList.remove('skeleton-avatar');
            dropdownAvatar.textContent = initial;
        }

        if (dropdownName) {
            dropdownName.classList.remove('skeleton-text');
            dropdownName.textContent = userData.nickname || userData.first_name || 'Usuario';
        }

        if (dropdownEmail) {
            dropdownEmail.classList.remove('skeleton-text');
            dropdownEmail.textContent = userData.email || 'usuario@offszn.com';
        }
    }

    // ===== MOCK DATA DE KITS (mantener como estaba) =====
    const KitStatus = {
        Published: 'Published',
        Draft: 'Draft',
        Archived: 'Archived',
    };

    function generateMockKits() {
        const statuses = [KitStatus.Published, KitStatus.Draft, KitStatus.Archived];
        const kitNames = [
            "Reggaeton Flow Vol. 1", "Trap Essentials 2024", "Lo-Fi Dreams", "Synthwave Odyssey",
            "Drill UK Madness", "Future Bass Anthems", "EDM Power Pack", "Acoustic Gems", "Urban Latin Vibes"
        ];
        return kitNames.map((name, index) => ({
            id: `kit-${index + 1}`,
            name: name,
            imageUrl: `https://picsum.photos/seed/${name.replace(/\s+/g, '-')}/400/300`,
            price: parseFloat((Math.random() * 20 + 10).toFixed(2)),
            sales: Math.floor(Math.random() * 500),
            status: statuses[index % statuses.length],
            createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        }));
    }

    let allKits = [];
    let filteredKits = [];
    let currentStatusFilter = 'All';
    let currentSearchTerm = '';
    let currentSortOrder = 'createdAt_desc';

    // ===== CARGAR KITS =====
    async function loadKits() {
        const container = document.getElementById('kits-container');
        
        // Mostrar skeletons
        container.innerHTML = Array.from({ length: 8 }).map(() => `
            <div class="bg-[#131313] border border-white/10 rounded-xl overflow-hidden animate-pulse">
                <div class="w-full h-40 bg-white/10"></div>
                <div class="p-4">
                    <div class="h-5 w-3/4 rounded bg-white/10 mb-2"></div>
                    <div class="mt-4 pt-3 border-t border-white/10 flex justify-between">
                        <div class="space-y-2">
                            <div class="h-2 w-10 rounded bg-white/10"></div>
                            <div class="h-4 w-14 rounded bg-white/10"></div>
                        </div>
                        <div class="space-y-2 flex flex-col items-end">
                            <div class="h-2 w-8 rounded bg-white/10"></div>
                            <div class="h-4 w-12 rounded bg-white/10"></div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Simular carga de kits
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        allKits = generateMockKits();
        filteredKits = [...allKits];
        renderKits();
    }

    // ===== RENDERIZAR KITS =====
    function renderKits() {
        const container = document.getElementById('kits-container');
        
        if (filteredKits.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-20 bg-white/5 rounded-xl">
                    <i class="fas fa-box-open text-5xl text-gray-600 mb-4"></i>
                    <h3 class="text-xl font-bold text-white">No se encontraron kits</h3>
                    <p class="text-gray-400 mt-2">Prueba a cambiar los filtros o sube tu primer kit.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredKits.map(kit => {
            const statusStyles = {
                [KitStatus.Published]: { bg: 'bg-green-500/10', text: 'text-green-400', icon: 'fa-check-circle' },
                [KitStatus.Draft]: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: 'fa-pencil-alt' },
                [KitStatus.Archived]: { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: 'fa-archive' },
            };
            const { bg, text, icon } = statusStyles[kit.status];

            return `
                <div class="bg-[#131313] border border-white/10 rounded-xl overflow-hidden group transition-all duration-300 hover:border-violet-500/50 hover:shadow-2xl hover:shadow-violet-900/20">
                    <div class="relative">
                        <img src="${kit.imageUrl}" alt="${kit.name}" class="w-full h-40 object-cover">
                        <div class="absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${bg} ${text} backdrop-blur-sm">
                            <i class="fas ${icon}"></i>
                            <span>${kit.status}</span>
                        </div>
                    </div>
                    <div class="p-4">
                        <div class="flex justify-between items-start">
                            <h3 class="font-bold text-white mb-1 truncate pr-2" title="${kit.name}">${kit.name}</h3>
                            <div class="relative">
                                <button onclick="toggleKitDropdown('${kit.id}')" class="text-gray-500 hover:text-white transition-colors h-6 w-6 rounded-full flex items-center justify-center hover:bg-white/10">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <div id="dropdown-${kit.id}" class="hidden absolute right-0 mt-2 w-40 bg-[#1f1f1f] border border-white/10 rounded-lg shadow-xl z-10 p-1.5">
                                    <button onclick="openEditModal('${kit.id}', '${kit.name}')" class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 rounded-md text-left">
                                        <i class="fas fa-edit w-4"></i> Editar
                                    </button>
                                    <a href="/analiticas" class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 rounded-md">
                                        <i class="fas fa-chart-bar w-4"></i> Analíticas
                                    </a>
                                    <a href="#" class="flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 rounded-md mt-1">
                                        <i class="fas fa-trash-alt w-4"></i> Eliminar
                                    </a>
                                </div>
                            </div>
                        </div>
                        <div class="flex justify-between items-center text-sm mt-3 pt-3 border-t border-white/10">
                            <div class="flex flex-col">
                                <span class="text-xs text-gray-500">Precio</span>
                                <span class="font-semibold text-green-400">$${kit.price.toFixed(2)}</span>
                            </div>
                            <div class="flex flex-col items-end">
                                <span class="text-xs text-gray-500">Ventas</span>
                                <span class="font-semibold text-white">${kit.sales}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ===== FILTROS Y BÚSQUEDA =====
    function applyFilters() {
        filteredKits = allKits.filter(kit => {
            const matchesSearch = kit.name.toLowerCase().includes(currentSearchTerm.toLowerCase());
            const matchesStatus = currentStatusFilter === 'All' || kit.status === currentStatusFilter;
            return matchesSearch && matchesStatus;
        });

        // Ordenar
        filteredKits.sort((a, b) => {
            switch (currentSortOrder) {
                case 'createdAt_desc':
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case 'createdAt_asc':
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                case 'sales_desc':
                    return b.sales - a.sales;
                case 'price_desc':
                    return b.price - a.price;
                case 'price_asc':
                    return a.price - b.price;
                default:
                    return 0;
            }
        });

        renderKits();
    }

    window.filterStatus = function(status) {
        currentStatusFilter = status;
        
        // Actualizar botones
        document.querySelectorAll('.status-filter').forEach(btn => {
            btn.classList.remove('bg-violet-600', 'text-white');
            btn.classList.add('bg-white/5', 'text-gray-400');
        });
        event.target.classList.remove('bg-white/5', 'text-gray-400');
        event.target.classList.add('bg-violet-600', 'text-white');
        
        applyFilters();
    };

    // ===== EVENT LISTENERS =====
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value;
            applyFilters();
        });
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSortOrder = e.target.value;
            applyFilters();
        });
    }

    // ===== DROPDOWN Y MODAL =====
    window.toggleUserDropdown = function() {
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('hidden');
        }
    };

    window.toggleKitDropdown = function(kitId) {
        const dropdown = document.getElementById(`dropdown-${kitId}`);
        
        // Cerrar otros dropdowns
        document.querySelectorAll('[id^="dropdown-kit-"]').forEach(d => {
            if (d.id !== `dropdown-${kitId}`) {
                d.classList.add('hidden');
            }
        });
        
        if (dropdown) {
            dropdown.classList.toggle('hidden');
        }
    };

    window.openEditModal = function(kitId, kitName) {
        const modal = document.getElementById('edit-modal');
        const nameElement = document.getElementById('editing-kit-name');
        
        if (modal && nameElement) {
            nameElement.textContent = kitName;
            modal.classList.remove('hidden');
        }
        
        // Cerrar dropdown
        document.getElementById(`dropdown-${kitId}`)?.classList.add('hidden');
    };

    window.closeEditModal = function() {
        const modal = document.getElementById('edit-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    };

    // Cerrar dropdowns al hacer clic fuera
    document.addEventListener('click', function(e) {
        if (!e.target.closest('[id^="dropdown-"]') && !e.target.closest('button')) {
            document.querySelectorAll('[id^="dropdown-"]').forEach(d => {
                d.classList.add('hidden');
            });
        }
    });

    // ===== INICIALIZACIÓN =====
    async function initApp() {
        console.log('🚀 Iniciando Mis Kits...');
        
        // 1. Cargar datos del usuario desde API
        await loadUserData();
        
        // 2. Cargar kits
        await loadKits();
        
        console.log('✅ Mis Kits inicializado correctamente');
    }

    // Iniciar la app
    await initApp();
});
