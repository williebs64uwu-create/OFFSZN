// Ventas de Willie (solo productos propios y de pago) a partir de las tablas orders / order_items / products de OFFSZN.
// Funciones puras: reciben filas ya leídas y devuelven los totales que muestra el CRM.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => Number(v) || 0;
const monthOf = (iso) => String(iso || '').slice(0, 7);

// Los beats nunca se vendieron en esta tienda: se excluyen siempre.
export const EXCLUDED_TYPES = new Set(['beat']);

// En la base todo lo que no es beat/drumkit/loopkit está como "preset", incluso los plugins y las plantillas: se separan por nombre.
// Plugins: cualquier nombre que empiece por "Easy ..." (Easy Mix, Easy Level, Easy Clean…) más los demás conocidos. "Preset de Easy Kid" NO es plugin.
const PLUGIN_RE = /^(easy\s+\w+|coca.?cola|inka.?kola|omni|cassette|ghost|star\s*chain|offszn\s+(rack|widget)|widget|vocal preset)\b|\bvst\b|win y mac/i;
const TEMPLATE_RE = /template|plantilla|mixing/i;
export function classify(product) {
    const name = String(product?.name || '');
    if (PLUGIN_RE.test(name)) return 'plugin';
    if (TEMPLATE_RE.test(name)) return 'plantilla';
    if (product?.product_type === 'drumkit' || product?.product_type === 'loopkit') return product.product_type;
    return 'preset';
}
export const CLASS_LABEL = { plugin: 'Plugins', plantilla: 'Plantillas', preset: 'Presets', drumkit: 'Drum kits', loopkit: 'Loop kits', sin_detalle: 'Sin detalle' };

// Las ventas reales del CRM cuentan desde el 1 de abril de 2026 (00:00 hora de Lima). Se puede mover con CRM_SALES_SINCE (fecha AAAA-MM-DD).
export const SALES_SINCE_DEFAULT = '2026-04-01';
export const sinceIso = (date = SALES_SINCE_DEFAULT) => `${/^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? date : SALES_SINCE_DEFAULT}T05:00:00.000Z`;
const inRange = (iso, since) => !since || new Date(iso).getTime() >= new Date(since).getTime();
const channelOf = (tx) => (/^WILLIE-/i.test(String(tx || '')) ? 'tienda' : /^MP-YAPE-/i.test(String(tx || '')) ? 'yape' : 'paypal');

// Solo productos del dueño (producerIds) y que no sean de un tipo excluido.
export function ownProducts(products, producerIds) {
    const ids = new Set((producerIds || []).map(String));
    return products.filter((p) => (!ids.size || ids.has(String(p.producer_id))) && !EXCLUDED_TYPES.has(p.product_type));
}

// Un plugin nunca se vendió a menos de 2 ni a más de 30 US$ la unidad: lo que cae fuera es un dato raro y no se suma.
export const PLUGIN_MIN_USD = 2;
export const PLUGIN_MAX_USD = 30;

// Ventas reales de productos propios y de pago, una fila por producto vendido.
// El monto es lo que de verdad se cobró en la orden (orders.total_price): el A/B de precios hace que se cobre 5, 15, 17 o 25 US$
// aunque order_items guarde el precio de lista (10). Si la orden lleva productos de otros productores, el cobro se reparte
// en proporción al precio de lista de cada línea. Las órdenes sin líneas (tienda de Willie, Yape antiguo) entran como "sin detalle".
// Gratis (total 0), fallidas, beats y productos de otros no cuentan. `since` = ISO (ver sinceIso).
export function realSales({ orders = [], items = [], products = [], producerIds = [], since = null, storeOrders = [], noDetail = true }) {
    const mine = new Map(ownProducts(products, producerIds).map((p) => [p.id, p]));
    const known = new Set(products.map((p) => p.id));
    const byOrder = new Map();
    for (const it of items) { const l = byOrder.get(it.order_id) || []; l.push(it); byOrder.set(it.order_id, l); }
    const store = new Map(storeOrders.map((x) => [String(x.payment_ref), x]));
    const lines = [];

    for (const o of orders) {
        if (o.status !== 'completed' || !inRange(o.created_at, since)) continue;
        const hasTotal = o.total_price !== undefined && o.total_price !== null && Number.isFinite(Number(o.total_price));
        const total = hasTotal ? Number(o.total_price) : null;
        if (hasTotal && total <= 0) continue; // regalo o cupón del 100%
        const its = byOrder.get(o.id) || [];
        const paid = its.filter((it) => num(it.price_at_purchase) > 0);
        const channel = channelOf(o.transaction_id);
        const method = /YAPE/i.test(String(o.transaction_id || '')) ? 'yape' : 'paypal';

        if (!paid.length) {
            if (its.length || !hasTotal || !noDetail) continue; // solo gratis, sin monto o sin detalle (cuando no se piden): no hay venta que contar
            if (o.product_id != null && known.has(o.product_id) && !mine.has(o.product_id)) continue; // beat o producto de otro
            const st = store.get(String(o.transaction_id || '').replace(/^WILLIE-(PP|YAPE)-/i, ''));
            const own = o.product_id != null ? mine.get(o.product_id) : null;
            const names = (st?.lines || []).map((l) => l.title).filter(Boolean).join(' + ');
            const name = own?.name || names || 'Venta sin detalle';
            lines.push({
                orderId: o.id, createdAt: o.created_at, productId: o.product_id ?? null, name,
                type: own || names ? classify({ name, product_type: own?.product_type }) : 'sin_detalle',
                units: 1, amountUsd: round2(total), listUsd: round2(total), channel, method, noDetail: true,
                inStore: st?.status === 'completed' // ya está en store_orders (el Resumen no la cuenta dos veces)
            });
            continue;
        }

        const listSum = paid.reduce((a, it) => a + num(it.price_at_purchase) * (num(it.quantity) || 1), 0);
        for (const it of paid) {
            const p = mine.get(it.product_id);
            if (!p) continue;
            const qty = num(it.quantity) || 1;
            const list = num(it.price_at_purchase) * qty;
            lines.push({
                orderId: o.id, createdAt: o.created_at, productId: p.id, name: p.name, type: classify(p), units: qty,
                amountUsd: round2(hasTotal ? (total * list) / listSum : list), listUsd: round2(list), channel, method, noDetail: false, inStore: false
            });
        }
    }
    return lines;
}

export function buildSalesReport({ orders = [], items = [], products = [], clicks = [], producerIds = [], payhip = [], since = null, storeOrders = [], includeNoDetail = true }) {
    const lines = realSales({ orders, items, products, producerIds, since, storeOrders, noDetail: includeNoDetail });
    const sinceDate = since ? String(since).slice(0, 10) : null;

    const orderIds = new Set();
    const outOfRange = [];
    const months = new Map();
    const classes = new Map();
    const names = new Map();
    const channels = { paypal: { units: 0, revenueUsd: 0 }, yape: { units: 0, revenueUsd: 0 }, tienda: { units: 0, revenueUsd: 0 } };
    const noDetail = { orders: 0, revenueUsd: 0 };
    let revenueUsd = 0;
    let units = 0;
    const src = { offszn: { units: 0, revenueUsd: 0 }, payhip: { units: 0, revenueUsd: 0, mixedOrders: 0, estimatedUnits: 0 } };

    for (const l of lines) {
        const unit = l.amountUsd / l.units;
        // Un plugin nunca se vendió a menos de 2 ni a más de 30 US$ la unidad: lo que cae fuera es un dato raro y no se suma.
        if (l.type === 'plugin' && !l.noDetail && (unit < PLUGIN_MIN_USD || unit > PLUGIN_MAX_USD)) { outOfRange.push({ name: l.name, price: round2(unit), source: 'OFFSZN' }); continue; }
        revenueUsd += l.amountUsd; units += l.units; orderIds.add(l.orderId);
        src.offszn.units += l.units; src.offszn.revenueUsd += l.amountUsd;
        const ch = channels[l.channel] || channels.paypal; ch.units += l.units; ch.revenueUsd = round2(ch.revenueUsd + l.amountUsd);
        if (l.noDetail) { noDetail.orders += 1; noDetail.revenueUsd = round2(noDetail.revenueUsd + l.amountUsd); }

        const m = monthOf(l.createdAt);
        if (m) { const r = months.get(m) || { month: m, units: 0, revenueUsd: 0, offszn: 0, payhip: 0 }; r.units += l.units; r.revenueUsd = round2(r.revenueUsd + l.amountUsd); r.offszn = round2(r.offszn + l.amountUsd); months.set(m, r); }

        const cr = classes.get(l.type) || { type: l.type, label: CLASS_LABEL[l.type] || l.type, units: 0, revenueUsd: 0 };
        cr.units += l.units; cr.revenueUsd = round2(cr.revenueUsd + l.amountUsd); classes.set(l.type, cr);

        const key = l.productId != null ? l.productId : `nd:${l.name}`;
        const n = names.get(key) || { name: l.name, type: l.type, units: 0, revenueUsd: 0, minPaid: unit, maxPaid: unit };
        n.units += l.units; n.revenueUsd = round2(n.revenueUsd + l.amountUsd);
        n.minPaid = Math.min(n.minPaid, unit); n.maxPaid = Math.max(n.maxPaid, unit);
        names.set(key, n);
    }

    // Payhip: solo plugins. Los pedidos "mixtos" (plugin + otras cosas) cuentan como venta pero sin monto, porque no se sabe cuánto fue del plugin.
    for (const h of payhip) {
        if (sinceDate && String(h.sold_on) < sinceDate) continue;
        if (h.unit_price_usd == null) { src.payhip.mixedOrders += 1; continue; }
        const price = Number(h.unit_price_usd);
        if (h.price_estimated) src.payhip.estimatedUnits += 1;
        if (price < PLUGIN_MIN_USD || price > PLUGIN_MAX_USD) { outOfRange.push({ name: h.plugin, price, source: 'Payhip' }); continue; }
        revenueUsd += price; units += 1; orderIds.add(`payhip:${h.order_id}`);
        src.payhip.units += 1; src.payhip.revenueUsd += price;
        const m = monthOf(h.sold_on);
        if (m) { const r = months.get(m) || { month: m, units: 0, revenueUsd: 0, offszn: 0, payhip: 0 }; r.units += 1; r.revenueUsd = round2(r.revenueUsd + price); r.payhip = round2(r.payhip + price); months.set(m, r); }
        const cr = classes.get('plugin') || { type: 'plugin', label: CLASS_LABEL.plugin, units: 0, revenueUsd: 0 };
        cr.units += 1; cr.revenueUsd = round2(cr.revenueUsd + price); classes.set('plugin', cr);
        const key = `payhip:${h.plugin}`;
        const n = names.get(key) || { name: h.plugin, type: 'plugin', units: 0, revenueUsd: 0, minPaid: price, maxPaid: price };
        n.units += 1; n.revenueUsd = round2(n.revenueUsd + price); n.minPaid = Math.min(n.minPaid, price); n.maxPaid = Math.max(n.maxPaid, price);
        names.set(key, n);
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
        totals: { orders: orderIds.size, units, revenueUsd, avgTicketUsd: orderIds.size ? round2(revenueUsd / orderIds.size) : 0, products: new Set([...names.values()].map((n) => `${n.type}|${n.name.toLowerCase()}`)).size },
        byMonth: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
        byClass: [...classes.values()].sort((a, b) => b.revenueUsd - a.revenueUsd),
        best: (() => {
            const merged = new Map();
            for (const n of names.values()) {
                const k = `${n.type}|${n.name.toLowerCase()}`;
                const m = merged.get(k);
                if (!m) merged.set(k, { ...n });
                else { m.units += n.units; m.revenueUsd = round2(m.revenueUsd + n.revenueUsd); m.minPaid = Math.min(m.minPaid, n.minPaid); m.maxPaid = Math.max(m.maxPaid, n.maxPaid); }
            }
            return [...merged.values()].map((n) => ({ ...n, minPaid: round2(n.minPaid), maxPaid: round2(n.maxPaid), avgPaid: round2(n.revenueUsd / n.units) })).sort((a, b) => b.revenueUsd - a.revenueUsd).slice(0, 15);
        })(),
        interest: {
            total: clicks.length,
            byMethod: [...interestMethod.values()].sort((a, b) => b.clicks - a.clicks),
            byProduct: [...interestProduct.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 10)
        },
        sources: { offszn: { units: src.offszn.units, revenueUsd: round2(src.offszn.revenueUsd) }, payhip: { units: src.payhip.units, revenueUsd: round2(src.payhip.revenueUsd), mixedOrders: src.payhip.mixedOrders, estimatedUnits: src.payhip.estimatedUnits } },
        channels,
        noDetail,
        outOfRange,
        scope: { producerIds: [...new Set((producerIds || []).map(String))], productsOwned: ownProducts(products, producerIds).length, pluginRangeUsd: [PLUGIN_MIN_USD, PLUGIN_MAX_USD], since }
    };
}

// Ventas del marketplace como "órdenes" para el Resumen del CRM (una por orden). Las de la tienda que ya están en store_orders
// no se repiten: el Resumen las cuenta desde esa tabla.
export function marketplaceOrders({ orders = [], items = [], products = [], producerIds = [], since = null, storeOrders = [] }) {
    const byOrder = new Map();
    const meta = new Map(orders.map((o) => [o.id, o]));
    for (const l of realSales({ orders, items, products, producerIds, since, storeOrders })) {
        if (l.inStore) continue;
        const o = meta.get(l.orderId);
        const r = byOrder.get(l.orderId) || {
            status: 'completed', created_at: l.createdAt, total_usd: 0, country: null, payment_method: l.method, offer_type: null,
            utm: { utm_source: l.channel === 'tienda' ? 'tienda' : 'marketplace' }, source: l.channel === 'tienda' ? 'tienda_legacy' : 'marketplace', lines: []
        };
        r.total_usd = round2(r.total_usd + l.amountUsd);
        for (let i = 0; i < l.units; i++) r.lines.push({ id: l.productId ?? o?.transaction_id, title: l.name });
        byOrder.set(l.orderId, r);
    }
    return [...byOrder.values()];
}

// Productos propios con su precio de lista y lo que de verdad se cobró (para revisar que los precios registrados son los reales).
export function buildProductPrices({ products = [], items = [], orders = [], producerIds = [], since = null, storeOrders = [] }) {
    const stats = new Map();
    for (const l of realSales({ orders, items, products, producerIds, since, storeOrders })) {
        if (l.productId == null || l.noDetail) continue;
        const unit = l.amountUsd / l.units;
        const s = stats.get(l.productId) || { paidUnits: 0, revenue: 0, min: null, max: null };
        s.paidUnits += l.units; s.revenue = round2(s.revenue + l.amountUsd);
        s.min = s.min == null ? unit : Math.min(s.min, unit);
        s.max = s.max == null ? unit : Math.max(s.max, unit);
        stats.set(l.productId, s);
    }
    return ownProducts(products, producerIds)
        .map((p) => {
            const s = stats.get(p.id) || { paidUnits: 0, revenue: 0, min: null, max: null };
            const list = num(p.price_basic);
            const min = s.min == null ? null : round2(s.min);
            const max = s.max == null ? null : round2(s.max);
            return {
                id: p.id, name: p.name, type: classify(p), status: p.status || '—', listPriceUsd: list,
                paidUnits: s.paidUnits, revenueUsd: s.revenue, minPaidUsd: min, maxPaidUsd: max,
                // precio de lista distinto de lo cobrado: conviene revisarlo
                mismatch: s.paidUnits > 0 && list > 0 && (min !== list || max !== list)
            };
        })
        .filter((p) => p.paidUnits > 0 || p.listPriceUsd > 0)
        .sort((a, b) => b.revenueUsd - a.revenueUsd || b.listPriceUsd - a.listPriceUsd);
}
