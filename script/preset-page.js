/* OFFSZN · página de preset (v2)
   - Reproductor con antes/después (RAW / PRESET) SINCRONIZADO: dos audios corren a la vez y el botón solo cambia cuál se escucha,
     así el cambio no corta ni pierde el segundo. Si el preset tiene un solo audio, no se muestra el selector (no se finge un antes/después).
   - Compra con el mismo flujo de siempre (CartManager → /pages/checkout.html). */
(function () {
    'use strict';

    const $ = (s, r = document) => r.querySelector(s);
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const PREVIEW = new URLSearchParams(location.search).get('v') === '2' ? '?v=2' : '';
    const PRODUCER_FIELDS = 'id, nickname, first_name, last_name, avatar_url, bio, role, is_producer, is_verified, banner_url, license_settings, has_paypal, has_yape';
    const fmtTime = (s) => { if (!Number.isFinite(s) || s < 0) return '0:00'; const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
    const waitFor = (fn, ms = 4000) => new Promise((res) => { const t0 = Date.now(); (function tick() { const v = fn(); if (v) return res(v); if (Date.now() - t0 > ms) return res(null); setTimeout(tick, 80); })(); });

    let toastTimer;
    const toast = (msg) => {
        const t = $('#toast'); t.textContent = msg; t.classList.add('on');
        clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3600);
    };

    // ── Nombre en grande ───────────────────────────────────────────────────────────
    // "PRESET DE REMERS" → "suena como" + REMERS. Si el nombre no sigue ese patrón, se muestra tal cual.
    function splitName(raw) {
        let n = String(raw || '').trim();
        let kicker = '';
        const m = n.match(/^(vocal preset|preset|plantilla)(\s+de\s+grabaci[oó]n)?(?:\s+de)?\s*[-–:]?\s*(.+)$/i);
        if (m) {
            kicker = /^plantilla/i.test(m[1]) ? (m[2] ? 'plantilla de grabación de' : 'plantilla de') : 'suena como';
            n = m[3];
        }
        n = n.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim();
        return { kicker, title: (n || String(raw || '')).toUpperCase() };
    }

    function fitTitle() {
        const el = $('#title'); const box = el.parentElement;
        el.style.fontSize = '';
        if (window.matchMedia('(max-width: 860px)').matches) { // en celular el título se parte en líneas, sin cortar palabras
            const longest = Math.max(...el.textContent.split(/\s+/).map((w) => w.length), 1);
            el.style.fontSize = `${Math.max(34, Math.min(84, Math.floor(box.clientWidth / (longest * 0.68))))}px`;
            return;
        }
        let size = parseFloat(getComputedStyle(el).fontSize);
        let guard = 0;
        while (el.scrollWidth > box.clientWidth + 1 && size > 34 && guard++ < 60) { size *= 0.94; el.style.fontSize = `${size}px`; }
    }

    // DAWs: solo los que el producto menciona de verdad (etiquetas, nombre o descripción). Nada inventado.
    function detectDaws(p) {
        const hay = `${(p.tags || []).join(' ')} ${p.name || ''} ${p.description || ''}`.toLowerCase();
        const out = [];
        if (/fl\s*studio|\bfl\b/.test(hay)) out.push('FL Studio');
        if (/ableton|\blive\b/.test(hay)) out.push('Ableton Live');
        if (/logic/.test(hay)) out.push('Logic Pro');
        if (/pro\s*tools|protools/.test(hay)) out.push('Pro Tools');
        if (/bandlab/.test(hay)) out.push('BandLab');
        if (/reaper/.test(hay)) out.push('Reaper');
        if (/cubase/.test(hay)) out.push('Cubase');
        if (/studio\s*one/.test(hay)) out.push('Studio One');
        if (/\ball\s*daws?\b|todos los daws|cualquier daw|\bdaws\b|y m[aá]s daws?/.test(hay)) out.push('Cualquier DAW');
        return [...new Set(out)];
    }

    // ── Medios ─────────────────────────────────────────────────────────────────────
    const hasVal = (v) => !!v && v !== 'null' && v !== 'undefined';
    let STORE = false; // preset de la tienda de Willie: archivos propios (rutas del sitio) y compra por /willieinspired/checkout
    async function mediaUrl(raw, version, productId) {
        if (!hasVal(raw)) return null;
        if (STORE && /^(\/|https?:)/.test(raw)) return raw;
        const u = window.AuthUtils && window.AuthUtils.resolvePreviewMediaUrl ? window.AuthUtils.resolvePreviewMediaUrl(raw, version) : null;
        if (u) return u;
        try { return await window.AuthUtils.getAuthorizedUrl(raw, version, productId); } catch (_) { return null; }
    }

    // ── Estado ─────────────────────────────────────────────────────────────────────
    const S = { p: null, mode: 'pre', playing: false, dur: 0, progress: 0, raw: null, pre: null, hasAB: false, peaksRaw: null, playedOnce: false, raf: 0 };

    // ── Onda ───────────────────────────────────────────────────────────────────────
    const canvas = $('#waveCanvas'); const ctx = canvas.getContext('2d');
    const pseudoPeaks = (seed) => { // forma estable cuando no se puede leer el audio
        let x = (Number(seed) || 7) * 9301 + 49297; const out = [];
        for (let i = 0; i < 400; i++) { x = (x * 9301 + 49297) % 233280; const r = x / 233280; out.push(0.25 + 0.65 * Math.abs(Math.sin(i / 11) * 0.6 + r * 0.4)); }
        return out;
    };
    async function computePeaks(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('http');
            if (Number(res.headers.get('content-length')) > 25e6) throw new Error('grande');
            const buf = await res.arrayBuffer();
            const AC = window.AudioContext || window.webkitAudioContext;
            const ac = new AC();
            const audio = await ac.decodeAudioData(buf.slice(0));
            if (ac.close) ac.close();
            const data = audio.getChannelData(0); const N = 400; const step = Math.max(1, Math.floor(data.length / N));
            const out = []; let max = 0;
            for (let i = 0; i < N; i++) {
                let m = 0; const from = i * step; const to = Math.min(data.length, from + step); const stride = Math.max(1, Math.floor((to - from) / 40));
                for (let j = from; j < to; j += stride) { const v = Math.abs(data[j]); if (v > m) m = v; }
                out.push(m); if (m > max) max = m;
            }
            return max > 0 ? out.map((v) => Math.sqrt(v / max)) : null;
        } catch (_) { return null; }
    }
    function resizeWave() {
        const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.max(1, Math.floor(r.width * dpr)); canvas.height = Math.max(1, Math.floor(r.height * dpr));
        drawWave();
    }
    function drawWave() {
        const w = canvas.width, h = canvas.height; if (!w || !h) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        ctx.clearRect(0, 0, w, h);
        const peaks = S.peaksRaw || pseudoPeaks(S.p && S.p.id);
        const bar = 3 * dpr; const gap = 2 * dpr; const n = Math.max(24, Math.floor(w / (bar + gap)));
        for (let i = 0; i < n; i++) {
            const a = Math.floor((i / n) * peaks.length); const b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length));
            let v = 0; for (let k = a; k < b; k++) v = Math.max(v, peaks[k] || 0);
            const bh = Math.max(4 * dpr, v * h * 0.92); const x = i * (bar + gap); const y = (h - bh) / 2;
            ctx.fillStyle = (i + 0.5) / n <= S.progress ? '#ffffff' : 'rgba(255,255,255,.34)';
            ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, bar, bh, bar / 2) : ctx.rect(x, y, bar, bh); ctx.fill();
        }
    }

    // ── Reproductor ────────────────────────────────────────────────────────────────
    const player = $('#player');
    const applyMute = () => { if (S.pre) S.pre.muted = S.hasAB && S.mode === 'raw'; if (S.raw) S.raw.muted = S.mode !== 'raw'; };
    const duration = () => { const d = S.pre && S.pre.duration; return Number.isFinite(d) && d > 0 ? d : 0; };
    function paint() {
        const d = duration(); const t = S.pre ? S.pre.currentTime : 0;
        S.dur = d; S.progress = d ? Math.min(1, t / d) : 0;
        $('#tCur').textContent = fmtTime(t); $('#tDur').textContent = fmtTime(d);
        $('#wave').setAttribute('aria-valuenow', String(Math.round(S.progress * 100)));
        if (S.raw && Math.abs(S.raw.currentTime - t) > 0.15) S.raw.currentTime = t; // el antes y el después nunca se desfasan
        drawWave();
    }
    function loop() { paint(); if (S.playing) S.raf = requestAnimationFrame(loop); }
    function setPlaying(v) {
        S.playing = v; player.classList.toggle('is-playing', v);
        $('#play').setAttribute('aria-label', v ? 'Pausar' : 'Reproducir');
        cancelAnimationFrame(S.raf); if (v) loop(); else paint();
    }
    async function play() {
        if (!S.pre) return;
        try {
            applyMute();
            if (S.raw) S.raw.currentTime = S.pre.currentTime;
            await Promise.all([S.pre.play(), S.raw ? S.raw.play() : null]);
            setPlaying(true);
            if (!S.playedOnce) { S.playedOnce = true; if (!STORE) fetch(`/api/products/${S.p.id}/play`, { method: 'POST' }).catch(() => {}); }
        } catch (_) { setPlaying(false); toast('No se pudo reproducir el audio. Prueba de nuevo.'); }
    }
    function pause() { if (S.pre) S.pre.pause(); if (S.raw) S.raw.pause(); setPlaying(false); }
    function seek(ratio) {
        const d = duration(); if (!d) return;
        const t = Math.max(0, Math.min(d, ratio * d));
        S.pre.currentTime = t; if (S.raw) S.raw.currentTime = t; paint();
    }
    function setMode(mode) {
        if (mode === 'raw' && !S.hasAB) return;
        S.mode = mode; applyMute();
        document.querySelectorAll('#seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    }

    async function initPlayer(p) {
        const ver = p.storage_version || p.r2_version;
        const preRaw = hasVal(p.audio_after_url) ? p.audio_after_url : (hasVal(p.audio_before_url) ? p.audio_before_url : null);
        const rawRaw = hasVal(p.audio_before_url) ? p.audio_before_url : null;
        const preUrl = await mediaUrl(preRaw, ver, p.id);
        if (!preUrl) { const m = $('#waveMsg'); m.hidden = false; m.textContent = 'Este preset aún no tiene audio de muestra.'; $('#abLabel').textContent = 'Sin audio de muestra'; return; }

        // Antes/después real: solo si hay dos archivos distintos. Con un solo archivo repetido no se finge una comparación.
        S.hasAB = !!(rawRaw && preRaw && rawRaw !== preRaw);
        S.pre = new Audio(); S.pre.preload = 'auto'; S.pre.src = preUrl;
        if (S.hasAB) {
            const rawUrl = await mediaUrl(rawRaw, ver, p.id);
            if (rawUrl) { S.raw = new Audio(); S.raw.preload = 'auto'; S.raw.src = rawUrl; } else S.hasAB = false;
        }
        player.classList.toggle('has-ab', S.hasAB);
        $('#abLabel').textContent = S.hasAB ? 'Compara el antes y el después' : 'Escucha el preset';
        setMode('pre');

        S.pre.addEventListener('loadedmetadata', paint);
        S.pre.addEventListener('ended', () => { setPlaying(false); S.pre.currentTime = 0; if (S.raw) S.raw.currentTime = 0; paint(); });
        S.pre.addEventListener('error', () => { const m = $('#waveMsg'); m.hidden = false; m.textContent = 'No se pudo cargar el audio.'; $('#play').disabled = true; });
        $('#play').disabled = false;
        $('#play').onclick = () => (S.playing ? pause() : play());
        document.querySelectorAll('#seg button').forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });

        // Arrastrar o tocar la onda para moverse en el audio
        const wave = $('#wave'); let drag = false;
        const ratioOf = (e) => { const r = wave.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); };
        wave.addEventListener('pointerdown', (e) => { drag = true; wave.setPointerCapture(e.pointerId); seek(ratioOf(e)); });
        wave.addEventListener('pointermove', (e) => { if (drag) seek(ratioOf(e)); });
        wave.addEventListener('pointerup', () => { drag = false; });
        wave.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); const d = duration(); if (d) seek((S.pre.currentTime + (e.key === 'ArrowRight' ? 5 : -5)) / d); }
        });

        computePeaks(preUrl).then((pk) => { S.peaksRaw = pk; drawWave(); });
    }

    // ── Datos del producto ─────────────────────────────────────────────────────────
    function render(p) {
        const { kicker, title } = splitName(p.name);
        document.title = `${p.name} | OFFSZN`;
        $('#kicker').textContent = kicker; $('#title').textContent = title;
        const daws = detectDaws(p);
        $('#sub').textContent = /plantilla/i.test(p.name) ? 'lista para abrir y usar en tu DAW' : '& todo listo dentro del proyecto…';
        $('#daws').innerHTML = daws.map((d) => `<span class="daw">${esc(d)}</span>`).join('');
        $('#desc').textContent = (p.description || '').trim() || 'Preset listo para usar.';
        $('#tags').innerHTML = (p.tags || []).filter(Boolean).slice(0, 8).map((t) => `<span>${esc(t)}</span>`).join('');
        fitTitle();

        const price = parseFloat(p.price_basic) || 0;
        const free = !!p.is_free && price === 0;
        $('#price').textContent = free ? 'Gratis' : (window.CurrencyManager && window.CurrencyManager.format ? window.CurrencyManager.format(price) : `$${price.toFixed(2)}`);
        $('#ctaText').textContent = free ? 'Descargar gratis' : 'Obtener el preset';
        if (STORE) storePrice(p);

        mediaUrl(p.image_url, p.storage_version || p.r2_version, p.id).then((u) => {
            const img = $('#coverImg'); const frame = $('#coverFrame');
            if (!u) { frame.classList.remove('skeleton'); return; }
            img.onload = () => { img.hidden = false; frame.classList.remove('skeleton'); };
            img.onerror = () => frame.classList.remove('skeleton');
            img.src = u; img.alt = p.name;
        });

        if (!STORE) { try { const k = `offszn_pv_${p.id}`; if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); fetch(`/api/products/${p.id}/view`, { method: 'POST' }).catch(() => {}); } } catch (_) { /* modo privado */ } }
    }

    // ── Tienda de Willie: el precio y el descuento por cantidad los pone el servidor (el navegador solo los muestra) ──
    const money = (amount, cur) => (cur && cur !== 'USD' ? `${cur === 'PEN' ? 'S/' : cur} ${amount}` : `US$${amount}`);
    async function storePrice(p) {
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const res = await fetch('/api/store/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: p.id }], timezone: tz }) });
            const q = await res.json();
            if (q && q.local) $('#price').textContent = money(q.local.amount, q.local.currency);
            const v = $('#vol'); v.hidden = false;
            v.innerHTML = 'Lleva más y ahorra: <b>2 presets −10%</b> · <b>3 −20%</b> · <b>4 o más −25%</b>';
        } catch (_) { /* se queda el precio de lista */ }
    }
    const WI_CART_KEY = 'wi_cart';
    function addToStoreCart(id) {
        let items = []; try { items = JSON.parse(localStorage.getItem(WI_CART_KEY) || '[]').filter((i) => i && i.id); } catch (_) { items = []; }
        if (!items.some((i) => i.id === id)) items.push({ id, os: null });
        try { localStorage.setItem(WI_CART_KEY, JSON.stringify(items)); } catch (_) { /* modo privado: el checkout empezará vacío */ }
    }

    // ── Compra (mismo flujo que la página actual) ──────────────────────────────────
    async function fullProduct() {
        const sb = window.supabaseClient; if (!sb) throw new Error('Sin conexión con la tienda.');
        const { data, error } = await sb.from('products').select(`*, producer:producer_id (${PRODUCER_FIELDS})`).eq('id', S.p.id).neq('status', 'deleted').maybeSingle();
        if (error || !data) throw new Error('No se pudo cargar el producto.');
        return data;
    }
    async function buy() {
        const product = await fullProduct();
        let producer = product.producer; if (Array.isArray(producer)) producer = producer[0];
        if (producer) { // el productor debe poder cobrar (tu cuenta y la plataforma siempre pueden)
            const owner = producer.id === '0382a813-85c7-46c3-8d2c-61a5692adffd' || (producer.nickname && producer.nickname.toLowerCase() === 'willieinspired');
            if (!owner && !producer.has_paypal && !producer.has_yape && (producer.has_paypal !== undefined || producer.has_yape !== undefined)) {
                if (window.openBlockedPaymentModal) window.openBlockedPaymentModal(producer, product); else toast('Este productor aún no tiene métodos de pago configurados.');
                return;
            }
        }
        const price = parseFloat(product.price_basic) || 0;
        const checkProduct = { ...product, price_basic: price, license: { id: 'basic', name: 'Preset', price, details: {} } };
        const cart = await waitFor(() => window.CartManager);
        if (!cart) throw new Error('El carrito no está disponible. Recarga la página.');
        await cart.addToCart(checkProduct, { silent: true });
        if (!(cart.state && cart.state.user)) { // para comprar y conservar los archivos se necesita cuenta
            location.href = '/pages/login.html?redirect=' + encodeURIComponent('/pages/checkout.html');
            return;
        }
        location.href = '/pages/checkout.html';
    }
    async function download() {
        const product = await fullProduct();
        let producer = product.producer; if (Array.isArray(producer)) producer = producer[0];
        const url = product.kit_url || product.download_url_wav || product.download_url_stems || product.wav_url || product.stems_url || product.audio_url;
        if (window.openDownloadGateModal) window.openDownloadGateModal(url, producer && producer.nickname, product.id);
        else if (url) window.open(url, '_blank');
    }
    $('#cta').onclick = async () => {
        if (STORE) { addToStoreCart(S.p.id); openCart(); return; }
        const btn = $('#cta'); btn.disabled = true;
        try { const price = parseFloat(S.p.price_basic) || 0; await (S.p.is_free && price === 0 ? download() : buy()); }
        catch (e) { toast(e.message || 'No se pudo continuar.'); }
        finally { btn.disabled = false; }
    };

    // ── Carrusel de presets ────────────────────────────────────────────────────────
    let list = []; let idx = -1;
    const SHORT_ROUTE = location.pathname.startsWith('/presets/');
    const href = (p) => SHORT_ROUTE
        ? `/presets/${encodeURIComponent(p.public_slug.replace(/^preset-de-/, ''))}`
        : `/preset/${encodeURIComponent(p.public_slug)}${PREVIEW}`;
    async function loadStoreRail(p) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await fetch(`/api/store/catalog?tz=${encodeURIComponent(tz)}`); const cat = await res.json();
        list = (cat.products || []).filter((x) => x.category === 'presets' && x.subcategory === 'artistas' && x.status === 'active' && ((x.media && x.media.cover) || x.id === p.id))
            .map((x) => ({ id: x.id, name: `Preset de ${x.artist}`, public_slug: x.slug, image_url: x.id === p.id ? (p.image_url || (x.media && x.media.cover)) : x.media.cover }));
        idx = list.findIndex((x) => x.id === p.id);
        if (list.length < 2 || idx < 0) return;
        const track = $('#railTrack');
        track.innerHTML = list.map((x, i) => `<a class="rail__item ${i === idx ? 'on' : ''}" href="${esc(href(x))}" aria-label="${esc(x.name)}"${i === idx ? ' aria-current="page"' : ''}><img alt="" loading="lazy" width="96" height="96"${/^(\/|https?:)/.test(x.image_url || '') ? ` src="${esc(x.image_url)}"` : ''}><span>${esc(splitName(x.name).title.toLowerCase())}</span></a>`).join('');
        $('#rail').hidden = false; $('#hint').hidden = false;
        const cur = track.children[idx]; if (cur && cur.scrollIntoView) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
        $('#railPrev').onclick = () => go(-1); $('#railNext').onclick = () => go(1);
    }
    async function loadRail(p) {
        if (STORE) return loadStoreRail(p);
        const sb = window.supabaseClient; if (!sb) return;
        const { data } = await sb.from('products').select('id, name, public_slug, image_url, storage_version, r2_version, sales_count')
            .eq('product_type', 'preset').eq('status', 'approved').eq('visibility', 'public').not('public_slug', 'is', null)
            .order('sales_count', { ascending: false, nullsFirst: false }).limit(24);
        list = (data || []).filter((x) => x.public_slug);
        if (!list.some((x) => x.id === p.id) && p.public_slug) list.unshift({ id: p.id, name: p.name, public_slug: p.public_slug, image_url: p.image_url, storage_version: p.storage_version, r2_version: p.r2_version });
        if (list.length < 2) return;
        idx = list.findIndex((x) => x.id === p.id);
        const track = $('#railTrack');
        track.innerHTML = list.map((x, i) => `<a class="rail__item ${i === idx ? 'on' : ''}" href="${esc(href(x))}" data-i="${i}" aria-label="${esc(x.name)}"${i === idx ? ' aria-current="page"' : ''}><img alt="" loading="lazy" width="96" height="96"><span>${esc(splitName(x.name).title.toLowerCase())}</span></a>`).join('');
        $('#rail').hidden = false; $('#hint').hidden = false;
        list.forEach((x, i) => mediaUrl(x.image_url, x.storage_version || x.r2_version, x.id).then((u) => { const im = track.children[i] && track.children[i].querySelector('img'); if (im && u) im.src = u; }));
        const cur = track.children[idx]; if (cur && cur.scrollIntoView) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
        $('#railPrev').onclick = () => go(-1); $('#railNext').onclick = () => go(1);
    }
    function go(step) {
        if (idx < 0 || list.length < 2) return;
        const next = list[(idx + step + list.length) % list.length];
        location.href = href(next);
    }
    document.addEventListener('keydown', (e) => {
        if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
        if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === 'ArrowRight') go(1);
        else if (e.code === 'Space' && S.pre && e.target === document.body) { e.preventDefault(); S.playing ? pause() : play(); }
    });

    // ── Carrito lateral (comparte los productos con el de la landing: mismo wi_cart) ──
    const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let catCache = null; let cartSeq = 0;
    const cartIds = () => { try { return JSON.parse(localStorage.getItem(WI_CART_KEY) || '[]').filter((i) => i && i.id); } catch (_) { return []; } };
    const saveCartIds = (items) => { try { localStorage.setItem(WI_CART_KEY, JSON.stringify(items)); } catch (_) { /* modo privado */ } };
    const storeOffer = () => { try { return JSON.parse(localStorage.getItem('wi_offer') || 'null'); } catch (_) { return null; } };
    const storeCatalog = async () => { if (!catCache) catCache = await (await fetch(`/api/store/catalog?tz=${encodeURIComponent(TZ)}`)).json(); return catCache; };
    function updateCount() { const n = cartIds().length; const b = $('#cartCount'); b.textContent = n; b.hidden = !n; }
    function openCart() { $('#cart').classList.add('on'); $('#cart').setAttribute('aria-hidden', 'false'); $('#cartBackdrop').hidden = false; renderCart(); }
    function closeCart() { $('#cart').classList.remove('on'); $('#cart').setAttribute('aria-hidden', 'true'); $('#cartBackdrop').hidden = true; }
    async function renderCart() {
        updateCount();
        const items = cartIds(); const body = $('#cartBody'); const foot = $('#cartFoot');
        if (!items.length) { body.innerHTML = '<div class="cart__empty">Tu carrito está vacío.<br><a href="/willieinspired/presets">Ver presets</a></div>'; foot.innerHTML = ''; return; }
        const seq = ++cartSeq;
        try {
            const [cat, q] = await Promise.all([storeCatalog(), fetch('/api/store/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, offer: storeOffer(), timezone: TZ }) }).then((r) => r.json())]);
            if (seq !== cartSeq) return;
            const byId = new Map((cat.products || []).map((x) => [x.id, x]));
            body.innerHTML = items.map((it) => {
                const x = byId.get(it.id); if (!x) return '';
                const pr = x.pricing && x.pricing.local ? money(x.pricing.local.amount, x.pricing.local.currency) : '';
                const cover = x.media && x.media.cover ? `<img src="${esc(x.media.cover)}" alt="" width="56" height="56">` : '<img alt="" width="56" height="56">';
                return `<div class="cart__line">${cover}<div><b>${esc(x.title)}</b><small>${esc(x.format || 'Preset')}</small></div><div>${esc(pr)}<button type="button" class="rm" data-rm="${esc(x.id)}">Quitar</button></div></div>`;
            }).join('');
            // Descuento por cantidad: lo calcula el servidor; aquí solo se muestra el avance
            const v = q.volume || { count: 0, percent: 0, next: null };
            const tiers = [[2, 10], [3, 20], [4, 25]];
            const msg = v.next ? `Agrega <b>${v.next.add} más</b> y ahorras <b>${v.next.percent}%</b>.` : '<b>¡Máximo descuento aplicado!</b>';
            const head = q.offerApplied && q.offerApplied.type === 'volume' ? `<b>−${v.percent}% por llevar ${v.count} presets.</b> ` : '';
            const tier = (v.count > 0 || v.next) && !(q.offerApplied && q.offerApplied.type !== 'volume')
                ? `<div class="cart__tier">${head}${msg}<div class="cart__bar"><i style="width:${Math.min(100, (Math.min(v.count, 4) / 4) * 100)}%"></i></div><div class="cart__steps">${tiers.map(([n, p]) => `<span class="${v.count >= n ? 'ok' : ''}">${n === 4 ? '4+' : n} · −${p}%</span>`).join('')}</div></div>` : '';
            body.insertAdjacentHTML('afterbegin', tier);
            const pe = q.local && q.local.currency !== 'USD';
            foot.innerHTML = `${q.discountUsd > 0 && !pe ? `<div class="cart__row"><span>Subtotal</span><span>US$${q.subtotalUsd}</span></div><div class="cart__row save"><span>Ahorras</span><span>−US$${q.discountUsd}</span></div>` : ''}
                ${q.discountUsd > 0 && pe ? `<div class="cart__row save"><span>Descuento</span><span>${q.offerApplied && q.offerApplied.percent ? `−${q.offerApplied.percent}%` : `−US$${q.discountUsd}`}</span></div>` : ''}
                <div class="cart__row total"><span>Total</span><span>${esc(q.local ? money(q.local.amount, q.local.currency) : `US$${q.totalUsd}`)}</span></div>
                <a class="cart__pay" href="/willieinspired/checkout">Ir a pagar →</a>
                <p class="cart__note">Entrega inmediata · Pago seguro</p>`;
        } catch (_) { body.innerHTML = '<div class="cart__empty">No pude cargar el carrito. Intenta de nuevo.</div>'; }
    }
    $('#cartBtn').onclick = openCart; $('#cartClose').onclick = closeCart; $('#cartBackdrop').onclick = closeCart;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });
    $('#cartBody').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (!b) return; saveCartIds(cartIds().filter((i) => i.id !== b.dataset.rm)); renderCart(); });
    window.addEventListener('storage', (e) => { if (e.key === WI_CART_KEY) renderCart(); });
    updateCount();

    // ── Arranque ───────────────────────────────────────────────────────────────────
    async function loadProduct() {
        try { const inline = JSON.parse($('#presetData').textContent); if (inline && inline.id) return inline; } catch (_) { /* abierto sin servidor: se busca por el slug */ }
        const sb = await waitFor(() => window.supabaseClient);
        if (!sb) return null;
        const slug = new URLSearchParams(location.search).get('slug') || decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
        const { data } = await sb.from('products').select('id, name, public_slug, price_basic, is_free, image_url, audio_before_url, audio_after_url, storage_version, r2_version, tags, description, product_type, sales_count').eq('public_slug', slug).neq('status', 'deleted').maybeSingle();
        return data && data.id ? data : null;
    }
    (async function init() {
        window.addEventListener('resize', () => { resizeWave(); fitTitle(); });
        const p = await loadProduct();
        if (!p) { location.replace('/explorar.html'); return; }
        STORE = !!p.store;
        S.p = p; render(p); resizeWave();
        initPlayer(p).catch(() => {});
        loadRail(p).catch((e) => console.warn('[preset] carrusel:', e));
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTitle);
    })();
})();
