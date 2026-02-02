// ============================================
// SHARED HOVER CARD LOGIC
// Used in: profile-public.js, notificaciones.html, etc.
// ============================================

// Helper: Get Access Token - REMOVED (Now using global AuthUtils)
// function getAccessToken() { ... }

// Helper: Show Toast
function showHC_Toast(message) {
    let toast = document.getElementById('simple-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'simple-toast';
        toast.style.cssText = `
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            background: rgba(30,30,30,0.9); color: white; padding: 10px 20px; border-radius: 50px;
            z-index: 10000; transition: opacity 0.3s; pointer-events: none; opacity: 0;
            font-size: 0.9rem; border: 1px solid #444; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// Helper: Update Button Visuals
function updateHC_ButtonVisuals(btn, isFollowing) {
    if (isFollowing) {
        btn.textContent = 'Siguiendo';
        btn.classList.add('following-state');
        btn.style.background = 'transparent';
        btn.style.border = '1px solid rgba(255, 255, 255, 0.2)'; /* Soft Contour */
        btn.style.color = '#aaa'; /* Dimmed */
        btn.style.fontWeight = '500';
    } else {
        btn.innerHTML = '<i class="bi bi-person-plus-fill" style="margin-right:4px;"></i> Seguir';
        btn.classList.remove('following-state');
        btn.style.background = '#8A2BE2'; // Purple
        btn.style.border = 'none';
        btn.style.color = '#fff';
    }
}

// Global Sync Helper (Mock or simplified if main logic isn't present)
function syncHC_FollowState(targetId, isFollowing) {
    // Try to update global set if it exists (from profile-public.js)
    if (window.currentUserFollowing instanceof Set) {
        if (isFollowing) window.currentUserFollowing.add(targetId);
        else window.currentUserFollowing.delete(targetId);
    }
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('follow-state-changed', {
        detail: { userId: targetId, isFollowing }
    }));
}

// Create the card element
function setupHoverCard() {
    if (document.getElementById('artist-hover-card')) return;

    const card = document.createElement('div');
    card.id = 'artist-hover-card';

    // Base styles are in CSS, but ensure initial hidden state
    card.style.display = 'none';

    card.innerHTML = `
        <div class="ahc-header">
            <img class="ahc-avatar" src="" alt="Avatar">
            <div class="ahc-info">
                <div class="ahc-name"></div>
                <div class="ahc-stats"></div>
            </div>
        </div>
        <button class="ahc-btn-follow">+ Follow</button>
    `;

    // Interaction: Keep open when hovering the card itself
    card.addEventListener('mouseenter', () => {
        clearTimeout(window.hc_hoverTimeout);
    });
    card.addEventListener('mouseleave', () => {
        window.hc_hoverTimeout = setTimeout(() => {
            card.classList.remove('active');
            setTimeout(() => { if (!card.classList.contains('active')) card.style.display = 'none'; }, 100);
        }, 50);
    });

    document.body.appendChild(card);
}

// Global Cache
window.HC_Cache = new Map();

// Helper: Prefetch Data
window.prefetchArtist = function (nickname) {
    if (!nickname || window.HC_Cache.has(nickname)) return;

    // Store promise immediately
    const promise = (async () => {
        try {
            const res = await fetch(`/api/users/${nickname}`);
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();

            // Normalize
            const cacheData = {
                id: data.id,
                nickname: data.nickname,
                avatar_url: data.avatar_url,
                is_verified: data.is_verified || data.is_producer,
                stats: {
                    products: data.products_count || 0,
                    followers: data.followers_count || 0
                }
            };
            window.HC_Cache.set(nickname, cacheData);
            window.HC_Cache.set(cacheData.id, cacheData);
            return cacheData;
        } catch (e) {
            window.HC_Cache.delete(nickname);
            return null;
        }
    })();

    window.HC_Cache.set(nickname, promise);
};

// ... (Global Variables omitted) ...

window.showArtistCard = async function (event, element) {
    clearTimeout(window.hc_hoverTimeout);

    const dataStr = element.getAttribute('data-artist');
    if (!dataStr) return;

    let initialData;
    try {
        initialData = JSON.parse(dataStr);
    } catch (e) { return; }

    setupHoverCard();
    const card = document.getElementById('artist-hover-card');

    // RESOLVE DATA (Move up)
    let fullData = initialData;
    let cached = window.HC_Cache.get(initialData.nickname);

    if (cached && !(cached instanceof Promise)) {
        fullData = { ...initialData, ...cached };
    }

    // RENDER CONTENT FIRST (So dimensions are correct)
    renderCardContent(card, fullData);

    // NOW POSITION
    card.style.display = 'flex'; // Visible for measurement

    // Force layout recalc to ensure dimensions
    const _ = card.offsetHeight;

    requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect(); // Trigger element
        const cardHeight = card.offsetHeight;
        const cardWidth = card.offsetWidth; // Use actual width from CSS

        // Center horizontally relative to trigger
        let left = rect.left + (rect.width / 2) - (cardWidth / 2);

        // Horizontal Constraints (Viewport)
        if (left < 10) left = 10;
        if (left + cardWidth > window.innerWidth - 10) {
            left = window.innerWidth - cardWidth - 10;
        }

        // Vertical Positioning
        // Prefer BOTTOM placement typically.
        let top = rect.bottom + 10; // Default: Below

        // Height of viewport
        const vh = window.innerHeight;

        // Check if it fits below
        const fitsBelow = (top + cardHeight + 10) < vh;

        // Check if it fits above
        const fitsAbove = (rect.top - cardHeight - 10) > 0;

        // Logic:
        // 1. If it fits below, go below.
        // 2. If not, check if fits above.
        // 3. If neither (card too tall?), pick side with MORE space.

        if (!fitsBelow && fitsAbove) {
            // Flip Up
            top = rect.top - cardHeight - 10;
            card.classList.add('flipped-up');
        } else if (!fitsBelow && !fitsAbove) {
            // Compare space
            const spaceBelow = vh - rect.bottom;
            const spaceAbove = rect.top;

            if (spaceAbove > spaceBelow) {
                top = rect.top - cardHeight - 10;
                if (top < 10) top = 10;
            } else {
                top = rect.bottom + 10;
            }
        }

        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
        card.classList.add('active');
    });

    const btn = card.querySelector('.ahc-btn-follow');
    // Hide if own profile (Robust check)
    let cUserId = window.currentUserId;
    if (!cUserId) {
        const t = window.getAccessToken(); // GLOBAL
        if (t) {
            try {
                const p = JSON.parse(atob(t.split('.')[1]));
                cUserId = p.id || p.sub;
            } catch (e) { }
        }
    }

    if (cUserId && fullData.id === cUserId) {
        btn.style.display = 'none';
        // Continue just in case, but usually we could return. 
        // We'll let it proceed but the button is hidden.
    } else {
        btn.style.display = 'block';
    }

    // Initial visual state from global set (fast)
    let isFollowing = window.currentUserFollowing && fullData.id && window.currentUserFollowing.has(fullData.id);
    updateHC_ButtonVisuals(btn, isFollowing);

    // ASYNC FETCH (If needed)
    try {
        const fetchData = async () => {
            // Force fetch if stats are missing, zero (placeholders), or we don't have full info
            const hasRealStats = cached && !(cached instanceof Promise) && cached.stats && (cached.stats.products !== undefined);

            if (!hasRealStats) {
                let fetchProm = cached instanceof Promise ? cached : null;
                if (!fetchProm) {
                    fetchProm = fetch(`/api/users/${initialData.nickname}`)
                        .then(r => r.ok ? r.json() : null)
                        .then(data => {
                            if (!data) return null;
                            const full = {
                                id: data.id,
                                nickname: data.nickname,
                                avatar_url: data.avatar_url,
                                is_verified: data.is_verified || data.is_producer,
                                stats: {
                                    products: data.products_count || 0,
                                    followers: data.followers_count || 0
                                }
                            };
                            return full;
                        });
                }
                const pData = await fetchProm;
                if (pData) {
                    fullData = { ...fullData, ...pData };
                    window.HC_Cache.set(initialData.nickname, fullData);
                    if (fullData.id) window.HC_Cache.set(fullData.id, fullData); // ID cache
                    renderCardContent(card, fullData);
                }
            }
        };
        await fetchData();

        const targetId = fullData.id;
        if (!targetId) return;

        // Re-check self-follow after fetching ID
        if (cUserId && targetId === cUserId) {
            btn.style.display = 'none';
        }

        // Re-check follow status after fetch (in case ID was missing before)
        if (window.currentUserFollowing && window.currentUserFollowing.has(targetId)) {
            isFollowing = true;
            updateHC_ButtonVisuals(btn, true);
        }

        // Bind Actions
        const getRedirectUrl = () => fullData.nickname ? `/${fullData.nickname}` : null;

        const avatarEl = card.querySelector('.ahc-avatar');
        avatarEl.style.cursor = 'pointer';
        avatarEl.onclick = (e) => { e.stopPropagation(); const u = getRedirectUrl(); if (u) window.location.href = u; };

        const nameEl = card.querySelector('.ahc-name');
        nameEl.style.cursor = 'pointer';
        nameEl.onclick = (e) => { e.stopPropagation(); const u = getRedirectUrl(); if (u) window.location.href = u; };

        // Follow Action
        btn.onclick = async (e) => {
            e.stopPropagation();
            const token = window.getAccessToken(); // GLOBAL
            if (!token) { window.location.href = '/pages/login.html'; return; } // Fixed path

            // Toggle state
            const oldState = isFollowing;
            const newState = !isFollowing;
            isFollowing = newState;

            // Optimistic Update
            updateHC_ButtonVisuals(btn, newState);

            // Update stats visually
            let s = fullData.stats || { followers: 0, products: 0 };
            if (newState) s.followers++; else s.followers = Math.max(0, s.followers - 1);
            fullData.stats = s;
            renderCardContent(card, fullData);

            // Sync Global
            syncHC_FollowState(targetId, newState);

            btn.disabled = true;
            try {
                const method = newState ? 'POST' : 'DELETE';
                const res = await fetch(`/api/users/${targetId}/follow`, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!res.ok) {
                    throw new Error('Request failed');
                }
                // Success - data is synced
            } catch (err) {
                console.error(err);
                showHC_Toast("Error de conexión");

                // Revert
                isFollowing = oldState;
                updateHC_ButtonVisuals(btn, oldState);
                if (newState) s.followers--; else s.followers++;
                renderCardContent(card, fullData);
                syncHC_FollowState(targetId, oldState);
            } finally {
                btn.disabled = false;
            }
        };

    } catch (e) {
        console.warn("Hover card error:", e);
    }
};

function renderCardContent(card, data) {
    card.querySelector('.ahc-name').innerHTML = `${data.nickname} ${data.is_verified ? '<i class="bi bi-patch-check-fill" style="color:#3b82f6; margin-left:4px;"></i>' : ''}`;
    card.querySelector('.ahc-avatar').src = data.avatar_url || `https://ui-avatars.com/api/?name=${data.nickname}&background=333&color=fff`;

    const statsEl = card.querySelector('.ahc-stats');
    if (data.stats && (data.stats.products !== undefined || data.stats.followers !== undefined)) {
        const fCount = parseInt(data.stats.followers) || 0;
        const followerLabel = (fCount === 1) ? 'seguidor' : 'seguidores';
        statsEl.innerHTML = `${data.stats.products || 0} productos • ${fCount} ${followerLabel}`;
    } else {
        statsEl.innerHTML = '<span style="opacity:0.6; font-size:0.75rem;">Cargando...</span>';
    }
}

window.hideArtistCard = function (event, element) {
    const card = document.getElementById('artist-hover-card');
    if (!card) return;

    // Delay to allow moving mouse to the card
    window.hc_hoverTimeout = setTimeout(() => {
        if (card) {
            card.classList.remove('active');
            setTimeout(() => { if (!card.classList.contains('active')) card.style.display = 'none'; }, 100);
        }
    }, 50);
};

// Auto Init
document.addEventListener('DOMContentLoaded', setupHoverCard);
