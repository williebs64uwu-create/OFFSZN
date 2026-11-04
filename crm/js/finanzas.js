/* CRM · Finanzas: bolsillos (banco, soles, PayPal con retiro), bruto vs neto real, mapa de calor, simulador de retiro y movimientos con filtros. */
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

    // Mapa de calor: filas = lunes a domingo, columnas = semanas del mes. Más verde = más ingresos ese día.
    const heat = (month, days) => {
        const [y, m] = month.split('-').map(Number);
        const total = new Date(y, m, 0).getDate();
        const map = new Map(days.map((x) => [x.date, x]));
        const max = Math.max(1, ...days.map((x) => x.pen));
        const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // 0 = lunes
        const weeks = Math.ceil((lead + total) / 7);
        const names = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        let rows = '';
        for (let r = 0; r < 7; r += 1) {
            let cols = '';
            for (let wk = 0; wk < weeks; wk += 1) {
                const day = wk * 7 + r - lead + 1;
                if (day < 1 || day > total) { cols += '<span class="fx-heat__c fx-l-none"></span>'; continue; }
                const x = map.get(`${month}-${String(day).padStart(2, '0')}`);
                const lvl = !x ? 0 : x.pen >= max * 0.66 ? 3 : x.pen >= max * 0.33 ? 2 : 1;
                cols += `<span class="fx-heat__c fx-l${lvl}" title="${day} de ${MONTHS[m - 1]}: ${x ? `${pen0(x.pen)} · ${x.count} ${x.count === 1 ? 'pago' : 'pagos'}` : 'sin ingresos'}">${day}</span>`;
            }
            rows += `<div class="fx-heat__row"><span class="fx-heat__lab">${names[r]}</span><div class="fx-heat__cols" style="grid-template-columns:repeat(${weeks},1fr)">${cols}</div></div>`;
        }
        return `<div class="fx-heat2">${rows}</div><div class="fx-legend muted small">Menos <i class="fx-heat__c fx-l0"></i><i class="fx-heat__c fx-l1"></i><i class="fx-heat__c fx-l2"></i><i class="fx-heat__c fx-l3"></i> Más · pasa el dedo o el mouse por un día para ver cuánto fue</div>`;
    };

    C.pages.finanzas = {
        async render(view, token) {
            const month = C.state.finMonth || nowMonth();
            view.innerHTML = `${head('Finanzas', 'Cargando…')}<div class="skeleton" style="height:260px"></div>`;
            let d;
            try { d = await api(`/admin/finance?month=${month}`); } catch (e) { view.innerHTML = head('Finanzas') + `<div class="alert alert--error">${icon('alert')}<div>${esc(e.message)}</div></div>`; return; }
            if (token !== C.state.routeToken) return;

            const s = d.summary; const k = d.pockets; const w = d.settings.withdraw; const pp = k.paypal; const real = k.real; const bank = d.settings.bank; const yp = d.settings.yape || {}; const hasYape = yp.pen !== null && yp.pen !== undefined; const lv = d.live || { yape: { now: hasYape ? Number(yp.pen) : null, base: yp.pen, newSales: 0, newSpent: 0, newSent: 0 }, bank: { now: bank.pen, base: bank.pen, newSent: 0 } }; const yapeNow = hasYape ? lv.yape.now : null; const available = hasYape ? yapeNow + pp.nowPen : 0; const sentPen = Number(d.transfersPen) || 0; const monthTotal = available + sentPen;
            const startLabel = new Date(d.settings.startAt).toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'long', year: 'numeric' });
            const alerts = [
                s.pendingArs.count ? `<div class="alert alert--warning">${icon('alert')}<div><b>${s.pendingArs.count} ${s.pendingArs.count === 1 ? 'pago' : 'pagos'} en pesos argentinos</b> (${ars(s.pendingArs.pesos)}) por confirmar. Todavía no suman.</div></div>` : '',
                s.noDetail.count ? `<div class="alert alert--warning">${icon('alert')}<div><b>${s.noDetail.count} ${s.noDetail.count === 1 ? 'despacho' : 'despachos'} sin dato de pago.</b> Revísalos abajo.</div></div>` : ''
            ].join('');
            const solesCount = Object.keys(k.soles.byMethod).length;
            const solesLines = Object.entries(k.soles.byMethod).map(([m, v]) => `<div class="row between"><span>${esc(d.methods[m] || m)}</span><b>${pen(v)}</b></div>`).join('');
            const pend = d.income.filter((r) => r.status === 'pending_review' && r.currency !== 'ARS').length;

            view.innerHTML = `${head('Finanzas', `Cada pago real desde el ${startLabel}. Bruto = lo que paga el cliente · Neto = lo que te queda después de comisiones.`,
                `<input class="input" type="month" id="finMonth" value="${month}" min="${d.settings.startAt.slice(0, 7)}" style="width:auto">`)}
                ${alerts}
                <div class="card fx-guide"><b>Cómo leer esta pantalla</b>
                    <div class="fx-keys">
                        <span class="fx-key"><i class="fx-dot fx-dot--green"></i><b>Verde</b> = dinero que te queda (neto)</span>
                        <span class="fx-key"><i class="fx-dot fx-dot--red"></i><b>Rojo</b> = lo que se pierde (comisión, retiro)</span>
                        <span class="fx-key"><i class="fx-dot fx-dot--pp"></i><b>Azul</b> = PayPal (dólares)</span>
                        <span class="fx-key"><i class="fx-dot fx-dot--yp"></i><b>Morado</b> = Yape (soles)</span>
                        <span class="fx-key"><i class="fx-dot fx-dot--bn"></i><b>Amarillo</b> = Binance (llega a Yape)</span>
                        <span class="fx-key"><i class="fx-dot fx-dot--warn"></i><b>Naranja</b> = por revisar</span>
                        <span class="fx-key"><i class="fx-dot fx-dot--gray"></i><b>Gris</b> = dato de control, no suma</span>
                    </div></div>
                <div class="kpis">
                    ${hasYape
                        ? `<div class="card kpi fx-hero"><div class="kpi__top"><span>💰 Dinero para depositar</span>${icon('bag')}</div><div class="kpi__value">${pen(available)}</div><div class="kpi__foot">Yape ${pen(yapeNow)} (Binance incluido) + PayPal cambiado a soles ${pen(pp.nowPen)} (ya con el −${usd(pp.nowCostUsd)} del retiro). Los gastos y lo enviado al banco ya están descontados.</div></div>
                           <div class="card kpi"><div class="kpi__top"><span>Dinero del mes total</span>${icon('trend')}</div><div class="kpi__value">${pen(monthTotal)}</div><div class="kpi__foot">${pen(available)} para depositar + ${pen(sentPen)} que ya enviaste al banco este mes.</div></div>`
                        : `<div class="card kpi fx-hero"><div class="kpi__top"><span>PayPal si retiras hoy</span>${icon('bag')}</div><div class="kpi__value">${pen(pp.nowPen)}</div><div class="kpi__foot">Anota tu saldo de Yape más abajo para ver el total.</div></div>`}
                    <div class="card kpi"><div class="kpi__top"><span>Gastos</span>${icon('cart')}</div><div class="kpi__value fx-neg">${pen(s.expenses.totalPen)}</div><div class="kpi__foot">${s.expenses.totalPen ? s.expenses.byCategory.filter((c) => c.count).map((c) => `${c.category.toLowerCase()} ${pen(c.totalPen)}`).join(' · ') : 'Sin gastos este mes'} · ya está descontado en tu Yape, no se resta otra vez.</div></div>
                </div>

                ${d.goal ? card('🎯 Meta del mes', 'Se mide con tus ventas netas del mes (ya sin comisiones). Mínimo ≈ US$ 1.000.', `
                    <div class="row between" style="align-items:baseline;flex-wrap:wrap"><span class="kpi__value">${pen(d.goal.salesNetPen)}</span><span class="muted small">${d.goal.level === 'none' ? `faltan ${pen(d.goal.missing.min)} para el mínimo` : d.goal.level === 'min' ? 'mínimo logrado 🟡' : d.goal.level === 'mid' ? 'intermedia lograda 🟢' : '¡la mejor meta lograda! 🏆'}</span></div>
                    <div class="fx-goal"><div class="fx-goal__bar"><i class="fx-goal__fill fx-goal--${d.goal.level}" style="width:${Math.max(2, d.goal.pct)}%"></i>
                        <b class="fx-goal__tick" style="left:${(d.goal.goals.min / d.goal.goals.top) * 100}%"></b><b class="fx-goal__tick" style="left:${(d.goal.goals.mid / d.goal.goals.top) * 100}%"></b></div>
                        <div class="fx-goal__labels"><span>S/ 0</span><span>Mínimo ${pen0(d.goal.goals.min)}</span><span>Intermedia ${pen0(d.goal.goals.mid)}</span><span>La mejor ${pen0(d.goal.goals.top)}+</span></div></div>
                    <p class="muted small" style="margin-top:6px">Faltan ${pen0(d.goal.missing.min)} para el mínimo · ${pen0(d.goal.missing.mid)} para la intermedia · ${pen0(d.goal.missing.top)} para la mejor.</p>`, 'mt16') : ''}
                <div class="fx-pockets">
                    ${card('Banco', 'Tu dinero guardado. Sube con lo que anotas como enviado al banco.', `<div class="kpi__value">${pen(lv.bank.now)}</div><p class="muted small">${lv.bank.newSent ? `Tenías ${pen(bank.pen)} al ${esc(bank.as_of || '—')} + ${pen(lv.bank.newSent)} que enviaste después.` : `Al ${esc(bank.as_of || '—')} · sube cuando anotas lo que envías y con tus intereses de fin de mes`}</p>
                        <div class="fx-saldo"><div class="row between"><span>Enviado al banco en ${monthLabel(d.month)}</span><b class="fx-net">${pen(sentPen)}</b></div>
                        ${(d.transfers || []).map((t) => `<div class="row between small muted" style="margin-top:4px"><span>${esc(t.date)} · ${esc(t.note || 'Envío al banco')}</span><span><b>${pen(t.pen)}</b> <button class="fx-edit" data-del-transfer="${esc(t.id)}" title="Quitar este envío" aria-label="Quitar este envío">✕</button></span></div>`).join('')}
                        <details style="margin-top:8px"><summary class="muted small" style="cursor:pointer">Anotar dinero enviado al banco</summary>
                        <form id="transferForm" class="stack" style="margin-top:10px"><div class="row"><input class="input" name="pen" type="number" step="0.01" min="0.01" placeholder="Soles enviados" required style="flex:1"><input class="input" name="date" type="date" value="${today()}" style="width:auto"></div><input class="input" name="note" placeholder="Nota (opcional)"><button class="btn btn--outline" type="submit">Guardar envío</button></form></details></div>
                        <details style="margin-top:10px"><summary class="muted small" style="cursor:pointer">Actualizar saldo</summary>
                        <form id="bankForm" class="stack" style="margin-top:10px"><div class="row"><input class="input" name="pen" type="number" step="0.01" min="0" placeholder="Saldo en soles" required style="flex:1"><input class="input" name="asOf" type="date" value="${today()}" style="width:auto"></div><button class="btn btn--outline" type="submit">Guardar saldo</button></form></details>`)}
                    ${card('Yape (Binance incluido)', 'Ventas en soles desde el 31 de octubre, ya netas. Abajo, lo que hay hoy.', `<div class="kpi__value">${pen(k.soles.netPen)}</div><div class="stack" style="margin-top:8px;gap:4px">${solesCount ? solesLines : '<p class="muted small">Sin cobros en soles todavía.</p>'}</div>
                        <div class="fx-saldo"><div class="row between"><span>SALDO YAPE <span class="muted small">(lo que hay hoy)</span></span><b>${hasYape ? pen(yapeNow) : '—'}</b></div>
                        <p class="muted small">${!hasYape ? 'Anótalo abajo para compararlo con las ventas.' : `Anotaste ${pen(yp.pen)} el ${esc(yp.as_of || '—')}${lv.yape.newSales || lv.yape.newSpent || lv.yape.newSent ? ` · + ventas nuevas ${pen(lv.yape.newSales)} − gastos ${pen(lv.yape.newSpent)} − enviado al banco ${pen(lv.yape.newSent)}` : ' · todavía no hay movimientos nuevos'}`}</p></div>
                        <details style="margin-top:6px"><summary class="muted small" style="cursor:pointer">Anotar saldo de Yape</summary>
                        <form id="yapeForm" class="stack" style="margin-top:10px"><div class="row"><input class="input" name="pen" type="number" step="0.01" min="0" placeholder="Saldo en soles" required style="flex:1"><input class="input" name="asOf" type="date" value="${today()}" style="width:auto"></div><button class="btn btn--outline" type="submit">Guardar saldo de Yape</button></form></details>`)}
                    ${card('PayPal', `Dólares ya sin comisión · retiro cada ${w.threshold} US$`, `<div class="kpi__value">${usd(pp.balanceUsd)}</div>
                        <div class="bar" style="margin:10px 0 6px"><i style="width:${Math.max(2, Math.round(pp.progress * 100))}%"></i></div>
                        <p class="muted small">${pp.blocks ? `${pp.blocks} ${pp.blocks === 1 ? 'retiro listo' : 'retiros listos'} (−${usd(pp.withdrawCostUsd)} de costo) · ` : ''}faltan <b>${usd(pp.remainingUsd)}</b> para el siguiente retiro de ${w.threshold} US$</p>
                        <p class="small" style="margin-top:6px">Si lo cambias hoy: <b>≈ ${pen(pp.nowPen)}</b> (ya con el −${usd(pp.nowCostUsd)} del retiro y el cambio de ${String(w.rate).replace('.', ',')}). Si esperas a los ${w.threshold} US$ el retiro cuesta menos en porcentaje.</p>
                        <details style="margin-top:8px"><summary class="muted small" style="cursor:pointer">Cambiar el cambio de PayPal (hoy ${String(w.rate).replace('.', ',')})</summary>
                        <form id="rateForm" class="stack" style="margin-top:10px"><input class="input" name="rate" type="number" step="0.0001" min="1" placeholder="Ej. 3.3292" value="${w.rate}" required><button class="btn btn--outline" type="submit">Guardar cambio</button></form></details>`)}
                </div>

                ${card('Simulador de retiro de PayPal', 'Solo para ver cuánto te llegaría. No guarda nada ni cambia tus números.', `
                    <div class="fx-sim">
                        <div class="fx-sim__in">
                            <label class="small muted">Dólares a retirar<input class="input" id="simUsd" type="number" step="0.01" min="0" value="${Math.floor(pp.balanceUsd * 100) / 100}"></label>
                            <label class="small muted">Cambio del día (soles por dólar)<input class="input" id="simRate" type="number" step="0.0001" min="0" value="${w.rate}"></label>
                        </div>
                        <div class="fx-steps" id="simOut"></div>
                    </div>`, 'mt16')}
                <div class="grid grid-2" style="margin-top:16px">
                    ${card('PayPal: de lo que pagaron a tus soles', 'Paso a paso, en dólares, hasta llegar al número de arriba.', `
                        <div class="fx-steps">
                            <div class="row between"><span>Lo que pagaron los clientes (bruto)</span><b>${usd(pp.grossUsd)}</b></div>
                            <div class="row between muted"><span>Comisiones de PayPal</span><b class="fx-fee">−${usd(pp.feeUsd)}</b></div>
                            <div class="row between"><span>Saldo en PayPal</span><b>${usd(pp.balanceUsd)}</b></div>
                            <div class="row between muted"><span>Costo del retiro (hoy)</span><b class="fx-fee">−${usd(pp.nowCostUsd)}</b></div>
                            <div class="row between"><span>Dólares que te llegan</span><b>${usd(Math.max(0, pp.balanceUsd - pp.nowCostUsd))}</b></div>
                            <div class="row between muted"><span>Por el cambio de ${String(w.rate).replace('.', ',')}</span><b></b></div>
                            <div class="row between fx-total"><span>Soles de PayPal si lo cambias hoy</span><b>${pen(pp.nowPen)}</b></div>
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
                        <td>${esc(r.product || 'Sin nombre')} <span class="fx-tag ${KIND_CLASS[r.kind] || ''}">${esc(r.kind)}</span> <button class="fx-edit" data-edit="${esc(r.id)}" data-name="${esc(r.product || '')}" title="Corregir el nombre del producto" aria-label="Corregir el nombre del producto">✎</button><div class="muted small">${esc(r.email || '')}</div></td>
                        <td><span class="fx-tag ${METHOD_CLASS[r.method] || ''}">${esc(d.methods[r.method] || r.method)}</span>${r.method === 'binance' && r.net ? `<div class="muted small">≈ ${(Number(r.net) / (d.settings.binanceRate || 3.46)).toFixed(1)} USDT</div>` : ''}</td>
                        <td>${money(r.gross, r.currency)}</td><td class="${r.fee ? 'fx-fee' : 'muted'}">${r.fee === null || r.fee === undefined ? '—' : `−${money(r.fee, r.currency)}`}</td>
                        <td><b class="fx-net">${r.currency === 'ARS' && r.settled_pen !== null && r.settled_pen !== undefined ? pen(r.settled_pen) : money(r.net, r.currency)}</b></td>
                        <td>${status(r)}</td>
                        <td style="white-space:nowrap">${r.method === 'paypal' && !r.by_willie && !r.verified ? `<button class="btn btn--ghost btn--sm" data-verify="${esc(r.id)}">Verificar</button> ` : ''}</td></tr>`).join('')}</tbody></table></div>`
                        : '<div class="empty"><p>No hay movimientos con ese filtro.</p></div>'}
                    <div class="fx-pager muted small"><span>Mostrando ${slice.length} de ${list.length}</span><span><button class="btn btn--ghost btn--sm" data-pg="-1" ${state.page <= 1 ? 'disabled' : ''}>‹</button> ${state.page} / ${pages} <button class="btn btn--ghost btn--sm" data-pg="1" ${state.page >= pages ? 'disabled' : ''}>›</button></span></div>`);
                $$('#fxMovs [data-f]').forEach((b) => { b.onclick = () => { state[b.dataset.f] = b.dataset.v; state.page = 1; drawMovs(); }; });
                $$('#fxMovs [data-pg]').forEach((b) => { b.onclick = () => { state.page += Number(b.dataset.pg); drawMovs(); }; });
                $$('#fxMovs [data-edit]').forEach((b) => {
                    b.onclick = async () => {
                        const name = window.prompt('¿Qué producto fue? (solo cambia el nombre; los montos no se tocan)', b.dataset.name || '');
                        if (name === null) return;
                        if (!name.trim()) { toast('Escribe un nombre', 'error'); return; }
                        try { await api(`/admin/finance/income/${b.dataset.edit}`, { method: 'PATCH', body: { product: name } }); toast('Producto actualizado'); C.route(); } catch (err) { toast(err.message, 'error'); }
                    };
                });
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
            const drawSim = () => {
                const amt = Math.max(0, Number($('#simUsd').value) || 0); const rate = Number($('#simRate').value) || w.rate;
                const net = Math.max(0, amt - w.fee); const soles = net * rate; const pct = amt > 0 ? (w.fee / amt) * 100 : 0;
                const extra = Number(yp.pen) || 0;
                $('#simOut').innerHTML = `
                    <div class="row between"><span>Dólares que retiras</span><b>${usd(amt)}</b></div>
                    <div class="row between muted"><span>Costo del retiro</span><b class="fx-fee">−${usd(amt ? w.fee : 0)}</b></div>
                    <div class="row between"><span>Dólares que te llegan</span><b>${usd(net)}</b></div>
                    <div class="row between muted"><span>Por el cambio de ${String(rate).replace('.', ',')}</span><b></b></div>
                    <div class="row between fx-total"><span>Soles que llegarían</span><b>${pen(soles)}</b></div>
                    <p class="muted small">El retiro te cuesta <b>${pct.toFixed(1).replace('.', ',')}%</b> de este monto${amt < w.threshold ? ` (a los ${w.threshold} US$ baja a ${((w.fee / w.threshold) * 100).toFixed(1).replace('.', ',')}%)` : ''}.${extra ? ` Con tu saldo de Yape (${pen(extra)}) tendrías <b>${pen(extra + soles)}</b>.` : ''}</p>`;
            };
            $('#simUsd').oninput = drawSim; $('#simRate').oninput = drawSim; drawSim();

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
            $('#yapeForm').onsubmit = async (e) => {
                e.preventDefault(); const f = new FormData(e.target);
                try { await api('/admin/finance/yape', { method: 'PUT', body: { pen: f.get('pen'), asOf: f.get('asOf') } }); toast('Saldo de Yape guardado'); C.route(); } catch (err) { toast(err.message, 'error'); }
            };
            $('#rateForm').onsubmit = async (e) => {
                e.preventDefault(); const f = new FormData(e.target);
                try { await api('/admin/finance/withdraw-rate', { method: 'PUT', body: { rate: f.get('rate') } }); toast('Cambio guardado'); C.route(); } catch (err) { toast(err.message, 'error'); }
            };
            $('#transferForm').onsubmit = async (e) => {
                e.preventDefault(); const f = new FormData(e.target);
                try { await api('/admin/finance/bank-transfers', { method: 'POST', body: { pen: f.get('pen'), date: f.get('date'), note: f.get('note') } }); toast('Envío al banco anotado'); C.route(); } catch (err) { toast(err.message, 'error'); }
            };
            $$('[data-del-transfer]').forEach((b) => { b.onclick = async () => { if (!confirm('¿Quitar este envío al banco? (no cambia el saldo del banco)')) return; try { await api(`/admin/finance/bank-transfers/${b.dataset.delTransfer}`, { method: 'DELETE' }); toast('Envío quitado'); C.route(); } catch (err) { toast(err.message, 'error'); } }; });
            $('#expForm').onsubmit = async (e) => {
                e.preventDefault(); const f = new FormData(e.target);
                try { await api('/admin/finance/expenses', { method: 'POST', body: { category: f.get('category'), amountPen: f.get('amountPen'), spentAt: f.get('spentAt'), note: f.get('note'), ref: f.get('ref') } }); toast('Gasto guardado'); C.route(); } catch (err) { toast(err.message, 'error'); }
            };
            $$('[data-del-expense]').forEach((b) => { b.onclick = async () => { if (!confirm('¿Quitar este gasto?')) return; try { await api(`/admin/finance/expenses/${b.dataset.delExpense}`, { method: 'DELETE' }); toast('Gasto quitado'); C.route(); } catch (err) { toast(err.message, 'error'); } }; });
            $('#expCat').onchange = (e) => { $('#expNote').required = e.target.value === 'SUSCRIPCIÓN IMPORTANTE'; };
        }
    };
})();
