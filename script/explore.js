/**
 * Explore V3 - Premium Stability & Variety
 * 3-Column Lists, Limited Sections, No Repetitions
 */

const EXPLORE_CONFIG = {
    TRENDS_LIMIT: 5,  // For the list
    FRESH_LIMIT: 5,   // For the list
    PRODUCERS_LIMIT: 5, // For the list
    CAROUSEL_LIMIT: 12,
    CURATED_TYPES: ['drumkit', 'loopkit', 'preset'],
    HERO_ROTATE_MS: 10000
};

// API Configuration
const API_URL = `${window.OFFSZN_CONFIG?.API_BASE_URL || 'https://offszn-oc7c.onrender.com'}/api`;

// State
let allProducts = [];
let allProducers = [];
window.currentUserFollowing = window.currentUserFollowing || new Set();
let heroProducts = [];
let currentHeroIndex = 0;
let heroTimer = null;

// 🛡️ SPA SAFEGUARD: Only run if we are on the Explore page
function isExplorePage() {
    return !!document.getElementById('explore-rows-container');
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
    console.log("🚀 Explore V3 Initializing...");
    initGlobalListeners();

    // 🔥 OPTIMIZATION: Fire all data fetches in parallel
    await fetchData();
    renderExploreFeed();
}

function initGlobalListeners() {
    if (window.FavoritesManager) {
        window.FavoritesManager.subscribe(() => {
            document.querySelectorAll('.card-like-btn').forEach(btn => {
                const id = btn.closest('[data-product-id]')?.dataset.productId;
                if (id) {
                    const isLiked = window.FavoritesManager.isLiked(id);
                    btn.classList.toggle('liked', isLiked);
                    btn.querySelector('i').className = isLiked ? 'bi bi-heart-fill' : 'bi bi-heart';
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
        console.log("⏳ Explore: Session hint found, waiting for token refresh...");
        while (!token && attempts < 20) { // Max 2 seconds
            await new Promise(r => setTimeout(r, 100));
            token = window.AuthUtils.getAccessToken();
            attempts++;
            if (token) break;
        }
        if (token) console.log(`✅ Explore: Token secured after ${attempts * 100}ms`);
        else console.warn("⚠️ Explore: Token wait timed out. Proceeding as guest.");
    }

    // Initialize user state promises
    let userPromises = [];
    if (token) {
        userPromises = [
            fetch(`${API_URL}/me/following`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(r => r.ok ? r.json() : [])
                .catch(() => []),
            // We can also fetch /api/me if needed, but following is priority for this view
        ];
    }

    try {
        // Fetch Content + User Data in Parallel
        const [productsRes, producersRes, leaderboardRes, followingData] = await Promise.all([
            fetch(`${API_URL}/products`),
            fetch(`${API_URL}/producers`),
            fetch(`${API_URL}/leaderboard`),
            // If logged in, this resolves to the list. If not, it resolves to an empty array immediately
            token ? userPromises[0] : Promise.resolve([])
        ]);

        // Process Content
        if (productsRes.ok) allProducts = await productsRes.json();
        if (producersRes.ok) allProducers = await producersRes.json();
        if (leaderboardRes.ok) window.topProducers = await leaderboardRes.json();

        // Process User State (Reliable)
        if (followingData && Array.isArray(followingData)) {
            window.currentUserFollowing = new Set(followingData);
            console.log("✅ User Following Loaded:", window.currentUserFollowing.size);
        } else {
            window.currentUserFollowing = window.currentUserFollowing || new Set();
        }

        if (allProducts.length > 0) {
            // Select Hero products (top activity)
            heroProducts = [...allProducts]
                .sort((a, b) => (b.plays_count || 0) - (a.plays_count || 0))
                .slice(0, 4);
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
    const staticListSkeleton = document.getElementById('explore-list-skeleton');
    if (staticListSkeleton) staticListSkeleton.style.display = 'none';

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

    // 2. LEADERBOARD (Top Producers) - MOVED BELOW as per user request
    if (window.topProducers && window.topProducers.length > 0) {
        const leaderboardContainer = document.createElement('div');
        leaderboardContainer.innerHTML = renderLeaderboard(window.topProducers);
        container.appendChild(leaderboardContainer);
    }

    // 4. SHELF: RECOMENDADOS (Section 3: For you / General)
    const recommended = allProducts
        .filter(p => !usedProductIds.has(p.id))
        .slice(0, EXPLORE_CONFIG.CAROUSEL_LIMIT);
    if (recommended.length > 0) {
        container.appendChild(createShelfRow('Recomendados para ti', recommended));
        recommended.forEach(p => usedProductIds.add(p.id));
    }

    // 5. SHELF: LIBRERÍAS (Section 4: Kits & Sounds)
    const kits = allProducts
        .filter(p => !usedProductIds.has(p.id) && EXPLORE_CONFIG.CURATED_TYPES.includes(p.product_type?.toLowerCase()))
        .slice(0, EXPLORE_CONFIG.CAROUSEL_LIMIT);
    if (kits.length > 0) {
        container.appendChild(createShelfRow('Librerías y Kits de Sonido', kits, 'standard'));
    }

    // 6. SHELF: PRESETS (Section 5: New format)
    const presets = allProducts
        .filter(p => p.product_type?.toLowerCase().includes('preset') || p.product_type?.toLowerCase().includes('voces'))
        .slice(0, EXPLORE_CONFIG.CAROUSEL_LIMIT);
    if (presets.length > 0) {
        container.appendChild(createShelfRow('Presets de voces', presets, 'premium-preset'));
    }
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

    // B. Super Fresh 
    let limitFresh = 5;
    const allFresh = [...filtered]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .filter(p => !allTrends.slice(0, 15).find(t => t.id === p.id));
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

            const rawAudioUrl = product.mp3_url || product.download_url_mp3 || product.preview_url ||
                product.audio_url || product.tagged_file || product.demo_file ||
                product.file_url || product.url_file;

            if (container && rawAudioUrl && window.WaveSurfer) {
                const audioUrl = await window.getAuthorizedUrl(rawAudioUrl);

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
                    console.warn(`Explore Waveform Error [ID: ${id}]:`, e);
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
    const name = item.name || item.nickname || 'Sin nombre';
    const sub = type === 'product' ? (item.producer_nickname || 'OFFSZN Artist') : `${item.products_count || 0} productos`;
    const img = item.image_url || item.avatar_url || 'https://via.placeholder.com/60';
    const isCircle = type === 'producer' ? 'circle' : '';

    // SEO Link
    const link = type === 'product' ? getProductUrl(item) : `/@${item.nickname}`;

    if (type === 'producer') {
        return `
            <div class="list-item-smart" data-id="${item.id}" data-type="producer" onclick="window.location.href='${link}'">
                <div class="list-item-index">${index}</div>
                <img src="${img}" class="list-item-img circle" alt="cover">
                <div class="list-item-info">
                    <div class="list-item-name">${name}</div>
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
            <img src="${img}" class="list-item-img" alt="cover" onclick="event.stopPropagation(); window.handleCoverClick(${item.id})">
            <div class="list-item-info" onclick="event.stopPropagation(); window.handleInfoClick(event, ${item.id}, '${link}')">
                <div class="list-item-name">${name}</div>
                <div class="list-item-sub">${sub}</div>
            </div>
            <div class="list-item-waveform skeleton-waveform" onclick="event.stopPropagation(); window.handleInfoClick(event, ${item.id}, '${link}')"></div>
            <div class="list-item-value">
                <div class="list-play-btn ${hasAudio ? '' : 'disabled'}" id="btn-play-waveform-${item.id}-${index}" onclick="event.stopPropagation(); ${hasAudio ? `window.playTrackById(${item.id})` : ''}">
                    <i class="bi bi-play-fill"></i>
                </div>
            </div>
        </div>
    `;
}

// Global Handlers for List Interactions
window.handleCoverClick = function (id) {
    window.playTrackById(id);
};

window.handleInfoClick = function (event, id, link) {
    window.location.href = link;
};

function getProductAudio(product) {
    if (!product) return null;
    return product.mp3_url || product.download_url_mp3 || product.preview_url ||
        product.audio_url || product.tagged_file || product.demo_file ||
        product.file_url || product.url_file;
}

/**
 * Hero Slider & GSAP Animations
 */
let heroParticles = null;

function startHeroSlider() {
    if (!heroProducts || heroProducts.length === 0) return;

    renderHeroSlide(heroProducts[currentHeroIndex]);
    initHeroParticles();

    if (heroTimer) clearInterval(heroTimer);
    heroTimer = setInterval(() => moveToNextHero(), EXPLORE_CONFIG.HERO_ROTATE_MS);

    // Initialise Touch Swipe Logic
    const heroSection = document.getElementById('explore-hero-container');
    if (heroSection && !heroSection.dataset.swipeBound) {
        let touchStartX = 0;
        let currentX = 0;
        let isDragging = false;

        heroSection.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
            isDragging = true;
            heroSection.style.transition = 'none'; // Disable transition while dragging
        }, { passive: true });

        heroSection.addEventListener('touchmove', e => {
            if (!isDragging) return;
            currentX = e.changedTouches[0].screenX;
            const diffX = currentX - touchStartX;

            // Only allow horizontal drag, 1:1 ratio for native feel
            if (Math.abs(diffX) > 10) {
                heroSection.style.transform = `translateX(${diffX}px)`;
            }
        }, { passive: true });

        heroSection.addEventListener('touchend', e => {
            isDragging = false;
            heroSection.style.transition = 'transform 0.3s ease-out'; // Re-enable smooth snap back
            const touchEndX = e.changedTouches[0].screenX;
            const diffX = touchEndX - touchStartX;

            if (diffX < -50) {
                // Swipe Left -> Next
                window.navToHero((currentHeroIndex + 1) % heroProducts.length);
            } else if (diffX > 50) {
                // Swipe Right -> Prev
                window.navToHero((currentHeroIndex - 1 + heroProducts.length) % heroProducts.length);
            }
            // Snap back to center
            heroSection.style.transform = `translateX(0px)`;

        }, { passive: true });
        heroSection.dataset.swipeBound = 'true';
    }
}

function moveToNextHero() {
    currentHeroIndex = (currentHeroIndex + 1) % heroProducts.length;
    performHeroTransition(currentHeroIndex);
}

function performHeroTransition(index) {
    const heroEl = document.querySelector('.explore-hero');
    if (!heroEl) return;

    const content = heroEl.querySelector('.hero-content');
    const image = heroEl.querySelector('.hero-image-container');

    // Smooth Slide out
    const isNext = (index > currentHeroIndex) || (index === 0 && currentHeroIndex === heroProducts.length - 1);
    const slideDir = isNext ? -30 : 30;

    const tl = gsap.timeline({
        onComplete: () => {
            renderHeroSlide(heroProducts[index], isNext);
        }
    });

    tl.to([content, image], {
        opacity: 0,
        x: slideDir, // Slide slightly left/right on exit
        duration: 0.25,
        ease: "power2.inOut"
    });
}

function renderHeroSlide(product) {
    const heroSection = document.getElementById('explore-hero-container');
    if (!heroSection) return;

    const imgUrl = product.image_url || 'https://via.placeholder.com/400';
    const producer = product.producer_nickname || 'Artista';
    const type = (product.product_type || 'Beat').toUpperCase();

    const dotsHtml = heroProducts.map((_, i) =>
        `<div class="hero-dot ${i === currentHeroIndex ? 'active' : ''}" onclick="window.navToHero(${i})"></div>`
    ).join('');

    heroSection.innerHTML = `
        <div class="explore-hero active" id="hero-card-clickable">
            <!-- Mobile Background Image & Gradient -->
            <div class="hero-mobile-bg mobile-only" style="background-image: url('${imgUrl}')"></div>
            <div class="hero-mobile-gradient mobile-only"></div>

            <canvas class="hero-particles-canvas desktop-only"></canvas>
            
            <div class="hero-content" style="opacity: 0; transform: translateY(15px);">
                <span class="hero-tag desktop-only">Destacado</span>
                <h1 class="hero-title">${product.name}</h1>
                <p class="hero-subtitle desktop-only">Una creación de <strong>${producer}</strong> • ${type}</p>
                
                <!-- Mobile info row -->
                <div class="hero-mobile-info mobile-only">
                    <span class="hero-mobile-artist">${producer}</span>
                    <span class="hero-mobile-dot">&bull;</span>
                    <span class="hero-mobile-type">${type}</span>
                </div>

                <div class="hero-actions desktop-only">
                    <button class="btn-hero-play" id="hero-play-btn">
                        <i class="bi bi-play-fill"></i> Escuchar Ahora
                    </button>
                    <button class="btn-hero-outline" id="hero-details-btn">Ver Detalles</button>
                </div>
            </div>

            <div class="hero-image-container desktop-only" style="opacity: 0; transform: translateX(20px) translateY(-50%);">
                <img src="${imgUrl}" alt="cover" class="hero-image">
            </div>

            <!-- Mobile Purple Play Button -->
            <button class="hero-mobile-play-btn mobile-only" id="hero-mobile-play">
                <i class="bi bi-play-fill" style="margin-left: 3px;"></i>
            </button>

            <div class="hero-indicators">
                ${dotsHtml}
            </div>
        </div>
    `;

    // Premium GSAP Entrance - Synchronized and Fast
    const heroEl = heroSection.querySelector('.explore-hero');
    const content = heroEl.querySelector('.hero-content');
    const image = heroEl.querySelector('.hero-image-container');

    gsap.fromTo([content, image],
        {
            opacity: 0,
            x: arguments.length > 1 && arguments[1] ? 30 : -30 // Slide from opposite dir
        },
        {
            opacity: 1,
            x: 0,
            duration: 0.35,
            ease: "power2.out"
        }
    );

    // Restart Particles for the new canvas
    initHeroParticles();

    // Event Listeners (Restored)
    const playBtn = heroSection.querySelector('#hero-play-btn');
    const detailsBtn = heroSection.querySelector('#hero-details-btn');
    const mobilePlayBtn = heroSection.querySelector('#hero-mobile-play');
    const heroCard = heroSection.querySelector('#hero-card-clickable');

    const doPlay = () => window.playTrack ? window.playTrack(product) : console.log("Play:", product);

    if (playBtn) playBtn.onclick = (e) => { e.stopPropagation(); doPlay(); };
    if (mobilePlayBtn) mobilePlayBtn.onclick = (e) => { e.stopPropagation(); doPlay(); };
    if (detailsBtn) detailsBtn.onclick = (e) => { e.stopPropagation(); window.location.href = getProductUrl ? getProductUrl(product) : '#'; };

    // Clicking the mobile card opens details
    if (heroCard) {
        heroCard.onclick = () => {
            if (window.innerWidth <= 768) {
                window.location.href = getProductUrl ? getProductUrl(product) : '#';
            }
        };
    }
}

function initHeroParticles() {
    const canvas = document.querySelector('.hero-particles-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    let width, height;

    const resize = () => {
        width = canvas.width = canvas.parentElement.offsetWidth;
        height = canvas.height = canvas.parentElement.offsetHeight;
    };
    resize();

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 0.8 + 0.2; // Tiny dots
            this.speedX = (Math.random() * 0.15 - 0.075);
            this.speedY = (Math.random() * 0.15 - 0.075);
            this.opacity = Math.random() * 0.4 + 0.2;
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
            ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`; // White dots
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const init = () => {
        particles = [];
        for (let i = 0; i < 50; i++) {
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
    row.innerHTML = `
        <div class="row-header"><h2 class="row-title">${title}</h2></div>
        <div class="shelf-wrapper">
            <button class="btn-nav prev"><i class="bi bi-chevron-left"></i></button>
            <div class="shelf-container" id="${rowId}">${items.map(item => createProductCardHtml(item, format)).join('')}</div>
            <button class="btn-nav next"><i class="bi bi-chevron-right"></i></button>
        </div>
    `;
    // Different step scroll based on format
    const stepSize = format === 'premium-preset' ? 340 : 220;
    initShelfNavigation(row, rowId, stepSize);
    setTimeout(() => {
        // Support both standard and premium formats
        const cards = row.querySelectorAll('.product-card-smart, .preset-card-premium');
        cards.forEach(card => {
            const id = card.dataset.productId;
            const item = items.find(i => i.id == id);

            // Standard Card Actions
            const playBtn = card.querySelector('.quick-play-btn');
            const likeBtn = card.querySelector('.card-like-btn');

            if (playBtn) playBtn.addEventListener('click', (e) => { e.stopPropagation(); playTrack(item); });
            if (likeBtn) likeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleLike(id, e.currentTarget, item.producer_id); });

            card.addEventListener('click', () => window.location.href = getProductUrl(item));
        });
    }, 0);
    return row;
}

function initShelfNavigation(row, containerId, cardStep) {
    const container = row.querySelector(`#${containerId}`);
    const btnPrev = row.querySelector('.btn-nav.prev');
    const btnNext = row.querySelector('.btn-nav.next');
    const scrollAmount = cardStep * 5 + 100;
    btnPrev.addEventListener('click', () => { container.scrollBy({ left: -scrollAmount, behavior: 'smooth' }); });
    btnNext.addEventListener('click', () => { container.scrollBy({ left: scrollAmount, behavior: 'smooth' }); });
}

function createProductCardHtml(product, format = 'standard') {
    const isLiked = window.FavoritesManager ? window.FavoritesManager.isLiked(product.id) : false;
    const img = product.image_url || 'https://via.placeholder.com/400';
    const artist = product.producer_nickname || 'OFFSZN Artist';

    const cleanName = (name) => {
        if (!name) return 'Sin título';
        return name.replace(/_/g, ' ').replace(/\.(mp3|wav|zip|rar)$/i, '').replace(/\s+/g, ' ').trim();
    };

    if (format === 'premium-preset') {
        const pType = (product.product_type || '').toLowerCase();
        const isTrulyFree = pType !== 'beat' && (product.is_free === true || String(product.is_free) === 'true' || Number(product.price_basic) === 0);
        let priceValue = product.price_basic !== undefined && product.price_basic !== null ? product.price_basic : '20';
        const price = isTrulyFree ? 'FREE' : `$${priceValue}`;
        return `
            <div class="preset-card-premium" data-product-id="${product.id}">
                <img src="${img}" alt="${product.name}">
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

    return `
        <div class="product-card-smart" data-product-id="${product.id}">
            <div class="card-cover-wrapper">
                <img src="${img}" alt="${product.name}">
                <button class="quick-play-btn"><i class="bi bi-play-fill"></i></button>
                <button class="card-like-btn ${isLiked ? 'liked' : ''}"><i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i></button>
            </div>
            <div class="card-info">
                <div class="card-title">${cleanName(product.name)}</div>
                <div class="card-producer">${artist}</div>
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
        if (window.StickyPlayer.getCurrentTrackId() == product.id) {
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
            const audioUrl = p.mp3_url || p.download_url_mp3 || p.preview_url || p.audio_url || p.tagged_file || p.demo_file || p.file_url || p.url_file;
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
        const audioUrl = product.mp3_url || product.download_url_mp3 || product.preview_url ||
            product.audio_url || product.tagged_file || product.demo_file || product.file_url || product.url_file;

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
    if (!allProducts) return;
    const product = allProducts.find(p => p.id == id);
    if (product) playTrack(product);
};

// --- Missing Helpers Restored ---
async function toggleLike(id, btn, ownerId) {
    if (window.FavoritesManager) await window.FavoritesManager.toggleLike(id, btn, ownerId);
}

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
    // Determine Top 10 (or less)
    const top10 = producers.slice(0, 10);
    const midPoint = Math.ceil(top10.length / 2);

    // Split for 2 columns
    const leftCol = top10.slice(0, midPoint);
    const rightCol = top10.slice(midPoint);

    const createRow = (p, i) => {
        const isFollowing = window.currentUserFollowing && window.currentUserFollowing.has(p.id);
        const btnClass = isFollowing ? 'lb-follow-btn following' : 'lb-follow-btn';
        const btnText = isFollowing ? 'Siguiendo' : '<i class="bi bi-plus"></i> Seguir';

        return `
        <div class="leaderboard-item" onclick="window.location.href='/@${p.nickname}'">
            <div class="lb-rank ${p.rank <= 3 ? 'top-rank' : ''}">#${p.rank}</div>
            <img src="${p.avatar_url || 'https://via.placeholder.com/60'}" class="lb-avatar" alt="${p.nickname}">
            <div class="lb-info">
                <div class="lb-name">
                    <span class="lb-nickname-text">${p.nickname}</span> 
                    ${p.is_verified ? '<i class="bi bi-patch-check-fill lb-verified" style="flex-shrink: 0;"></i>' : ''}
                </div>
                <div class="lb-score">${p.score.toLocaleString()} pts</div>
            </div>
             <button class="${btnClass}" onclick="event.stopPropagation(); toggleFollow('${p.id}', this)">
                ${btnText}
            </button>
        </div>
    `};

    return `
        <div class="explore-row leaderboard-section" style="margin-top: 40px; margin-bottom: 60px;">
            <div class="row-header" style="justify-content: flex-start; margin-bottom: 30px;">
                <h2 class="row-title">Top Productores del Mes</h2>
            </div>
            <div class="leaderboard-grid">
                <div class="lb-col">
                    ${leftCol.map(p => createRow(p, p.rank)).join('')}
                </div>
                <div class="lb-col">
                    ${rightCol.map(p => createRow(p, p.rank)).join('')}
                </div>
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

// Make globally available for onclick handlers
window.toggleFollow = toggleFollow;

