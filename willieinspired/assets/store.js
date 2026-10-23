/* ==========================================================================
   WILLIE INSPIRED · runtime compartido de la tienda
   Header, footer, carrito, precios por país, oferta A/B, tracking, placeholders y reproductor antes/después.
   Los precios SIEMPRE vienen de /api/store (el navegador solo los muestra).
   ========================================================================== */
(function () {
    'use strict';

    const BASE = '/willieinspired';
    const WA_NUMBER = '51993525005';
    const store = {
        get(k, fallback = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* modo privado */ } },
        del(k) { try { localStorage.removeItem(k); } catch (_) { /* modo privado */ } }
    };
    const session = {
        get(k) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (_) { return null; } },
        set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* modo privado */ } }
    };

    // Tema claro/oscuro: lo elegido por la persona; si no eligió, el del sistema. Se aplica antes de pintar nada.
    const readTheme = () => { try { return localStorage.getItem('wi_theme'); } catch (_) { return null; } };
    const systemDark = () => { try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (_) { return false; } };
    const applyTheme = (t) => document.documentElement.setAttribute('data-theme', t);
    applyTheme(readTheme() || (systemDark() ? 'dark' : 'light'));

    const WI = (window.WI = { BASE, store, session });
    WI.theme = {
        get: () => document.documentElement.getAttribute('data-theme'),
        toggle() { const next = WI.theme.get() === 'dark' ? 'light' : 'dark'; applyTheme(next); try { localStorage.setItem('wi_theme', next); } catch (_) { /* modo privado */ } }
    };
    WI.params = new URLSearchParams(location.search);
    WI.tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { return ''; } })();
    WI.sid = store.get('wi_sid') || (() => { const id = 's_' + Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('wi_sid', id); return id; })();

    // Primera fuente de tráfico (utm) para atribuir leads y ventas.
    (() => {
        const utm = {};
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref'].forEach((k) => { if (WI.params.get(k)) utm[k] = WI.params.get(k).slice(0, 80); });
        if (Object.keys(utm).length && !store.get('wi_utm')) store.set('wi_utm', utm);
    })();
    WI.utm = () => store.get('wi_utm');

    // ── Utilidades ──────────────────────────────────────────────────────────
    WI.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    WI.$ = (sel, root = document) => root.querySelector(sel);
    WI.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    WI.wa = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text || 'Hola Willie! Vengo desde tu página web')}`;
    WI.load = (src) => new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
    });
    let toastTimer;
    WI.toast = (msg) => {
        let el = WI.$('.wi-toast');
        if (!el) { el = document.createElement('div'); el.className = 'wi-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
        el.textContent = msg; el.classList.add('is-on');
        clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
    };

    // ── Cuenta (Supabase, la misma de offszn.lat) ───────────────────────────
    let sbClient = null;
    WI.auth = {
        async client() {
            if (sbClient) return sbClient;
            try {
                if (!window.SUPABASE_URL) await WI.load('/env.js');
                if (!window.supabase?.createClient) await WI.load('/script/supabase.js');
                sbClient = window.supabaseClient || window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            } catch (_) { sbClient = null; }
            return sbClient;
        },
        async session() {
            const c = await WI.auth.client();
            if (!c) return null;
            try { const { data } = await c.auth.getSession(); return data?.session || null; } catch (_) { return null; }
        },
        async token() { return (await WI.auth.session())?.access_token || null; },
        loginUrl: (redirect = location.pathname + location.search) => `/login?redirect=${encodeURIComponent(redirect)}`,
        registerUrl: (redirect = location.pathname + location.search) => `/register?redirect=${encodeURIComponent(redirect)}`,
        async logout() { const c = await WI.auth.client(); if (c) await c.auth.signOut(); location.href = BASE; }
    };

    // ── API ─────────────────────────────────────────────────────────────────
    WI.api = async (path, { method = 'GET', body, auth = true } = {}) => {
        const headers = { 'Content-Type': 'application/json' };
        if (auth) { const t = await WI.auth.token(); if (t) headers.Authorization = `Bearer ${t}`; }
        try {
            const res = await fetch(path.startsWith('/api/') ? path : `/api/store${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
            const data = await res.json().catch(() => ({}));
            return { ok: res.ok, status: res.status, data };
        } catch (e) {
            return { ok: false, status: 0, data: { error: 'Sin conexión. Revisa tu internet.' } };
        }
    };

    // ── Región: la primera visita muestra una carga corta del logo mientras se detecta país/VPN.
    //    El resultado queda en caché, así al recargar ya no aparece la animación.
    WI.geo = async () => {
        const cached = store.get('wi_geo');
        if (cached && cached.tz === WI.tz && Date.now() - cached.at < 12 * 3600 * 1000) return cached.data;
        const loader = document.createElement('div');
        loader.className = 'wi-loader';
        loader.innerHTML = '<div class="wi-loader__logo">Willie Inspired</div>';
        document.body.appendChild(loader);
        const started = Date.now();
        const { data } = await WI.api(`/geo?tz=${encodeURIComponent(WI.tz)}`);
        await new Promise((r) => setTimeout(r, Math.max(0, 600 - (Date.now() - started))));
        loader.classList.add('is-done');
        setTimeout(() => loader.remove(), 400);
        if (data?.tier) store.set('wi_geo', { data, tz: WI.tz, at: Date.now() });
        return data;
    };

    let catalogPromise = null;
    WI.catalog = () => {
        if (catalogPromise) return catalogPromise;
        catalogPromise = (async () => {
            const key = `wi_catalog_${WI.tz}`;
            const cached = session.get(key);
            let data = cached && Date.now() - cached.at < 10 * 60 * 1000 ? cached.data : null;
            if (!data) {
                const res = await WI.api(`/catalog?tz=${encodeURIComponent(WI.tz)}`);
                data = res.ok ? res.data : { products: [], region: null, genres: [], faq: [] };
                if (res.ok) session.set(key, { data, at: Date.now() });
            }
            data.byId = new Map(data.products.map((p) => [p.id, p]));
            return data;
        })();
        return catalogPromise;
    };

    // ── Dinero ──────────────────────────────────────────────────────────────
    const SYMBOL = { USD: 'US$', MXN: 'MX$', ARS: 'AR$', CLP: 'CLP$', DOP: 'RD$', PEN: 'S/ ', EUR: '€' };
    WI.fmt = (amount, currency = 'USD') => {
        const n = Number(amount) || 0;
        const whole = Number.isInteger(n) || ['ARS', 'CLP', 'DOP', 'MXN', 'PEN'].includes(currency);
        const num = n.toLocaleString(['ARS', 'CLP'].includes(currency) ? 'es-AR' : 'en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
        return currency === 'EUR' ? `${num} €` : `${SYMBOL[currency] || currency + ' '}${num}`;
    };
    WI.savePct = (pr) => (pr?.compareAtUsd ? Math.round((1 - pr.usd / pr.compareAtUsd) * 100) : 0);
    WI.priceHtml = (pr, { lg = false, showSave = false } = {}) => {
        if (!pr) return '';
        if (!pr.usd) return '<span class="wi-price"><span class="wi-price__now">Gratis</span></span>';
        const local = pr.local || { amount: pr.usd, currency: 'USD' };
        const usdNote = local.currency !== 'USD' ? `<span class="wi-price__usd">US$${pr.usd}</span>` : '';
        const was = pr.compareAtLocal ? `<span class="wi-price__was">${WI.fmt(pr.compareAtLocal.amount, pr.compareAtLocal.currency)}</span>` : '';
        const save = showSave && WI.savePct(pr) ? `<span class="wi-save">-${WI.savePct(pr)}%</span>` : '';
        return `<span class="wi-price${lg ? ' wi-price--lg' : ''}"><span class="wi-price__now">${WI.fmt(local.amount, local.currency)}</span>${was}${usdNote}${save}</span>`;
    };
    WI.quoteMoney = (q) => (q?.local && q.local.currency !== 'USD' ? `${WI.fmt(q.local.amount, q.local.currency)} <span class="wi-price__usd">US$${q.totalUsd}</span>` : WI.fmt(q?.totalUsd || 0));

    // ── Tracking (eventos del embudo y del A/B) ─────────────────────────────
    const queue = [];
    let flushTimer = null;
    const META_MAP = { add_to_cart: 'AddToCart', checkout_start: 'InitiateCheckout', lead: 'Lead' };
    WI.track = (event, data = {}) => {
        if (META_MAP[event]) WI.pixel(META_MAP[event], data.productId ? { content_ids: [data.productId], content_type: 'product' } : {});
        queue.push({ event, page: location.pathname, variant: data.variant || WI.ab.peek(), productId: data.productId, meta: data.meta });
        clearTimeout(flushTimer);
        flushTimer = setTimeout(WI.flush, 2500);
    };
    WI.flush = (beacon = false) => {
        if (!queue.length) return;
        const payload = JSON.stringify({ sessionId: WI.sid, timezone: WI.tz, events: queue.splice(0, 20) });
        if (beacon && navigator.sendBeacon) navigator.sendBeacon('/api/store/events', new Blob([payload], { type: 'application/json' }));
        else fetch('/api/store/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
    };
    addEventListener('pagehide', () => WI.flush(true));

    // ── Meta Pixel (mismo píxel de OFFSZN). Los eventos de compra llevan event_id para deduplicar con la API del servidor ──
    const cookie = (n) => { const m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : undefined; };
    (() => {
        const fbclid = WI.params.get('fbclid');
        if (fbclid && !cookie('_fbc')) {
            const fbc = `fb.1.${Date.now()}.${fbclid}`;
            document.cookie = `_fbc=${encodeURIComponent(fbc)}; max-age=${90 * 86400}; path=/; SameSite=Lax`;
        }
    })();
    WI.attribution = () => ({ fbp: cookie('_fbp'), fbc: cookie('_fbc'), utm: WI.utm() });
    let pixelReady = null;
    WI.pixel = (name, data = {}, eventId) => {
        pixelReady = pixelReady || (async () => {
            try {
                if (!window.META_PIXEL_ID) await WI.load('/env.js');
                if (!window.META_PIXEL_ID) return false;
                if (!window.fbq) {
                    /* eslint-disable */
                    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
                    /* eslint-enable */
                    window.fbq('init', window.META_PIXEL_ID);
                    window.fbq('track', 'PageView');
                }
                return true;
            } catch (_) { return false; }
        })();
        pixelReady.then((ok) => { if (ok && name !== 'PageView') window.fbq('track', name, data, eventId ? { eventID: eventId } : undefined); });
    };
    WI.pixel('PageView');

    // ── A/B del popup: 50% de bienvenida vs 2x1 (fijo por visitante; ?ab=2x1 para forzar) ──
    WI.ab = {
        peek: () => store.get('wi_ab'),
        variant() {
            const forced = WI.params.get('ab');
            if (forced === 'welcome50' || forced === '2x1') { store.set('wi_ab', forced); return forced; }
            let v = store.get('wi_ab');
            if (!v) { v = Math.random() < 0.5 ? 'welcome50' : '2x1'; store.set('wi_ab', v); }
            return v;
        }
    };

    // ── Oferta activa en el carrito ─────────────────────────────────────────
    WI.offer = {
        get: () => store.get('wi_offer'),
        set(o) { store.set('wi_offer', o); document.dispatchEvent(new CustomEvent('wi:cart')); },
        clear() { store.del('wi_offer'); document.dispatchEvent(new CustomEvent('wi:cart')); },
        label(o = WI.offer.get()) {
            if (!o) return '';
            if (o.type === '2x1') return '2x1: el de menor precio va gratis';
            if (o.type === 'welcome50') return '50% de bienvenida';
            if (o.type === 'code') return 'Oferta especial aplicada';
            if (o.type === 'coupon') return `Cupón ${o.code}`;
            return '';
        }
    };
    if (WI.params.get('oferta') === '2x1') WI.offer.set({ type: '2x1' });
    if (WI.params.get('offer')) WI.offer.set({ type: 'code', code: WI.params.get('offer').slice(0, 40) });

    // ── Carrito (solo ids + sistema operativo; el precio lo pone el servidor) ──
    WI.cart = {
        items: () => store.get('wi_cart', []).filter((i) => i && i.id),
        save(items) { store.set('wi_cart', items); document.dispatchEvent(new CustomEvent('wi:cart')); },
        has: (id) => WI.cart.items().some((i) => i.id === id),
        add(id, { os = null, open = true } = {}) {
            const items = WI.cart.items();
            if (!items.some((i) => i.id === id)) items.push({ id, os });
            WI.cart.save(items);
            WI.track('add_to_cart', { productId: id });
            if (open) WI.drawer.open('cart');
            else WI.toast('Añadido al carrito');
        },
        remove(id) { WI.cart.save(WI.cart.items().filter((i) => i.id !== id)); },
        setOs(id, os) { WI.cart.save(WI.cart.items().map((i) => (i.id === id ? { ...i, os } : i))); },
        clear() { store.del('wi_cart'); document.dispatchEvent(new CustomEvent('wi:cart')); },
        count: () => WI.cart.items().length
    };
    WI.buyNow = (id, os) => { WI.cart.add(id, { os, open: false }); location.href = `${BASE}/checkout`; };

    // ── Placeholders: lo que falta subir lleva su nombre al centro ──────────
    WI.ph = (label, { ratio = '1 / 1', icon = 'image', note = '', dark = false } = {}) =>
        `<div class="wi-ph${dark ? ' wi-ph--dark' : ''}" style="--ratio:${ratio}" role="img" aria-label="${WI.esc(label)}"><i class="bi bi-${icon}"></i><strong>${WI.esc(label)}</strong>${note ? `<span>${WI.esc(note)}</span>` : ''}</div>`;
    WI.img = (src, label, opts = {}) => (src ? `<img src="${WI.esc(src)}" alt="${WI.esc(label)}" loading="lazy" decoding="async"${opts.cls ? ` class="${opts.cls}"` : ''}>` : WI.ph(label, opts));
    WI.coverLabel = (p) => `Portada · ${p.artist || p.title}`;

    // ── Productos ───────────────────────────────────────────────────────────
    WI.url = (p) => {
        if (!p) return BASE;
        if (p.category === 'comunidad') return `${BASE}/comunidad/suscribirse#${p.slug}`;
        const sub = ['artistas', 'bundle', 'expansiones'].includes(p.subcategory) ? `${p.subcategory}/` : '';
        return `${BASE}/${p.category}/${sub}${p.slug}`;
    };
    WI.isBuyable = (p) => p && p.status === 'active' && !['lead_magnet', 'subscription'].includes(p.kind) && p.pricing?.usd > 0;

    WI.card = (p) => {
        const soon = p.status === 'coming_soon';
        const badges = [
            ...(soon ? ['<span class="wi-badge wi-badge--dark">Próximamente</span>'] : []),
            ...(p.kind === 'lead_magnet' ? ['<span class="wi-badge wi-badge--accent">Gratis</span>'] : []),
            ...(!soon && WI.savePct(p.pricing) >= 30 ? [`<span class="wi-badge wi-badge--accent">-${WI.savePct(p.pricing)}%</span>`] : []),
            ...(p.badges || []).filter((b) => b !== 'Gratis').slice(0, 1).map((b) => `<span class="wi-badge">${WI.esc(b)}</span>`)
        ].join('');
        const media = p.media || {};
        const cover = media.cover
            ? `<img src="${WI.esc(media.cover)}" alt="${WI.esc(p.title)}" loading="lazy" decoding="async">${media.hoverCover ? `<img class="is-hover" src="${WI.esc(media.hoverCover)}" alt="" loading="lazy" decoding="async">` : ''}`
            : WI.ph(WI.coverLabel(p), { note: '1:1' });
        const play = media.audioAfter ? `<button type="button" class="wi-card__play" data-play="${WI.esc(media.audioAfter)}" aria-label="Escuchar"><i class="bi bi-play-fill"></i></button>` : '';
        const action = soon
            ? `<a class="wi-btn wi-btn--ghost wi-btn--sm" href="${WI.url(p)}">Avísame</a>`
            : p.kind === 'lead_magnet'
                ? `<a class="wi-btn wi-btn--accent wi-btn--sm" href="${WI.url(p)}">Descargar</a>`
                : WI.isBuyable(p)
                    ? `<button type="button" class="wi-card__add${WI.cart.has(p.id) ? ' is-added' : ''}" data-add="${p.id}" aria-label="Añadir ${WI.esc(p.title)} al carrito"><i class="bi ${WI.cart.has(p.id) ? 'bi-check-lg' : 'bi-plus-lg'}"></i></button>`
                    : '';
        return `<article class="wi-card${soon ? ' wi-card--soon' : ''}" data-id="${p.id}">
            <div class="wi-card__media"><a href="${WI.url(p)}" class="wi-card__link" aria-label="${WI.esc(p.title)}">${cover}</a><div class="wi-card__badges">${badges}</div>${play}</div>
            <div class="wi-card__body">
                <a href="${WI.url(p)}" class="wi-card__title">${WI.esc(p.title)}</a>
                <p class="wi-card__tag">${WI.esc(p.tagline || '')}</p>
                <div class="wi-card__foot">${soon ? '<span class="wi-subtle">Muy pronto</span>' : WI.priceHtml(p.pricing)}${action}</div>
            </div>
        </article>`;
    };
    document.addEventListener('click', (e) => {
        const add = e.target.closest('[data-add]');
        if (add) { e.preventDefault(); WI.cart.add(add.dataset.add); return; }
        const play = e.target.closest('[data-play]');
        if (play) { e.preventDefault(); WI.preview(play.dataset.play, play); }
    });
    document.addEventListener('wi:cart', () => {
        WI.$$('[data-add]').forEach((b) => {
            const added = WI.cart.has(b.dataset.add);
            b.classList.toggle('is-added', added);
            const icon = b.querySelector('i');
            if (icon) icon.className = `bi ${added ? 'bi-check-lg' : 'bi-plus-lg'}`;
        });
    });

    // ── Audio: un solo preview a la vez ─────────────────────────────────────
    const previewAudio = new Audio();
    let previewBtn = null;
    const setPreviewIcon = (btn, playing) => { if (!btn) return; btn.classList.toggle('is-playing', playing); const i = btn.querySelector('i'); if (i) i.className = `bi ${playing ? 'bi-pause-fill' : 'bi-play-fill'}`; };
    previewAudio.addEventListener('ended', () => setPreviewIcon(previewBtn, false));
    WI.preview = (src, btn) => {
        WI.stopAb();
        if (previewBtn === btn && !previewAudio.paused) { previewAudio.pause(); setPreviewIcon(btn, false); return; }
        setPreviewIcon(previewBtn, false);
        previewBtn = btn;
        previewAudio.src = src;
        previewAudio.play().then(() => setPreviewIcon(btn, true)).catch(() => WI.toast('No se pudo reproducir el audio'));
    };

    // Reproductor antes/después: dos pistas sincronizadas, el switch no reinicia la canción.
    const abPlayers = [];
    WI.stopAb = () => abPlayers.forEach((p) => p.pause());
    WI.abPlayer = (root, { before, after, labels = ['Voz cruda', 'Con preset'] } = {}) => {
        const has = Boolean(before && after);
        root.classList.add('wi-ab');
        root.innerHTML = `
            <button type="button" class="wi-ab__play" aria-label="Reproducir"${has ? '' : ' disabled'}><i class="bi bi-play-fill"></i></button>
            <div class="wi-ab__switch" role="tablist">
                <button type="button" data-side="before" class="is-active"${has ? '' : ' disabled'}>${labels[0]}</button>
                <button type="button" data-side="after"${has ? '' : ' disabled'}>${labels[1]}</button>
            </div>
            <div class="wi-ab__bars" aria-hidden="true">${'<i></i>'.repeat(10)}</div>
            <p class="wi-ab__hint">${has ? 'Dale play y cambia entre las dos para escuchar la diferencia.' : 'AUDIO ANTES / DESPUÉS · pendiente de subir'}</p>`;
        if (!has) return { pause() {} };
        const a = new Audio(before);
        const b = new Audio(after);
        a.preload = b.preload = 'none';
        let side = 'before';
        let playing = false;
        const current = () => (side === 'before' ? a : b);
        const playBtn = root.querySelector('.wi-ab__play');
        const render = () => { root.classList.toggle('is-playing', playing); playBtn.querySelector('i').className = `bi ${playing ? 'bi-pause-fill' : 'bi-play-fill'}`; };
        const api = {
            pause() { a.pause(); b.pause(); playing = false; render(); },
            play() {
                abPlayers.forEach((p) => p !== api && p.pause());
                previewAudio.pause(); setPreviewIcon(previewBtn, false);
                current().play().then(() => { playing = true; render(); WI.track('video_play', { meta: { ab_audio: after } }); }).catch(() => WI.toast('No se pudo reproducir el audio'));
            }
        };
        playBtn.addEventListener('click', () => (playing ? api.pause() : api.play()));
        root.querySelectorAll('[data-side]').forEach((btn) => btn.addEventListener('click', () => {
            if (btn.dataset.side === side) return;
            const t = current().currentTime;
            current().pause();
            side = btn.dataset.side;
            root.querySelectorAll('[data-side]').forEach((x) => x.classList.toggle('is-active', x === btn));
            try { current().currentTime = t; } catch (_) { /* aún sin metadata */ }
            if (playing) current().play().catch(() => {});
        }));
        [a, b].forEach((el) => el.addEventListener('ended', () => { playing = false; render(); }));
        abPlayers.push(api);
        return api;
    };

    // ── Drawers ─────────────────────────────────────────────────────────────
    WI.drawer = {
        open(name) {
            WI.$('#wi-backdrop')?.classList.add('is-open');
            WI.$(`#wi-drawer-${name}`)?.classList.add('is-open');
            document.body.classList.add('wi-lock');
            if (name === 'cart') WI.renderCart();
        },
        close() {
            WI.$('#wi-backdrop')?.classList.remove('is-open');
            WI.$$('.wi-drawer').forEach((d) => d.classList.remove('is-open'));
            document.body.classList.remove('wi-lock');
        }
    };
    addEventListener('keydown', (e) => { if (e.key === 'Escape') WI.drawer.close(); });

    let quoteSeq = 0;
    WI.quote = async (items = WI.cart.items(), offer = WI.offer.get()) => {
        if (!items.length) return null;
        const res = await WI.api('/quote', { method: 'POST', body: { items, offer, timezone: WI.tz } });
        return res.data;
    };

    WI.renderCart = async () => {
        const body = WI.$('#wi-cart-body');
        const foot = WI.$('#wi-cart-foot');
        if (!body) return;
        const items = WI.cart.items();
        WI.$$('[data-cart-count]').forEach((el) => { el.textContent = items.length || ''; el.dataset.n = items.length; });
        if (!items.length) {
            body.innerHTML = `<div class="wi-empty"><i class="bi bi-bag"></i>Tu carrito está vacío.<br><a class="wi-link" style="margin-top:12px" href="${BASE}/presets">Ver presets</a></div>`;
            foot.innerHTML = '';
            return;
        }
        const seq = ++quoteSeq;
        const [cat, q] = await Promise.all([WI.catalog(), WI.quote(items)]);
        if (seq !== quoteSeq) return;
        const offer = WI.offer.get();
        const lineById = new Map((q?.lines || []).map((l) => [l.id, l]));
        const rows = items.map((it) => {
            const p = cat.byId.get(it.id);
            if (!p) return '';
            const line = lineById.get(it.id);
            const os = p.kind === 'plugin' || p.delivery === 'license'
                ? `<div class="wi-os">${['win', 'mac'].map((o) => `<button type="button" data-os="${o}" data-id="${p.id}" class="${(it.os || 'win') === o ? 'is-active' : ''}">${o === 'win' ? 'Windows' : 'Mac'}</button>`).join('')}</div>`
                : '';
            const price = line?.free ? '<span class="wi-badge wi-badge--success">GRATIS</span>' : WI.priceHtml(p.pricing);
            return `<div class="wi-cart-line">
                ${WI.img(p.media?.cover, WI.coverLabel(p))}
                <div><div class="wi-cart-line__title">${WI.esc(p.title)}</div><div class="wi-cart-line__meta">${WI.esc(p.format || p.category)}</div>${os}</div>
                <div class="wi-cart-line__price">${price}<br><button type="button" class="wi-cart-line__remove" data-remove="${p.id}">Quitar</button></div>
            </div>`;
        }).join('');

        let hint = '';
        if (offer?.type === '2x1') {
            const eligible = items.filter((i) => cat.byId.get(i.id)?.eligible2x1).length;
            hint = eligible % 2 === 1
                ? `<div class="wi-progress">🎁 <b>2x1 activo:</b> agrega 1 producto más y el de menor precio te sale gratis.</div>`
                : `<div class="wi-progress">🎁 <b>2x1 aplicado:</b> el de menor precio va gratis.</div>`;
        } else if (offer) {
            hint = `<div class="wi-progress">🎁 <b>${WI.esc(WI.offer.label(offer))}</b></div>`;
        }
        const offerError = q?.error ? `<div class="wi-note"><i class="bi bi-info-circle"></i><div>${WI.esc(q.error)} <button type="button" class="wi-link" data-clear-offer>Quitar oferta</button></div></div>` : '';

        // Upsell: lo que sugiere el primer producto del carrito y aún no está.
        const firstWithUpsell = items.map((i) => cat.byId.get(i.id)).find((p) => p?.upsells?.length);
        const ups = (firstWithUpsell?.upsells || []).map((id) => cat.byId.get(id)).filter((p) => WI.isBuyable(p) && !WI.cart.has(p.id)).slice(0, 2);
        const upsHtml = ups.length ? `<div style="margin-top:20px"><p class="wi-eyebrow" style="margin-bottom:8px">Combínalo con</p>${ups.map((p) => `
            <div class="wi-cart-line">${WI.img(p.media?.cover, WI.coverLabel(p))}<div><div class="wi-cart-line__title">${WI.esc(p.title)}</div>${WI.priceHtml(p.pricing)}</div>
            <button type="button" class="wi-btn wi-btn--ghost wi-btn--sm" data-add-upsell="${p.id}">Añadir</button></div>`).join('')}</div>` : '';

        body.innerHTML = hint + offerError + rows + upsHtml;
        const save = q?.discountUsd > 0 ? `<div class="wi-sumline wi-sumline--save"><span>Ahorras</span><span>-US$${q.discountUsd}</span></div>` : '';
        foot.innerHTML = `
            <div class="wi-sumline"><span>Subtotal (${items.length})</span><span>US$${q?.subtotalUsd ?? 0}</span></div>${save}
            <div class="wi-sumline wi-sumline--total"><span>Total</span><span>${WI.quoteMoney(q)}</span></div>
            <a href="${BASE}/checkout" class="wi-btn wi-btn--dark wi-btn--block wi-btn--lg" data-checkout>Ir a pagar <i class="bi bi-arrow-right"></i></a>
            <p class="wi-subtle wi-center" style="margin-top:10px"><i class="bi bi-lightning-charge-fill" style="color:#f59e0b"></i> Descarga inmediata · <i class="bi bi-shield-lock-fill" style="color:#059669"></i> Pago seguro</p>`;
    };
    document.addEventListener('click', (e) => {
        const rm = e.target.closest('[data-remove]');
        if (rm) { WI.cart.remove(rm.dataset.remove); return; }
        const os = e.target.closest('[data-os]');
        if (os) { WI.cart.setOs(os.dataset.id, os.dataset.os); return; }
        const up = e.target.closest('[data-add-upsell]');
        if (up) { WI.cart.add(up.dataset.addUpsell, { open: false }); WI.track('upsell_click', { productId: up.dataset.addUpsell, meta: { where: 'cart' } }); return; }
        if (e.target.closest('[data-clear-offer]')) { WI.offer.clear(); return; }
        if (e.target.closest('[data-theme-toggle]')) { WI.theme.toggle(); return; }
        if (e.target.closest('[data-checkout]')) WI.track('checkout_start');
        if (e.target.closest('[data-open]')) { WI.drawer.open(e.target.closest('[data-open]').dataset.open); return; }
        if (e.target.closest('[data-close]')) WI.drawer.close();
    });
    document.addEventListener('wi:cart', () => {
        const n = WI.cart.count();
        WI.$$('[data-cart-count]').forEach((el) => { el.textContent = n || ''; el.dataset.n = n; });
        if (WI.$('#wi-drawer-cart')?.classList.contains('is-open')) WI.renderCart();
    });

    // ── Layout común ────────────────────────────────────────────────────────
    const NAV = [
        ['presets', 'Presets', 'mic'], ['plantillas', 'Plantillas', 'sliders'], ['plugins', 'Plugins', 'soundwave'],
        ['servicios', 'Servicios', 'headphones'], ['comunidad', 'Comunidad', 'people'], ['crea-tu-preset', 'Crea tu preset', 'magic']
    ];
    WI.layout = ({ active = '', announce = true, footer = true } = {}) => {
        const n = WI.cart.count();
        const header = `
            ${announce ? '<div class="wi-announce"><b>Pruébalo antes de comprar</b> · Plugins incluidos · Todo en español · Descarga inmediata</div>' : ''}
            <header class="wi-header"><div class="wi-container wi-header__inner">
                <button type="button" class="wi-icon-btn wi-burger" data-open="menu" aria-label="Abrir menú"><i class="bi bi-list"></i></button>
                <a href="${BASE}" class="wi-brand">Willie Inspired</a>
                <nav class="wi-nav" aria-label="Principal">${NAV.map(([k, l]) => `<a href="${BASE}/${k}" class="${active === k ? 'is-active' : ''}">${l}</a>`).join('')}</nav>
                <div class="wi-header__actions">
                    <button type="button" class="wi-icon-btn wi-theme" data-theme-toggle aria-label="Cambiar entre tema claro y oscuro"><i class="bi bi-moon"></i><i class="bi bi-sun"></i></button>
                    <a href="${BASE}/mi-perfil" class="wi-icon-btn" aria-label="Mi perfil"><i class="bi bi-person"></i></a>
                    <button type="button" class="wi-icon-btn" data-open="cart" aria-label="Ver carrito"><i class="bi bi-bag"></i><span class="wi-count" data-cart-count data-n="${n}">${n || ''}</span></button>
                </div>
            </div></header>`;
        const drawers = `
            <div class="wi-backdrop" id="wi-backdrop" data-close></div>
            <aside class="wi-drawer wi-drawer--left" id="wi-drawer-menu" aria-label="Menú">
                <div class="wi-drawer__head"><span class="wi-brand">Willie Inspired</span><button type="button" class="wi-icon-btn" data-close aria-label="Cerrar"><i class="bi bi-x-lg"></i></button></div>
                <div class="wi-drawer__body"><nav class="wi-mnav">
                    ${NAV.map(([k, l, i]) => `<a href="${BASE}/${k}"><i class="bi bi-${i}"></i>${l}</a>`).join('')}
                    <a href="${BASE}/presets/graba-maquetas-con-nativos"><i class="bi bi-gift"></i>Preset gratis</a>
                    <a href="${BASE}/mi-perfil"><i class="bi bi-person"></i>Mi perfil</a>
                </nav></div>
                <div class="wi-drawer__foot wi-stack">
                    <a class="wi-btn wi-btn--whatsapp wi-btn--block" href="${WI.wa()}" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i> Escríbeme por WhatsApp</a>
                    <a class="wi-btn wi-btn--ghost wi-btn--block" href="https://discord.gg/6Barsttcp8" target="_blank" rel="noopener"><i class="bi bi-discord"></i> Discord</a>
                </div>
            </aside>
            <aside class="wi-drawer wi-drawer--right" id="wi-drawer-cart" aria-label="Carrito">
                <div class="wi-drawer__head"><span class="wi-drawer__title"><i class="bi bi-bag"></i> Tu carrito</span><button type="button" class="wi-icon-btn" data-close aria-label="Cerrar"><i class="bi bi-x-lg"></i></button></div>
                <div class="wi-drawer__body" id="wi-cart-body"></div>
                <div class="wi-drawer__foot" id="wi-cart-foot"></div>
            </aside>`;
        const foot = `
            <footer class="wi-footer"><div class="wi-container">
                <div class="wi-footer__grid">
                    <div class="wi-footer__brand">
                        <a href="${BASE}" class="wi-brand">Willie Inspired</a>
                        <p class="wi-muted" style="margin-top:10px;max-width:36ch">Presets, plantillas y plugins para que tu voz grabada en casa suene profesional, sin curva de aprendizaje.</p>
                        <div class="wi-footer__social">
                            <a class="wi-icon-btn" href="https://instagram.com/willieinspired" target="_blank" rel="noopener" aria-label="Instagram"><i class="bi bi-instagram"></i></a>
                            <a class="wi-icon-btn" href="https://tiktok.com/@willieinspired" target="_blank" rel="noopener" aria-label="TikTok"><i class="bi bi-tiktok"></i></a>
                            <a class="wi-icon-btn" href="${WI.wa()}" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="bi bi-whatsapp"></i></a>
                            <a class="wi-icon-btn" href="https://discord.gg/6Barsttcp8" target="_blank" rel="noopener" aria-label="Discord"><i class="bi bi-discord"></i></a>
                        </div>
                    </div>
                    <div><h4>Tienda</h4><ul>
                        <li><a href="${BASE}/presets">Presets</a></li><li><a href="${BASE}/plantillas">Plantillas</a></li>
                        <li><a href="${BASE}/plugins">Plugins</a></li><li><a href="${BASE}/servicios">Servicios</a></li>
                        <li><a href="${BASE}/crea-tu-preset">Crea tu preset</a></li></ul></div>
                    <div><h4>Gratis</h4><ul>
                        <li><a href="${BASE}/presets/graba-maquetas-con-nativos">Preset para maquetas</a></li>
                        <li><a href="${BASE}/plantillas/graba-tus-maquetas">Plantilla para maquetas</a></li>
                        <li><a href="${BASE}/plugins/easy-master#prueba">Prueba Easy Master 3 días</a></li></ul></div>
                    <div><h4>Cuenta</h4><ul>
                        <li><a href="${BASE}/mi-perfil">Mi perfil</a></li><li><a href="${BASE}/mi-perfil/mis-compras">Mis compras</a></li>
                        <li><a href="${BASE}/mi-perfil/ganar-comisiones">Ganar comisiones</a></li><li><a href="${BASE}/comunidad">Comunidad</a></li></ul></div>
                </div>
                <div class="wi-footer__bottom">
                    <span>© ${new Date().getFullYear()} Willie Inspired · Hecho con <a href="/store-builder" style="text-decoration:underline">OFFSZN</a></span>
                    <nav><a href="/legal/politicas-de-privacidad.html">Privacidad</a><a href="/legal/terminos-de-servicio.html">Términos</a><a href="/legal/politicas-de-reembolso.html">Reembolsos</a></nav>
                </div>
            </div></footer>
            <a class="wi-wa" href="${WI.wa()}" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="bi bi-whatsapp"></i></a>`;
        document.body.insertAdjacentHTML('afterbegin', header);
        document.body.insertAdjacentHTML('beforeend', drawers + (footer ? foot : ''));
    };

    // Enlace del correo de carrito abandonado: ?cart=<id> recupera los productos que había dejado.
    WI.restoreCart = async () => {
        const id = WI.params.get('cart');
        if (!id || !/^[0-9a-f-]{36}$/i.test(id) || session.get('wi_cart_restored_' + id)) return;
        session.set('wi_cart_restored_' + id, 1);
        const { ok, data } = await WI.api(`/cart/${id}`, { auth: false });
        if (ok && data.items?.length) {
            const merged = WI.cart.items();
            data.items.forEach((i) => { if (!merged.some((m) => m.id === i.id)) merged.push(i); });
            WI.cart.save(merged);
        }
    };

    // Inicializa la página: layout, región y vista. Devuelve el catálogo.
    WI.init = async (opts = {}) => {
        await WI.restoreCart();
        WI.layout(opts);
        WI.track('page_view');
        await WI.geo();
        return WI.catalog();
    };

    // Formularios de correo reutilizables: <form data-lead="lead_magnet|notify|comunidad" data-product="id">
    WI.bindLeadForms = (root = document) => {
        WI.$$('form[data-lead]', root).forEach((form) => form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = form.querySelector('.wi-form-msg');
            const btn = form.querySelector('button[type="submit"]');
            const fd = new FormData(form);
            btn.disabled = true;
            const kind = form.dataset.lead;
            const { ok, data } = await WI.api('/leads', {
                method: 'POST',
                auth: false,
                body: {
                    email: fd.get('email'), website: fd.get('website'), kind, productId: form.dataset.product,
                    source: form.dataset.source || location.pathname, variant: WI.ab.peek(), utm: WI.utm(), timezone: WI.tz, sessionId: WI.sid, page: location.pathname
                }
            });
            btn.disabled = false;
            if (!ok) { msg.textContent = data.error || 'No pudimos guardarte.'; msg.className = 'wi-form-msg is-error'; return; }
            store.set('wi_email', String(fd.get('email') || '').trim().toLowerCase());
            msg.textContent = kind === 'lead_magnet' ? '¡Listo! Revisa tu correo 🎁' : '¡Listo! Te aviso por correo.';
            msg.className = 'wi-form-msg is-ok';
            if (data.redirect) setTimeout(() => { location.href = data.redirect; }, 700);
        }));
    };

    // Formulario de prueba gratis de plugin (camino "no compro"): <form data-trial="plugin-easy-master">
    WI.bindTrialForms = (root = document) => {
        WI.$$('form[data-trial]', root).forEach((form) => form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = form.querySelector('.wi-form-msg');
            const btn = form.querySelector('button[type="submit"]');
            const fd = new FormData(form);
            btn.disabled = true;
            const { ok, data } = await WI.api('/trials', {
                method: 'POST', auth: false,
                body: { email: fd.get('email'), website: fd.get('website'), productId: form.dataset.trial, timezone: WI.tz, source: location.pathname, sessionId: WI.sid }
            });
            btn.disabled = false;
            msg.textContent = ok ? '¡Listo! Te mandé la licencia de prueba a tu correo.' : (data.error || 'No pudimos crear tu prueba.');
            msg.className = `wi-form-msg ${ok ? 'is-ok' : 'is-error'}`;
        }));
    };

    WI.leadForm = ({ kind = 'lead_magnet', productId, cta = 'Enviármelo gratis', placeholder = 'tucorreo@gmail.com' }) => `
        <form class="wi-inline-form" data-lead="${kind}" data-product="${WI.esc(productId)}" novalidate>
            <input class="wi-input" type="email" name="email" required autocomplete="email" placeholder="${placeholder}" value="${WI.esc(store.get('wi_email') || '')}" aria-label="Tu correo">
            <input class="wi-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
            <button type="submit" class="wi-btn wi-btn--dark">${cta}</button>
            <p class="wi-form-msg" aria-live="polite" style="width:100%"></p>
        </form>`;

    WI.trialForm = (productId = 'plugin-easy-master', cta = 'Probar 3 días gratis') => `
        <form class="wi-inline-form" data-trial="${productId}" novalidate>
            <input class="wi-input" type="email" name="email" required autocomplete="email" placeholder="tucorreo@gmail.com" value="${WI.esc(store.get('wi_email') || '')}" aria-label="Tu correo">
            <input class="wi-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
            <button type="submit" class="wi-btn wi-btn--accent">${cta}</button>
            <p class="wi-form-msg" aria-live="polite" style="width:100%"></p>
        </form>`;
})();
