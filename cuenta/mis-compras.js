document.addEventListener('DOMContentLoaded', async () => {
    
    const token = localStorage.getItem('authToken');
    const STORAGE_KEY = 'offszn_giftcards_state';
    const CACHE_KEY = 'offszn_user_cache';

    // ---------- API URL ----------
    let API_URL = '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_URL = 'http://localhost:3000/api';
    } else {
        API_URL = 'https://offszn-academy.onrender.com/api';
    }

    // ---------- VERIFICAR AUTH ----------
    if (!token) {
        console.error("No hay token, redirigiendo al login.");
        window.location.replace('/pages/login.html');
        return;
    }

    // ---------- CARGAR DATOS DEL USUARIO ----------
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
            console.log('Datos del usuario:', userData);
            
            // Guardar en caché
            localStorage.setItem(CACHE_KEY, JSON.stringify(userData));
            updateUserUI(userData);

        } catch (error) {
            console.error('Error cargando usuario:', error);
            // Mantener skeletons si hay error
        }
    }

    // ---------- ACTUALIZAR UI CON DATOS DEL USUARIO ----------
    function updateUserUI(userData) {
        // Actualizar nombre en sidebar
        const profileName = document.querySelector('.profile-name');
        if (profileName) {
            profileName.classList.remove('skeleton-text');
            profileName.textContent = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.nickname || 'Usuario';
        }

        // Actualizar avatar en sidebar
        const profileAvatar = document.querySelector('.profile-avatar');
        if (profileAvatar) {
            profileAvatar.classList.remove('skeleton-avatar');
            const initial = (userData.first_name || userData.nickname || 'U').charAt(0).toUpperCase();
            profileAvatar.textContent = initial;
        }

        // Actualizar dropdown de usuario
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
    }

    // ---------- CARGAR SALDO DE GIFT CARDS ----------
    function loadWalletBalance() {
        try {
            const walletAmount = document.querySelector('.wallet-amount');
            if (!walletAmount) return;

            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                const balance = typeof data.totalBalance === 'number' ? data.totalBalance : 0;
                
                walletAmount.classList.remove('skeleton-text');
                walletAmount.textContent = `$${balance.toFixed(2)}`;
            } else {
                // Si no hay datos guardados, mostrar $0.00
                walletAmount.classList.remove('skeleton-text');
                walletAmount.textContent = '$0.00';
            }
        } catch (err) {
            console.error('Error al cargar saldo:', err);
            const walletAmount = document.querySelector('.wallet-amount');
            if (walletAmount) {
                walletAmount.classList.remove('skeleton-text');
                walletAmount.textContent = '$0.00';
            }
        }
    }

    // ---------- MODAL FUNCTIONS ----------
    window.showModal = function(feature) {
        const modal = document.getElementById('modal');
        const featureName = document.getElementById('featureName');
        if (featureName && feature) {
            featureName.textContent = feature;
        }
        if (modal) {
            modal.classList.add('active');
        }
    };

    window.closeModal = function() {
        const modal = document.getElementById('modal');
        if (modal) {
            modal.classList.remove('active');
        }
    };

    // ---------- USER DROPDOWN ----------
    window.toggleUserDropdown = function() {
        const dropdown = document.querySelector('.user-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('active');
        }
    };

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
        const userDropdown = document.querySelector('.user-dropdown');
        const userBtn = document.querySelector('.user-dropdown .navbar-icon-button');
        if (userDropdown && !userDropdown.contains(e.target) && e.target !== userBtn) {
            userDropdown.classList.remove('active');
        }
    });

    // Cerrar modal al hacer clic fuera
    const modal = document.getElementById('modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // ---------- LOGOUT ----------
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            localStorage.removeItem(CACHE_KEY);
            localStorage.removeItem(STORAGE_KEY);
            alert('¡Has cerrado sesión!');
            window.location.replace('/pages/login.html');
        });
    }

    // ---------- SINCRONIZACIÓN DE BILLETERA ----------
    function updateWalletDisplay() {
        loadWalletBalance();
    }

    // Actualizar cada 2 segundos
    setInterval(updateWalletDisplay, 2000);

    // Escuchar cambios desde otras pestañas
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
            setTimeout(updateWalletDisplay, 50);
        }
    });

    // ---------- INICIALIZACIÓN ----------
    await loadUserData();
    loadWalletBalance();

    console.log('Mis Compras inicializado correctamente');
});
