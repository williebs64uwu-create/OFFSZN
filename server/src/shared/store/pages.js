// URL de la tienda → plantilla HTML en willieinspired/tienda/. Las páginas leen la URL y piden los datos a /api/store.
// Devuelve null si la ruta no es de la tienda (sigue a las páginas sueltas: descargas, regalos, agendar...).
const COLLECTIONS = new Set(['presets', 'plantillas', 'plugins', 'servicios']);
const SIMPLE = {
    'crea-tu-preset': 'tienda/crea.html',
    'crea-tu-plantilla': 'tienda/crea.html',
    oferta: 'tienda/oferta.html',
    bienvenida: 'tienda/bienvenida.html',
    gracias: 'tienda/gracias.html'
};
const SLUG = /^[a-z0-9-]{1,80}$/;

export function storePageFor(rawPath) {
    const parts = String(rawPath || '').toLowerCase().replace(/\.html$/, '').split('/').filter(Boolean);
    if (!parts.length || parts.some((p) => !SLUG.test(p))) return null;
    const [first, second, third] = parts;

    if (parts.length === 1 && SIMPLE[first]) return SIMPLE[first];
    if (first === 'mi-perfil' && parts.length <= 3) return 'tienda/perfil.html';
    if (first === 'comunidad' && parts.length <= 3) return 'tienda/comunidad.html';

    if (COLLECTIONS.has(first)) {
        if (parts.length === 1) return 'tienda/coleccion.html';
        // /presets/artistas, /plugins/bundle, /plugins/expansiones → colección filtrada
        if (parts.length === 2 && ['artistas', 'bundle', 'expansiones'].includes(second)) return 'tienda/coleccion.html';
        if (parts.length === 2) return 'tienda/producto.html';
        if (parts.length === 3 && ['artistas', 'bundle', 'expansiones'].includes(second) && third) return 'tienda/producto.html';
    }
    return null;
}
