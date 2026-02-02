/**
 * FAVORITES MANAGER (Enhanced)
 * Handles fetching, toggling (throttled), syncing, and notifications.
 */

window.FavoritesManager = (function () {
    let likedItemIds = new Set();
    let isInitialized = false;
    let subscribers = [];

    // Throttling: Track IDs currently being toggled
    let pendingToggles = new Set();

    // 1. Initialize (with Promise Singleton Pattern)
    let initPromise = null;

    function init() {
        if (isInitialized) return Promise.resolve();
        // 🛡️ SPA SAFEGUARD: Only run active rendering logic if on Favorites Page
        // (However, favorites manager is also used for TOGGLING from other pages, so we must be careful.
        // The `renderFavorites` method handles the specific page logic. `init` sets up global state.)

        // We will NOT block init entirely because 'toggle' needs it globally.
        // We WILL block auto-render if container is missing (already handled in renderFavorites check).

        if (initPromise) return initPromise;

        initPromise = (async () => {
            // ... global init ...

            initPromise = (async () => {
                // Inject Styles for Actions
                if (!document.getElementById('fav-manager-styles')) {
                    const style = document.createElement('style');
                    style.id = 'fav-manager-styles';
                    style.textContent = `
                    .fav-action-btn {
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        background: transparent;
                        border: none;
                        color: #888;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        font-size: 1rem;
                    }
                    .fav-action-btn:hover {
                        background: rgba(255,255,255,0.1);
                        color: #fff;
                    }
                    /* Smooth Removal Animation */
                    .fav-fade-out {
                        opacity: 0;
                        transform: translateX(-20px);
                        max-height: 0;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        overflow: hidden;
                        transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                `;
                    document.head.appendChild(style);

                    // Start Monitoring
                    subscribe(handleRealtimeUpdates);
                }

                let token = getAccessToken();
                if (!token) {
                    console.log("FavoritesManager: No session found, waiting...");
                    return;
                }

                try {
                    // New API endpoint
                    const res = await fetch('/api/me/favorites', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (res.status === 401) {
                        console.warn("FavoritesManager: Session invalid or expired. Continuing as guest.");
                        return;
                    }

                    if (!res.ok) throw new Error('Failed to fetch favorites');

                    const products = await res.json();
                    likedItemIds = new Set(products.map(p => String(p.id)));

                    // Cache full objects for rendering later (optional optimization)
                    cachedFavorites = products;

                    isInitialized = true;
                    console.log("FavoritesManager: Loaded", likedItemIds.size);
                    notifySubscribers();
                } catch (err) {
                    console.error("FavoritesManager: Load Error", err);
                } finally {
                    initPromise = null; // Clear promise so retry is possible on failure (optional)
                }
            })();

            return initPromise;
        }

    // 2. Toggle Like (Throttled)
    async function toggleLike(targetId, buttonElement = null, targetOwnerId = null) {
            const token = getAccessToken();
            if (!token) {
                window.location.href = '/pages/login.html';
                return;
            }

            const idStr = String(targetId);

            // THROTTLING CHECK
            if (pendingToggles.has(idStr)) {
                return;
            }

            pendingToggles.add(idStr); // Lock

            const isLikedOriginal = likedItemIds.has(idStr);

            // Optimistic UI Update
            if (isLikedOriginal) {
                likedItemIds.delete(idStr);
            } else {
                likedItemIds.add(idStr);
            }
            notifySubscribers();

            // Visual Feedback
            if (buttonElement && buttonElement.classList) {
                buttonElement.style.transform = "scale(1.2)";
                setTimeout(() => buttonElement.style.transform = "scale(1)", 200);
            }

            try {
                const res = await fetch(`/api/products/${targetId}/like`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!res.ok) throw new Error('API Error');

                const data = await res.json();

                // Correct state if mismatch (e.g. race condition)
                if (data.liked && !likedItemIds.has(idStr)) {
                    likedItemIds.add(idStr);
                    notifySubscribers();
                } else if (!data.liked && likedItemIds.has(idStr)) {
                    likedItemIds.delete(idStr);
                    notifySubscribers();
                }

            } catch (err) {
                console.error("FavoritesManager: Sync Error", err);
                // Revert on error
                if (isLikedOriginal) likedItemIds.add(idStr);
                else likedItemIds.delete(idStr);
                notifySubscribers();
            } finally {
                setTimeout(() => {
                    pendingToggles.delete(idStr);
                }, 500);
            }
        }

        // Helper: Get Access Token (Internal)
        function getAccessToken() {
            const match = document.cookie.match(/(^| )sb-access-token=([^;]+)/);
            if (match && match[2] && match[2] !== 'undefined' && match[2] !== 'null') {
                return match[2];
            }
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                    try {
                        const session = JSON.parse(localStorage.getItem(key));
                        if (session && session.access_token) return session.access_token;
                    } catch (e) { }
                }
            }
            return null;
        }

        // --- FILTERING STATE ---
        let cachedFavorites = [];
        let currentSearch = '';
        // isRendering removed in favor of renderId ID check
        let activeWavesurfers = [];
        let initTimeout = null; // Debounce timer for WaveSurfer
        window.activeWavesurfers = activeWavesurfers; // EXPOSE FOR SYNC

        // 3. Render Favorites List (Horizontal)
        async function renderFavorites(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;

            // Show Skeletons (Perfectly Aligned)
            container.innerHTML = `
            ${Array(6).fill(0).map(() => `
                <div class="skeleton-fav-row" style="display: flex; align-items: center; gap: 16px; padding: 12px 16px; min-height: 76px;">
                    <!-- Cover (56x56) -->
                    <div class="skeleton" style="width:56px; height:56px; border-radius:8px;"></div>
                    <!-- Info -->
                    <div style="width: 200px; display:flex; flex-direction:column; gap:4px;">
                        <div class="skeleton" style="width:140px; height:14px; border-radius:4px;"></div>
                        <div class="skeleton" style="width:100px; height:10px; border-radius:2px;"></div>
                    </div>
                    <!-- Player/Wave (Flex 1) -->
                    <div style="display:flex; align-items:center; gap:16px; flex:1;">
                        <div class="skeleton" style="width:36px; height:36px; border-radius:50%;"></div>
                        <div class="skeleton-waveform" style="flex:1; height:30px; border-radius:4px;"></div>
                        <div class="skeleton" style="width:40px; height:12px; border-radius:2px;"></div>
                    </div>
                    <!-- Badges -->
                    <div style="display:flex; gap:8px; align-items:center;">
                        <div class="skeleton" style="width:70px; height:20px; border-radius:3px;"></div>
                        <div class="skeleton" style="width:60px; height:20px; border-radius:3px; opacity:0.6;"></div>
                    </div>
                    <!-- Price -->
                    <div style="text-align:center;">
                        <div class="skeleton" style="width:80px; height:32px; border-radius:20px; margin:0 auto;"></div>
                    </div>
                    <!-- Actions -->
                    <div style="display:flex; gap:8px; justify-content:center;">
                        <div class="skeleton" style="width:24px; height:24px; border-radius:50%;"></div>
                        <div class="skeleton" style="width:24px; height:24px; border-radius:50%;"></div>
                        <div class="skeleton" style="width:24px; height:24px; border-radius:50%;"></div>
                    </div>
                </div>
            `).join('')}
        `;

            if (!isInitialized) await init();

            if (likedItemIds.size === 0) {
                renderEmptyState(container);
                return;
            }

            applyFilters(containerId);
        }

        // 4. Client-side Filter (Optimized & Debounced)
        let globalFilterType = 'all';
        let lastRenderId = 0; // For race condition handling

        function setFilterType(type) {
            globalFilterType = type;
            const container = document.getElementById('favorites-grid');
            if (container) applyFilters('favorites-grid');
        }

        async function applyFilters(containerId, collabStats = {}) {
            const container = document.getElementById(containerId);
            if (!container) return;

            // RACE CONDITION HANDLING:
            // Use an ID to track the latest request. If a new request comes in, 
            // older running renders will detect the ID mismatch and stop.
            const thisRenderId = Date.now();
            lastRenderId = thisRenderId;

            if (initTimeout) {
                clearTimeout(initTimeout);
                initTimeout = null;
            }

            try {
                // 1. Filter Logic (Instant)
                // SANITIZATION: Escape special regex chars to prevent errors
                const safeSearch = currentSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const filtered = cachedFavorites.filter(p => {
                    const term = safeSearch.toLowerCase();
                    const matchesSearch = p.name.toLowerCase().includes(term);

                    // TYPE FILTER
                    let matchesType = true;
                    if (globalFilterType !== 'all') {
                        // Concatenate type and category for broad matching
                        const typeBlob = ((p.product_type || '') + ' ' + (p.category || '')).toLowerCase();
                        matchesType = typeBlob.includes(globalFilterType);
                    }

                    return matchesSearch && matchesType;
                });

                // Check cancellation
                if (lastRenderId !== thisRenderId) return;

                // 2. Render Strategy:
                // If we have data, render immediately. No artificial delays.

                if (filtered.length === 0) {
                    if (cachedFavorites.length > 0) {
                        container.innerHTML = '<div style="text-align:center; padding:4rem; color:#666;">No se encontraron resultados para tu búsqueda.</div>';
                    } else {
                        renderEmptyState(container);
                    }
                    return;
                }

                // Cleanup old wavesurfers efficiently
                activeWavesurfers.forEach(ws => { try { ws.destroy(); } catch (e) { } });
                activeWavesurfers = [];
                window.activeWavesurfers = activeWavesurfers;

                container.innerHTML = ''; // Clear previous instantly

                // 3. Batched DOM Insertion (Performance)
                const fragment = document.createDocumentFragment();
                const rowsToInit = [];

                filtered.forEach((prod, index) => {
                    const row = createListRow(prod, index, collabStats);
                    fragment.appendChild(row);
                    rowsToInit.push(row);
                });

                container.appendChild(fragment);

                // Check cancellation after DOM update
                if (lastRenderId !== thisRenderId) return;

                // 4. Initialize WaveSurfers in background (don't block UI)
                // We use a small timeout to let the browser paint the rows first
                setTimeout(() => {
                    if (lastRenderId !== thisRenderId) return;

                    initWaveSurfers((ws) => {
                        // Optional: Do something when each WS is ready
                    }, rowsToInit);
                }, 10);

            } catch (err) {
                console.error("Error applying filters:", err);
            }
        }

        function createListRow(prod, index, collabStats = {}) {
            const row = document.createElement('div');
            row.className = 'list-row';
            row.dataset.productId = prod.id;

            row.style.cssText = `
            display: grid;
            grid-template-columns: 60px 180px 1fr 220px 100px 140px;
            gap: 24px;
            align-items: center;
            padding: 16px 24px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            transition: background 0.2s;
        `;
            row.onmouseover = () => row.style.background = 'rgba(255,255,255,0.02)';
            row.onmouseout = () => row.style.background = 'transparent';

            const waveformId = `fav-waveform-track-${prod.id}-${index}`;
            const user = prod.artist_users || { nickname: 'Unknown' };

            const audioUrl = prod.mp3_url || prod.audio_url || prod.download_url_mp3 || prod.demo_file || prod.tagged_file || prod.preview_url || '';
            const imgUrl = prod.image_url || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

            const createArtistSpan = (name, data, extraClass = '') => {
                const safeData = JSON.stringify(data).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                return `<span class="artist-hover-trigger ${extraClass}" data-artist='${safeData}' onmouseenter="if(window.showArtistCard) window.showArtistCard(event, this)" onmouseleave="if(window.hideArtistCard) window.hideArtistCard(event, this)">${name}</span>`;
            };

            const producerData = {
                id: user.id || prod.user_id,
                nickname: user.nickname,
                avatar_url: user.avatar_url,
                is_verified: user.is_verified,
                stats: {
                    followers: 0 // Will be fetched
                }
            };
            let artistHtml = createArtistSpan(user.nickname, producerData, 'producer-link-thin');

            let collabs = typeof prod.collaborators === 'string' ? JSON.parse(prod.collaborators) : (prod.collaborators || []);
            if (Array.isArray(collabs) && collabs.length > 0) {
                const valid = collabs.filter(c => (c.nickname || c.name) && (c.status === undefined || c.status === 'accepted'));
                if (valid.length > 0) {
                    artistHtml += `<span style="color:#666; margin-right:2px;">, </span>`;
                    artistHtml += valid.slice(0, 2).map(c => {
                        const cName = c.nickname || c.name;
                        const pre = collabStats[cName] || {};
                        const cData = {
                            id: pre.id || '',
                            nickname: cName,
                            avatar_url: pre.avatar_url || c.avatar_url,
                            is_verified: pre.is_verified || false,
                            stats: {
                                followers: pre.followers_count || 0
                            }
                        };
                        return createArtistSpan(cName, cData, 'collaborator-link-thin');
                    }).join(`<span style="color:#666; margin-right:2px;">, </span>`);
                    if (valid.length > 2) artistHtml += `<span style="color:#666;">...</span>`;
                }
            }

            const pType = (prod.product_type || 'beat').toUpperCase();
            let metaBadge = '';
            let badgeContent = '';

            if (pType.includes('BEAT')) {
                let licenseCount = 0;
                const l = prod.licenses || {};
                if (l.basic?.enabled || prod.price_basic > 0) licenseCount++;
                if (l.premium?.enabled || prod.price_premium > 0) licenseCount++;
                if (l.trackout?.enabled || prod.price_stems > 0) licenseCount++;
                if (l.unlimited?.enabled || prod.price_exclusive > 0) licenseCount++;
                const label = licenseCount === 1 ? 'Licencia' : 'Licencias';
                if (licenseCount > 0) badgeContent = `${licenseCount} ${label}`;
            } else {
                const c = prod.sounds_count || 0;
                badgeContent = `${c} ${pType.includes('KIT') ? 'SONIDOS' : (pType.includes('LOOP') ? 'LOOPS' : 'PRESETS')}`;
            }

            const typeBadge = `<span style="border: 1px solid #333; border-radius: 3px; min-width: 70px; padding: 2px 0; font-size: 0.65rem; color: #888; text-transform: uppercase; font-weight: 600; text-align: center; display: inline-block;">${pType}</span>`;
            if (badgeContent) {
                metaBadge = `<span style="border: 1px solid #333; padding: 2px 6px; font-size: 0.65rem; color: #aaa; border-radius: 3px; text-transform: uppercase; font-weight: 600; margin-left: 8px;">${badgeContent}</span>`;
            }

            // GENERATE SEO URL
            const seoUrl = window.createSeoLink ? window.createSeoLink(prod) : '#';

            row.innerHTML = `
            <div class="list-cover">
                <img src="${imgUrl}" onerror="this.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='" alt="cover" style="width:56px; height:56px; object-fit:cover; border-radius:8px; background:#111;">
            </div>
            <div class="list-col-info" style="display:flex; flex-direction:column; justify-content:center;">
                <span class="hover-text" style="color:#fff; font-weight:600; font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer;" onclick="window.location.href='${seoUrl}'">${prod.name}</span>
                <span style="color:#666; font-size:0.75rem; margin-top:2px;">${artistHtml}</span>
            </div>
            <div class="list-col-player" style="display:flex; align-items:center; gap:16px;">
                 <button id="btn-play-${waveformId}" style="width:36px; height:36px; border-radius:50%; background:#222; border:none; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s; flex-shrink:0;">
                    <i class="bi bi-play-fill" style="font-size:1.2rem; margin-left:2px;"></i>
                </button>
                <div class="list-waveform-container" id="${waveformId}" style="height:32px; width:100%; position:relative; flex:1;"></div>
                <div style="font-size:0.8rem; color:#666; font-family:monospace; min-width:40px; text-align:right;">
                    <span id="fav-duration-${waveformId}">--:--</span>
                </div>
            </div>
            <div style="display:flex; align-items:center; white-space:nowrap;">
                 ${typeBadge}${metaBadge}
            </div>
            <div style="text-align:center;">
                <button style="background:#8b5cf6; border:none; color:#fff; font-size:0.8rem; padding:6px 14px; border-radius:20px; cursor:pointer; font-weight:700; min-width:80px;" onclick="window.location.href='${seoUrl}'">
                    ${prod.is_free ? 'FREE' : '$' + (prod.price_basic || '—')}
                </button>
            </div>
            <div style="display:flex; gap:8px; justify-content:center; align-items:center;">
                <button title="Quitar de favoritos" class="fav-action-btn" style="color:#ef4444;" onclick="window.FavoritesManager.toggleLike(${prod.id}, this, '${user.id}')">
                    <i class="bi bi-heart-fill"></i>
                </button>
                <button title="Descargar" class="fav-action-btn" onclick="window.location.href='${seoUrl}'">
                    <i class="bi bi-download"></i>
                </button>
                 <button class="fav-action-btn">
                    <i class="bi bi-three-dots"></i>
                </button>
            </div>
        `;

            row.dataset.audioUrl = audioUrl;
            row.dataset.waveformId = waveformId;
            row.dataset.productId = prod.id;
            row.dataset.trackData = JSON.stringify(prod);
            return row;
        }

        function initWaveSurfers(onCreated = null, manualRows = null) {
            if (!window.WaveSurfer) return;

            const targetRows = manualRows || document.querySelectorAll('.list-row');

            targetRows.forEach(row => {
                const url = row.dataset.audioUrl;
                const id = row.dataset.waveformId;
                if (url && id) {
                    // Double check element existence (handled by querySelectorAll but redundant for manualRows if valid)
                    const containerEl = document.getElementById(id);
                    if (!containerEl) return;

                    const ws = WaveSurfer.create({
                        container: containerEl,
                        waveColor: '#666',
                        progressColor: '#8b5cf6',
                        barWidth: 2,
                        barGap: 2,
                        barRadius: 2,
                        height: 28,
                        url: url,
                        normalize: true,
                        interact: true
                    });

                    // TIMEOUT FALLBACK
                    setTimeout(() => {
                        const el = document.getElementById(id);
                        if (el && el.classList.contains('skeleton-waveform')) {
                            el.classList.remove('skeleton-waveform');
                            el.classList.add('waveform-static-fallback');
                        }
                    }, 4000);

                    // ERROR FALLBACK
                    ws.on('error', (err) => {
                        // SILENCE ABORT ERRORS (Happens on rapid tab switching)
                        if (err.name === 'AbortError' || (err.message && err.message.includes('aborted'))) return;

                        console.warn(`Favorites WaveSurfer error for ${id}:`, err);
                        const el = document.getElementById(id);
                        if (el) {
                            el.classList.remove('skeleton-waveform');
                            el.classList.add('waveform-static-fallback');
                        }
                    });
                    const prodId = row.dataset.productId;
                    ws.customId = id; // id is the container ID (waveformId)

                    if (onCreated) onCreated(ws);

                    ws.on('ready', () => {
                        const dur = ws.getDuration();
                        const mins = Math.floor(dur / 60);
                        const secs = Math.floor(dur % 60);
                        const el = document.getElementById(`fav-duration-${id}`);
                        if (el) el.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                    });
                    ws.on('finish', () => {
                        const btn = document.getElementById(`btn-play-${id}`);
                        if (btn) btn.innerHTML = '<i class="bi bi-play-fill"></i>';
                    });

                    // Bidirectional Sync: Seek Global Player when clicking list waveform
                    ws.on('interaction', () => {
                        const prodId = row.dataset.productId;
                        if (window.StickyPlayer && window.StickyPlayer.getCurrentTrackId() == prodId) {
                            window.StickyPlayer.togglePlay();
                            window.StickyPlayer.seekTo(ws.getCurrentTime());
                        } else if (window.StickyPlayer) {
                            const product = cachedFavorites.find(p => String(p.id) === String(prodId));
                            window.StickyPlayer.play(product);
                            setTimeout(() => window.StickyPlayer.seekTo(ws.getCurrentTime()), 100);
                        }
                    });
                    const btn = document.getElementById(`btn-play-${id}`);
                    if (btn) {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            const prodId = row.dataset.productId;
                            const product = cachedFavorites.find(p => String(p.id) === String(prodId));
                            if (window.StickyPlayer) {
                                const currentId = window.StickyPlayer.getCurrentTrackId();
                                if (currentId == prodId) {
                                    window.StickyPlayer.togglePlay();
                                } else {
                                    window.StickyPlayer.updatePlaylist(cachedFavorites, 'favorites');
                                    window.StickyPlayer.play(product);
                                }
                            } else ws.playPause();
                        };
                    }
                    activeWavesurfers.push(ws);
                }
            });
        }

        function setSearch(query) {
            currentSearch = query;
            const container = document.querySelector('.products-grid');
            if (container && container.id) applyFilters(container.id);
            else if (cachedFavorites.length > 0) renderFavorites('favorites-grid');
        }

        function isLiked(id) { return likedItemIds.has(String(id)); }
        function subscribe(cb) { subscribers.push(cb); cb(likedItemIds); }
        function notifySubscribers() { subscribers.forEach(cb => cb(likedItemIds)); }

        // --- REALTIME SYNC & ANIMATION ---
        function handleRealtimeUpdates(currentIds) {
            // Find all rendered favorites in the DOM
            const rows = document.querySelectorAll('.list-row[data-product-id]');
            rows.forEach(row => {
                const id = row.dataset.productId;

                // If the item is on screen BUT no longer in our favorite list -> REMOVE IT
                if (!currentIds.has(String(id))) {
                    // Check if already animating to avoid double-trigger
                    if (row.classList.contains('fav-fade-out')) return;

                    // 1. Animate
                    row.classList.add('fav-fade-out');

                    // 2. Remove from DOM after animation
                    setTimeout(() => {
                        row.remove();
                        checkEmptyState();
                    }, 500); // Match CSS transition time
                }
            });
        }

        function checkEmptyState() {
            const container = document.getElementById('favorites-grid');
            if (container) {
                // Check if any visible rows remain
                const visibleRows = container.querySelectorAll('.list-row:not(.fav-fade-out)');
                if (visibleRows.length === 0) {
                    renderEmptyState(container);
                }
            }
        }

        function renderEmptyState(container) {
            container.innerHTML = `
            <div style="text-align:center; padding: 6rem 2rem; animation: fadeIn 0.4s ease;">
                <div style="margin-bottom: 24px; opacity: 0.15;">
                    <i class="bi bi-disc" style="font-size: 4rem; color: #fff;"></i>
                </div>
                <h3 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 16px; letter-spacing: -0.5px; color: #fff;">Tu colección está vacía</h3>
                <p style="color: #888; font-size: 0.95rem; margin-bottom: 32px; max-width: 420px; margin-left: auto; margin-right: auto; line-height: 1.6;">
                    Aún no has guardado nada. Explora el mercado y guarda los beats que definan tu próximo sonido.
                </p>
                <a href="explorar.html" class="btn-primary-glow" style="padding: 14px 36px; border-radius: 100px; font-weight: 600; text-decoration: none; font-size: 0.9rem; display: inline-block; background: #fff; color: #000; transition: transform 0.2s, box-shadow 0.2s;">
                    Explorar el Mercado
                </a>
            </div>
        `;
        }

        return { init, toggleLike, isLiked, subscribe, renderFavorites, setSearch, setFilterType };
    }) ();

    // --- REFINED INITIALIZATION ---
    document.addEventListener('DOMContentLoaded', () => {
        window.addEventListener('offszn-session-ready', (e) => {
            if (e.detail.session) window.FavoritesManager.init();
        });
        if (window.supabaseClient) window.FavoritesManager.init();
    });
