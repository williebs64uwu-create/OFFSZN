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

    // Playback Tracking (Global to survive ws instance reuse)
    let actualPlayTime = 0;
    let lastTime = 0;

    // PERSISTENCE KEYS (kept for potential future use or session handling, but disabled on load)
    const STORAGE_KEY_STATE = 'sticky_player_state';
    const STORAGE_KEY_PLAYLIST = 'sticky_player_playlist';

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
                    <button class="sp-icon-btn" id="sp-like-btn" title="Like"><i class="bi bi-heart"></i></button>
                    <button class="sp-icon-btn" id="sp-dl-btn" title="Download"><i class="bi bi-download"></i></button>
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
            priceLabel: document.getElementById('sp-price-label')
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

        const dlBtn = document.getElementById('sp-dl-btn');
        if (dlBtn) {
            dlBtn.onclick = (e) => {
                e.stopPropagation();
                handleDownloadClick();
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
    function updatePlaylist(tracks, artistUsername) {
        playlist = tracks || [];
        currentArtist = artistUsername;
        playHistory = [];
        console.log(`[StickyPlayer] Playlist updated: ${playlist.length} tracks from ${currentArtist} `);
    }

    // Unified Load Logic
    async function loadTrack(trackData, autoPlay = true, startTime = 0) {
        if (!container) init();
        container.classList.add('visible');

        // Update UI Text instantly without Skeletons
        currentTrack = trackData;

        // Remove skeleton classes completely since user requested instant visual updates
        if (els.title) els.title.classList.remove('skeleton-text');
        if (els.artist) els.artist.classList.remove('skeleton-text');
        const wfContainer = document.getElementById('sp-waveform');
        if (wfContainer) wfContainer.classList.remove('skeleton-waveform');

        currentTrack = trackData;
        // History Logic: Push CURRENT track to history before switching
        if (!isNavigatingHistory && currentTrack && currentTrack.id !== trackData.id) {
            navigationHistory.push(currentTrack);
            if (navigationHistory.length > 50) navigationHistory.shift();
        }
        isNavigatingHistory = false; // Reset

        resetAllListButtons();
        lastSyncTime = 0; // Trigger instant sync for new track
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
        if (currentTrack) currentTrack.hasBeenCounted = false;

        // Update Internal State
        currentTrack = trackData;

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

        els.title.innerText = trackData.name || 'Untitled';
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
            window.getAuthorizedUrl(rawImg).then(url => {
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

        const audioUrl = trackData.mp3_url || trackData.audio_url || trackData.download_url_mp3 ||
            trackData.preview_url || trackData.demo_file || trackData.tagged_file ||
            trackData.file_url || trackData.url_file || '';

        // Update Price Label (BeatStars Style)
        // (already done above)

        // Ensure we have audioUrl
        if (!audioUrl) return;

        // 🔥 ZERO LATENCY FIX & SYNC GESTURE FIX: 
        // If it's a public Cloudflare URL, DO NOT AWAIT. Awaiting breaks the mobile user gesture token 
        // in Safari/Chrome which causes the browser to pause audio until network idle (the 10 second delay).
        let finalAudioUrl = audioUrl;
        if (audioUrl.includes('pub-') && audioUrl.includes('.r2.dev')) {
            finalAudioUrl = audioUrl; // Synchronous, keeping gesture alive
        } else {
            finalAudioUrl = await window.getAuthorizedUrl(audioUrl);
        }

        // --- INSTANT WAVESURFER & AUDIO SWAP ---
        if (!ws) {
            // First time setup
            // Append audio to DOM for higher Priority
            globalAudioEl = document.createElement('audio');
            globalAudioEl.crossOrigin = "anonymous";
            globalAudioEl.style.display = "none";
            document.body.appendChild(globalAudioEl);

            ws = WaveSurfer.create({
                container: '#sp-waveform',
                media: globalAudioEl,
                waveColor: '#555',
                progressColor: '#8b5cf6',
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
                    lastTime = time;

                    if (actualPlayTime >= 5.0) {
                        trackPlay(currentTrack.id);
                        currentTrack.hasBeenCounted = true;
                        console.log(`[StickyPlayer] Play counted for ${currentTrack.name}`);
                    }
                } else {
                    lastTime = time;
                }
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

        ws.once('ready', () => {
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
        if (currentTrack && currentTrack.id === trackData.id) {
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

        // Selector: Matches any button containing both "btn-play" and the track ID
        // Handles both "btn-play-waveform-ID-index" and "btn-play-waveform - ID - suffix"
        const btns = document.querySelectorAll(`[id*="btn-play-"][id*="${track.id}"]`);

        const updateBtn = (btn) => {
            btn.innerHTML = playing ?
                '<i class="bi bi-pause-fill"></i>' :
                '<i class="bi bi-play-fill"></i>';
        };

        btns.forEach(updateBtn);
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
        return currentTrack ? currentTrack.id : null;
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

            // 2. Increment
            const newCount = (data.plays_count || 0) + 1;
            await window.supabaseClient
                .from('products')
                .update({ plays_count: newCount })
                .eq('id', id);

            console.log(`[StickyPlayer] Play counted for ${id}. New total: ${newCount}`);
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

        const isFree = currentTrack.is_free === true || String(currentTrack.is_free) === 'true';
        const productType = (currentTrack.product_type || '').toLowerCase();

        // GUEST/FREE: If it's a beat, prioritize MP3 (democratization/security)
        // KITS: Use ZIP/WAV.
        let audioUrl = '';
        if (productType === 'beat') {
            audioUrl = currentTrack.download_url_mp3 || currentTrack.mp3_url || currentTrack.audio_url || currentTrack.demo_file || '';
        } else {
            const mainAssetUrl = currentTrack.download_url_wav || currentTrack.download_url_stems || currentTrack.wav_url || currentTrack.stems_url;
            audioUrl = mainAssetUrl || currentTrack.download_url_mp3 || currentTrack.mp3_url || currentTrack.audio_url || currentTrack.demo_file || '';
        }

        if (isFree) {
            if (window.openDownloadGateModal) {
                if (!window.currentProductData) window.currentProductData = currentTrack;
                window.openDownloadGateModal(audioUrl, currentTrack.producer?.nickname, currentTrack.id);
            } else {
                if (audioUrl) {
                    window.open(audioUrl, '_blank');
                    trackDownload(currentTrack.id);
                } else {
                    alert("Descarga no disponible.");
                }
            }
        } else {
            // PAID: Redirect to product page (Requested: Like "View Product")
            const seoLink = window.createSeoLink ? window.createSeoLink(currentTrack) : `/producto.html?id=${currentTrack.id}`;
            window.location.href = seoLink;
        }
    }

    async function handleBuyClick() {
        if (!currentTrack) return;

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

            return ['basic', 'premium', 'trackout', 'unlimited'].map(key => {
                const prodLic = productLicenses[key] || {};
                const userLic = producerSettings[key] || {};
                const factLic = FACTORY_DEFAULTS[key];

                return {
                    id: key,
                    name: prodLic.name || userLic.name || factLic.name,
                    price: (prodLic.price !== undefined) ? prodLic.price : (userLic.price !== undefined) ? userLic.price : factLic.price,
                    enabled: (prodLic.enabled !== undefined) ? prodLic.enabled : (userLic.enabled !== undefined) ? userLic.enabled : factLic.enabled,
                    streams: userLic.streams || factLic.streams,
                    sales: userLic.sales || factLic.sales,
                    radio: userLic.radio || factLic.radio,
                    files: userLic.files || factLic.files
                };
            });
        } catch (e) {
            console.error("[StickyPlayer] Error fetching licenses:", e);
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

        const audioUrl = nextTrack.mp3_url || nextTrack.audio_url || nextTrack.download_url_mp3 ||
            nextTrack.preview_url || nextTrack.demo_file || nextTrack.tagged_file ||
            nextTrack.file_url || nextTrack.url_file || '';

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
                link.crossOrigin = 'anonymous';
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
    if (!window.supabaseClient || !id) return;
    try {
        const { data, error: fetchErr } = await window.supabaseClient
            .from('products')
            .select(column)
            .eq('id', id)
            .single();

        if (fetchErr) throw fetchErr;

        const newCount = (data[column] || 0) + 1;
        await window.supabaseClient
            .from('products')
            .update({ [column]: newCount })
            .eq('id', id);

        console.log(`[Stats] ${column} incremented for ${id} to ${newCount}`);
    } catch (e) {
        console.warn(`[Stats] Error incrementing ${column}:`, e);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.StickyPlayer.init();
});