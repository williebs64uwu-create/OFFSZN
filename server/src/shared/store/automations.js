// ─── Reglas de automatización de la tienda (funciones puras) ─────────────────────────────────────────────────────
// Reciben filas de la BD y devuelven a quién escribirle. El envío y el registro viven en crmService.js.

const H = 3600 * 1000;
const D = 24 * H;
const ts = (v) => (v ? new Date(v).getTime() : NaN);

export const RULES = [
    { key: 'abandoned_cart', name: 'Carrito abandonado (2 h)', description: 'Dejó su correo en el checkout y no pagó en 2 horas.' },
    { key: 'lead_nurture', name: 'Lead sin comprar (3 días)', description: 'Pidió un regalo gratis hace 3 días y no ha comprado.' },
    { key: 'post_purchase_upsell', name: 'Upsell post-compra (24 h)', description: 'Compró ayer: le sugerimos el siguiente paso de la escalera.' },
    { key: 'winback', name: 'Recompra (45 días)', description: 'Compró hace más de 45 días y no ha vuelto.' }
];

export function pickAbandonedCarts(carts, now = Date.now()) {
    return (carts || []).filter((c) => {
        const age = now - ts(c.updated_at);
        return c.email && !c.reminder_sent_at && !c.recovered_at && Array.isArray(c.items) && c.items.length > 0 && age >= 2 * H && age <= 48 * H;
    });
}

export function pickNurture(customers, now = Date.now()) {
    return (customers || []).filter((c) => {
        const age = now - ts(c.created_at);
        return c.email && !c.unsubscribed && c.segment === 'FREE' && !(c.purchase_count > 0) && (c.lead_magnets || []).length > 0 && age >= 72 * H && age <= 14 * D;
    });
}

export function pickPostPurchase(orders, now = Date.now()) {
    return (orders || []).filter((o) => {
        const age = now - ts(o.created_at);
        return o.email && o.status === 'completed' && age >= 24 * H && age <= 72 * H;
    });
}

export function pickWinback(customers, now = Date.now()) {
    return (customers || []).filter((c) => c.email && !c.unsubscribed && c.purchase_count >= 1 && now - ts(c.last_purchase_at) >= 45 * D);
}

// Un winback por cliente cada 60 días: la referencia cambia cada 60 días.
export const winbackRef = (now = Date.now()) => `w${Math.floor(now / (60 * D))}`;
