// ─── Precios de la tienda Willie Inspired ─────────────────────────────────────────────────────────────────────
// ÚNICA fuente de verdad de: país efectivo (IP + zona horaria + país de la cuenta), nivel de precio, moneda local
// mostrada y total del carrito con ofertas (bienvenida 50%, 2x1 "elige tu gratis", código de oferta, cupones).
// Funciones puras: no tocan la BD ni la red. El controlador resuelve si una oferta es válida (cuenta, código sin usar)
// y aquí solo se calcula. El navegador nunca decide un precio: solo lo muestra.

const num = (v, d) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : d;
};

// Países donde el producto de 5 USD vale 10 USD (precio "high"). Se muestran en su moneda.
export const HIGH_TIER = new Set(['AR', 'MX', 'US', 'DE', 'CL', 'DO']);
// Siempre precio base aunque la IP diga EE. UU.: a veces paga un familiar desde fuera.
export const ALWAYS_BASE = new Set(['VE', 'CU']);

// Moneda que se muestra por país. Se cobra en USD (PayPal) o en PEN (Yape); esto es solo referencia visual.
// Tipos de cambio editables por variable de entorno (STORE_FX_MXN=18.5, etc.). ARS cambia rápido: revisarlo.
export const CURRENCIES = {
    AR: { code: 'ARS', rate: num(process.env.STORE_FX_ARS, 1450), step: 100 },
    MX: { code: 'MXN', rate: num(process.env.STORE_FX_MXN, 18.5), step: 5 },
    US: { code: 'USD', rate: 1, step: 0.01 },
    DE: { code: 'EUR', rate: num(process.env.STORE_FX_EUR, 0.92), step: 0.01 },
    CL: { code: 'CLP', rate: num(process.env.STORE_FX_CLP, 950), step: 10 },
    DO: { code: 'DOP', rate: num(process.env.STORE_FX_DOP, 63), step: 5 },
    PE: { code: 'PEN', rate: num(process.env.YAPE_EXCHANGE_RATE_PEN, 3.3), step: 1 }
};
const USD = { code: 'USD', rate: 1, step: 0.01 };

export const OFFERS = {
    welcome50: { percent: 50, maxDiscountUsd: num(process.env.STORE_WELCOME_MAX_USD, 10) },
    // Precio de la oferta que llega por correo cuando vence la prueba de un plugin (hipótesis inicial: validar con ventas).
    trialFollowup: {
        premium: new Set(['US', 'DE']),
        priceUsd: { premium: 15, high: 10, base: 5 },
        hoursValid: 72
    }
};

// Cupones manuales que ya circulaban en el checkout anterior.
export const LEGACY_COUPONS = {
    WILLIE10: { type: 'percent', value: 10 },
    OFFSZN: { type: 'amount', value: 5 },
    SPECIAL: { type: 'percent', value: 15 }
};

// Zona horaria del navegador → país. Solo las de nuestros mercados; si no está, no se usa para decidir.
const TZ_COUNTRY = {
    'America/Lima': 'PE', 'America/Caracas': 'VE', 'America/Havana': 'CU', 'America/Bogota': 'CO',
    'America/Guayaquil': 'EC', 'America/La_Paz': 'BO', 'America/Asuncion': 'PY', 'America/Montevideo': 'UY',
    'America/Panama': 'PA', 'America/Costa_Rica': 'CR', 'America/Guatemala': 'GT', 'America/El_Salvador': 'SV',
    'America/Tegucigalpa': 'HN', 'America/Managua': 'NI', 'America/Puerto_Rico': 'PR',
    'America/Santo_Domingo': 'DO', 'America/Santiago': 'CL', 'America/Punta_Arenas': 'CL',
    'America/Buenos_Aires': 'AR', 'America/Cordoba': 'AR',
    'America/Mexico_City': 'MX', 'America/Cancun': 'MX', 'America/Monterrey': 'MX', 'America/Tijuana': 'MX',
    'America/Hermosillo': 'MX', 'America/Chihuahua': 'MX', 'America/Mazatlan': 'MX', 'America/Merida': 'MX',
    'America/Matamoros': 'MX', 'America/Bahia_Banderas': 'MX', 'America/Ojinaga': 'MX', 'America/Ciudad_Juarez': 'MX',
    'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US',
    'America/Phoenix': 'US', 'America/Anchorage': 'US', 'America/Detroit': 'US', 'America/Boise': 'US',
    'Pacific/Honolulu': 'US', 'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES'
};

export function countryFromTimezone(tz) {
    const t = String(tz || '').trim();
    if (!t) return null;
    if (TZ_COUNTRY[t]) return TZ_COUNTRY[t];
    if (t.startsWith('America/Argentina/')) return 'AR';
    if (t.startsWith('America/Indiana/') || t.startsWith('America/Kentucky/') || t.startsWith('America/North_Dakota/')) return 'US';
    return null;
}

const iso2 = (v) => {
    const c = String(v || '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(c) && c !== 'XX' && c !== 'T1' ? c : null;
};

const tierOf = (c) => (c && HIGH_TIER.has(c) ? 'high' : 'base');

/**
 * Decide el país y el nivel de precio de quien compra.
 *  - VE/CU (por cuenta, IP o zona horaria) → siempre base.
 *  - Si la zona horaria no coincide con la IP se marca posible VPN y se cobra el nivel más alto de los dos:
 *    así una VPN no baja el precio. Con cuenta, el país declarado tampoco puede bajarlo.
 */
export function resolveRegion({ ipCountry, timezone, declaredCountry } = {}) {
    const ip = iso2(ipCountry);
    const tz = countryFromTimezone(timezone);
    const declared = iso2(declaredCountry);
    const vpnSuspected = Boolean(ip && tz && ip !== tz);
    const reasons = [];

    let tier;
    let country = declared || (vpnSuspected ? tz : ip) || tz || null;
    if ([declared, ip, tz].some((c) => c && ALWAYS_BASE.has(c))) {
        tier = 'base';
        reasons.push('always_base');
        country = [declared, ip, tz].find((c) => c && ALWAYS_BASE.has(c));
    } else {
        tier = [declared, ip, tz].some((c) => tierOf(c) === 'high') ? 'high' : 'base';
        if (vpnSuspected) reasons.push('vpn_suspected');
        if (tier === 'high' && tierOf(country) !== 'high') {
            // El país que se muestra debe ser uno de los de precio alto para que la moneda cuadre.
            country = [declared, ip, tz].find((c) => tierOf(c) === 'high');
            reasons.push('max_tier');
        }
    }

    const currency = (tier === 'high' && CURRENCIES[country]) || (country === 'PE' ? CURRENCIES.PE : USD);
    return { country, ipCountry: ip, tzCountry: tz, declaredCountry: declared, tier, vpnSuspected, currency, reasons };
}

const round2 = (n) => Math.round(n * 100) / 100;

export function toLocal(usd, currency = USD) {
    const raw = usd * currency.rate;
    const step = currency.step || 0.01;
    const amount = step >= 1 ? Math.round(raw / step) * step : round2(raw);
    return { amount, currency: currency.code };
}

// Precio de un producto del catálogo para una región. compareAt escala con el nivel (efecto "oferta" estilo Payhip).
export function priceFor(product, region) {
    const p = product?.price || {};
    const base = Number(p.base) || 0;
    const high = Number(p.high) || base;
    const usd = region?.tier === 'high' ? high : base;
    const compareAtUsd = p.compareAt ? round2(Number(p.compareAt) * (base ? usd / base : 1)) : null;
    const currency = region?.currency || USD;
    return {
        usd,
        compareAtUsd: compareAtUsd && compareAtUsd > usd ? compareAtUsd : null,
        local: toLocal(usd, currency),
        compareAtLocal: compareAtUsd && compareAtUsd > usd ? toLocal(compareAtUsd, currency) : null,
        tier: region?.tier || 'base'
    };
}

export const isBuyable = (product) =>
    Boolean(product) && product.status === 'active' && !['lead_magnet', 'subscription'].includes(product.kind) && Number(product.price?.base) > 0;

/**
 * Total del carrito.
 * @param {object}   args
 * @param {Array}    args.items   [{ id, os? }] ids del catálogo (se ignoran duplicados; todo es cantidad 1)
 * @param {Function} args.getProduct id → producto del catálogo (o null)
 * @param {object}   args.region  resultado de resolveRegion
 * @param {object}   [args.offer] ya validada por el controlador:
 *        { type: 'welcome50' } | { type: '2x1', freeIds?: [] } | { type: 'code', productId, priceUsd } | { type: 'coupon', code }
 */
export function quoteCart({ items, getProduct, region, offer } = {}) {
    const errors = [];
    const seen = new Set();
    const lines = [];

    for (const raw of Array.isArray(items) ? items : []) {
        const id = String(raw?.id || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const product = getProduct(id);
        if (!product) { errors.push({ id, error: 'not_found' }); continue; }
        if (!isBuyable(product)) { errors.push({ id, error: 'not_buyable' }); continue; }
        const price = priceFor(product, region);
        lines.push({
            id: product.id,
            title: product.title,
            category: product.category,
            kind: product.kind,
            delivery: product.delivery,
            os: product.kind === 'plugin' ? (raw?.os === 'mac' ? 'mac' : 'win') : null,
            unitUsd: price.usd,
            compareAtUsd: price.compareAtUsd,
            lineUsd: price.usd,
            free: false
        });
    }

    let discountUsd = 0;
    let offerApplied = null;

    if (offer?.type === 'welcome50' && lines.length) {
        const eligible = lines.filter((l) => getProduct(l.id)?.eligibleWelcome);
        const subtotal = eligible.reduce((a, l) => a + l.unitUsd, 0);
        const cfg = OFFERS.welcome50;
        discountUsd = Math.min(round2(subtotal * cfg.percent / 100), cfg.maxDiscountUsd);
        if (discountUsd > 0) {
            for (const l of eligible) l.lineUsd = round2(l.unitUsd - discountUsd * (l.unitUsd / subtotal));
            offerApplied = { type: 'welcome50', percent: cfg.percent, maxDiscountUsd: cfg.maxDiscountUsd };
        } else errors.push({ offer: 'welcome50', error: 'no_eligible_items' });
    } else if (offer?.type === '2x1') {
        // Por cada 2 productos elegibles, 1 gratis de igual o menor precio que los que se pagan ("elige tu gratis").
        const eligible = lines.filter((l) => getProduct(l.id)?.eligible2x1);
        const freeCount = Math.floor(eligible.length / 2);
        if (!freeCount) {
            errors.push({ offer: '2x1', error: 'need_two_items' });
        } else {
            const byPrice = [...eligible].sort((a, b) => a.unitUsd - b.unitUsd);
            const wanted = (Array.isArray(offer.freeIds) ? offer.freeIds : []).map(String);
            let free = byPrice.filter((l) => wanted.includes(l.id)).slice(0, freeCount);
            const paid = eligible.filter((l) => !free.includes(l));
            const minPaid = Math.min(...paid.map((l) => l.unitUsd));
            // Si lo elegido como gratis vale más que lo pagado, gana la regla: gratis los más baratos.
            if (free.length !== freeCount || free.some((l) => l.unitUsd > minPaid)) free = byPrice.slice(0, freeCount);
            for (const l of free) { l.lineUsd = 0; l.free = true; }
            discountUsd = round2(free.reduce((a, l) => a + l.unitUsd, 0));
            offerApplied = { type: '2x1', freeIds: free.map((l) => l.id) };
        }
    } else if (offer?.type === 'code' && offer.productId) {
        const line = lines.find((l) => l.id === offer.productId);
        const priceUsd = Number(offer.priceUsd);
        if (!line) errors.push({ offer: 'code', error: 'product_not_in_cart' });
        else if (Number.isFinite(priceUsd) && priceUsd > 0 && priceUsd < line.unitUsd) {
            discountUsd = round2(line.unitUsd - priceUsd);
            line.lineUsd = priceUsd;
            offerApplied = { type: 'code', productId: line.id, priceUsd };
        }
    } else if (offer?.type === 'coupon') {
        const code = String(offer.code || '').trim().toUpperCase();
        const coupon = LEGACY_COUPONS[code];
        const subtotal = lines.reduce((a, l) => a + l.unitUsd, 0);
        if (!coupon) errors.push({ offer: 'coupon', error: 'invalid_coupon' });
        else if (subtotal > 0) {
            discountUsd = coupon.type === 'percent' ? round2(subtotal * coupon.value / 100) : Math.min(subtotal, coupon.value);
            for (const l of lines) l.lineUsd = round2(l.unitUsd - discountUsd * (l.unitUsd / subtotal));
            offerApplied = { type: 'coupon', code };
        }
    }

    const subtotalUsd = round2(lines.reduce((a, l) => a + l.unitUsd, 0));
    const totalUsd = round2(Math.max(0, subtotalUsd - discountUsd));
    const currency = region?.currency || USD;

    return {
        lines,
        subtotalUsd,
        discountUsd: round2(subtotalUsd - totalUsd),
        totalUsd,
        totalPen: toLocal(totalUsd, CURRENCIES.PE).amount, // soles enteros: lo mismo que se muestra es lo que cobra Yape
        local: toLocal(totalUsd, currency),
        offerApplied,
        region: region ? { country: region.country, tier: region.tier, vpnSuspected: region.vpnSuspected, currency: currency.code } : null,
        errors
    };
}

// Oferta dinámica del correo de "tu prueba terminó" según el país.
export function trialFollowupPrice(country) {
    const c = iso2(country);
    const cfg = OFFERS.trialFollowup;
    if (c && ALWAYS_BASE.has(c)) return cfg.priceUsd.base;
    if (c && cfg.premium.has(c)) return cfg.priceUsd.premium;
    return tierOf(c) === 'high' ? cfg.priceUsd.high : cfg.priceUsd.base;
}
