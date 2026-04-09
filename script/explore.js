/**
 * Explore V3 - Premium Stability & Variety
 * 3-Column Lists, Limited Sections, No Repetitions
 */

const EXPLORE_CONFIG = {
    TRENDS_LIMIT: 5,  // For the list
    FRESH_LIMIT: 5,   // For the list
    PRODUCERS_LIMIT: 5, // For the list
    CAROUSEL_LIMIT: 12,
    CURATED_TYPES: ['drumkit', 'loopkit'], // Removed 'preset' to keep it isolated for the Presets shelf
    HERO_ROTATE_MS: 10000
};

// API Configuration
const API_URL = `${window.OFFSZN_CONFIG?.API_BASE_URL || 'https://offszn.lat'}/api`;

// State
let allProducts = [];
let allProducers = [];
window.currentUserFollowing = window.currentUserFollowing || new Set();
window.currentUserReposts = window.currentUserReposts || new Set();
let heroProducts = [];
let currentHeroIndex = 0;
let heroTimer = null;

// Producer of the Week Carousel State
window.currentPWIndex = 0;
window.topPWProducers = [];

// 🛡️ SPA SAFEGUARD: Only run if we are on the Explore page
function isExplorePage() {
    return !!document.getElementById('explore-rows-container');
}

// 🛡️ SECURITY: XSS Sanitizer for dynamic innerHTML injection
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

// ------------------- INITIALIZATION -------------------

document.addEventListener('DOMContentLoaded', () => {
    if (!isExplorePage()) return;
    initExplore();
});

// Also listen for SPA navigation events
document.addEventListener('offszn:page-changed', (e) => {
    if (isExplorePage()) {
        initExplore();
    }
});
let usedProductIds = new Set(); // To prevent repetition
let currentCategory = 'Todo';
window.activeWavesurfers = [];
window.currentlyPlaying = null;

/**
 * URL Helpers (Sanitized/Obfuscated)
 */
function getProductUrl(product) {
    if (!product) return '#';
    if (window.createSeoLink) return window.createSeoLink(product);

    // Fallback if not loaded
    const type = (product.product_type || 'beat').toLowerCase();
    const nameSlug = (product.name || 'product').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    let code = product.id;
    if (window.IdObfuscator && window.IdObfuscator.encodeId) {
        code = window.IdObfuscator.encodeId(product.id);
    }
    return `/${type}/${nameSlug}-${code}`;
}

window.getProductUrl = getProductUrl;

async function initExplore() {
    initGlobalListeners();

    // 🔥 OPTIMIZATION: Fire all data fetches in parallel
    await fetchData();
    renderExploreFeed();
}

function initGlobalListeners() {
    if (window.FavoritesManager) {
        window.FavoritesManager.subscribe((likedSet) => {
            // Unify syncing logic similar to search.js syncLikes()
            const allHearts = document.querySelectorAll('.card-like-btn, .post-like-btn, .like-btn');
            allHearts.forEach(btn => {
                const id = btn.closest('[data-product-id]')?.dataset.productId;
                if (id) {
                    const isLiked = likedSet.has(String(id));
                    btn.classList.toggle('liked', isLiked);
                    const icon = btn.querySelector('i');
                    if (icon && !btn.classList.contains('unliking')) {
                        icon.className = isLiked ? 'bi bi-heart-fill' : 'bi bi-heart';
                        if (btn.classList.contains('post-like-btn')) {
                            icon.style.color = isLiked ? '#ef4444' : '';
                        }
                    }
                }
            });
        });
    }
}

async function fetchData() {
    // 🛡️ SMART AUTH WAIT: Polling for token if session hint exists
    let token = window.AuthUtils ? window.AuthUtils.getAccessToken() : null;
    let attempts = 0;
    const hasSessionHint = document.cookie.includes('sb-access-token') || localStorage.getItem('authToken');

    if (!token && hasSessionHint) {
        while (!token && attempts < 20) { // Max 2 seconds
            await new Promise(r => setTimeout(r, 100));
            token = window.AuthUtils.getAccessToken();
            attempts++;
            if (token) break;
        }
    }

    // Initialize user state promises
    let userPromises = [];
    if (token) {
        userPromises = [
            fetch(`${API_URL}/me/following`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(r => r.ok ? r.json() : [])
                .catch(() => []),
        ];
    } else {
        // 🔒 ZERO LATENCY GUEST: Skip waiting for user data
        window.currentUserFollowing = new Set();
    }

    try {
        // Fetch Content + User Data in Parallel
        const promises = [
            fetch(`${API_URL}/products`),
            fetch(`${API_URL}/producers`),
            fetch(`${API_URL}/leaderboard`),
        ];

        if (token) {
            promises.push(userPromises[0]);
        }

        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fetch Timeout')), 5000)
        );

        const results = await Promise.race([
            Promise.all(promises),
            timeout
        ]);
        const productsRes = results[0];
        const producersRes = results[1];
        const leaderboardRes = results[2];
        const followingData = token ? results[3] : [];

        // Process Content
        if (productsRes.ok) {
            allProducts = await productsRes.json();
            // 🔥 FILTER DELETED: Ensure they don't show up in Explore
            allProducts = allProducts.filter(p => 
                p.status !== 'deleted' && 
                !(p.public_slug && p.public_slug.startsWith('deleted'))
            );
        }
        if (producersRes.ok) allProducers = await producersRes.json();
        if (leaderboardRes.ok) {
            const lbData = await leaderboardRes.json();
            window.topProducers = Array.isArray(lbData) ? lbData : [];
        } else {
            window.topProducers = window.topProducers || [];
        }

        // Process User State (Reliable)
        if (followingData && Array.isArray(followingData)) {
            window.currentUserFollowing = new Set(followingData);
        } else {
            window.currentUserFollowing = window.currentUserFollowing || new Set();
        }

        // --- NEW: Fetch Reposts ---
        if (token && window.supabaseClient) {
            const userId = window.AuthUtils.getUserId();
            if (userId) {
                const { data: rd } = await window.supabaseClient
                    .from('reposts')
                    .select('product_id')
                    .eq('user_id', userId);
                if (rd) window.currentUserReposts = new Set(rd.map(r => String(r.product_id)));
            }
        }

        if (allProducts.length > 0) {
            // Select Hero products (top activity)
            heroProducts = [...allProducts]
                .sort((a, b) => (b.plays_count || 0) - (a.plays_count || 0))
                .slice(0, 4);

            // Populate Top 3 PW Producers who have tracks
            window.topPWProducers = [];
            const lb = window.topProducers || [];

            // 🔥 VIP BOOST: User jdagust (Starter)
            const vipId = '91dbeab3-deae-443c-b5c9-af14448884dc';
            let vipProducer = Array.isArray(allProducers) ? allProducers.find(p => String(p.id) === vipId) : null;
            if (!vipProducer) vipProducer = lb.find(p => String(p.id) === vipId);
            
            if (!vipProducer) {
                vipProducer = {
                    id: vipId,
                    nickname: 'jdagust',
                    name: 'jdagust',
                    avatar_url: 'https://ik.imagekit.io/6gzqp4xam/avatars/avatar_91dbeab3-deae-443c-b5c9-af14448884dc_f0ciUJIfE?tr=width-500,height-500,cropType-maintain_ratio,focus-face&v=1774637251819',
                    followers_count: 5,
                    products_count: 4
                };
            }

            if (vipProducer) {
                const tracks = allProducts.filter(p => String(p.producer_id) === vipId);
                if (tracks.length > 0) {
                    window.topPWProducers.push(vipProducer);
                }
            }

            for (let i = 0; i < lb.length; i++) {
                const candidate = lb[i];
                if (!candidate || String(candidate.id) === vipId) continue;
                const tracks = allProducts.filter(p => String(p.producer_id) === String(candidate.id));
                if (tracks.length > 0) {
                    window.topPWProducers.push(candidate);
                    if (window.topPWProducers.length >= 3) break;
                }
            }
        }
    } catch (err) {
        console.error("Fetch error:", err);
        showErrorState();
    }
}

/**
 * Main Render Engine - Limited to 4-5 key sections
 */
function renderExploreFeed() {
    const container = document.getElementById('explore-rows-container');
    if (!container) return;

    // 🔥 Remove static list skeletons
    ['explore-list-skeleton', 'explore-pw-skeleton', 'explore-leaderboard-skeleton'].forEach(id => {
        const sk = document.getElementById(id);
        if (sk) sk.style.display = 'none';
    });

    container.innerHTML = '';
    usedProductIds.clear();

    // 1. HERO SLIDER (Section 1)
    if (heroProducts.length > 0) {
        startHeroSlider();
        heroProducts.forEach(p => usedProductIds.add(p.id));
    }

    // 3. THE LIST GRID (Section 2: Trending / Fresh) - 2 Columns
    const listGridContainer = document.createElement('div');
    listGridContainer.id = 'explore-list-grid-wrapper';
    listGridContainer.appendChild(renderTwoColLists());
    container.appendChild(listGridContainer);

    // NEW: 3.5 PRODUCER OF THE WEEK (Spotlight) - Injecting dynamically after lists
    const pwDynamicContainer = document.createElement('div');
    pwDynamicContainer.id = 'explore-pw-container';
    container.appendChild(pwDynamicContainer);
    renderProducerOfTheWeek();

    // 2. LEADERBOARD (Top Producers) - MOVED BELOW as per user request
    if (window.topProducers && window.topProducers.length > 0) {
        const leaderboardContainer = document.createElement('div');
        leaderboardContainer.innerHTML = renderLeaderboard(window.topProducers);
        container.appendChild(leaderboardContainer);
    }

    // Define preset criteria for filtering
    // Define preset criteria for filtering (incluyendo variaciones de la DB)
    const presetCriteria = (p) => {
        const type = (p.product_type || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        return type === 'preset' || type === 'vocalpreset' || type.includes('preset') ||
            type === 'template' || type === 'plantilla' ||
            cat === 'plantilla' || cat === 'vocal preset' || cat.includes('preset');
    };

    // 4. SHELF: RECOMENDADOS (Section 3: For you / General)
    let recs = allProducts
        .filter(p => !usedProductIds.has(p.id) && !presetCriteria(p))
        .sort(() => 0.5 - Math.random());
    // Fallback: if not enough non-preset products, include presets to fill
    if (recs.length < 5) {
        const extraPresets = allProducts
            .filter(p => !usedProductIds.has(p.id) && presetCriteria(p) && !p.public_slug?.startsWith('deleted'))
            .sort(() => 0.5 - Math.random());
        recs = [...recs, ...extraPresets];
    }
    recs = recs.slice(0, EXPLORE_CONFIG.CAROUSEL_LIMIT);
    if (recs.length > 0) {
        container.appendChild(createShelfRow('Recomendados para ti', recs));
        recs.forEach(p => usedProductIds.add(p.id));
    }

    // 5. SHELF: KITS (Section 4: Kits & Sounds) - Excluding Presets
    const kits = allProducts
        .filter(p => !usedProductIds.has(p.id) && EXPLORE_CONFIG.CURATED_TYPES.includes(p.product_type?.toLowerCase()) && !presetCriteria(p))
        .slice(0, EXPLORE_CONFIG.CAROUSEL_LIMIT);
    if (kits.length > 0) {
        kits.forEach(p => usedProductIds.add(p.id)); // Mark as used
        container.appendChild(createShelfRow('Kits y Librerías', kits, 'standard'));
    }

    // 6. SHELF: PRESETS (Section 5: Social Post format) - Dedicated section
    const presets = allProducts
        .filter(p => !p.public_slug?.startsWith('deleted') && presetCriteria(p))
        .slice(0, 10); // Show up to 10 presets to fill the shelf better

    if (presets.length > 0) {
        container.appendChild(createShelfRow('Presets de voces', presets, 'social-post'));
    }

    /* GSAP Entrance Animation Removed as per user request (instante loading preferred)
    if (window.gsap) {
        gsap.from(container.querySelectorAll('.explore-row, .explore-list-outer'), {
            opacity: 0,
            duration: 0.8,
            stagger: 0.15,
            ease: 'power2.out',
            delay: 0.2
        });
    }
    */
}

/**
 * Two Column List Section (Wavs Style)
 */
function renderTwoColLists(category = 'Todo') {
    const grid = document.createElement('div');
    grid.className = 'explore-list-grid';

    // Filter Logic Mapping
    const filterMap = {
        'Beats': 'beat',
        'Drum Kits': 'drumkit',
        'Loops & Samples': 'loopkit',
        'Presets': 'preset',
        'Plantillas': 'plantilla' // Check if this matches DB, usually 'template' or 'preset' with category
    };

    let filtered = allProducts.filter(p => p.visibility === 'public');
    if (category !== 'Todo') {
        const typeMatch = filterMap[category];
        filtered = filtered.filter(p => p.product_type?.toLowerCase() === typeMatch?.toLowerCase());

        // Fallback: If no products in category, don't show empty, show trending general but preference category
        if (filtered.length === 0) {
            filtered = [...allProducts];
        }
    }

    // A. Trending
    let limitTrends = 5;
    const allTrends = [...filtered]
        .sort((a, b) => {
            const score = p => (p.views_count || 0) + (p.plays_count || 0) * 2 + (p.stats_likes || 0) * 5;
            return score(b) - score(a);
        });
    const trends = allTrends.slice(0, limitTrends);

    // B. Super Fresh (Showing newest first, regardless of trending status)
    let limitFresh = 5;
    const allFresh = [...filtered]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const fresh = allFresh.slice(0, limitFresh);

    grid.innerHTML = `
        <div class="list-col" style="margin-bottom: 60px;">
            <div class="list-col-header">
                <h3 class="list-col-title">Tendencias</h3>
                <span class="list-col-subtitle">Lo más escuchado ahora</span>
            </div>
            <div id="trends-list-container">
                ${trends.map((p, i) => createListItemHtml(p, i + 1, 'product')).join('')}
            </div>
            ${allTrends.length > 5 ? '<button class="btn-ver-mas mobile-only" id="btn-more-trends">Ver más <i class="bi bi-chevron-down"></i></button>' : ''}
        </div>
        <div class="list-col">
            <div class="list-col-header">
                <h3 class="list-col-title">Super Fresh</h3>
                <span class="list-col-subtitle">Subidos esta semana</span>
            </div>
            <div id="fresh-list-container">
                ${fresh.map((p, i) => createListItemHtml(p, i + 1, 'product')).join('')}
            </div>
            ${allFresh.length > 5 ? '<button class="btn-ver-mas mobile-only" id="btn-more-fresh">Ver más <i class="bi bi-chevron-down"></i></button>' : ''}
        </div>
    `;

    const gridOuter = document.createElement('div');
    gridOuter.className = 'explore-list-outer';
    gridOuter.appendChild(grid);

    // Reusable WaveSurfer initialization for new items
    const initWS = (containerNode) => {
        containerNode.querySelectorAll('.list-item-smart[data-type="product"]:not(.ws-initialized)').forEach(async item => {
            item.classList.add('ws-initialized'); // Mark to avoid duplicate inits
            const id = item.dataset.id;
            const product = allProducts.find(p => p.id == id);
            const container = item.querySelector('.list-item-waveform');

            const rawAudioUrl = getProductAudio(product);

            if (container && rawAudioUrl && window.WaveSurfer) {
                const audioUrl = await window.getAuthorizedUrl(rawAudioUrl, product.storage_version || product.r2_version || 'v2', product.id);

                const ws = WaveSurfer.create({
                    container: container,
                    waveColor: '#444',
                    progressColor: '#8b5cf6',
                    cursorColor: 'transparent',
                    barWidth: 2,
                    barGap: 1,
                    barRadius: 2,
                    height: 24,
                    normalize: true,
                    interact: true,
                    url: audioUrl,
                    hideScrollbar: true,
                    backend: 'MediaElement'
                });

                ws.on('ready', () => {
                    container.classList.remove('skeleton-waveform');
                });

                ws.on('error', (e) => {
                    container.classList.remove('skeleton-waveform');
                    container.innerHTML = '<div style="font-size: 0.6rem; color: #555; padding-top: 8px; font-weight: 500;">PREVIEW UNAVAILABLE</div>';
                });

                ws.on('interaction', () => {
                    if (window.StickyPlayer) {
                        if (window.StickyPlayer.getCurrentTrackId() == id) {
                            window.StickyPlayer.seekTo(ws.getCurrentTime());
                        } else {
                            window.playTrack(product);
                            setTimeout(() => window.StickyPlayer.seekTo(ws.getCurrentTime()), 150);
                        }
                    }
                });

                window.activeWavesurfers.push(ws);
            } else if (container) {
                container.classList.remove('skeleton-waveform');
                let fakeWaveformHtml = '<div class="fake-waveform">';
                for (let i = 0; i < 30; i++) {
                    const height = Math.floor(Math.random() * 16 + 4);
                    fakeWaveformHtml += `<div class="fake-bar" style="height: ${height}px; opacity: 0.5;"></div>`;
                }
                fakeWaveformHtml += '</div>';
                container.innerHTML = fakeWaveformHtml;
            }
        });
    };

    // Initialize WaveSurfers after adding to DOM
    setTimeout(() => {
        initWS(grid);

        // Events for "Ver mas"
        const btnMoreTrends = grid.querySelector('#btn-more-trends');
        if (btnMoreTrends) {
            btnMoreTrends.onclick = () => {
                const nextGrp = allTrends.slice(limitTrends, limitTrends + 5);
                const container = grid.querySelector('#trends-list-container');
                const html = nextGrp.map((p, i) => createListItemHtml(p, limitTrends + i + 1, 'product')).join('');
                container.insertAdjacentHTML('beforeend', html);
                limitTrends += 5;
                initWS(container);
                if (limitTrends >= Math.min(15, allTrends.length)) btnMoreTrends.style.display = 'none';
            };
        }

        const btnMoreFresh = grid.querySelector('#btn-more-fresh');
        if (btnMoreFresh) {
            btnMoreFresh.onclick = () => {
                const nextGrp = allFresh.slice(limitFresh, limitFresh + 5);
                const container = grid.querySelector('#fresh-list-container');
                const html = nextGrp.map((p, i) => createListItemHtml(p, limitFresh + i + 1, 'product')).join('');
                container.insertAdjacentHTML('beforeend', html);
                limitFresh += 5;
                initWS(container);
                if (limitFresh >= Math.min(15, allFresh.length)) btnMoreFresh.style.display = 'none';
            };
        }
    }, 150);

    return grid;
}

function createListItemHtml(item, index, type) {
    const name = escapeHTML(item.name || item.nickname || 'Sin nombre');
    const sub = type === 'product' ? escapeHTML(item.producer_nickname || 'OFFSZN Artist') : `${item.products_count || 0} productos`;
    const rawImg = item.image_url || item.avatar_url || '/images/portada-default.png';
    
    // 🔥 R2 Signing Optimization (Match product-core.js)
    const storageVer = item.storage_version || item.r2_version || 'v2';
    const isR2 = (storageVer !== 'supabase') && window.AuthUtils && window.AuthUtils.isR2Url(rawImg);
    const imgPlaceholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    
    let initialSrc = rawImg;
    if (!isR2 && !rawImg.startsWith('http')) {
        const sbUrl = window.SUPABASE_URL || "https://qtjpvztpgfymjhhpoouq.supabase.co";
        // Check if it's already a full URL
        if (!rawImg.includes('supabase.co')) {
            initialSrc = `${sbUrl}/storage/v1/object/public/products/${rawImg}`;
        }
    } else if (isR2) {
        initialSrc = imgPlaceholder;
    }

    // Prepare attributes
    const imgAttr = isR2 ? `src="${imgPlaceholder}" data-r2-src="${escapeHTML(rawImg)}"` : `src="${escapeHTML(initialSrc)}"`;

    const isCircle = type === 'producer' ? 'circle' : '';

    // SEO Link
    const link = type === 'product' ? getProductUrl(item) : `/@${item.nickname}`;

    if (type === 'producer') {
        return `
            <div class="list-item-smart" data-id="${item.id}" data-type="producer" onclick="window.location.href='${link}'">
                <div class="list-item-index">${index}</div>
                <img ${imgAttr} data-r2-version="${storageVer}" data-artist="${item.id}" onmouseenter="showArtistCard(event, this)" onmouseleave="hideArtistCard(event, this)" class="list-item-img circle" alt="cover">
                <div class="list-item-info">
                    <div class="list-item-name" data-artist="${item.id}" onmouseenter="showArtistCard(event, this)" onmouseleave="hideArtistCard(event, this)">${name}</div>
                    <div class="list-item-sub">${sub}</div>
                </div>
                <div class="list-item-value">
                    <i class="bi bi-person-plus" style="font-size: 1.2rem; color: #8b5cf6;"></i>
                </div>
            </div>
        `;
    }

    // Product with Waveform placeholder
    const audioUrl = getProductAudio(item);
    const hasAudio = !!audioUrl;

    return `
        <div class="list-item-smart" data-id="${item.id}" data-type="product">
            <div class="list-item-index">${index}</div>
            <img ${imgAttr} data-r2-version="${storageVer}" data-product-id="${item.id}" class="list-item-img" alt="cover" onclick="event.stopPropagation(); window.handleInfoClick(event, '${item.id}', '${link}')">
            <div class="list-item-info" onclick="event.stopPropagation(); window.handleInfoClick(event, '${item.id}', '${link}')">
                <div class="list-item-name">${name}</div>
                <div class="list-item-sub" data-artist="${item.producer_id}" onmouseenter="showArtistCard(event, this)" onmouseleave="hideArtistCard(event, this)">${sub}</div>
            </div>
            <div class="list-item-waveform skeleton-waveform"></div>
            <div class="list-item-value">
                <div class="list-play-btn ${hasAudio ? '' : 'disabled'}" id="btn-play-waveform-${item.id}-${index}" onclick="event.stopPropagation(); window.handleTrackPlay(event, '${item.id}')">
                    <i class="bi bi-play-fill"></i>
                </div>
            </div>
        </div>
    `;
}

// Global Handlers for List Interactions
window.handleTrackPlay = function (event, id) {
    if (event) event.stopPropagation();
    const item = allProducts.find(p => String(p.id) === String(id));
    if (item && window.playTrack) {
        window.playTrack(item);
    } else if (id && window.playTrackById) {
        window.playTrackById(String(id));
    }
};

window.handleCoverClick = function (id) {
    window.handleTrackPlay(null, id);
};

window.handleInfoClick = function (event, id, link) {
    window.location.href = link;
};

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

/**
 * Hero Slider & GSAP Animations
 */
let heroParticles = null;

function startHeroSlider() {
    if (!heroProducts || heroProducts.length === 0) return;

    const heroContainer = document.getElementById('explore-hero-container');
    if (!heroContainer) return;

    // Render all slides into a track
    heroContainer.innerHTML = `
        <div class="hero-track" id="hero-track">
            ${heroProducts.map((p, i) => renderHeroSlideHtml(p, i)).join('')}
        </div>
        <div class="hero-indicators">
            ${heroProducts.map((_, i) => `<div class="hero-dot ${i === currentHeroIndex ? 'active' : ''}" onclick="window.navToHero(${i})"></div>`).join('')}
        </div>
    `;

    // Sign all images in the track
    if (window.signR2Images) window.signR2Images(heroContainer);

    // Initialise Particles for all desktop slides
    const canvases = heroContainer.querySelectorAll('.hero-particles-canvas');
    canvases.forEach(canvas => initHeroParticles(canvas));

    const track = document.getElementById('hero-track');
    if (!track) return;

    // Final entry animation for the initial slide
    const initialSlide = track.children[currentHeroIndex];
    if (initialSlide) {
        const content = initialSlide.querySelector('.hero-content');
        const image = initialSlide.querySelector('.hero-image-container');
        gsap.fromTo([content, image], { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" });
    }

    if (heroTimer) clearInterval(heroTimer);
    heroTimer = setInterval(() => moveToNextHero(), EXPLORE_CONFIG.HERO_ROTATE_MS);

    // Initialise Touch Swipe Logic
    let touchStartX = 0;
    let currentTranslate = 0;
    let prevTranslate = 0;
    let isDragging = false;
    let startTimestamp = 0;

    const getTranslateX = () => {
        return -currentHeroIndex * heroContainer.offsetWidth;
    };

    const setSliderPosition = (x) => {
        track.style.transform = `translateX(${x}px)`;
    };

    track.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        isDragging = true;
        startTimestamp = Date.now();
        prevTranslate = getTranslateX();
        track.style.transition = 'none';
        if (heroTimer) clearInterval(heroTimer);
    }, { passive: true });

    track.addEventListener('touchmove', e => {
        if (!isDragging) return;
        const currentX = e.touches[0].clientX;
        const diffX = currentX - touchStartX;
        currentTranslate = prevTranslate + diffX;
        setSliderPosition(currentTranslate);
    }, { passive: true });

    track.addEventListener('touchend', e => {
        if (!isDragging) return;
        isDragging = false;

        const touchEndX = e.changedTouches[0].clientX;
        const diffX = touchEndX - touchStartX;
        const movedBy = diffX;
        const duration = Date.now() - startTimestamp;

        // Velocity or distance threshold
        const velocity = Math.abs(movedBy) / duration;
        const threshold = heroContainer.offsetWidth / 3;

        if (movedBy < -threshold || (movedBy < -50 && velocity > 0.5)) {
            // Next
            currentHeroIndex = Math.min(currentHeroIndex + 1, heroProducts.length - 1);
        } else if (movedBy > threshold || (movedBy > 50 && velocity > 0.5)) {
            // Prev
            currentHeroIndex = Math.max(currentHeroIndex - 0, currentHeroIndex - 1);
        }

        performHeroTransition(currentHeroIndex);

        // Restart timer
        if (heroTimer) clearInterval(heroTimer);
        heroTimer = setInterval(() => moveToNextHero(), EXPLORE_CONFIG.HERO_ROTATE_MS);
    }, { passive: true });
}

function moveToNextHero() {
    currentHeroIndex = (currentHeroIndex + 1) % heroProducts.length;
    performHeroTransition(currentHeroIndex);
}

function performHeroTransition(index) {
    const track = document.getElementById('hero-track');
    const heroContainer = document.getElementById('explore-hero-container');
    if (!track || !heroContainer) return;

    const slideWidth = heroContainer.getBoundingClientRect().width;
    const offset = -index * slideWidth;

    gsap.to(track, {
        x: offset,
        duration: 0.6,
        ease: "power3.out",
        onComplete: () => {
            currentHeroIndex = index;
            updateHeroIndicators();
        }
    });
}

// Add global resize listener to keep track aligned
window.addEventListener('resize', () => {
    if (isExplorePage()) {
        const track = document.getElementById('hero-track');
        const heroContainer = document.getElementById('explore-hero-container');
        if (track && heroContainer) {
            const slideWidth = heroContainer.getBoundingClientRect().width;
            track.style.transition = 'none';
            track.style.transform = `translateX(${-currentHeroIndex * slideWidth}px)`;
        }
    }
});

function updateHeroIndicators() {
    const dots = document.querySelectorAll('.hero-dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentHeroIndex);
    });
}

function renderHeroSlideHtml(product, index) {
    const rawImg = product.image_url || '/images/portada-default.png';
    const imgUrl = escapeHTML(rawImg);
    const producer = escapeHTML(product.producer_nickname || 'Artista');
    const type = escapeHTML((product.product_type || 'Beat').toUpperCase());
    const productName = escapeHTML(product.name || 'Sin título');

    const storageVer = product.storage_version || product.r2_version || 'v2';
    const isR2 = (storageVer !== 'supabase') && window.AuthUtils && window.AuthUtils.isR2Url(rawImg);
    const imgPlaceholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    let initialSrc = rawImg;
    if (!isR2 && !rawImg.startsWith('http')) {
        const sbUrl = window.SUPABASE_URL || "https://qtjpvztpgfymjhhpoouq.supabase.co";
        if (!rawImg.includes('supabase.co')) {
            initialSrc = `${sbUrl}/storage/v1/object/public/products/${rawImg}`;
        }
    } else if (isR2) {
        initialSrc = imgPlaceholder;
    }

    const mobileBgAttr = isR2 ? `data-r2-bg="${imgUrl}"` : `style="background-image: url('${escapeHTML(initialSrc)}')"`;

    return `
            <div class="explore-hero" onclick="window.handleHeroClick(${index})">
                <!-- Mobile Background Image & Gradient -->
                <div class="hero-mobile-bg mobile-only" ${mobileBgAttr} data-r2-version="${storageVer}"></div>
                <div class="hero-mobile-gradient mobile-only"></div>

                <canvas class="hero-particles-canvas desktop-only"></canvas>
            
                <div class="hero-content">
                    <h1 class="hero-title">${productName}</h1>
                    <p class="hero-subtitle desktop-only">Una creación de <strong data-artist="${product.producer_id}" onmouseenter="showArtistCard(event, this)" onmouseleave="hideArtistCard(event, this)">${producer}</strong> • ${type}</p>
                    
                    <div class="hero-mobile-info mobile-only">
                        <span class="hero-mobile-artist" data-artist="${product.producer_id}" onmouseenter="showArtistCard(event, this)" onmouseleave="hideArtistCard(event, this)">${producer}</span>
                        <span class="hero-mobile-dot">&bull;</span>
                        <span class="hero-mobile-type">${type}</span>
                    </div>

                    <div class="hero-actions desktop-only">
                        <button class="btn-hero-play" data-hero-index="${index}" onclick="event.stopPropagation(); window.handleHeroPlay(this)">
                            <i class="bi bi-play-fill"></i> Escuchar Ahora
                        </button>
                        <button class="btn-hero-outline" onclick="event.stopPropagation(); window.location.href='${getProductUrl(product)}'">Ver Detalles</button>
                    </div>
                </div>

                <div class="hero-image-container desktop-only">
                    <img ${isR2 ? `src="${imgPlaceholder}" data-r2-src="${imgUrl}"` : `src="${escapeHTML(initialSrc)}"`} 
                         data-r2-version="${storageVer}" data-artist="${product.producer_id}" onmouseenter="showArtistCard(event, this)" onmouseleave="hideArtistCard(event, this)"
                         alt="cover" class="hero-image">
                </div>

                <!-- Mobile White Play Button -->
                <button class="hero-mobile-play-btn mobile-only" data-hero-index="${index}" onclick="event.stopPropagation(); window.handleHeroPlay(this)">
                    <i class="bi bi-play-fill" style="margin-left: 3px; color: #000;"></i>
                </button>
            </div>
    `;
}

window.handleHeroPlay = function (btn) {
    const idx = btn.dataset.heroIndex;
    const product = heroProducts[parseInt(idx)];
    if (product && window.playTrack) {
        window.playTrack(product);
    }
};

function handleHeroClick(index) {
    if (window.innerWidth <= 768) {
        window.location.href = getProductUrl(heroProducts[index]);
    }
}
window.handleHeroClick = handleHeroClick;

window.navToHero = function(index) {
    currentHeroIndex = index;
    performHeroTransition(index);
    if (heroTimer) clearInterval(heroTimer);
    heroTimer = setInterval(() => moveToNextHero(), EXPLORE_CONFIG.HERO_ROTATE_MS);
};

window.changePW = function(direction) {
    if (!window.topPWProducers || window.topPWProducers.length === 0) return;
    
    window.currentPWIndex += direction;
    if (window.currentPWIndex >= window.topPWProducers.length) window.currentPWIndex = 0;
    if (window.currentPWIndex < 0) window.currentPWIndex = window.topPWProducers.length - 1;
    
    renderProducerOfTheWeek();
};

// renderHeroSlide and duplicate functions removed in favor of renderHeroSlideHtml and track layout.

/**
 * PRODUCER OF THE WEEK (PW) - Logic & Rendering
 */
function renderProducerOfTheWeek() {
    const pwContainer = document.getElementById('explore-pw-container');
    if (!pwContainer) return;

    // Check if data is ready
    if (!window.topPWProducers || window.topPWProducers.length === 0) {
        return;
    }

    const featured = window.topPWProducers[window.currentPWIndex];
    if (!featured) return;

    const producerTracks = allProducts
        .filter(p => String(p.producer_id) === String(featured.id))
        .sort((a, b) => (b.plays_count || 0) - (a.plays_count || 0))
        .slice(0, 6);

    const artistName = escapeHTML(featured.nickname || featured.name || 'Artista');
    const handle = (featured.handle || featured.nickname || 'artista').toLowerCase().replace(/\s+/g, '');
    const avatar = featured.avatar_url || '/images/portada-default.png';
    const storageVer = featured.storage_version || featured.r2_version || 'v2';
    const isR2 = (storageVer !== 'supabase') && window.AuthUtils && window.AuthUtils.isR2Url(avatar);
    const imgPlaceholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    let avatarSrc = avatar;
    if (!isR2 && !avatar.startsWith('http') && !avatar.startsWith('/images')) {
        const sbUrl = window.SUPABASE_URL || "https://qtjpvztpgfymjhhpoouq.supabase.co";
        if (!avatar.includes('supabase.co')) {
            // Usually avatars are in avatars bucket, but if it has no prefix, maybe products
            const prefix = avatar.includes('/') ? '' : 'avatars/';
            avatarSrc = `${sbUrl}/storage/v1/object/public/${prefix}${avatar}`;
        }
    } else if (isR2) {
        avatarSrc = imgPlaceholder;
    }

    const topTrack = producerTracks.length > 0 ? producerTracks[0] : null;
    const topTrackId = topTrack ? topTrack.id : null;

    // Stats
    const followersCount = featured.followers_count || 0;
    const productsCount = featured.products_count || 0;

    const imgAttr = isR2 ? `src="${imgPlaceholder}" data-r2-src="${escapeHTML(avatar)}"` : `src="${escapeHTML(avatarSrc)}"`;

    pwContainer.innerHTML = `
        <section class="pw-section">
            <div class="pw-header">
                <h2 class="pw-title">Productor de la semana</h2>
                <a href="/@${handle}" class="pw-view-all">Ver perfil <i class="bi bi-arrow-right"></i></a>
            </div>
            <div class="pw-grid">
                <!-- Featured Artist Side -->
                <div class="pw-featured-card" onclick="window.location.href='/@${handle}'">
                    <div class="pw-featured-img-wrapper">
                        <img ${imgAttr} 
                             data-r2-version="${storageVer}"
                             class="pw-featured-img" alt="${artistName}">
                        
                        ${topTrackId ? `
                        <div class="pw-featured-play-overlay">
                            <button class="pw-featured-play-btn" onclick="event.stopPropagation(); window.handleTrackPlay(event, '${topTrackId}')">
                                <i class="bi bi-play-fill"></i>
                            </button>
                        </div>
                        ` : ''}
                    </div>

                    <div class="pw-featured-content">
                        <div class="pw-featured-name">${artistName}</div>
                        <div class="pw-featured-stats">
                            <div class="pw-stat-row">
                                <span class="pw-stat-value">${followersCount}</span>
                                <span class="pw-stat-label">Seguidores</span>
                            </div>
                            <div class="pw-stat-row">
                                <span class="pw-stat-value">${productsCount}</span>
                                <span class="pw-stat-label">Productos</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tracks List Side (2 Columns) -->
                <div class="pw-tracks-grid">
                    ${producerTracks.map((track, i) => renderPWTrackItemHtml(track, i)).join('')}
                </div>
            </div>
        </section>
    `;
}

function renderPWTrackItemHtml(product, index) {
    const name = escapeHTML(product.name || 'Sin título');
    const rawImg = product.image_url || '/images/portada-default.png';
    const imgUrl = escapeHTML(rawImg);
    
    // Genre/Tags (Hashtags style)
    const genre = (product.category || 'Beat').trim();
    const subGenre = (product.sub_category || 'Detroit').trim();

    // Price formatting
    const isTrulyFree = (product.is_free === true || String(product.is_free) === 'true') && (Number(product.price_basic) === 0 || !product.price_basic);
    const priceValue = (product.price_basic && Number(product.price_basic) > 0) ? product.price_basic : '75';
    const price = isTrulyFree ? 'FREE' : (window.CurrencyManager ? window.CurrencyManager.format(parseFloat(priceValue)) : `$${priceValue}`);

    const storageVer = product.storage_version || product.r2_version || 'v2';
    const isR2 = (storageVer !== 'supabase') && window.AuthUtils && window.AuthUtils.isR2Url(rawImg);
    const imgPlaceholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    
    let initialSrc = rawImg;
    if (!isR2 && !rawImg.startsWith('http') && !rawImg.startsWith('/images')) {
        const sbUrl = window.SUPABASE_URL || "https://qtjpvztpgfymjhhpoouq.supabase.co";
        if (!rawImg.includes('supabase.co')) {
            initialSrc = `${sbUrl}/storage/v1/object/public/products/${rawImg}`;
        }
    } else if (isR2) {
        initialSrc = imgPlaceholder;
    }

    const imgAttr = isR2 ? `src="${imgPlaceholder}" data-r2-src="${escapeHTML(rawImg)}"` : `src="${escapeHTML(initialSrc)}"`;

    return `
        <div class="pw-track-item" id="pw-track-${product.id}" onclick="window.handleTrackPlay(event, '${product.id}')">
            <div class="pw-track-cover-wrapper">
                <img ${imgAttr} 
                     data-r2-version="${storageVer}"
                     class="pw-track-cover" alt="${name}">
                <div class="pw-track-play-overlay">
                    <i class="bi bi-play-fill"></i>
                </div>
            </div>
            <div class="pw-track-info" onclick="event.stopPropagation(); window.location.href='${getProductUrl(product)}'">
                <h3 class="pw-track-name">${name}</h3>
                <div class="pw-track-hashtags">
                    <span class="pw-track-tag">#${genre}</span>
                    <span class="pw-track-tag">#${subGenre}</span>
                </div>
            </div>
            <button class="pw-track-btn-pill" onclick="event.stopPropagation(); window.handleAddToCart(event, '${product.id}')">
                <i class="bi bi-cart3"></i>
                <span class="pw-track-price">${price}</span>
            </button>
        </div>
    `;
}

function initHeroParticles(canvas) {
    if (!canvas) canvas = document.querySelector('.hero-particles-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    let width, height;

    const resize = () => {
        if (!canvas.parentElement) return;
        width = canvas.width = canvas.parentElement.offsetWidth;
        height = canvas.height = canvas.parentElement.offsetHeight;
    };
    resize();

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 1.5 + 0.5; // Slightly larger for glow
            this.speedX = (Math.random() * 0.08 - 0.04); // Slower
            this.speedY = (Math.random() * 0.08 - 0.04); // Slower
            this.opacity = Math.random() * 0.3 + 0.1; // More subtle
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x > width) this.x = 0;
            if (this.x < 0) this.x = width;
            if (this.y > height) this.y = 0;
            if (this.y < 0) this.y = height;
        }
        draw() {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
            ctx.shadowBlur = 4;
            ctx.shadowColor = `rgba(255, 255, 255, ${this.opacity * 0.5})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0; // Reset
        }
    }

    const init = () => {
        particles = [];
        for (let i = 0; i < 20; i++) { // Reduced count for minimal look
            particles.push(new Particle());
        }
    };
    init();

    const animate = () => {
        if (!document.contains(canvas)) return; // Stop if removed
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    };
    animate();
}

// Global nav helper
window.navToHero = (index) => {
    if (index === currentHeroIndex) return;
    currentHeroIndex = index;
    if (heroTimer) clearInterval(heroTimer);
    performHeroTransition(index);
    heroTimer = setInterval(() => moveToNextHero(), EXPLORE_CONFIG.HERO_ROTATE_MS);
};

/**
 * Shelf Components
 */
function createShelfRow(title, items, format = 'standard') {
    const row = document.createElement('div');
    row.className = 'explore-row';
    const rowId = `row-${Math.random().toString(36).substr(2, 9)}`;
    let viewAllUrl = `/search.html?q=${encodeURIComponent(title)}`;
    if (title.toLowerCase().includes('recomendados')) {
        viewAllUrl = '/search.html';
    } else if (title.toLowerCase().includes('kits y librerías')) {
        viewAllUrl = '/search.html?cat=drumkit,loopkit,preset';
    } else if (title.toLowerCase().includes('presets')) {
        viewAllUrl = '/search.html?cat=preset';
    }

    row.innerHTML = `
        <div class="row-header">
            <h2 class="row-title">${title}</h2>
            <div class="row-actions">
                <div class="view-all" onclick="window.location.href='${viewAllUrl}'">
                    Ver todos <i class="bi bi-arrow-right"></i>
                </div>
                <div class="row-nav-arrows mobile-hide">
                    <button class="btn-nav-mini prev" id="prev-${rowId}"><i class="bi bi-chevron-left"></i></button>
                    <button class="btn-nav-mini next" id="next-${rowId}"><i class="bi bi-chevron-right"></i></button>
                </div>
            </div>
        </div>
        <div class="shelf-wrapper">
            <div class="shelf-inner">
                <div class="shelf-container" id="${rowId}">${items.map(item => createProductCardHtml(item, format)).join('')}</div>
            </div>
        </div>
    `;
    // Different step scroll based on format
    const stepSize = (format === 'premium-preset' || format === 'social-post') ? 340 : 264;
    initShelfNavigation(row, rowId, stepSize);
    setTimeout(() => {
        // Support both standard and premium formats
        const cards = row.querySelectorAll('.product-card-smart, .preset-card-premium, .preset-card-social');
        cards.forEach(card => {
            const id = card.dataset.productId;
            const item = items.find(i => String(i.id) === String(id));

            // Social Card Specific Actions
            if (format === 'social-post') {
                const priceBtn = card.querySelector('.post-price-btn');
                if (priceBtn) priceBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (window.Cart) {
                        window.Cart.addItem(item);
                    } else {
                        window.location.href = getProductUrl(item);
                    }
                });

                const likeBtnSoc = card.querySelector('.post-like-btn');
                if (likeBtnSoc) likeBtnSoc.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleLike(id, likeBtnSoc, item.producer_id);
                });

                const shareBtn = card.querySelector('.post-share-btn');
                if (shareBtn) shareBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (window.openShareModal) {
                        window.openShareModal(item);
                    } else {
                        const url = window.location.origin + getProductUrl(item);
                        if (navigator.share) {
                            navigator.share({ title: item.name, url: url }).catch(() => { });
                        } else {
                            navigator.clipboard.writeText(url).then(() => {
                                const icon = shareBtn.querySelector('i');
                                icon.className = 'bi bi-check2';
                                setTimeout(() => icon.className = 'bi bi-share', 2000);
                            });
                        }
                    }
                });

                const repostBtn = card.querySelector('.post-repost-btn');
                if (repostBtn) repostBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    alert("Función de Repost próximamente 🚀");
                });

                const commentBtn = card.querySelector('.post-comment-btn');
                if (commentBtn) commentBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    alert("Comentarios próximamente 💬");
                });
            }

            // Standard Card Actions
            const playBtn = card.querySelector('.quick-play-btn, .post-play-btn');
            const likeBtn = card.querySelector('.card-like-btn');

            if (playBtn) playBtn.addEventListener('click', (e) => { e.stopPropagation(); playTrack(item); });
            if (likeBtn) likeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleLike(id, e.currentTarget, item.producer_id);
            });

            const producerLink = card.querySelector('.card-producer');
            if (producerLink) {
                producerLink.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const nickname = item.producer_nickname || item.nickname;
                    if (nickname) window.location.href = `/@${nickname}`;
                });
            }

            card.addEventListener('click', () => window.location.href = getProductUrl(item));
        });

        // Process R2 signatures for avatars created
        if (typeof window.signR2Images === 'function') {
            window.signR2Images(row);
        }
    }, 0);
    return row;
}

function initShelfNavigation(row, containerId, cardStep) {
    const container = row.querySelector(`#${containerId}`);
    const btnPrev = row.querySelector('.btn-nav-mini.prev') || row.querySelector('.btn-nav.prev');
    const btnNext = row.querySelector('.btn-nav-mini.next') || row.querySelector('.btn-nav.next');

    const scrollAmount = cardStep || 600;

    if (btnPrev && btnNext && container) {
        const updateArrows = () => {
            const scrollLeft = container.scrollLeft;
            const maxScroll = container.scrollWidth - container.clientWidth;

            // Use 'disabled' class instead of hiding
            if (scrollLeft <= 5) {
                btnPrev.classList.add('disabled');
            } else {
                btnPrev.classList.remove('disabled');
            }

            if (scrollLeft >= (maxScroll - 5)) {
                btnNext.classList.add('disabled');
            } else {
                btnNext.classList.remove('disabled');
            }
        };

        btnPrev.addEventListener('click', () => {
            const isPresets = container.closest('.explore-row').querySelector('h2').textContent.toLowerCase().includes('presets');
            const scrollAmount = isPresets ? 1400 : 1332; // Scroll 2 large cards or 6 small cards exactly
            container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });
        btnNext.addEventListener('click', () => {
            const isPresets = container.closest('.explore-row').querySelector('h2').textContent.toLowerCase().includes('presets');
            const scrollAmount = isPresets ? 1400 : 1332; // Scroll 2 large cards or 6 small cards exactly
            container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });

        container.addEventListener('scroll', updateArrows);
        // Initial check
        updateArrows();
        // Check after a short delay for late-rendering content
        setTimeout(updateArrows, 500);
    }
}

function createProductCardHtml(product, format = 'standard') {
    const isLiked = window.FavoritesManager ? window.FavoritesManager.isLiked(product.id) : false;
    const imgPlaceholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    // Helper for resolve storage version and URL
    const getImgInfo = (path, storageVer) => {
        const rawPath = path || '/images/portada-default.png';
        const ver = storageVer || 'v2';
        const isR2 = (ver !== 'supabase') && window.AuthUtils && window.AuthUtils.isR2Url(rawPath);

        let finalSrc = rawPath;
        if (!isR2 && !rawPath.startsWith('http')) {
            const sbUrl = window.SUPABASE_URL || "https://qtjpvztpgfymjhhpoouq.supabase.co";
            if (!rawPath.includes('supabase.co')) {
                finalSrc = `${sbUrl}/storage/v1/object/public/products/${rawPath}`;
            }
        } else if (isR2) {
            finalSrc = imgPlaceholder;
        }

        return {
            attr: isR2 ? `src="${imgPlaceholder}" data-r2-src="${escapeHTML(rawPath)}" data-r2-version="${ver}"` : `src="${escapeHTML(finalSrc)}"`,
            isR2
        };
    };

    const productImg = getImgInfo(product.image_url, product.storage_version || product.r2_version);
    const artist = escapeHTML(product.producer_nickname || 'OFFSZN Artist');
    const handle = escapeHTML(product.producer_handle || product.producer_nickname || 'artista').toLowerCase().replace(/\s+/g, '');

    const cleanName = (name) => {
        if (!name) return 'Sin título';
        return escapeHTML(name.replace(/_/g, ' ').replace(/\.(mp3|wav|zip|rar)$/i, '').replace(/\s+/g, ' ').trim());
    };

    if (format === 'premium-preset') {
        const pType = (product.product_type || '').toLowerCase();
        const isTrulyFree = pType !== 'beat' && (product.is_free === true || String(product.is_free) === 'true') && (Number(product.price_basic) === 0 || !product.price_basic);
        let priceValue = product.price_basic !== undefined && product.price_basic !== null ? product.price_basic : '20';
        const price = isTrulyFree ? 'GRATIS' : (window.CurrencyManager ? window.CurrencyManager.format(parseFloat(priceValue) || 0) : `$${priceValue}`);

        return `
            <div class="preset-card-premium" data-product-id="${product.id}">
                <img ${productImg.attr} alt="${product.name}">
                <div class="preset-overlay">
                    <span class="preset-tag">PRESET</span>
                    <h3 class="preset-title">${cleanName(product.name)}</h3>
                    <div class="preset-info">
                        <span class="preset-sub">${artist}</span>
                        <span class="preset-price">${price}</span>
                    </div>
                </div>
            </div>
        `;
    }

    if (format === 'social-post') {
        const pType = (product.product_type || '').toLowerCase();
        const isTrulyFree = pType !== 'beat' && (product.is_free === true || String(product.is_free) === 'true') && (Number(product.price_basic) === 0 || !product.price_basic);
        const priceValue = (product.price_basic && Number(product.price_basic) > 0) ? product.price_basic : '10';
        const price = isTrulyFree ? 'GRATIS' : (window.CurrencyManager ? window.CurrencyManager.format(parseFloat(priceValue)) : `$${priceValue}`);

        // FIND REAL PRODUCER DATA
        let producer = Array.isArray(allProducers) ? allProducers.find(p => String(p.id) === String(product.producer_id)) : null;

        // Robust fallback: if not in allProducers, check topProducers
        if (!producer && window.topProducers) {
            producer = window.topProducers.find(p => String(p.id) === String(product.producer_id));
        }

        const realArtist = producer ? (producer.nickname || producer.name || artist) : (product.producer_nickname || artist);
        const realAvatarPath = producer ? producer.avatar_url : (product.producer_avatar_url || null);
        const realAvatar = getImgInfo(realAvatarPath, producer?.storage_version || producer?.r2_version || product.producer_storage_version || product.producer_r2_version);
        const realHandle = producer ? (producer.handle || producer.nickname || 'artista').toLowerCase().replace(/\s+/g, '') : (product.producer_nickname || 'usuario').toLowerCase().replace(/\s+/g, '');

        const isLiked = window.FavoritesManager ? window.FavoritesManager.isLiked(product.id) : false;
        const priceDisplay = price;

        return `
            <div class="preset-card-social" data-product-id="${product.id}">
                <div class="post-header" onclick="window.location.href='/@' + encodeURIComponent('${realHandle}')">
                    <img ${realAvatar.attr} class="post-avatar" alt="${realArtist}" data-artist="${product.producer_id}" onmouseenter="showArtistCard(event, this)" onmouseleave="hideArtistCard(event, this)" onerror="this.src='/images/portada-default.png'">
                    <div class="post-user-info">
                        <span class="post-user-handle" data-artist="${product.producer_id}" onmouseenter="showArtistCard(event, this)" onmouseleave="hideArtistCard(event, this)">@${escapeHTML(realHandle)}</span>
                    </div>
                    <div class="post-options">
                        <i class="bi bi-three-dots"></i>
                    </div>
                </div>
                <div class="post-body">
                    <div class="post-cover-wrapper" onclick="window.location.href='${getProductUrl(product)}'">
                        <img ${productImg.attr} class="post-cover" alt="${escapeHTML(product.name)}" onerror="this.src='/images/portada-default.png'">
                        <button class="post-play-btn"><i class="bi bi-play-fill"></i></button>
                    </div>
                    <div class="post-content">
                        <h3 class="post-title">${escapeHTML(product.name)}</h3>
                        <button class="post-price-btn" onclick="handleAddToCart(event, '${product.id}')">
                            <i class="bi bi-cart-plus"></i> ${priceDisplay}
                        </button>
                        <div class="post-actions">
                            <div class="post-action post-like-btn like-btn ${isLiked ? 'liked' : ''}" data-product-id="${product.id}">
                                <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i>
                                <span class="like-counter">${product.likes_count || 0}</span>
                            </div>
                            <div class="post-action post-repost-btn ${window.currentUserReposts.has(String(product.id)) ? 'active' : ''}" 
                                 title="Repost" 
                                 onclick="toggleRepost(event, '${product.id}', this, '${product.producer_id}')">
                                <i class="bi bi-arrow-repeat"></i>
                                <span class="repost-counter">${product.reposts_count || 0}</span>
                            </div>
                            <div class="post-action post-comment-btn" title="Comentar">
                                <i class="bi bi-chat"></i>
                                <span>0</span>
                            </div>
                            <div class="post-action post-share-btn" title="Compartir">
                                <i class="bi bi-share"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="product-card-smart" data-product-id="${product.id}">
            <div class="card-cover-wrapper">
                <img ${productImg.attr} alt="${product.name}">
                <button class="quick-play-btn"><i class="bi bi-play-fill"></i></button>
                <button class="card-like-btn ${isLiked ? 'liked' : ''}">
                    <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i>
                    <span class="like-count">${product.likes_count || 0}</span>
                </button>
            </div>
            <div class="card-info">
                <div class="card-title">${cleanName(product.name)}</div>
                <div class="card-producer" data-artist="${product.producer_id}" onmouseenter="showArtistCard(event, this)" onmouseleave="hideArtistCard(event, this)">${artist}</div>
            </div>
        </div>
    `;
}

function renderCategoryFilters(parent) {
    const filters = ['Todo', 'Beats', 'Drum Kits', 'Loops & Samples', 'Presets', 'Plantillas'];
    const el = document.createElement('div');
    el.className = 'category-filters';
    el.innerHTML = filters.map((f, i) => `<span class="filter-pill ${f === currentCategory ? 'active' : ''}">${f}</span>`).join('');

    // Add Click listeners
    el.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const cat = pill.textContent;
            if (cat === currentCategory) return;

            // UI Update
            el.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            // Logic Update
            currentCategory = cat;
            const gridWrapper = document.getElementById('explore-list-grid-wrapper');
            if (gridWrapper) {
                gridWrapper.innerHTML = '';
                gridWrapper.appendChild(renderTwoColLists(cat));
            }
        });
    });

    parent.appendChild(el);
}

function playTrack(product) {
    if (!product) return;
    if (window.StickyPlayer) {
        // 1. Toggle Logic: If same track, toggle instead of reloading
        // Standardize IDs to strings to prevent precision issues
        const currentId = window.StickyPlayer.getCurrentTrackId();
        if (currentId && String(currentId) === String(product.id)) {
            window.StickyPlayer.togglePlay();
            return;
        }

        // 2. Derive Current Context Playlist
        // Logic: Find the DOM container where the play button was clicked to infer the list context.
        // Since playTrack is called globally from onclick, we'll build a context playlist 
        // dynamically based on currently visible identical containers, or fallback to allProducts.
        let contextList = [];
        try {
            // Find all visible list items
            const visibleItemsDOM = Array.from(document.querySelectorAll('.list-item-smart, .grid-item-card'));
            if (visibleItemsDOM.length > 0) {
                // Try to guess context by grouping. 
                // Simple approach: The entire Explore page DOM items form the play queue context
                visibleItemsDOM.forEach(el => {
                    const pid = el.getAttribute('data-id') || el.id.replace('card-', '');
                    if (pid && allProducts) {
                        const match = allProducts.find(p => p.id == pid);
                        if (match && !contextList.some(t => t.id == match.id)) contextList.push(match);
                    }
                });
            }
        } catch (e) { console.warn("Could not derive DOM context array"); }

        if (contextList.length === 0 && allProducts) contextList = allProducts.slice(0, 50); // limit fallback to 50

        // 3. Format the queue for StickyPlayer
        const formattedPlaylist = contextList.map(p => {
            const audioUrl = getProductAudio(p);
            return {
                ...p,
                audio_url: audioUrl,
                artist_users: {
                    nickname: p.producer_nickname || 'OFFSZN Artist',
                    id: p.producer_id,
                    avatar_url: p.producer_avatar || null,
                    is_verified: p.producer_is_verified || false
                }
            }
        });

        // 4. Send queue to Player
        if (window.StickyPlayer.updatePlaylist && formattedPlaylist.length > 0) {
            window.StickyPlayer.updatePlaylist(formattedPlaylist, 'Explorar');
        }

        // 5. Standardize Data for Current Track & Play
        const audioUrl = getProductAudio(product);

        const trackData = {
            ...product,
            audio_url: audioUrl,
            artist_users: {
                nickname: product.producer_nickname || 'OFFSZN Artist',
                id: product.producer_id,
                avatar_url: product.producer_avatar || null,
                is_verified: product.producer_is_verified || false
            }
        };

        window.StickyPlayer.play(trackData);
    } else {
        console.warn("StickyPlayer not found");
    }
}

window.playTrack = playTrack;

window.playTrackById = function (id) {
    if (!id || id === 'undefined') return;
    if (!allProducts) return;
    const idStr = String(id);
    const product = allProducts.find(p => String(p.id) === idStr);
    if (product) playTrack(product);
    else console.warn('[Explore] Product not found for ID:', id);
};

// --- Missing Helpers Restored ---
// --- Missing Helpers Restored ---
const likeProcessing = new Set();
async function handleLike(id, btn, ownerId) {
    if (!id || likeProcessing.has(id)) return;

    if (window.FavoritesManager) {
        likeProcessing.add(id);
        const isLikedBefore = window.FavoritesManager.isLiked(id);

        // Robust check for the button element
        const targetBtn = (btn && typeof btn.querySelector === 'function') ? btn : null;

        // Determine current count from ANY matching card
        let currentCount = 0;
        const allCards = document.querySelectorAll(`[data-product-id="${id}"]`);
        
        allCards.forEach(card => {
            const likeBtn = card.querySelector('.card-like-btn, .post-like-btn, .like-btn');
            if (likeBtn) {
                const counter = likeBtn.querySelector('.like-count, .like-counter');
                if (counter && currentCount === 0) {
                    currentCount = parseInt(counter.textContent) || 0;
                }
            }
        });

        const newCount = isLikedBefore ? Math.max(0, currentCount - 1) : currentCount + 1;

        // Optimistically update ALL counters for this product
        allCards.forEach(card => {
            const likeBtn = card.querySelector('.card-like-btn, .post-like-btn, .like-btn');
            if (likeBtn) {
                const counter = likeBtn.querySelector('.like-count, .like-counter');
                if (counter) counter.textContent = newCount;
            }
        });

        // --- NEW: Unlike Animation Trigger ---
        if (isLikedBefore && targetBtn) {
            targetBtn.classList.add('unliking');
            const icon = targetBtn.querySelector('i');
            if (icon) {
                icon.className = 'bi bi-heartbreak-fill';
                icon.style.color = '#ef4444';
            }

            setTimeout(() => {
                targetBtn.classList.remove('unliking');
                // Icon and color will be updated by window.FavoritesManager subscription
                // Force sync icons if needed:
                const isCurrentlyLiked = window.FavoritesManager.isLiked(id);
                if (icon) {
                    icon.className = isCurrentlyLiked ? 'bi bi-heart-fill' : 'bi bi-heart';
                    if (targetBtn.classList.contains('post-like-btn')) {
                        icon.style.color = isCurrentlyLiked ? '#ef4444' : '';
                    }
                }
            }, 600);
        }

        try {
            await window.FavoritesManager.toggleLike(id, btn, ownerId);
        } catch (err) {
            console.error('[Explore] Like failed:', err);
            // Revert counters on all cards
            allCards.forEach(card => {
                const likeBtn = card.querySelector('.card-like-btn, .post-like-btn, .like-btn');
                if (likeBtn) {
                    const counter = likeBtn.querySelector('.like-count, .like-counter');
                    if (counter) counter.textContent = currentCount;
                }
            });
        } finally {
            // Processing done, allow next click after a short delay
            setTimeout(() => likeProcessing.delete(id), 500);
        }
    }
}

// Backward compatibility alias
// window.toggleLike alias removed to prevent signature conflicts
window.handleLike = handleLike;

// --- NEW: Repost Logic (Supabase) ---
const repostProcessing = new Set();
async function toggleRepost(event, productId, btn, producerId) {
    if (event) event.stopPropagation();
    if (!productId || repostProcessing.has(productId)) return;

    if (!window.AuthUtils.isLoggedIn()) {
        window.location.href = '/login';
        return;
    }

    const userId = window.AuthUtils.getUserId();
    const isRepostedBefore = btn ? btn.classList.contains('active') : window.currentUserReposts.has(String(productId));

    repostProcessing.add(productId);

    // Determine current count from ANY matching card
    let currentCount = 0;
    const allCards = document.querySelectorAll(`[data-product-id="${productId}"]`);

    allCards.forEach(card => {
        const repostBtn = card.querySelector('.post-repost-btn');
        if (repostBtn) {
            const counter = repostBtn.querySelector('.repost-counter');
            if (counter && currentCount === 0) {
                currentCount = parseInt(counter.textContent) || 0;
            }
        }
    });

    const newCount = isRepostedBefore ? Math.max(0, currentCount - 1) : currentCount + 1;

    // Optimistically update ALL repost buttons for this product
    allCards.forEach(card => {
        const repostBtn = card.querySelector('.post-repost-btn');
        if (repostBtn) {
            repostBtn.classList.toggle('active', !isRepostedBefore);
            const counter = repostBtn.querySelector('.repost-counter');
            if (counter) counter.textContent = newCount;
        }
    });

    try {
        if (!isRepostedBefore) {
            // INSERT REPOST
            const { error } = await window.supabaseClient
                .from('reposts')
                .insert([{ 
                    product_id: productId, 
                    user_id: userId, 
                    producer_id: producerId || null 
                }]);
            if (error) throw error;
            window.currentUserReposts.add(String(productId));
        } else {
            // DELETE REPOST
            const { error } = await window.supabaseClient
                .from('reposts')
                .delete()
                .eq('product_id', productId)
                .eq('user_id', userId);
            if (error) throw error;
            window.currentUserReposts.delete(String(productId));
        }
    } catch (err) {
        console.error('[Explore] Repost failed:', err);
        // Revert UI on failure
        allCards.forEach(card => {
            const repostBtn = card.querySelector('.post-repost-btn');
            if (repostBtn) {
                repostBtn.classList.toggle('active', isRepostedBefore);
                const counter = repostBtn.querySelector('.repost-counter');
                if (counter) counter.textContent = currentCount;
            }
        });
    } finally {
        setTimeout(() => repostProcessing.delete(productId), 500);
    }
}
window.toggleRepost = toggleRepost;

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function showErrorState() {
    const container = document.getElementById('explore-rows-container');
    if (container) container.innerHTML = '<div style="padding: 100px 5%; color: #666; text-align: center;">Error al cargar el feed.</div>';
}


/**
 * Leaderboard Renderer
 */
function renderLeaderboard(producers) {
    // Determine Top 10
    const top10 = producers.slice(0, 10);

    const createProducerCardHtml = (p) => {
        const isFollowing = window.currentUserFollowing && window.currentUserFollowing.has(p.id);
        const btnClass = isFollowing ? 'lb-follow-btn-sp following' : 'lb-follow-btn-sp';
        const btnText = isFollowing ? 'Siguiendo' : 'Seguir';

        // Determine border class for Top 3
        let borderClass = '';
        if (p.rank === 1) borderClass = 'rank-1';
        else if (p.rank === 2) borderClass = 'rank-2';
        else if (p.rank === 3) borderClass = 'rank-3';

        const safeAvatar = escapeHTML(p.avatar_url || '/images/portada-default.png'); // Default fallback
        const safeNickname = escapeHTML(p.nickname || 'Productor');

        return `
        <div class="producer-card-circle-sp" onclick="window.location.href='/@${safeNickname}'">
            <div class="producer-avatar-wrapper">
                <div class="lb-badge-sp">#${p.rank}</div>
                <div class="producer-avatar-sp ${borderClass}">
                     <img src="${safeAvatar}" data-r2-version="${p.storage_version || p.r2_version || 'v2'}" data-artist="${p.id}" onmouseenter="showArtistCard(event, this)" onmouseleave="hideArtistCard(event, this)" alt="${safeNickname}">
                </div>
            </div>
            <div class="producer-info-sp">
                <div class="producer-name-sp" data-artist="${p.id}" onmouseenter="showArtistCard(event, this)" onmouseleave="hideArtistCard(event, this)">
                    ${safeNickname}
                </div>
                <div class="producer-score-sp">${(p.score || 0).toLocaleString()} pts</div>
                <button class="${btnClass}" onclick="event.stopPropagation(); toggleFollow('${p.id}', this)">
                    ${btnText}
                </button>
            </div>
        </div>
        `;
    };

    const rowId = `lb-shelf-${Math.random().toString(36).substr(2, 9)}`;

    // Initialize shelf navigation arrows after DOM injection
    setTimeout(() => {
        const rowContainer = document.getElementById(rowId);
        if (rowContainer) {
            const row = rowContainer.closest('.explore-row');
            if (row) initShelfNavigation(row, rowId, 840);
        }
    }, 150);

    return `
        <div class="explore-row leaderboard-section" style="margin-top: -20px; margin-bottom: 32px;">
            <div class="row-header">
                <h2 class="row-title">Top Productores del Mes</h2>
            </div>
            <div class="shelf-wrapper">
                <button class="btn-nav prev"><i class="bi bi-chevron-left"></i></button>
                <div class="shelf-container" id="${rowId}">
                    ${top10.map(p => createProducerCardHtml(p)).join('')}
                </div>
                <button class="btn-nav next"><i class="bi bi-chevron-right"></i></button>
            </div>
        </div>
    `;
}

/**
 * Handle Follow Action
 */
async function toggleFollow(producerId, btn) {
    const token = window.AuthUtils ? window.AuthUtils.getAccessToken() : null;
    // ... rest of function


    if (!token) {
        // Redirect to login or show modal
        window.location.href = '/pages/login.html';
        return;
    }

    const isFollowing = btn.classList.contains('following');
    const method = isFollowing ? 'DELETE' : 'POST';

    // Optimistic UI Update
    btn.disabled = true;
    if (isFollowing) {
        btn.classList.remove('following');
        btn.innerHTML = '<i class="bi bi-plus"></i> Seguir';
    } else {
        btn.classList.add('following');
        btn.innerText = 'Siguiendo';
    }

    try {
        const res = await fetch(`/api/users/${producerId}/follow`, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            throw new Error('Action failed');
        }

        // Update Global State
        if (isFollowing) {
            window.currentUserFollowing.delete(producerId);
        } else {
            window.currentUserFollowing.add(producerId);
        }

    } catch (err) {
        console.error("Follow error:", err);
        // Revert UI on error
        if (isFollowing) {
            btn.classList.add('following');
            btn.innerText = 'Siguiendo';
        } else {
            btn.classList.remove('following');
            btn.innerHTML = '<i class="bi bi-plus"></i> Seguir';
        }
        alert("Error al seguir usuario via API."); // Simple feedback
    } finally {
        btn.disabled = false;
    }
}

// 🔥 R2 SIGNING UTILITY MOVED TO AUTH-UTILS.JS FOR GLOBAL AVAILABILITY


// Make globally available for onclick handlers
window.toggleFollow = toggleFollow;
window.handleAddToCart = window.handleAddToCart; // Ensure it might be needed but cart.js exposes it

