
// Logic for displaying public profile data based on /@username URL

const supabase = window.supabaseClient; // Initialized by auth-utils.js
window.activeWavesurfers = window.activeWavesurfers || [];
window.currentlyPlaying = window.currentlyPlaying || null;

document.addEventListener('DOMContentLoaded', async () => {
    // 0. SAFETY CHECK: Only run if on Profile Page
    if (!document.getElementById('profile-root')) return;

    // 1. Get Username from URL
    // 1. Get Username from URL
    // Supports: /@willie, /u/willie, and /willie
    const path = window.location.pathname;
    let username = null;

    const atMatch = path.match(/\/@(.+)/);
    const uMatch = path.match(/\/u\/(.+)/);

    if (atMatch) {
        username = atMatch[1];
    } else if (uMatch) {
        username = uMatch[1];
    } else if (path !== '/' && !path.includes('.')) {
        // Root path fallback (e.g. /willieinspired)
        // Strip leading slash
        username = path.substring(1);
    }

    // --- PATCH: Support ?id=UUID for explicit routing ---
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get('id');

    if (idParam) {
        // If we have an ID, we need to fetch the username first to satisfy the rest of the flow
        // OR we can just load by ID. But let's fetch the username for consistency.
        try {
            const { data: uData, error } = await supabase.from('users').select('nickname').eq('id', idParam).single();
            if (uData && uData.nickname) {
                username = uData.nickname;
                // Update URL to be pretty (optional, but nice)
                window.history.replaceState({}, '', `/@${username}`);
            } else {
                console.error("User not found by ID:", idParam);
            }
        } catch (err) {
            console.error("Error resolving ID to nickname:", err);
        }
    }

    if (!username) {
        console.error("No username found in URL");
        // Optional: Redirect to 404 or home
        return;
    }

    // const username = match[1]; // REMOVED
    console.log("Loading profile for:", username);

    // 3. Setup Following Data & Helper
    window.currentUserFollowing = new Set();
    window.currentUserId = null;
    window.profileInitPromise = Promise.resolve();

    const token = window.getAccessToken(); // Use GLOBAL
    if (token) {
        // Fetch both following list and current user identity in parallel
        window.profileInitPromise = Promise.all([
            fetch('/api/me/following', { headers: window.AuthUtils.getAuthHeaderObj() })
                .then(r => r.json())
                .catch(err => { console.warn("Failed to fetch following", err); return []; }),
            fetch('/api/me', { headers: window.AuthUtils.getAuthHeaderObj() })
                .then(r => r.json())
                .catch(err => { console.warn("Failed to fetch me", err); return null; })
        ]).then(([ids, me]) => {
            if (Array.isArray(ids)) window.currentUserFollowing = new Set(ids);
            if (me && me.id) window.currentUserId = me.id;
            console.log("Profile Init Data Loaded:", { following: window.currentUserFollowing.size, me: window.currentUserId });
        });
    }

    // 3. Fetch User Profile
    await loadUserProfile(username);
});

async function loadUserProfile(username) {
    try {
        // Switch to the stable public users endpoint
        const response = await fetch(`/api/users/${username}`);

        if (!response.ok) {
            throw new Error('Usuario no encontrado');
        }

        const user = await response.json();

        // Wait for auth/following data to be ready before rendering header
        if (window.profileInitPromise) {
            await window.profileInitPromise;
        }

        // 4. Fetch User Products (via API) - SYNC WAIT
        // We wait for the products fetch to complete so we can remove ALL skeletons together.
        await loadUserProducts(user);

        // 3. Render Header Data (Now happens AFTER waiting for products)
        renderHeader(user);
    } catch (e) {
        console.error("Error loading profile:", e);
        document.getElementById('profileName').innerText = "Usuario no encontrado";
        document.getElementById('profileBio').innerText = "No se pudo cargar el perfil.";
    }
}

function renderHeader(user) {
    // Avatar
    const avatarContainer = document.getElementById('profileAvatar');
    if (user.avatar_url) {
        avatarContainer.innerHTML = `<img src="${user.avatar_url}" alt="${user.nickname}">`;
    } else {
        const initial = (user.nickname || "U").charAt(0).toUpperCase();
        avatarContainer.innerHTML = `<span>${initial}</span>`;
    }

    // Text Info
    // Text Info
    // User requested to use Nickname specifically.
    // NOTE: The innerText is overwritten by the renderHeader function below for the centered layout.
    // This block is legacy but kept for safety. 
    document.getElementById('profileName').innerText = user.nickname || "User";

    // Role / Verified
    if (user.is_verified || user.is_producer) {
        const verifyBadge = document.getElementById('profileVerified');
        verifyBadge.style.display = 'inline-block';

        // Tooltip logic
        verifyBadge.classList.add('verified-container');
        verifyBadge.innerHTML = `
            <i class="bi bi-patch-check-fill"></i>
            <div class="verified-tooltip">

                <div class="v-tooltip-header">
                    <i class="bi bi-patch-check-fill"></i> VERIFICADO OFFSZN
                </div>
                <div class="v-tooltip-body">
                    Plan Premium OFFSZN<br>
                    Productor Verificado<br>
                    <span style="color:#888; font-size:0.7rem;">Certificado Oficial</span>
                </div>
            </div>
        `;
    }

    document.getElementById('profileRole').innerText = user.role || '';
    document.getElementById('profileBio').innerText = user.bio || '';

    // Clear Location Skeleton (Fix stuck skeleton)
    const locEl = document.getElementById('profileLocation');
    if (locEl) {
        locEl.innerHTML = user.location || ''; // If no location, clear it.
    }

    // ACTIONS: Reveal Real Buttons, Remove Skeletons
    const skelActions = document.getElementById('skeletonActions');
    if (skelActions) skelActions.style.display = 'none';

    // Renamed local variable to avoid conflict with global or lower scope
    const headerFollowBtn = document.getElementById('btnFollow');
    if (headerFollowBtn) headerFollowBtn.style.display = 'inline-block'; // Reveal

    const msgBtn = document.getElementById('btnMessage');
    if (msgBtn) {
        // Hide if viewing own profile
        if (window.currentUserId && (user.id === window.currentUserId)) {
            msgBtn.style.display = 'none';
        } else {
            msgBtn.style.display = 'inline-block'; // Reveal
            msgBtn.innerHTML = '<i class="bi bi-chat-dots-fill" style="margin-right:6px;"></i> Mensaje';
            msgBtn.onclick = () => {
                window.location.href = '/mensajes';
            };
        }
    }

    // Socials
    const socialLinks = document.getElementById('socialLinks');
    socialLinks.innerHTML = '';

    if (user.socials) {
        try {
            const socials = typeof user.socials === 'string' ? JSON.parse(user.socials) : user.socials;
            const icons = {
                tiktok: 'bi-tiktok',
                instagram: 'bi-instagram',
                facebook: 'bi-facebook',
                youtube: 'bi-youtube',
                spotify: 'bi-spotify',
                twitter: 'bi-twitter-x',
                discord: 'bi-discord',
                website: 'bi-globe'
            };

            Object.keys(socials).forEach(key => {
                const k = key.toLowerCase();
                const val = socials[key];
                if (val && icons[k]) {
                    const a = document.createElement('a');
                    let href = val;
                    if (!val.startsWith('http')) {
                        if (k === 'instagram') href = `https://instagram.com/${val}`;
                        else if (k === 'tiktok') href = `https://tiktok.com/@${val}`;
                        else if (k === 'twitter') href = `https://twitter.com/${val}`;
                        else if (k === 'youtube') href = `https://youtube.com/@${val}`;
                    }
                    a.href = href;
                    a.target = '_blank';
                    a.className = 'social-link';
                    a.innerHTML = `<i class="bi ${icons[k]}"></i>`;
                    socialLinks.appendChild(a);
                }
            });
        } catch (e) {
            console.error("Error parsing socials:", e);
        }
    }

    // --- Main Follow Button & Stats Logic ---
    const followBtn = document.getElementById('btnFollow');
    if (followBtn) followBtn.setAttribute('data-target-id', user.id); // Tag for global sync

    // Ensure accurate counts are displayed if elements exist
    const pCountEl = document.getElementById('profileProductsCount');
    if (pCountEl) pCountEl.innerText = `${user.products_count || 0} Productos`;

    const fCountEl = document.getElementById('profileFollowersCount');
    if (fCountEl) {
        const count = user.followers_count || 0;
        const label = count === 1 ? 'Seguidor' : 'Seguidores';
        fCountEl.innerText = `${count} ${label}`;
    }

    const followingCountEl = document.getElementById('profileFollowingCount');
    if (followingCountEl) {
        const count = user.following_count || 0;
        followingCountEl.innerText = `${count} Siguiendo`;
    }

    if (followBtn) {
        // Hide if viewing own profile
        if (window.currentUserId && (user.id === window.currentUserId)) {
            followBtn.style.display = 'none';
        } else {
            followBtn.style.display = 'inline-block';

            // Initial Check (Instant because we awaited the data)
            const isFollowing = window.currentUserFollowing && window.currentUserFollowing.has(user.id);
            updateButtonVisuals(followBtn, isFollowing);
        }

        followBtn.onclick = async () => {
            const token = getAccessToken();
            if (!token) { window.location.href = '/login.html'; return; }

            const isFollowing = followBtn.classList.contains('following-state');
            const method = isFollowing ? 'DELETE' : 'POST';

            followBtn.disabled = true;
            try {
                const res = await fetch(`/api/users/${user.id}/follow`, {
                    method,
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    const newState = !isFollowing;

                    // Global Sync
                    syncFollowState(user.id, newState); // updates this button + cache + others

                    // Update Main Count specifically
                    if (fCountEl) {
                        if (data.followersCount !== undefined) {
                            fCountEl.innerText = `${data.followersCount} Seguidores`;
                        } else {
                            // Fallback
                            let current = parseInt(fCountEl.innerText) || 0;
                            if (newState) current++; else current = Math.max(0, current - 1);
                            const label = current === 1 ? 'Seguidor' : 'Seguidores';
                            fCountEl.innerText = `${current} ${label}`;
                        }
                    }
                } else if (res.status === 400) {
                    const data = await res.json();
                    showToast(data.error || "No puedes realizar esta acción");
                }
            } catch (e) { console.error(e); }
            finally { followBtn.disabled = false; }
        };
    }
}

// Helper for Visuals (Shared)
// Helper for Visuals (Shared)
function updateButtonVisuals(btn, isFollowing) {
    if (isFollowing) {
        btn.textContent = 'Siguiendo';
        btn.classList.add('following-state');
        btn.style.background = 'transparent';
        btn.style.border = '1px solid rgba(255, 255, 255, 0.2)'; /* Soft Contour */
        btn.style.color = '#aaa'; /* Dimmed to imply "Done" */
        btn.style.fontWeight = '500';
        btn.style.outline = 'none';
    } else {
        // User requested "+" icon style
        btn.innerHTML = '<i class="bi bi-plus-lg" style="margin-right:4px;"></i> Seguir';
        btn.classList.remove('following-state');
        btn.style.background = '#8A2BE2';
        btn.style.border = 'none'; /* Removed contour */
        btn.style.color = '#fff';
        btn.style.background = ''; // Allow CSS
        btn.style.outline = 'none';

        if (!btn.className.includes('btn-purple')) {
            btn.style.backgroundColor = '#8A2BE2'; // Force if needed
        }
    }
}

// Global Sync Function
function syncFollowState(targetId, isFollowing) {
    // 1. Update Cache
    if (window.currentUserFollowing) {
        if (isFollowing) window.currentUserFollowing.add(targetId);
        else window.currentUserFollowing.delete(targetId);
    }

    // 2. Update Main Header Button (if matches)
    const headerBtn = document.getElementById('btnFollow');
    if (headerBtn && headerBtn.getAttribute('data-target-id') == targetId) {
        updateButtonVisuals(headerBtn, isFollowing);

        // Update Count Optimistically
        const fCountEl = document.getElementById('profileFollowersCount');
        if (fCountEl) {
            let current = parseInt(fCountEl.innerText) || 0;
            if (isFollowing) current++; else current = Math.max(0, current - 1);
            const label = current === 1 ? 'Seguidor' : 'Seguidores';
            fCountEl.innerText = `${current} ${label}`;
        }
    }
}

// Global Event Listener for Hover Card Sync
window.addEventListener('follow-state-changed', (e) => {
    const { userId, isFollowing } = e.detail;
    console.log("Global Follow Sync:", userId, isFollowing);
    syncFollowState(userId, isFollowing);
});



// State
let productsCache = [];
let currentFilter = 'all';
let currentSearch = '';
let activeWavesurfers = []; // Store WS instances to clean up
window.activeWavesurfers = activeWavesurfers; // EXPOSE FOR SYNC
let currentlyPlaying = null; // Track currently playing instance
let trendingPage = 0; // Pagination for Trending Carousel
let isLoadingProducts = false; // LOCK to prevent AbortError overlap

async function loadUserProducts(user) {
    if (isLoadingProducts) return;
    isLoadingProducts = true;
    const username = user.nickname;
    const trendGrid = document.getElementById('trendingGrid');
    const listContainer = document.getElementById('profileProductsList');

    // Hide Grid container if it exists, ensuring we stick to list
    const gridEl = document.getElementById('profileProductsGrid');
    if (gridEl) gridEl.style.display = 'none';

    // CLEANUP OLD WAVESURFERS (Fix sync issues)
    if (window.activeWavesurfers) {
        window.activeWavesurfers.forEach(ws => {
            try { ws.destroy(); } catch (e) { }
        });
        window.activeWavesurfers.length = 0; // Clear array
    }

    // Initial Loaders (Skeletons) - REMOVED!
    // Skeletons are now in HTML (usuarios.html) to allow instant render.
    // We do NOT wipe trendGrid or listContainer here, to avoid flicker.

    try {
        const response = await fetch(`/api/users/${username}/products`);
        if (!response.ok) throw new Error('Error fetch');

        const products = await response.json();
        productsCache = products || [];

        // --- PRE-FETCH COLLABORATOR STATS ---
        const collabStats = {};
        const uniqueCollabs = new Set();

        productsCache.forEach(p => {
            (p.collaborators || []).forEach(c => {
                const name = c.nickname || c.name;
                if (name) uniqueCollabs.add(name);
            });
        });

        // Parallel Fetch (Background-ish but awaited slightly to ensure UI renders with data)
        // We await here to ensure "Instant" feel, usually fast (~100-300ms)
        // Parallel Fetch with Limit (Avoid overwhelming browser for profiles with 20+ collabs)
        if (uniqueCollabs.size > 0) {
            const collabArray = Array.from(uniqueCollabs);
            // Only fetch first 10 immediately to ensure speed, others can be lazy-fetched if needed
            const toFetch = collabArray.slice(0, 15);
            const promises = toFetch.map(async (nickname) => {
                try {
                    const res = await fetch(`/api/users/${nickname}`);
                    if (res.ok) {
                        const data = await res.json();
                        collabStats[nickname] = {
                            id: data.id,
                            products: data.products_count || 0,
                            followers: data.followers_count || 0,
                            avatar_url: data.avatar_url,
                            is_verified: data.is_verified
                        };
                    }
                } catch (e) { }
            });
            await Promise.all(promises);
        }

        // --- SORT BY TRENDING (Weighted Algorithm) ---
        // Score = Views + 2*Plays + 10*Likes + 20*Downloads + 50*Sales
        const getScore = (p) => {
            return (p.views_count || 0) * 1 +
                (p.plays_count || 0) * 2 +
                (p.stats_likes || 0) * 10 +
                (p.downloads_count || 0) * 20 +
                (p.sales_count || 0) * 50;
        };

        // We keep the original order for the "All" list, or sort it?
        // User wants "Trending" to be real. Let's create a sorted version for Trending.
        window.trendingProducts = [...productsCache].sort((a, b) => getScore(b) - getScore(a));

        if (document.getElementById('profileProductsCount')) {
            document.getElementById('profileProductsCount').innerText = productsCache.length;
        }

        // 1. Trending Carousel Init
        trendingPage = 0;
        updateTrendingView(user, collabStats);
        setupTrendingControls(user, collabStats);

        // 2. Render Main List (All initially)
        renderProductList(productsCache, user, collabStats);

        // 3. Setup Filter Logic
        setupProfileControls();
        setupBioCollapse(); // Initialize Bio Read More

        // 4. Prefetch Hover Data (Background)
        if (window.prefetchArtist) {
            // Prefetch Main User
            window.prefetchArtist(user.nickname);

            // Prefetch Collaborators
            uniqueCollabs.forEach(nick => window.prefetchArtist(nick));
        }

    } catch (e) {
        console.error("Error loading products:", e);
        listContainer.innerHTML = '<div class="empty-state">Error cargando productos.</div>';
        trendGrid.innerHTML = '';
    } finally {
        isLoadingProducts = false;
    }
}

function setupBioCollapse() {
    const bioText = document.getElementById('profileBio');
    if (!bioText) return;

    // Check if bio is long
    const fullText = bioText.innerText;
    if (fullText.length > 150) {
        const charLimit = 150;
        const shortText = fullText.substring(0, charLimit) + "...";

        bioText.setAttribute('data-full', fullText);
        bioText.setAttribute('data-short', shortText);
        bioText.innerHTML = `${shortText} <span id="bioToggle" style="color:var(--p-accent); cursor:pointer; font-weight:600; margin-left:4px;">Ver más</span>`;

        bioText.onclick = (e) => {
            if (e.target.id === 'bioToggle') {
                const isExpanded = bioText.classList.contains('expanded');
                if (isExpanded) {
                    bioText.innerHTML = `${shortText} <span id="bioToggle" style="color:var(--p-accent); cursor:pointer; font-weight:600; margin-left:4px;">Ver más</span>`;
                    bioText.classList.remove('expanded');
                } else {
                    bioText.innerHTML = `${fullText} <span id="bioToggle" style="color:var(--p-accent); cursor:pointer; font-weight:600; margin-left:4px;">Ver menos</span>`;
                    bioText.classList.add('expanded');
                }
            }
        };
    }
}

function setupTrendingControls(user, collabStats) {
    const arrows = document.querySelectorAll('.nav-arrows button');
    if (arrows.length < 2) return;

    const [prevBtn, nextBtn] = arrows;
    const totalItems = (window.trendingProducts || productsCache).length;

    // Visibility Check
    if (totalItems <= 5) {
        prevBtn.style.opacity = '0.3';
        prevBtn.style.cursor = 'default';
        nextBtn.style.opacity = '0.3';
        nextBtn.style.cursor = 'default';
        prevBtn.onclick = null;
        nextBtn.onclick = null;
        return;
    } else {
        prevBtn.style.opacity = '1';
        prevBtn.style.cursor = 'pointer';
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';
    }

    // Next Logic
    nextBtn.onclick = () => {
        const pageSize = 5;
        const maxPages = Math.ceil(totalItems / pageSize);
        trendingPage = (trendingPage + 1) % maxPages; // Cycle: 0 -> 1 -> 0
        updateTrendingView(user, collabStats);
    };

    // Prev Logic
    prevBtn.onclick = () => {
        const pageSize = 5;
        const maxPages = Math.ceil(totalItems / pageSize);
        trendingPage = (trendingPage - 1 + maxPages) % maxPages; // Cycle: 0 -> 1 -> 0
        updateTrendingView(user, collabStats);
    };
}

function updateTrendingView(user, collabStats) {
    const pageSize = 5;
    const start = trendingPage * pageSize; // 0, 5, 10

    // USAR LISTA ORDENADA POR ALGORITMO
    const source = window.trendingProducts || productsCache;
    const sliced = source.slice(start, start + pageSize);

    // If slice is empty (shouldn't happen with correct math), reset
    if (sliced.length === 0 && productsCache.length > 0) {
        trendingPage = 0;
        updateTrendingView(user, collabStats);
        return;
    }

    renderTrending(sliced, user, collabStats);
}

function renderTrending(items, user, collabStats = {}) {
    const container = document.getElementById('trendingGrid');
    if (!container) return;
    container.innerHTML = '';
    container.classList.add('fade-in');

    if (items.length === 0) {
        container.style.display = 'none'; // Hide if no items
        return;
    }

    items.forEach(prod => {
        const div = document.createElement('div');
        div.className = 'trending-card';
        const plays = prod.plays_count || 0;

        const seoLink = window.createSeoLink ? window.createSeoLink(prod) : '/producto.html?id=' + prod.id;

        div.innerHTML = `
            <div class="t-card-cover">
                <img src="${prod.image_url || 'https://via.placeholder.com/300'}" alt="${prod.name}" onclick="window.location.href='${seoLink}'">
                
                <button class="t-play-btn" title="Reproducir">
                    <i class="bi bi-play-fill"></i>
                </button>

                <div class="t-overlay-badge" title="Reproducciones Reales" onclick="window.location.href='${seoLink}'">
                    <i class="bi bi-music-note-beamed"></i> ${plays}
                </div>
            </div>
            <div class="t-card-info">
                <h4 title="${prod.name}" onclick="window.location.href='${seoLink}'">${prod.name}</h4>
                <div class="t-card-author" style="font-size:0.85rem; color:#888;">
                    ${(() => {
                const createSpan = (name, data, extraClass = '') => {
                    const safe = JSON.stringify(data).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                    return `<span class="artist-hover-trigger ${extraClass}" data-artist="${safe}" title="${name}" onmouseenter="window.showArtistCard(event, this)" onmouseleave="window.hideArtistCard(event, this)">${name}</span>`;
                };

                // Producer
                let html = createSpan(user.nickname, {
                    id: user.id,
                    nickname: user.nickname,
                    avatar_url: user.avatar_url,
                    is_verified: user.is_verified || user.is_producer,
                    stats: {
                        followers: user.followers_count || 0
                        // products omitted to ensure hover-card.js can refetch if needed, 
                        // though on profile-public it should be accurate.
                    }
                }, 'producer-link-thin');

                const collabs = (prod.collaborators || [])
                    .filter(c => {
                        const hasName = (c.nickname || c.name) && (c.nickname || c.name).trim().length > 0;
                        const isAccepted = c.status === 'accepted';
                        return hasName && isAccepted;
                    });
                if (collabs.length > 0) {
                    html += `<span style="color:#666; margin-right:2px;">, </span>`;
                    const visible = collabs.slice(0, 2);
                    html += visible.map(c => {
                        const cName = c.nickname || c.name;
                        const pre = collabStats[cName] || {};
                        return createSpan(cName, {
                            id: pre.id || '',
                            nickname: cName,
                            avatar_url: pre.avatar_url || c.avatar_url,
                            is_verified: (pre.is_verified !== undefined) ? pre.is_verified : (c.is_verified || false),
                            stats: {
                                followers: pre.followers !== undefined ? pre.followers : 0
                            }
                        }, 'collaborator-link-thin');
                    }).join('<span style="color:#666; margin-right:2px;">, </span>');

                    if (collabs.length > 2) html += '<span style="color:#666;">...</span>';
                }
                return html;
            })()}
                </div>
            </div>
            <div class="t-meta-row">
                <span>${prod.product_type || 'Beat'}</span>
                <span style="font-size:0.4rem;">●</span>
                <span>${prod.bpm ? prod.bpm + ' BPM' : 'New'}</span>
            </div>
        `;
        // Direct event listener for the play button to prevent navigation
        const playBtn = div.querySelector('.t-play-btn');
        if (playBtn) {
            playBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.StickyPlayer) {
                    // Update playlist data for sticky player
                    const trackData = {
                        ...prod,
                        artist_users: user
                    };
                    window.StickyPlayer.play(trackData);
                }
            };
        }

        // Removed global div.onclick to avoid conflicts with play button
        // div.onclick = () => window.location.href = seoLink;

        container.appendChild(div);
    });
}

function renderProductList(items, user, collabStats = {}) {
    const list = document.getElementById('profileProductsList');
    if (!list) return;

    // Cleanup old wavesurfers
    window.activeWavesurfers.forEach(ws => {
        try { ws.destroy(); } catch (e) { }
    });
    window.activeWavesurfers = [];
    window.currentlyPlaying = null;

    list.innerHTML = '';
    list.classList.add('fade-in');

    if (items.length === 0) {
        // Empty State Logic
        const isOwner = window.currentUserId && (user.id === window.currentUserId);

        if (isOwner) {
            list.innerHTML = `
                <div class="empty-state-cta">
                    <div class="empty-icon">
                        <i class="bi bi-cloud-arrow-up-fill"></i>
                    </div>
                    <h3>Sube tu primer producto</h3>
                    <p>Comparte tus beats, kits o sonidos con el mundo. Solo tú puedes ver esto.</p>
                    <button class="btn-upload-first" onclick="window.location.href='/cuenta/subir-kit.html'">
                        Subir ahora
                    </button>
                </div>
            `;
        } else {
            list.innerHTML = '<div class="empty-state">No se encontraron productos con estos filtros.</div>';
        }

        // Clear playlist if no items
        if (window.StickyPlayer && window.StickyPlayer.updatePlaylist) {
            window.StickyPlayer.updatePlaylist([], user.nickname || 'Unknown');
        }
        return;
    }

    items.forEach((prod, index) => {
        const row = document.createElement('div');
        row.className = 'list-row';
        row.dataset.id = prod.id;
        const seoLink = window.createSeoLink ? window.createSeoLink(prod) : `/producto.html?id=${prod.id}`;

        const price = prod.price_basic ? '$' + prod.price_basic : (prod.is_free ? 'FREE' : '—');
        const bpm = prod.bpm ? `${prod.bpm}` : '—';
        const key = prod.key_scale || '—';
        const duration = "—:—"; // Placeholder if no duration data

        // Unique ID for waveform container
        const waveformId = `waveform-track-${prod.id}-${index}`;

        // Debugging: Log product to see available fields
        console.log(`Product [${prod.name}]:`, prod);

        // Comprehensive Audio Source Check
        // Checks standard fields and fallbacks
        const audioUrl = prod.mp3_url ||
            prod.audio_url ||
            prod.download_url_mp3 ||
            prod.demo_file ||
            prod.tagged_file ||
            prod.preview_url ||
            prod.cloud_url ||
            (prod.track_data ? prod.track_data.audio_url : '') ||
            '';

        if (!audioUrl) {
            console.warn(`No audio URL found for ${prod.name}`);
        }

        row.innerHTML = `
            <!-- 1. Cover -->
            <div class="list-cover" style="cursor: pointer;" onclick="window.location.href = '${seoLink}'">
                <img src="${prod.image_url || 'https://via.placeholder.com/100'}" alt="cover">
            </div>

            <!-- 2. Info (Title + Author) -->
            <div class="list-col-info" style="cursor: pointer;" onclick="event.stopPropagation(); window.location.href = '${seoLink}'">
                <span class="list-track-title">${prod.name}</span>
                <span class="list-author-sub">
                    ${(() => {
                const createArtistSpan = (name, data, extraClass = '') => {
                    const safeData = JSON.stringify(data).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                    return `<span class="artist-hover-trigger ${extraClass}" data-artist="${safeData}" onmouseenter="window.showArtistCard(event, this)" onmouseleave="window.hideArtistCard(event, this)">${name}</span>`;
                };

                // 1. Producer
                const producerData = {
                    id: user.id,
                    nickname: user.nickname,
                    avatar_url: user.avatar_url,
                    is_verified: user.is_verified || user.is_producer,
                    stats: {
                        products: user.products_count || 0,
                        followers: user.followers_count || 0
                    }
                };
                let html = createArtistSpan(user.nickname, producerData, 'producer-link-thin');

                // 2. Collaborators
                const collabs = (prod.collaborators || [])
                    .filter(c => {
                        const hasName = (c.nickname || c.name) && (c.nickname || c.name).trim().length > 0;
                        // Only show if accepted (or if status is undefined, assume legacy/accepted)
                        const isAccepted = c.status === 'accepted';
                        return hasName && isAccepted;
                    });

                if (collabs.length > 0) {
                    html += `<span style="color:#666; margin-right:2px;">, </span>`;

                    const visible = collabs.slice(0, 2);
                    html += visible.map(c => {
                        const cName = c.nickname || c.name;
                        const pre = collabStats[cName] || {};

                        const cData = {
                            id: pre.id || '', // Need ID for follow
                            nickname: cName,
                            avatar_url: pre.avatar_url || c.avatar_url,
                            is_verified: (pre.is_verified !== undefined) ? pre.is_verified : (c.is_verified || false),
                            stats: {
                                products: pre.products !== undefined ? pre.products : 0,
                                followers: pre.followers !== undefined ? pre.followers : 0
                            }
                        };
                        return createArtistSpan(cName, cData, 'collaborator-link-thin');
                    }).join(`<span style="color:#666; margin-right:2px;">, </span>`);

                    if (collabs.length > 2) {
                        html += `<span title="More..." style="cursor:help; color:#666;">, ...</span>`;
                    }
                }
                return html;
            })()}
                </span>
            </div>

            <!-- 3. Player (Play + Wave) -->
            <div class="list-col-player">
                <button class="btn-list-play" id="btn-play-${waveformId}">
                    <i class="bi bi-play-fill"></i>
                </button>
                
                <div class="list-waveform-container list-waveform skeleton-waveform" id="${waveformId}" style="height:28px; flex:1; position:relative;"></div>
            </div>

            <!-- 4. Tags (Duration + Badges) -->
            <div class="list-col-tags">
                <span id="duration-${waveformId}" style="font-size:0.75rem; color:#666; font-weight:700; margin-right:8px; min-width:30px;">--:--</span>
                
                <span class="badge-outline badge-type">${prod.product_type || 'BEAT'}</span>
                ${(() => {
                const pType = (prod.product_type || 'beat').toLowerCase();
                // No green color for tags per user request
                const style = 'border-color:#333; color:#aaa;';

                let content = '';

                if (pType.includes('beat')) {
                    // Beats: Show License Count
                    let licenseCount = 0;

                    // 1. Try checking the 'licenses' JSON object (New Structure)
                    const l = prod.licenses || {};
                    // User JSON example keys: basic, premium, trackout, unlimited
                    if (l.basic?.enabled) licenseCount++;
                    if (l.premium?.enabled) licenseCount++;
                    if (l.trackout?.enabled || l.stems?.enabled) licenseCount++;
                    if (l.unlimited?.enabled || l.exclusive?.enabled) licenseCount++;

                    // 2. Fallback: Check flat price columns (Old Structure) if count is still 0
                    if (licenseCount === 0) {
                        if (prod.price_basic && Number(prod.price_basic) > 0) licenseCount++;
                        if (prod.price_premium && Number(prod.price_premium) > 0) licenseCount++;
                        if (prod.price_stems && Number(prod.price_stems) > 0) licenseCount++;
                        if (prod.price_exclusive && Number(prod.price_exclusive) > 0) licenseCount++;
                    }

                    const label = licenseCount === 1 ? 'Licencia' : 'Licencias';
                    content = `${licenseCount} ${label}`;
                } else if (pType.includes('drum') || pType.includes('sound')) {
                    // Drumkits
                    const c = prod.sounds_count || 0;
                    content = `${c} Sonidos`;
                } else if (pType.includes('loop')) {
                    // Loopkits
                    const c = prod.sounds_count || 0;
                    content = `${c} Loops`;
                } else if (pType.includes('preset')) {
                    // Presets
                    const c = prod.sounds_count || 0;
                    content = `${c} Presets`;
                } else {
                    // Fallback
                    content = '';
                }

                if (content) {
                    return `<span class="badge-outline badge-meta" style="${style}">${content}</span>`;
                }

                return '';
            })()}
            </div>

            <!-- 6. Price -->
            <div class="list-col-price">
                 <button class="btn-list-price" 
                    onclick="event.stopPropagation(); window.location.href = '${seoLink}'">
                    ${prod.is_free ? 'FREE' : '$' + (prod.price_basic || '—')}
                 </button>
            </div>

            <!-- 7. Actions -->
            <div class="list-col-actions" style="width:100%; justify-content:flex-end;">
                ${(() => {
                const isLiked = window.FavoritesManager ? window.FavoritesManager.isLiked(prod.id) : false;
                return `<button class="btn-list-icon" title="Like" style="${isLiked ? 'color:#ef4444;' : ''}">
                        <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i>
                    </button>`;
            })()}
                <button class="btn-list-icon" title="Download"><i class="bi bi-download"></i></button>
                <button class="btn-list-icon" title="Más"><i class="bi bi-three-dots"></i></button>
            </div>
        `;

        list.appendChild(row);

        // Initialize WaveSurfer if audioUrl exists
        if (audioUrl && window.WaveSurfer) {
            const ws = WaveSurfer.create({
                container: document.getElementById(waveformId), // Pass element directly
                waveColor: '#666', // Brighter for dark theme
                progressColor: '#8b5cf6',
                cursorColor: 'transparent',
                barWidth: 2,
                barGap: 2, // Slightly more spaces
                barRadius: 2,
                height: 28,
                normalize: true,
                interact: true,
                url: audioUrl,
                autoCenter: false,    // No moving
                minPxPerSec: 0,       // Static
                partialRender: true,
                hideScrollbar: true
            });

            // TIMEOUT FALLBACK: If WS takes too long, show static fallback
            setTimeout(() => {
                const el = document.getElementById(waveformId);
                if (el && el.classList.contains('skeleton-waveform')) {
                    el.classList.remove('skeleton-waveform');
                    el.classList.add('waveform-static-fallback');
                }
            }, 4000);

            // ERROR FALLBACK
            ws.on('error', (err) => {
                console.warn(`WaveSurfer error for ${prod.name}:`, err);
                const el = document.getElementById(waveformId);
                if (el) {
                    el.classList.remove('skeleton-waveform');
                    el.classList.add('waveform-static-fallback');
                }
            });

            // Handle Review/Ready
            ws.on('ready', () => {
                const waveformEl = document.getElementById(waveformId);
                if (waveformEl) {
                    waveformEl.classList.remove('skeleton-waveform');
                    waveformEl.classList.remove('waveform-static-fallback');
                    waveformEl.style.background = 'transparent';
                }
                const dur = ws.getDuration();
                const mins = Math.floor(dur / 60);
                const secs = Math.floor(dur % 60);
                const durStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

                const durEl = document.getElementById(`duration-${waveformId}`);
                if (durEl) durEl.innerText = durStr;
            });

            ws.on('finish', () => {
                const btn = document.getElementById(`btn-play-${waveformId}`);
                if (btn) btn.innerHTML = '<i class="bi bi-play-fill"></i>';
                window.currentlyPlaying = null;
            });

            ws.on('play', () => {
                const btn = document.getElementById(`btn-play-${waveformId}`);
                if (btn) btn.innerHTML = '<i class="bi bi-pause-fill"></i>';
            });

            ws.on('pause', () => {
                const btn = document.getElementById(`btn-play-${waveformId}`);
                if (btn) btn.innerHTML = '<i class="bi bi-play-fill"></i>';
            });

            // SYNC BACK TO STICKY PLAYER ON INTERACTION
            ws.on('interaction', () => {
                if (window.StickyPlayer && window.StickyPlayer.getCurrentTrackId() === prod.id) {
                    window.StickyPlayer.togglePlay();
                    window.StickyPlayer.seekTo(ws.getCurrentTime());
                } else if (window.StickyPlayer) {
                    // If not active, clicking row plays it
                    window.StickyPlayer.play(prod);
                    setTimeout(() => window.StickyPlayer.seekTo(ws.getCurrentTime()), 100);
                }
            });

            // Store ref with ID to find it later
            ws.customId = waveformId;
            window.activeWavesurfers.push(ws);

            // Play Button Logic (Use Sticky Player)
            const playBtn = document.getElementById(`btn-play-${waveformId}`);
            playBtn.onclick = (e) => {
                e.stopPropagation();

                // Construct Track Data for Sticky Player
                const trackData = {
                    ...prod,
                    artist_users: user // Pass producer object for hover access
                };

                if (window.StickyPlayer) {
                    // Check if this track is currently active
                    const currentId = window.StickyPlayer.getCurrentTrackId();

                    // If it's the SAME track, just Toggle it
                    if (currentId === prod.id) {
                        window.StickyPlayer.togglePlay();
                    } else {
                        // If it's a NEW track, load and play
                        window.StickyPlayer.play(trackData);
                    }
                } else {
                    console.error("StickyPlayer not found");
                }
            };

            /* LEGACY WAVESURFER EVENT LOGIC REMOVED FOR CENTRALIZED PLAYER
             * If we want visuals, we can keep WS just for rendering the waveform, 
             * but disable its own audio playback or sync it.
             * For now, the user requested the Sticky Player take over.
             */
        } else {
            // Fallback for no audio or no library
            document.getElementById(waveformId).innerHTML = '<div style="height:100%; border-bottom:1px solid #333; opacity:0.3;">NO AUDIO</div>';
        }
    });

    // UPDATE STICKY PLAYER PLAYLIST
    // Pass all tracks with artist_users data for proper navigation
    const tracksWithArtist = items.map(prod => ({
        ...prod,
        artist_users: user // Add producer/artist info
    }));

    if (window.StickyPlayer && window.StickyPlayer.updatePlaylist) {
        window.StickyPlayer.updatePlaylist(tracksWithArtist, user.nickname || 'Unknown');
        console.log(`[Profile] Updated StickyPlayer playlist: ${tracksWithArtist.length} tracks`);
    }
}

function setupProfileControls() {
    // 1. Search
    const searchInput = document.getElementById('profileSearch');
    if (searchInput) {
        searchInput.oninput = (e) => {
            currentSearch = e.target.value.toLowerCase();
            applyFilters();
        };
    }

    // 2. Tabs Controls (Filters)
    // Assume we have tabs like <button class="pro-text-filter" data-filter="all">TODOS</button>
    // Or check the user's specific HTML structure for toolbar filters
    document.querySelector('.pro-toolbar-container')?.addEventListener('click', (e) => {
        // Handle filter clicks if they exist within the toolbar 
        // e.g. text-filters
        if (e.target.closest('[data-filter]')) {
            const btn = e.target.closest('[data-filter]');

            // Update Active State
            document.querySelectorAll('[data-filter]').forEach(b => b.style.color = '#777');
            btn.style.color = '#fff'; // Active style

            currentFilter = btn.dataset.filter;
            applyFilters();
        }
    });
}


function applyFilters() {
    const list = document.getElementById('profileProductsList');
    if (!list) return;

    // Filter Logic
    const filtered = productsCache.filter(p => {
        // Text Search
        const matchText = p.name.toLowerCase().includes(currentSearch);

        // Category Filter
        let matchCat = true;
        if (currentFilter !== 'all') {
            const pType = (p.product_type || '').toLowerCase();
            const filter = currentFilter.toLowerCase();

            // Loose matching
            if (filter === 'beat' || filter === 'beats') matchCat = pType.includes('beat');
            else if (filter === 'drum kit' || filter === 'drumkit') matchCat = pType.includes('drum') || pType.includes('kit');
            else if (filter === 'loop' || filter === 'loops') matchCat = pType.includes('loop') || pType.includes('sample');
            else matchCat = pType === filter;
        }
        return matchText && matchCat;
    });

    // 3. Delegated Actions (Like, Download, etc) - Moved to DOMContentLoaded/Init 

    // Get user data from DOM (fallback if not in cache)
    const userNickname = document.getElementById('profileName')?.innerText || 'Unknown';
    const userData = {
        nickname: userNickname,
        id: window.currentProfileUserId || null,
        avatar_url: null,
        is_verified: false,
        products_count: productsCache.length,
        followers_count: 0
    };

    renderProductList(filtered, userData);
}

// === ARTIST HOVER CARD LOGIC ===
// Moved to /script/hover-card.js
// This file now relies on the shared script being imported in the HTML.

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // 1. Delegated Like Click (One-time binding)
    const listContainer = document.getElementById('profileProductsList');
    if (listContainer) {
        listContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-list-icon');
            if (btn && btn.title === 'Like') {
                e.stopPropagation();
                const row = btn.closest('.list-row');
                if (row && window.FavoritesManager) {
                    const prodId = row.dataset.id;
                    window.FavoritesManager.toggleLike(prodId, btn);
                }
            }
        });
    }

    // 2. Favorites Subscription (Sync UI state)
    if (window.FavoritesManager) {
        window.FavoritesManager.subscribe((likedIds) => {
            document.querySelectorAll('.list-row[data-id]').forEach(row => {
                const prodId = row.dataset.id;
                const isLiked = likedIds.has(String(prodId));
                const btn = row.querySelector('.btn-list-icon[title="Like"]');
                if (btn) {
                    btn.innerHTML = isLiked ? '<i class="bi bi-heart-fill"></i>' : '<i class="bi bi-heart"></i>';
                    btn.style.color = isLiked ? '#ef4444' : '';
                }
            });
        });
    }
});
