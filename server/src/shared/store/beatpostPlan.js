// Beat Post (agente de escritorio): precios y reglas del cobro. Funciones puras (sin red ni base de datos).
// Comprar Beat Post = PRO en OFFSZN por 12 meses (la app se desbloquea con el plan de la cuenta).

export const BEATPOST_PRICE_USD = 39;
export const BEATPOST_INSTALLMENTS = 2;
export const BEATPOST_INSTALLMENT_USD = 20;
export const BEATPOST_PRO_MONTHS = 12;
// Cuota 1: PRO por un mes y unos días de gracia por si el segundo cobro se atrasa.
export const BEATPOST_CUOTA1_DAYS = 33;
// ID de producto en la tienda (si se crea en `products`): solo para que la venta salga en los reportes.
export const BEATPOST_PRODUCT_ID = Number.parseInt(process.env.BEATPOST_PRODUCT_ID || '', 10) || null;

const DAY = 86400000;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function addMonths(from, months) {
    const d = new Date(from);
    d.setUTCMonth(d.getUTCMonth() + months);
    return d;
}

// Hasta cuándo queda PRO después de la cuota n. La última cuota completa el año contado desde la primera.
export function proUntilForPayment(n, { firstPaidAt, paidAt = new Date() } = {}) {
    if (n >= BEATPOST_INSTALLMENTS) return addMonths(firstPaidAt || paidAt, BEATPOST_PRO_MONTHS).toISOString();
    return new Date(new Date(paidAt).getTime() + BEATPOST_CUOTA1_DAYS * DAY).toISOString();
}

// La fecha de fin nunca retrocede: si ya tenía PRO más largo (otra compra, un regalo) se respeta.
export function laterDate(a, b) {
    const ta = a ? new Date(a).getTime() : 0;
    const tb = b ? new Date(b).getTime() : 0;
    return new Date(Math.max(ta, tb)).toISOString();
}

export function validEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(e || '').trim());
}

// ¿El cobro de PayPal es de verdad el precio completo de Beat Post? (la página nunca decide el monto)
export function captureMatchesPrice(capture) {
    const amount = capture?.amount || {};
    return String(capture?.status || '').toUpperCase() === 'COMPLETED'
        && String(amount.currency_code || '').toUpperCase() === 'USD'
        && round2(amount.value) >= BEATPOST_PRICE_USD;
}

// Cuenta de PayPal de OFFSZN (la misma que usan los checkouts de STAR CHAIN y Coca-Cola: un solo cobrador).
export const MAIN_MERCHANT_ID = process.env.PAYPAL_MERCHANT_ID_WILLIE || 'MXV5F6X8JXG4S';

export function orderBody() {
    return {
        intent: 'CAPTURE',
        purchase_units: [{
            reference_id: 'BEATPOST',
            custom_id: 'BEATPOST',
            description: 'Beat Post completo + PRO en OFFSZN por 1 año',
            amount: { currency_code: 'USD', value: BEATPOST_PRICE_USD.toFixed(2) },
            payee: { merchant_id: MAIN_MERCHANT_ID }
        }],
        application_context: { brand_name: 'OFFSZN', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW' }
    };
}

export function productBody() {
    return { name: 'Beat Post', description: 'Beat Post completo + PRO en OFFSZN por 1 año', type: 'DIGITAL', category: 'SOFTWARE' };
}

// 2 cobros mensuales de 20 US$. Si un cobro falla PayPal reintenta y, tras 2 fallos, suspende la suscripción.
export function planBody(productId) {
    return {
        product_id: productId,
        name: 'Beat Post · 2 cuotas mensuales',
        description: 'Beat Post completo + PRO en OFFSZN por 1 año, en 2 cuotas',
        status: 'ACTIVE',
        billing_cycles: [{
            frequency: { interval_unit: 'MONTH', interval_count: 1 },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: BEATPOST_INSTALLMENTS,
            pricing_scheme: { fixed_price: { value: BEATPOST_INSTALLMENT_USD.toFixed(2), currency_code: 'USD' } }
        }],
        payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: 'CANCEL', payment_failure_threshold: 2 },
        taxes: { percentage: '0', inclusive: false }
    };
}

// Cuota ya cobrada en la lista de transacciones de una suscripción de PayPal.
export function findCompletedSale(transactions = [], saleId) {
    const t = (transactions || []).find((x) => String(x.id) === String(saleId) && String(x.status).toUpperCase() === 'COMPLETED');
    if (!t) return null;
    const bd = t.amount_with_breakdown || {};
    const optional = (v) => (v === undefined || v === null || v === '' ? null : round2(v));
    return { saleId: String(t.id), amountUsd: round2(bd.gross_amount?.value), feeUsd: optional(bd.fee_amount?.value), netUsd: optional(bd.net_amount?.value), paidAt: t.time || null };
}

export function completedSales(transactions = []) {
    return (transactions || [])
        .filter((x) => String(x.status).toUpperCase() === 'COMPLETED')
        .sort((a, b) => String(a.time).localeCompare(String(b.time)))
        .map((t) => findCompletedSale([t], t.id));
}
