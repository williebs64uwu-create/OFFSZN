// Catálogo de productos que se cobran con Polar. Los IDs NO son secretos (el secreto es POLAR_ACCESS_TOKEN).
// Para agregar un producto: créalo en Polar, copia su ID y añade una línea aquí.
export const POLAR_CATALOG = {
    'offszn-10': { productId: '3ee2b5e9-5939-4692-9f0c-c5e04833ad7c', name: 'OFFSZN 10', priceUsd: 10, note: 'Producto de prueba' }
    // 'star-chain': { productId: '<id de Polar>', name: 'STAR CHAIN', priceUsd: 49 },
};

export const polarProduct = (slug) => (Object.prototype.hasOwnProperty.call(POLAR_CATALOG, slug) ? POLAR_CATALOG[slug] : null);
