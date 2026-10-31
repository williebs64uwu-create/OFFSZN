// STAR CHAIN: precios y reglas de las cuotas. Funciones puras (sin red ni base de datos).

export const STAR_PRODUCT_ID = 5003;
export const STAR_PRICE_USD = 49;
export const STAR_PRICE_PEN = 185;
export const STAR_INSTALLMENTS = 3;
export const STAR_INSTALLMENT_USD = 16.33;
// Clave temporal de cuotas 1 y 2: un mes más unos días de gracia por si el cobro se atrasa.
export const SUB_LICENSE_DAYS = 33;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Precio final del pago único según el % de descuento del cupón (el servidor lo decide, nunca el navegador).
export function starPrice(discountPercent = 0) {
    const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
    const factor = 1 - pct / 100;
    return { usd: round2(STAR_PRICE_USD * factor), pen: round2(STAR_PRICE_PEN * factor) };
}

// Cuota 1 y 2 → clave temporal SUB de un mes. Cuota 3 (o más) → licencia FULL de por vida.
export function licenseForPayment(n) {
    return n >= STAR_INSTALLMENTS ? { kind: 'full', licenseType: 'lifetime' } : { kind: 'sub', licenseType: 'subscription' };
}

export function subExpiry(from = new Date()) {
    return new Date(from.getTime() + SUB_LICENSE_DAYS * 86400000).toISOString();
}

export function starProductBody() {
    return { name: 'STAR CHAIN', description: 'Agente de mezcla vocal STAR CHAIN de OFFSZN', type: 'DIGITAL', category: 'SOFTWARE' };
}

// 3 cobros mensuales de 16.33 US$. Si un cobro falla PayPal reintenta y, tras 2 fallos, suspende la suscripción.
export function starPlanBody(productId) {
    return {
        product_id: productId,
        name: 'STAR CHAIN · 3 cuotas mensuales',
        description: 'Licencia STAR CHAIN en 3 cuotas mensuales sin intereses',
        status: 'ACTIVE',
        billing_cycles: [{
            frequency: { interval_unit: 'MONTH', interval_count: 1 },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: STAR_INSTALLMENTS,
            pricing_scheme: { fixed_price: { value: STAR_INSTALLMENT_USD.toFixed(2), currency_code: 'USD' } }
        }],
        payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: 'CANCEL', payment_failure_threshold: 2 },
        taxes: { percentage: '0', inclusive: false }
    };
}

// Cuota ya cobrada que PayPal informa en la lista de transacciones de una suscripción.
export function findCompletedSale(transactions = [], saleId) {
    const t = (transactions || []).find((x) => String(x.id) === String(saleId) && String(x.status).toUpperCase() === 'COMPLETED');
    if (!t) return null;
    const bd = t.amount_with_breakdown || {};
    const optional = (v) => (v === undefined || v === null || v === '' ? null : round2(v));
    return { saleId: String(t.id), amountUsd: round2(bd.gross_amount?.value), feeUsd: optional(bd.fee_amount?.value), netUsd: optional(bd.net_amount?.value), paidAt: t.time || null, payerEmail: t.payer_email || null };
}

// Primera cuota cobrada (la más antigua) para confirmar la suscripción justo después de aprobarla.
export function firstCompletedSale(transactions = []) {
    const done = (transactions || []).filter((x) => String(x.status).toUpperCase() === 'COMPLETED').sort((a, b) => String(a.time).localeCompare(String(b.time)));
    return done.length ? findCompletedSale(done, done[0].id) : null;
}
