// Precios válidos de cada plugin por Yape (funciones puras). El servidor NUNCA cobra el monto que manda el navegador:
// el precio en dólares debe ser uno de los que esa página de plugin puede asignar (A/B test o variantes de afiliados)
// y el monto en soles sale de la tabla de abajo, no de lo que diga el cliente.

// Lo que muestran las páginas de plugin (solesMap de cada una) y lo que cobra Mercado Pago, en soles.
export const USD_TO_PEN = { 5: 19, 8: 25, 9: 34, 10: 38, 15: 57, 17: 65, 20: 76, 25: 95 };

// USD que cada producto puede costar por Yape. Salen de las páginas: Easy Mix 17/25 (A/B) y 5/10/15/20 (páginas de afiliados),
// Easy Master 17/25 (y 5, su precio base), Inka Kola 5/10, Coca-Cola 10/15, Vocal Preset 5/10/17/25, Easy Pitch 5/10,
// Omni 9/15 (A/B) y 17/25 (compradores antiguos), Cassette 8.
export const YAPE_PRICES = {
    '899': [5, 10, 15, 17, 20, 25],
    '901': [5, 10, 15, 17, 20, 25],
    '900': [5, 17, 25],
    '902': [5, 10],
    '903': [10, 15],
    '905': [5, 10, 17, 25],
    '5000': [5, 10],
    '5001': [9, 15, 17, 25],
    '5002': [8],
    cassette: [8]
};
export const PROMO_2X1_PRICES = [17, 25];
export const PROMO_2X1_PRODUCT_IDS = ['899', '901', 'promo-2x1']; // la promo solo se cobra desde su página (Easy Mix + Easy Master de regalo)
export const WIDGET_PRICES = [5];

export const pricesForProduct = (productId, { isPromo2x1 = false, widgetIds = [] } = {}) => {
    const id = String(productId ?? '');
    if (isPromo2x1) return PROMO_2X1_PRODUCT_IDS.includes(id) ? PROMO_2X1_PRICES : null;
    if (widgetIds.map(String).includes(id)) return WIDGET_PRICES;
    return YAPE_PRICES[id] || null;
};

// Devuelve { ok: true, usd, pen } con el precio que se debe cobrar, o { ok: false, error } si el producto o el precio no son válidos.
export function resolveYapePrice({ productId, isPromo2x1 = false, customPrice, widgetIds = [] }) {
    const allowed = pricesForProduct(productId, { isPromo2x1, widgetIds });
    if (!allowed) return { ok: false, error: 'Este producto no está disponible para pagar con Yape.' };
    const usd = Number(customPrice);
    if (!allowed.includes(usd)) return { ok: false, error: 'El precio no es válido. Recarga la página e inténtalo de nuevo.' };
    return { ok: true, usd, pen: USD_TO_PEN[usd] };
}
