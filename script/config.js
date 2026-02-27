/**
 * Global Configuration for OFFSZN
 */
const CONFIG = {
    // URL base para todas las peticiones al servidor
    // En desarrollo: http://localhost:3000
    // En producción (Render): https://offszn-oc7c.onrender.com
    // Próximamente (Nuevo Dominio): https://offszn.lat
    API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://offszn-oc7c.onrender.com',

    // Versiones de assets para evitar caché
    VERSIONS: {
        NAVBAR: '15',
        CART: '11',
        NOTIFICATIONS: '26'
    }
};

// Hacerlo disponible globalmente
window.OFFSZN_CONFIG = CONFIG;
