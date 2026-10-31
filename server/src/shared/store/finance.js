// Finanzas del CRM (funciones puras, sin red ni base de datos).
// Un pago real = una fila del libro de ingresos. Soles = dinero NETO; dólares = lo que PayPal informa (bruto, comisión, neto);
// pesos argentinos = pendientes de confirmar a fin de mes (no entran en los totales hasta entonces).

export const FX_DEFAULT = 3.37; // soles por dólar, solo para mostrar equivalencias
export const START_AT_DEFAULT = '2026-10-31T05:00:00.000Z'; // 31 oct 2026 00:00 hora de Lima: desde aquí se cuenta todo
export const EXPENSE_CATEGORIES = ['GASEOSA', 'COMIDA RÁPIDA', 'SUSCRIPCIÓN IMPORTANTE'];
export const CURRENCIES = ['USD', 'PEN', 'ARS'];
export const METHODS = ['paypal', 'yape', 'mercadopago', 'binance', 'transferencia', 'otro'];
export const METHOD_LABEL = { paypal: 'PayPal', yape: 'Yape', mercadopago: 'Mercado Pago', binance: 'Binance (USDT)', transferencia: 'Transferencia', otro: 'Otro' };
// Método que se propone según la moneda al despachar a mano: dólares = PayPal, soles = Yape, pesos argentinos = Mercado Pago.
export const DEFAULT_METHOD = { USD: 'paypal', PEN: 'yape', ARS: 'mercadopago' };

export const MAIN_MERCHANT_ID = 'MXV5F6X8JXG4S';
export const MAIN_MERCHANT_EMAIL = 'willie2008garay@gmail.com';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => (v === null || v === undefined || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

// ─── Meses en hora de Lima (UTC-5, sin horario de verano) ─────────────────────────────────────────────────────
export const limaMonth = (iso) => new Date(new Date(iso).getTime() - 5 * 3600000).toISOString().slice(0, 7);
export const currentMonth = (now = Date.now()) => limaMonth(new Date(now).toISOString());
export function monthRange(month) {
    const m = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month)) ? month : currentMonth();
    const [y, mo] = m.split('-').map(Number);
    const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
    return { month: m, from: `${m}-01T05:00:00.000Z`, to: `${next}-01T05:00:00.000Z` };
}

// ─── Pago manual al despachar una licencia ("Acción de Willie") ────────────────────────────────────────────────
// USD → lo que te dieron (PayPal): bruto = neto. Soles → neto (Yape). Pesos argentinos → pendiente de confirmar.
// "Sin dato" → queda marcado para revisarlo después; nunca se inventa un monto.
export function normalizeManualIncome(input = {}, now = new Date()) {
    const serial = String(input.serial || '').trim();
    if (!serial) return { ok: false, error: 'Falta la clave que se despachó.' };
    const email = String(input.email || '').trim().toLowerCase() || null;
    const base = {
        source: 'manual', ref: serial.slice(0, 120), email, product: String(input.product || '').trim().slice(0, 120) || null,
        product_id: Number.isFinite(Number(input.productId)) ? Number(input.productId) : null,
        occurred_at: input.occurredAt && !Number.isNaN(Date.parse(input.occurredAt)) ? new Date(input.occurredAt).toISOString() : now.toISOString(),
        by_willie: true, verified: false, fee: null, note: String(input.note || '').trim().slice(0, 300) || null
    };
    if (input.noDetail) {
        return { ok: true, row: { ...base, method: METHODS.includes(input.method) ? input.method : 'otro', currency: CURRENCIES.includes(input.currency) ? input.currency : 'USD', gross: null, net: null, status: 'no_detail' } };
    }
    const currency = String(input.currency || '').toUpperCase();
    if (!CURRENCIES.includes(currency)) return { ok: false, error: 'Elige la moneda: USD, soles o pesos argentinos.' };
    const amount = num(input.amount);
    if (amount === null || amount <= 0 || amount > 1000000) return { ok: false, error: 'Escribe el precio dado (mayor que 0).' };
    const method = METHODS.includes(input.method) ? input.method : DEFAULT_METHOD[currency];
    const gross = r2(amount);
    if (currency === 'ARS') return { ok: true, row: { ...base, method, currency, gross, net: null, status: 'pending_review' } };
    return { ok: true, row: { ...base, method, currency, gross, net: gross, status: 'confirmed' } };
}

// ─── Equivalencias ────────────────────────────────────────────────────────────────────────────────────────────
// Valor en dólares de lo que ya cuenta (confirmado). Soles: neto ÷ tipo de cambio. Sin dato o pesos argentinos: no cuentan todavía.
export function usdOf(row, fx = FX_DEFAULT, field = 'net') {
    if (!row || row.status !== 'confirmed') return null;
    const v = num(row[field] ?? (field === 'net' ? row.gross : null));
    if (v === null) return null;
    if (row.currency === 'USD') return r2(v);
    if (row.currency === 'PEN') return r2(v / fx);
    return null;
}

// Ingresos del libro con la forma que usa el Resumen del CRM. Solo lo confirmado; pesos argentinos y "sin dato" no cuentan todavía.
export function incomeAsOrders(rows = [], fx = FX_DEFAULT) {
    const out = [];
    for (const r of rows) {
        const gross = usdOf(r, fx, 'gross');
        const net = usdOf(r, fx, 'net');
        if (gross === null || net === null) continue;
        out.push({
            status: 'completed', created_at: r.occurred_at, total_usd: gross, net_usd: net, country: null, payment_method: r.method,
            offer_type: null, utm: { utm_source: r.by_willie ? 'acción de Willie' : (r.source || 'directo') }, lines: [{ id: r.product_id, title: r.product || 'Sin nombre' }]
        });
    }
    return out;
}

// ─── Resumen de un mes ────────────────────────────────────────────────────────────────────────────────────────
export function summarize(rows = [], expenses = [], fx = FX_DEFAULT) {
    const t = { count: 0, grossUsd: 0, feeUsd: 0, netUsd: 0, netPen: 0 };
    const byMethod = new Map();
    const byProduct = new Map();
    const bySource = { auto: 0, manual: 0 };
    const ars = { count: 0, pesos: 0 };
    const noDetail = { count: 0 };
    const cur = { USD: { count: 0, gross: 0, fee: 0, net: 0 }, PEN: { count: 0, net: 0 } };

    for (const r of rows) {
        if (r.status === 'no_detail') { noDetail.count += 1; continue; }
        if (r.status === 'pending_review') { ars.count += 1; ars.pesos = r2(ars.pesos + (num(r.gross) || 0)); continue; }
        const netUsd = usdOf(r, fx, 'net');
        if (netUsd === null) continue;
        const grossUsd = usdOf(r, fx, 'gross') ?? netUsd;
        const feeUsd = r.currency === 'USD' ? r2(num(r.fee) || 0) : r2((num(r.fee) || 0) / fx);
        t.count += 1; t.grossUsd = r2(t.grossUsd + grossUsd); t.feeUsd = r2(t.feeUsd + feeUsd); t.netUsd = r2(t.netUsd + netUsd);
        t.netPen = r2(t.netPen + (r.currency === 'PEN' ? num(r.net) || 0 : netUsd * fx));
        if (r.currency === 'USD') { cur.USD.count += 1; cur.USD.gross = r2(cur.USD.gross + (num(r.gross) || 0)); cur.USD.fee = r2(cur.USD.fee + (num(r.fee) || 0)); cur.USD.net = r2(cur.USD.net + (num(r.net) || 0)); }
        else { cur.PEN.count += 1; cur.PEN.net = r2(cur.PEN.net + (num(r.net) || 0)); }
        if (r.by_willie) bySource.manual += 1; else bySource.auto += 1;
        const m = byMethod.get(r.method) || { method: r.method, label: METHOD_LABEL[r.method] || r.method, count: 0, netUsd: 0 };
        m.count += 1; m.netUsd = r2(m.netUsd + netUsd); byMethod.set(r.method, m);
        const pk = r.product || 'Sin nombre';
        const p = byProduct.get(pk) || { product: pk, count: 0, netUsd: 0 };
        p.count += 1; p.netUsd = r2(p.netUsd + netUsd); byProduct.set(pk, p);
    }

    const spent = { totalPen: 0, byCategory: EXPENSE_CATEGORIES.map((c) => ({ category: c, totalPen: 0, count: 0 })) };
    for (const e of expenses) {
        const amount = num(e.amount_pen) || 0;
        spent.totalPen = r2(spent.totalPen + amount);
        const c = spent.byCategory.find((x) => x.category === e.category);
        if (c) { c.totalPen = r2(c.totalPen + amount); c.count += 1; }
    }

    const resultPen = r2(t.netPen - spent.totalPen);
    return {
        fx, income: { ...t, byCurrency: cur, bySource },
        byMethod: [...byMethod.values()].sort((a, b) => b.netUsd - a.netUsd),
        byProduct: [...byProduct.values()].sort((a, b) => b.netUsd - a.netUsd),
        pendingArs: ars, noDetail, expenses: spent,
        result: { pen: resultPen, usd: r2(resultPen / fx) }
    };
}

// ─── Lo que informa PayPal al cobrar ──────────────────────────────────────────────────────────────────────────
const ownUnit = (unit) => {
    const payee = unit?.payee;
    if (!payee) return true;
    return payee.merchant_id === MAIN_MERCHANT_ID || String(payee.email_address || '').toLowerCase() === MAIN_MERCHANT_EMAIL;
};

// Si una parte del cobro es de un socio (Coca-Cola), el neto es solo lo que te queda a ti.
const ownNet = (net, partnerOwed) => (net === null ? null : r2(net - (num(partnerOwed) || 0)));

// Orden de PayPal ya capturada → una fila por cobro que llegó a tu cuenta (las partes de otros productores no cuentan).
export function paypalCaptureRows(result, ctx = {}) {
    const rows = [];
    for (const unit of result?.purchase_units || []) {
        if (!ownUnit(unit)) continue;
        for (const cap of unit.payments?.captures || []) {
            if (String(cap.status).toUpperCase() !== 'COMPLETED') continue;
            const b = cap.seller_receivable_breakdown || {};
            const gross = num(b.gross_amount?.value ?? cap.amount?.value);
            const fee = num(b.paypal_fee?.value);
            const net = num(b.net_amount?.value);
            rows.push({
                source: ctx.source || 'paypal', ref: String(cap.id), occurred_at: cap.create_time || new Date().toISOString(),
                email: String(ctx.email || result?.payer?.email_address || '').toLowerCase() || null,
                product: ctx.product || null, product_id: ctx.productId ?? null, method: 'paypal', currency: String(cap.amount?.currency_code || 'USD').toUpperCase(),
                gross, fee, net: ownNet(net ?? (gross !== null && fee !== null ? r2(gross - fee) : null), ctx.partnerOwed),
                status: 'confirmed', verified: true, by_willie: false, note: ctx.partnerOwed ? `${ctx.note ? `${ctx.note} · ` : ''}Incluye ${ctx.partnerOwed} US$ del socio a pagar` : (ctx.note || null), order_id: ctx.orderId ?? null
            });
        }
    }
    return rows;
}

// Evento PAYMENT.SALE.COMPLETED de PayPal (respaldo del webhook cuando el cliente cerró la pestaña antes de confirmar).
// Sale del aviso, no de una consulta a PayPal: queda sin verificar hasta que lo verifiques en el CRM.
export function paypalSaleEventRow(resource, ctx = {}) {
    if (!resource?.id) return null;
    const gross = num(resource.amount?.total ?? resource.amount?.value);
    const fee = num(resource.transaction_fee?.value);
    if (gross === null) return null;
    return {
        source: 'paypal', ref: String(resource.id), occurred_at: resource.create_time || new Date().toISOString(), email: String(ctx.email || '').toLowerCase() || null,
        product: ctx.product || null, product_id: ctx.productId ?? null, method: 'paypal', currency: String(resource.amount?.currency || resource.amount?.currency_code || 'USD').toUpperCase(),
        gross, fee, net: fee === null ? null : r2(gross - fee), status: 'confirmed', verified: false, by_willie: false, note: 'Anotado por el aviso de PayPal', order_id: ctx.orderId ?? null
    };
}

// Pago aprobado de Mercado Pago (Yape) → una fila en soles con el neto que MP informa.
export function mercadoPagoRow(payment, ctx = {}) {
    if (!payment || String(payment.status) !== 'approved' || payment.id === undefined || payment.id === null) return null;
    if (String(payment.id).startsWith('TEST_MP_')) return null; // pagos de simulación nunca son dinero real
    const gross = num(payment.transaction_amount);
    const fee = r2((payment.fee_details || []).filter((f) => !f.fee_payer || f.fee_payer === 'collector').reduce((a, f) => a + (num(f.amount) || 0), 0));
    const reported = num(payment.transaction_details?.net_received_amount);
    const net = reported ?? (gross !== null ? r2(gross - fee) : null);
    return {
        source: ctx.source || 'yape_web', ref: String(payment.id), occurred_at: payment.date_approved || payment.date_created || new Date().toISOString(),
        email: String(ctx.email || payment.payer?.email || '').toLowerCase() || null, product: ctx.product || null, product_id: ctx.productId ?? null,
        method: 'yape', currency: String(payment.currency_id || 'PEN').toUpperCase(), gross, fee: fee || null, net,
        status: 'confirmed', verified: true, by_willie: false, note: ctx.note || null, order_id: ctx.orderId ?? null
    };
}
