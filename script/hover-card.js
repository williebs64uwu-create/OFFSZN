/**
 * ARTIST HOVER CARD (Professional Refactor)
 * Handles high-fidelity hover previews with skeleton loading and B&W theme.
 */

(function () {
    let hideTimeout = null;
    let activeArtistId = null;
    let unsubscribeFollow = null;

    /**
     * INITIALIZE HOVER CARD
     */
    function init() {
        if (document.getElementById('artist-hover-card')) return;

        const card = document.createElement('div');
        card.id = 'artist-hover-card';
        document.body.appendChild(card);

        // Keep card open if hovering over it
        card.onmouseenter = () => {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
        };

        card.onmouseleave = (e) => {
            window.hideArtistCard(e);
        };
    }

    /**
     * SHOW ARTIST CARD
     */
    window.showArtistCard = function (event, element) {
        if (window.innerWidth <= 1024) return; // Desktop only

        init();
        const card = document.getElementById('artist-hover-card');
        if (!card) return;

        // Get Data
        let rawData = element.getAttribute('data-artist');
        if (!rawData) return;

        let artistId = null;
        try {
            // Attempt to parse as JSON first (legacy/some parts might pass object)
            if (rawData.startsWith('{')) {
                const data = JSON.parse(rawData);
                artistId = data.id || data.user_id;
            } else {
                // If not JSON, it's a raw ID string
                artistId = rawData;
            }
        } catch (e) {
            // Fallback: use as raw string if JSON parsing fails
            artistId = rawData;
        }

        if (!artistId) return;
        activeArtistId = artistId;

            // Clear hide timeout
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }

            // Cleanup previous subscription
            if (unsubscribeFollow) {
                unsubscribeFollow();
                unsubscribeFollow = null;
            }

            // Position (Always above or below based on space)
            const rect = element.getBoundingClientRect();
            const cardHeight = 140; // Max estimated height
            const cardWidth = 240; 
            
            // Check space above
            let top = rect.top - cardHeight - 12;
            
            // If no space above, show below
            if (top < 10) {
                top = rect.bottom + 12;
            }
            
            // Final check: If it overflows the bottom, nudge it up
            if (top + cardHeight > window.innerHeight - 10) {
                top = window.innerHeight - cardHeight - 10;
            }

            // Horizontal centering
            let left = rect.left + (rect.width / 2) - (cardWidth / 2);
            if (left < 10) left = 10;
            if (left + cardWidth > window.innerWidth - 10) left = window.innerWidth - cardWidth - 10;

            card.style.top = `${top}px`;
            card.style.left = `${left}px`;
            card.style.height = 'auto'; 

            // Show Skeleton
            renderSkeleton(card);
            card.classList.add('active');

            // Fetch Real Data
            fetchArtist(artistId).then(fullData => {
                if (activeArtistId === artistId) {
                    renderContent(card, fullData);
                }
            }).catch(() => {
                if (activeArtistId === artistId) {
                    renderContent(card, { id: artistId }); // Fallback with basic ID
                }
            });
    };

    /**
     * HIDE ARTIST CARD
     */
    window.hideArtistCard = function (event) {
        if (hideTimeout) clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            const card = document.getElementById('artist-hover-card');
            if (card) {
                card.classList.remove('active');
                activeArtistId = null;
                if (unsubscribeFollow) {
                    unsubscribeFollow();
                    unsubscribeFollow = null;
                }
            }
        }, 300);
    };

    /**
     * FETCH ARTIST
     */
    async function fetchArtist(id) {
        // 1. Memory Cache
        if (!window.HC_Cache) window.HC_Cache = new Map();
        if (window.HC_Cache.has(String(id))) return window.HC_Cache.get(String(id));

        // 2. Global Pool (Check if we have the data already in search.js or explore.js pools)
        const globalPool = window.allProducts || window.allProducers || [];
        const found = globalPool.find(p => String(p.id) === String(id) || String(p.producer_id) === String(id));
        if (found) {
            const normalized = {
                id: found.id || found.producer_id,
                nickname: found.nickname || found.producer_nickname || 'Productor',
                username: found.username || found.nickname || found.handle,
                avatar_url: found.avatar_url || found.producer_avatar,
                followers_count: found.followers_count || 0,
                is_verified: found.is_verified || found.producer_is_verified || false,
                plan: found.plan || found.producer_plan || 'free'
            };
            window.HC_Cache.set(String(id), normalized);
            return normalized;
        }

        // 3. Network Fetch
        try {
            const { data, error } = await window.supabaseClient
                .from('users')
                .select('id, nickname, avatar_url, is_verified, plan')
                .eq('id', id)
                .single();

            if (error) throw error;
            
            window.HC_Cache.set(String(id), data);
            return data;
        } catch (e) {
            console.error("[HoverCard] Fetch failed:", e);
            return null;
        }
    }

    /**
     * RENDER SKELETON
     */
    function renderSkeleton(card) {
        card.innerHTML = `
            <div class="ahc-header">
                <div class="ahc-skeleton ahc-skeleton-avatar"></div>
                <div class="ahc-info">
                    <div class="ahc-skeleton ahc-skeleton-name"></div>
                    <div class="ahc-skeleton ahc-skeleton-stats"></div>
                </div>
            </div>
            <div class="ahc-skeleton ahc-skeleton-btn"></div>
        `;
    }

    /**
     * RENDER CONTENT
     */
    function renderContent(card, data) {
        if (!data) return;
        
        const artistId = data.id || data.user_id;
        const nickname = data.nickname || 'Unknown';
        const avatarUrl = data.avatar_url || '/images/default-avatar.png';
        const isVerified = data.is_verified || !!data.plan;
        const followerCount = data.followers_count || 0;
        const profileUrl = data.username ? `/@${data.username}` : `/artist/${artistId}`;

        // Verified Badge (Using Centralized Logic)
        const badgeHtml = window.getBadgeHtml ? window.getBadgeHtml(data.plan, isVerified) : '';

        card.innerHTML = `
            <div class="ahc-header" onclick="window.location.href='${profileUrl}'" style="cursor:pointer;">
                <img src="${avatarUrl}" class="ahc-avatar" alt="${nickname}">
                <div class="ahc-info">
                    <div class="ahc-name">
                        ${escapeHTML(nickname)}
                        ${badgeHtml}
                    </div>
                    <div class="ahc-stats">
                        ${formatNumber(followerCount)} Seguidores
                    </div>
                </div>
            </div>
            <button class="ahc-btn-follow" id="ahc-follow-btn">
                <i class="bi bi-person-plus"></i>
                <span>Seguir</span>
            </button>
        `;


        const btn = card.querySelector('#ahc-follow-btn');
        if (btn && window.FollowManager) {
            const isFollowing = window.FollowManager.isFollowing(artistId);
            updateButtonVisuals(btn, isFollowing);

            btn.onclick = (e) => {
                e.stopPropagation();
                window.FollowManager.toggleFollow(artistId, btn);
            };

            btn.onmouseenter = () => {
                if (window.FollowManager.isFollowing(artistId)) {
                    const span = btn.querySelector('span');
                    const icon = btn.querySelector('i');
                    if (span) span.textContent = 'Dejar de seguir';
                    if (icon) icon.className = 'bi bi-person-x-fill';
                }
            };
            btn.onmouseleave = () => {
                if (window.FollowManager.isFollowing(artistId)) {
                    const span = btn.querySelector('span');
                    const icon = btn.querySelector('i');
                    if (span) span.textContent = 'Siguiendo';
                    if (icon) icon.className = 'bi bi-person-check-fill';
                }
            };

            // Sync
            unsubscribeFollow = window.FollowManager.subscribe((followedIdsSet) => {
                const newState = followedIdsSet.has(String(artistId));
                updateButtonVisuals(btn, newState);
            });
        }
        
        // Hide if self
        const myId = getMyId();
        if (myId && String(myId) === String(artistId)) {
            btn.style.display = 'none';
        }
    }

    function updateButtonVisuals(btn, isFollowing) {
        if (!btn) return;
        const icon = btn.querySelector('i');
        const span = btn.querySelector('span');
        
        if (isFollowing) {
            btn.classList.add('following-state');
            if (icon) icon.className = 'bi bi-person-check-fill';
            if (span) span.textContent = 'Siguiendo';
        } else {
            btn.classList.remove('following-state');
            if (icon) icon.className = 'bi bi-person-plus';
            if (span) span.textContent = 'Seguir';
        }
    }

    function getMyId() {
        const token = window.getAccessToken ? window.getAccessToken() : null;
        if (!token) return null;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.id || payload.sub;
        } catch (e) {
            return null;
        }
    }

    function formatNumber(num) {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    function escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    }

})();
