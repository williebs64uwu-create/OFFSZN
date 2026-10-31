// Precios de los plugins por Yape (funciones puras). El servidor NUNCA cobra el monto que manda el navegador:
// - el precio en dólares debe ser uno de los que esa página de plugin puede asignar (A/B test o variantes de afiliados);
// - los soles salen de USD × tipo de cambio (variable YAPE_EXCHANGE_RATE_PEN de Vercel), redondeado al sol como la tienda.
//   Así se puede mover el precio en soles cambiando solo esa variable, sin tocar las páginas.

// Soles fijos por decisión de la página (no siguen la variable): Cassette cuesta S/ 25 aunque sean 8 US$.
export const FIXED_PEN = { '5002': { 8: 25 }, cassette: { 8: 25 } };

export const DEFAULT_RATE = 3.3;
export const rateFromEnv = (env = process.env) => {
    const r = parseFloat(env.YAPE_EXCHANGE_RATE_PEN);
    return Number.isFinite(r) && r > 0 ? r : DEFAULT_RATE;
};
export const penFor = (usd, rate) => Math.round(Number(usd) * Number(rate));

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
export function resolveYapePrice({ productId, isPromo2x1 = false, customPrice, widgetIds = [], rate = rateFromEnv() }) {
    const allowed = pricesForProduct(productId, { isPromo2x1, widgetIds });
    if (!allowed) return { ok: false, error: 'Este producto no está disponible para pagar con Yape.' };
    const usd = Number(customPrice);
    if (!allowed.includes(usd)) return { ok: false, error: 'El precio no es válido. Recarga la página e inténtalo de nuevo.' };
    return { ok: true, usd, pen: FIXED_PEN[String(productId)]?.[usd] ?? penFor(usd, rate) };
}
