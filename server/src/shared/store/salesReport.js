// Ventas históricas del negocio (tablas orders / order_items / products de OFFSZN) + interés de pago + comisiones.
// Funciones puras: reciben filas ya leídas y devuelven los totales que muestra el CRM.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => Number(v) || 0;
const monthOf = (iso) => String(iso || '').slice(0, 7);

const TYPE_LABEL = { preset: 'Presets / plantillas', beat: 'Beats', drumkit: 'Drum kits', loopkit: 'Loop kits', plugin: 'Plugins' };

function topBy(map, limit, key) {
    return [...map.values()].sort((a, b) => b[key] - a[key]).slice(0, limit);
}

export function buildSalesReport({ orders = [], items = [], products = [], transactions = [], clicks = [], referrals = [], subscriptions = [] }) {
    const done = orders.filter((o) => o.status === 'completed');
    const doneIds = new Set(done.map((o) => o.id));
    const byProduct = new Map(products.map((p) => [p.id, p]));

    const revenueUsd = round2(done.reduce((s, o) => s + num(o.total_price), 0));
    const transactionsUsd = round2(transactions.filter((t) => t.type === 'sale').reduce((s, t) => s + num(t.amount), 0));

    const months = new Map();
    for (const o of done) {
        const m = monthOf(o.created_at);
        if (!m) continue;
        const row = months.get(m) || { month: m, orders: 0, paidOrders: 0, revenueUsd: 0 };
        row.orders += 1;
        if (num(o.total_price) > 0) row.paidOrders += 1;
        row.revenueUsd = round2(row.revenueUsd + num(o.total_price));
        months.set(m, row);
    }

    const types = new Map();
    const names = new Map();
    let freeItems = 0;
    let paidItems = 0;
    for (const it of items) {
        if (!doneIds.has(it.order_id)) continue;
        const p = byProduct.get(it.product_id);
        const qty = num(it.quantity) || 1;
        const paid = num(it.price_at_purchase) > 0;
        if (paid) paidItems += qty; else freeItems += qty;
        const type = p?.product_type || 'otro';
        const t = types.get(type) || { type, label: TYPE_LABEL[type] || type, units: 0, paidUnits: 0, revenueUsd: 0 };
        t.units += qty;
        if (paid) { t.paidUnits += qty; t.revenueUsd = round2(t.revenueUsd + num(it.price_at_purchase) * qty); }
        types.set(type, t);

        const name = p?.name || `Producto ${it.product_id}`;
        const key = `${name}|${type}`;
        const n = names.get(key) || { name, type, units: 0, paidUnits: 0, revenueUsd: 0, minPaid: null, maxPaid: null };
        n.units += qty;
        if (paid) {
            n.paidUnits += qty;
            n.revenueUsd = round2(n.revenueUsd + num(it.price_at_purchase) * qty);
            n.minPaid = n.minPaid == null ? num(it.price_at_purchase) : Math.min(n.minPaid, num(it.price_at_purchase));
            n.maxPaid = n.maxPaid == null ? num(it.price_at_purchase) : Math.max(n.maxPaid, num(it.price_at_purchase));
        }
        names.set(key, n);
    }

    const paidProducts = [...names.values()].filter((n) => n.paidUnits > 0).map((n) => ({ ...n, avgPaid: round2(n.revenueUsd / n.paidUnits) }));
    const bestPaid = paidProducts.sort((a, b) => b.revenueUsd - a.revenueUsd).slice(0, 12);
    const mostGiven = topBy(new Map([...names].map(([k, v]) => [k, { ...v }])), 8, 'units');

    const interestMethod = new Map();
    const interestProduct = new Map();
    for (const c of clicks) {
        const m = c.method || '—';
        interestMethod.set(m, { key: m, clicks: (interestMethod.get(m)?.clicks || 0) + 1 });
        const p = c.product || '—';
        interestProduct.set(p, { key: p, clicks: (interestProduct.get(p)?.clicks || 0) + 1 });
    }

    const subs = new Map();
    for (const s of subscriptions) {
        const k = `${s.plan_id}|${s.status}`;
        subs.set(k, { plan: s.plan_id, status: s.status, count: (subs.get(k)?.count || 0) + 1 });
    }

    return {
        totals: {
            orders: done.length,
            paidOrders: done.filter((o) => num(o.total_price) > 0).length,
            revenueUsd,
            transactionsUsd,
            paidItems,
            freeItems,
            avgTicketUsd: done.filter((o) => num(o.total_price) > 0).length ? round2(revenueUsd / done.filter((o) => num(o.total_price) > 0).length) : 0
        },
        byMonth: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
        byType: [...types.values()].sort((a, b) => b.revenueUsd - a.revenueUsd || b.units - a.units),
        bestPaid,
        mostGiven,
        interest: {
            total: clicks.length,
            byMethod: [...interestMethod.values()].sort((a, b) => b.clicks - a.clicks),
            byProduct: [...interestProduct.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 10)
        },
        referrals: {
            verified: referrals.filter((r) => r.status === 'verified').length,
            rejected: referrals.filter((r) => r.status === 'rejected').length
        },
        subscriptions: [...subs.values()].sort((a, b) => b.count - a.count)
    };
}

// Productos con su precio de lista y lo que de verdad se cobró (para revisar que los precios registrados son los reales).
export function buildProductPrices({ products = [], items = [], orders = [] }) {
    const doneIds = new Set(orders.filter((o) => o.status === 'completed').map((o) => o.id));
    const stats = new Map();
    for (const it of items) {
        if (!doneIds.has(it.order_id)) continue;
        const s = stats.get(it.product_id) || { units: 0, paidUnits: 0, revenue: 0, min: null, max: null };
        const qty = num(it.quantity) || 1;
        const price = num(it.price_at_purchase);
        s.units += qty;
        if (price > 0) {
            s.paidUnits += qty; s.revenue = round2(s.revenue + price * qty);
            s.min = s.min == null ? price : Math.min(s.min, price);
            s.max = s.max == null ? price : Math.max(s.max, price);
        }
        stats.set(it.product_id, s);
    }
    return products
        .map((p) => {
            const s = stats.get(p.id) || { units: 0, paidUnits: 0, revenue: 0, min: null, max: null };
            const list = num(p.price_basic);
            return {
                id: p.id,
                name: p.name,
                type: p.product_type || 'otro',
                status: p.status || '—',
                isFree: Boolean(p.is_free),
                listPriceUsd: list,
                premiumUsd: num(p.price_premium),
                units: s.units,
                paidUnits: s.paidUnits,
                revenueUsd: s.revenue,
                minPaidUsd: s.min,
                maxPaidUsd: s.max,
                // precio de lista distinto de lo cobrado: conviene revisarlo
                mismatch: s.paidUnits > 0 && list > 0 && (s.min !== list || s.max !== list)
            };
        })
        .filter((p) => p.units > 0 || p.listPriceUsd > 0)
        .sort((a, b) => b.revenueUsd - a.revenueUsd || b.units - a.units);
}

export function summarizeCommissions(rows = []) {
    const total = (list) => round2(list.reduce((s, r) => s + num(r.amount_usd), 0));
    const pending = rows.filter((r) => r.status === 'pendiente');
    const paid = rows.filter((r) => r.status === 'cobrada');
    const months = new Map();
    for (const r of rows) {
        const m = monthOf(r.earned_at || r.created_at);
        if (m) months.set(m, round2((months.get(m) || 0) + num(r.amount_usd)));
    }
    return {
        totalUsd: total(rows),
        pendingUsd: total(pending),
        paidUsd: total(paid),
        count: rows.length,
        byMonth: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, usd]) => ({ month, usd }))
    };
}
