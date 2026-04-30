window.ExpandedPlayer = (function () {
    let container = null;
    let ws = null;
    let currentTrack = null;
    let checkInterval = null;

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

        const isPreset = isPresetProduct(product);

        // For presets, we try after -> before -> generic
        if (isPreset) {
            if (product.audio_after_url) return product.audio_after_url;
            if (product.audio_before_url) return product.audio_before_url;
            if (product.audio_url) return product.audio_url;
        }

        // Comprehensive fallback chain for all products
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
            product.audio_after_url ||
            (product.track_data ? product.track_data.audio_url : '') ||
            '';
    }

    async function init() {
        if (document.getElementById('expanded-player-modal')) return;
        const res = await fetch('/components/expanded-player.html');
        const html = await res.text();
        document.body.insertAdjacentHTML('beforeend', html);
        container = document.getElementById('expanded-player-modal');
        setupEvents();
    }

    function setupEvents() {
        // Close when clicking backdrop (the area outside .ep-content)
        container.onclick = (e) => {
            if (e.target === container) close();
        };

        const closeBtn = document.getElementById('ep-close-btn');
        closeBtn.onclick = close;

        const playBtn = document.getElementById('ep-btn-play');
        playBtn.onclick = () => {
            const spPlay = document.getElementById('sp-play-btn');
            if (spPlay) spPlay.click(); // Hacky but 100% reliable to sync with StickyPlayer
            updatePlayState();
        };

        const prevBtn = document.getElementById('ep-btn-prev');
        prevBtn.onclick = () => {
            const spPrev = document.getElementById('sp-prev-btn');
            if (spPrev) spPrev.click();
        };

        const nextBtn = document.getElementById('ep-btn-next');
        nextBtn.onclick = () => {
            const spNext = document.getElementById('sp-next-btn');
            if (spNext) spNext.click();
        };

        // Like button uses FavoritesManager just like StickyPlayer
        const likeBtn = document.getElementById('ep-btn-like');
        likeBtn.onclick = (e) => {
            if (!currentTrack) return;
            const token = window.getAccessToken ? window.getAccessToken() : null;
            if (!token || !window.currentUserId) {
                if (window.showGuestModal) {
                    window.showGuestModal("¡Te gusta este beat!", "Inicia sesión para guardar tus favoritos.");
                } else {
                    window.location.href = '/pages/login.html';
                }
                return;
            }
            const ownerId = currentTrack.user_id || (currentTrack.artist_users ? currentTrack.artist_users.id : null);
            window.FavoritesManager.toggleLike(currentTrack.id, likeBtn, ownerId);

            // local UI update
            setTimeout(() => {
                if (window.FavoritesManager) {
                    updateLikeIcon(window.FavoritesManager.isLiked(currentTrack.id));
                }
            }, 50);
        };

        const shareBtn = document.getElementById('ep-btn-options');
        if (shareBtn) {
            shareBtn.onclick = () => {
                if (currentTrack && window.openShareModal) {
                    window.openShareModal(currentTrack);
                }
            };
        }

        const shareBtnCtrl = document.getElementById('ep-btn-share');
        if (shareBtnCtrl) {
            shareBtnCtrl.onclick = () => {
                if (currentTrack && window.openShareModal) {
                    window.openShareModal(currentTrack);
                }
            };
        }
    }

    async function open(track) {
        if (!container) await init();
        currentTrack = track;
        container.classList.add('visible');
        document.body.style.overflow = 'hidden';

        // Render data
        document.getElementById('ep-title').innerText = track.name || 'Untitled';

        // Resolve artist
        let pData = track.artist_users || track.producer || track.producer_data;
        if (Array.isArray(pData)) pData = pData[0];
        const artistName = (pData && pData.nickname) ? pData.nickname : (track.producer_nickname || track.artist_name || 'Artist');

        let subtitleText = '';
        if ((track.product_type || '').toLowerCase() === 'beat') {
            subtitleText = `Royalty A · ${track.bpm || '--'} BPM · ${track.key || '--'}`;
        } else {
            subtitleText = `${(track.product_type || 'Kit').toUpperCase()} · ${artistName}`;
        }
        document.getElementById('ep-subtitle').innerText = subtitleText;

        // Badges
        const badges = [];
        badges.push(`<span class="ep-badge"><i class="bi bi-folder"></i> STEREO</span>`);
        badges.push(`<span class="ep-badge"><i class="bi bi-person-circle"></i> ${artistName}</span>`);
        document.getElementById('ep-badges').innerHTML = badges.join('');

        // Cover setup (using same smart logic as sticky-player)
        const coverEl = document.getElementById('ep-cover');
        const rawImg = track.image_url || '';
        coverEl.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        if (rawImg) {
            window.getAuthorizedUrl(rawImg, track.r2_version || 'v1').then(url => {
                if (url) coverEl.src = url;
            });
        }

        // Like status sync
        if (window.FavoritesManager) {
            updateLikeIcon(window.FavoritesManager.isLiked(track.id));
        }

        // Initialize Waveform
        initWaveform(track);

        // Subscribing to favorites change
        if (window.FavoritesManager) {
            window.FavoritesManager.subscribe((likedIds) => {
                if (currentTrack) {
                    updateLikeIcon(likedIds.has(String(currentTrack.id)));
                }
            });
        }

        // Polling to sync state with StickyPlayer
        if (checkInterval) clearInterval(checkInterval);
        checkInterval = setInterval(syncWithStickyPlayer, 500);
        updatePlayState();
    }

    function updateLikeIcon(isLiked) {
        const btn = document.getElementById('ep-btn-like');
        if (!btn) return;
        if (isLiked) {
            btn.innerHTML = '<i class="bi bi-heart-fill"></i>';
            btn.style.color = '#fff';
        } else {
            btn.innerHTML = '<i class="bi bi-heart"></i>';
            btn.style.color = '#ccc';
        }
    }

    async function initWaveform(track) {
        const wfContainer = document.getElementById('ep-waveform');
        wfContainer.innerHTML = '';

        const audioUrl = getProductAudio(track);

        if (!audioUrl) return;

        if (ws) {
            try { ws.destroy(); } catch (e) { }
        }

        const finalAudioUrl = await window.getAuthorizedUrl(audioUrl, track.r2_version || 'v1');

        ws = WaveSurfer.create({
            container: '#ep-waveform',
            waveColor: '#555',
            progressColor: '#8b5cf6',
            cursorColor: 'transparent',
            barWidth: 2,
            barGap: 2,
            barRadius: 2,
            height: 48,
            normalize: true,
            interact: true,
            url: finalAudioUrl
        });

        // VERY IMPORTANT: MUTE THIS INSTANCE SO ONLY STICKYPLAYER PLAYS AUDIO
        ws.setVolume(0);

        ws.on('ready', () => {
            // Force a render in mobile view if needed
        });

        // When user seeks on Expanded Player, we update StickyPlayer!
        ws.on('interaction', () => {
            if (window.StickyPlayer && window.StickyPlayer.getCurrentTrackId() == currentTrack.id) {
                window.StickyPlayer.seekTo(ws.getCurrentTime());
            } else {
                window.playTrack(currentTrack); // This will start StickyPlayer
                setTimeout(() => window.StickyPlayer.seekTo(ws.getCurrentTime()), 150);
            }
        });

        // Register it globally so StickyPlayer updates it
        ws.customId = `ep-waveform-${track.id}`;
        if (window.activeWavesurfers) {
            window.activeWavesurfers = window.activeWavesurfers.filter(item => !item.customId || !item.customId.startsWith('ep-waveform'));
            window.activeWavesurfers.push(ws);
        }
    }

    function syncWithStickyPlayer() {
        const playBtnI = document.querySelector('#ep-btn-play i');
        const spPlayWrapper = document.getElementById('sp-play-btn');
        if (spPlayWrapper && playBtnI) {
            if (spPlayWrapper.innerHTML.includes('pause')) {
                playBtnI.className = 'bi bi-pause-fill';
                playBtnI.style.marginLeft = '0px';
            } else {
                playBtnI.className = 'bi bi-play-fill';
                playBtnI.style.marginLeft = '4px';
            }
        }

        // Sync time
        if (ws) {
            const time = ws.getCurrentTime();
            const mins = Math.floor(time / 60);
            const secs = Math.floor(time % 60);
            document.getElementById('ep-time').innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

            // If playBtn is Playing, keep syncing the waveform if needed
            // But StickyPlayer already handles that naturally via activeWavesurfers!
        }
    }

    function updatePlayState() {
        syncWithStickyPlayer();
    }

    function close() {
        if (container) {
            container.classList.remove('visible');
            document.body.style.overflow = '';
            if (checkInterval) clearInterval(checkInterval);
        }
    }

    return {
        open,
        close
    };
})();
