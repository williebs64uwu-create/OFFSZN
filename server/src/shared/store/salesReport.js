// Ventas de Willie (solo productos propios y de pago) a partir de las tablas orders / order_items / products de OFFSZN.
// Funciones puras: reciben filas ya leídas y devuelven los totales que muestra el CRM.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => Number(v) || 0;
const monthOf = (iso) => String(iso || '').slice(0, 7);

// Los beats nunca se vendieron en esta tienda: se excluyen siempre.
export const EXCLUDED_TYPES = new Set(['beat']);

// En la base todo lo que no es beat/drumkit/loopkit está como "preset", incluso los plugins y las plantillas: se separan por nombre.
const PLUGIN_RE = /easy\s*(mix|master|pitch|clean|deeser|level|acordes|youtube)|omni|cassette|coca.?cola|inka.?kola|ghost|widget|rack|^vocal preset$|vocal preset fl native/i;
const TEMPLATE_RE = /template|plantilla|mixing/i;
export function classify(product) {
    const name = String(product?.name || '');
    if (PLUGIN_RE.test(name)) return 'plugin';
    if (TEMPLATE_RE.test(name)) return 'plantilla';
    if (product?.product_type === 'drumkit' || product?.product_type === 'loopkit') return product.product_type;
    return 'preset';
}
export const CLASS_LABEL = { plugin: 'Plugins', plantilla: 'Plantillas', preset: 'Presets', drumkit: 'Drum kits', loopkit: 'Loop kits' };

// Solo productos del dueño (producerIds) y que no sean de un tipo excluido.
export function ownProducts(products, producerIds) {
    const ids = new Set((producerIds || []).map(String));
    return products.filter((p) => (!ids.size || ids.has(String(p.producer_id))) && !EXCLUDED_TYPES.has(p.product_type));
}

export function buildSalesReport({ orders = [], items = [], products = [], clicks = [], producerIds = [] }) {
    const mine = new Map(ownProducts(products, producerIds).map((p) => [p.id, p]));
    const doneById = new Map(orders.filter((o) => o.status === 'completed').map((o) => [o.id, o]));
    // Solo líneas pagadas, de productos propios, en órdenes completadas
    const paid = items.filter((it) => mine.has(it.product_id) && doneById.has(it.order_id) && num(it.price_at_purchase) > 0);

    const orderIds = new Set();
    const months = new Map();
    const classes = new Map();
    const names = new Map();
    let revenueUsd = 0;
    let units = 0;
    for (const it of paid) {
        const qty = num(it.quantity) || 1;
        const price = num(it.price_at_purchase);
        const amount = price * qty;
        const p = mine.get(it.product_id);
        revenueUsd += amount;
        units += qty;
        orderIds.add(it.order_id);

        const m = monthOf(doneById.get(it.order_id).created_at);
        if (m) { const r = months.get(m) || { month: m, units: 0, revenueUsd: 0 }; r.units += qty; r.revenueUsd = round2(r.revenueUsd + amount); months.set(m, r); }

        const c = classify(p);
        const cr = classes.get(c) || { type: c, label: CLASS_LABEL[c] || c, units: 0, revenueUsd: 0 };
        cr.units += qty; cr.revenueUsd = round2(cr.revenueUsd + amount); classes.set(c, cr);

        const n = names.get(p.id) || { name: p.name, type: c, units: 0, revenueUsd: 0, minPaid: price, maxPaid: price };
        n.units += qty; n.revenueUsd = round2(n.revenueUsd + amount);
        n.minPaid = Math.min(n.minPaid, price); n.maxPaid = Math.max(n.maxPaid, price);
        names.set(p.id, n);
    }

    const interestMethod = new Map();
    const interestProduct = new Map();
    for (const c of clicks) {
        const m = c.method || '—';
        interestMethod.set(m, { key: m, clicks: (interestMethod.get(m)?.clicks || 0) + 1 });
        const pr = c.product || '—';
        interestProduct.set(pr, { key: pr, clicks: (interestProduct.get(pr)?.clicks || 0) + 1 });
    }

    revenueUsd = round2(revenueUsd);
    return {
        totals: { orders: orderIds.size, units, revenueUsd, avgTicketUsd: orderIds.size ? round2(revenueUsd / orderIds.size) : 0, products: names.size },
        byMonth: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
        byClass: [...classes.values()].sort((a, b) => b.revenueUsd - a.revenueUsd),
        best: [...names.values()].map((n) => ({ ...n, avgPaid: round2(n.revenueUsd / n.units) })).sort((a, b) => b.revenueUsd - a.revenueUsd).slice(0, 15),
        interest: {
            total: clicks.length,
            byMethod: [...interestMethod.values()].sort((a, b) => b.clicks - a.clicks),
            byProduct: [...interestProduct.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 10)
        },
        scope: { producerIds: [...new Set((producerIds || []).map(String))], productsOwned: mine.size }
    };
}

// Productos propios con su precio de lista y lo que de verdad se cobró (para revisar que los precios registrados son los reales).
export function buildProductPrices({ products = [], items = [], orders = [], producerIds = [] }) {
    const doneIds = new Set(orders.filter((o) => o.status === 'completed').map((o) => o.id));
    const stats = new Map();
    for (const it of items) {
        if (!doneIds.has(it.order_id)) continue;
        const price = num(it.price_at_purchase);
        if (price <= 0) continue;
        const s = stats.get(it.product_id) || { paidUnits: 0, revenue: 0, min: null, max: null };
        const qty = num(it.quantity) || 1;
        s.paidUnits += qty; s.revenue = round2(s.revenue + price * qty);
        s.min = s.min == null ? price : Math.min(s.min, price);
        s.max = s.max == null ? price : Math.max(s.max, price);
        stats.set(it.product_id, s);
    }
    return ownProducts(products, producerIds)
        .map((p) => {
            const s = stats.get(p.id) || { paidUnits: 0, revenue: 0, min: null, max: null };
            const list = num(p.price_basic);
            return {
                id: p.id, name: p.name, type: classify(p), status: p.status || '—', listPriceUsd: list,
                paidUnits: s.paidUnits, revenueUsd: s.revenue, minPaidUsd: s.min, maxPaidUsd: s.max,
                // precio de lista distinto de lo cobrado: conviene revisarlo
                mismatch: s.paidUnits > 0 && list > 0 && (s.min !== list || s.max !== list)
            };
        })
        .filter((p) => p.paidUnits > 0 || p.listPriceUsd > 0)
        .sort((a, b) => b.revenueUsd - a.revenueUsd || b.listPriceUsd - a.listPriceUsd);
}
