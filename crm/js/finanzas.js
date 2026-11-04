/* CRM · Dinero: seis pantallas separadas (Resumen, Ventas, Metas, Banco y Yape, PayPal, Gastos), cada una con una sola tarea. Los datos vienen de un solo lugar: /admin/finance. */
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
    const rate1 = (n) => String(n).replace('.', ',');
    const PAGE = 10;

    const KIND_CLASS = { Servicio: 'fx-tag--svc', Plugin: 'fx-tag--plg', Payhip: 'fx-tag--pay', 'Por revisar': 'fx-tag--warn', Otro: '' };
    const METHOD_CLASS = { paypal: 'fx-tag--pp', yape: 'fx-tag--yp', binance: 'fx-tag--bn', mp_argentina: 'fx-tag--ar', mercadopago: 'fx-tag--ar' };
    const METHOD_COLOR = { paypal: 'hsl(221 83% 53%)', yape: 'hsl(270 70% 55%)', binance: 'hsl(45 95% 50%)', mp_argentina: 'hsl(190 80% 40%)', mercadopago: 'hsl(190 80% 40%)' };
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

    const guide = (open) => `<details class="card fx-guide" ${open ? 'open' : ''}><summary><b>Cómo leer los colores</b></summary>
        <div class="fx-keys">
            <span class="fx-key"><i class="fx-dot fx-dot--green"></i><b>Verde</b> = dinero que te queda (neto)</span>
            <span class="fx-key"><i class="fx-dot fx-dot--red"></i><b>Rojo</b> = lo que se pierde (comisión, retiro)</span>
            <span class="fx-key"><i class="fx-dot fx-dot--pp"></i><b>Azul</b> = PayPal (dólares)</span>
            <span class="fx-key"><i class="fx-dot fx-dot--yp"></i><b>Morado</b> = Yape (soles)</span>
            <span class="fx-key"><i class="fx-dot fx-dot--bn"></i><b>Amarillo</b> = Binance (llega a Yape)</span>
            <span class="fx-key"><i class="fx-dot fx-dot--warn"></i><b>Naranja</b> = por revisar</span>
            <span class="fx-key"><i class="fx-dot fx-dot--gray"></i><b>Gris</b> = dato de control, no suma</span>
        </div></details>`;

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

    // Gráfico de barras: ventas de cada día del mes (soles netos aproximados)
    const barsByDay = (month, days) => {
        const [y, m] = month.split('-').map(Number);
        const total = new Date(y, m, 0).getDate();
        const map = new Map(days.map((x) => [x.date, x]));
        const max = Math.max(1, ...days.map((x) => x.pen));
        const W = 600; const H = 170; const pad = 22; const bw = (W - pad) / total;
        let out = '';
        for (let d = 1; d <= total; d += 1) {
            const x = map.get(`${month}-${String(d).padStart(2, '0')}`);
            const h = x ? Math.max(3, ((H - 30) * x.pen) / max) : 0;
            const bx = pad + (d - 1) * bw;
            out += `<g><title>${d} de ${MONTHS[m - 1]}: ${x ? `${pen0(x.pen)} · ${x.count} ${x.count === 1 ? 'pago' : 'pagos'}` : 'sin ingresos'}</title><rect x="${bx + 1}" y="${H - 18 - h}" width="${Math.max(2, bw - 3)}" height="${x ? h : 2}" rx="3" class="${x ? 'fx-bar' : 'fx-bar fx-bar--empty'}"/></g>`;
            if (d === 1 || d % 5 === 0) out += `<text x="${bx + bw / 2}" y="${H - 4}" text-anchor="middle" class="fx-axis">${d}</text>`;
        }
        return `<svg class="fx-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ventas por día del mes">${out}</svg><p class="muted small">Cada barra es un día. Más alta = vendiste más ese día.</p>`;
    };

    // Gráfico de línea: ventas acumuladas del mes contra las tres metas
    const goalLine = (month, days, goals, rate) => {
        const [y, m] = month.split('-').map(Number);
        const total = new Date(y, m, 0).getDate();
        const map = new Map(days.map((x) => [x.date, x.pen]));
        const W = 600; const H = 220; const padL = 46; const padB = 22; const top = Math.max(goals.top * 1.05, 1);
        const X = (d) => padL + ((W - padL - 8) * (d - 1)) / Math.max(1, total - 1);
        const Y = (v) => H - padB - ((H - padB - 10) * v) / top;
        let acc = 0; const pts = [];
        const nowDay = month === nowMonth() ? Number(today().slice(8, 10)) : total;
        for (let d = 1; d <= nowDay; d += 1) { acc += map.get(`${month}-${String(d).padStart(2, '0')}`) || 0; pts.push(`${X(d).toFixed(1)},${Y(acc).toFixed(1)}`); }
        const lines = [['min', goals.min, 'Mínimo', 'hsl(45 95% 45%)'], ['mid', goals.mid, 'Intermedia', 'hsl(142 71% 35%)'], ['top', goals.top, 'La mejor', 'hsl(32 95% 44%)']]
            .map(([, v, label, col]) => `<line x1="${padL}" x2="${W - 8}" y1="${Y(v)}" y2="${Y(v)}" stroke="${col}" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${padL - 6}" y="${Y(v) + 4}" text-anchor="end" class="fx-axis">${Math.round(v / 100) / 10}k</text><text x="${W - 10}" y="${Y(v) - 5}" text-anchor="end" class="fx-axis" style="fill:${col}">${label}</text>`).join('');
        const xs = [1, 8, 15, 22, total].map((d) => `<text x="${X(d)}" y="${H - 4}" text-anchor="middle" class="fx-axis">${d}</text>`).join('');
        return `<svg class="fx-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ventas acumuladas contra las metas">${lines}${xs}<polyline points="${pts.join(' ')}" fill="none" stroke="hsl(var(--success))" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${pts.length ? `<circle cx="${pts[pts.length - 1].split(',')[0]}" cy="${pts[pts.length - 1].split(',')[1]}" r="5" fill="hsl(var(--success))"/>` : ''}</svg><p class="muted small">La línea verde son tus ventas acumuladas del mes. Las rayas son tus tres metas.</p>`;
    };

    // De dónde vienen las ventas del mes (soles aproximados): una barra partida por método
    const origin = (d, rate) => {
        const sums = {};
        for (const r of d.income) {
            if (r.status !== 'confirmed') continue;
            let v = null;
            if (r.currency === 'PEN') v = Number(r.net); else if (r.currency === 'ARS') v = Number(r.settled_pen); else if (r.currency === 'USD') v = Number(r.net) * rate;
            if (v === null || !Number.isFinite(v)) continue;
            sums[r.method] = (sums[r.method] || 0) + v;
        }
        const list = Object.entries(sums).sort((a, b) => b[1] - a[1]);
        const total = list.reduce((a, [, v]) => a + v, 0) || 1;
        if (!list.length) return '<div class="empty"><p>Todavía no hay ventas este mes.</p></div>';
        return `<div class="fx-stack">${list.map(([m, v]) => `<i style="width:${(v / total) * 100}%;background:${METHOD_COLOR[m] || 'hsl(var(--muted-foreground))'}" title="${esc(d.methods[m] || m)}: ${pen0(v)}"></i>`).join('')}</div>
            <div class="stack" style="margin-top:10px;gap:6px">${list.map(([m, v]) => `<div class="row between"><span><i class="fx-dot" style="background:${METHOD_COLOR[m] || 'hsl(var(--muted-foreground))'}"></i> ${esc(d.methods[m] || m)}</span><span><b>${pen0(v)}</b> <span class="muted small">${Math.round((v / total) * 100)}%</span></span></div>`).join('')}</div>`;
    };

    // ─── Carga única y números compartidos ──────────────────────────────────────────────────────────────────────
    async function load(view, token, title, desc) {
        const month = C.state.finMonth || nowMonth();
        view.innerHTML = `${head(title, 'Cargando…')}<div class="skeleton" style="height:260px"></div>`;
        let d;
        try { d = await api(`/admin/finance?month=${month}`); } catch (e) { view.innerHTML = head(title) + `<div class="alert alert--error">${icon('alert')}<div>${esc(e.message)}</div></div>`; return null; }
        if (token !== C.state.routeToken) return null;
        const s = d.summary; const k = d.pockets; const w = d.settings.withdraw; const pp = k.paypal; const bank = d.settings.bank; const yp = d.settings.yape || {};
        const hasYape = yp.pen !== null && yp.pen !== undefined;
        const lv = d.live || { yape: { now: hasYape ? Number(yp.pen) : null, base: yp.pen, newSales: 0, newSpent: 0, newSent: 0 }, bank: { now: bank.pen, base: bank.pen, newSent: 0 } };
        const yapeNow = hasYape ? lv.yape.now : null;
        const available = hasYape ? yapeNow + pp.nowPen : 0;
        const sentPen = Number(d.transfersPen) || 0;
        const x = { d, month, s, k, w, pp, bank, yp, hasYape, lv, yapeNow, available, sentPen, monthTotal: available + sentPen };
        x.alerts = [
            s.pendingArs.count ? `<div class="alert alert--warning">${icon('alert')}<div><b>${s.pendingArs.count} ${s.pendingArs.count === 1 ? 'pago' : 'pagos'} en pesos argentinos</b> (${ars(s.pendingArs.pesos)}) por confirmar. Todavía no suman. <a href="#/finanzas-ventas">Ir a Ventas</a></div></div>` : '',
            s.noDetail.count ? `<div class="alert alert--warning">${icon('alert')}<div><b>${s.noDetail.count} ${s.noDetail.count === 1 ? 'despacho' : 'despachos'} sin dato de pago.</b> Revísalos en <a href="#/finanzas-ventas">Ventas</a>.</div></div>` : ''
        ].join('');
        x.head = head(title, desc, `<input class="input" type="month" id="finMonth" value="${month}" min="${d.settings.startAt.slice(0, 7)}" style="width:auto" aria-label="Mes">`);
        return x;
    }

    // Formularios y botones de cada pantalla: se conectan solo si existen en esa pantalla
    function bind(x) {
        const { d, w, yp } = x;
        const on = (sel, fn) => { const el = $(sel); if (el) el.onsubmit = fn; };
        const submit = (path, method, body, ok) => async (e) => { e.preventDefault(); const f = new FormData(e.target); try { await api(path, { method, body: body(f) }); toast(ok); C.route(); } catch (err) { toast(err.message, 'error'); } };
        const fm = $('#finMonth'); if (fm) fm.onchange = (e) => { C.state.finMonth = e.target.value || nowMonth(); state.page = 1; C.route(); };
        $$('[data-go]').forEach((b) => { b.onclick = () => C.go(b.dataset.go); });
        on('#arsForm', async (e) => {
            e.preventDefault(); const f = new FormData(e.target); const ids = f.getAll('ids');
            if (!ids.length) { toast('Marca al menos un pago', 'error'); return; }
            try { const r = await api('/admin/finance/settle-ars', { method: 'POST', body: { ids, label: f.get('label'), pen: f.get('pen'), ref: f.get('ref') } }); toast(r.duplicate ? 'Ese depósito ya estaba aplicado' : `${r.settled} confirmados con ${pen(r.pen)}`); C.route(); } catch (err) { toast(err.message, 'error'); }
        });
        on('#bankForm', submit('/admin/finance/bank', 'PUT', (f) => ({ pen: f.get('pen'), asOf: f.get('asOf') }), 'Saldo actualizado'));
        on('#yapeForm', submit('/admin/finance/yape', 'PUT', (f) => ({ pen: f.get('pen'), asOf: f.get('asOf') }), 'Saldo de Yape guardado'));
        on('#rateForm', submit('/admin/finance/withdraw-rate', 'PUT', (f) => ({ rate: f.get('rate') }), 'Cambio guardado'));
        on('#transferForm', submit('/admin/finance/bank-transfers', 'POST', (f) => ({ pen: f.get('pen'), date: f.get('date'), note: f.get('note') }), 'Envío al banco anotado'));
        on('#expForm', submit('/admin/finance/expenses', 'POST', (f) => ({ category: f.get('category'), amountPen: f.get('amountPen'), spentAt: f.get('spentAt'), note: f.get('note'), ref: f.get('ref') }), 'Gasto guardado'));
        $$('[data-del-transfer]').forEach((b) => { b.onclick = async () => { if (!confirm('¿Quitar este envío al banco? (no cambia el saldo del banco)')) return; try { await api(`/admin/finance/bank-transfers/${b.dataset.delTransfer}`, { method: 'DELETE' }); toast('Envío quitado'); C.route(); } catch (err) { toast(err.message, 'error'); } }; });
        $$('[data-del-expense]').forEach((b) => { b.onclick = async () => { if (!confirm('¿Quitar este gasto?')) return; try { await api(`/admin/finance/expenses/${b.dataset.delExpense}`, { method: 'DELETE' }); toast('Gasto quitado'); C.route(); } catch (err) { toast(err.message, 'error'); } }; });
        const cat = $('#expCat'); if (cat) cat.onchange = (e) => { $('#expNote').required = e.target.value === 'SUSCRIPCIÓN IMPORTANTE'; };
        const su = $('#simUsd');
        if (su) {
            const drawSim = () => {
                const amt = Math.max(0, Number($('#simUsd').value) || 0); const rate = Number($('#simRate').value) || w.rate;
                const net = Math.max(0, amt - w.fee); const soles = net * rate; const pct = amt > 0 ? (w.fee / amt) * 100 : 0;
                const extra = Number(yp.pen) || 0;
                $('#simOut').innerHTML = `
                    <div class="row between"><span>Dólares que retiras</span><b>${usd(amt)}</b></div>
                    <div class="row between muted"><span>Costo del retiro</span><b class="fx-fee">−${usd(amt ? w.fee : 0)}</b></div>
                    <div class="row between"><span>Dólares que te llegan</span><b>${usd(net)}</b></div>
                    <div class="row between muted"><span>Por el cambio de ${rate1(rate)}</span><b></b></div>
                    <div class="row between fx-total"><span>Soles que llegarían</span><b>${pen(soles)}</b></div>
                    <p class="muted small">El retiro te cuesta <b>${rate1(pct.toFixed(1))}%</b> de este monto${amt < w.threshold ? ` (a los ${w.threshold} US$ baja a ${rate1(((w.fee / w.threshold) * 100).toFixed(1))}%)` : ''}.${extra ? ` Con tu saldo de Yape (${pen(extra)}) tendrías <b>${pen(extra + soles)}</b>.` : ''}</p>`;
            };
            su.oninput = drawSim; $('#simRate').oninput = drawSim; drawSim();
        }
        if ($('#fxMovs')) drawMovs(d);
    }

    // Movimientos: tabla con filtros y páginas
    function drawMovs(d) {
        const methods = [...new Set(d.income.map((r) => r.method))];
        const kinds = [...new Set(d.income.map((r) => r.kind))];
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
        $$('#fxMovs [data-f]').forEach((b) => { b.onclick = () => { state[b.dataset.f] = b.dataset.v; state.page = 1; drawMovs(d); }; });
        $$('#fxMovs [data-pg]').forEach((b) => { b.onclick = () => { state.page += Number(b.dataset.pg); drawMovs(d); }; });
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
    }

    // Trozos que se repiten entre pantallas
    const goalBar = (g) => `<div class="fx-goal"><div class="fx-goal__bar"><i class="fx-goal__fill fx-goal--${g.level}" style="width:${Math.max(2, g.pct)}%"></i>
        <b class="fx-goal__tick" style="left:${(g.goals.min / g.goals.top) * 100}%"></b><b class="fx-goal__tick" style="left:${(g.goals.mid / g.goals.top) * 100}%"></b></div>
        <div class="fx-goal__labels"><span>S/ 0</span><span>Mínimo ${pen0(g.goals.min)}</span><span>Intermedia ${pen0(g.goals.mid)}</span><span>La mejor ${pen0(g.goals.top)}+</span></div></div>`;
    const goalText = (g) => (g.level === 'none' ? `faltan ${pen(g.missing.min)} para el mínimo` : g.level === 'min' ? 'mínimo logrado 🟡' : g.level === 'mid' ? 'intermedia lograda 🟢' : '¡la mejor meta lograda! 🏆');

    // ─── 1. Resumen ────────────────────────────────────────────────────────────────────────────────────────────
    C.pages.finanzas = {
        async render(view, token) {
            const x = await load(view, token, 'Dinero · Resumen', 'Lo importante de un vistazo. Cada tarjeta lleva a su pantalla.');
            if (!x) return;
            const { d, w, pp, bank, hasYape, lv, yapeNow, available, sentPen, monthTotal, s } = x;
            view.innerHTML = `${x.head}${x.alerts}
                <div class="kpis">
                    ${hasYape
                        ? `<div class="card kpi fx-hero"><div class="kpi__top"><span>💰 Dinero para depositar</span>${icon('bag')}</div><div class="kpi__value">${pen(available)}</div><div class="kpi__foot">Yape ${pen(yapeNow)} (Binance incluido) + PayPal cambiado a soles ${pen(pp.nowPen)} (ya con el −${usd(pp.nowCostUsd)} del retiro). Los gastos y lo enviado al banco ya están descontados.</div></div>
                           <div class="card kpi"><div class="kpi__top"><span>Dinero del mes total</span>${icon('trend')}</div><div class="kpi__value">${pen(monthTotal)}</div><div class="kpi__foot">${pen(available)} para depositar + ${pen(sentPen)} que ya enviaste al banco este mes.</div></div>`
                        : `<div class="card kpi fx-hero"><div class="kpi__top"><span>PayPal si retiras hoy</span>${icon('bag')}</div><div class="kpi__value">${pen(pp.nowPen)}</div><div class="kpi__foot">Anota tu saldo de Yape en "Banco y Yape" para ver el total.</div></div>`}
                </div>
                <h2 class="fx-sec">¿Dónde está tu dinero?</h2>
                <div class="fx-pockets">
                    <button class="card fx-tile" data-go="finanzas-banco"><span class="fx-tile__top"><i class="fx-dot fx-dot--gray"></i> Banco</span><span class="kpi__value">${pen(lv.bank.now)}</span><span class="muted small">Tu dinero guardado · ver detalle ›</span></button>
                    <button class="card fx-tile" data-go="finanzas-banco"><span class="fx-tile__top"><i class="fx-dot fx-dot--yp"></i> Yape (Binance incluido)</span><span class="kpi__value">${hasYape ? pen(yapeNow) : '—'}</span><span class="muted small">Lo que hay hoy · ver detalle ›</span></button>
                    <button class="card fx-tile" data-go="finanzas-paypal"><span class="fx-tile__top"><i class="fx-dot fx-dot--pp"></i> PayPal</span><span class="kpi__value">${usd(pp.balanceUsd)}</span><span class="muted small">≈ ${pen(pp.nowPen)} si lo cambias hoy · ver detalle ›</span></button>
                </div>
                ${d.goal ? `<button class="card fx-tile fx-tile--wide" data-go="finanzas-metas" style="margin-top:16px"><span class="fx-tile__top">🎯 Meta del mes</span><span class="row between" style="align-items:baseline;flex-wrap:wrap;width:100%"><span class="kpi__value">${pen(d.goal.salesNetPen)}</span><span class="muted small">${goalText(d.goal)}</span></span>${goalBar(d.goal)}<span class="muted small">Ver metas ›</span></button>` : ''}
                <div class="grid grid-2" style="margin-top:16px">
                    ${card('Ventas por día', `${monthLabel(d.month)} · soles netos aproximados`, barsByDay(d.month, d.byDay))}
                    ${card('De dónde vienen las ventas', `${monthLabel(d.month)} · en soles`, origin(d, w.rate))}
                </div>
                <div class="grid grid-2" style="margin-top:16px">
                    <button class="card fx-tile" data-go="finanzas-ventas"><span class="fx-tile__top">Ventas del mes</span><span class="kpi__value">${num(s.income.count)}</span><span class="muted small">${num(s.income.count) === 1 ? 'venta' : 'ventas'} registradas · ver todas ›</span></button>
                    <button class="card fx-tile" data-go="finanzas-gastos"><span class="fx-tile__top">Gastos del mes</span><span class="kpi__value fx-neg">${pen(s.expenses.totalPen)}</span><span class="muted small">ya descontado en tu Yape · ver gastos ›</span></button>
                </div>
                ${guide(false)}`;
            bind(x);
        }
    };

    // ─── 2. Ventas y movimientos ───────────────────────────────────────────────────────────────────────────────
    C.pages['finanzas-ventas'] = {
        async render(view, token) {
            const x = await load(view, token, 'Dinero · Ventas', 'Cada venta real: bruto (lo que pagó el cliente), comisión y neto (lo que te queda).');
            if (!x) return;
            const { d } = x;
            view.innerHTML = `${x.head}${x.alerts}
                <div id="fxMovs"></div>
                <div class="grid grid-2" style="margin-top:16px">
                    ${card('Ventas por día', `${monthLabel(d.month)} · más verde = más ingresos`, heat(d.month, d.byDay))}
                    ${card('De dónde vienen', `${monthLabel(d.month)} · en soles`, origin(d, x.w.rate))}
                </div>
                ${d.pendingArs.length ? card('Pesos argentinos por confirmar', 'Cuando llegan los soles se reparten entre estos pagos. El depósito no se anota como venta nueva.', `<form id="arsForm" class="stack">
                    <div class="table-wrap"><table><thead><tr><th></th><th>Cuándo</th><th>Correo</th><th>Producto</th><th>Pesos</th></tr></thead><tbody>${d.pendingArs.map((r) => `<tr><td><input type="checkbox" name="ids" value="${esc(r.id)}" checked></td><td class="muted">${esc(when(r.occurred_at))}</td><td>${esc(r.email || '—')}</td><td>${esc(r.product || 'Sin nombre')}</td><td><b>${ars(r.gross)}</b></td></tr>`).join('')}</tbody></table></div>
                    <div class="row" style="flex-wrap:wrap"><input class="input" name="label" value="Depósito de Sayko" style="flex:1;min-width:180px"><input class="input" name="pen" type="number" step="0.01" min="0.01" placeholder="Soles que llegaron" required style="width:170px"><input class="input" name="ref" placeholder="N° de operación (Yape)" style="width:190px"></div>
                    <button class="btn btn--brand" type="submit">Confirmar con este depósito</button></form>`, 'mt16') : ''}
                ${guide(false)}`;
            bind(x);
        }
    };

    // ─── 3. Metas ──────────────────────────────────────────────────────────────────────────────────────────────
    C.pages['finanzas-metas'] = {
        async render(view, token) {
            const x = await load(view, token, 'Dinero · Metas', 'Qué tan cerca estás de tu meta del mes. Se mide con tus ventas netas (ya sin comisiones).');
            if (!x) return;
            const { d, w } = x; const g = d.goal;
            view.innerHTML = `${x.head}
                ${card('🎯 Tu meta de ' + monthLabel(d.month), 'Mínimo ≈ US$ 1.000 · intermedia · la mejor.', `
                    <div class="row between" style="align-items:baseline;flex-wrap:wrap"><span class="kpi__value">${pen(g.salesNetPen)}</span><span class="muted small">${goalText(g)}</span></div>
                    ${goalBar(g)}
                    <div class="fx-levels">
                        <div class="fx-level ${g.level !== 'none' ? 'is-done' : ''}"><b>Mínimo</b><span>${pen0(g.goals.min)}</span><small>${g.missing.min ? `faltan ${pen0(g.missing.min)}` : 'logrado ✓'}</small></div>
                        <div class="fx-level ${g.level === 'mid' || g.level === 'top' ? 'is-done' : ''}"><b>Intermedia</b><span>${pen0(g.goals.mid)}</span><small>${g.missing.mid ? `faltan ${pen0(g.missing.mid)}` : 'logrado ✓'}</small></div>
                        <div class="fx-level ${g.level === 'top' ? 'is-done' : ''}"><b>La mejor</b><span>${pen0(g.goals.top)}+</span><small>${g.missing.top ? `faltan ${pen0(g.missing.top)}` : 'logrado ✓'}</small></div>
                    </div>`)}
                ${card('Cómo vas día a día', `${monthLabel(d.month)} · ventas acumuladas contra tus metas`, goalLine(d.month, d.byDay, g.goals, w.rate), 'mt16')}`;
            bind(x);
        }
    };

    // ─── 4. Banco y Yape ───────────────────────────────────────────────────────────────────────────────────────
    C.pages['finanzas-banco'] = {
        async render(view, token) {
            const x = await load(view, token, 'Dinero · Banco y Yape', 'Dónde está tu dinero en soles y cuánto has enviado al banco.');
            if (!x) return;
            const { d, k, bank, yp, hasYape, lv, yapeNow, sentPen } = x;
            const solesCount = Object.keys(k.soles.byMethod).length;
            const solesLines = Object.entries(k.soles.byMethod).map(([m, v]) => `<div class="row between"><span>${esc(d.methods[m] || m)}</span><b>${pen(v)}</b></div>`).join('');
            view.innerHTML = `${x.head}
                <div class="grid grid-2">
                    ${card('🏦 Banco', 'Tu dinero guardado. Sube con lo que anotas como enviado al banco.', `<div class="kpi__value">${pen(lv.bank.now)}</div><p class="muted small">${lv.bank.newSent ? `Tenías ${pen(bank.pen)} al ${esc(bank.as_of || '—')} + ${pen(lv.bank.newSent)} que enviaste después.` : `Al ${esc(bank.as_of || '—')} · sube cuando anotas lo que envías y con tus intereses de fin de mes`}</p>
                        <details style="margin-top:10px"><summary class="muted small" style="cursor:pointer">Actualizar saldo del banco</summary>
                        <form id="bankForm" class="stack" style="margin-top:10px"><div class="row"><input class="input" name="pen" type="number" step="0.01" min="0" placeholder="Saldo en soles" required style="flex:1"><input class="input" name="asOf" type="date" value="${today()}" style="width:auto"></div><button class="btn btn--outline" type="submit">Guardar saldo</button></form></details>`)}
                    ${card('<i class="fx-dot fx-dot--yp"></i> Yape (Binance incluido)', 'Lo que hay hoy en tu Yape.', `<div class="kpi__value">${hasYape ? pen(yapeNow) : '—'}</div>
                        <p class="muted small">${!hasYape ? 'Anótalo abajo para ver tu Yape.' : `Anotaste ${pen(yp.pen)} el ${esc(yp.as_of || '—')}${lv.yape.newSales || lv.yape.newSpent || lv.yape.newSent ? ` · + ventas nuevas ${pen(lv.yape.newSales)} − gastos ${pen(lv.yape.newSpent)} − enviado al banco ${pen(lv.yape.newSent)}` : ' · todavía no hay movimientos nuevos'}`}</p>
                        <div class="stack" style="margin-top:8px;gap:4px"><span class="muted small">Ventas en soles desde el 31 de octubre:</span>${solesCount ? solesLines : '<p class="muted small">Sin cobros en soles todavía.</p>'}</div>
                        <details style="margin-top:10px"><summary class="muted small" style="cursor:pointer">Anotar saldo de Yape</summary>
                        <form id="yapeForm" class="stack" style="margin-top:10px"><div class="row"><input class="input" name="pen" type="number" step="0.01" min="0" placeholder="Saldo en soles" required style="flex:1"><input class="input" name="asOf" type="date" value="${today()}" style="width:auto"></div><button class="btn btn--outline" type="submit">Guardar saldo de Yape</button></form></details>`)}
                </div>
                ${card('Dinero enviado al banco', `${monthLabel(d.month)} · de Yape o PayPal al banco. No es gasto.`, `<div class="row between" style="align-items:baseline"><span class="kpi__value fx-net">${pen(sentPen)}</span><span class="muted small">este mes</span></div>
                    ${(d.transfers || []).map((t) => `<div class="row between small muted" style="margin-top:6px"><span>${esc(t.date)} · ${esc(t.note || 'Envío al banco')}</span><span><b>${pen(t.pen)}</b> <button class="fx-edit" data-del-transfer="${esc(t.id)}" title="Quitar este envío" aria-label="Quitar este envío">✕</button></span></div>`).join('') || '<p class="muted small">Todavía no anotaste envíos este mes.</p>'}
                    <form id="transferForm" class="stack" style="margin-top:14px"><div class="row"><input class="input" name="pen" type="number" step="0.01" min="0.01" placeholder="Soles enviados al banco" required style="flex:1"><input class="input" name="date" type="date" value="${today()}" style="width:auto"></div><input class="input" name="note" placeholder="Nota (opcional)"><button class="btn btn--brand" type="submit">${icon('plus')} Anotar envío</button></form>`, 'mt16')}`;
            bind(x);
        }
    };

    // ─── 5. PayPal ─────────────────────────────────────────────────────────────────────────────────────────────
    C.pages['finanzas-paypal'] = {
        async render(view, token) {
            const x = await load(view, token, 'Dinero · PayPal', 'Tus dólares, el costo de retirarlos y cuántos soles te llegarían.');
            if (!x) return;
            const { w, pp } = x;
            view.innerHTML = `${x.head}
                <div class="grid grid-2">
                    ${card('<i class="fx-dot fx-dot--pp"></i> Saldo de PayPal', `Dólares ya sin comisión · retiro cada ${w.threshold} US$`, `<div class="kpi__value">${usd(pp.balanceUsd)}</div>
                        <div class="bar" style="margin:10px 0 6px"><i style="width:${Math.max(2, Math.round(pp.progress * 100))}%"></i></div>
                        <p class="muted small">${pp.blocks ? `${pp.blocks} ${pp.blocks === 1 ? 'retiro listo' : 'retiros listos'} (−${usd(pp.withdrawCostUsd)} de costo) · ` : ''}faltan <b>${usd(pp.remainingUsd)}</b> para el siguiente retiro de ${w.threshold} US$</p>
                        <p class="small" style="margin-top:6px">Si lo cambias hoy: <b>≈ ${pen(pp.nowPen)}</b> (ya con el −${usd(pp.nowCostUsd)} del retiro y el cambio de ${rate1(w.rate)}). Si esperas a los ${w.threshold} US$ el retiro cuesta menos en porcentaje.</p>
                        <details style="margin-top:8px"><summary class="muted small" style="cursor:pointer">Cambiar el cambio de PayPal (hoy ${rate1(w.rate)})</summary>
                        <form id="rateForm" class="stack" style="margin-top:10px"><input class="input" name="rate" type="number" step="0.0001" min="1" placeholder="Ej. 3.3292" value="${w.rate}" required><button class="btn btn--outline" type="submit">Guardar cambio</button></form></details>`)}
                    ${card('De lo que pagaron a tus soles', 'Paso a paso, en dólares.', `
                        <div class="fx-steps">
                            <div class="row between"><span>Lo que pagaron los clientes (bruto)</span><b>${usd(pp.grossUsd)}</b></div>
                            <div class="row between muted"><span>Comisiones de PayPal</span><b class="fx-fee">−${usd(pp.feeUsd)}</b></div>
                            <div class="row between"><span>Saldo en PayPal</span><b>${usd(pp.balanceUsd)}</b></div>
                            <div class="row between muted"><span>Costo del retiro (hoy)</span><b class="fx-fee">−${usd(pp.nowCostUsd)}</b></div>
                            <div class="row between"><span>Dólares que te llegan</span><b>${usd(Math.max(0, pp.balanceUsd - pp.nowCostUsd))}</b></div>
                            <div class="row between muted"><span>Por el cambio de ${rate1(w.rate)}</span><b></b></div>
                            <div class="row between fx-total"><span>Soles si lo cambias hoy</span><b>${pen(pp.nowPen)}</b></div>
                        </div>`)}
                </div>
                ${card('Simulador de retiro', 'Solo para ver cuánto te llegaría. No guarda nada ni cambia tus números.', `
                    <div class="fx-sim">
                        <div class="fx-sim__in">
                            <label class="small muted">Dólares a retirar<input class="input" id="simUsd" type="number" step="0.01" min="0" value="${Math.floor(pp.balanceUsd * 100) / 100}"></label>
                            <label class="small muted">Cambio del día (soles por dólar)<input class="input" id="simRate" type="number" step="0.0001" min="0" value="${w.rate}"></label>
                        </div>
                        <div class="fx-steps" id="simOut"></div>
                    </div>`, 'mt16')}`;
            bind(x);
        }
    };

    // ─── 6. Gastos ─────────────────────────────────────────────────────────────────────────────────────────────
    C.pages['finanzas-gastos'] = {
        async render(view, token) {
            const x = await load(view, token, 'Dinero · Gastos', 'Siempre en soles. Los gastos ya salieron de tu Yape: aquí solo se llevan anotados.');
            if (!x) return;
            const { d, s } = x;
            view.innerHTML = `${x.head}
                <div class="kpis"><div class="card kpi"><div class="kpi__top"><span>Gastos de ${monthLabel(d.month)}</span>${icon('cart')}</div><div class="kpi__value fx-neg">${pen(s.expenses.totalPen)}</div><div class="kpi__foot">${s.expenses.totalPen ? s.expenses.byCategory.filter((c) => c.count).map((c) => `${c.category.toLowerCase()} ${pen(c.totalPen)}`).join(' · ') : 'Sin gastos este mes'}</div></div></div>
                <div class="grid grid-2" style="margin-top:16px">
                    ${card('Registrar un gasto', 'Gaseosa, comida rápida o suscripción importante.', `<form id="expForm" class="stack">
                        <select class="select" name="category" id="expCat">${d.categories.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
                        <div class="row"><input class="input" name="amountPen" type="number" step="0.01" min="0.01" placeholder="Monto en soles" required style="flex:1"><input class="input" name="spentAt" type="date" value="${today()}" style="width:auto"></div>
                        <input class="input" name="note" id="expNote" placeholder="Nota (en suscripción importante: cuál es)">
                        <input class="input" name="ref" placeholder="N° de operación (opcional, evita duplicados)">
                        <button class="btn btn--brand" type="submit">${icon('plus')} Guardar gasto</button></form>`)}
                    ${card('Lista de gastos', `${d.expenses.length} en ${monthLabel(d.month)}`, d.expenses.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Categoría</th><th>Monto</th><th></th></tr></thead><tbody>${d.expenses.map((e) => `<tr><td class="muted">${esc(e.spent_at)}</td><td>${esc(e.category)}</td><td><b>${pen(e.amount_pen)}</b></td><td><button class="btn btn--ghost btn--sm" data-del-expense="${esc(e.id)}">Quitar</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><p>Sin gastos este mes.</p></div>')}
                </div>`;
            bind(x);
        }
    };
})();
