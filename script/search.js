/**
 * search.js - Advanced Search Results Logic
 */

const SEARCH_CONFIG = {
    API_URL: `${window.OFFSZN_CONFIG?.API_BASE_URL || 'https://offszn.lat'}/api`,
    RESULTS_PER_PAGE: 20
};

// State
let allProducts = [];
let allProducers = [];
let filteredResults = [];
let currentQuery = '';
let currentFilters = {
    categories: [],
    genres: [],
    priceMax: 1000,
    bpmMin: 40,
    bpmMax: 250,
    doubleTempo: false,
    key: 'All'
};

// --- Utilities ---
function getProductUrl(product) {
    if (!product) return '#';
    // Use SEO link generator if available
    if (window.createSeoLink) {
        return window.createSeoLink(product);
    }
    // Fallback to obfuscated link if id-obfuscator is loaded
    if (window.IdObfuscator && window.IdObfuscator.encodeId) {
        const type = (product.product_type || 'beat').toLowerCase();
        const code = window.IdObfuscator.encodeId(product.id);
        const nameSlug = (product.name || 'product').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        return `/${type}/${nameSlug}-${code}`;
    }
    // Deep fallback
    return `/producto.html?id=${product.id}`;
}
window.getProductUrl = getProductUrl; // Expose to window as it was before

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}

function normalizeString(str) {
    if (!str) return '';
    let normalized = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // Explicit mapping for R&B variations
    const rnbVariations = ['r&b', 'r & b', 'r n b', 'rn b', 'rnb'];
    if (rnbVariations.some(v => normalized.includes(v))) {
        // Replace specifically if it's a standalone term or part of a common phrase, 
        // string replacement is safe here as we remove spaces next anyway.
        normalized = normalized.replace(/r\s*&\s*b/g, 'rnb').replace(/r\s*n\s*b/g, 'rnb');
    }

    // Remove all non-alphanumeric characters AND spaces for robust matching
    return normalized.replace(/[^a-z0-9]/g, '');
}

function getSimilarity(s1, s2) {
    let intersection = 0;
    const bigrams1 = new Set();
    const bigrams2 = new Set();
    for (let i = 0; i < s1.length - 1; i++) bigrams1.add(s1.substring(i, i + 2));
    for (let i = 0; i < s2.length - 1; i++) bigrams2.add(s2.substring(i, i + 2));
    if (bigrams1.size === 0 && bigrams2.size === 0) return 1.0; // Both empty or 1 char
    if (bigrams1.size === 0 || bigrams2.size === 0) return 0.0;

    for (const b of bigrams1) if (bigrams2.has(b)) intersection++;
    return (2.0 * intersection) / (bigrams1.size + bigrams2.size);
}

function getMatchScore(product, query, normQuery) {
    if (!query) return 100; // No query = max score

    const name = (product.name || '').toLowerCase();
    const normName = normalizeString(name);
    const genre = (product.genre || '').toLowerCase();
    const tags = (product.tags || []).map(t => t.toLowerCase());
    const normTags = (product.tags || []).map(t => normalizeString(t)).join(''); // join without space since normalize removes spaces
    const producer = (product.producer_name || '').toLowerCase();
    const normProducer = normalizeString(producer);

    // 1. Exact Name Match (Highest Priority)
    if (normName === normQuery || name === query) return 100;

    // 2. Partial Name Match
    if (name.includes(query) || normName.includes(normQuery)) return 80;

    // 3. Genre Match
    if (genre.includes(query) || normalizeString(genre).includes(normQuery)) return 60;

    // 4. Tags Match
    if (tags.some(t => t.includes(query)) || normTags.includes(normQuery)) return 40;

    // 5. Producer Match
    if (producer.includes(query) || normProducer.includes(normQuery)) return 30;

    // 6. Fuzzy Name Match
    const similarity = getSimilarity(normName, normQuery);
    if (similarity > 0.4) return Math.floor(similarity * 20); // Scale up to 20

    return 0; // No match
}
// --- End of Utilities ---

document.addEventListener('DOMContentLoaded', () => {
    initSearchPage();
});

async function initSearchPage() {
    // 1. Get Query from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentQuery = urlParams.get('q') || '';
    const category = urlParams.get('cat') || 'Todo';

    // 2. Initial UI feedback
    const resultsContainer = document.getElementById('search-results-container');
    if (resultsContainer) {
        resultsContainer.innerHTML = '<div class="loading-spinner" style="padding: 50px; text-align: center; color: #888;">Cargando resultados...</div>';
    }

    // 3. Perform Initial Search (Includes fetching and rendering)
    await performSearch();

    // 4. Set Initial Sidebar State from URL if any
    parseUrlFilters(urlParams);

    // 5. Setup Listeners
    setupFilterListeners();
}

async function fetchProducts() {
    try {
        if (!window.supabaseClient) {
            console.error("Supabase client not initialized");
            return [];
        }

        const { data: products, error } = await window.supabaseClient
            .from('products')
            .select('*')
            .neq('status', 'deleted');

        if (error) throw error;
        return products || [];
    } catch (e) {
        console.error("Error fetching products:", e);
        return [];
    }
}

async function fetchProducers() {
    try {
        if (!window.supabaseClient) {
            console.error("Supabase client not initialized");
            return [];
        }
        // Fetch users who are producers
        const { data, error } = await window.supabaseClient
            .from('users')
            .select('id, nickname, avatar_url, is_verified, is_producer, bio')
            .eq('is_producer', true)
            .limit(100);

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error("Error fetching producers:", err);
        return [];
    }
}

async function performSearch() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = (urlParams.get('q') || '').toLowerCase().trim();
    const category = urlParams.get('cat') || 'Todo';

    const [fetchedProducts, fetchedProducers] = await Promise.all([
        fetchProducts(),
        fetchProducers()
    ]);

    // Enrich products with producer data for easier rendering
    allProducts = fetchedProducts.map(p => {
        const producer = fetchedProducers.find(pr => pr.id === p.producer_id || pr.id === p.user_id); // Assuming producer_id or user_id links to users.id
        return {
            ...p,
            producer_name: producer?.nickname || 'OFFSZN Artist',
            producer_nickname: producer?.nickname,
            producer_avatar: producer?.avatar_url,
            producer_is_verified: producer?.is_verified || false
        };
    });
    allProducers = fetchedProducers; // Store all fetched producers

    // 1. FILTER PRODUCERS
    let matchedProducers = [];
    let exactProducer = null;

    if (query !== '' || category === 'Productores') {
        matchedProducers = allProducers.filter(p => {
            const nick = (p.nickname || '').toLowerCase();
            const normNick = normalizeString(nick);
            const similarity = getSimilarity(nick, query);
            const isMatch = nick.includes(query) || normNick.includes(normalizeString(query)) || similarity > 0.7;

            if (query !== '') {
                const exactSimilarity = getSimilarity(p.nickname, query);
                if (normNick === normalizeString(query) || exactSimilarity > 0.85) exactProducer = p;
            }
            return isMatch;
        });
    }

    // 2. FILTER PRODUCTS
    let matchedProducts = allProducts.map(p => {
        const score = getMatchScore(p, query, normalizeString(query));

        // Category Filter
        let matchesCat = true;
        if (category === 'Beats') matchesCat = p.product_type === 'beat';
        else if (category === 'Drum Kits') matchesCat = p.product_type === 'kit';
        else if (category === 'Presets') matchesCat = p.product_type === 'preset';
        else if (category === 'Plantillas') matchesCat = p.product_type === 'template';

        return { ...p, _matchScore: score, _matchesCat: matchesCat };
    })
        .filter(p => p._matchScore > 0 && p._matchesCat)
        .sort((a, b) => b._matchScore - a._matchScore); // Sort by relevance descending

    // 3. UI RENDERING
    // Clean up temporary score/cat properties before rendering if desired, though not strictly necessary
    renderResults(matchedProducts, matchedProducers, exactProducer);
    renderRecommendations(allProducts);
}

function parseUrlFilters(params) {
    if (params.has('cat')) currentFilters.categories = params.get('cat').split(',');
    if (params.has('genre')) currentFilters.genres = params.get('genre').split(',');
}

function setupFilterListeners() {
    // Category Checkboxes
    document.querySelectorAll('.category-check').forEach(check => {
        check.addEventListener('change', (e) => {
            const val = e.target.value;
            if (e.target.checked) {
                currentFilters.categories.push(val);
            } else {
                currentFilters.categories = currentFilters.categories.filter(c => c !== val);
            }
            applyFilters();
        });
    });

    // BPM Range Sliders
    const bpmMinSlider = document.getElementById('bpm-min-slider');
    const bpmMaxSlider = document.getElementById('bpm-max-slider');
    const bpmDisplay = document.getElementById('bpm-range-display');

    if (bpmMinSlider && bpmMaxSlider) {
        const track = document.querySelector('.slider-track');
        const updateBpm = (e) => {
            let min = parseInt(bpmMinSlider.value);
            let max = parseInt(bpmMaxSlider.value);

            if (min > max - 5) {
                if (e && e.target === bpmMinSlider) bpmMinSlider.value = max - 5;
                else bpmMaxSlider.value = min + 5;
                min = parseInt(bpmMinSlider.value);
                max = parseInt(bpmMaxSlider.value);
            }

            // Update track coloring
            if (track) {
                const percent1 = ((min - 40) / (250 - 40)) * 100;
                const percent2 = ((max - 40) / (250 - 40)) * 100;
                track.style.background = `linear-gradient(to right, #1a1a1a ${percent1}%, #fff ${percent1}%, #fff ${percent2}%, #1a1a1a ${percent2}%)`;
            }

            // Sync handles z-index
            if (e && e.target === bpmMinSlider) bpmMinSlider.style.zIndex = "10";
            if (e && e.target === bpmMaxSlider) bpmMaxSlider.style.zIndex = "10";
            if (e && e.target === bpmMinSlider) bpmMaxSlider.style.zIndex = "1";
            if (e && e.target === bpmMaxSlider) bpmMinSlider.style.zIndex = "1";

            currentFilters.bpmMin = min;
            currentFilters.bpmMax = max;
            if (bpmDisplay) bpmDisplay.textContent = `${min} - ${max}`;
            applyFilters();
        };

        bpmMinSlider.addEventListener('input', (e) => updateBpm(e));
        bpmMaxSlider.addEventListener('input', (e) => updateBpm(e));

        // Initial track state
        updateBpm();
    }

    // Double Tempo
    const doubleTempoCheck = document.getElementById('double-tempo-check');
    if (doubleTempoCheck) {
        doubleTempoCheck.addEventListener('change', (e) => {
            currentFilters.doubleTempo = e.target.checked;
            applyFilters();
        });
    }

    // Price Slider
    const priceSlider = document.getElementById('price-max-slider');
    const priceDisplay = document.getElementById('price-display');
    if (priceSlider) {
        priceSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            currentFilters.priceMax = val === 1000 ? null : val;
            if (priceDisplay) {
                const formatted = window.CurrencyManager?.format(val) || `$${val}`;
                priceDisplay.textContent = val === 1000 ? `Hasta ${formatted}` : formatted;
            }
            applyFilters();
        });

        // Initial state sync
        const initialVal = parseFloat(priceSlider.value);
        if (priceDisplay) {
            priceDisplay.textContent = initialVal === 1000 ? 'Cualquiera' : (window.CurrencyManager?.format(initialVal) || `$${initialVal}`);
        }
    }

    // Key Filter
    const keyFilter = document.getElementById('key-filter');
    if (keyFilter) {
        keyFilter.addEventListener('change', (e) => {
            currentFilters.key = e.target.value;
            applyFilters();
        });
    }

    // Clear Filters
    const clearBtn = document.getElementById('clear-filters-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            currentFilters = {
                categories: [],
                genres: [],
                priceMax: null,
                bpmMin: 40,
                bpmMax: 250,
                doubleTempo: false,
                key: 'All'
            };
            // Reset UI
            document.querySelectorAll('.category-check').forEach(c => c.checked = false);
            if (bpmMinSlider) bpmMinSlider.value = 40;
            if (bpmMaxSlider) bpmMaxSlider.value = 250;
            if (bpmDisplay) bpmDisplay.textContent = '40 - 250';
            if (priceSlider) priceSlider.value = 1000;
            if (priceDisplay) priceDisplay.textContent = 'Cualquiera';
            if (keyFilter) keyFilter.value = 'All';
            if (doubleTempoCheck) doubleTempoCheck.checked = false;

            applyFilters();
        });
    }

    // Search Input Sync
    const searchInp = document.getElementById('navbarSearchInput');
    if (searchInp) {
        searchInp.value = currentQuery;
    }
}

function applyFilters() {
    // This function now primarily re-filters based on currentFilters state
    // and then calls renderResults.
    let results = [...allProducts];

    // 1. Text Search
    if (currentQuery) {
        const q = currentQuery.toLowerCase().trim();
        const normQ = normalizeString(q);

        results = results.map(p => {
            const score = getMatchScore(p, q, normQ);
            return { ...p, _matchScore: score };
        }).filter(p => p._matchScore > 0);
    } else {
        results = results.map(p => ({ ...p, _matchScore: 100 }));
    }

    // 2. Category Filter
    if (currentFilters.categories.length > 0) {
        results = results.filter(p => currentFilters.categories.includes(p.product_type));
    }

    // 3. BPM Filter (Range + Double Tempo)
    if (currentFilters.bpmMin !== null || currentFilters.bpmMax !== null) {
        results = results.filter(p => {
            if (!p.bpm) return true;
            const b = parseInt(p.bpm);
            const min = currentFilters.bpmMin || 0;
            const max = currentFilters.bpmMax || 999;

            const matchNormal = b >= min && b <= max;
            if (currentFilters.doubleTempo) {
                const matchDouble = b >= (min * 2) && b <= (max * 2);
                const matchHalf = b >= (min / 2) && b <= (max / 2);
                return matchNormal || matchDouble || matchHalf;
            }
            return matchNormal;
        });
    }

    // 4. Price Filter
    if (currentFilters.priceMax !== null) {
        const max = currentFilters.priceMax;
        results = results.filter(p => {
            const price = parseFloat(p.price_basic) || 0;
            return price <= max;
        });
    }

    // 5. Key Filter
    if (currentFilters.key && currentFilters.key !== 'All') {
        results = results.filter(p => (p.key || '').includes(currentFilters.key));
    }

    // Sort by Match Score Relevance
    results.sort((a, b) => b._matchScore - a._matchScore);

    filteredResults = results;
    // Re-evaluate producers based on the currentQuery for rendering
    const query = (currentQuery || '').toLowerCase().trim();
    const normQuery = normalizeString(query);

    let matchedProducers = [];
    let exactProducer = null;

    if (query !== '' || (currentFilters.categories && currentFilters.categories.includes('Productores'))) {
        matchedProducers = allProducers.filter(p => {
            const nick = (p.nickname || '').toLowerCase();
            const normNick = normalizeString(nick);
            const similarity = getSimilarity(nick, query);
            return nick.includes(query) || normNick.includes(normQuery) || similarity > 0.7;
        });

        exactProducer = matchedProducers.find(p => {
            if (query === '') return false;
            const normNick = normalizeString(p.nickname);
            const similarity = getSimilarity(p.nickname, query);
            return normNick === normQuery || similarity > 0.85;
        });
    }

    renderResults(filteredResults, matchedProducers, exactProducer);
    renderRecommendations();
}

function renderRecommendations() {
    const container = document.getElementById('recommendations-container');
    if (!container) return;

    // Logic: Pick 4 random products NOT in the filtered results
    const filteredIds = new Set(filteredResults.map(p => p.id));
    const pool = allProducts.filter(p => !filteredIds.has(p.id));

    // Shuffle and pick 4
    const shuffled = pool.sort(() => 0.5 - Math.random());
    const recommendations = shuffled.slice(0, 4);

    if (recommendations.length === 0) {
        container.closest('.recommendation-section').style.display = 'none';
        return;
    }

    container.innerHTML = recommendations.map(p => `
        <div class="recommendation-card" onclick="window.location.href='${getProductUrl(p)}'" style="cursor:pointer;">
            <div style="position:relative; padding-bottom:100%; overflow:hidden; border-radius:12px; margin-bottom:12px;">
                <img crossorigin="anonymous" src="${p.image_url || '/images/portada-default.png'}" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover;">
            </div>
            <div style="font-weight:700; font-size:0.9rem; text-transform:uppercase; margin-bottom:4px;">${escapeHTML(p.name)}</div>
            <div style="font-size:0.8rem; color:#888;">${escapeHTML(p.producer_name || 'OFFSZN')}</div>
        </div>
    `).join('');

    signAllR2Images(container);
}

function renderResults(products, producers, exactProducer) {
    const container = document.getElementById('search-results-container');
    const countEl = document.getElementById('results-count-val');
    if (!container) return;

    const totalCount = products.length + producers.length;
    if (countEl) countEl.innerText = totalCount;

    if (totalCount === 0 && currentQuery) {
        renderNoResultsFallback(container);
        return;
    }

    let html = '';

    // A. EXACT PRODUCER MATCH
    if (exactProducer) {
        html += renderExactProducerCard(exactProducer);
    }

    // B. PRODUCTS (Tracks)
    if (products.length > 0) {
        html += `<div class="search-section-title" style="color: #fff; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin: 30px 0 15px; border-left: 3px solid #fff; padding-left: 10px;">Productos</div>`;
        html += products.map(p => renderTrackRow(p)).join('');
    }

    // C. REMAINING PRODUCERS (if not exact or if more than 1)
    const otherProducers = producers.filter(p => p.id !== exactProducer?.id);
    if (otherProducers.length > 0) {
        html += `<div class="search-section-title" style="color: #fff; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin: 50px 0 15px; border-left: 3px solid #fff; padding-left: 10px;">Productores</div>`;
        html += otherProducers.map(p => renderProducerRow(p)).join('');
    }

    if (totalCount === 0) {
        container.innerHTML = '<div style="padding:40px; text-align:center; color:#666;">No se encontraron resultados para tu búsqueda.</div>';
        return;
    }

    container.innerHTML = html;

    // Update Like buttons from FavoritesManager
    if (window.FavoritesManager) {
        container.querySelectorAll('.action-icon.bi-heart').forEach(icon => {
            const id = icon.closest('[data-product-id]')?.dataset.productId;
            if (id && window.FavoritesManager.isLiked(id)) {
                icon.classList.add('liked', 'bi-heart-fill');
                icon.classList.remove('bi-heart');
            }
        });
    }

    // r2-loader.js MutationObserver will auto-sign R2 images in src
}

// signAllR2Images is now handled globally by r2-loader.js MutationObserver
// This function is kept as a no-op for backward compatibility (called from renderNoResultsFallback)
async function signAllR2Images(parent) {
    // r2-loader.js handles this automatically via MutationObserver
    return;
}

function renderTrackRow(p) {
    const imgUrl = p.image_url || '/images/portada-default.png';
    const type = (p.product_type || 'Beat').toUpperCase();
    const producer = p.producer_name || 'OFFSZN';
    const productUrl = getProductUrl(p);

    // Format price
    let displayPrice = 'Gratis';
    if (p.price_basic && parseFloat(p.price_basic) > 0) {
        displayPrice = window.CurrencyManager ? window.CurrencyManager.formatFromString(p.price_basic) : `$${p.price_basic}`;
    }

    return `
        <div class="track-row" data-product-id="${p.id}" onclick="window.location.href='${productUrl}'">
            <div class="track-left">
                <img crossorigin="anonymous" src="${imgUrl}" class="track-thumb" alt="cover">
                <div class="track-info">
                    <div class="track-title" style="color: #fff; font-weight: 700;">${escapeHTML(p.name)}</div>
                    <div class="track-meta" style="color: rgba(255,255,255,0.6); font-size: 0.8rem; display: flex; align-items: center; gap: 8px;">
                        <span class="producer-name">${escapeHTML(producer)}</span>
                        <span style="opacity: 0.3;">/</span>
                        <span class="product-type" style="text-transform: uppercase;">${escapeHTML(type)}</span>
                    </div>
                </div>
            </div>
            
            <div class="track-tags" style="display: flex; gap: 8px; margin-left: auto; margin-right: 20px;">
                <span class="badge-tag">WAV</span>
                <span class="badge-tag">STEMS</span>
            </div>

            <button class="track-price-btn" onclick="handleAddToCart(event, '${p.id}')">
                ${displayPrice}
            </button>

            <div class="track-actions">
                <i class="bi bi-heart action-icon" onclick="handleLike(event, '${p.id}')"></i>
                <i class="bi bi-download action-icon" onclick="handleDownloadRedirect(event, '${productUrl}')"></i>
                <i class="bi bi-share action-icon" onclick="handleShare(event, '${p.id}')"></i>
            </div>
        </div>
    `;
}

function renderExactProducerCard(p) {
    const defaultAvatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.nickname || 'Producer') + '&background=random';
    const avatar = p.avatar_url || defaultAvatarUrl;
    const profileUrl = `/@${encodeURIComponent(p.nickname || 'producer')}`;

    return `
        <div class="exact-match-card" onclick="window.location.href='${profileUrl}'" style="cursor:pointer; background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; display: flex; align-items: center; gap: 20px; transition: all 0.3s ease; margin-bottom: 30px;">
            <div style="position: relative;">
                <img crossorigin="anonymous" src="${avatar}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #fff;">
                ${p.is_verified ? '<i class="bi bi-patch-check-fill" style="position: absolute; bottom: 0; right: 0; color: #fff; font-size: 1.2rem; background: #000; border-radius: 50%;"></i>' : ''}
            </div>
            <div style="flex: 1;">
                <div style="font-size: 0.7rem; color: #fff; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px; opacity: 0.5;">Productor Destacado</div>
                <div style="font-size: 1.5rem; color: #fff; font-weight: 800; margin-bottom: 4px;">${escapeHTML(p.nickname)}</div>
                <div style="font-size: 0.9rem; color: #888; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">${escapeHTML(p.bio || 'Sin biografía disponible.')}</div>
            </div>
            <div class="view-profile-btn" style="padding: 10px 20px; background: #fff; color: #000; border-radius: 8px; font-weight: 700; font-size: 0.85rem;">Ver Perfil</div>
        </div>
    `;
}

function renderProducerRow(p) {
    const defaultAvatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.nickname || 'Producer') + '&background=random';
    const avatar = p.avatar_url || defaultAvatarUrl;
    const profileUrl = `/@${encodeURIComponent(p.nickname || 'producer')}`;

    return `
        <div class="producer-row" onclick="window.location.href='${profileUrl}'" style="cursor:pointer; display: flex; align-items: center; gap: 16px; padding: 12px; border-radius: 12px; transition: background 0.2s; margin-bottom: 8px;">
            <img crossorigin="anonymous" src="${avatar}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; background: #1a1a1a;">
            <div style="flex: 1;">
                <div style="color: #fff; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                    ${escapeHTML(p.nickname)}
                    ${p.is_verified ? '<i class="bi bi-patch-check-fill" style="color: #fff; font-size: 0.9rem;"></i>' : ''}
                </div>
                <div style="color: #666; font-size: 0.8rem; text-transform: uppercase;">Productor</div>
            </div>
            <i class="bi bi-chevron-right" style="color: #444;"></i>
        </div>
    `;
}

// Interactivity Handlers
window.handleTrackPlay = (e, id) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const icon = btn.querySelector('i');

    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    // Format for StickyPlayer
    const audioUrl = product.mp3_url || product.download_url_mp3 || product.preview_url ||
        product.audio_url || product.tagged_file || product.demo_file ||
        product.file_url || product.url_file;

    const trackData = {
        ...product,
        audio_url: audioUrl,
        artist_users: {
            nickname: product.producer_name || 'OFFSZN Artist',
            id: product.producer_id,
            avatar_url: product.producer_avatar || null,
            is_verified: product.producer_is_verified || false
        }
    };

    if (window.StickyPlayer && typeof window.StickyPlayer.play === 'function') {
        // Update playlist context if available
        if (window.StickyPlayer.updatePlaylist && filteredResults.length > 0) {
            const formattedPlaylist = filteredResults.map(p => {
                const aUrl = p.mp3_url || p.download_url_mp3 || p.preview_url ||
                    p.audio_url || p.tagged_file || p.demo_file ||
                    p.file_url || p.url_file;
                return {
                    ...p,
                    audio_url: aUrl,
                    artist_users: {
                        nickname: p.producer_name || 'OFFSZN Artist',
                        id: p.producer_id,
                        avatar_url: p.producer_avatar || null,
                        is_verified: p.producer_is_verified || false
                    }
                };
            });
            window.StickyPlayer.updatePlaylist(formattedPlaylist, 'Resultados de Búsqueda');
        }

        window.StickyPlayer.play(trackData);

        // Visual toggle (though player usually handles this via events, we can do a quick swap)
        document.querySelectorAll('.track-play-btn i').forEach(i => i.className = 'bi bi-play-fill');
        icon.className = 'bi bi-pause-fill';
    }
};

window.handleAddToCart = (e, id) => {
    e.stopPropagation();
    if (window.CartManager && typeof window.CartManager.addItem === 'function') {
        window.CartManager.addItem(id);
    }
};

window.handleLike = (e, id) => {
    e.stopPropagation();
    const icon = e.currentTarget;
    const isLiked = icon.classList.contains('liked');

    if (window.FavoritesManager) {
        if (isLiked) {
            window.FavoritesManager.remove(id);
            icon.classList.remove('liked', 'bi-heart-fill');
            icon.classList.add('bi-heart');
        } else {
            window.FavoritesManager.add(id);
            icon.classList.add('liked', 'bi-heart-fill');
            icon.classList.remove('bi-heart');
        }
    }
};

window.handleDownloadRedirect = (e, url) => {
    e.stopPropagation();
    window.location.href = url;
};

window.handleShare = (e, id) => {
    e.stopPropagation();
    if (window.ShareManager) {
        window.ShareManager.open(id);
    }
};

// --- End of Utilities (Duplicates removed) ---

function renderNoResultsFallback(container) {
    const query = currentQuery.toLowerCase();

    // 1. Find Similar (Same genre or tags as previous searches or just general pool)
    const similar = allProducts.filter(p => {
        const name = (p.name || '').toLowerCase();
        const genre = (p.genre || '').toLowerCase();
        const tags = (p.tags || []).join(' ').toLowerCase();
        // Lower similarity threshold for "Similar" items
        return getSimilarity(name, query) > 0.3 || genre.includes(query) || tags.includes(query);
    }).slice(0, 5);

    // 2. Find Recommendations (Random but high plays)
    const recommended = allProducts
        .filter(p => !similar.find(s => s.id === p.id))
        .sort((a, b) => (b.plays_count || 0) - (a.plays_count || 0))
        .slice(0, 8);

    let html = `
        <div class="no-results-premium">
            <i class="bi bi-search" style="font-size: 3rem; color: #333; margin-bottom: 20px;"></i>
            <h2 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 8px; color: #fff;">No se encontraron resultados</h2>
            <p style="color: #666; margin-bottom: 40px;">No pudimos encontrar nada para "${escapeHTML(currentQuery)}". Prueba con otros términos o filtros.</p>
        </div>
    `;

    if (similar.length > 0) {
        html += `
            <div class="fallback-section">
                <h3 class="fallback-title">Resultados Similares</h3>
                <div class="fallback-grid">
                    ${similar.map(p => renderFallbackItem(p)).join('')}
                </div>
            </div>
        `;
    }

    if (recommended.length > 0) {
        html += `
            <div class="fallback-section" style="margin-top: 50px;">
                <h3 class="fallback-title">Basado en tus gustos</h3>
                <div class="fallback-grid">
                    ${recommended.map(p => renderFallbackItem(p)).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
    if (window.signAllR2Images) window.signAllR2Images(container);
}

function renderFallbackItem(p) {
    const price = window.CurrencyManager?.formatFromString(p.price_basic) || p.price_basic;
    const productUrl = getProductUrl(p);
    return `
        <div class="fallback-card" onclick="window.location.href='${productUrl}'">
            <div class="fallback-card-img">
                <img crossorigin="anonymous" src="${p.image_url || '/images/portada-default.png'}">
                <div class="fallback-card-overlay"><i class="bi bi-play-fill"></i></div>
            </div>
            <div class="fallback-card-info">
                <span class="fallback-card-name">${escapeHTML(p.name)}</span>
                <span class="fallback-card-producer">${escapeHTML(p.producer_name || 'OFFSZN')}</span>
                <span class="fallback-card-price">${price}</span>
            </div>
        </div>
    `;
}
