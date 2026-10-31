/* CRM Willie Inspired · Finanzas: ingresos reales desde el 31 de octubre de 2026 (bruto, comisión y neto), gastos en soles y cuenta del banco. */
(() => {
    'use strict';
    const C = window.CRM;
    const { $, $$, esc, usd, num, icon, api, toast } = C;

    const card = ({ title, desc = '', actions = '', body = '', flush = false }) => `<section class="card ${flush ? 'card--flush' : ''}">
        ${title ? `<div class="card__head"><div><h2 class="card__title">${title}</h2>${desc ? `<p class="card__desc">${desc}</p>` : ''}</div>${actions}</div>` : ''}<div class="card__body">${body}</div></section>`;
    const head = (title, desc = '', actions = '') => `<div class="page-head"><div><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ''}</div><div class="row">${actions}</div></div>`;
    const kpi = (l, v, f, ic) => `<div class="card kpi"><div class="kpi__top"><span>${l}</span>${icon(ic)}</div><div class="kpi__value">${v}</div><div class="kpi__foot">${f}</div></div>`;
    const bars = (list, label, value, fmt) => {
        const max = Math.max(1, ...list.map((r) => r[value]));
        return list.length ? list.map((r) => `<div class="list-row"><div class="grow"><div class="row between"><span>${esc(r[label])}</span><b>${fmt(r[value])}</b></div><div class="bar" style="margin-top:6px"><i style="width:${Math.max(3, (r[value] / max) * 100)}%"></i></div></div></div>`).join('')
            : '<div class="empty"><p>Todavía no hay datos este mes.</p></div>';
    };

    const pen = (n) => `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const ars = (n) => `$ ${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS`;
    const money = (n, cur) => (n === null || n === undefined ? '—' : cur === 'PEN' ? pen(n) : cur === 'ARS' ? ars(n) : usd(n));
    const when = (iso) => new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const monthLabel = (m) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
    const nowMonth = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 7);

    const status = (r) => {
        if (r.status === 'no_detail') return '<span class="badge badge--warn">Sin dato · revisar</span>';
        if (r.status === 'pending_review') return '<span class="badge badge--warn">Pesos por confirmar</span>';
        if (r.currency === 'ARS' && r.settled_pen !== null && r.settled_pen !== undefined) return '<span class="badge badge--ok">Confirmado con soles</span>';
        if (r.by_willie) return '<span class="badge">Acción de Willie</span>';
        return r.verified ? '<span class="badge badge--ok">Verificado</span>' : '<span class="badge">Sin verificar</span>';
    };

    C.pages.finanzas = {
        async render(view, token) {
            const month = C.state.finMonth || nowMonth();
            view.innerHTML = `${head('Finanzas', 'Cada pago real desde el 31 de octubre de 2026, con su bruto, comisión y neto. Lo anterior no entra aquí.')}<div class="skeleton" style="height:240px"></div>`;
            let d;
            try { d = await api(`/admin/finance?month=${month}`); } catch (e) { view.innerHTML = head('Finanzas') + `<div class="alert alert--error">${icon('alert')}<div>${esc(e.message)}${/finance_/.test(e.message) ? ' · Falta correr la migración 20261031_finance_ledger.sql.' : ''}</div></div>`; return; }
            if (token !== C.state.routeToken) return;

            const s = d.summary; const fx = s.fx; const inc = s.income; const bank = d.settings.bank;
            const startLabel = new Date(d.settings.startAt).toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'long', year: 'numeric' });
            const alerts = [
                s.pendingArs.count ? `<div class="alert alert--warning">${icon('alert')}<div><b>${s.pendingArs.count} ${s.pendingArs.count === 1 ? 'pago' : 'pagos'} en pesos argentinos</b> (${ars(s.pendingArs.pesos)}) por confirmar a fin de mes. Todavía no suman a los totales.</div></div>` : '',
                s.noDetail.count ? `<div class="alert alert--warning">${icon('alert')}<div><b>${s.noDetail.count} ${s.noDetail.count === 1 ? 'despacho' : 'despachos'} sin dato de pago.</b> Se entregaron pero falta decir cuánto pagaron; revísalos abajo.</div></div>` : ''
            ].join('');

            const incomeRows = d.income.map((r) => `<tr>
                <td class="muted">${esc(when(r.occurred_at))}</td>
                <td>${esc(r.email || '—')}</td>
                <td>${esc(r.product || 'Sin nombre')}</td>
                <td class="muted">${esc(d.methods[r.method] || r.method)}</td>
                <td>${money(r.gross, r.currency)}</td>
                <td class="muted">${r.fee === null ? '—' : money(r.fee, r.currency)}</td>
                <td><b>${r.currency === 'ARS' && r.settled_pen !== null && r.settled_pen !== undefined ? pen(r.settled_pen) : money(r.net, r.currency)}</b></td>
                <td>${status(r)}</td>
                <td>${r.method === 'paypal' && !r.by_willie ? `<button class="btn btn--ghost btn--sm" data-verify="${esc(r.id)}">Verificar</button>` : ''}</td>
            </tr>`).join('');

            const expenseRows = d.expenses.map((e) => `<tr>
                <td class="muted">${esc(e.spent_at)}</td><td>${esc(e.category)}</td><td class="muted">${esc(e.note || '')}</td><td><b>${pen(e.amount_pen)}</b></td>
                <td><button class="btn btn--ghost btn--sm" data-del-expense="${esc(e.id)}">Quitar</button></td></tr>`).join('');

            view.innerHTML = `${head('Finanzas', `Cada pago real desde el ${startLabel}, con su bruto, comisión y neto. Lo anterior no entra aquí: está en Histórico.`,
                `<input class="input" type="month" id="finMonth" value="${month}" min="${d.settings.startAt.slice(0, 7)}" style="width:auto">`)}
                ${alerts}
                <div class="kpis">
                    ${kpi('Ingresos brutos', usd(inc.grossUsd), `${num(inc.count)} ${inc.count === 1 ? 'pago' : 'pagos'} · comisiones ${usd(inc.feeUsd)}`, 'trend')}
                    ${kpi('Neto', usd(inc.netUsd), `≈ ${pen(inc.netPen)} · dólar a ${fx}`, 'bag')}
                    ${kpi('Gastos', pen(s.expenses.totalPen), `${s.expenses.byCategory.map((c) => `${c.category.toLowerCase()} ${pen(c.totalPen)}`).join(' · ')}`, 'cart')}
                    ${kpi('Resultado', pen(s.result.pen), `≈ ${usd(s.result.usd)} · neto menos gastos de ${monthLabel(d.month)}`, 'dashboard')}
                </div>
                <div class="grid grid-2">
                    ${card({ title: 'Cuenta del banco', desc: 'Tu dinero real. No se toca solo: las ventas nuevas no se suman aquí.', body: `
                        <div class="kpi__value" style="margin-bottom:4px">${pen(bank.pen)}</div>
                        <p class="muted small">Al ${esc(bank.as_of || '—')} · ≈ ${usd(bank.pen / fx)} a ${fx}</p>
                        <form id="bankForm" class="stack" style="margin-top:14px">
                            <div class="row"><input class="input" name="pen" type="number" step="0.01" min="0" placeholder="Saldo en soles" required style="flex:1"><input class="input" name="asOf" type="date" value="${new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10)}" style="width:auto"></div>
                            <button class="btn btn--outline" type="submit">Actualizar saldo</button>
                        </form>` })}
                    ${card({ title: 'Por método de pago', desc: 'Neto en dólares.', body: bars(s.byMethod, 'label', 'netUsd', usd) })}
                </div>
                <div class="grid grid-2">
                    ${card({ title: 'Por producto', desc: 'Neto en dólares.', body: bars(s.byProduct, 'product', 'netUsd', usd) })}
                    ${card({ title: 'Registrar un gasto', desc: 'Siempre en soles.', body: `
                        <form id="expForm" class="stack">
                            <select class="select" name="category" id="expCat">${d.categories.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
                            <div class="row"><input class="input" name="amountPen" type="number" step="0.01" min="0.01" placeholder="Monto en soles" required style="flex:1"><input class="input" name="spentAt" type="date" value="${new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10)}" style="width:auto"></div>
                            <input class="input" name="note" id="expNote" placeholder="Nota (en suscripción importante: cuál es)">
                            <input class="input" name="ref" placeholder="N° de operación (opcional, evita duplicados)">
                            <button class="btn btn--brand" type="submit">${icon('plus')} Guardar gasto</button>
                        </form>` })}
                </div>
                ${d.pendingArs.length ? card({ title: 'Pesos argentinos por confirmar', desc: 'Cuando llegan los soles (ej. el depósito de Sayko) se reparten entre estos pagos y pasan a contar como neto. El depósito no se anota como venta nueva.', body: `
                    <form id="arsForm" class="stack">
                        <div class="table-wrap"><table><thead><tr><th></th><th>Cuándo</th><th>Correo</th><th>Producto</th><th>Pesos</th></tr></thead><tbody>${d.pendingArs.map((r) => `<tr><td><input type="checkbox" name="ids" value="${esc(r.id)}" checked></td><td class="muted">${esc(when(r.occurred_at))}</td><td>${esc(r.email || '—')}</td><td>${esc(r.product || 'Sin nombre')}</td><td><b>${ars(r.gross)}</b></td></tr>`).join('')}</tbody></table></div>
                        <div class="row" style="flex-wrap:wrap"><input class="input" name="label" value="Depósito de Sayko" placeholder="Nombre del depósito" style="flex:1;min-width:180px"><input class="input" name="pen" type="number" step="0.01" min="0.01" placeholder="Soles que llegaron" required style="width:170px"><input class="input" name="ref" placeholder="N° de operación (Yape)" style="width:190px"></div>
                        <button class="btn btn--brand" type="submit">Confirmar con este depósito</button>
                    </form>` }) + '<div style="height:16px"></div>' : ''}
                ${card({ title: 'Ingresos', desc: `${d.income.length} en ${monthLabel(d.month)} · hora de Lima`, flush: true, body: d.income.length ? `<div class="table-wrap"><table><thead><tr><th>Cuándo</th><th>Correo</th><th>Producto</th><th>Método</th><th>Bruto</th><th>Comisión</th><th>Neto</th><th>Estado</th><th></th></tr></thead><tbody>${incomeRows}</tbody></table></div>` : `<div class="empty">${icon('activity')}<p>Todavía no hay pagos este mes.</p></div>` })}
                <div style="height:16px"></div>
                ${card({ title: 'Gastos', desc: `${d.expenses.length} en ${monthLabel(d.month)}`, flush: true, body: d.expenses.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Categoría</th><th>Nota</th><th>Monto</th><th></th></tr></thead><tbody>${expenseRows}</tbody></table></div>` : `<div class="empty">${icon('activity')}<p>Sin gastos este mes.</p></div>` })}`;

            $('#finMonth').onchange = (e) => { C.state.finMonth = e.target.value || nowMonth(); C.route(); };
            const arsForm = $('#arsForm');
            if (arsForm) arsForm.onsubmit = async (e) => {
                e.preventDefault();
                const f = new FormData(e.target);
                const ids = f.getAll('ids');
                if (!ids.length) { toast('Marca al menos un pago', 'error'); return; }
                try {
                    const r = await api('/admin/finance/settle-ars', { method: 'POST', body: { ids, label: f.get('label'), pen: f.get('pen'), ref: f.get('ref') } });
                    toast(r.duplicate ? 'Ese depósito ya estaba aplicado' : `${r.settled} ${r.settled === 1 ? 'pago confirmado' : 'pagos confirmados'} con ${pen(r.pen)}`);
                    C.route();
                } catch (err) { toast(err.message, 'error'); }
            };
            $('#bankForm').onsubmit = async (e) => {
                e.preventDefault();
                const f = new FormData(e.target);
                try { await api('/admin/finance/bank', { method: 'PUT', body: { pen: f.get('pen'), asOf: f.get('asOf') } }); toast('Saldo actualizado'); C.route(); } catch (err) { toast(err.message, 'error'); }
            };
            $('#expForm').onsubmit = async (e) => {
                e.preventDefault();
                const f = new FormData(e.target);
                try { await api('/admin/finance/expenses', { method: 'POST', body: { category: f.get('category'), amountPen: f.get('amountPen'), spentAt: f.get('spentAt'), note: f.get('note'), ref: f.get('ref') } }); toast('Gasto guardado'); C.route(); } catch (err) { toast(err.message, 'error'); }
            };
            $$('[data-del-expense]').forEach((b) => { b.onclick = async () => { if (!confirm('¿Quitar este gasto?')) return; try { await api(`/admin/finance/expenses/${b.dataset.delExpense}`, { method: 'DELETE' }); toast('Gasto quitado'); C.route(); } catch (err) { toast(err.message, 'error'); } }; });
            $$('[data-verify]').forEach((b) => {
                b.onclick = async () => {
                    b.disabled = true; b.textContent = 'Consultando…';
                    try {
                        const r = await api(`/admin/finance/income/${b.dataset.verify}/verify`, { method: 'POST' });
                        toast(r.verified ? `PayPal lo confirma · neto ${usd(r.net)}` : (r.message || 'PayPal no lo confirma'), r.verified ? undefined : 'error');
                        C.route();
                    } catch (err) { toast(err.message, 'error'); b.disabled = false; b.textContent = 'Verificar'; }
                };
            });
            // En "suscripción importante" la nota es obligatoria
            $('#expCat').onchange = (e) => { $('#expNote').required = e.target.value === 'SUSCRIPCIÓN IMPORTANTE'; };
        }
    };
})();
