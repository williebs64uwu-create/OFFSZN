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
        console.log('🚀 Iniciando Colaboraciones...');
        
        // Cargar datos del usuario desde API (con skeleton loading)
        await loadUserData();
        
        console.log('✅ Colaboraciones inicializado correctamente');
    }

    // Iniciar la app
    await initApp();

    // ===== AUTO-GUARDAR PERIÓDICO (por si acaso) =====
    setInterval(() => {
        // Recargar balance por si cambió en otra pestaña
        const balance = loadBalance();
        const sidebarWallet = document.querySelector('.wallet-amount');
        if (sidebarWallet && !sidebarWallet.classList.contains('skeleton-text')) {
            sidebarWallet.textContent = `$${balance.toFixed(2)}`;
        }
    }, 5000); // Cada 5 segundos
});
