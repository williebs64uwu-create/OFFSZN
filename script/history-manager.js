/**
 * HISTORY MANAGER
 * Handles fetching, filtering, and managing user playback/interaction history.
 */

window.HistoryManager = (function () {
    let historyItems = [];
    let currentFilter = 'all'; // all, beat, preset, loop, plantilla, drum
    let isInitialized = false;
    let currentUser = null;

    async function init() {
        if (isInitialized) return;
        if (!document.getElementById('history-list')) return;

        // Configuration
        const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3000/api'
            : 'https://offszn.lat/api';

        const HISTORY_ENDPOINT = `${API_URL}/me/history`;

        // Wait for Supabase
        // Use global client
        if (!window.supabaseClient) {
            console.warn("HistoryManager: Global Supabase client not found (guest or loading).");
            return;
        }

        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) {
            renderEmpty("Inicia sesión para ver tu historial");
            return;
        }
        currentUser = session.user;

        await fetchHistory();
        isInitialized = true;
    }

    // --- FETCH DATA ---
    async function fetchHistory() {
        const container = document.getElementById('history-list');
        if (!container) return;

        container.innerHTML = Array(8).fill(0).map(() => `
            <div class="list-row skeleton-row">
                <div class="list-cover">
                    <div class="skeleton skel-box" style="width: 100%; height: 100%;"></div>
                </div>
                
                <div class="list-col-main">
                    <div class="skeleton skel-text" style="width: 80%; margin-bottom: 8px;"></div>
                    <div class="skeleton skel-text" style="width: 50%; height: 10px;"></div>
                </div>

                <div class="list-col-play-btn">
                     <div class="skeleton skel-circle" style="width: 42px; height: 42px;"></div>
                </div>

                <div class="list-col-waveform desktop-only">
                    <div class="list-waveform-container skeleton"></div>
                </div>

                <div class="list-col-time">
                    <div class="skeleton skel-text" style="width: 60px; margin: 0 auto;"></div>
                </div>

                <div class="list-col-tags desktop-only">
                    <div class="skeleton skel-box" style="width: 60px; height: 24px; border-radius: 20px;"></div>
                </div>

                <div class="list-col-actions">
                    <div class="skeleton skel-circle" style="width: 32px; height: 32px;"></div>
                    <div class="skeleton skel-circle" style="width: 32px; height: 32px;"></div>
                    <div class="skeleton skel-circle" style="width: 32px; height: 32px;"></div>
                </div>
            </div>
        `).join('');

        try {
            const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3000/api'
                : 'https://offszn.lat/api';

            const response = await fetch(`${API_URL}/me/history`, {
                headers: window.AuthUtils ? window.AuthUtils.getAuthHeaderObj() : {}
            });

            if (!response.ok) throw new Error(`Fetch error: ${response.status}`);

            const data = await response.json();
            historyItems = data || [];

            // Artificial delay for visual consistency (increased per user request)
            await new Promise(r => setTimeout(r, 2000));

            // Determine if empty
            if (!historyItems || historyItems.length === 0) {
                renderEmpty("Aún no has escuchado nada. ¡Explora el marketplace!");
                return;
            }

            renderList();

            // Subscribe to favorites for real-time heart sync
            window.FavoritesManager.subscribe((likedIds) => {
                document.querySelectorAll('.action-icon-btn[id^="history-like-"]').forEach(btn => {
                    const pid = btn.id.replace('history-like-', '');
                    const isLiked = likedIds.has(String(pid));
                    btn.classList.toggle('active', isLiked);
                    const icon = btn.querySelector('i');
                    if (icon) {
                        icon.className = isLiked ? 'bi bi-heart-fill' : 'bi bi-heart';
                        icon.style.color = isLiked ? '#ef4444' : '';
                    }
                });
            });

        } catch (error) {
            console.error("History fetch error:", error);
            renderEmpty("Error al cargar historial o sesión expirada.");
        }
    }

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function (m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[m];
        });
    }

    function isPresetProduct(p) {
        if (!p) return false;
        const type = (p.product_type || p.type || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        return type === 'preset' || type === 'vocalpreset' || type.includes('preset') ||
            type === 'template' || type === 'plantilla' ||
            cat === 'plantilla' || cat === 'vocal preset' || cat.includes('preset');
    }

    function getProductAudio(product) {
        if (!product) return '';

        // Prioritize "After" audio for presets if available
        if (isPresetProduct(product) && product.audio_after_url) {
            return product.audio_after_url;
        }

        // Fallback to "Before" audio for presets specifically
        if (isPresetProduct(product) && product.audio_before_url) {
            return product.audio_before_url;
        }

        // Comprehensive fallback chain
        return product.mp3_url ||
            product.audio_url ||
            product.download_url_mp3 ||
            product.preview_url ||
            product.demo_file ||
            product.tagged_file ||
            product.file_url ||
            product.url_file ||
            product.cloud_url ||
            product.audio_before_url ||
            (product.track_data ? product.track_data.audio_url : '') ||
            '';
    }

    // --- FAVORITES SYNC ---
    function syncLikeButtons() {
        if (!window.FavoritesManager) return;
        document.querySelectorAll('#history-list .like-btn').forEach(btn => {
            const id = btn.id.replace('history-like-', '');
            const isLiked = window.FavoritesManager.isLiked(id);
            const icon = btn.querySelector('i');
            if (isLiked) {
                btn.classList.add('active');
                if (icon) {
                    icon.className = 'bi bi-heart-fill';
                    icon.style.color = '#ef4444';
                }
            } else {
                btn.classList.remove('active');
                if (icon) {
                    icon.className = 'bi bi-heart';
                    icon.style.color = '';
                }
            }
        });
    }

    // Subscribe to global favorites changes
    if (window.FavoritesManager && window.FavoritesManager.subscribe) {
        window.FavoritesManager.subscribe(syncLikeButtons);
    }

    function formatRelativeDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'HOY';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'AYER';
        } else {
            return date.toLocaleDateString();
        }
    }

    // --- RENDER ---
    function renderList() {
        // Cleanup old wavesurfers to prevent memory leaks
        if (window.activeWavesurfers) {
            window.activeWavesurfers.forEach(s => {
                try { s.destroy(); } catch (e) { }
            });
        }
        window.activeWavesurfers = [];

        const container = document.getElementById('history-list');
        if (!container) return;

        container.innerHTML = '';

        const searchTerm = document.getElementById('historySearch')?.value.toLowerCase() || '';

        const filtered = historyItems.filter(item => {
            const matchesType = currentFilter === 'all' || item.product_type === currentFilter;
            const title = item.name || '';
            const producer = item.producer_nickname || '';
            const matchesSearch = title.toLowerCase().includes(searchTerm) ||
                producer.toLowerCase().includes(searchTerm);
            return matchesType && matchesSearch;
        });

        if (filtered.length === 0) {
            renderEmpty("No se encontraron resultados.");
            return;
        }

        filtered.forEach(item => {
            const row = document.createElement('div');
            row.className = 'list-row fade-out-up';
            row.style.animation = 'none';

            // Check for soft delete
            const isSoftDeleted = (item.public_slug && item.public_slug.startsWith('deleted_')) || item.status === 'deleted';

            if (isSoftDeleted) {
                row.innerHTML = `
                    <div class="list-cover" style="opacity: 0.3; filter: grayscale(1);">
                        <img src="/images/portada-default.png" alt="No disponible">
                    </div>
                    
                    <div class="list-col-main" style="opacity: 0.5;">
                        <div class="list-track-title" style="text-decoration: line-through;">${escapeHTML(item.name || 'Producto no disponible')}</div>
                        <div class="list-author-sub">Contenido eliminado</div>
                    </div>

                    <div class="list-col-play-btn" style="opacity: 0.2;">
                         <button class="play-btn-circle" disabled>
                            <i class="bi bi-play-fill"></i>
                        </button>
                    </div>

                    <div class="list-col-waveform desktop-only" style="opacity: 0.1;">
                        <div class="list-waveform-container" style="background: rgba(255,255,255,0.05); height: 2px; border-radius: 1px;"></div>
                    </div>

                    <div class="list-col-time">
                        <span class="history-date">${formatRelativeDate(item.played_at)}</span>
                    </div>

                    <div class="list-col-tags desktop-only" style="opacity: 0.3;">
                         <span class="tag-chip">N/A</span>
                    </div>

                    <div class="list-col-actions">
                         <a href="/ayuda-y-contacto.html" class="action-icon-btn" title="Soporte">
                            <i class="bi bi-question-circle"></i>
                        </a>
                    </div>
                `;
            } else {
                const title = escapeHTML(item.name || 'Sin título');
                const producer = escapeHTML(item.producer_nickname || 'OFFSZN');
                const imgUrl = item.image_url || '/images/portada-default.png';
                const seoLink = window.createSeoLink ? window.createSeoLink(item) : `/producto.html?id=${item.product_id}`;
                const isLiked = window.FavoritesManager ? window.FavoritesManager.isLiked(item.product_id) : false;

                // Build trackData for share/player (attach to window specifically for this row to avoid quote escaping hell in HTML attribute)
                const safeTrackDataObj = {
                    id: item.product_id,
                    name: item.name,
                    image_url: item.image_url,
                    product_type: item.product_type,
                    public_slug: item.public_slug,
                    price_basic: item.price_basic,
                    is_free: item.is_free,
                    artist_users: {
                        nickname: item.producer_nickname,
                        id: item.producer_id,
                        avatar_url: item.producer_avatar,
                        is_verified: item.producer_is_verified
                    }
                };
                // Register globally to safely pass to onClick handler without string escaping issues
                window[`__share_data_${item.product_id}`] = safeTrackDataObj;

                row.innerHTML = `
                    <div class="list-cover" onclick="window.HistoryManager.playItem('${String(item.product_id)}')">
                        <img src="${imgUrl}" alt="${title}" onerror="this.src='/images/portada-default.png'"
                             data-artist="${item.producer_id}" onmouseenter="showArtistCard(event, this)" onmouseleave="hideArtistCard(event, this)">
                        <div class="cover-play-overlay" id="btn-play-waveform-overlay-${item.product_id}"><i class="bi bi-play-fill"></i></div>
                    </div>
                    
                    <div class="list-col-main" onclick="window.location.href='${seoLink}'" style="cursor:pointer">
                        <div class="list-track-title">${title}</div>
                        <div class="list-author-sub" 
                         data-artist="${item.producer_id}"
                         onmouseenter="showArtistCard(event, this)"
                         onmouseleave="hideArtistCard(event, this)">
                        ${producer}
                    </div>
                    </div>

                    <div class="list-col-play-btn">
                         <button class="play-btn-circle" id="btn-play-waveform-${item.product_id}" onclick="window.HistoryManager.playItem('${String(item.product_id)}')">
                            <i class="bi bi-play-fill"></i>
                        </button>
                    </div>

                    <div class="list-col-waveform desktop-only">
                        <div class="list-waveform-container" id="waveform-${item.product_id}">
                            <!-- WaveSurfer will be injected here -->
                        </div>
                    </div>

                    <div class="list-col-time">
                        <span class="history-date">${formatRelativeDate(item.played_at)}</span>
                    </div>

                    <div class="list-col-tags desktop-only">
                        <span class="tag-chip">${(item.product_type || 'Beat').toUpperCase()}</span>
                    </div>

                    <div class="list-col-actions">
                        <button class="action-icon-btn like-btn ${isLiked ? 'active' : ''}" 
                                id="history-like-${item.product_id}"
                                onclick="window.FavoritesManager?.toggleLike('${item.product_id}', this, '${item.producer_id}')" 
                                title="Favorito">
                            <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}" style="${isLiked ? 'color:#ef4444' : ''}"></i>
                        </button>
                        <button class="action-icon-btn" onclick="window.location.href='${seoLink}'" title="Ir al producto">
                            <i class="bi bi-download"></i>
                        </button>
                        <button class="action-icon-btn action-share-btn" onclick="if(window.openShareModal) window.openShareModal(window['__share_data_${item.product_id}'])" title="Compartir">
                            <i class="bi bi-share"></i>
                        </button>
                        <span class="history-row-date">${formatRelativeDate(item.played_at)}</span>
                    </div>
                `;
            }
            container.appendChild(row);
        });

        initRowWaveformsLazy();
    }

    function initRowWaveformsLazy() {
        if (!window.WaveSurfer) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const container = entry.target;
                    const pid = container.id.replace('waveform-', '');

                    // Prevent double init
                    if (container.dataset.initialized) return;
                    container.dataset.initialized = "true";

                    initSingleWaveform(container, pid);
                    observer.unobserve(container);
                }
            });
        }, { rootMargin: '200px' });

        document.querySelectorAll('.list-waveform-container:not(.skeleton)').forEach(container => {
            observer.observe(container);
        });
    }

    function initSingleWaveform(container, pid) {
        // Find the track item
        const item = historyItems.find(i => String(i.product_id) === String(pid));
        if (!item) return;

        const audioUrl = getProductAudio(item);
        if (!audioUrl) return;

        const wsRow = WaveSurfer.create({
            container: `#${container.id}`,
            waveColor: 'rgba(255, 255, 255, 0.15)',
            progressColor: '#8b5cf6',
            cursorColor: 'transparent',
            barWidth: 2,
            barGap: 3,
            height: 30,
            responsive: true,
            interact: false,
            backend: 'MediaElement',
            partialRender: true,
            hideScrollbar: true
        });

        // Resolve R2 URL
        window.getAuthorizedUrl(audioUrl, item.r2_version || 'v1').then(url => {
            if (url) wsRow.load(url);
        });

        if (!window.activeWavesurfers) window.activeWavesurfers = [];
        window.activeWavesurfers.push(wsRow);
    }

    function renderEmpty(msg) {
        const container = document.getElementById('history-list');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; color: #666; padding: 80px 20px;">
                    <div style="font-size: 3rem; margin-bottom: 20px;"><i class="bi bi-clock-history"></i></div>
                    <h4 style="font-weight: 500;">${msg}</h4>
                </div>
            `;
        }
    }

    // --- PUBLIC METHODS ---
    function setFilter(type, btn) {
        currentFilter = type;

        // Update UI - support both legacy .filter-tab and new .filter-chip
        document.querySelectorAll('.filter-tab, .filter-chip').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');

        renderList();
    }

    function applyFilters() {
        renderList();
    }

    function confirmClearHistory() {
        const modal = document.getElementById('confirm-modal');
        if (modal) modal.classList.add('active');
    }

    function playItem(pid) {
        if (!historyItems || !window.StickyPlayer) {
            console.warn("HistoryManager: Playback unavailable (missing data or StickyPlayer).");
            return;
        }

        const idStr = String(pid);

        // 🛡️ TOGGLE SYNC: If playing THIS item, just toggle
        if (window.StickyPlayer.getCurrentTrackId && String(window.StickyPlayer.getCurrentTrackId()) === idStr) {
            window.StickyPlayer.togglePlay();
            return;
        }

        const item = historyItems.find(i => String(i.product_id) === idStr || String(i.id) === idStr);

        if (!item) {
            console.warn("HistoryManager: Item not found for playback.", pid);
            return;
        }

        playWithItem(item);
    }

    function playWithItem(item) {
        // --- 🔥 SYNC PLAYLIST ---
        // Ensure the player knows about the current history list for skip prev/next
        if (window.StickyPlayer.updatePlaylist) {
            const mappedPlaylist = historyItems.map(hi => ({
                id: hi.product_id,
                name: hi.name,
                image_url: hi.image_url,
                product_type: hi.product_type,
                audio_url: getProductAudio(hi),
                price_basic: hi.price_basic,
                is_free: hi.is_free,
                public_slug: hi.public_slug,
                artist_users: {
                    nickname: hi.producer_nickname || 'OFFSZN Artist',
                    id: hi.producer_id,
                    avatar_url: hi.producer_avatar || null,
                    is_verified: hi.producer_is_verified || false
                }
            }));
            window.StickyPlayer.updatePlaylist(mappedPlaylist, 'history');
        }

        // Map history item to player track format for immediate play
        const trackData = {
            id: item.product_id,
            name: item.name,
            image_url: item.image_url,
            product_type: item.product_type,
            price_basic: item.price_basic,
            is_free: item.is_free,
            public_slug: item.public_slug,
            audio_url: getProductAudio(item),
            artist_users: {
                nickname: item.producer_nickname || 'OFFSZN Artist',
                id: item.producer_id,
                avatar_url: item.producer_avatar || null,
                is_verified: item.producer_is_verified || false
            }
        };

        if (window.StickyPlayer.play) {
            window.StickyPlayer.play(trackData);
        }
    }

    // Auto Init
    document.addEventListener('DOMContentLoaded', init);
    // Router Re-init
    document.addEventListener('offszn:page-changed', (e) => {
        if (e.detail.url.includes('historial')) {
            isInitialized = false; // Force re-check
            init();
        }
    });

    return {
        init,
        setFilter,
        applyFilters,
        confirmClearHistory,
        playItem
    };

})();

// Global Helpers for HTML onclick attributes
window.setFilter = (type, btn) => window.HistoryManager.setFilter(type, btn);
window.applyFilters = () => window.HistoryManager.applyFilters();
window.confirmClearHistory = () => window.HistoryManager.confirmClearHistory();
window.playHistoryItem = (id) => window.HistoryManager.playItem(id);
window.closeConfirmModal = () => document.getElementById('confirm-modal')?.classList.remove('active');
