document.addEventListener('DOMContentLoaded', () => {
    injectGlobalHTML();
    setupTriggers();
});

// 1. INYECTAR HTML
function injectGlobalHTML() {
    const body = document.body;

    // A. Backdrop (Fondo oscuro)
    const backdrop = document.createElement('div');
    backdrop.className = 'overlay-backdrop';
    backdrop.id = 'globalBackdrop';
    backdrop.onclick = closeAllOverlays;
    body.appendChild(backdrop);

    // B. Panel de Notificaciones (Slide derecho)
    const notifPanel = document.createElement('div');
    notifPanel.className = 'side-panel';
    notifPanel.id = 'notificationsPanel';
    notifPanel.innerHTML = `
        <div class="panel-header">
            <div class="panel-title"><i class="fas fa-bell"></i> Notificaciones</div>
            <button class="panel-close" onclick="closeAllOverlays()">&times;</button>
        </div>
        <div class="panel-content">
            <div class="notif-item">
                <div class="notif-icon"><i class="fas fa-gift"></i></div>
                <div class="notif-text">
                    <h4>¡Bienvenido a OFFSZN!</h4>
                    <p>Gracias por unirte a la comunidad de productores.</p>
                </div>
            </div>
            <p style="text-align:center; color:#666; margin-top:20px;">No tienes más notificaciones.</p>
        </div>
    `;
    body.appendChild(notifPanel);

    // C. Panel de Carrito (Slide derecho - Reutiliza estructura visual)
    const cartPanel = document.createElement('div');
    cartPanel.className = 'side-panel';
    cartPanel.id = 'globalCartPanel';
    cartPanel.innerHTML = `
        <div class="panel-header">
            <div class="panel-title"><i class="fas fa-shopping-cart"></i> Tu Carrito</div>
            <button class="panel-close" onclick="closeAllOverlays()">&times;</button>
        </div>
        <div class="panel-content" id="globalCartItems">
            <div style="text-align:center; padding: 40px 0; color: #666;">
                <i class="fas fa-shopping-basket" style="font-size: 3rem; margin-bottom: 10px;"></i>
                <p>Tu carrito está vacío</p>
            </div>
        </div>
        <div class="cart-total-section">
            <div style="display:flex; justify-content:space-between; margin-bottom:1rem; color:#fff; font-weight:700;">
                <span>Total:</span>
                <span id="globalCartTotal">$0.00</span>
            </div>
            <button class="btn-checkout-global" onclick="window.location.href='/pages/marketplace.html'">Ir a Pagar</button>
        </div>
    `;
    body.appendChild(cartPanel);

    // D. Popover de Perfil (Flotante tipo Dropdown)
    const profilePanel = document.createElement('div');
    profilePanel.className = 'profile-popover';
    profilePanel.id = 'profilePopover';
    // Obtenemos datos básicos de localStorage si existen para personalizar
    const userCache = localStorage.getItem('offszn_user_cache');
    const userData = userCache ? JSON.parse(userCache) : { nickname: 'Usuario', email: 'usuario@offszn.com' };
    const initial = (userData.nickname || 'U').charAt(0).toUpperCase();

    profilePanel.innerHTML = `
        <div class="popover-header">
            <div class="popover-avatar">${initial}</div>
            <div style="overflow:hidden;">
                <div style="font-weight:700; color:#fff;">${userData.nickname}</div>
                <div style="font-size:0.75rem; color:#999; white-space:nowrap; text-overflow:ellipsis;">${userData.email}</div>
            </div>
        </div>
        <a href="/cuenta/dashboard.html" class="popover-link"><i class="fas fa-th-large"></i> Dashboard</a>
        <a href="/cuenta/profile.html" class="popover-link"><i class="fas fa-user-circle"></i> Mi Perfil</a>
        <a href="/cuenta/mis-compras.html" class="popover-link"><i class="fas fa-shopping-bag"></i> Mis Compras</a>
        <a href="/cuenta/wallet.html" class="popover-link"><i class="fas fa-wallet"></i> Billetera</a>
        <a href="#" id="navbar-logout-btn" class="user-dropdown-item logout"> <i class="fas fa-sign-out-alt"></i>
    <span>Cerrar Sesión</span>
</a>
    `;
    body.appendChild(profilePanel);

    // Setup del botón logout inyectado
    setTimeout(() => {
        const logoutBtn = document.getElementById('globalLogoutBtn');
        if(logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if(confirm('¿Cerrar sesión?')) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('offszn_user_cache');
                    window.location.href = '/pages/login.html';
                }
            });
        }
    }, 100);
}

// 2. LOGICA DE APERTURA
window.openPanel = (type) => {
    closeAllOverlays(); // Cerrar otros primero
    
    const backdrop = document.getElementById('globalBackdrop');
    backdrop.classList.add('active');

    if (type === 'notifications') {
        document.getElementById('notificationsPanel').classList.add('active');
    } else if (type === 'cart') {
        document.getElementById('globalCartPanel').classList.add('active');
        // Aquí podrías llamar a una función loadGlobalCart() para renderizar items reales
    } else if (type === 'profile') {
        document.getElementById('profilePopover').classList.add('active');
        // El perfil no necesita backdrop oscuro completo necesariamente, pero ayuda en móvil
    }
};

window.closeAllOverlays = () => {
    document.getElementById('globalBackdrop').classList.remove('active');
    document.getElementById('notificationsPanel').classList.remove('active');
    document.getElementById('globalCartPanel').classList.remove('active');
    document.getElementById('profilePopover').classList.remove('active');
};

// 3. SETUP DE TRIGGERS (Busca botones en el HTML existente)
function setupTriggers() {
    // Asignar eventos a los botones del navbar que ya existen en tu HTML
    // Buscamos por href o clase específica
    
    // Notificaciones
    const notifBtn = document.querySelector('a[href="notifications"]');
    if (notifBtn) {
        notifBtn.href = "#";
        notifBtn.onclick = (e) => { e.preventDefault(); openPanel('notifications'); };
    }

    // Carrito
    const cartBtn = document.querySelector('a[href="cart"]');
    if (cartBtn) {
        cartBtn.href = "#";
        cartBtn.onclick = (e) => { e.preventDefault(); openPanel('cart'); };
    }

    // Perfil (El avatar o botón de usuario)
    // En tu HTML dashboard.html tienes: onclick="toggleUserDropdown()"
    // Vamos a interceptar eso.
    window.toggleUserDropdown = () => {
        // Sobrescribimos la función vieja
        openPanel('profile');
    };
}