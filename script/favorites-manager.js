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
        // But allow initialization for toggle functionality

        if (initPromise) return initPromise;

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

            let token = window.getAccessToken();
            if (!token) {
                console.log("FavoritesManager: No session found, waiting...");
                return;
            }

            try {
                // New API endpoint
                const res = await fetch('/api/me/favorites', {
                    headers: window.AuthUtils.getAuthHeaderObj()
                });

                if (res.status === 401 || res.status === 403) {
                    console.log("FavoritesManager: No active session (Guest mode)");
                    isInitialized = true; // Mark as initialized so it stops trying
                    return;
                }

                if (!res.ok) {
                    console.warn("FavoritesManager: API error, skipping load.");
                    isInitialized = true;
                    return;
                }

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
        const token = window.getAccessToken ? window.getAccessToken() : null;
        if (!token) {
            if (window.showGuestModal) {
                window.showGuestModal(
                    "¡Guarda tus favoritos!",
                    "Crea una cuenta para guardar este beat en tu colección y acceder a él desde cualquier dispositivo."
                );
            } else {
                window.location.href = '/pages/login.html';
            }
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

    // Helper: Get Access Token (Internal) - REMOVED (Now using global AuthUtils)
    // function getAccessToken() { ... }

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

        // RACE CONDITION HANDLING
        const thisRenderId = Date.now();
        lastRenderId = thisRenderId;

        if (initTimeout) {
            clearTimeout(initTimeout);
            initTimeout = null;
        }

        try {
            // 1. Filter Logic (Instant)
            const safeSearch = currentSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const filtered = cachedFavorites.filter(p => {
                const term = safeSearch.toLowerCase();
                const matchesSearch = p.name.toLowerCase().includes(term);
                let matchesType = true;
                if (globalFilterType !== 'all') {
                    const typeBlob = ((p.product_type || '') + ' ' + (p.category || '')).toLowerCase();
                    matchesType = typeBlob.includes(globalFilterType);
                }
                return matchesSearch && matchesType;
            });

            if (lastRenderId !== thisRenderId) return;

            // 2. Clear & Empty State
            if (filtered.length === 0) {
                if (cachedFavorites.length > 0) {
                    container.innerHTML = '<div style="text-align:center; padding:4rem; color:#666;">No se encontraron resultados para tu búsqueda.</div>';
                } else {
                    renderEmptyState(container);
                }
                return;
            }

            // Cleanup old wavesurfers
            activeWavesurfers.forEach(ws => { try { ws.destroy(); } catch (e) { } });
            activeWavesurfers = [];
            window.activeWavesurfers = activeWavesurfers;
            window.currentlyPlaying = null; // Reset current playing

            container.innerHTML = '';

            // 3. Batched Rendering (Optimization)
            const BATCH_SIZE = 20;

            // Render first batch immediately
            const firstBatch = filtered.slice(0, BATCH_SIZE);
            renderBatch(firstBatch, container, collabStats);

            // Render remaining in background
            if (filtered.length > BATCH_SIZE) {
                let currentOffset = BATCH_SIZE;

                const renderNextBatch = () => {
                    if (lastRenderId !== thisRenderId) return; // Stop if invalidated

                    const nextBatch = filtered.slice(currentOffset, currentOffset + BATCH_SIZE);
                    if (nextBatch.length > 0) {
                        renderBatch(nextBatch, container, collabStats);
                        currentOffset += BATCH_SIZE;
                        requestAnimationFrame(renderNextBatch);
                    }
                };

                // Allow UI to breathe before starting next batches
                setTimeout(() => requestAnimationFrame(renderNextBatch), 50);
            }

        } catch (err) {
            console.error("Error applying filters:", err);
        }
    }

    function renderBatch(items, container, collabStats) {
        const fragment = document.createDocumentFragment();
        items.forEach((prod, index) => {
            const row = createListRow(prod, index, collabStats);
            fragment.appendChild(row);
        });
        container.appendChild(fragment);
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
                <div class="list-waveform-container waveform-static-fallback" id="${waveformId}" style="height:32px; width:100%; position:relative; flex:1; opacity:0.8;">
                    <!-- Static Line (CSS) -->
                </div>
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

        // Attach Onclick to BUTTON only (Efficient)
        const playBtn = row.querySelector(`#btn-play-${waveformId}`);
        if (playBtn) {
            playBtn.onclick = (e) => {
                e.stopPropagation();
                handlePlayClick(row, prod);
            };
        }

        return row;
    }

    // --- LAZY WAVESURFER LOGIC ---

    async function handlePlayClick(row, prod) {
        const waveformId = row.dataset.waveformId;
        const btn = document.getElementById(`btn-play-${waveformId}`);
        const audioUrl = row.dataset.audioUrl;

        // 1. GLOBAL PLAYER SYNC (Sticky Player)
        if (window.StickyPlayer && window.StickyPlayer.play) {
            // Use StickyPlayer as primary engine if available
            // This avoids creating local WaveSurfer instances entirely if we want centralized playback
            const currentId = window.StickyPlayer.getCurrentTrackId();

            // If clicking same track, toggle
            if (currentId == prod.id) {
                window.StickyPlayer.togglePlay();
                return;
            }

            // Update Playlist & Play
            // We only pass the current search results as context if possible, otherwise just this track
            // Ideally we pass context: window.trendingProducts || cachedFavorites
            // Filtered list is hard to access here without passing it down. 
            // Minimal: Pass cachedFavorites
            window.StickyPlayer.updatePlaylist(cachedFavorites, 'favorites');
            window.StickyPlayer.play(prod);
            return;
        }

        // 2. LOCAL FALLBACK (Only if StickyPlayer Missing)
        // Check if WS exists for this row
        let ws = window.activeWavesurfers.find(w => w.customId === waveformId);

        if (!ws) {
            // INIT ON DEMAND
            if (btn) btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';

            try {
                ws = await lazyLoadWaveSurfer(waveformId, audioUrl, row);
                // Auto play once ready
                ws.play();
                if (btn) btn.innerHTML = '<i class="bi bi-pause-fill"></i>';
                window.currentlyPlaying = ws;
            } catch (e) {
                console.error("Error lazy loading WS:", e);
                if (btn) btn.innerHTML = '<i class="bi bi-exclamation-circle"></i>';
            }
        } else {
            // Already initialized, just toggle
            ws.playPause();
            // Icon update handled by events
        }
    }

    function lazyLoadWaveSurfer(containerId, url, row) {
        return new Promise((resolve, reject) => {
            if (!window.WaveSurfer) return reject("WaveSurfer lib not found");

            const containerEl = document.getElementById(containerId);
            if (!containerEl) return reject("Container not found");

            // Pause others
            if (window.activeWavesurfers) {
                window.activeWavesurfers.forEach(w => w.pause());
            }

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
                interact: true,
                cursorWidth: 0
            });

            ws.customId = containerId;

            // REMOVE STATIC PLACEHOLDER
            containerEl.classList.remove('waveform-static-fallback');
            containerEl.innerHTML = ''; // Clear image/css placeholder if any

            ws.on('ready', () => {
                const dur = ws.getDuration();
                const mins = Math.floor(dur / 60);
                const secs = Math.floor(dur % 60);
                const el = document.getElementById(`fav-duration-${containerId}`);
                if (el) el.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                resolve(ws);
            });

            ws.on('play', () => {
                const btn = document.getElementById(`btn-play-${containerId}`);
                if (btn) btn.innerHTML = '<i class="bi bi-pause-fill"></i>';

                // Pause other local instances
                window.activeWavesurfers.forEach(w => {
                    if (w !== ws) w.pause();
                });
            });

            ws.on('pause', () => {
                const btn = document.getElementById(`btn-play-${containerId}`);
                if (btn) btn.innerHTML = '<i class="bi bi-play-fill"></i>';
            });

            ws.on('finish', () => {
                const btn = document.getElementById(`btn-play-${containerId}`);
                if (btn) btn.innerHTML = '<i class="bi bi-play-fill"></i>';
            });

            ws.on('error', (err) => {
                if (err.name === 'AbortError') return;
                console.warn("WS Error", err);
                reject(err);
            });

            window.activeWavesurfers.push(ws);
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
})();

// --- REFINED INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('offszn-session-ready', (e) => {
        if (e.detail.session) window.FavoritesManager.init();
    });
    if (window.supabaseClient) window.FavoritesManager.init();
});
