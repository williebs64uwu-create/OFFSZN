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

    // ===== SISTEMA DE GIFT CARDS (TEMPORAL - LOCALSTORAGE) =====
    // TODO: Cuando se conecte el backend, reemplazar por llamadas a API
    // Endpoints sugeridos:
    // - GET /api/giftcards/balance - Obtener balance actual
    // - GET /api/giftcards/list - Obtener lista de gift cards
    // - POST /api/giftcards/claim-welcome - Reclamar regalo de bienvenida
    // - POST /api/giftcards/spin-wheel - Girar ruleta mensual
    // - GET /api/giftcards/can-spin - Verificar si puede girar ruleta

    const STORAGE_KEY = 'offszn_giftcards_state';
    const EXCHANGE_RATE = 3.8;

    let appState = {
        currentCurrency: 'USD',
        hasClaimedWelcome: false,
        lastSpinMonth: null,
        totalBalance: 0,
        giftCards: []
    };

    // ===== FUNCIONES DE ALMACENAMIENTO LOCAL (TEMPORAL) =====
    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
            console.log('💾 Estado de gift cards guardado (localStorage temporal)');
        } catch (error) {
            console.error('❌ Error al guardar estado:', error);
        }
    }

    function loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                appState = { ...appState, ...parsed };
                console.log('📦 Estado de gift cards cargado (localStorage temporal):', appState);
                return true;
            }
        } catch (error) {
            console.error('❌ Error al cargar estado:', error);
        }
        return false;
    }

    // ===== FECHA Y MES =====
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentMonthKey = `${currentYear}-${currentMonth}`;
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    function hasSpunThisMonth() {
        return appState.lastSpinMonth === currentMonthKey;
    }

    // ===== FUNCIONES DE MONEDA =====
    function changeCurrency(currency) {
        appState.currentCurrency = currency;
        
        document.getElementById('usd-btn').classList.toggle('active', currency === 'USD');
        document.getElementById('pen-btn').classList.toggle('active', currency === 'PEN');

        updateAllAmounts();
        saveState();
    }

    function formatAmount(usd) {
        if (appState.currentCurrency === 'USD') {
            return `$${usd.toFixed(2)} USD`;
        } else {
            const penAmount = (usd * EXCHANGE_RATE).toFixed(2);
            return `S/${penAmount} PEN`;
        }
    }

    function updateAllAmounts() {
        const welcomeAmount = document.getElementById('welcome-amount');
        if (welcomeAmount) {
            welcomeAmount.textContent = formatAmount(5);
        }

        const totalBalance = document.getElementById('total-balance');
        if (totalBalance) {
            totalBalance.textContent = formatAmount(appState.totalBalance);
        }

        const sidebarWallet = document.getElementById('sidebar-wallet');
        if (sidebarWallet) {
            sidebarWallet.classList.remove('skeleton-text');
            if (appState.currentCurrency === 'USD') {
                sidebarWallet.textContent = `$${appState.totalBalance.toFixed(2)}`;
            } else {
                sidebarWallet.textContent = `S/${(appState.totalBalance * EXCHANGE_RATE).toFixed(2)}`;
            }
        }

        renderGiftCards();
    }

    // ===== FUNCIONES DE GIFT CARDS =====
    function addGiftCard(type, value, description, isDiscount = false) {
        // TODO: Cuando se conecte backend, hacer POST /api/giftcards/add
        const giftCard = {
            id: Date.now(),
            type: type,
            value: value,
            description: description,
            isDiscount: isDiscount,
            active: true,
            claimedDate: new Date().toLocaleDateString('es-ES')
        };

        appState.giftCards.push(giftCard);
        
        if (!isDiscount) {
            appState.totalBalance += value;
        }

        saveState();
        updateAllAmounts();
    }

    function renderGiftCards() {
        const container = document.getElementById('gift-cards-container');
        
        if (appState.giftCards.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-gift"></i>
                    <h3>No tienes gift cards activas aún</h3>
                    <p>Reclama tu regalo de bienvenida o gira la ruleta mensual para obtener tus primeras recompensas.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = appState.giftCards.map(card => {
            const cardClass = card.isDiscount ? 'gift-card-item discount-card' : 'gift-card-item';
            const valueDisplay = card.isDiscount ? `${card.value}% OFF` : formatAmount(card.value);
            const iconClass = card.isDiscount ? 'percent' : 'gift';
            const statusText = card.isDiscount ? 'Disponible' : 'Activa';
            
            return `
                <div class="${cardClass}">
                    <div class="gift-card-type">
                        <i class="fas fa-${iconClass}"></i> ${card.type}
                    </div>
                    <div class="gift-card-value">${valueDisplay}</div>
                    <div class="gift-card-desc">${card.description}</div>
                    <div class="gift-card-status">
                        <i class="fas fa-check-circle"></i> ${statusText}
                    </div>
                </div>
            `;
        }).join('');
    }

    // ===== FUNCIONES DE REGALO DE BIENVENIDA =====
    function claimWelcomeGift() {
        // TODO: Cuando se conecte backend, hacer POST /api/giftcards/claim-welcome
        if (appState.hasClaimedWelcome) {
            alert('Ya has reclamado tu regalo de bienvenida.');
            return;
        }

        appState.hasClaimedWelcome = true;
        
        addGiftCard('Bienvenida', 5, 'Gift card de bienvenida. Válida para cualquier producto.', false);

        const btn = document.getElementById('claim-welcome');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-check"></i> Regalo Reclamado';

        enableWheel();

        const welcomePrize = document.getElementById('welcome-prize');
        welcomePrize.textContent = formatAmount(5);
        document.getElementById('welcome-modal').classList.add('active');

        saveState();
        console.log('🎁 Regalo de bienvenida reclamado (localStorage temporal)');
    }

    // ===== FUNCIONES DE RULETA =====
    function enableWheel() {
        const spinBtn = document.getElementById('spin-btn');
        const spinInfo = document.getElementById('spin-info');
        
        if (hasSpunThisMonth()) {
            spinBtn.disabled = true;
            spinBtn.innerHTML = '<i class="fas fa-check"></i> Ya Giraste Este Mes';
            spinInfo.innerHTML = `<i class="fas fa-calendar"></i> Próxima ruleta: 1 de ${monthNames[nextMonth]} ${nextMonthYear}`;
        } else {
            spinBtn.disabled = false;
            spinInfo.innerHTML = `<i class="fas fa-calendar"></i> Disponible ahora - ¡Gira y gana!`;
        }
    }

    function spinWheel() {
        // TODO: Cuando se conecte backend, hacer POST /api/giftcards/spin-wheel
        if (hasSpunThisMonth()) {
            alert(`Ya has girado la ruleta este mes. Podrás girar nuevamente el 1 de ${monthNames[nextMonth]} ${nextMonthYear}.`);
            return;
        }

        if (!appState.hasClaimedWelcome) {
            alert('Primero debes reclamar tu regalo de bienvenida.');
            return;
        }

        const wheel = document.getElementById('wheel');
        const btn = document.getElementById('spin-btn');
        
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Girando...';

        const prizes = [
            { 
                text: '$1 USD',
                value: 1,
                type: 'money',
                isDiscount: false,
                description: 'Premio de la ruleta mensual.',
                label: `Ruleta ${monthNames[currentMonth]} ${currentYear}`,
                segmentStart: 0,
                segmentEnd: 90
            },
            { 
                text: '10% OFF',
                value: 10,
                type: 'discount',
                isDiscount: true,
                description: 'Aplica a 1 producto. No acumulable.',
                label: 'Descuento 10%',
                segmentStart: 90,
                segmentEnd: 180
            },
            { 
                text: '15% OFF',
                value: 15,
                type: 'discount',
                isDiscount: true,
                description: 'Aplica a 1 producto. No acumulable.',
                label: 'Descuento 15%',
                segmentStart: 180,
                segmentEnd: 270
            },
            { 
                text: '20% OFF',
                value: 20,
                type: 'discount',
                isDiscount: true,
                description: 'Aplica a 1 producto. No acumulable.',
                label: 'Descuento 20%',
                segmentStart: 270,
                segmentEnd: 360
            }
        ];

        const randomIndex = Math.floor(Math.random() * 4);
        const selectedPrize = prizes[randomIndex];
        
        const baseRotation = 3600;
        const segmentCenter = (selectedPrize.segmentStart + selectedPrize.segmentEnd) / 2;
        const randomOffset = (Math.random() * 40) - 20;
        const targetRotation = 360 - segmentCenter + randomOffset;
        const finalRotation = baseRotation + targetRotation;

        wheel.style.transform = `rotate(${finalRotation}deg)`;

        setTimeout(() => {
            appState.lastSpinMonth = currentMonthKey;
            
            addGiftCard(
                selectedPrize.label, 
                selectedPrize.value, 
                selectedPrize.description, 
                selectedPrize.isDiscount
            );

            const prizeText = document.getElementById('prize-text');
            prizeText.textContent = selectedPrize.isDiscount 
                ? `${selectedPrize.value}% OFF` 
                : formatAmount(selectedPrize.value);
            
            document.getElementById('prize-modal').classList.add('active');

            btn.innerHTML = '<i class="fas fa-check"></i> Ya Giraste Este Mes';
            
            const spinInfo = document.getElementById('spin-info');
            spinInfo.innerHTML = `<i class="fas fa-calendar"></i> Próxima ruleta: 1 de ${monthNames[nextMonth]} ${nextMonthYear}`;

            saveState();
            console.log('🎰 Ruleta girada - Premio:', selectedPrize.text, '(localStorage temporal)');
        }, 5000);
    }

    // ===== FUNCIONES DE MODAL =====
    function closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    function showModal(feature) {
        const featureName = document.getElementById('featureName');
        if (featureName) {
            featureName.textContent = feature;
        }
        const modal = document.getElementById('modal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    window.toggleUserDropdown = function() {
        const dropdown = document.querySelector('.user-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('active');
        }
    };

    window.closeModal = closeModal;
    window.showModal = showModal;

    // ===== LOGOUT =====
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            localStorage.removeItem(CACHE_KEY);
            // No limpiar STORAGE_KEY (gift cards) al cerrar sesión
            // Se mantienen para cuando vuelva a iniciar sesión
            alert('¡Has cerrado sesión!');
            window.location.replace('/pages/login.html');
        });
    }

    // ===== EVENT LISTENERS =====
    const usdBtn = document.getElementById('usd-btn');
    const penBtn = document.getElementById('pen-btn');
    if (usdBtn) usdBtn.addEventListener('click', () => changeCurrency('USD'));
    if (penBtn) penBtn.addEventListener('click', () => changeCurrency('PEN'));

    const claimBtn = document.getElementById('claim-welcome');
    if (claimBtn) claimBtn.addEventListener('click', claimWelcomeGift);

    const spinBtn = document.getElementById('spin-btn');
    if (spinBtn) spinBtn.addEventListener('click', spinWheel);

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    });

    document.addEventListener('click', function(e) {
        const userDropdown = document.querySelector('.user-dropdown');
        if (userDropdown && !userDropdown.contains(e.target)) {
            userDropdown.classList.remove('active');
        }
    });

    // ===== INICIALIZACIÓN =====
    async function initApp() {
        console.log('🚀 Iniciando Gift Cards...');
        
        // 1. Cargar datos del usuario desde API (con skeleton loading)
        await loadUserData();
        
        // 2. Cargar estado de gift cards desde localStorage (temporal)
        loadState();

        // 3. Actualizar moneda activa
        const usdBtn = document.getElementById('usd-btn');
        const penBtn = document.getElementById('pen-btn');
        if (usdBtn && penBtn) {
            usdBtn.classList.toggle('active', appState.currentCurrency === 'USD');
            penBtn.classList.toggle('active', appState.currentCurrency === 'PEN');
        }

        // 4. Verificar estado del regalo de bienvenida
        if (appState.hasClaimedWelcome) {
            const btn = document.getElementById('claim-welcome');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-check"></i> Regalo Reclamado';
            }
            enableWheel();
        } else {
            const spinBtn = document.getElementById('spin-btn');
            if (spinBtn) {
                spinBtn.disabled = true;
            }
            const spinInfo = document.getElementById('spin-info');
            if (spinInfo) {
                spinInfo.innerHTML = `<i class="fas fa-lock"></i> Reclama tu regalo de bienvenida primero`;
            }
        }

        // 5. Renderizar todo
        updateAllAmounts();
        renderGiftCards();
        
        console.log('✅ Gift Cards inicializado correctamente');
        console.log('📌 Modo actual: localStorage temporal');
        console.log('💡 TODO: Conectar con endpoints de backend cuando estén listos');
    }

    // Iniciar la app
    await initApp();

    // ===== PREVENIR PÉRDIDA DE DATOS =====
    window.addEventListener('beforeunload', function(e) {
        saveState();
    });

    setInterval(saveState, 30000); // Auto-guardar cada 30 segundos
});
