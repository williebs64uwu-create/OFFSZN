// Catálogo de productos que se cobran con Polar. Los IDs NO son secretos (el secreto es POLAR_ACCESS_TOKEN).
// Para agregar un producto: créalo en Polar, copia su ID y añade una línea aquí.
export const POLAR_CATALOG = {
    'offszn-10': { productId: '3ee2b5e9-5939-4692-9f0c-c5e04833ad7c', name: 'OFFSZN 10', priceUsd: 10, note: 'Producto de prueba', successPath: '/polar-test' },
    'star-chain': { productId: 'adf412a8-fbf6-4a33-8c0e-dede0297f575', name: 'STAR CHAIN', priceUsd: 49, note: 'Licencia FULL (pago único)', successPath: '/plugins/checkout' }
};

export const polarProduct = (slug) => (Object.prototype.hasOwnProperty.call(POLAR_CATALOG, slug) ? POLAR_CATALOG[slug] : null);
