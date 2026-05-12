/**
 * FAVORITES MANAGER (Enhanced)
 * Handles fetching, toggling (throttled), syncing, and notifications.
 */

window.FavoritesManager = (function () {
    let likedItemIds = new Set();
    let isInitialized = false;
    let subscribers = [];

    // Persist to localStorage for zero-latency initial state
    const CACHE_KEY = 'offszn_liked_ids';

    // 1. Load from cache immediately
    function loadFromCache() {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const ids = JSON.parse(cached);
                likedItemIds = new Set(ids.map(String));
                // Trigger initial notification so UI updates immediately
                setTimeout(() => notifySubscribers(), 0);
            }
        } catch (e) {
            console.warn("Failed to load likes from cache", e);
        }
    }
    loadFromCache();

    // Throttling: Track IDs currently being toggled
    let pendingToggles = new Set();
    let toggleQueues = new Map(); // productId -> timeoutId

    // Cache for producer metadata (badges, plans, etc)
    let producerMap = new Map();

    // 1. Initialize (with Promise Singleton Pattern)
    let initPromise = null;

    function escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
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
                    .bi-heart-fill.liked-pop {
                        animation: heart-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    }
                    @keyframes heart-pop {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.4); }
                        100% { transform: scale(1); }
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

            let token = (window.AuthUtils && window.AuthUtils.getAccessToken) ? window.AuthUtils.getAccessToken() : (window.getAccessToken ? window.getAccessToken() : null);
            if (!token) {
                isInitialized = true;
                return;
            }

            try {
                // New API endpoint
                const res = await fetch('/api/me/favorites', {
                    headers: window.AuthUtils.getAuthHeaderObj()
                });

                if (res.status === 401 || res.status === 403) {
                    isInitialized = true; // Mark as initialized so it stops trying
                    return;
                }

                if (!res.ok) {
                    isInitialized = true;
                    notifySubscribers();
                    return;
                }

                const products = await res.json();

                // --- 🔥 BULK PRODUCER VERIFICATION ---
                // Extract all unique producer IDs and fetch their metadata in one go
                const producerIds = [...new Set(products.map(p => p.producer_id || p.user_id))].filter(Boolean);
                if (producerIds.length > 0) {
                    try {
                        const pRes = await fetch('/api/users/bulk-info', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ids: producerIds })
                        });
                        if (pRes.ok) {
                            const pData = await pRes.json();
                            pData.forEach(u => producerMap.set(String(u.id), u));
                        }
                    } catch (e) {
                        console.warn("Failed to fetch bulk producer info for favorites", e);
                    }
                }

                // --- 🔥 VISIBILITY FILTERING ---
                // We only show products that are both PUBLIC and NOT DELETED
                const visibleProducts = products.filter(p => {
                    const isSoftDeleted = (p.public_slug && p.public_slug.startsWith('deleted_')) || p.status === 'deleted';
                    const isPublic = (p.visibility === 'public');
                    return isPublic && !isSoftDeleted;
                });

                likedItemIds = new Set(visibleProducts.map(p => String(p.id)));

                // Save to cache
                localStorage.setItem(CACHE_KEY, JSON.stringify([...likedItemIds]));

                // Cache full objects for rendering later (optional optimization)
                cachedFavorites = visibleProducts;

                isInitialized = true;
                notifySubscribers();
            } catch (err) {
                // Silently handle load errors as per user request
                isInitialized = true;
                notifySubscribers();
            } finally {
                initPromise = null;
            }
        })();

        return initPromise;
    }

    // 2. Toggle Like (Professional Optimistic UI + Debounced Sync)
    async function toggleLike(targetId, buttonElement = null, targetOwnerId = null) {
        const token = window.getAccessToken ? window.getAccessToken() : null;
        if (!token) {
            if (window.showGuestModal) {
                window.showGuestModal(
                    "¡Guarda tus favoritos!",
                    "Crea una cuenta para guardar este beat en tu colección y acceder a él desde cualquier dispositivo."
                );
            } else {
                window.location.href = '/pages/register.html';
            }
            return;
        }

        const idStr = String(targetId);
        const isCurrentlyLiked = likedItemIds.has(idStr);
        const nextState = !isCurrentlyLiked;

        // --- 🚀 INSTANT OPTIMISTIC UI ---
        if (nextState) {
            likedItemIds.add(idStr);
        } else {
            likedItemIds.delete(idStr);
        }

        // Sync to cache immediately
        localStorage.setItem(CACHE_KEY, JSON.stringify([...likedItemIds]));
        
        // Notify all UI listeners (updates icons globally)
        notifySubscribers();

        // Specific Button Feedback (Immediate)
        if (buttonElement) {
            buttonElement.classList.toggle('liked', nextState);
            const icon = buttonElement.tagName === 'I' ? buttonElement : buttonElement.querySelector('i');
            if (icon) {
                icon.className = nextState ? 'bi bi-heart-fill liked-pop' : 'bi bi-heart';
                icon.style.color = nextState ? '#ef4444' : '';
                
                // If unliking, we can remove the class after animation or just let it swap
                if (nextState) {
                    setTimeout(() => icon.classList.remove('liked-pop'), 300);
                }
            }
        }

        // --- ⚡ DEBOUNCED SERVER SYNC ---
        // If the user clicks 10 times, we only send the FINAL state after 800ms of inactivity
        if (toggleQueues.has(idStr)) {
            clearTimeout(toggleQueues.get(idStr));
        }

        const timeoutId = setTimeout(async () => {
            toggleQueues.delete(idStr);
            
            try {
                // Verify the state hasn't changed back while waiting
                const finalState = likedItemIds.has(idStr);
                
                const res = await fetch(`/api/products/${targetId}/like`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    // Tell the server if we want to FORCE a certain state (optional but safer)
                    body: JSON.stringify({ liked: finalState })
                });

                if (res.status === 401 || res.status === 403) {
                    // Revert and redirect
                    localStorage.removeItem('authToken');
                    window.location.reload();
                    return;
                }

                if (!res.ok) throw new Error('API Error');
                const data = await res.json();

                // Re-sync if server disagrees (rare race condition)
                if (data.liked !== likedItemIds.has(idStr)) {
                    if (data.liked) likedItemIds.add(idStr);
                    else likedItemIds.delete(idStr);
                    localStorage.setItem(CACHE_KEY, JSON.stringify([...likedItemIds]));
                    notifySubscribers();
                }

            } catch (err) {
                console.error("Failed to sync like with server:", err);
                // We don't necessarily revert here to avoid flickering on poor connections
                // unless it's a persistent failure.
            }
        }, 800);

        toggleQueues.set(idStr, timeoutId);
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
    async function renderFavorites(containerId, forceDelay = false) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Show Skeletons (Perfectly Aligned PC vs Mobile)
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            container.innerHTML = `
                ${Array(6).fill(0).map(() => `
                    <div class="skeleton-fav-row" style="display: flex; align-items: center; gap: 16px; padding: 12px 16px; min-height: 76px;">
                        <!-- Cover (48x48) -->
                        <div class="skeleton" style="width:48px; height:48px; border-radius:8px; flex-shrink:0;"></div>
                        <!-- Info -->
                        <div style="flex-grow:1; min-width:0; display:flex; flex-direction:column; gap:6px;">
                            <div class="skeleton" style="width:80%; height:12px; border-radius:4px;"></div>
                            <div class="skeleton" style="width:50%; height:10px; border-radius:2px;"></div>
                        </div>
                        <!-- Actions -->
                        <div style="display:flex; gap:12px; align-items:center;">
                            <div class="skeleton" style="width:24px; height:24px; border-radius:50%;"></div>
                            <div class="skeleton" style="width:24px; height:24px; border-radius:50%;"></div>
                        </div>
                    </div>
                `).join('')}
            `;
        } else {
            container.innerHTML = `
                ${Array(10).fill(0).map(() => `
                    <div class="skeleton-card" style="display: flex; flex-direction: column; gap: 12px; background: #0d0d0d; border-radius: 18px; border: 1px solid rgba(255,255,255,0.05); overflow: hidden; height: 100%;">
                        <!-- Cover (Aspect 1/1) -->
                        <div class="skeleton" style="width:100%; aspect-ratio:1/1;"></div>
                        <!-- Info -->
                        <div style="padding: 16px; display:flex; flex-direction:column; gap:8px; flex-grow:1;">
                            <div class="skeleton" style="width:70%; height:16px; border-radius:4px;"></div>
                            <div class="skeleton" style="width:40%; height:12px; border-radius:4px;"></div>
                            <!-- Spacer for removed waveform/tags -->
                            <div style="margin-top:auto; padding-top: 16px; display:flex; justify-content:space-between; align-items:center; border-top: 1px solid rgba(255,255,255,0.05);">
                                <div class="skeleton" style="width:70px; height:28px; border-radius:20px;"></div>
                                <div class="skeleton" style="width:60px; height:20px; border-radius:4px;"></div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            `;
        }

        if (!isInitialized) await init();

        if (likedItemIds.size === 0) {
            renderEmptyState(container);
            return;
        }

        if (forceDelay) {
            setTimeout(() => {
                applyFilters(containerId);
            }, 600);
        } else {
            applyFilters(containerId);
        }
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
                // 🛡️ SYNC CHECK: Only show items that are currently liked
                if (!likedItemIds.has(String(p.id))) return false;

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
        }
    }

    function renderBatch(items, container, collabStats) {
        const fragment = document.createDocumentFragment();
        items.forEach((prod, index) => {
            const card = createCardRow(prod, index, collabStats);
            fragment.appendChild(card);
        });
        container.appendChild(fragment);
    }

    function createCardRow(prod, index, collabStats = {}) {
        const card = document.createElement('div');
        card.className = 'fav-product-card';
        card.dataset.productId = prod.id;

        const isSoftDeleted = (prod.public_slug && prod.public_slug.startsWith('deleted_')) || prod.status === 'deleted';
        const imgUrl = prod.image_url || '/images/portada-default.png';
        const pType = (prod.product_type || 'beat').toUpperCase();
        const waveformId = `fav-waveform-track-${prod.id}-${index}`;
        const prodUser = prod.artist_users || { nickname: 'Unknown', id: prod.user_id };
        const audioUrl = getProductAudio(prod);
        const seoUrl = window.createSeoLink ? window.createSeoLink(prod) : '#';

        // --- ARTIST HTML ---
        const createArtistSpan = (name, data, extraClass = '') => {
            const safeData = JSON.stringify(data).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
            return `<span class="artist-hover-trigger ${extraClass}" data-artist='${safeData}' onmouseenter="if(window.showArtistCard) window.showArtistCard(event, this)" onmouseleave="if(window.hideArtistCard) window.hideArtistCard(event, this)">${escapeHTML(name)}</span>`;
        };

        const producerId = prod.producer_id || prod.user_id;
        const producerInfo = producerMap.get(String(producerId)) || prodUser;

        const producerData = {
            id: producerId,
            nickname: producerInfo.nickname || prodUser.nickname,
            avatar_url: producerInfo.avatar_url || prodUser.avatar_url,
            is_verified: producerInfo.is_verified || prodUser.is_verified,
            plan: producerInfo.plan || null,
            stats: { followers: producerInfo.followers_count || 0 }
        };

        // --- VERIFIED BADGE ---
        let badgeHtml = '';
        const plan = producerData.plan;
        const isVerified = producerData.is_verified || !!plan;
        if (isVerified) {
            const badgeColor = plan === 'pro' ? '#fbbf24' : (plan === 'starter' ? '#a855f7' : '#1DB954');
            badgeHtml = `<i class="bi bi-patch-check-fill" style="margin-left: 4px; font-size: 0.85rem; color: ${badgeColor};" title="Verificado"></i>`;
        }

        let artistHtml = createArtistSpan(producerData.nickname, producerData, 'producer-link-thin') + badgeHtml;

        let collabs = typeof prod.collaborators === 'string' ? JSON.parse(prod.collaborators) : (prod.collaborators || []);
        if (Array.isArray(collabs) && collabs.length > 0) {
            const valid = collabs.filter(c => (c.nickname || c.name) && (c.status === undefined || c.status === 'accepted'));
            if (valid.length > 0) {
                artistHtml += `<span style="color:#666;">, </span>` + valid.slice(0, 1).map(c => {
                    const cName = c.nickname || c.name;
                    return createArtistSpan(cName, { nickname: cName }, 'collaborator-link-thin');
                }).join('');
            }
        }

        // --- PRICE/TAGS ---
        let mainBadge = pType;
        let subBadge = '';
        if (pType.includes('BEAT')) {
            let licenseCount = 0;
            const l = prod.licenses || {};
            if (l.basic?.enabled || prod.price_basic > 0) licenseCount++;
            if (l.premium?.enabled || prod.price_premium > 0) licenseCount++;
            if (l.trackout?.enabled || prod.price_stems > 0) licenseCount++;
            if (l.unlimited?.enabled || prod.price_exclusive > 0) licenseCount++;
            if (licenseCount > 0) subBadge = `${licenseCount} ${licenseCount === 1 ? 'LICENCIA' : 'LICENCIAS'}`;
        } else {
            const c = prod.sounds_count || 0;
            subBadge = `${c} SONIDOS`;
        }

        const pTypeLow = (prod.product_type || '').toLowerCase();
        const isTrulyFree = pTypeLow !== 'beat' && (prod.is_free === true || String(prod.is_free) === 'true' || Number(prod.price_basic) === 0);
        let priceValue = prod.price_basic !== undefined && prod.price_basic !== null ? prod.price_basic : '20';
        const priceText = isTrulyFree ? 'FREE' : `$${priceValue}`;

        if (isSoftDeleted) {
            card.innerHTML = `
                <div class="fav-card-cover" style="opacity:0.3; filter:grayscale(1);">
                    <img src="${imgUrl}" alt="deleted">
                </div>
                <div class="fav-card-body">
                    <h4 class="fav-card-title">[ELIMINADO]</h4>
                    <p class="fav-card-artist">Producto no disponible</p>
                    <div class="fav-card-footer">
                         <button class="fav-icon-btn liked" onclick="window.FavoritesManager.toggleLike(${prod.id}, this)">
                            <i class="bi bi-heart-fill"></i>
                        </button>
                    </div>
                </div>
            `;
            return card;
        }

        const isMobile = window.innerWidth <= 768;

        const cleanName = (name) => {
            if (!name) return 'Sin título';
            return escapeHTML(name.replace(/_/g, ' ').replace(/\.(mp3|wav|zip|rar)$/i, '').replace(/\s+/g, ' ').trim());
        };

        card.innerHTML = `
            <div class="fav-card-cover" onclick="window.location.href='${seoUrl}'">
                <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" 
                     id="fav-img-${prod.id}" 
                     data-r2-src="${escapeHTML(prod.image_url)}"
                     data-r2-version="${prod.r2_version || 'v2'}"
                     onerror="this.src='/images/portada-default.png'" 
                     alt="${escapeHTML(prod.name)}">
                <div class="fav-badge-floating">${escapeHTML(pType)}</div>
                <div class="fav-card-overlay">
                    <button class="fav-play-btn" id="btn-play-${waveformId}">
                        <i class="bi bi-play-fill"></i>
                    </button>
                </div>
            </div>
            <div class="fav-card-body">
                <div class="fav-info-main">
                    <h4 class="fav-card-title" onclick="window.location.href='${seoUrl}'" style="cursor:pointer;">${cleanName(prod.name)}</h4>
                    <p class="fav-card-artist">${artistHtml}</p>
                </div>
                
                ${isMobile ? `
                    <div class="fav-card-waveform" id="${waveformId}"></div>
                    <div class="fav-card-tags">
                        <span class="fav-tag">${escapeHTML(pType)}</span>
                        ${subBadge ? `<span class="fav-tag">${escapeHTML(subBadge)}</span>` : ''}
                    </div>
                ` : `<!-- PC Simplified -->`}

                <div class="fav-card-footer">
                    <div class="footer-left">
                        <button class="fav-price-btn">${priceText}</button>
                    </div>
                    <div class="footer-center">
                        <button class="fav-icon-btn liked" title="Quitar de favoritos">
                            <i class="bi bi-heart-fill"></i>
                        </button>
                    </div>
                    <div class="footer-right">
                        ${isMobile ? `
                            <button class="fav-icon-btn mobile-action-btn" title="Compartir">
                                <i class="bi bi-share"></i>
                            </button>
                        ` : `
                            <button class="fav-icon-btn desktop-action-btn btn-more-options" title="Compartir">
                                <i class="bi bi-share"></i>
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;

        // --- ATTACH EVENT LISTENERS ---
        const playBtn = card.querySelector(`#btn-play-${waveformId}`);
        if (playBtn) {
            playBtn.onclick = (e) => {
                e.stopPropagation();
                handlePlayClick(card, prod);
            };
        }

        const priceBtn = card.querySelector('.fav-price-btn');
        if (priceBtn) {
            priceBtn.onclick = (e) => {
                e.stopPropagation();
                if (window.CartManager) window.CartManager.addItem(prod);
            };
        }

        const heartBtn = card.querySelector('.fav-icon-btn.liked');
        if (heartBtn) {
            heartBtn.onclick = (e) => {
                e.stopPropagation();
                window.FavoritesManager.toggleLike(prod.id, heartBtn);
            };
        }

        const shareBtn = card.querySelector('.mobile-action-btn[title="Compartir"]');
        if (shareBtn) {
            shareBtn.onclick = (e) => {
                e.stopPropagation();
                if (window.openShareModal) {
                    window.openShareModal(prod);
                } else {
                    // Fallback to native share if modal is missing for some reason
                    if (navigator.share) {
                        navigator.share({
                            title: prod.name,
                            text: `Mira este ${pType} en OFFSZN`,
                            url: window.location.origin + seoUrl
                        }).catch(err => { });
                    } else {
                        navigator.clipboard.writeText(window.location.origin + seoUrl);
                        if (window.Notifications) window.Notifications.success("Enlace copiado al portapapeles");
                    }
                }
            };
        }

        const shareBtnDesktop = card.querySelector('.btn-more-options');
        if (shareBtnDesktop) {
            shareBtnDesktop.onclick = (e) => {
                e.stopPropagation();
                if (window.openShareModal) {
                    window.openShareModal(prod);
                } else {
                    navigator.clipboard.writeText(window.location.origin + seoUrl).then(() => {
                        if (window.Notifications) window.Notifications.success("Enlace copiado al portapapeles");
                    });
                }
            };
        }

        // --- 🧪 IMAGE OPTIMIZATION (R2) ---
        if (typeof window.signR2Images === 'function') {
            setTimeout(() => window.signR2Images(card), 0);
        }

        return card;
    }

    // --- LAZY WAVESURFER LOGIC ---

    async function handlePlayClick(row, prod) {
        const waveformId = row.dataset.waveformId;
        const btn = document.getElementById(`btn-play-${waveformId}`);
        const audioUrl = row.dataset.audioUrl;

        // 1. GLOBAL PLAYER SYNC (Sticky Player)
        if (window.StickyPlayer && window.StickyPlayer.play) {
            const currentId = window.StickyPlayer.getCurrentTrackId();
            if (currentId == prod.id) {
                window.StickyPlayer.togglePlay();
                return;
            }
            window.StickyPlayer.updatePlaylist(cachedFavorites, 'favorites');
            window.StickyPlayer.play(prod);
            return;
        }

        // 2. LOCAL FALLBACK
        let ws = window.activeWavesurfers.find(w => w.customId === waveformId);
        if (!ws) {
            if (btn) btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
            try {
                const finalAudioUrl = window.getAuthorizedUrl ? await window.getAuthorizedUrl(audioUrl, prod.r2_version || 'v1') : audioUrl;
                ws = await lazyLoadWaveSurfer(waveformId, finalAudioUrl, row);
                ws.play();
                if (btn) btn.innerHTML = '<i class="bi bi-pause-fill"></i>';
                window.currentlyPlaying = ws;
            } catch (e) {
                if (btn) btn.innerHTML = '<i class="bi bi-exclamation-circle"></i>';
            }
        } else {
            ws.playPause();
        }
    }

    function lazyLoadWaveSurfer(containerId, url, row) {
        return new Promise((resolve, reject) => {
            if (!window.WaveSurfer) return reject("WaveSurfer lib not found");
            const containerEl = document.getElementById(containerId);
            if (!containerEl) return reject("Container not found");

            if (window.activeWavesurfers) {
                window.activeWavesurfers.forEach(w => w.pause());
            }

            const ws = WaveSurfer.create({
                container: containerEl,
                waveColor: 'rgba(255,255,255,0.1)',
                progressColor: '#8b5cf6',
                barWidth: 2,
                barGap: 3,
                barRadius: 2,
                height: 36,
                url: url,
                normalize: true,
                interact: true,
                cursorWidth: 0,
                backend: 'MediaElement'
            });

            ws.customId = containerId;
            containerEl.innerHTML = '';

            ws.on('ready', () => resolve(ws));
            ws.on('play', () => {
                const btn = document.getElementById(`btn-play-${containerId}`);
                if (btn) btn.innerHTML = '<i class="bi bi-pause-fill"></i>';
                window.activeWavesurfers.forEach(w => { if (w !== ws) w.pause(); });
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
                reject(err);
            });
            window.activeWavesurfers.push(ws);
        });
    }

    function setSearch(query) {
        currentSearch = query;
        const container = document.getElementById('favorites-grid');

        // Visual feedback for expandable search
        const searchBox = document.getElementById('favSearchBox');
        if (searchBox) {
            searchBox.classList.toggle('has-value', query.length > 0);
        }

        if (container) applyFilters('favorites-grid');
    }

    function isLiked(id) { return likedItemIds.has(String(id)); }
    function subscribe(cb) { subscribers.push(cb); cb(likedItemIds); }
    function notifySubscribers() { subscribers.forEach(cb => cb(likedItemIds)); }

    // --- REALTIME SYNC & ANIMATION ---
    function handleRealtimeUpdates(currentIds) {
        // Find if any currently displayed card is no longer liked
        const cards = document.querySelectorAll('.fav-product-card[data-product-id]');
        let hasRemoval = false;

        cards.forEach(card => {
            if (!currentIds.has(String(card.dataset.productId))) {
                hasRemoval = true;
            }
        });

        // If something was removed, trigger the silent reload with skeletons
        if (hasRemoval) {
            // Check if we are already in a delay/skeleton state to avoid loops
            if (window._isSilentReloading) return;
            window._isSilentReloading = true;

            window.FavoritesManager.renderFavorites('favorites-grid', true);

            setTimeout(() => {
                window._isSilentReloading = false;
            }, 1000);
        }
    }

    function checkEmptyState() {
        const container = document.getElementById('favorites-grid');
        if (container) {
            const visibleCards = container.querySelectorAll('.fav-product-card:not(.fav-fade-out)');
            if (visibleCards.length === 0) {
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

    function shareProduct(id) {
        // Find product by id in cachedFavorites
        const prod = cachedFavorites.find(p => String(p.id) === String(id));
        if (!prod) return;
        const pType = (prod.product_type || 'beat').toUpperCase();
        const seoUrl = window.createSeoLink ? window.createSeoLink(prod) : '#';

        if (navigator.share) {
            navigator.share({
                title: prod.name,
                text: `Mira este ${pType} en OFFSZN`,
                url: window.location.origin + seoUrl
            }).catch(err => {});
        } else {
            navigator.clipboard.writeText(window.location.origin + seoUrl);
            if (window.toast) window.toast.show("Enlace copiado al portapapeles", "info");
        }
    }

    function showOptions(id, el) {
        if (window.toast) window.toast.show("Opciones pronto disponibles", "info");
    }

    return {
        init,
        toggleLike,
        isLiked,
        subscribe,
        renderFavorites,
        setSearch,
        setFilterType,
        handlePlayClick,
        shareProduct,
        showOptions
    };
})();

// --- REFINED INITIALIZATION ---
(function() {
    const runInit = () => {
        if (window.FavoritesManager && typeof window.FavoritesManager.init === 'function') {
            window.FavoritesManager.init();
        }
    };

    // 1. Try immediately if we have a token
    if (localStorage.getItem('authToken') || (window.AuthUtils && window.AuthUtils.getAccessToken())) {
        runInit();
    }

    // 2. Also listen for standard events
    document.addEventListener('DOMContentLoaded', () => {
        window.addEventListener('offszn-session-ready', (e) => {
            if (e.detail.session) runInit();
        });
        if (window.supabaseClient) runInit();
    });
})();
