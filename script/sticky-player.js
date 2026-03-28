/**
 * STICKY AUDIO PLAYER with WaveSurfer
 * Enhanced with Playlist Management & Next/Previous Navigation
 */

window.StickyPlayer = (function () {
    let container = null;
    let ws = null;
    let currentTrack = null;
    let isPlaying = false;
    let volume = 0.8;
    let els = {};
    let globalAudioEl = null; // Track global audio to prevent overlaps

    // PLAYLIST MANAGEMENT
    let playlist = []; // Array of track objects
    let currentIndex = -1; // Current track index in playlist
    let currentArtist = null; // Current artist username
    let playHistory = []; // Random exclusion list
    let navigationHistory = []; // Stack for "Previous" button
    let isNavigatingHistory = false;
    let playTimeout = null;
    let lastSyncTime = 0;
    let loadingTrackId = null; // Race condition protection

    // Playback Tracking (Global to survive ws instance reuse)
    let actualPlayTime = 0;
    let lastTime = 0;

    // PERSISTENCE KEYS (kept for potential future use or session handling, but disabled on load)
    const STORAGE_KEY_STATE = 'sticky_player_state';
    const STORAGE_KEY_PLAYLIST = 'sticky_player_playlist';

    function isPresetProduct(p) {
        if (!p) return false;
        const type = (p.product_type || '').toLowerCase();
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
        if (document.getElementById('sticky-player-bar')) return;

        const html = `
        <div id="sticky-player-bar">
            <div class="sp-left">
                <img id="sp-cover" class="sp-cover" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" alt="Cover">
                <div class="sp-info-text">
                    <div id="sp-title" class="sp-title">--</div>
                    <div id="sp-artist" class="sp-artist">--</div>
                    <div id="sp-badges" class="sp-badges" style="display:flex; gap:4px; margin-top:2px;"></div>
                </div>
                <div class="sp-actions">
                    <button class="sp-icon-btn" id="sp-like-btn" title="Favorito"><i class="bi bi-heart"></i></button>
                    <button class="sp-icon-btn" id="sp-share-btn" title="Compartir"><i class="bi bi-share"></i></button>
                    <button class="sp-icon-btn" id="sp-dl-btn" title="Ir al producto"><i class="bi bi-download"></i></button>
                </div>
            </div>

            <div class="sp-center">
                <div class="sp-progress-row">
                    <span id="sp-current-time">0:00</span>
                    <div id="sp-waveform" class="sp-waveform-container"></div>
                    <span id="sp-total-time">--:--</span>
                </div>
                <div class="sp-controls-row">
                    <button class="sp-ctrl-btn" id="sp-prev-btn"><i class="bi bi-skip-start-fill"></i></button>
                    <button class="sp-ctrl-btn sp-play-btn" id="sp-play-btn"><i class="bi bi-play-fill" style="margin-left:2px"></i></button>
                    <button class="sp-ctrl-btn" id="sp-next-btn"><i class="bi bi-skip-end-fill"></i></button>
                </div>
            </div>

            <div class="sp-right">
                <div class="sp-volume-container">
                    <button class="sp-icon-btn"><i class="bi bi-volume-up-fill" id="sp-vol-icon"></i></button>
                    <div class="sp-vol-slider-wrapper">
                        <div class="sp-vol-track" id="sp-vol-track">
                            <div class="sp-vol-fill" id="sp-vol-fill" style="height: 80%;"></div>
                        </div>
                    </div>
                </div>
                <button class="sp-secondary-btn" id="sp-secondary-btn" style="display:none; background:rgba(255,255,255,0.05); border:1px solid #333; color:#fff; border-radius:20px; padding:8px 16px; font-size:0.85rem; font-weight:700; cursor:pointer; align-items:center; gap:6px; transition:0.2s;">
                    <i class="bi bi-eye"></i> <span>DETALLES</span>
                </button>
                <button class="sp-buy-btn" id="sp-buy-btn">
                    <i class="bi bi-cart-plus"></i> <span id="sp-price-label">FREE</span>
                </button>
            </div>
        </div >
            `;

        document.body.insertAdjacentHTML('beforeend', html);
        container = document.getElementById('sticky-player-bar');

        els = {
            cover: document.getElementById('sp-cover'),
            title: document.getElementById('sp-title'),
            artist: document.getElementById('sp-artist'),
            playBtn: document.getElementById('sp-play-btn'),
            prevBtn: document.getElementById('sp-prev-btn'),
            nextBtn: document.getElementById('sp-next-btn'),
            currTime: document.getElementById('sp-current-time'),
            totalTime: document.getElementById('sp-total-time'),
            volTrack: document.getElementById('sp-vol-track'),
            volFill: document.getElementById('sp-vol-fill'),
            buyBtn: document.getElementById('sp-buy-btn'),
            priceLabel: document.getElementById('sp-price-label'),
            secondaryBtn: document.getElementById('sp-secondary-btn')
        };

        // Event Listeners
        els.playBtn.onclick = togglePlay;
        els.prevBtn.onclick = playPrevious;
        els.nextBtn.onclick = playNext;

        // Volume Drag Logic
        setupVolumeDrag();
        updateVolumeUI(volume);

        // Navigation Click Logic
        const navigateToProduct = () => {
            if (currentTrack) {
                const seoLink = window.createSeoLink ? window.createSeoLink(currentTrack) : `/producto.html?id=${currentTrack.id}`;
                window.location.href = seoLink;
            }
        };
        els.title.onclick = navigateToProduct;
        els.cover.onclick = navigateToProduct;

        // -- BUY/DOWNLOAD BUTTONS --
        if (els.buyBtn) {
            els.buyBtn.onclick = (e) => {
                e.stopPropagation();
                handleBuyClick();
            };
        }

        if (els.secondaryBtn) {
            els.secondaryBtn.onclick = (e) => {
                e.stopPropagation();
                if (currentTrack && currentTrack.is_custom_request && window.showRequestDetails) {
                    window.showRequestDetails(currentTrack.request_data);
                }
            };
        }

        const dlBtn = document.getElementById('sp-dl-btn');
        if (dlBtn) {
            dlBtn.onclick = (e) => {
                e.stopPropagation();
                handleDownloadClick();
            };
        }

        const shareBtn = document.getElementById('sp-share-btn');
        if (shareBtn) {
            shareBtn.onclick = (e) => {
                e.stopPropagation();
                handleShareClick();
            };
        }

        // -- FAVORITES INTEGRATION --
        const likeBtn = document.getElementById('sp-like-btn');
        if (likeBtn) {
            likeBtn.onclick = (e) => {
                e.stopPropagation();
                if (window.FavoritesManager && currentTrack) {
                    // --- GUEST GUARD ---
                    const token = window.getAccessToken ? window.getAccessToken() : null;
                    if (!token || !window.currentUserId) {
                        if (window.showGuestModal) {
                            window.showGuestModal(
                                "¡Te gusta este beat!",
                                "Inicia sesión para guardar tus favoritos en tu perfil y descargarlos más tarde."
                            );
                        } else {
                            window.location.href = '/pages/login.html';
                        }
                        return;
                    }

                    const ownerId = currentTrack.user_id || (currentTrack.artist_users ? currentTrack.artist_users.id : null);
                    window.FavoritesManager.toggleLike(currentTrack.id, likeBtn, ownerId);
                } else {
                    console.warn("FavoritesManager not loaded or no track");
                }
            };
        }

        // -- NO RESTORE (BeatStars Style) --
        // User requested to clear player on reload to avoid loading issues.
        // restoreState(); 


        // Save state loop
        setInterval(saveState, 5000);
        window.addEventListener('beforeunload', saveState);

        // Subscribe to global changes
        if (window.FavoritesManager) {
            window.FavoritesManager.subscribe((likedIds) => {
                if (currentTrack) {
                    const isLiked = likedIds.has(String(currentTrack.id));
                    updateLikeIcon(isLiked);
                }
            });
        }
    }

    function updateLikeIcon(isLiked) {
        const btn = document.getElementById('sp-like-btn');
        if (!btn) return;

        if (isLiked) {
            btn.innerHTML = '<i class="bi bi-heart-fill"></i>';
            btn.style.color = '#ef4444'; // Red
        } else {
            btn.innerHTML = '<i class="bi bi-heart"></i>';
            btn.style.color = ''; // Default
        }
    }

    function saveState() {
        if (!currentTrack) return;
        const state = {
            currentIndex,
            currentTime: ws ? ws.getCurrentTime() : 0,
            isPlaying: isPlaying,
            volume,
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
        localStorage.setItem(STORAGE_KEY_PLAYLIST, JSON.stringify(playlist));
    }

    function restoreState() {
        try {
            const rawPl = localStorage.getItem(STORAGE_KEY_PLAYLIST);
            const rawSt = localStorage.getItem(STORAGE_KEY_STATE);
            if (!rawPl || !rawSt) return;

            const savedPlaylist = JSON.parse(rawPl);
            const savedState = JSON.parse(rawSt);

            // Freshness check (1 hour)
            if (Date.now() - savedState.timestamp > 3600000) return;

            if (savedPlaylist.length > 0 && savedState.currentIndex > -1) {
                playlist = savedPlaylist;
                currentIndex = savedState.currentIndex;
                volume = savedState.volume || 0.8;
                updateVolumeUI(volume);

                const track = playlist[currentIndex];
                // Auto-play on reload is blocked by browsers (AudioContext policy).
                // Best practice: Restore track/position but keep it PAUSED.
                // const shouldAutoPlay = savedState.isPlaying; // OLD
                const shouldAutoPlay = false; // NEW: Always pause on reload
                loadTrack(track, shouldAutoPlay);

                // Seek after load (needs event listener usually, but loadTrack simplifies)
                // We will rely on loadTrack handling.
                // Correction: loadTrack in this file (which I assume exists below) usually initializes player.
                // If I can't see loadTrack implementation, I blindly accept it exists.
                if (ws) {
                    ws.on('ready', () => {
                        ws.seekTo(savedState.currentTime / ws.getDuration());
                    });
                }
            }
        } catch (e) {
            console.warn("Restore failed", e);
        }
    }

    // UPDATE PLAYLIST (Called from profile-public.js)
    function updatePlaylist(newList, contextName = 'unknown') {
        if (!newList || !Array.isArray(newList)) return;
        playlist = newList;
        // console.log(`[StickyPlayer] Playlist updated: ${playlist.length} tracks from ${currentArtist} `);
    }

    // Unified Load Logic
    async function loadTrack(trackData, autoPlay = true, startTime = 0) {
        if (!container) init();
        const thisTrackId = String(trackData.id);
        loadingTrackId = thisTrackId;

        container.classList.add('visible');

        // History Logic: Push OLD track to history BEFORE switching
        if (!isNavigatingHistory && currentTrack && String(currentTrack.id) !== thisTrackId) {
            navigationHistory.push(currentTrack);
            if (navigationHistory.length > 50) navigationHistory.shift();
        }
        isNavigatingHistory = false;

        // Set current track ONCE (was previously set 3 times causing bugs)
        currentTrack = trackData;

        // Remove skeleton classes
        if (els.title) els.title.classList.remove('skeleton-text');
        if (els.artist) els.artist.classList.remove('skeleton-text');
        const wfContainer = document.getElementById('sp-waveform');
        if (wfContainer) wfContainer.classList.remove('skeleton-waveform');

        // --- FAVORITES SYNC ---
        if (window.FavoritesManager) {
            updateLikeIcon(window.FavoritesManager.isLiked(trackData.id));
        }

        // --- HISTORY RECORDING ---
        if (window.incrementProductStat) {
            window.incrementProductStat(trackData.id, 'plays_count');
        }

        resetAllListButtons();
        lastSyncTime = 0;
        if (window.activeWavesurfers) {
            window.activeWavesurfers.forEach(wsItem => {
                try { wsItem.seekTo(0); } catch (e) { }
            });
        }

        // Remove old playTimeout (legacy cleanup)
        if (typeof playTimeout !== 'undefined' && playTimeout) clearTimeout(playTimeout);

        // Reset global playback tracking for the new track
        actualPlayTime = 0;
        lastTime = 0;
        currentTrack.hasBeenCounted = false;

        // Update playlist index if valid
        if (playlist.length > 0) {
            const idx = playlist.findIndex(t => t.id === trackData.id);
            if (idx >= 0) currentIndex = idx;
        }

        // UI Updates - Run immediately before downloading audio
        updateListButton(currentTrack, false); // Initialize as paused

        // Remove skeleton classes instantly 
        if (els.title) els.title.classList.remove('skeleton-text');
        if (els.artist) els.artist.classList.remove('skeleton-text');

        const cleanName = (name) => {
            if (!name) return 'Untitled';
            return name.replace(/_/g, ' ').replace(/\.(mp3|wav|zip|rar)$/i, '').replace(/\s+/g, ' ').trim();
        };
        els.title.innerText = cleanName(trackData.name);
        els.artist.innerHTML = '';

        // Resolve Producer/Artist Data
        let pData = trackData.artist_users || trackData.producer || trackData.producer_data;
        if (Array.isArray(pData)) pData = pData[0];

        if (pData && (pData.nickname || pData.name)) {
            els.artist.appendChild(createHoverSpan(pData));
        } else {
            const fallbackName = trackData.producer_nickname || trackData.producer_name || trackData.artist_name || 'OFFSZN Artist';
            els.artist.innerText = fallbackName;
        }

        // Badges Logic - Cleared per user request
        const badgesContainer = document.getElementById('sp-badges');
        if (badgesContainer) {
            badgesContainer.innerHTML = '';
        }

        // Cover - 🔥 FIX: Smart R2 Loading
        const rawImg = trackData.image_url || '';
        const isR2 = rawImg.includes('r2.cloudflarestorage.com') || rawImg.includes('pub-') || (!rawImg.startsWith('http') && rawImg.includes('/'));

        if (isR2) {
            els.cover.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        } else {
            els.cover.src = rawImg || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        }

        if (rawImg) {
            window.getAuthorizedUrl(rawImg, trackData.r2_version || 'v1', trackData.id).then(url => {
                if (url) {
                    els.cover.onload = () => {
                        if (els.cover.parentElement) els.cover.parentElement.classList.remove('skeleton');
                        els.cover.style.opacity = '1';
                    };
                    els.cover.style.opacity = '0';
                    els.cover.style.transition = 'opacity 0.3s ease';
                    els.cover.src = url;
                    if (els.cover.complete && els.cover.naturalWidth > 0) els.cover.onload();
                }
            });
        } else {
            if (els.cover.parentElement) els.cover.parentElement.classList.remove('skeleton');
        }

        const audioUrl = getProductAudio(trackData);

        // Update Price Label & Buttons (BeatStars Style)
        if (els.priceLabel) {
            if (trackData.is_custom_request) {
                // Custom Request Mode
                els.secondaryBtn.style.display = 'flex';
                els.priceLabel.innerText = 'TOMAR TRABAJO';
                if (els.buyBtn) {
                    const icon = els.buyBtn.querySelector('i');
                    if (icon) icon.className = 'bi bi-briefcase';

                    // Owner check
                    const currentUserId = window.currentUserId || localStorage.getItem('userId');
                    const isOwnRequest = currentUserId === trackData.artist_users?.id;
                    if (isOwnRequest) {
                        els.buyBtn.disabled = true;
                        els.priceLabel.innerText = 'TU SOLICITUD';
                        els.buyBtn.style.opacity = '0.5';
                    } else {
                        els.buyBtn.disabled = false;
                        els.buyBtn.style.opacity = '1';
                    }
                }
            } else {
                // Regular Product Mode
                els.secondaryBtn.style.display = 'none';
                // --- PRICING LOGIC FIX ---
                // For beats, we only show 'FREE' if price_basic is 0 (explicitly set as a free license).
                // Many beats have is_free=true meaning 'Free Download' (demo) is allowed, but they still have paid licenses.
                const isBeat = trackData.product_type === 'beat';
                const rawPrice = trackData.price_basic !== undefined && trackData.price_basic !== null ? parseFloat(trackData.price_basic) : null;
                
                const isTrulyFree = isBeat ? (rawPrice === 0) : (trackData.is_free === true || String(trackData.is_free) === 'true' || rawPrice === 0);

                els.priceLabel.innerText = isTrulyFree ? 'FREE' : (window.CurrencyManager && rawPrice !== null ? window.CurrencyManager.format(rawPrice) : (rawPrice !== null ? `$${rawPrice}` : '—'));
                if (els.buyBtn) {
                    const icon = els.buyBtn.querySelector('i');
                    if (icon) icon.className = 'bi bi-cart-plus';
                    els.buyBtn.disabled = false;
                    els.buyBtn.style.opacity = '1';
                }
            }
        }

        // Ensure we have audioUrl
        if (!audioUrl) return;

        // 🔥 ZERO LATENCY FIX & SYNC GESTURE FIX: 
        // If it's a public Cloudflare URL, DO NOT AWAIT. Awaiting breaks the mobile user gesture token 
        // in Safari/Chrome which causes the browser to pause audio until network idle (the 10 second delay).
        let finalAudioUrl = audioUrl;
        if (audioUrl.includes('pub-') && audioUrl.includes('.r2.dev')) {
            finalAudioUrl = audioUrl; // Synchronous, keeping gesture alive
        } else {
            finalAudioUrl = await window.getAuthorizedUrl(audioUrl, trackData.storage_version || trackData.r2_version || 'v2', trackData.id);
        }

        // --- RACE CONDITION CHECK ---
        if (loadingTrackId !== thisTrackId) {
            console.log(`[StickyPlayer] Ignoring outdated load for ${trackData.name}`);
            return;
        }

        // --- INSTANT WAVESURFER & AUDIO SWAP ---
        if (!ws) {
            // First time setup
            // Append audio to DOM for higher Priority
            globalAudioEl = document.createElement('audio');
            // crossOrigin removed to prevent CORB with R2 signed URLs
            globalAudioEl.style.display = "none";
            document.body.appendChild(globalAudioEl);

            ws = WaveSurfer.create({
                container: '#sp-waveform',
                media: globalAudioEl,
                waveColor: '#333',
                progressColor: '#fff',
                cursorColor: '#fff',
                cursorWidth: 2,
                barWidth: 2,
                barGap: 2,
                barRadius: 2,
                height: 40,
                normalize: true,
                interact: true,
                fillParent: true,
                autoCenter: false,
                minPxPerSec: 0,
                hideScrollbar: true,
                partialRender: true,
                backend: 'MediaElement'
            });
            const currentWs = ws;

            // Event Handlers for FRESH instance
            currentWs.on('ready', () => {
                if (ws !== currentWs) return;
                if (wfContainer) wfContainer.classList.remove('skeleton-waveform');
                if (els.totalTime) els.totalTime.innerText = formatTime(currentWs.getDuration());

                setTimeout(() => {
                    if (currentWs && currentWs.renderer) {
                        try { currentWs.renderer.reRender(); } catch (e) { }
                    }
                }, 100);

                if (startTime > 0) {
                    const duration = currentWs.getDuration();
                    if (duration > 0) currentWs.seekTo(startTime / duration);
                }
            });

            // 🔥 FIX: WAVEFORM DISAPPEARANCE BUG (Force Redraw Loop)
            currentWs.on('ready', () => {
                if (ws !== currentWs) return;
                if (wfContainer) wfContainer.classList.remove('skeleton-waveform');
                if (els.totalTime) els.totalTime.innerText = formatTime(currentWs.getDuration());

                const forceRender = () => {
                    if (currentWs && currentWs.renderer) {
                        try { window.dispatchEvent(new Event('resize')); } catch (e) { }
                    }
                };

                [50, 150, 300, 500, 1000].forEach(ms => setTimeout(forceRender, ms));
            });

            // Robust Resize Observer
            if (window.ResizeObserver && wfContainer) {
                const resizeObserver = new ResizeObserver(() => {
                    if (ws === currentWs) {
                        if (window._wsResizeTimer) clearTimeout(window._wsResizeTimer);
                        window._wsResizeTimer = setTimeout(() => {
                            try { window.dispatchEvent(new Event('resize')); } catch (e) { }
                        }, 50);
                    }
                });
                resizeObserver.observe(wfContainer);
            }

            // High frequency sync logic
            currentWs.on('timeupdate', () => {
                if (ws !== currentWs) return;
                const time = currentWs.getCurrentTime();
                els.currTime.innerText = formatTime(time);

                const now = Date.now();
                if (now - lastSyncTime > 50) {
                    syncListWaveform(currentTrack, time);
                    lastSyncTime = now;
                }

                if (currentTrack && !currentTrack.hasBeenCounted && isPlaying) {
                    if (lastTime > 0 && time > lastTime && (time - lastTime) < 1.0) {
                        actualPlayTime += (time - lastTime);
                    }
                    if (actualPlayTime >= 30) {
                        window.incrementProductStat(currentTrack.id, 'plays_count');
                        // console.log(`[StickyPlayer] Play counted for ${currentTrack.name}`);
                        currentTrack.hasBeenCounted = true; // Mark locally as well
                    }
                }
                lastTime = time;
            });

            currentWs.on('seeking', () => {
                if (ws !== currentWs) return;
                if (globalAudioEl) {
                    const time = currentWs.getCurrentTime();
                    if (Math.abs(globalAudioEl.currentTime - time) > 0.1) {
                        globalAudioEl.currentTime = time;
                    }
                }
                lastTime = currentWs.getCurrentTime();
            });

            // End of ws bindings
        } else {
            // Swapping existing instance
            if (globalAudioEl) {
                globalAudioEl.pause();
            }
            // Visually keep the old waveform until load finishes
        }

        // SWAP TRACK DATA INSTANTLY ON EXISTING INSTANCE
        ws.setVolume(volume);

        // This natively commands the underlying `media` element to swap sources
        // and keeps the waveform visually intact until the new one finishes parsing
        ws.load(finalAudioUrl);

        // --- ERROR HANDLING & SUPABASE FALLBACK ---
        ws.once('error', (err) => {
            if (loadingTrackId !== thisTrackId) return;
            console.warn(`[StickyPlayer] Audio load failed for ${trackData.name}:`, err);
            
            // If we're here, all attempts failed
            if (window.showToast) window.showToast('Error al cargar el audio. El archivo podría no estar disponible.', 'error');
            resetAllListButtons();
            isPlaying = false;
            updatePlayBtn();
        });

        ws.once('ready', () => {
            if (loadingTrackId !== thisTrackId) return; // Race condition check

            if (startTime > 0) {
                const duration = ws.getDuration();
                if (duration > 0) ws.seekTo(startTime / duration);
            } else {
                ws.seekTo(0);
            }

            if (autoPlay) {
                globalAudioEl.play().catch(e => console.warn("Auto-play blocked", e));
                isPlaying = true;
            } else {
                globalAudioEl.pause();
                isPlaying = false;
            }
            updatePlayBtn();
            updateListButton(currentTrack, isPlaying);
            syncListWaveform(currentTrack, ws.getCurrentTime());
            if (els.totalTime) els.totalTime.innerText = formatTime(ws.getDuration());
        });

        // --- PRELOAD NEXT TRACK (Beatstars Style Optimization) ---
        preloadNextTrack();
    }

    // Standard Play (calls loadTrack)
    function play(trackData) {
        if (!trackData) return;

        // If same track, just toggle instead of reloading everything
        // Use String() to prevent precision loss or BigInt mismatch
        if (currentTrack && String(currentTrack.id) === String(trackData.id)) {
            togglePlay();
            return;
        }

        loadTrack(trackData, true, 0);
    }


    function syncListWaveform(track, time) {
        if (!track || !track.id) return;

        // Try to find the list of active wavesurfers (could be in window or local depending on page)
        const surfers = window.activeWavesurfers || [];
        if (surfers.length === 0) return;

        surfers.forEach(wsItem => {
            if (!wsItem || !wsItem.customId) return;

            // Strict match for track ID to prevent partial match collisions (e.g. ID 1 matching 10)
            const tid = String(track.id);
            const regex = new RegExp(`-${tid}-|-${tid}$`);
            const isMatch = wsItem.customId && wsItem.customId.match(regex);

            if (isMatch) {
                // Ensure the container is still in the DOM
                const container = document.getElementById(wsItem.customId);
                if (!container) return;

                const dur = wsItem.getDuration() || (ws ? ws.getDuration() : 0);
                if (dur > 0) {
                    // Absolute seek to ratio for guaranteed UI sync
                    wsItem.seekTo(time / dur);
                }
            }
        });
    }

    function togglePlay() {
        if (!ws || !globalAudioEl) return;

        if (isPlaying) {
            globalAudioEl.pause();
            isPlaying = false;
        } else {
            globalAudioEl.play();
            isPlaying = true;
        }

        updatePlayBtn();
        updateListButton(currentTrack, isPlaying);

        // Sync pause to list ws
        if (!isPlaying && window.activeWavesurfers) {
            window.activeWavesurfers.forEach(item => {
                if (item.isPlaying()) item.pause();
            });
        }
    }

    function updatePlayBtn() {
        els.playBtn.innerHTML = isPlaying ?
            '<i class="bi bi-pause-fill"></i>' :
            '<i class="bi bi-play-fill" style="margin-left:2px"></i>';
    }

    function updateListButton(track, playing) {
        if (!track || !track.id) return;

        // Selector: Matches any button containing "btn-play-waveform-" AND the track ID
        // We use a regex match on the ID list to ensure we don't match partial IDs (e.g. ID 1 matching 10)
        const tid = String(track.id);
        const btns = document.querySelectorAll(`[id^="btn-play-waveform-"]`);

        btns.forEach(btn => {
            const idParts = btn.id.split('-');
            // Typical ID format: btn-play-waveform-ID-suffix
            // We check if the ID part matches our track ID
            if (idParts.includes(tid)) {
                btn.innerHTML = playing ?
                    '<i class="bi bi-pause-fill"></i>' :
                    '<i class="bi bi-play-fill"></i>';
            }
        });
    }

    function resetAllListButtons() {
        // Resets ALL play buttons in the DOM to the "Play" state
        const allPlayBtns = document.querySelectorAll('[id^="btn-play-"]');
        allPlayBtns.forEach(btn => {
            btn.innerHTML = '<i class="bi bi-play-fill" style="margin-left:2px;"></i>';
        });
    }

    function setupVolumeDrag() {
        let isDragging = false;

        const handleVolumeMove = (e) => {
            const rect = els.volTrack.getBoundingClientRect();
            // Invert logic: offsetY from BOTTOM of track (since it fills from bottom)
            // rect.bottom is the Y coordinate of the bottom edge
            // e.clientY is cursor Y
            // diff = rect.bottom - e.clientY
            const offsetY = rect.bottom - e.clientY;
            let percent = offsetY / rect.height;

            if (percent < 0) percent = 0;
            if (percent > 1) percent = 1;

            volume = percent;
            if (ws) ws.setVolume(volume);
            updateVolumeUI(volume);
        };

        const stopDrag = () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = ''; // Restore selection
                window.removeEventListener('mousemove', handleVolumeMove);
                window.removeEventListener('mouseup', stopDrag);
            }
        };

        els.volTrack.onmousedown = (e) => {
            isDragging = true;
            document.body.style.userSelect = 'none'; // Prevent text selection
            handleVolumeMove(e); // Update immediately on click
            window.addEventListener('mousemove', handleVolumeMove);
            window.addEventListener('mouseup', stopDrag);
        };

        // Also allow clicking on wrapper to jump, but careful with dragging behavior
        // For now, track mousedown is sufficient provided track is wide enough.
    }

    // Deprecated simple changeVolume, replaced by handleVolumeMove inside setupVolumeDrag
    // function changeVolume(e) { ... }

    function updateVolumeUI(vol) {
        els.volFill.style.height = `${vol * 100}% `;
        const icon = document.getElementById('sp-vol-icon');
        if (vol === 0) icon.className = 'bi bi-volume-mute-fill';
        else if (vol < 0.5) icon.className = 'bi bi-volume-down-fill';
        else icon.className = 'bi bi-volume-up-fill';
    }

    function formatTime(s) {
        if (isNaN(s)) return '0:00';
        const mins = Math.floor(s / 60);
        const secs = Math.floor(s % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs} `;
    }

    function createHoverSpan(userData) {
        const span = document.createElement('span');
        span.className = 'artist-hover-trigger';
        const minimalData = {
            nickname: userData.nickname || 'User',
            id: userData.id,
            avatar_url: userData.avatar_url,
        };
        span.setAttribute('data-artist', JSON.stringify(minimalData));
        span.innerText = userData.nickname || 'User';

        span.onmouseenter = (e) => window.showArtistCard && window.showArtistCard(e, span);
        span.onmouseleave = (e) => window.hideArtistCard && window.hideArtistCard(e, span);
        span.onclick = (e) => {
            e.stopPropagation();
            if (userData.nickname) window.location.href = `/@${userData.nickname}`;
        };

        return span;
    }

    function seekTo(time) {
        if (ws && ws.getDuration()) {
            if (Math.abs(ws.getCurrentTime() - time) > 0.1) {
                ws.setTime(time);
            }
        }
    }

    function getCurrentTrackId() {
        return currentTrack ? String(currentTrack.id) : null;
    }

    // NEXT TRACK - Sequential with random fallback
    function playNext() {
        if (!currentTrack) return;

        let nextTrack = null;

        // Try to find next in playlist
        if (playlist.length > 0 && currentIndex >= 0) {
            const nextIdx = currentIndex + 1;

            if (nextIdx < playlist.length) {
                // Sequential: Move to next track
                nextTrack = playlist[nextIdx];
                currentIndex = nextIdx;
            } else {
                // Reached end of playlist - Random from pool
                nextTrack = getNextRandomTrack();
            }
        } else {
            // Fallback: Random from pool
            nextTrack = getNextRandomTrack();
        }

        if (nextTrack) {
            play(nextTrack);
        }
    }

    // PREVIOUS TRACK - History Based -> Cyclic
    function playPrevious() {
        // 1. Try History Stack
        if (navigationHistory.length > 0) {
            const prevTrack = navigationHistory.pop();
            isNavigatingHistory = true; // Don't push current track to history
            play(prevTrack);
            return;
        }

        // 2. Fallback: Playlist Cyclic
        if (!currentTrack) return;
        let prevTrack = null;

        if (playlist.length > 0 && currentIndex >= 0) {
            let prevIdx = currentIndex - 1;
            if (prevIdx < 0) prevIdx = playlist.length - 1;
            prevTrack = playlist[prevIdx];
            currentIndex = prevIdx; // Update index logic
        } else {
            prevTrack = getNextRandomTrack();
        }

        if (prevTrack) {
            play(prevTrack);
        }
    }

    // Get random track from current context (no repeats until all played)
    function getNextRandomTrack() {
        if (playlist.length === 0) return null;

        // Filter tracks not in history
        let available = playlist.filter(t => !playHistory.includes(t.id));

        // If all played, reset local play history
        if (available.length === 0) {
            playHistory = [];
            available = playlist.slice(); // Copy all
        }

        // Exclude current track (if possible, to avoid immediate repeat)
        if (available.length > 1) {
            available = available.filter(t => t.id !== currentTrack.id);
        }

        if (available.length === 0) return null;

        // Random selection
        const randomIdx = Math.floor(Math.random() * available.length);
        const randomTrack = available[randomIdx];

        // Update index to match (if in playlist)
        const idxInPlaylist = playlist.findIndex(t => t.id === randomTrack.id);
        if (idxInPlaylist >= 0) {
            currentIndex = idxInPlaylist;
        }

        return randomTrack;
    }

    // CLOSE PLAYER
    function close() {
        if (!container) return;
        container.classList.remove('visible');
        if (ws && isPlaying) {
            ws.pause();
            isPlaying = false;
            updatePlayBtn();
        }
    }

    async function trackPlay(id) {
        try {
            // 1. Fetch current count (to be accurate)
            const { data, error: fetchErr } = await window.supabaseClient
                .from('products')
                .select('plays_count')
                .eq('id', id)
                .single();

            if (fetchErr) throw fetchErr;

            if (fetchErr) throw fetchErr;

            const newCount = (data.play_count || 0) + 1;
            await window.supabaseClient
                .from('products')
                .update({ play_count: newCount })
                .eq('id', id);

            // console.log(`[StickyPlayer] Play counted for ${id}. New total: ${newCount}`);
        } catch (e) {
            console.warn("Play count error:", e);
        }
    }

    // Helper to read cookie (if not globally available)
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    function isPlayingState() {
        return isPlaying;
    }

    async function trackPlay(id) {
        window.incrementProductStat(id, 'plays_count');
    }

    async function trackDownload(id) {
        window.incrementProductStat(id, 'downloads_count');
    }

    function handleDownloadClick() {
        if (!currentTrack) return;

        // "descargar = ir al producto" - Per user request
        const seoLink = window.createSeoLink ? window.createSeoLink(currentTrack) : `/producto.html?id=${currentTrack.id}`;
        window.location.href = seoLink;
    }

    function handleShareClick() {
        if (currentTrack && window.openShareModal) {
            window.openShareModal(currentTrack);
        } else {
            console.warn("Share modal not available or no track loaded.");
        }
    }

    async function handleBuyClick() {
        if (!currentTrack) return;

        // --- CUSTOM REQUEST LOGIC ---
        if (currentTrack.is_custom_request && currentTrack.request_data) {
            // Re-use logic from feed.js
            if (window.handleClaimRequest) {
                window.handleClaimRequest(currentTrack.request_data.id, els.buyBtn);
            } else {
                // Fallback: alert if function not found
                alert("Para tomar el trabajo utiliza el botón en la tarjeta principal.");
            }
            return;
        }

        const price = parseFloat(currentTrack.price_basic) || 0;
        const isFree = (currentTrack.is_free === true || String(currentTrack.is_free) === 'true' || price === 0) && currentTrack.product_type !== 'beat';

        if (isFree) {
            // Free product: just open download gate
            handleDownloadClick();
            return;
        }

        // --- PAID PRODUCT LOGIC ---
        // 1. Ensure modal is available
        if (window.openLicenseComparisonModal) {
            // 2. Fetch/Construct Licenses
            if (!currentTrack.available_licenses) {
                const lics = await fetchProductLicenses(currentTrack);
                currentTrack.available_licenses = lics;
            }

            // 3. Open Modal
            window.openLicenseComparisonModal(currentTrack.available_licenses);
        } else {
            // Fallback to product page if modal not available
            const seoLink = window.createSeoLink ? window.createSeoLink(currentTrack) : `/producto.html?id=${currentTrack.id}`;
            window.location.href = seoLink;
        }
    }

    /**
     * UNIFIED LICENSE FETCH (Supports Beats, Kits, Presets)
     */
    async function fetchProductLicenses(track) {
        try {
            const productType = (track.product_type || '').toLowerCase();

            // KITS / PRESETS: Construct a single "Standard" license
            if (productType !== 'beat') {
                return [{
                    id: 'basic',
                    name: productType === 'preset' ? 'Preset License' : (productType === 'loopkit' ? 'Loop Kit License' : 'Standard License'),
                    price: parseFloat(track.price_basic) || 0,
                    enabled: true,
                    streams: 'N/A',
                    sales: 'ILIMITADO',
                    radio: 'N/A',
                    files: { mp3: true, wav: true, stems: true }
                }];
            }

            // BEATS: Fetch producer settings
            const { data: producer } = await window.supabaseClient
                .from('users')
                .select('license_settings')
                .eq('id', track.producer_id || track.user_id)
                .single();

            const producerSettings = producer?.license_settings || {};
            const productLicenses = track.licenses || {};

            const FACTORY_DEFAULTS = {
                'basic': { name: 'Basic Lease', price: 20, streams: '5,000', sales: '500', radio: 'No Permitido', files: { mp3: true, wav: false, stems: false }, enabled: true },
                'premium': { name: 'Premium Lease', price: 40, streams: '50,000', sales: '2,000', radio: '2 Estaciones', files: { mp3: true, wav: true, stems: false }, enabled: true },
                'trackout': { name: 'Trackout Lease', price: 60, streams: '500,000', sales: '10,000', radio: 'ILIMITADO', files: { mp3: true, wav: true, stems: true }, enabled: true },
                'unlimited': { name: 'Unlimited License', price: 80, streams: 'UNLIMITED', sales: 'UNLIMITED', radio: 'ILIMITADO', files: { mp3: true, wav: true, stems: true }, enabled: true }
            };

            const licenseKeys = ['basic', 'premium', 'trackout', 'unlimited', 'exclusive'];
            return licenseKeys.map(key => {
                // 🔥 FIX: Support 'offszn_' prefix (new system) and standard keys (legacy/external)
                const offsznKey = `offszn_${key}`;
                const prodLic = productLicenses[offsznKey] || productLicenses[key] || {};
                const userLic = (producerSettings && (producerSettings[offsznKey] || producerSettings[key])) 
                    ? (producerSettings[offsznKey] || producerSettings[key]) 
                    : {};
                const factLic = FACTORY_DEFAULTS[key] || { name: 'License', price: 0, enabled: false };

                return {
                    id: key,
                    name: prodLic.name || userLic.name || factLic.name,
                    price: (prodLic.price !== undefined && prodLic.price !== null) ? prodLic.price : (userLic.price !== undefined && userLic.price !== null) ? userLic.price : factLic.price,
                    enabled: (prodLic.enabled !== undefined) ? prodLic.enabled : (userLic.enabled !== undefined) ? userLic.enabled : factLic.enabled,
                    streams: userLic.streams || factLic.streams,
                    sales: userLic.sales || factLic.sales,
                    radio: userLic.radio || factLic.radio,
                    files: userLic.files || factLic.files
                };
            });
        } catch (e) {
            // console.error("[StickyPlayer] Error fetching licenses:", e);
            return [];
        }
    }

    // PRELOAD NEXT TRACK LOGIC (Zero Latency Optimization)
    function preloadNextTrack() {
        if (!playlist || playlist.length === 0 || currentIndex === -1) return;

        let nextIndex = currentIndex + 1;
        if (nextIndex >= playlist.length) {
            nextIndex = 0; // wrap around
        }

        const nextTrack = playlist[nextIndex];
        if (!nextTrack) return;

        const audioUrl = getProductAudio(nextTrack);

        if (!audioUrl) return;

        // If it's a pub- url, we can preload directly without auth delays
        if (audioUrl.includes('pub-') && audioUrl.includes('.r2.dev')) {
            // BEATSTARS STRATEGY: 
            // 1. Link preload for pure network byte caching
            const linkId = 'preload-next-track-link';
            let link = document.getElementById(linkId);
            if (!link) {
                link = document.createElement('link');
                link.id = linkId;
                link.rel = 'preload';
                link.as = 'fetch';
                // crossOrigin removed to prevent CORB with R2 signed URLs
                document.head.appendChild(link);
            }
            link.href = audioUrl;

            // 2. Headless DOM Audio Element for browser decoding cache
            const audioId = 'preload-next-track-audio';
            let preAudio = document.getElementById(audioId);
            if (!preAudio) {
                preAudio = document.createElement('audio');
                preAudio.id = audioId;
                preAudio.preload = 'auto'; // Force browser to buffer
                preAudio.style.display = 'none';
                document.body.appendChild(preAudio);
            }
            // Only set src if changed to avoid breaking an active fetch
            if (preAudio.src !== audioUrl) {
                preAudio.src = audioUrl;
            }
        }
    }

    function showToast(message) {
        let toast = document.getElementById('sp-global-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'sp-global-toast';
            toast.className = 'sp-toast';
            document.body.appendChild(toast);
        }

        toast.innerHTML = `<i class="bi bi-cart-check-fill"></i> <span>${message}</span>`;
        toast.style.display = 'flex';

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Hide after 3s
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.style.display = 'none', 300);
        }, 3000);
    }

    return { init, play, playTrack: play, togglePlay, close, seekTo, getCurrentTrackId, updatePlaylist, isPlaying: isPlayingState, trackDownload };
})();

/**
 * GLOBAL STATS HELPER
 */
window.incrementProductStat = async function (id, column) {
    if (!id) return;

    // 1. Check LocalStorage Guard (Prevent duplicate counts in same browser session)
    const storageKey = 'offszn_counted_stats';
    const countedStr = localStorage.getItem(storageKey) || '{}';
    let counted = {};
    try {
        counted = JSON.parse(countedStr);
    } catch (e) { counted = {}; }

    if (!counted[column]) counted[column] = [];
    if (counted[column].includes(String(id))) {
        return; // Already counted recently
    }

    try {
        // 2. Determine Endpoint
        // Backend expects 'plays_count' or 'downloads_count'
        let endpoint = null;
        if (column === 'plays_count' || column === 'views') endpoint = `/api/products/${id}/play`;
        else if (column === 'downloads_count') endpoint = `/api/products/${id}/download`;

        if (endpoint) {
            // Use Server-side API (Logs history and increments counter)
            const token = window.AuthUtils ? window.AuthUtils.getAccessToken() : localStorage.getItem('authToken');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(endpoint, { method: 'POST', headers });
            if (!res.ok) throw new Error(`API Error: ${res.status}`);

            const data = await res.json();
            if (data.counted) {
                // Mark as counted locally only if server confirmed
                counted[column].push(String(id));
                localStorage.setItem(storageKey, JSON.stringify(counted));
            }
        } else if (window.supabaseClient) {
            // Fallback for direct Supabase update (non-critical columns)
            const { data: prod, error: fetchErr } = await window.supabaseClient
                .from('products')
                .select(column)
                .eq('id', id)
                .single();

            if (!fetchErr && prod) {
                const newCount = (prod[column] || 0) + 1;
                await window.supabaseClient
                    .from('products')
                    .update({ [column]: newCount })
                    .eq('id', id);

                counted[column].push(String(id));
                localStorage.setItem(storageKey, JSON.stringify(counted));
            }
        }
    } catch (err) {
        console.warn(`[Stats] Error incrementing ${column} for ${id}:`, err);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.StickyPlayer.init();
});
