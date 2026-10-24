/* CRM Willie Inspired · negocio: historial de ventas reales, productos con precios, y comisiones ganadas. */
(() => {
    'use strict';
    const C = window.CRM;
    const { $, $$, esc, usd, num, icon, api, toast } = C;

    const card = ({ title, desc = '', actions = '', body = '', flush = false }) => `<section class="card ${flush ? 'card--flush' : ''}">
        ${title ? `<div class="card__head"><div><h2 class="card__title">${title}</h2>${desc ? `<p class="card__desc">${desc}</p>` : ''}</div>${actions}</div>` : ''}<div class="card__body">${body}</div></section>`;
    const head = (title, desc = '', actions = '') => `<div class="page-head"><div><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ''}</div><div class="row">${actions}</div></div>`;
    const empty = (ic, text) => `<div class="empty">${icon(ic)}<p>${text}</p></div>`;
    const kpi = (l, v, f, ic) => `<div class="card kpi"><div class="kpi__top"><span>${l}</span>${icon(ic)}</div><div class="kpi__value">${v}</div><div class="kpi__foot">${f}</div></div>`;
    const bars = (list, label, value, fmt = (v) => v) => {
        const max = Math.max(1, ...list.map((r) => r[value]));
        return list.length ? list.map((r) => `<div class="list-row"><div class="grow"><div class="row between"><span>${esc(r[label])}</span><b>${fmt(r[value])}</b></div><div class="bar" style="margin-top:6px"><i style="width:${Math.max(3, (r[value] / max) * 100)}%"></i></div></div></div>`).join('')
            : empty('activity', 'Sin datos todavía.');
    };
    const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const monthName = (m) => `${MONTHS[Number(m.slice(5, 7)) - 1] || m.slice(5)} ${m.slice(2, 4)}`;
    const loading = '<div class="skeleton" style="height:220px"></div>';
    const fail = (e) => `<div class="alert alert--error">${icon('alert')}<div>${esc(e.message)}</div></div>`;

    // ══ Historial de ventas ═══════════════════════════════════════════════════
    C.pages.historial = {
        async render(view, token) {
            view.innerHTML = `${head('Historial de ventas', 'Todo lo vendido en OFFSZN y Willie Inspired desde el inicio (solo órdenes completadas).')}${loading}`;
            let r;
            try { r = await api('/admin/sales'); } catch (e) { view.innerHTML = head('Historial de ventas') + fail(e); return; }
            if (token !== C.state.routeToken) return;
            const t = r.totals;
            const monthly = r.byMonth.map((m) => ({ ...m, label: monthName(m.month) }));
            const subs = r.subscriptions.map((s) => ({ key: `${s.plan} · ${s.status}`, count: s.count }));
            view.innerHTML = `${head('Historial de ventas', 'Todo lo vendido en OFFSZN y Willie Inspired desde el inicio (solo órdenes completadas).')}
                <div class="kpis">
                    ${kpi('Ingresos', usd(t.revenueUsd), `${num(t.paidOrders)} ventas de pago`, 'trend')}
                    ${kpi('Ticket medio', usd(t.avgTicketUsd), 'por venta de pago', 'bag')}
                    ${kpi('Órdenes', num(t.orders), `${num(t.orders - t.paidOrders)} gratis o regalo`, 'cart')}
                    ${kpi('Productos pagados', num(t.paidItems), `${num(t.freeItems)} entregados gratis`, 'users')}
                    ${kpi('Registrado en transacciones', usd(t.transactionsUsd), 'Puede diferir de órdenes: revísalo', 'refresh')}
                    ${kpi('Referidos verificados', num(r.referrals.verified), `${num(r.referrals.rejected)} rechazados`, 'users')}
                </div>
                <div class="grid grid-2">
                    ${card({ title: 'Ingresos por mes', body: bars(monthly, 'label', 'revenueUsd', usd) })}
                    ${card({ title: 'Por tipo de producto', desc: 'Ingresos y unidades (las gratis no suman dinero).', body: bars(r.byType.map((x) => ({ key: `${x.label} · ${num(x.units)} u.`, revenueUsd: x.revenueUsd })), 'key', 'revenueUsd', usd) })}
                </div>
                <div class="grid grid-2">
                    ${card({ title: 'Lo que más dinero dejó', body: r.bestPaid.length ? `<div class="table-wrap"><table><thead><tr><th>Producto</th><th>Vendidos</th><th>Precio cobrado</th><th>Ingresos</th></tr></thead><tbody>${r.bestPaid.map((p) => `<tr><td>${esc(p.name)}<br><span class="muted small">${esc(p.type)}</span></td><td>${num(p.paidUnits)}</td><td>${p.minPaid === p.maxPaid ? usd(p.minPaid) : `${usd(p.minPaid)} – ${usd(p.maxPaid)}`}</td><td><b>${usd(p.revenueUsd)}</b></td></tr>`).join('')}</tbody></table></div>` : empty('bag', 'Sin ventas de pago.') })}
                    ${card({ title: 'Lo que más regalaste', desc: 'Entregas gratis o de promoción, para ver qué atrae gente.', body: bars(r.mostGiven.map((x) => ({ key: x.name, units: x.units })), 'key', 'units', num) })}
                </div>
                <div class="grid grid-3">
                    ${card({ title: 'Cómo quieren pagar', desc: `${num(r.interest.total)} clics en botones de pago manual.`, body: bars(r.interest.byMethod, 'key', 'clicks', num) })}
                    ${card({ title: 'Qué productos piden pagar', body: bars(r.interest.byProduct, 'key', 'clicks', num) })}
                    ${card({ title: 'Suscripciones', body: bars(subs, 'key', 'count', num) })}
                </div>`;
        }
    };

    // ══ Productos y precios ═══════════════════════════════════════════════════
    C.pages.productos = {
        async render(view, token) {
            view.innerHTML = `${head('Productos y precios', 'Lo que dice tu catálogo y lo que realmente se cobró.')}${loading}`;
            let r;
            try { r = await api('/admin/product-prices'); } catch (e) { view.innerHTML = head('Productos y precios') + fail(e); return; }
            if (token !== C.state.routeToken) return;
            const filter = C.state.priceFilter || 'todos';
            const rows = r.products.filter((p) => (filter === 'cobrados' ? p.paidUnits > 0 : filter === 'revisar' ? p.mismatch : true));
            const catalog = r.catalog.map((p) => `<tr><td>${esc(p.title)}</td><td><span class="badge badge--secondary">${esc(p.category)}</span></td><td>${p.baseUsd != null ? usd(p.baseUsd) : '—'}</td><td>${p.highUsd != null ? usd(p.highUsd) : '—'}</td><td class="muted">${p.compareAtUsd != null ? usd(p.compareAtUsd) : '—'}</td><td>${p.status === 'active' ? '<span class="badge badge--success">activo</span>' : `<span class="badge badge--outline">${esc(p.status || '—')}</span>`}</td></tr>`).join('');
            view.innerHTML = `${head('Productos y precios', 'Lo que dice tu catálogo y lo que realmente se cobró.',
                `<select class="select" id="priceFilter" style="width:auto"><option value="todos">Todos</option><option value="cobrados">Solo con ventas de pago</option><option value="revisar">Precio a revisar</option></select>`)}
                ${card({ title: 'Precios reales en OFFSZN', desc: '“A revisar” = se cobró distinto al precio de lista (descuentos, 2x1 o precios viejos).', flush: true, body: rows.length ? `<div class="table-wrap"><table><thead><tr><th>Producto</th><th>Tipo</th><th>Precio de lista</th><th>Vendidos (pago)</th><th>Cobrado</th><th>Ingresos</th></tr></thead><tbody>${rows.slice(0, 120).map((p) => `<tr><td>${esc(p.name)}${p.isFree ? ' <span class="badge badge--outline">gratis</span>' : ''}${p.mismatch ? ' <span class="badge badge--warning">a revisar</span>' : ''}</td><td class="muted">${esc(p.type)}</td><td>${p.listPriceUsd ? usd(p.listPriceUsd) : '—'}</td><td>${num(p.paidUnits)} <span class="muted small">de ${num(p.units)}</span></td><td>${p.minPaidUsd == null ? '—' : p.minPaidUsd === p.maxPaidUsd ? usd(p.minPaidUsd) : `${usd(p.minPaidUsd)} – ${usd(p.maxPaidUsd)}`}</td><td><b>${usd(p.revenueUsd)}</b></td></tr>`).join('')}</tbody></table></div>` : empty('bag', 'Nada con ese filtro.') })}
                <div style="height:16px"></div>
                ${card({ title: 'Catálogo de la tienda Willie Inspired', desc: 'Precio base, precio en países de nivel alto y precio tachado.', flush: true, body: `<div class="table-wrap"><table><thead><tr><th>Producto</th><th>Tipo</th><th>Base</th><th>País alto</th><th>Tachado</th><th>Estado</th></tr></thead><tbody>${catalog}</tbody></table></div>` })}`;
            $('#priceFilter').value = filter;
            $('#priceFilter').onchange = (e) => { C.state.priceFilter = e.target.value; C.route(); };
        }
    };

    // ══ Comisiones ════════════════════════════════════════════════════════════
    const today = () => new Date().toISOString().slice(0, 10);
    C.pages.comisiones = {
        async render(view, token) {
            view.innerHTML = `${head('Comisiones ganadas', 'Lo que ganas por productos que vendieron otros (por ejemplo, 1 US$ por venta).')}${loading}`;
            let r;
            try { r = await api('/admin/commissions'); } catch (e) {
                view.innerHTML = head('Comisiones ganadas') + `<div class="alert alert--error">${icon('alert')}<div>${esc(e.message)}<br><span class="small">Si dice que la tabla no existe, falta correr la migración <b>20261024_willie_commissions.sql</b> en Supabase.</span></div></div>`;
                return;
            }
            if (token !== C.state.routeToken) return;
            const s = r.summary;
            const list = r.items.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Origen</th><th>Producto</th><th>Monto</th><th>Estado</th><th></th></tr></thead><tbody>${r.items.map((c) => `<tr>
                <td class="muted">${esc(c.earned_at)}</td><td>${esc(c.source)}</td><td>${esc(c.product || '—')}${c.notes ? `<br><span class="muted small">${esc(c.notes)}</span>` : ''}</td><td><b>${usd(c.amount_usd)}</b></td>
                <td><button class="btn btn--ghost btn--sm" data-toggle="${esc(c.id)}" data-status="${esc(c.status)}">${c.status === 'cobrada' ? '<span class="badge badge--success">cobrada</span>' : '<span class="badge badge--warning">pendiente</span>'}</button></td>
                <td><button class="btn btn--ghost btn--sm" data-del="${esc(c.id)}" aria-label="Borrar">${icon('x')}</button></td></tr>`).join('')}</tbody></table></div>` : empty('bag', 'Aún no anotaste comisiones.');
            view.innerHTML = `${head('Comisiones ganadas', 'Lo que ganas por productos que vendieron otros (por ejemplo, 1 US$ por venta).')}
                <div class="kpis">
                    ${kpi('Total ganado', usd(s.totalUsd), `${num(s.count)} comisiones`, 'trend')}
                    ${kpi('Por cobrar', usd(s.pendingUsd), 'pendiente', 'refresh')}
                    ${kpi('Ya cobrado', usd(s.paidUsd), 'en tu cuenta', 'check')}
                </div>
                <div class="grid grid-2" style="align-items:start">
                    ${card({ title: 'Anotar una comisión', body: `<form class="stack" id="comForm">
                        <div class="row"><label class="label grow">Origen<input class="input" name="source" maxlength="120" placeholder="Ej. Tienda de otro productor" required></label>
                        <label class="label" style="width:130px">Monto (US$)<input class="input" name="amountUsd" type="number" min="0.01" step="0.01" required placeholder="1.00"></label></div>
                        <div class="row"><label class="label grow">Producto<input class="input" name="product" maxlength="160" placeholder="Opcional"></label>
                        <label class="label" style="width:150px">Fecha<input class="input" name="earnedAt" type="date" value="${today()}"></label></div>
                        <label class="label">Nota<input class="input" name="notes" maxlength="500" placeholder="Opcional"></label>
                        <button class="btn btn--brand" id="comBtn">Guardar comisión</button></form>` })}
                    ${card({ title: 'Por mes', body: bars(s.byMonth.map((m) => ({ label: monthName(m.month), usd: m.usd })), 'label', 'usd', usd) })}
                </div>
                <div style="height:16px"></div>
                ${card({ title: 'Historial', flush: true, body: list })}`;
            $('#comForm').onsubmit = async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const btn = $('#comBtn'); btn.disabled = true;
                try {
                    await api('/admin/commissions', { method: 'POST', body: Object.fromEntries(fd) });
                    toast('Comisión guardada'); C.route();
                } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
            };
            view.onclick = async (e) => {
                const t = e.target.closest('[data-toggle]');
                const d = e.target.closest('[data-del]');
                try {
                    if (t) { await api(`/admin/commissions/${encodeURIComponent(t.dataset.toggle)}`, { method: 'PATCH', body: { status: t.dataset.status === 'cobrada' ? 'pendiente' : 'cobrada' } }); C.route(); }
                    if (d && confirm('¿Borrar esta comisión?')) { await api(`/admin/commissions/${encodeURIComponent(d.dataset.del)}`, { method: 'DELETE' }); C.route(); }
                } catch (err) { toast(err.message, 'error'); }
            };
        }
    };
})();
