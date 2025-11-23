document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    handleLogout();
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
    e.preventDefault();
    
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
    overlay.style.display = 'flex'; // Asegurar que sea flexible
    // Pequeño delay para permitir que el navegador renderice el display:flex antes de la opacidad
    setTimeout(() => {
        overlay.classList.add('active');
    }, 10);

    // Fase 2: Cambiar mensaje a "Éxito" después de 1.5s
    setTimeout(() => {
        localStorage.removeItem('authToken'); // Borramos token aquí
        localStorage.removeItem('offszn_user_cache');
        
        if(messageEl) messageEl.textContent = "¡Sesión cerrada!";
        if(iconEl) iconEl.className = "fas fa-check-circle"; // Cambiar icono a check
    }, 1500);

    // Fase 3: Desvanecer y Redirigir
    setTimeout(() => {
        overlay.classList.remove('active'); // Quitar opacidad
        overlay.classList.add('fading-out'); // Clase opcional si tienes CSS extra
        
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 500); // Esperar a que termine la transición de opacidad
    }, 3000);
}

function performLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('offszn_user_cache');
    window.location.href = '/index.html';
}

// Asignar a todos los botones de logout
document.addEventListener('click', function(e) {
    // 1. Detectar si el clic fue en un botón de Logout (o dentro de uno)
    // Buscamos por ID, por Clase, o por el texto del enlace
    const logoutBtn = e.target.closest('#navbar-logout-btn, #sidebar-logout-btn, .logout-btn, .logout');

    // 2. Si encontramos un botón de logout...
    if (logoutBtn) {
        e.preventDefault(); // ¡Alto! No navegues a ninguna parte
        console.log("Botón de logout detectado:", logoutBtn);
        handleLogout(e); // Ejecuta la animación
    }
});