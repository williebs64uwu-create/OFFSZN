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
            const TITLE = 'Historial de ventas';
            const DESC = 'Solo tus productos y solo ventas de pago (sin beats, sin regalos, sin productos de otros productores).';
            view.innerHTML = `${head(TITLE, DESC)}${loading}`;
            let r;
            try { r = await api('/admin/sales'); } catch (e) { view.innerHTML = head(TITLE) + fail(e); return; }
            if (token !== C.state.routeToken) return;
            const t = r.totals;
            const monthly = r.byMonth.map((m) => ({ ...m, label: monthName(m.month) }));
            view.innerHTML = `${head(TITLE, DESC)}
                <div class="kpis">
                    ${kpi('Ingresos', usd(t.revenueUsd), `${num(t.units)} productos vendidos`, 'trend')}
                    ${kpi('Ventas', num(t.orders), 'órdenes con algo de pago', 'cart')}
                    ${kpi('Ticket medio', usd(t.avgTicketUsd), 'por venta', 'bag')}
                    ${kpi('Productos con ventas', num(t.products), `de ${num(r.scope.productsOwned)} en tu cuenta`, 'users')}
                </div>
                <div class="grid grid-2">
                    ${card({ title: 'Ingresos por mes', body: bars(monthly, 'label', 'revenueUsd', usd) })}
                    ${card({ title: 'Plugins, plantillas y presets', desc: 'Separado por el nombre del producto.', body: bars(r.byClass.map((x) => ({ key: `${x.label} · ${num(x.units)} u.`, revenueUsd: x.revenueUsd })), 'key', 'revenueUsd', usd) })}
                </div>
                ${card({ title: 'Lo que más dinero dejó', flush: true, body: r.best.length ? `<div class="table-wrap"><table><thead><tr><th>Producto</th><th>Tipo</th><th>Vendidos</th><th>Precio cobrado</th><th>Ingresos</th></tr></thead><tbody>${r.best.map((p) => `<tr><td>${esc(p.name)}</td><td class="muted">${esc(p.type)}</td><td>${num(p.units)}</td><td>${p.minPaid === p.maxPaid ? usd(p.minPaid) : `${usd(p.minPaid)} – ${usd(p.maxPaid)}`}</td><td><b>${usd(p.revenueUsd)}</b></td></tr>`).join('')}</tbody></table></div>` : empty('bag', 'Sin ventas de pago.') })}
                <div style="height:16px"></div>
                <div class="grid grid-2">
                    ${card({ title: 'Cómo quieren pagar', desc: `${num(r.interest.total)} clics en botones de pago manual.`, body: bars(r.interest.byMethod, 'key', 'clicks', num) })}
                    ${card({ title: 'Qué productos piden pagar', body: bars(r.interest.byProduct, 'key', 'clicks', num) })}
                </div>
                <p class="muted small" style="margin-top:12px">Cuenta de productor contada: ${r.scope.producerIds.map((x) => esc(x.slice(0, 8))).join(', ')}… Si no es la tuya, dímelo.</p>`;
        }
    };

    // ══ Productos y precios ═══════════════════════════════════════════════════
    C.pages.productos = {
        async render(view, token) {
            view.innerHTML = `${head('Productos y precios', 'Solo tus productos: el precio de lista y lo que realmente se cobró (sin beats).')}${loading}`;
            let r;
            try { r = await api('/admin/product-prices'); } catch (e) { view.innerHTML = head('Productos y precios') + fail(e); return; }
            if (token !== C.state.routeToken) return;
            const filter = C.state.priceFilter || 'todos';
            const rows = r.products.filter((p) => (filter === 'cobrados' ? p.paidUnits > 0 : filter === 'revisar' ? p.mismatch : true));
            const catalog = r.catalog.map((p) => `<tr><td>${esc(p.title)}</td><td><span class="badge badge--secondary">${esc(p.category)}</span></td><td>${p.baseUsd != null ? usd(p.baseUsd) : '—'}</td><td>${p.highUsd != null ? usd(p.highUsd) : '—'}</td><td class="muted">${p.compareAtUsd != null ? usd(p.compareAtUsd) : '—'}</td><td>${p.status === 'active' ? '<span class="badge badge--success">activo</span>' : `<span class="badge badge--outline">${esc(p.status || '—')}</span>`}</td></tr>`).join('');
            view.innerHTML = `${head('Productos y precios', 'Solo tus productos: el precio de lista y lo que realmente se cobró (sin beats).',
                `<select class="select" id="priceFilter" style="width:auto"><option value="todos">Todos</option><option value="cobrados">Solo con ventas de pago</option><option value="revisar">Precio a revisar</option></select>`)}
                ${card({ title: 'Precios reales en OFFSZN', desc: '“A revisar” = se cobró distinto al precio de lista (descuentos, 2x1 o precios viejos).', flush: true, body: rows.length ? `<div class="table-wrap"><table><thead><tr><th>Producto</th><th>Tipo</th><th>Precio de lista</th><th>Vendidos</th><th>Cobrado</th><th>Ingresos</th></tr></thead><tbody>${rows.slice(0, 120).map((p) => `<tr><td>${esc(p.name)}${p.mismatch ? ' <span class="badge badge--warning">a revisar</span>' : ''}</td><td class="muted">${esc(p.type)}</td><td>${p.listPriceUsd ? usd(p.listPriceUsd) : '—'}</td><td>${num(p.paidUnits)}</td><td>${p.minPaidUsd == null ? '—' : p.minPaidUsd === p.maxPaidUsd ? usd(p.minPaidUsd) : `${usd(p.minPaidUsd)} – ${usd(p.maxPaidUsd)}`}</td><td><b>${usd(p.revenueUsd)}</b></td></tr>`).join('')}</tbody></table></div>` : empty('bag', 'Nada con ese filtro.') })}
                <div style="height:16px"></div>
                ${card({ title: 'Catálogo de la tienda Willie Inspired', desc: 'Precio base, precio en países de nivel alto y precio tachado.', flush: true, body: `<div class="table-wrap"><table><thead><tr><th>Producto</th><th>Tipo</th><th>Base</th><th>País alto</th><th>Tachado</th><th>Estado</th></tr></thead><tbody>${catalog}</tbody></table></div>` })}`;
            $('#priceFilter').value = filter;
            $('#priceFilter').onchange = (e) => { C.state.priceFilter = e.target.value; C.route(); };
        }
    };
})();
