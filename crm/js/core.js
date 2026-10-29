/* CRM Willie Inspired · núcleo: iconos, API, acceso por clave, router, panel lateral, diálogos, toasts y paleta ⌘K. */
(() => {
    'use strict';
    const C = (window.CRM = { pages: {}, state: {} });
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    C.$ = $; C.$$ = $$;

    // ── Utilidades ───────────────────────────────────────────────────────────
    C.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    C.usd = (n) => `US$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    C.num = (n) => Number(n || 0).toLocaleString('es-PE');
    C.when = (iso) => (iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima' }) : '—');
    C.ago = (iso) => {
        if (!iso) return '—';
        const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
        if (s < 3600) return `hace ${Math.max(1, Math.round(s / 60))} min`;
        if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
        const d = Math.round(s / 86400);
        return d === 1 ? 'ayer' : `hace ${d} días`;
    };
    C.initials = (s) => String(s || '?').replace(/@.*/, '').split(/[._\s-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('') || '?';
    C.country = (c) => (c ? String(c).toUpperCase() : '—');

    // ── Iconos (trazos tipo lucide) ──────────────────────────────────────────
    const ICONS = {
        dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
        users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        kanban: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
        zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
        bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
        tasks: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
        flask: '<path d="M10 2v7.5L4.7 20a1 1 0 0 0 .9 1.5h12.8a1 1 0 0 0 .9-1.5L14 9.5V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
        activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
        search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
        moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
        logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
        plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
        x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
        refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
        key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
        trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
        shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
        ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
        alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
        cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
        copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
        filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
        play: '<path d="m6 3 14 9-14 9z"/>'
    };
    C.icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

    // ── Tema ─────────────────────────────────────────────────────────────────
    const savedTheme = () => { try { return localStorage.getItem('crm_theme'); } catch (_) { return null; } };
    C.setTheme = (t) => { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('crm_theme', t); } catch (_) { /* modo privado */ } };
    document.documentElement.setAttribute('data-theme', savedTheme() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    C.toggleTheme = () => C.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

    // ── Acceso por clave ─────────────────────────────────────────────────────
    const store = {
        get() { try { return sessionStorage.getItem('crm_key') || localStorage.getItem('crm_key') || ''; } catch (_) { return ''; } },
        set(key, remember) { try { sessionStorage.setItem('crm_key', key); if (remember) localStorage.setItem('crm_key', key); else localStorage.removeItem('crm_key'); } catch (_) { /* modo privado */ } },
        clear() { try { sessionStorage.removeItem('crm_key'); localStorage.removeItem('crm_key'); } catch (_) { /* modo privado */ } }
    };
    C.key = store;

    C.api = async (path, { method = 'GET', body } = {}) => {
        let res;
        try {
            res = await fetch(`/api/store${path}`, { method, headers: { 'x-admin-key': store.get(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        } catch (_) { throw new Error('Sin conexión con el servidor.'); }
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) { C.lock('Tu sesión venció o la clave cambió.'); throw new Error('Acceso denegado'); }
        if (res.status === 429) throw new Error(data.error || 'Demasiados intentos.');
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        return data;
    };

    C.verify = async (key) => {
        const res = await fetch('/api/store/admin/verify', { method: 'POST', headers: { 'x-admin-key': key, 'Content-Type': 'application/json' } }).catch(() => null);
        if (!res) return { ok: false, error: 'Sin conexión con el servidor.' };
        if (res.ok) return { ok: true };
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: res.status === 429 ? (data.error || 'Demasiados intentos. Espera unos minutos.') : 'Clave incorrecta.' };
    };

    C.lock = (msg) => {
        store.clear();
        $('#app').hidden = true;
        $('#login').hidden = false;
        $('#loginMsg').textContent = msg || '';
        $('#loginKey').value = '';
        $('#loginKey').focus();
    };
    C.unlock = () => { $('#login').hidden = true; $('#app').hidden = false; C.route(); };

    // ── Toasts ───────────────────────────────────────────────────────────────
    C.toast = (msg, kind = '') => {
        const box = $('#toasts');
        const t = document.createElement('div');
        t.className = `toast ${kind === 'error' ? 'toast--error' : ''}`;
        t.textContent = msg;
        box.appendChild(t);
        setTimeout(() => t.remove(), 3600);
    };

    // ── Panel lateral (sheet) ────────────────────────────────────────────────
    C.sheet = {
        open({ title = '', subtitle = '', lead = '', body = '' }) {
            $('#sheetTitle').innerHTML = title;
            $('#sheetSub').innerHTML = subtitle;
            $('#sheetLead').innerHTML = lead;
            $('#sheetBody').innerHTML = body;
            $('#overlay').classList.add('is-open'); $('#sheet').classList.add('is-open');
        },
        body: () => $('#sheetBody'),
        close() { $('#overlay').classList.remove('is-open'); $('#sheet').classList.remove('is-open'); }
    };

    // ── Diálogos ─────────────────────────────────────────────────────────────
    C.dialog = ({ title, text = '', fields = [], confirm = 'Aceptar', danger = false }) => new Promise((resolve) => {
        const d = $('#dialog');
        d.innerHTML = `<h2>${C.esc(title)}</h2>${text ? `<p class="muted" style="margin-top:6px">${C.esc(text)}</p>` : ''}
            <form class="stack" style="margin-top:16px">${fields.map((f) => `<label class="label">${C.esc(f.label)}${f.type === 'textarea'
                ? `<textarea class="textarea" name="${f.name}" placeholder="${C.esc(f.placeholder || '')}"></textarea>`
                : `<input class="input" name="${f.name}" type="${f.type || 'text'}" placeholder="${C.esc(f.placeholder || '')}" ${f.required ? 'required' : ''}>`}</label>`).join('')}
            <div class="row" style="justify-content:flex-end;margin-top:6px"><button type="button" class="btn btn--outline" data-cancel>Cancelar</button><button class="btn ${danger ? 'btn--destructive' : 'btn--default'}">${C.esc(confirm)}</button></div></form>`;
        const close = (v) => {
            d.classList.remove('is-open');
            if (!$('#sheet').classList.contains('is-open')) $('#overlay').classList.remove('is-open');
            setTimeout(() => { d.innerHTML = ''; }, 200);
            resolve(v);
        };
        d.querySelector('[data-cancel]').onclick = () => close(null);
        d.querySelector('form').onsubmit = (e) => { e.preventDefault(); close(Object.fromEntries(new FormData(e.target))); };
        $('#overlay').classList.add('is-open'); d.classList.add('is-open');
        d.querySelector('input,textarea')?.focus();
    });

    // ── Paleta de búsqueda ⌘K ────────────────────────────────────────────────
    const PAGES_INDEX = [['dashboard', 'Resumen'], ['contactos', 'Contactos'], ['oportunidades', 'Oportunidades'], ['automatizaciones', 'Automatizaciones'], ['ventas', 'Venta manual'], ['tareas', 'Tareas'], ['experimentos', 'Experimentos A/B'], ['sistema', 'Estado del sistema']];
    let palTimer;
    C.palette = {
        open() {
            $('#palette').classList.add('is-open'); $('#paletteScrim').classList.add('is-open');
            const i = $('#paletteInput'); i.value = ''; C.palette.render([], ''); i.focus();
        },
        close() { $('#palette').classList.remove('is-open'); $('#paletteScrim').classList.remove('is-open'); },
        render(contacts, q) {
            const pages = PAGES_INDEX.filter(([, n]) => !q || n.toLowerCase().includes(q.toLowerCase()));
            $('#paletteList').innerHTML =
                (pages.length ? `<p class="muted small" style="padding:6px 10px">Ir a</p>${pages.map(([k, n]) => `<button class="palette__item" data-go="${k}">${C.icon('dashboard')}${C.esc(n)}</button>`).join('')}` : '')
                + (contacts.length ? `<p class="muted small" style="padding:10px 10px 6px">Contactos</p>${contacts.map((c) => `<button class="palette__item" data-contact="${C.esc(c.email)}"><span class="avatar">${C.esc(C.initials(c.email))}</span><span><b>${C.esc(c.email)}</b><br><span class="muted small">${C.esc(c.segment || '')} · ${C.esc(C.country(c.country || c.ip_country))}</span></span></button>`).join('')}` : '');
        },
        async search(q) {
            clearTimeout(palTimer);
            palTimer = setTimeout(async () => {
                let items = [];
                if (q.trim().length >= 2) { try { items = (await C.api(`/admin/contacts?q=${encodeURIComponent(q.trim())}`)).items.slice(0, 6); } catch (_) { /* sin resultados */ } }
                C.palette.render(items, q);
            }, 220);
        }
    };
    addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !$('#app').hidden) { e.preventDefault(); C.palette.open(); }
        if (e.key === 'Escape') { C.palette.close(); C.sheet.close(); $('#sidebar').classList.remove('is-open'); $('#scrim').classList.remove('is-open'); }
    });

    // ── Router por hash ──────────────────────────────────────────────────────
    C.go = (page) => { location.hash = `#/${page}`; };
    C.route = async () => {
        if ($('#app').hidden) return;
        const page = (location.hash.replace(/^#\//, '').split('?')[0]) || 'dashboard';
        const def = C.pages[page] || C.pages.dashboard;
        $$('.nav a').forEach((a) => a.classList.toggle('is-active', a.dataset.page === (C.pages[page] ? page : 'dashboard')));
        $('#sidebar').classList.remove('is-open'); $('#scrim').classList.remove('is-open');
        const view = $('#view');
        view.onclick = null; // cada página registra el suyo; así no se acumulan
        view.innerHTML = '<div class="stack"><div class="skeleton" style="height:36px;width:220px"></div><div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:260px"></div></div>';
        const token = (C.state.routeToken = (C.state.routeToken || 0) + 1);
        try { await def.render(view, token); } catch (e) { if (token === C.state.routeToken) view.innerHTML = `<div class="alert alert--error">${C.icon('alert')}<div>${C.esc(e.message)}</div></div>`; }
    };
    addEventListener('hashchange', C.route);

    // ── Arranque ─────────────────────────────────────────────────────────────
    document.addEventListener('click', (e) => {
        const t = e.target;
        if (t.closest('[data-theme-toggle]')) C.toggleTheme();
        if (t.closest('[data-logout]')) C.lock('Sesión cerrada.');
        if (t.closest('[data-menu]')) { $('#sidebar').classList.add('is-open'); $('#scrim').classList.add('is-open'); }
        if (t.closest('#scrim')) { $('#sidebar').classList.remove('is-open'); $('#scrim').classList.remove('is-open'); }
        if (t.closest('[data-search]')) C.palette.open();
        if (t.closest('#paletteScrim')) C.palette.close();
        if (t.closest('[data-sheet-close]')) C.sheet.close();
        const go = t.closest('[data-go]');
        if (go) { C.palette.close(); C.go(go.dataset.go); }
        const c = t.closest('[data-contact]');
        if (c) { C.palette.close(); C.openContact(c.dataset.contact); }
    });
    $('#paletteInput').addEventListener('input', (e) => C.palette.search(e.target.value));
    $('#overlay').addEventListener('click', () => {
        const d = $('#dialog');
        if (d.classList.contains('is-open')) d.querySelector('[data-cancel]')?.click(); else C.sheet.close();
    });

    $('#loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const key = $('#loginKey').value.trim();
        const btn = $('#loginBtn');
        if (!key) return;
        btn.disabled = true; btn.textContent = 'Verificando…'; $('#loginMsg').textContent = '';
        const r = await C.verify(key);
        btn.disabled = false; btn.textContent = 'Entrar';
        if (!r.ok) { $('#loginMsg').textContent = r.error; return; }
        store.set(key, $('#loginRemember').checked);
        C.unlock();
    });

    window.addEventListener('DOMContentLoaded', async () => {
        const key = store.get();
        if (key && (await C.verify(key)).ok) C.unlock(); else { $('#login').hidden = false; $('#loginKey').focus(); }
    });
})();
