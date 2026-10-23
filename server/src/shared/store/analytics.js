// ─── Resumen de negocio de la tienda (función pura) ──────────────────────────────────────────────────────────────
// Recibe filas ya filtradas por fecha y devuelve los números del dashboard.

const r2 = (n) => Math.round(n * 100) / 100;
const dayKey = (iso) => String(iso || '').slice(0, 10);
const bump = (map, key, amount = 1) => map.set(key, (map.get(key) || 0) + amount);
const top = (map, n = 8) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

export function buildOverview({ orders = [], events = [], customers = [], trials = [], carts = [] } = {}, days = 30, now = Date.now()) {
    const completed = orders.filter((o) => o.status === 'completed');
    const revenue = completed.reduce((a, o) => a + Number(o.total_usd || 0), 0);

    const byDay = new Map();
    const byCountry = new Map();
    const bySource = new Map();
    const byMethod = new Map();
    const byProduct = new Map();
    const byOffer = new Map();
    for (const o of completed) {
        const total = Number(o.total_usd || 0);
        bump(byDay, dayKey(o.created_at), total);
        bump(byCountry, o.country || 'N/D', total);
        bump(bySource, o.utm?.utm_source || o.utm?.ref || 'directo', total);
        bump(byMethod, o.payment_method || 'N/D', total);
        bump(byOffer, o.offer_type || 'sin oferta', 1);
        for (const l of o.lines || []) bump(byProduct, l.title || l.id, 1);
    }

    // Serie diaria completa (días sin ventas en 0) para que el gráfico no salte fechas.
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
        const k = new Date(now - i * 86400000).toISOString().slice(0, 10);
        series.push({ day: k, revenueUsd: r2(byDay.get(k) || 0) });
    }

    // Embudo por sesiones distintas: cuánta gente llega a cada paso.
    const steps = ['page_view', 'add_to_cart', 'checkout_start', 'purchase'];
    const sessions = Object.fromEntries(steps.map((s) => [s, new Set()]));
    for (const e of events) if (sessions[e.event] && e.session_id) sessions[e.event].add(e.session_id);
    const funnel = steps.map((s) => ({ step: s, sessions: sessions[s].size }));

    // Clientes que compraron más de una vez, sobre los que compraron al menos una.
    const buyers = customers.filter((c) => c.purchase_count >= 1);
    const repeat = buyers.filter((c) => c.purchase_count >= 2).length;
    const segments = { FREE: 0, 'COMPRADOR V1': 0, 'COMPRADOR V2': 0 };
    for (const c of customers) if (c.segment in segments) segments[c.segment]++;

    const trialsConverted = trials.filter((t) => t.converted_at).length;

    return {
        days,
        revenueUsd: r2(revenue),
        orders: completed.length,
        aovUsd: completed.length ? r2(revenue / completed.length) : 0,
        series,
        byCountry: top(byCountry).map(([k, v]) => ({ key: k, revenueUsd: r2(v) })),
        bySource: top(bySource).map(([k, v]) => ({ key: k, revenueUsd: r2(v) })),
        byMethod: top(byMethod).map(([k, v]) => ({ key: k, revenueUsd: r2(v) })),
        byProduct: top(byProduct).map(([k, v]) => ({ key: k, units: v })),
        byOffer: top(byOffer).map(([k, v]) => ({ key: k, orders: v })),
        funnel,
        customers: { total: customers.length, buyers: buyers.length, repeatRate: buyers.length ? r2((repeat / buyers.length) * 100) : 0, segments },
        trials: { total: trials.length, converted: trialsConverted, rate: trials.length ? r2((trialsConverted / trials.length) * 100) : 0 },
        carts: {
            open: carts.filter((c) => !c.recovered_at).length,
            recovered: carts.filter((c) => c.recovered_at).length,
            reminded: carts.filter((c) => c.reminder_sent_at).length
        }
    };
}
