document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    setupLogout();
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

function setupLogout() {
    // Busca TODOS los botones de logout (puede haber en navbar, sidebar, móvil)
    const logoutButtons = document.querySelectorAll('.logout-button, #global-logout-button, .logout-btn');

    logoutButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Confirmación suave (opcional)
            if(confirm("¿Cerrar sesión?")) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('offszn_user_cache'); // Limpiar caché si usas
                
                // Recargar para actualizar UI o ir al home
                window.location.href = '/index.html'; 
            }
        });
    });
}