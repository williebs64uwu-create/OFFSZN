/* CRM Willie Inspired · páginas: resumen, contactos, oportunidades, automatizaciones, venta manual, tareas, experimentos y sistema. */
(() => {
    'use strict';
    const C = window.CRM;
    const { $, $$, esc, usd, num, when, ago, icon, api, toast } = C;

    const SEGMENT_BADGE = { FREE: 'secondary', 'COMPRADOR V1': 'brand', 'COMPRADOR V2': 'success' };
    const segBadge = (s) => `<span class="badge badge--${SEGMENT_BADGE[s] || 'secondary'}">${esc(s || 'FREE')}</span>`;
    const card = ({ title, desc = '', actions = '', body = '', flush = false, id = '' }) => `<section class="card ${flush ? 'card--flush' : ''}" ${id ? `id="${id}"` : ''}>
        ${title ? `<div class="card__head"><div><h2 class="card__title">${title}</h2>${desc ? `<p class="card__desc">${desc}</p>` : ''}</div>${actions}</div>` : ''}<div class="card__body">${body}</div></section>`;
    const head = (title, desc = '', actions = '') => `<div class="page-head"><div><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ''}</div><div class="row">${actions}</div></div>`;
    const empty = (ic, text) => `<div class="empty">${icon(ic)}<p>${text}</p></div>`;
    const rows = (list, label, value, fmt = (v) => v) => {
        const max = Math.max(1, ...list.map((r) => r[value]));
        return list.length ? list.map((r) => `<div class="list-row"><div class="grow"><div class="row between"><span>${esc(r[label])}</span><b>${fmt(r[value])}</b></div><div class="bar" style="margin-top:6px"><i style="width:${Math.max(3, (r[value] / max) * 100)}%"></i></div></div></div>`).join('')
            : empty('activity', 'Sin datos todavía.');
    };

    // ══ Resumen ═══════════════════════════════════════════════════════════════
    function revenueChart(series) {
        const W = 640; const H = 190; const pad = { l: 36, r: 8, t: 10, b: 22 };
        const max = Math.max(1, ...series.map((s) => s.revenueUsd));
        const bw = (W - pad.l - pad.r) / series.length;
        const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
        const grid = [0, 0.5, 1].map((f) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(max * f)}" y2="${y(max * f)}"/><text x="${pad.l - 6}" y="${y(max * f) + 3}" text-anchor="end">${Math.round(max * f)}</text>`).join('');
        const bars = series.map((s, i) => `<rect class="bar-r" x="${pad.l + i * bw + bw * 0.15}" y="${y(s.revenueUsd)}" width="${bw * 0.7}" height="${Math.max(1, H - pad.b - y(s.revenueUsd))}" rx="2"><title>${s.day}: ${usd(s.revenueUsd)}</title></rect>`).join('');
        const step = Math.ceil(series.length / 6);
        const labels = series.map((s, i) => (i % step === 0 ? `<text x="${pad.l + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${s.day.slice(5)}</text>` : '')).join('');
        return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Ingresos por día">${grid}${bars}${labels}</svg>`;
    }

    C.pages.dashboard = {
        async render(view, token) {
            // Por defecto, todo lo que hay desde que empezó el libro de finanzas (31 oct 2026)
            const period = C.state.days || 'inicio';
            const [o, t] = await Promise.all([api(period === 'inicio' ? '/admin/overview' : `/admin/overview?days=${period}`), api('/admin/tasks')]);
            if (token !== C.state.routeToken) return;
            const names = { page_view: 'Visitas', add_to_cart: 'Carrito', checkout_start: 'Checkout', purchase: 'Compras' };
            const top = Math.max(1, o.funnel[0]?.sessions || 1);
            const funnel = o.funnel.map((f, i) => {
                const prev = i ? o.funnel[i - 1].sessions : null;
                const conv = prev ? ` · ${Math.round((f.sessions / prev) * 100)}% del paso anterior` : '';
                return `<div class="funnel-step"><div class="row between"><span>${names[f.step]}</span><span class="muted small">${num(f.sessions)}${conv}</span></div><div class="bar"><i style="width:${Math.max(4, (f.sessions / top) * 100)}%;opacity:${1 - i * 0.18}">${num(f.sessions)}</i></div></div>`;
            }).join('');
            const due = t.items.slice(0, 5);
            view.innerHTML = `${head('Resumen', `${period === 'inicio' ? 'Desde el 31 de octubre de 2026' : `Últimos ${period} días`}: todos los pagos reales de OFFSZN y la tienda, tal como los cobró PayPal o Mercado Pago.`,
                `<select class="select" id="period" style="width:auto"><option value="inicio">Desde el 31 oct 2026</option><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option></select><button class="btn btn--outline" data-go="contactos">${icon('users')} Contactos</button>`)}
                <div class="kpis">
                    ${[['Ingresos', usd(o.revenueUsd), `${num(o.orders)} ventas · neto ${usd(o.netUsd)}`, 'trend'], ['Ticket medio', usd(o.aovUsd), 'por venta', 'bag'], ['Recompra', `${o.customers.repeatRate}%`, `${num(o.customers.buyers)} compradores`, 'refresh'], ['Pruebas → compra', `${o.trials.rate}%`, `${num(o.trials.converted)} de ${num(o.trials.total)} pruebas`, 'flask'],
                    ['Clientes', num(o.customers.total), `${o.customers.segments.FREE} FREE · ${o.customers.segments['COMPRADOR V1']} V1 · ${o.customers.segments['COMPRADOR V2']} V2`, 'users'], ['Carritos abiertos', num(o.carts.open), `${o.carts.recovered} recuperados`, 'cart']]
                        .map(([l, v, f, ic]) => `<div class="card kpi"><div class="kpi__top"><span>${l}</span>${icon(ic)}</div><div class="kpi__value">${v}</div><div class="kpi__foot">${f}</div></div>`).join('')}
                </div>
                <div class="grid grid-2">
                    ${card({ title: 'Ingresos por día', desc: 'Solo ventas completadas.', body: revenueChart(o.series) })}
                    ${card({ title: 'Embudo', desc: 'Sesiones distintas en cada paso.', body: funnel })}
                </div>
                <div class="grid grid-3">
                    ${card({ title: 'Por país', body: rows(o.byCountry, 'key', 'revenueUsd', usd) })}
                    ${card({ title: 'Por fuente', desc: 'Según utm_source.', body: rows(o.bySource, 'key', 'revenueUsd', usd) })}
                    ${card({ title: 'Productos más vendidos', body: rows(o.byProduct, 'key', 'units') })}
                </div>
                <div class="grid grid-2">
                    ${card({ title: 'Para hacer', desc: 'Tareas pendientes de tus contactos.', actions: `<button class="btn btn--ghost btn--sm" data-go="tareas">Ver todas</button>`,
                        body: due.length ? due.map((n) => `<div class="list-row"><span class="avatar">${esc(C.initials(n.email))}</span><div class="grow"><b>${esc(n.body)}</b><div class="muted small"><a href="#" data-contact="${esc(n.email)}" style="text-decoration:underline">${esc(n.email)}</a>${n.due_at ? ` · ${ago(n.due_at) === '—' ? '' : when(n.due_at)}` : ''}</div></div></div>`).join('') : empty('tasks', 'No tienes tareas pendientes.') })}
                    ${card({ title: 'Ofertas y pagos', body: `<p class="muted small" style="margin-bottom:6px">Ventas por oferta</p>${rows(o.byOffer, 'key', 'orders')}<div class="separator" style="margin:14px 0"></div><p class="muted small" style="margin-bottom:6px">Ingresos por método</p>${rows(o.byMethod, 'key', 'revenueUsd', usd)}` })}
                </div>`;
            $('#period').value = String(period);
            $('#period').onchange = (e) => { C.state.days = e.target.value === 'inicio' ? 'inicio' : +e.target.value; C.route(); };
        }
    };

    // ══ Contactos ═════════════════════════════════════════════════════════════
    const LISTS = [
        ['todos', 'Todos', () => true], ['free', 'FREE', (c) => c.segment === 'FREE'], ['v1', 'Compradores V1', (c) => c.segment === 'COMPRADOR V1'],
        ['v2', 'Compradores V2', (c) => c.segment === 'COMPRADOR V2'], ['vpn', 'Posible VPN', (c) => c.vpn_suspected], ['baja', 'Dados de baja', (c) => c.unsubscribed]
    ];
    C.pages.contactos = {
        async render(view, token) {
            const q = C.state.q || '';
            const list = C.state.list || 'todos';
            const { items } = await api(`/admin/contacts${q ? `?q=${encodeURIComponent(q)}` : ''}`);
            if (token !== C.state.routeToken) return;
            const render = () => {
                const def = LISTS.find((l) => l[0] === (C.state.list || 'todos'));
                const shown = items.filter(def[2]);
                $('#contactsBody').innerHTML = shown.length ? `<table><thead><tr><th>Contacto</th><th>Segmento</th><th>País</th><th>Compras</th><th>Gastado</th><th>Última compra</th><th>Etiquetas</th></tr></thead><tbody>${shown.map((c) => `
                    <tr class="clickable" data-contact="${esc(c.email)}"><td><div class="person"><span class="avatar">${esc(C.initials(c.username || c.email))}</span><div><b>${esc(c.username || c.email.split('@')[0])}</b><span>${esc(c.email)}${c.unsubscribed ? ' · baja' : ''}</span></div></div></td>
                    <td>${segBadge(c.segment)}</td><td>${esc(C.country(c.country || c.ip_country))}${c.vpn_suspected ? ' <span class="badge badge--warning">VPN</span>' : ''}</td>
                    <td>${num(c.purchase_count)}</td><td><b>${usd(c.total_spent_usd)}</b></td><td class="muted">${c.last_purchase_at ? ago(c.last_purchase_at) : '—'}</td>
                    <td>${(c.tags || []).slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</td></tr>`).join('')}</tbody></table>` : empty('users', 'No hay contactos en esta lista.');
                $$('#lists .chip').forEach((b) => b.classList.toggle('is-active', b.dataset.list === (C.state.list || 'todos')));
                $('#contactsCount').textContent = `${num(shown.length)} de ${num(items.length)} contactos`;
            };
            view.innerHTML = `${head('Contactos', 'Cada persona que dejó su correo, pidió un regalo o compró.', `<button class="btn btn--outline" id="csv">${icon('download')} Exportar CSV</button>`)}
                <div class="row between"><div class="chips" id="lists">${LISTS.map(([k, n, f]) => `<button class="chip ${k === list ? 'is-active' : ''}" data-list="${k}">${n} <small>${items.filter(f).length}</small></button>`).join('')}</div>
                <div class="input-icon" style="width:min(320px,100%)">${icon('search')}<input class="input" id="contactSearch" placeholder="Buscar correo o usuario" value="${esc(q)}"></div></div>
                ${card({ flush: true, body: '<div class="table-wrap" id="contactsBody"></div>' })}<p class="muted small" id="contactsCount"></p>`;
            render();
            $('#lists').onclick = (e) => { const b = e.target.closest('[data-list]'); if (b) { C.state.list = b.dataset.list; render(); } };
            let timer;
            $('#contactSearch').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { C.state.q = e.target.value.trim(); C.route(); }, 400); };
            $('#csv').onclick = () => {
                const cols = ['email', 'username', 'country', 'ip_country', 'segment', 'purchase_count', 'total_spent_usd', 'first_source', 'ab_variant', 'unsubscribed'];
                const lines = [cols.join(','), ...items.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))];
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
                a.download = `contactos-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
            };
        }
    };

    // Ficha del contacto (panel lateral)
    const EVENT_NAMES = { page_view: 'Vio una página', add_to_cart: 'Añadió al carrito', checkout_start: 'Inició el checkout', purchase: 'Compró', lead: 'Pidió un regalo', trial_request: 'Pidió una prueba', popup_view: 'Vio la oferta', popup_click: 'Hizo clic en la oferta', offer_click: 'Abrió su oferta del correo', upsell_view: 'Vio un upsell', upsell_click: 'Hizo clic en un upsell', onboarding_done: 'Completó su perfil', video_play: 'Reprodujo un audio o video' };
    C.openContact = async (email) => {
        C.sheet.open({ title: esc(email), body: '<div class="skeleton" style="height:140px"></div>' });
        try {
            const d = await api(`/admin/contacts/${encodeURIComponent(email)}`);
            const cu = d.customer || { email };
            const timeline = [
                ...d.events.map((x) => ({ at: x.created_at, text: `${EVENT_NAMES[x.event] || x.event}${x.product_id ? ` · ${x.product_id}` : ''}`, sub: x.page || '' })),
                ...d.orders.map((o) => ({ at: o.created_at, text: `Orden ${o.status} · ${usd(o.total_usd)} · ${o.payment_method}`, sub: (o.lines || []).map((l) => l.title).join(', ') })),
                ...d.trials.map((t) => ({ at: t.created_at, text: `Prueba de ${t.plugin_name}${t.converted_at ? ' (compró)' : ''}`, sub: '' })),
                ...d.automations.map((a) => ({ at: a.created_at, text: `Correo automático: ${a.rule}`, sub: '' }))
            ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100);
            const reload = () => C.openContact(email);
            const patch = async (body) => { try { await api(`/admin/contacts/${encodeURIComponent(email)}`, { method: 'PATCH', body }); reload(); } catch (e) { toast(e.message, 'error'); } };

            C.sheet.open({
                title: `<span class="row" style="gap:12px"><span class="avatar avatar--lg">${esc(C.initials(cu.username || email))}</span><span><b style="font-size:17px">${esc(cu.username || email.split('@')[0])}</b><br><span class="muted small" style="font-weight:400">${esc(email)}</span></span></span>`,
                subtitle: '',
                lead: '<button class="btn btn--ghost btn--icon" data-sheet-close aria-label="Cerrar">' + icon('x') + '</button>',
                body: `<div class="row" style="margin-bottom:14px">${segBadge(cu.segment)}<span class="badge badge--outline">${esc(C.country(cu.country || cu.ip_country))}</span>${cu.vpn_suspected ? '<span class="badge badge--warning">Posible VPN</span>' : ''}${cu.unsubscribed ? '<span class="badge badge--destructive">Baja de correos</span>' : ''}</div>
                    <div class="row" style="margin-bottom:16px">
                        ${cu.whatsapp ? `<a class="btn btn--outline btn--sm" target="_blank" rel="noopener" href="https://wa.me/${esc(cu.whatsapp.replace(/\D/g, ''))}?text=${encodeURIComponent('Hola! Soy Willie de Willie Inspired.')}">${icon('phone')} WhatsApp</a>` : ''}
                        <a class="btn btn--outline btn--sm" href="mailto:${esc(email)}">${icon('mail')} Correo</a>
                        <button class="btn btn--outline btn--sm" id="cUnsub">${cu.unsubscribed ? 'Reactivar correos' : 'Dar de baja'}</button>
                    </div>
                    <div class="tabs" id="cTabs" style="margin-bottom:16px"><button class="is-active" data-t="resumen">Resumen</button><button data-t="actividad">Actividad</button><button data-t="notas">Notas</button><button data-t="compras">Compras</button></div>
                    <div data-pane="resumen" class="stack">
                        <div class="kpis" style="grid-template-columns:repeat(3,1fr)">${[['Compras', num(cu.purchase_count)], ['Gastado', usd(cu.total_spent_usd)], ['Última', cu.last_purchase_at ? ago(cu.last_purchase_at) : '—']].map(([l, v]) => `<div class="card kpi" style="padding:12px 14px"><div class="kpi__top"><span class="small">${l}</span></div><div class="kpi__value" style="font-size:18px">${v}</div></div>`).join('')}</div>
                        <p class="muted small">Fuente: <b>${esc(cu.first_source || 'N/D')}</b> · Variante: <b>${esc(cu.ab_variant || 'N/D')}</b> · Alta: ${when(cu.created_at)}</p>
                        ${d.cart && !d.cart.recovered_at ? `<div class="alert alert--warn">${icon('cart')}<div><b>Carrito abierto</b> por ${usd(d.cart.total_usd)}: ${(d.cart.items || []).map((i) => esc(i.id)).join(', ')}</div></div>` : ''}
                        <div><p class="label" style="margin-bottom:6px">Etiquetas</p><div id="cTags">${(cu.tags || []).map((t) => `<span class="tag">${esc(t)} <button data-rm="${esc(t)}" aria-label="Quitar">×</button></span>`).join('') || '<span class="muted small">Sin etiquetas</span>'}</div>
                            <form class="row" id="cTagForm" style="margin-top:8px"><input class="input" name="tag" placeholder="Nueva etiqueta" style="flex:1"><button class="btn btn--outline">Añadir</button></form></div>
                        <div><p class="label" style="margin-bottom:6px">WhatsApp</p><form class="row" id="cWaForm"><input class="input" name="wa" value="${esc(cu.whatsapp || '')}" placeholder="+51…" style="flex:1"><button class="btn btn--outline">Guardar</button></form></div>
                        <div><p class="label" style="margin-bottom:6px">Oportunidades</p>${d.deals.length ? d.deals.map((x) => `<div class="list-row"><div class="grow"><b>${esc(x.title)}</b><div class="muted small">${esc(x.stage)} · ${x.value_usd ? usd(x.value_usd) : 'sin monto'}</div></div></div>`).join('') : '<span class="muted small">Ninguna todavía.</span>'}</div>
                    </div>
                    <div data-pane="actividad" hidden>${timeline.length ? `<ul class="timeline">${timeline.map((x) => `<li>${esc(x.text)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}<small>${when(x.at)}</small></li>`).join('')}</ul>` : empty('activity', 'Sin actividad todavía.')}</div>
                    <div data-pane="notas" hidden class="stack">
                        <form class="stack" id="cNoteForm"><textarea class="textarea" name="body" placeholder="Escribe una nota o una tarea…" required></textarea>
                            <div class="row between"><label class="row small"><input type="checkbox" name="task"> Es una tarea</label><div class="row"><input class="input" type="datetime-local" name="due" style="width:auto"><button class="btn btn--default">Guardar</button></div></div></form>
                        ${d.notes.map((n) => `<div class="list-row"><div class="grow"><b>${n.kind === 'task' ? '☑ ' : ''}${esc(n.body)}</b><div class="muted small">${when(n.created_at)}${n.due_at ? ` · vence ${when(n.due_at)}` : ''}${n.done ? ' · hecha' : ''}</div></div>${n.kind === 'task' && !n.done ? `<button class="btn btn--outline btn--sm" data-done="${n.id}">Hecha</button>` : ''}</div>`).join('') || ''}
                    </div>
                    <div data-pane="compras" hidden>${d.orders.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Productos</th><th>Pago</th><th>Total</th></tr></thead><tbody>${d.orders.map((o) => `<tr><td class="muted">${when(o.created_at)}</td><td>${(o.lines || []).map((l) => esc(l.title)).join('<br>')}</td><td>${esc(o.payment_method)}</td><td><b>${usd(o.total_usd)}</b>${o.offer_type ? `<br><span class="badge badge--outline">${esc(o.offer_type)}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>` : empty('bag', 'Aún no compró nada.')}</div>`
            });

            const body = C.sheet.body();
            $('#cTabs', body).onclick = (e) => {
                const b = e.target.closest('[data-t]'); if (!b) return;
                $$('#cTabs button', body).forEach((x) => x.classList.toggle('is-active', x === b));
                $$('[data-pane]', body).forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.t; });
            };
            $('#cUnsub', body).onclick = () => patch({ unsubscribed: !cu.unsubscribed });
            $('#cTagForm', body).onsubmit = (e) => { e.preventDefault(); const t = String(new FormData(e.target).get('tag')).trim(); if (t) patch({ tags: [...(cu.tags || []), t] }); };
            $('#cTags', body).onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) patch({ tags: (cu.tags || []).filter((t) => t !== b.dataset.rm) }); };
            $('#cWaForm', body).onsubmit = (e) => { e.preventDefault(); patch({ whatsapp: new FormData(e.target).get('wa') }); };
            $('#cNoteForm', body).onsubmit = async (e) => {
                e.preventDefault(); const fd = new FormData(e.target);
                try { await api(`/admin/contacts/${encodeURIComponent(email)}/notes`, { method: 'POST', body: { body: fd.get('body'), kind: fd.get('task') ? 'task' : 'note', dueAt: fd.get('due') || null } }); toast('Guardado'); reload(); } catch (err) { toast(err.message, 'error'); }
            };
            body.onclick = async (e) => {
                const b = e.target.closest('[data-done]'); if (!b) return;
                try { await api(`/admin/notes/${b.dataset.done}`, { method: 'PATCH', body: { done: true } }); toast('Tarea hecha'); reload(); } catch (err) { toast(err.message, 'error'); }
            };
        } catch (e) { C.sheet.open({ title: esc(email), body: `<div class="alert alert--error">${icon('alert')}<div>${esc(e.message)}</div></div>` }); }
    };

    // ══ Oportunidades (pipeline) ══════════════════════════════════════════════
    const STAGES = { lead: ['Lead', 'hsl(var(--muted-foreground))'], prueba: ['Prueba', 'hsl(var(--brand))'], cotizado: ['Cotizado', 'hsl(var(--warning))'], pagado: ['Pagado', 'hsl(var(--success))'], perdido: ['Perdido', 'hsl(var(--destructive))'] };
    C.pages.oportunidades = {
        async render(view, token) {
            const d = await api('/admin/deals');
            if (token !== C.state.routeToken) return;
            const open = d.items.filter((x) => !['pagado', 'perdido'].includes(x.stage));
            const draw = () => {
                $('#board').innerHTML = d.stages.map((st) => {
                    const list = d.items.filter((x) => x.stage === st);
                    return `<div class="col" data-stage="${st}"><div class="col__head"><span><span class="stage-dot" style="background:${STAGES[st][1]}"></span>${STAGES[st][0]} <span class="badge badge--secondary">${list.length}</span><small>${usd(list.reduce((a, x) => a + Number(x.value_usd || 0), 0))}</small></span></div>
                        ${list.map((x) => `<div class="deal" draggable="true" data-deal="${x.id}"><b>${esc(x.title)}</b><div class="muted"><a href="#" data-contact="${esc(x.email)}" style="text-decoration:underline">${esc(x.email)}</a></div>
                        <div class="row between" style="margin-top:8px"><span class="badge badge--outline">${x.value_usd ? usd(x.value_usd) : 'sin monto'}</span><span class="muted small">${ago(x.updated_at)}</span></div>${x.source ? `<div class="muted small" style="margin-top:6px">${esc(x.source)}</div>` : ''}</div>`).join('') || '<p class="muted small" style="padding:8px">Arrastra aquí</p>'}</div>`;
                }).join('');
            };
            view.innerHTML = `${head('Oportunidades', `${open.length} abiertas · ${usd(open.reduce((a, x) => a + Number(x.value_usd || 0), 0))} en juego. Arrastra las tarjetas entre etapas.`, `<button class="btn btn--brand" id="newDeal">${icon('plus')} Nueva oportunidad</button>`)}<div class="board" id="board"></div>`;
            draw();
            const board = $('#board');
            board.addEventListener('dragstart', (e) => { const c = e.target.closest('.deal'); if (!c) return; c.classList.add('is-dragging'); e.dataTransfer.setData('text/plain', c.dataset.deal); e.dataTransfer.effectAllowed = 'move'; });
            board.addEventListener('dragend', (e) => e.target.closest('.deal')?.classList.remove('is-dragging'));
            board.addEventListener('dragover', (e) => { const col = e.target.closest('.col'); if (col) { e.preventDefault(); $$('.col', board).forEach((x) => x.classList.toggle('is-over', x === col)); } });
            board.addEventListener('dragleave', (e) => { if (!board.contains(e.relatedTarget)) $$('.col', board).forEach((x) => x.classList.remove('is-over')); });
            board.addEventListener('drop', async (e) => {
                e.preventDefault();
                const col = e.target.closest('.col'); $$('.col', board).forEach((x) => x.classList.remove('is-over'));
                const id = e.dataTransfer.getData('text/plain');
                const deal = d.items.find((x) => x.id === id);
                if (!col || !deal || deal.stage === col.dataset.stage) return;
                const body = { stage: col.dataset.stage };
                if (body.stage === 'perdido') { const r = await C.dialog({ title: '¿Por qué se perdió?', fields: [{ name: 'reason', label: 'Motivo (opcional)', placeholder: 'Ej. no le gustó el precio' }], confirm: 'Marcar como perdida' }); if (!r) return; body.lostReason = r.reason; }
                const prev = deal.stage; deal.stage = body.stage; draw();
                try { await api(`/admin/deals/${id}`, { method: 'PATCH', body }); } catch (err) { deal.stage = prev; draw(); toast(err.message, 'error'); }
            });
            $('#newDeal').onclick = async () => {
                const r = await C.dialog({ title: 'Nueva oportunidad', text: 'Para una venta 1 a 1 que estás conversando.', fields: [{ name: 'email', label: 'Correo', type: 'email', required: true }, { name: 'title', label: 'Qué quiere', placeholder: 'Ej. plantilla trap personalizada', required: true }, { name: 'valueUsd', label: 'Monto estimado (US$)', type: 'number' }], confirm: 'Crear' });
                if (!r) return;
                try { await api('/admin/deals', { method: 'POST', body: { email: r.email, title: r.title, valueUsd: r.valueUsd || null } }); toast('Oportunidad creada'); C.route(); } catch (err) { toast(err.message, 'error'); }
            };
        }
    };

    // ══ Automatizaciones ══════════════════════════════════════════════════════
    const FLOWS = {
        abandoned_cart: ['Deja su correo en el checkout', 'Espera 2 horas', 'Correo con su carrito'],
        lead_nurture: ['Pide un regalo gratis', 'Espera 3 días sin comprar', 'Correo con su oferta'],
        post_purchase_upsell: ['Compra un producto', 'Espera 24 horas', 'Correo con el siguiente paso'],
        winback: ['Compró hace tiempo', 'Pasan 45 días', 'Correo con 2x1']
    };
    C.pages.automatizaciones = {
        async render(view, token) {
            const a = await api('/admin/automations');
            if (token !== C.state.routeToken) return;
            view.innerHTML = `${head('Automatizaciones', 'Correos que salen solos cada hora. Cada persona recibe cada uno una sola vez y todos llevan enlace de baja.', `<button class="btn btn--brand" id="runNow">${icon('play')} Ejecutar ahora</button>`)}
                <div id="runResult"></div>
                <div class="grid grid-2">${a.items.map((r) => card({
                    title: esc(r.name), desc: esc(r.description),
                    actions: `<button class="switch ${r.enabled ? 'on' : ''}" data-rule="${r.key}" role="switch" aria-checked="${r.enabled}" aria-label="Activar o pausar ${esc(r.name)}"></button>`,
                    body: `<div class="flow">${(FLOWS[r.key] || []).map((s, i) => `${i ? icon('trend').replace('class="i "', 'class="i" style="width:12px"') : ''}<span>${esc(s)}</span>`).join('')}</div>
                        <div class="separator" style="margin:14px 0"></div><div class="row between"><span class="muted small">Enviados en 30 días</span><b>${num(r.sent30d)}</b></div>
                        <div class="row between" style="margin-top:6px"><span class="muted small">Estado</span><span class="badge badge--${r.enabled ? 'success' : 'secondary'}">${r.enabled ? 'Activa' : 'Pausada'}</span></div>`
                })).join('')}
                ${card({ title: 'Seguimiento de pruebas de plugin', desc: 'Recordatorio a las 48 h sin activar y oferta por país al vencer.', body: `<div class="flow"><span>Pide una prueba gratis</span>${icon('trend')}<span>48 h sin activar</span>${icon('trend')}<span>Recordatorio</span>${icon('trend')}<span>Vence la prueba</span>${icon('trend')}<span>Oferta por país</span></div><p class="muted small" style="margin-top:14px">Corre con el mismo cron cada hora.</p>` })}</div>`;
            view.onclick = async (e) => {
                const sw = e.target.closest('[data-rule]');
                if (!sw) return;
                try { await api(`/admin/automations/${sw.dataset.rule}`, { method: 'PATCH', body: { enabled: !sw.classList.contains('on') } }); toast(sw.classList.contains('on') ? 'Automatización pausada' : 'Automatización activada'); C.route(); } catch (err) { toast(err.message, 'error'); }
            };
            $('#runNow').onclick = async (e) => {
                const btn = e.currentTarget; btn.disabled = true;
                try {
                    const { results } = await api('/admin/automations/run', { method: 'POST' });
                    $('#runResult').innerHTML = `<div class="alert alert--ok">${icon('check')}<div>${Object.entries(results).map(([k, v]) => `<b>${esc(k)}</b>: ${v.enabled ? `${v.sent} enviados, ${v.skipped} ya enviados, ${v.failed} fallidos` : 'pausada'}`).join('<br>')}</div></div>`;
                } catch (err) { $('#runResult').innerHTML = `<div class="alert alert--error">${icon('alert')}<div>${esc(err.message)}</div></div>`; }
                btn.disabled = false;
            };
        }
    };

    // ══ Venta manual ══════════════════════════════════════════════════════════
    let products = [];
    C.pages.ventas = {
        async render(view, token) {
            if (!products.length) {
                const res = await fetch('/api/store/catalog').then((r) => r.json()).catch(() => ({ products: [] }));
                products = res.products.filter((p) => p.status === 'active' && !['lead_magnet', 'subscription'].includes(p.kind) && p.pricing?.usd > 0);
            }
            if (token !== C.state.routeToken) return;
            view.innerHTML = `${head('Venta manual', 'Una venta que cerraste por WhatsApp: se entrega, se avisa al comprador y queda en el CRM.')}
                <form class="grid grid-2" id="saleForm" style="align-items:start">
                    ${card({ title: 'Comprador', body: `<div class="stack">
                        <label class="label">Correo<input class="input" name="email" type="email" required placeholder="comprador@gmail.com"></label>
                        <div class="row"><label class="label grow">País (2 letras)<input class="input" name="country" maxlength="2" placeholder="PE"><span class="field-hint">Define el precio de lista.</span></label>
                        <label class="label grow">Precio acordado (US$)<input class="input" name="priceUsd" type="number" min="1" step="0.5" placeholder="Opcional"><span class="field-hint">Si le diste descuento.</span></label></div>
                        <label class="label">Nota interna<input class="input" name="note" maxlength="500" placeholder="Ej. pagó por Yape a mi número"></label></div>` })}
                    ${card({ title: 'Productos', body: `<div class="stack"><div class="input-icon">${icon('search')}<input class="input" id="saleSearch" placeholder="Buscar producto…"></div><div class="pick" id="salePick"></div><p class="muted small" id="saleCount">Ningún producto elegido</p>
                        <button class="btn btn--brand btn--block" id="saleBtn">Registrar y entregar</button><div id="saleMsg"></div></div>` })}
                </form>`;
            const draw = () => {
                const q = $('#saleSearch').value.trim().toLowerCase();
                const chosen = new Set($$('#salePick input:checked').map((i) => i.value));
                $('#salePick').innerHTML = products.filter((p) => chosen.has(p.id) || !q || p.title.toLowerCase().includes(q)).slice(0, 80)
                    .map((p) => `<label><input type="checkbox" value="${esc(p.id)}" ${chosen.has(p.id) ? 'checked' : ''}><span class="grow">${esc(p.title)}</span><span class="muted small">US$${p.pricing.usd}</span></label>`).join('');
                const n = $$('#salePick input:checked').length;
                $('#saleCount').textContent = n ? `${n} producto${n > 1 ? 's' : ''} elegido${n > 1 ? 's' : ''}` : 'Ningún producto elegido';
            };
            draw();
            $('#saleSearch').oninput = draw;
            $('#salePick').onchange = draw;
            $('#saleForm').onsubmit = async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const items = $$('#salePick input:checked').map((i) => ({ id: i.value }));
                if (!items.length) { toast('Elige al menos un producto', 'error'); return; }
                const btn = $('#saleBtn'); btn.disabled = true; btn.textContent = 'Registrando…';
                try {
                    const r = await api('/admin/manual-sale', { method: 'POST', body: { email: fd.get('email'), country: fd.get('country'), priceUsd: fd.get('priceUsd') || null, note: fd.get('note'), items } });
                    $('#saleMsg').innerHTML = `<div class="alert alert--ok">${icon('check')}<div><b>${usd(r.totalUsd)} registrados.</b>${r.licenses.length ? `<br>Licencias enviadas: ${esc(r.licenses.join(', '))}.` : ''}${r.delivery ? '<br>Archivos enviados al correo.' : ''}</div></div>`;
                    e.target.reset(); draw(); toast('Venta registrada');
                } catch (err) { $('#saleMsg').innerHTML = `<div class="alert alert--error">${icon('alert')}<div>${esc(err.message)}</div></div>`; }
                btn.disabled = false; btn.textContent = 'Registrar y entregar';
            };
        }
    };

    // ══ Tareas ════════════════════════════════════════════════════════════════
    C.pages.tareas = {
        async render(view, token) {
            const { items } = await api('/admin/tasks');
            if (token !== C.state.routeToken) return;
            const now = Date.now(); const eod = new Date(); eod.setHours(23, 59, 59, 999);
            const groups = [['Vencidas', (t) => t.due_at && new Date(t.due_at) < now], ['Hoy', (t) => t.due_at && new Date(t.due_at) >= now && new Date(t.due_at) <= eod], ['Próximas', (t) => t.due_at && new Date(t.due_at) > eod], ['Sin fecha', (t) => !t.due_at]];
            view.innerHTML = `${head('Tareas', 'Lo que te prometiste hacer con cada contacto. Se crean desde la ficha del contacto.')}
                ${items.length ? groups.map(([name, fn]) => { const list = items.filter(fn); return list.length ? card({ title: `${name} <span class="badge badge--secondary">${list.length}</span>`, body: list.map((t) => `<div class="list-row"><span class="avatar">${esc(C.initials(t.email))}</span><div class="grow"><b>${esc(t.body)}</b><div class="muted small"><a href="#" data-contact="${esc(t.email)}" style="text-decoration:underline">${esc(t.email)}</a>${t.due_at ? ` · ${when(t.due_at)}` : ''}</div></div><button class="btn btn--outline btn--sm" data-done="${t.id}">Hecha</button></div>`).join('') }) : ''; }).join('') : card({ body: empty('tasks', 'No tienes tareas pendientes. 🎉') })}`;
            view.onclick = async (e) => {
                const b = e.target.closest('[data-done]'); if (!b) return;
                try { await api(`/admin/notes/${b.dataset.done}`, { method: 'PATCH', body: { done: true } }); toast('Tarea hecha'); C.route(); } catch (err) { toast(err.message, 'error'); }
            };
        }
    };

    // ══ Experimentos ══════════════════════════════════════════════════════════
    C.pages.experimentos = {
        async render(view, token) {
            const days = C.state.abDays || 30;
            const { report } = await api(`/admin/ab-report?days=${days}`);
            if (token !== C.state.routeToken) return;
            const names = { welcome50: '50% de bienvenida', '2x1': '2x1 elige tu gratis' };
            const keys = Object.keys(report);
            const enough = keys.every((k) => report[k].popup_view >= 30);
            const leader = keys.slice().sort((a, b) => report[b].conversion - report[a].conversion || report[b].revenueUsd - report[a].revenueUsd)[0];
            const metric = [['popup_view', 'Vistas'], ['popup_click', 'Clics'], ['ctr', 'CTR %'], ['lead', 'Leads'], ['purchases', 'Compras'], ['conversion', 'Conversión %'], ['revenueUsd', 'Ingresos US$']];
            view.innerHTML = `${head('Experimentos', 'Popup de la oferta: ¿50% de bienvenida o 2x1? Cada visitante ve siempre la misma.', `<select class="select" id="abDays" style="width:auto"><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option></select>`)}
                <div class="alert ${enough ? 'alert--ok' : 'alert--warn'}">${icon(enough ? 'check' : 'alert')}<div>${enough ? `<b>${esc(names[leader])}</b> va ganando por conversión.` : 'Aún faltan datos: cada variante necesita al menos 30 vistas para sacar conclusiones.'}</div></div>
                <div class="grid grid-2">${keys.map((k) => card({ title: esc(names[k] || k), actions: enough && k === leader ? '<span class="badge badge--success">Va ganando</span>' : '',
                    body: metric.map(([m, l]) => `<div class="list-row"><span class="grow muted">${l}</span><b>${m === 'revenueUsd' ? usd(report[k][m]) : num(report[k][m])}</b></div>`).join('') })).join('')}</div>`;
            $('#abDays').value = String(days);
            $('#abDays').onchange = (e) => { C.state.abDays = +e.target.value; C.route(); };
        }
    };

    // ══ Sistema ═══════════════════════════════════════════════════════════════
    C.pages.sistema = {
        async render(view, token) {
            const [s, star] = await Promise.all([api('/admin/system'), api('/admin/star-plan').catch(() => ({ planId: null, error: true }))]);
            if (token !== C.state.routeToken) return;
            const missingTables = s.tables.filter((t) => !t.ok);
            const missingInt = s.integrations.filter((i) => !i.ok);
            const c = s.catalog;
            const row = (ok, name, hint) => `<div class="list-row"><span class="dot ${ok ? 'dot--ok' : 'dot--bad'}"></span><div class="grow"><b>${esc(name)}</b>${!ok && hint ? `<div class="muted small">${esc(hint)}</div>` : ''}</div><span class="badge badge--${ok ? 'success' : 'destructive'}">${ok ? 'Listo' : 'Falta'}</span></div>`;
            view.innerHTML = `${head('Estado del sistema', 'Qué está conectado, qué falta correr y qué contenido falta subir.', `<button class="btn btn--outline" onclick="CRM.route()">${icon('refresh')} Revisar de nuevo</button>`)}
                ${missingTables.length ? `<div class="alert alert--warn">${icon('alert')}<div><b>Faltan tablas en Supabase.</b> Corre en el SQL Editor: ${[...new Set(missingTables.map((t) => `<span class="mono">${esc(t.migration)}</span>`))].join(' y ')}. Hasta entonces, esas pantallas no tendrán datos.</div></div>` : `<div class="alert alert--ok">${icon('check')}<div>Todas las tablas de la tienda y del CRM existen.</div></div>`}
                <div class="grid grid-2">
                    ${card({ title: 'Conexiones', desc: missingInt.length ? `${missingInt.length} por configurar` : 'Todo configurado', body: s.integrations.map((i) => row(i.ok, i.name, i.fix)).join('') })}
                    ${card({ title: 'Base de datos', desc: `${s.tables.length - missingTables.length} de ${s.tables.length} tablas`, body: s.tables.map((t) => row(t.ok, t.name, `Falta correr ${t.migration}`)).join('') })}
                </div>
                ${card({ title: 'STAR CHAIN en 3 cuotas', desc: star.planId ? 'Plan de PayPal creado' : 'Falta crear el plan de PayPal', body: star.planId
                    ? `<div class="list-row"><span class="dot dot--ok"></span><div class="grow"><b>Cuotas activas en el checkout</b><div class="muted small">Plan <span class="mono">${esc(star.planId)}</span> · 3 cobros mensuales de 16.33 US$ · cuota 3 = licencia FULL.</div></div></div><p class="muted small" style="margin:12px 0">Para que un cobro fallido revoque la clave, tu webhook de PayPal (<span class="mono">https://offszn.lat/api/orders/paypal-webhook</span>) necesita los avisos de cuotas. Un clic los registra y conserva los que ya tenías.</p><button class="btn btn--outline" id="mkStarHook">${icon('shield')} Activar avisos de PayPal</button><div class="muted small" id="starHookOut" style="margin-top:8px"></div>`
                    : `<p class="muted small" style="margin-bottom:12px">Crea una sola vez el producto y el plan en tu PayPal (usa las llaves del servidor). Mientras no exista, el checkout avisa que las cuotas aún no están habilitadas.</p><button class="btn btn--brand" id="mkStarPlan">${icon('zap')} Crear plan de cuotas en PayPal</button>` })}
                ${card({ title: 'Contenido pendiente de subir', desc: 'Lo que hoy se ve como cuadro con nombre en la tienda.', body: `<div class="kpis" style="margin-bottom:16px">
                    ${[['Productos activos', c.active], ['Sin portada', c.withoutCoverCount], [`Artistas sin audio`, `${c.artistsWithoutAudio}/${c.artists}`], ['Sin video', c.withoutVideo]].map(([l, v]) => `<div class="card kpi" style="padding:14px 16px"><div class="kpi__top"><span>${l}</span></div><div class="kpi__value" style="font-size:22px">${v}</div></div>`).join('')}</div>
                    ${c.withoutCover.length ? `<p class="label" style="margin-bottom:8px">Productos sin portada</p><div class="chips">${c.withoutCover.map((p) => `<span class="chip">${esc(p.title)} <small>${esc(p.category)}</small></span>`).join('')}</div>` : ''}
                    <p class="muted small" style="margin-top:14px">Las rutas y los nombres de archivo se llenan en <span class="mono">willieinspired/data/store-catalog.json</span>. Guía completa en <span class="mono">docs/willieinspired-tienda/PLAN.md</span>.</p>` })}
                ${card({ title: 'Enlaces', body: `<div class="row"><a class="btn btn--outline" href="/willieinspired" target="_blank" rel="noopener">${icon('ext')} Tienda</a><a class="btn btn--outline" href="/owner/licencias" target="_blank" rel="noopener">${icon('ext')} Licencias</a><a class="btn btn--outline" href="/owner/pagos-manuales" target="_blank" rel="noopener">${icon('ext')} Pagos manuales</a><a class="btn btn--outline" href="/owner/correos-lista-de-espera" target="_blank" rel="noopener">${icon('ext')} Lista de espera</a></div>` })}`;
            const hook = document.getElementById('mkStarHook');
            if (hook) hook.onclick = async () => {
                hook.disabled = true; hook.textContent = 'Registrando…';
                try {
                    const r = await api('/admin/paypal-webhook-setup', { method: 'POST' });
                    document.getElementById('starHookOut').textContent = `${r.created ? 'Webhook creado' : (r.unchanged ? 'Ya estaba todo registrado' : 'Eventos actualizados')} · ${r.events.length} eventos: ${r.events.join(', ')}`;
                    toast(r.unchanged ? 'Los avisos ya estaban activos' : 'Avisos de PayPal activados');
                } catch (err) { toast(err.message, 'error'); }
                hook.disabled = false; hook.innerHTML = `${icon('shield')} Activar avisos de PayPal`;
            };
            const mk = document.getElementById('mkStarPlan');
            if (mk) mk.onclick = async () => {
                mk.disabled = true;
                try { const r = await api('/admin/star-plan', { method: 'POST' }); toast(r.created ? 'Plan creado en PayPal' : 'El plan ya existía'); C.route(); } catch (err) { toast(err.message, 'error'); mk.disabled = false; }
            };
        }
    };
})();
