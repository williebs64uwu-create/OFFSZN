/* CRM · Finanzas (vista nueva, aislada): bolsillos (banco, soles, PayPal con retiro), bruto vs neto real, mapa de calor, movimientos con filtros. La pantalla "Finanzas" de siempre no cambia. */
(() => {
    'use strict';
    const C = window.CRM;
    const { $, $$, esc, usd, num, icon, api, toast } = C;

    const pen = (n) => `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const pen0 = (n) => `S/ ${Math.round(Number(n || 0)).toLocaleString('es-PE')}`;
    const ars = (n) => `$ ${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS`;
    const money = (n, cur) => (n === null || n === undefined ? '—' : cur === 'PEN' ? pen(n) : cur === 'ARS' ? ars(n) : usd(n));
    const when = (iso) => new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
    const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const monthLabel = (m) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
    const nowMonth = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 7);
    const today = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
    const PAGE = 10;

    const KIND_CLASS = { Servicio: 'fx-tag--svc', Plugin: 'fx-tag--plg', Payhip: 'fx-tag--pay', 'Por revisar': 'fx-tag--warn', Otro: '' };
    const METHOD_CLASS = { paypal: 'fx-tag--pp', yape: 'fx-tag--yp', binance: 'fx-tag--bn', mp_argentina: 'fx-tag--ar', mercadopago: 'fx-tag--ar' };
    const card = (title, desc, body, extra = '') => `<section class="card ${extra}"><div class="card__head"><div><h2 class="card__title">${title}</h2>${desc ? `<p class="card__desc">${desc}</p>` : ''}</div></div><div class="card__body">${body}</div></section>`;
    const head = (title, desc = '', actions = '') => `<div class="page-head"><div><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ''}</div><div class="row">${actions}</div></div>`;

    const state = { method: 'all', kind: 'all', page: 1 };

    const status = (r) => {
        if (r.status === 'no_detail') return '<span class="badge badge--warning">Sin dato · revisar</span>';
        if (r.status === 'pending_review') return r.currency === 'ARS' ? '<span class="badge badge--warning">Pesos por confirmar</span>' : '<span class="badge badge--warning">Por revisar</span>';
        if (r.kind === 'Por revisar') return '<span class="badge badge--warning">Por revisar</span>';
        if (r.by_willie) return '<span class="badge badge--secondary">Acción de Willie</span>';
        return r.verified ? '<span class="badge badge--success">✓ Verificado</span>' : '<span class="badge badge--secondary">Sin verificar</span>';
    };

    const heat = (month, days) => {
        const [y, m] = month.split('-').map(Number);
        const total = new Date(y, m, 0).getDate();
        const map = new Map(days.map((d) => [d.date, d]));
        const max = Math.max(1, ...days.map((d) => d.pen));
        const cells = [];
        for (let d = 1; d <= total; d += 1) {
            const key = `${month}-${String(d).padStart(2, '0')}`;
            const x = map.get(key);
            const lvl = !x ? 0 : x.pen >= max * 0.66 ? 3 : x.pen >= max * 0.33 ? 2 : 1;
            cells.push(`<span class="fx-heat__c fx-l${lvl}" title="${d} ${MONTHS[m - 1]}: ${x ? `${pen0(x.pen)} · ${x.count} ${x.count === 1 ? 'pago' : 'pagos'}` : 'sin ingresos'}">${d}</span>`);
        }
        return `<div class="fx-heat">${cells.join('')}</div><div class="fx-legend muted small">Menos <i class="fx-heat__c fx-l0"></i><i class="fx-heat__c fx-l1"></i><i class="fx-heat__c fx-l2"></i><i class="fx-heat__c fx-l3"></i> Más · soles reales aproximados por día (hora de Lima)</div>`;
    };

    C.pages.finanzas2 = {
        async render(view, token) {
            const month = C.state.finMonth || nowMonth();
            view.innerHTML = `${head('Finanzas · vista nueva', 'Vista previa. La pantalla de Finanzas de siempre sigue igual.')}<div class="skeleton" style="height:260px"></div>`;
            let d;
            try { d = await api(`/admin/finance?month=${month}`); } catch (e) { view.innerHTML = head('Finanzas') + `<div class="alert alert--error">${icon('alert')}<div>${esc(e.message)}</div></div>`; return; }
            if (token !== C.state.routeToken) return;

            const s = d.summary; const k = d.pockets; const w = d.settings.withdraw; const pp = k.paypal; const real = k.real; const bank = d.settings.bank;
            const startLabel = new Date(d.settings.startAt).toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'long', year: 'numeric' });
            const alerts = [
                s.pendingArs.count ? `<div class="alert alert--warning">${icon('alert')}<div><b>${s.pendingArs.count} ${s.pendingArs.count === 1 ? 'pago' : 'pagos'} en pesos argentinos</b> (${ars(s.pendingArs.pesos)}) por confirmar. Todavía no suman.</div></div>` : '',
                s.noDetail.count ? `<div class="alert alert--warning">${icon('alert')}<div><b>${s.noDetail.count} ${s.noDetail.count === 1 ? 'despacho' : 'despachos'} sin dato de pago.</b> Revísalos abajo.</div></div>` : ''
            ].join('');
            const solesCount = Object.keys(k.soles.byMethod).length;
            const solesLines = Object.entries(k.soles.byMethod).map(([m, v]) => `<div class="row between"><span>${esc(d.methods[m] || m)}</span><b>${pen(v)}</b></div>`).join('');
            const pend = d.income.filter((r) => r.status === 'pending_review' && r.currency !== 'ARS').length;

            view.innerHTML = `${head('Finanzas · vista nueva', `Cada pago real desde el ${startLabel}. Bruto = lo que paga el cliente · Neto = lo que de verdad te queda.`,
                `<input class="input" type="month" id="finMonth" value="${month}" min="${d.settings.startAt.slice(0, 7)}" style="width:auto">`)}
                ${alerts}
                <div class="kpis">
                    <div class="card kpi fx-hero"><div class="kpi__top"><span>Neto real</span>${icon('bag')}</div><div class="kpi__value">${pen(real.netPen)}</div><div class="kpi__foot">Bruto ${pen(real.grossPen)} · se pierde ${pen(real.lostPen)} en comisiones y retiro</div></div>
                    <div class="card kpi"><div class="kpi__top"><span>Gastos</span>${icon('cart')}</div><div class="kpi__value">${pen(s.expenses.totalPen)}</div><div class="kpi__foot">${s.expenses.totalPen ? s.expenses.byCategory.filter((c) => c.count).map((c) => `${c.category.toLowerCase()} ${pen(c.totalPen)}`).join(' · ') : 'Sin gastos este mes'}</div></div>
                    <div class="card kpi"><div class="kpi__top"><span>Utilidad</span>${icon('dashboard')}</div><div class="kpi__value">${pen(real.resultPen)}</div><div class="kpi__foot">Neto real menos gastos de ${monthLabel(d.month)}</div></div>
                    <div class="card kpi"><div class="kpi__top"><span>Pagos</span>${icon('trend')}</div><div class="kpi__value">${num(s.income.count)}</div><div class="kpi__foot">${pend ? `${pend} por revisar` : 'Todos con producto'}</div></div>
                </div>

                <div class="fx-pockets">
                    ${card('Banco', 'Fijo. Lo editas tú; las ventas nuevas no se suman aquí.', `<div class="kpi__value">${pen(bank.pen)}</div><p class="muted small">Al ${esc(bank.as_of || '—')} · solo cambia con tus intereses de fin de mes</p>
                        <details style="margin-top:10px"><summary class="muted small" style="cursor:pointer">Actualizar saldo</summary>
                        <form id="bankForm" class="stack" style="margin-top:10px"><div class="row"><input class="input" name="pen" type="number" step="0.01" min="0" placeholder="Saldo en soles" required style="flex:1"><input class="input" name="asOf" type="date" value="${today()}" style="width:auto"></div><button class="btn btn--outline" type="submit">Guardar saldo</button></form></details>`)}
                    ${card('Yape y Binance', 'Soles que ya son netos. Sin retiro.', `<div class="kpi__value">${pen(k.soles.netPen)}</div><div class="stack" style="margin-top:8px;gap:4px">${solesCount ? solesLines : '<p class="muted small">Sin cobros en soles todavía.</p>'}</div>`)}
                    ${card('PayPal', `Dólares ya sin comisión · retiro cada ${w.threshold} US$`, `<div class="kpi__value">${usd(pp.balanceUsd)}</div>
                        <div class="bar" style="margin:10px 0 6px"><i style="width:${Math.max(2, Math.round(pp.progress * 100))}%"></i></div>
                        <p class="muted small">${pp.blocks ? `${pp.blocks} ${pp.blocks === 1 ? 'retiro listo' : 'retiros listos'} (−${usd(pp.withdrawCostUsd)} de costo) · ` : ''}faltan <b>${usd(pp.remainingUsd)}</b> para el siguiente retiro de ${w.threshold} US$</p>
                        <p class="small" style="margin-top:6px">≈ <b>${pen(pp.estPen)}</b> al cambio ${String(w.rate).replace('.', ',')}${pp.blocks ? ` (retiro −${usd(w.fee)} por cada ${w.threshold})` : ''}${pp.provisional ? ` · incluye −${usd(pp.provisionUsd)} de retiro como <b>previsión</b> (desde ${w.provision} US$); el retiro real es a los ${w.threshold} US$` : (pp.blocks ? '' : ` · el costo de retiro se prevé desde ${w.provision} US$`)}</p>`)}
                </div>

                <div class="grid grid-2">
                    ${card('Bruto → neto real', 'Así se va el dinero antes de llegar a tu bolsillo.', `
                        <div class="fx-steps">
                            <div class="row between"><span>Lo que pagaron (bruto)</span><b>${pen(real.grossPen)}</b></div>
                            <div class="row between muted"><span>Comisiones de PayPal</span><b>−${usd(pp.feeUsd)}</b></div>
                            <div class="row between muted"><span>Retiro de PayPal${pp.provisional && !pp.withdrawCostUsd ? ' (previsión)' : ''}</span><b>${pp.withdrawCostUsd || pp.provisionUsd ? `−${usd(pp.withdrawCostUsd + pp.provisionUsd)}` : 'aún no (menos de ' + w.provision + ' US$)'}</b></div>
                            <div class="row between fx-total"><span>Neto real</span><b>${pen(real.netPen)}</b></div>
                        </div>`)}
                    ${card('Ingresos por día', monthLabel(d.month), heat(d.month, d.byDay))}
                </div>
                ${s.byMethod.length ? '' : ''}
                <div id="fxMovs"></div>
                <div class="grid grid-2" style="margin-top:16px">
                    ${card('Registrar un gasto', 'Siempre en soles.', `<form id="expForm" class="stack">
                        <select class="select" name="category" id="expCat">${d.categories.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
                        <div class="row"><input class="input" name="amountPen" type="number" step="0.01" min="0.01" placeholder="Monto en soles" required style="flex:1"><input class="input" name="spentAt" type="date" value="${today()}" style="width:auto"></div>
                        <input class="input" name="note" id="expNote" placeholder="Nota (en suscripción importante: cuál es)">
                        <input class="input" name="ref" placeholder="N° de operación (opcional, evita duplicados)">
                        <button class="btn btn--brand" type="submit">${icon('plus')} Guardar gasto</button></form>`)}
                    ${card('Gastos', `${d.expenses.length} en ${monthLabel(d.month)}`, d.expenses.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Categoría</th><th>Monto</th><th></th></tr></thead><tbody>${d.expenses.map((e) => `<tr><td class="muted">${esc(e.spent_at)}</td><td>${esc(e.category)}</td><td><b>${pen(e.amount_pen)}</b></td><td><button class="btn btn--ghost btn--sm" data-del-expense="${esc(e.id)}">Quitar</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><p>Sin gastos este mes.</p></div>')}
                </div>
                ${d.pendingArs.length ? card('Pesos argentinos por confirmar', 'Cuando llegan los soles se reparten entre estos pagos. El depósito no se anota como venta nueva.', `<form id="arsForm" class="stack">
                    <div class="table-wrap"><table><thead><tr><th></th><th>Cuándo</th><th>Correo</th><th>Producto</th><th>Pesos</th></tr></thead><tbody>${d.pendingArs.map((r) => `<tr><td><input type="checkbox" name="ids" value="${esc(r.id)}" checked></td><td class="muted">${esc(when(r.occurred_at))}</td><td>${esc(r.email || '—')}</td><td>${esc(r.product || 'Sin nombre')}</td><td><b>${ars(r.gross)}</b></td></tr>`).join('')}</tbody></table></div>
                    <div class="row" style="flex-wrap:wrap"><input class="input" name="label" value="Depósito de Sayko" style="flex:1;min-width:180px"><input class="input" name="pen" type="number" step="0.01" min="0.01" placeholder="Soles que llegaron" required style="width:170px"><input class="input" name="ref" placeholder="N° de operación (Yape)" style="width:190px"></div>
                    <button class="btn btn--brand" type="submit">Confirmar con este depósito</button></form>`, 'mt16') : ''}`;

            const methods = [...new Set(d.income.map((r) => r.method))];
            const kinds = [...new Set(d.income.map((r) => r.kind))];
            const drawMovs = () => {
                const list = d.income.filter((r) => (state.method === 'all' || r.method === state.method) && (state.kind === 'all' || r.kind === state.kind));
                const pages = Math.max(1, Math.ceil(list.length / PAGE));
                state.page = Math.min(state.page, pages);
                const slice = list.slice((state.page - 1) * PAGE, state.page * PAGE);
                const chip = (group, v, label, cur) => `<button class="chip ${cur === v ? 'is-active' : ''}" data-f="${group}" data-v="${esc(v)}">${esc(label)}</button>`;
                $('#fxMovs').innerHTML = card('Movimientos', `${list.length} ${list.length === 1 ? 'movimiento' : 'movimientos'} en ${monthLabel(d.month)} · hora de Lima`, `
                    <div class="fx-filters"><div class="chips">${chip('method', 'all', 'Todos los métodos', state.method)}${methods.map((m) => chip('method', m, d.methods[m] || m, state.method)).join('')}</div>
                    <div class="chips">${chip('kind', 'all', 'Todo tipo', state.kind)}${kinds.map((x) => chip('kind', x, x, state.kind)).join('')}</div></div>
                    ${slice.length ? `<div class="table-wrap"><table><thead><tr><th>Cuándo</th><th>Producto</th><th>Método</th><th>Bruto</th><th>Comisión</th><th>Neto</th><th>Estado</th><th></th></tr></thead><tbody>${slice.map((r) => `<tr>
                        <td class="muted" style="white-space:nowrap">${esc(when(r.occurred_at))}</td>
                        <td>${esc(r.product || 'Sin nombre')} <span class="fx-tag ${KIND_CLASS[r.kind] || ''}">${esc(r.kind)}</span><div class="muted small">${esc(r.email || '')}</div></td>
                        <td><span class="fx-tag ${METHOD_CLASS[r.method] || ''}">${esc(d.methods[r.method] || r.method)}</span></td>
                        <td>${money(r.gross, r.currency)}</td><td class="${r.fee ? 'fx-fee' : 'muted'}">${r.fee === null || r.fee === undefined ? '—' : `−${money(r.fee, r.currency)}`}</td>
                        <td><b class="fx-net">${r.currency === 'ARS' && r.settled_pen !== null && r.settled_pen !== undefined ? pen(r.settled_pen) : money(r.net, r.currency)}</b></td>
                        <td>${status(r)}</td>
                        <td>${r.method === 'paypal' && !r.by_willie && !r.verified ? `<button class="btn btn--ghost btn--sm" data-verify="${esc(r.id)}">Verificar</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
                        : '<div class="empty"><p>No hay movimientos con ese filtro.</p></div>'}
                    <div class="fx-pager muted small"><span>Mostrando ${slice.length} de ${list.length}</span><span><button class="btn btn--ghost btn--sm" data-pg="-1" ${state.page <= 1 ? 'disabled' : ''}>‹</button> ${state.page} / ${pages} <button class="btn btn--ghost btn--sm" data-pg="1" ${state.page >= pages ? 'disabled' : ''}>›</button></span></div>`);
                $$('#fxMovs [data-f]').forEach((b) => { b.onclick = () => { state[b.dataset.f] = b.dataset.v; state.page = 1; drawMovs(); }; });
                $$('#fxMovs [data-pg]').forEach((b) => { b.onclick = () => { state.page += Number(b.dataset.pg); drawMovs(); }; });
                $$('#fxMovs [data-verify]').forEach((b) => {
                    b.onclick = async () => {
                        b.disabled = true; b.textContent = 'Consultando…';
                        try {
                            const r = await api(`/admin/finance/income/${b.dataset.verify}/verify`, { method: 'POST' });
                            toast(r.verified ? `PayPal lo confirma · neto ${usd(r.net)}` : (r.message || 'PayPal no lo confirma'), r.verified ? undefined : 'error');
                            C.route();
                        } catch (err) { toast(err.message, 'error'); b.disabled = false; b.textContent = 'Verificar'; }
                    };
                });
            };
            drawMovs();

            $('#finMonth').onchange = (e) => { C.state.finMonth = e.target.value || nowMonth(); state.page = 1; C.route(); };
            const arsForm = $('#arsForm');
            if (arsForm) arsForm.onsubmit = async (e) => {
                e.preventDefault();
                const f = new FormData(e.target); const ids = f.getAll('ids');
                if (!ids.length) { toast('Marca al menos un pago', 'error'); return; }
                try { const r = await api('/admin/finance/settle-ars', { method: 'POST', body: { ids, label: f.get('label'), pen: f.get('pen'), ref: f.get('ref') } }); toast(r.duplicate ? 'Ese depósito ya estaba aplicado' : `${r.settled} confirmados con ${pen(r.pen)}`); C.route(); } catch (err) { toast(err.message, 'error'); }
            };
            $('#bankForm').onsubmit = async (e) => {
                e.preventDefault(); const f = new FormData(e.target);
                try { await api('/admin/finance/bank', { method: 'PUT', body: { pen: f.get('pen'), asOf: f.get('asOf') } }); toast('Saldo actualizado'); C.route(); } catch (err) { toast(err.message, 'error'); }
            };
            $('#expForm').onsubmit = async (e) => {
                e.preventDefault(); const f = new FormData(e.target);
                try { await api('/admin/finance/expenses', { method: 'POST', body: { category: f.get('category'), amountPen: f.get('amountPen'), spentAt: f.get('spentAt'), note: f.get('note'), ref: f.get('ref') } }); toast('Gasto guardado'); C.route(); } catch (err) { toast(err.message, 'error'); }
            };
            $$('[data-del-expense]').forEach((b) => { b.onclick = async () => { if (!confirm('¿Quitar este gasto?')) return; try { await api(`/admin/finance/expenses/${b.dataset.delExpense}`, { method: 'DELETE' }); toast('Gasto quitado'); C.route(); } catch (err) { toast(err.message, 'error'); } }; });
            $('#expCat').onchange = (e) => { $('#expNote').required = e.target.value === 'SUSCRIPCIÓN IMPORTANTE'; };
        }
    };
})();
