document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    // handleLogout();
});

function checkAuthState() {
    const token = localStorage.getItem('authToken');
    const body = document.body;

    if (token) {
        // 1. Usuario Logueado: Añadimos la clase maestra al body
        body.classList.add('user-authenticated');
        
        // (Opcional) Aquí podrías decodificar el token para poner el nombre/avatar en el navbar
        // si tuvieras esa info guardada en localStorage
    } else {
        // 2. Usuario Visitante
        body.classList.remove('user-authenticated');
    }
}

function handleLogout(e) {
    // ✅ CORRECCIÓN: Validamos que 'e' exista antes de usarlo
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
    
    // 1. Buscar el overlay
    const overlay = document.getElementById('logout-overlay');
    
    // Si no existe el overlay en esta página, hacemos logout directo
    if (!overlay) {
        if(confirm("¿Cerrar sesión?")) {
            performLogout();
        }
        return;
    }

    // 2. Si existe, iniciamos la animación
    const messageEl = document.getElementById('logout-message');
    const iconEl = overlay.querySelector('i');

    // Fase 1: Mostrar Overlay
    overlay.style.display = 'flex'; 
    setTimeout(() => {
        overlay.classList.add('active');
    }, 10);

    // Fase 2: Cambiar mensaje a "Éxito" después de 1.5s
    setTimeout(() => {
        localStorage.removeItem('authToken'); 
        localStorage.removeItem('offszn_user_cache');
        
        if(messageEl) messageEl.textContent = "¡Sesión cerrada!";
        if(iconEl) iconEl.className = "fas fa-check-circle"; 
    }, 1500);

    // Fase 3: Desvanecer y Redirigir
    setTimeout(() => {
        overlay.classList.remove('active'); 
        overlay.classList.add('fading-out'); 
        
        setTimeout(() => {
            window.location.href = '/explorar.html';
        }, 500); 
    }, 3000);
}

function performLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('offszn_user_cache');
    window.location.href = '/explorar.html';
}

// Asignar a todos los botones de logout
document.addEventListener('click', function(e) {
    // 1. Detectar si el clic fue en un botón de Logout
    const logoutBtn = e.target.closest('#navbar-logout-btn, #sidebar-logout-btn, .logout-btn, .logout');

    // 2. Si encontramos un botón de logout...
    if (logoutBtn) {
        e.preventDefault(); 
        console.log("Botón de logout detectado:", logoutBtn);
        handleLogout(e); 
    }
});