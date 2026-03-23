/**
 * search.js - Advanced Search Results Logic
 */

const SEARCH_CONFIG = {
    API_URL: `${window.OFFSZN_CONFIG?.API_BASE_URL || 'https://offszn.lat'}/api`,
    RESULTS_PER_PAGE: 20
};

// --- State ---
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
    freeOnly: false,
    keys: [],
    sortBy: 'trending',
    fileTypes: [],
    scale: 'minor',
    licenses: [],
    isDraggingSlider: false
};
let renderTimeout = null; // Debounce for results rendering
let searchAbortController = null; // For cancelling search requests

const imgPlaceholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// --- Skeletons ---
function isPresetProduct(p) {
    if (!p) return false;
    const type = (p.product_type || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    return type === 'preset' || type === 'vocalpreset' || type.includes('preset') ||
        type === 'template' || type === 'plantilla' ||
        cat === 'plantilla' || cat === 'vocal preset' || cat.includes('preset');
}

/**
 * Checks if a product matches any of the given category slugs or labels.
 * Handles synonyms and special logic (like presets).
 */
function isProductInCategory(p, categories) {
    if (!categories || categories.length === 0) return true;

    // Support both single string and array
    const catArray = Array.isArray(categories) ? categories : [categories];
    if (catArray.includes('Todo') || catArray.includes('Todas') || catArray.includes('all')) return true;

    return catArray.some(cat => {
        if (!cat) return true;
        const target = cat.toLowerCase().trim();
        const pType = (p.product_type || '').toLowerCase();
        const pCat = (p.category || '').toLowerCase();

        // Specific mapping for "Beats"
        if (target === 'beat' || target === 'beats') return pType === 'beat';

        // Specific mapping for "Drum Kits"
        if (target === 'drumkit' || target === 'drum kits' || target === 'kit' || target === 'kits') {
            return pType === 'drumkit' || pType === 'kit' || pCat.includes('drum');
        }

        // Specific mapping for "Samples" / "Loop Kits"
        if (target === 'loopkit' || target === 'samples' || target === 'samplepack' || target === 'loop kits' || target === 'sample pack') {
            return pType === 'loopkit' || pType === 'samplepack' || pCat.includes('sample') || pCat.includes('loop');
        }

        // Specific mapping for "Presets"
        if (target === 'preset' || target === 'presets') {
            return isPresetProduct(p);
        }

        // Specific mapping for "Plantillas" / "Templates"
        if (target === 'template' || target === 'plantillas' || target === 'templates' || target === 'plantilla') {
            return pType === 'template' || pType === 'plantilla' || pCat.includes('template') || pCat.includes('plantilla');
        }

        // Literal match
        return pType === target || pCat.includes(target);
    });
}

function getProductAudio(product) {
    if (!product) return null;

    if (isPresetProduct(product) && product.audio_after_url) {
        return product.audio_after_url;
    }

    return product.mp3_url || product.download_url_mp3 || product.preview_url ||
        product.audio_url || product.tagged_file || product.demo_file ||
        product.file_url || product.url_file || '';
}

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// --- Skeletons ---
function showResultsSkeletons() {
    const container = document.getElementById('search-results-container');
    if (!container) return;

    let html = '';
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // Use the EXACT same classes and structure as real content
        for (let i = 0; i < 6; i++) {
            html += `
                <div class="offszn-m-track-v2 skeleton-active">
                    <div class="m-v2-main-row">
                        <div class="m-v2-thumb skeleton-pulse"></div>
                        <div class="m-v2-info">
                            <div class="skeleton-pulse" style="height: 14px; width: 70%; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 8px;"></div>
                            <div class="skeleton-pulse" style="height: 10px; width: 40%; background: rgba(255,255,255,0.03); border-radius: 4px;"></div>
                        </div>
                        <div class="m-v2-play-container">
                             <div class="skeleton-pulse" style="width: 44px; height: 44px; border-radius: 50%; opacity: 0.1;"></div>
                        </div>
                        <div class="m-v2-actions">
                             <div class="skeleton-pulse" style="width: 32px; height: 32px; border-radius: 50%; opacity: 0.05;"></div>
                             <div class="skeleton-pulse" style="width: 32px; height: 32px; border-radius: 50%; opacity: 0.05;"></div>
                        </div>
                    </div>
                </div>
            `;
        }
    } else {
        // Desktop skeletons (Untouched per user request)
        for (let i = 0; i < 6; i++) {
            html += `
                <div class="track-row-skeleton">
                    <div class="thumb-skeleton skeleton-pulse"></div>
                    <div class="info-skeleton">
                        <div class="title-skeleton skeleton-pulse"></div>
                        <div class="meta-skeleton skeleton-pulse"></div>
                    </div>
                    <div class="actions-skeleton-group">
                        <div class="action-btn-skeleton skeleton-pulse"></div>
                        <div class="price-btn-skeleton skeleton-pulse"></div>
                    </div>
                </div>
            `;
        }
    }
    container.innerHTML = html;
}

function showRecommendationSkeletons(count = 6) {
    const container = document.getElementById('recommendations-container');
    if (!container) return;

    const isMobile = window.innerWidth <= 768;
    let html = '';

    for (let i = 0; i < count; i++) {
        if (isMobile) {
            html += `
                <div class="skeleton-card-smart">
                    <div class="skeleton-img-smart skeleton-pulse"></div>
                    <div class="skeleton-text-smart title skeleton-pulse"></div>
                    <div class="skeleton-text-smart sub skeleton-pulse"></div>
                </div>
            `;
        } else {
            // Standard grid skeleton for desktop
            html += `
                <div class="skeleton-card">
                    <div class="skeleton-card-img skeleton-pulse"></div>
                    <div class="skeleton-text medium skeleton-pulse"></div>
                    <div class="skeleton-text short skeleton-pulse"></div>
                </div>
            `;
        }
    }
    container.innerHTML = html;
}

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

function normalizeKey(k) {
    if (!k) return '';
    return k.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/minor/g, 'm')
        .replace(/min/g, 'm')
        .replace(/major/g, '')
        .replace(/maj/g, '')
        .replace(/#/g, 's'); // Use 's' for sharp internally to avoid char issues
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

function resolveProductLicenses(product, producer) {
    const FACTORY_DEFAULTS = {
        'basic': { name: 'Basic Lease', price: 20, enabled: true },
        'premium': { name: 'Premium Lease', price: 40, enabled: true },
        'trackout': { name: 'Trackout Lease', price: 60, enabled: true },
        'unlimited': { name: 'Unlimited License', price: 80, enabled: true }
    };
    const licenseKeys = ['basic', 'premium', 'trackout', 'unlimited'];
    const colMap = {
        'basic': 'price_basic',
        'premium': 'price_premium',
        'trackout': 'price_stems',
        'unlimited': 'price_exclusive'
    };

    const pType = (product.product_type || '').toLowerCase();

    // For non-beats, use price_basic as the single "license"
    if (pType !== 'beat') {
        return [{ id: 'basic', name: 'Price', price: parseFloat(product.price_basic) || 0, enabled: true }];
    }

    const productLicenses = product.licenses || {};
    const producerSettings = producer?.license_settings || {};

    return licenseKeys.map(key => {
        const offsznKey = `offszn_${key}`;

        // --- 1. Identify Product JSON Data with Alias Support ---
        let prodLic = productLicenses[offsznKey] || productLicenses[key] || {};

        if (key === 'unlimited') {
            // Unlimited prioritizes 'exclusive' settings
            const exclusiveData = productLicenses['offszn_exclusive'] || productLicenses['exclusive'];
            if (exclusiveData && Object.keys(exclusiveData).length > 0) prodLic = exclusiveData;
        } else if (key === 'trackout') {
            // Trackout checks for 'stems' synonyms if primary key is missing
            if (Object.keys(prodLic).length === 0) {
                prodLic = productLicenses['offszn_stems'] || productLicenses['stems'] || {};
            }
        }

        // --- 2. Identify Producer Settings with Alias Support ---
        let userLic = (producerSettings[offsznKey] || producerSettings[key]) || {};

        if (key === 'unlimited') {
            const exclusiveUserData = producerSettings['offszn_exclusive'] || producerSettings['exclusive'];
            if (exclusiveUserData && Object.keys(exclusiveUserData).length > 0) userLic = exclusiveUserData;
        } else if (key === 'trackout') {
            if (Object.keys(userLic).length === 0) {
                userLic = producerSettings['offszn_stems'] || producerSettings['stems'] || {};
            }
        }

        const factLic = FACTORY_DEFAULTS[key];

        // --- 3. Resolve Price ---
        let price = factLic.price;
        if (prodLic.price !== undefined && prodLic.price !== null) {
            price = parseFloat(prodLic.price);
        } else if (product[colMap[key]] !== undefined && product[colMap[key]] !== null && parseFloat(product[colMap[key]]) > 0) {
            price = parseFloat(product[colMap[key]]);
        } else if (userLic.price !== undefined && userLic.price !== null) {
            price = parseFloat(userLic.price);
        }

        // --- 4. Resolve Enabled ---
        let enabled = factLic.enabled;
        if (prodLic.enabled !== undefined) {
            enabled = prodLic.enabled;
        } else if (product[colMap[key]] !== undefined && product[colMap[key]] !== null) {
            enabled = parseFloat(product[colMap[key]]) > 0;
        } else if (userLic.enabled !== undefined) {
            enabled = userLic.enabled;
        }

        return {
            id: key,
            name: prodLic.name || userLic.name || factLic.name,
            price: price,
            enabled: enabled
        };
    }).filter(l => l.enabled);
}
// --- End of Utilities ---

document.addEventListener('DOMContentLoaded', () => {
    initSearchPage();
});

async function initSearchPage() {
    // Show skeletons immediately
    showResultsSkeletons(15);
    showRecommendationSkeletons(4);

    // 1. Get Query from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentQuery = urlParams.get('q') || '';

    // 2. Set Initial Sidebar State from URL if any
    parseUrlFilters(urlParams);

    // 3. Setup Filter Listeners (Initializes visuals immediately)
    setupFilterListeners();

    // 4. Perform Initial Search (Async)
    await performSearch();
}

async function fetchProducts(signal) {
    try {
        if (!window.supabaseClient) {
            console.error("Supabase client not initialized");
            return [];
        }

        const query = window.supabaseClient
            .from('products')
            .select('*')
            .neq('status', 'deleted')
            .eq('visibility', 'public');

        if (signal) query.abortSignal(signal);

        const { data: products, error } = await query;

        if (error) {
            if (error.name === 'AbortError') return [];
            throw error;
        }
        return products || [];
    } catch (err) {
        if (err.name === 'AbortError') return [];
        console.error("Error fetching products:", err);
        return [];
    }
}

async function fetchProducers(signal) {
    try {
        if (!window.supabaseClient) {
            console.error("Supabase client not initialized");
            return [];
        }
        // Fetch users who are producers
        const query = window.supabaseClient
            .from('users')
            .select('id, nickname, avatar_url, is_verified, is_producer, bio, r2_version, license_settings')
            .eq('is_producer', true);

        if (signal) query.abortSignal(signal);

        const { data, error } = await query;

        if (error) {
            if (error.name === 'AbortError') return [];
            throw error;
        }
        return data || [];
    } catch (err) {
        if (err.name === 'AbortError') return [];
        console.error("Error fetching producers:", err);
        return [];
    }
}

async function performSearch() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = (urlParams.get('q') || '').toLowerCase().trim();
    const category = urlParams.get('cat') || 'Todo';

    // 1. Cancel previous search if still running
    if (searchAbortController) {
        searchAbortController.abort();
    }
    searchAbortController = new AbortController();
    const { signal } = searchAbortController;

    try {
        const [fetchedProducts, fetchedProducers] = await Promise.all([
            fetchProducts(signal),
            fetchProducers(signal)
        ]);

        if (signal.aborted) return;

        // Enrich products with producer data for easier rendering
        allProducts = fetchedProducts.map(p => {
            const producer = fetchedProducers.find(pr => pr.id === p.producer_id || pr.id === p.user_id);
            const nameFallback = producer?.nickname || p.producer_nickname || 'OFFSZN';
            const licenses = resolveProductLicenses(p, producer);
            return {
                ...p,
                producer_name: nameFallback,
                producer_nickname: nameFallback,
                producer_avatar: producer?.avatar_url,
                producer_is_verified: (producer?.is_verified || p.producer_is_verified) || false,
                _resolvedLicenses: licenses
            };
        });
        allProducers = fetchedProducers;

        // 1. FILTER PRODUCERS
        let matchedProducers = [];
        let exactProducer = null;

        if (query !== '' || category === 'Productores') {
            matchedProducers = allProducers.filter(p => {
                const nick = (p.nickname || '').toLowerCase();
                const normNick = normalizeString(nick);
                const similarity = getSimilarity(nick, query);
                const isMatch = nick.includes(query) || normNick.includes(normalizeString(query)) || similarity > 0.7;

                if (query !== '' && !exactProducer) {
                    const exactSimilarity = getSimilarity(p.nickname, query);
                    if (normNick === normalizeString(query) || exactSimilarity > 0.85) {
                        exactProducer = p;
                    }
                }
                return isMatch;
            });

            if (exactProducer) {
                matchedProducers = matchedProducers.filter(p => p.id !== exactProducer.id);
            }
        }

        // 2. FILTER PRODUCTS
        let matchedProducts = allProducts.map(p => {
            const score = getMatchScore(p, query, normalizeString(query));

            // Use the unified category matcher: check URL param directly or current filters
            let matchesCat = isProductInCategory(p, currentFilters.categories.length > 0 ? currentFilters.categories : category);

            return { ...p, _matchScore: score, _matchesCat: matchesCat };
        })
            .filter(p => p._matchScore > 0 && p._matchesCat);

        applySorting(matchedProducts);

        // De-duplicate
        const seenIds = new Set();
        matchedProducts = matchedProducts.filter(p => {
            if (seenIds.has(p.id)) return false;
            seenIds.add(p.id);
            return true;
        });

        renderResults(matchedProducts, matchedProducers, exactProducer);
        renderRecommendations();

    } catch (err) {
        if (err.name === 'AbortError') {
            console.log("Search request aborted");
        } else {
            console.error("Search failed:", err);
        }
    } finally {
        if (searchAbortController && searchAbortController.signal === signal) {
            searchAbortController = null;
        }
    }
}

function parseUrlFilters(params) {
    if (params.has('cat')) {
        const cat = params.get('cat');
        if (cat && cat !== 'Todo' && cat !== 'Todas') {
            currentFilters.categories = cat.split(',');
        } else {
            currentFilters.categories = [];
        }
    }
    if (params.has('genre')) currentFilters.genres = params.get('genre').split(',');
    if (params.has('free') && params.get('free') === 'true') {
        currentFilters.freeOnly = true;
    }
}

function setupFilterListeners() {
    // Category Checkboxes
    document.querySelectorAll('.category-check').forEach(check => {
        if (currentFilters.categories.includes(check.value)) {
            check.checked = true;
        }

        check.addEventListener('change', (e) => {
            const val = e.target.value;
            if (e.target.checked) {
                if (!currentFilters.categories.includes(val)) {
                    currentFilters.categories.push(val);
                }
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
        const track = bpmMinSlider.parentElement.querySelector('.slider-track');
        const updateBpm = (e) => {
            let min = parseInt(bpmMinSlider.value);
            let max = parseInt(bpmMaxSlider.value);

            if (min > max - 5) {
                if (e && e.target === bpmMinSlider) bpmMinSlider.value = max - 5;
                else bpmMaxSlider.value = min + 5;
                min = parseInt(bpmMinSlider.value);
                max = parseInt(bpmMaxSlider.value);
            }

            if (track) {
                const percent1 = ((min - 40) / (250 - 40)) * 100;
                const percent2 = ((max - 40) / (250 - 40)) * 100;
                track.style.background = `linear-gradient(to right, #1a1a1a ${percent1}%, #fff ${percent1}%, #fff ${percent2}%, #1a1a1a ${percent2}%)`;
            }

            if (e && e.target === bpmMinSlider) bpmMinSlider.style.zIndex = "10";
            if (e && e.target === bpmMaxSlider) bpmMaxSlider.style.zIndex = "10";
            if (e && e.target === bpmMinSlider) bpmMaxSlider.style.zIndex = "1";
            if (e && e.target === bpmMaxSlider) bpmMinSlider.style.zIndex = "1";

            currentFilters.bpmMin = min;
            currentFilters.bpmMax = max;
            if (bpmDisplay) bpmDisplay.textContent = `${min} - ${max}`;

            // Mark as dragging to lock skeletons and prevent render until stop
            currentFilters.isDraggingSlider = true;
            applyFilters();
        };

        const stopBpmDrag = () => {
            currentFilters.isDraggingSlider = false;
            applyFilters();
        };

        bpmMinSlider.addEventListener('input', (e) => updateBpm(e));
        bpmMaxSlider.addEventListener('input', (e) => updateBpm(e));
        bpmMinSlider.addEventListener('change', stopBpmDrag);
        bpmMaxSlider.addEventListener('change', stopBpmDrag);
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

    // Price Slider & Display Logic
    const priceSlider = document.getElementById('price-max-slider');
    const priceDisplay = document.getElementById('price-display');

    const updatePriceDisplay = (val) => {
        if (!priceDisplay) return;
        const formatted = window.CurrencyManager?.format(val) || `$${val}`;
        priceDisplay.textContent = (val >= 1000) ? 'Cualquiera' : formatted;
    };

    if (priceSlider) {
        priceSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            currentFilters.priceMax = val >= 1000 ? 1000000 : val;
            updatePriceDisplay(val);
            currentFilters.isDraggingSlider = true;
            applyFilters();
        });

        priceSlider.addEventListener('change', () => {
            currentFilters.isDraggingSlider = false;
            applyFilters();
        });
        updatePriceDisplay(parseFloat(priceSlider.value));
    }

    // Gratis Filter Checkbox
    const freeCheck = document.getElementById('free-filter-check');
    if (freeCheck) {
        if (currentFilters.freeOnly) {
            freeCheck.checked = true;
            if (priceSlider) priceSlider.disabled = true;
            if (priceDisplay) priceDisplay.textContent = 'Gratis';
        }

        freeCheck.addEventListener('change', (e) => {
            currentFilters.freeOnly = e.target.checked;
            if (priceSlider) priceSlider.disabled = currentFilters.freeOnly;
            if (currentFilters.freeOnly) {
                if (priceDisplay) priceDisplay.textContent = 'Gratis';
            } else {
                if (priceSlider) updatePriceDisplay(parseFloat(priceSlider.value));
            }
            applyFilters();
        });
    }

    // Manual Price Input on Double Click
    if (priceDisplay) {
        priceDisplay.style.cursor = 'pointer';
        priceDisplay.title = 'Doble clic para editar presupuesto';
        priceDisplay.addEventListener('dblclick', () => {
            const currentVal = (currentFilters.priceMax === 1000000 || currentFilters.priceMax >= 1000)
                ? "1000.00"
                : currentFilters.priceMax.toFixed(2);

            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentVal;
            Object.assign(input.style, {
                width: '65px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', borderRadius: '4px', fontSize: '0.85rem', padding: '2px 6px', textAlign: 'right', outline: 'none'
            });

            priceDisplay.innerHTML = '';
            priceDisplay.appendChild(input);
            input.focus();
            input.select();

            let isFinishing = false;
            const finishEditing = () => {
                if (isFinishing) return;
                isFinishing = true;

                // Security: Sanitize input value
                let cleanVal = input.value.replace(/[^\d.]/g, ''); // Remove anything not digit or dot
                let val = parseFloat(cleanVal);

                if (isNaN(val) || val < 0) val = 1000000; // Default to 'any' if invalid
                if (val > 1000000) val = 1000000; // Cap at 1M

                currentFilters.priceMax = (val >= 1000) ? 1000000 : val;
                if (priceSlider) priceSlider.value = Math.min(val, 1000);
                updatePriceDisplay(val >= 1000 ? 1000 : val);

                // Ensure skeletons show for manual change too
                applyFilters();
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') input.blur();
                if (e.key === 'Escape') { input.value = currentVal; input.blur(); }
            });
            input.addEventListener('blur', finishEditing);
        });
    }

    initKeyFilters();

    // Clear Filters
    const clearBtn = document.getElementById('clear-filters-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            currentFilters = { categories: [], genres: [], priceMax: 1000, bpmMin: 40, bpmMax: 250, doubleTempo: false, freeOnly: false, keys: [] };
            currentQuery = ''; // ALSO RESET QUERY
            const searchBox = document.getElementById('navbarSearchInput');
            if (searchBox) searchBox.value = '';

            document.querySelectorAll('.category-check, .key-check').forEach(c => c.checked = false);
            const freeFilter = document.getElementById('free-filter-check');
            if (freeFilter) freeFilter.checked = false;

            if (priceSlider) { priceSlider.value = 1000; priceSlider.disabled = false; }
            if (bpmMinSlider) bpmMinSlider.value = 40;
            if (bpmMaxSlider) bpmMaxSlider.value = 250;
            if (bpmDisplay) bpmDisplay.textContent = '40 - 250';
            if (priceDisplay) priceDisplay.textContent = 'Cualquiera';
            if (doubleTempoCheck) doubleTempoCheck.checked = false;
            applyFilters();
        });
    }

    const searchInp = document.getElementById('navbarSearchInput');
    if (searchInp) {
        searchInp.value = currentQuery;

        // Add live sync for the search input on this page
        searchInp.addEventListener('input', (e) => {
            currentQuery = e.target.value.trim();
            applyFilters();
        });
    }
    initMobileFilters();
}

/**
 * Mobile Filter Modal Logic
 */
window.openMobileFilters = function () {
    const modal = document.getElementById('offszn-mobile-filters');
    if (modal) {
        modal.classList.add('modal-active');
        document.body.classList.add('modal-open');
        syncFilterUI();
    }
};

window.closeMobileFilters = function () {
    const modal = document.getElementById('offszn-mobile-filters');
    if (modal) {
        modal.classList.remove('modal-active');
        document.body.classList.remove('modal-open');
    }
};

function initMobileFilters() {
    // 1. Sort
    document.querySelectorAll('input[name="m-sort"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentFilters.sortBy = e.target.value;
            syncFilterUI('modal');
            applyFilters();
        });
    });

    // 2. File Type
    document.querySelectorAll('.m-file-check').forEach(check => {
        check.addEventListener('change', (e) => {
            const val = e.target.value;
            if (e.target.checked) {
                if (!currentFilters.fileTypes.includes(val)) currentFilters.fileTypes.push(val);
            } else {
                currentFilters.fileTypes = currentFilters.fileTypes.filter(f => f !== val);
            }
            syncFilterUI('modal');
            applyFilters();
        });
    });

    // 3. Category
    document.querySelectorAll('.m-cat-check').forEach(check => {
        check.addEventListener('change', (e) => {
            const val = e.target.value;
            if (e.target.checked) {
                if (!currentFilters.categories.includes(val)) currentFilters.categories.push(val);
            } else {
                currentFilters.categories = currentFilters.categories.filter(c => c !== val);
            }
            syncFilterUI('modal');
            applyFilters();
        });
    });

    // 4. BPM Slider
    const bpmSlider = document.getElementById('m-bpm-slider');
    if (bpmSlider) {
        bpmSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            currentFilters.bpmMin = 40;
            currentFilters.bpmMax = val;
            const dispMax = document.getElementById('m-bpm-val-max');
            if (dispMax) dispMax.textContent = val;
        });
        bpmSlider.addEventListener('change', () => {
            syncFilterUI('modal');
            applyFilters();
        });
    }

    const bpmDouble = document.getElementById('m-bpm-double');
    if (bpmDouble) {
        bpmDouble.addEventListener('change', (e) => {
            currentFilters.doubleTempo = e.target.checked;
            applyFilters();
        });
    }

    // 5. Scale
    document.querySelectorAll('input[name="m-scale"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentFilters.scale = e.target.value;
            syncFilterUI('modal');
            applyFilters();
        });
    });

    // 6. Key Grid
    document.querySelectorAll('.m-key-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.textContent.trim();
            document.querySelectorAll('.m-key-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.keys = [key];
            syncFilterUI('modal');
            applyFilters();
        });
    });

    // 7. Licenses
    document.querySelectorAll('.m-lic-check').forEach(check => {
        check.addEventListener('change', (e) => {
            const val = e.target.value;
            if (e.target.checked) {
                if (!currentFilters.licenses.includes(val)) currentFilters.licenses.push(val);
            } else {
                currentFilters.licenses = currentFilters.licenses.filter(l => l !== val);
            }
            syncFilterUI('modal');
            applyFilters();
        });
    });
}

function syncFilterUI(source = 'all') {
    if (source !== 'sidebar') {
        document.querySelectorAll('.category-check').forEach(c => {
            c.checked = currentFilters.categories.includes(c.value);
        });
        const minS = document.getElementById('bpm-min-slider');
        const maxS = document.getElementById('bpm-max-slider');
        if (minS) minS.value = currentFilters.bpmMin;
        if (maxS) maxS.value = currentFilters.bpmMax;
        const freeS = document.getElementById('free-filter-check');
        if (freeS) freeS.checked = currentFilters.freeOnly;
        const bpmDisp = document.getElementById('bpm-range-display');
        if (bpmDisp) bpmDisp.textContent = `${currentFilters.bpmMin} - ${currentFilters.bpmMax}`;
    }
    if (source !== 'modal') {
        const mSort = document.querySelector(`input[name="m-sort"][value="${currentFilters.sortBy}"]`);
        if (mSort) mSort.checked = true;

        document.querySelectorAll('.m-file-check').forEach(c => {
            c.checked = currentFilters.fileTypes.includes(c.value);
        });

        document.querySelectorAll('.m-cat-check').forEach(c => {
            c.checked = currentFilters.categories.includes(c.value);
        });

        const mBpmSlider = document.getElementById('m-bpm-slider');
        if (mBpmSlider) mBpmSlider.value = currentFilters.bpmMax;
        const mBpmDispMax = document.getElementById('m-bpm-val-max');
        if (mBpmDispMax) mBpmDispMax.textContent = currentFilters.bpmMax;

        const mScale = document.querySelector(`input[name="m-scale"][value="${currentFilters.scale}"]`);
        if (mScale) mScale.checked = true;

        // Key Grid Sync
        document.querySelectorAll('.m-key-btn').forEach(btn => {
            const key = btn.textContent.trim();
            if (currentFilters.keys.includes(key)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const mLicChecks = document.querySelectorAll('.m-lic-check');
        mLicChecks.forEach(c => {
            c.checked = currentFilters.licenses.includes(c.value);
        });
    }
}

window.clearMobileFilters = function () {
    currentFilters.categories = [];
    currentFilters.genres = [];
    currentFilters.bpmMin = 40;
    currentFilters.bpmMax = 250;
    currentFilters.freeOnly = false;
    currentFilters.keys = [];
    currentFilters.priceMax = 1000;
    syncFilterUI();
    applyFilters();
    window.closeMobileFilters();
};

function applyFilters() {
    if (allProducts.length === 0) return;

    // Always clear the timeout first
    if (renderTimeout) clearTimeout(renderTimeout);

    const container = document.getElementById('search-results-container');

    // 1. Show skeletons IMMEDIATELY for instant feedback
    showResultsSkeletons(8);

    // 2. Clear previous timeout to avoid multiple renders
    if (renderTimeout) clearTimeout(renderTimeout);

    renderTimeout = setTimeout(() => {
        try {
            if (container) {
                container.classList.remove('is-searching');
                container.style.opacity = '1';
            }

        let results = [...allProducts];

        // 1. Text Search
        if (currentQuery) {
            const q = currentQuery.toLowerCase().trim();
            const normQ = normalizeString(q);
            results = results.map(p => ({ ...p, _matchScore: getMatchScore(p, q, normQ) }))
                .filter(p => p._matchScore > 0);
        } else {
            results = results.map(p => ({ ...p, _matchScore: 100 }));
        }

        // 2. Category Filter
        if (currentFilters.categories.length > 0 && !currentFilters.categories.includes('Todo')) {
            results = results.filter(p => isProductInCategory(p, currentFilters.categories));
        }

        // 3. BPM Filter
        if (currentFilters.bpmMin !== null || currentFilters.bpmMax !== null) {
            results = results.filter(p => {
                if (!p.bpm) return true;
                const b = parseInt(p.bpm);
                const min = currentFilters.bpmMin || 0;
                const max = currentFilters.bpmMax || 999;
                const matchNormal = b >= min && b <= max;
                if (currentFilters.doubleTempo) {
                    return matchNormal || (b >= min * 2 && b <= max * 2) || (b >= min / 2 && b <= max / 2);
                }
                return matchNormal;
            });
        }

        // 4. Price Filter
        if (currentFilters.priceMax !== null || currentFilters.freeOnly) {
            results = results.filter(p => {
                const licenses = p._resolvedLicenses || [];
                if (currentFilters.freeOnly) return licenses.some(l => l.price === 0);
                const max = currentFilters.priceMax;
                return licenses.some(l => l.price <= max);
            });
        }

        // 5. Key Filter
        if (currentFilters.keys && currentFilters.keys.length > 0) {
            const normalizedTargetKeys = currentFilters.keys.map(k => normalizeKey(k));
            results = results.filter(p => {
                const pKey = normalizeKey(p.key || p.key_scale || '');
                return pKey && normalizedTargetKeys.includes(pKey);
            });
        }

        // 6. File Type Filter
        if (currentFilters.fileTypes && currentFilters.fileTypes.length > 0) {
            results = results.filter(p => {
                const tagsStr = (p.tags || '').toLowerCase();
                return currentFilters.fileTypes.some(t => tagsStr.includes(t.toLowerCase()));
            });
        }

        // 7. Scale Filter (Major/Minor)
        if (currentFilters.scale) {
            results = results.filter(p => {
                const pScale = (p.key_scale || p.key_name || '').toLowerCase();
                if (currentFilters.scale === 'minor') return pScale.includes('minor') || pScale.includes('menor');
                if (currentFilters.scale === 'major') return pScale.includes('major') || pScale.includes('mayor');
                return true;
            });
        }

        // 8. License Filter
        if (currentFilters.licenses && currentFilters.licenses.length > 0) {
            results = results.filter(p => {
                const lNames = (p._resolvedLicenses || []).map(l => (l.name || '').toLowerCase());
                return currentFilters.licenses.some(targetL => lNames.some(name => name.includes(targetL.toLowerCase())));
            });
        }

        applySorting(results);
        filteredResults = results;

        const query = (currentQuery || '').toLowerCase().trim();
        const normQuery = normalizeString(query);
        let matchedProducers = allProducers.filter(p => {
            const nick = (p.nickname || '').toLowerCase();
            return nick.includes(query) || normalizeString(nick).includes(normQuery) || getSimilarity(nick, query) > 0.7;
        });

        let exactProducer = matchedProducers.find(p => (p.nickname || '').toLowerCase() === query || getSimilarity(p.nickname, query) > 0.85);
        if (exactProducer) matchedProducers = matchedProducers.filter(p => p.id !== exactProducer.id);

        renderResults(filteredResults, matchedProducers, exactProducer);
        renderRecommendations();
        } catch (err) {
            console.error("Filter error:", err);
            // Ensure skeletons are removed on error
            renderResults([], [], null);
        }
    }, 250);
}

function renderRecommendations() {
    const container = document.getElementById('recommendations-container');
    if (!container) return;

    const isMobile = window.innerWidth <= 768;
    const count = isMobile ? 8 : 4; // More for horizontal scroll on mobile

    // Logic: Pick random products NOT in the filtered results
    const filteredIds = new Set(filteredResults.map(p => p.id));
    const pool = allProducts.filter(p => !filteredIds.has(p.id));

    // Shuffle and pick
    const shuffled = pool.sort(() => 0.5 - Math.random());
    const recommendations = shuffled.slice(0, count);

    if (recommendations.length === 0) {
        const section = container.closest('.recommendation-section');
        if (section) section.style.display = 'none';
        return;
    }

    container.innerHTML = recommendations.map(p => {
        const rawImg = p.image_url || '/images/portada-default.png';
        const storageVer = p.storage_version || p.r2_version || 'v2';
        const productUrl = getProductUrl(p);
        const name = p.name || 'Sin título';
        const producer = p.producer_name || 'OFFSZN';

        // Use R2 signing system
        const imgAttr = `src="${imgPlaceholder}" data-r2-src="${escapeHTML(rawImg)}" data-r2-version="${storageVer}"`;

        if (isMobile) {
            // PREMIUM SMART CARD FOR MOBILE (Matches Explore Page)
            const isLiked = window.FavoritesManager?.isLiked(p.id);

            return `
                <div class="product-card-smart" data-product-url="${productUrl}" data-product-id="${p.id}">
                    <div class="card-cover-wrapper">
                        <img ${imgAttr} alt="${escapeHTML(name)}">
                        <button class="quick-play-btn" data-play-id="${p.id}">
                            <i class="bi bi-play-fill"></i>
                        </button>
                        <div class="card-like-btn ${isLiked ? 'liked' : ''}" data-like-id="${p.id}">
                            <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i>
                        </div>
                    </div>
                    <div class="card-info">
                        <div class="card-title">${escapeHTML(name)}</div>
                        <div class="card-producer">${escapeHTML(producer)}</div>
                    </div>
                </div>
            `;
        } else {
            // Standard Card for Desktop
            return `
                <div class="recommendation-card" onclick="window.location.href='${productUrl}'">
                    <div class="recommendation-card-img-wrapper">
                        <img ${imgAttr} alt="${escapeHTML(name)}">
                    </div>
                    <div class="recommendation-card-title">${escapeHTML(name)}</div>
                    <div class="recommendation-card-producer">${escapeHTML(producer)}</div>
                </div>
            `;
        }
    }).join('');

    signAllR2Images(container);

    // Attach delegated event listeners for mobile cards (animation-first UX)
    if (isMobile) {
        container.querySelectorAll('.product-card-smart').forEach(card => {
            const productUrl = card.dataset.productUrl;
            const productId = card.dataset.productId;

            // Card click → navigate
            card.addEventListener('click', (e) => {
                // Only navigate if clicked on the card itself, not on buttons
                if (!e.target.closest('.quick-play-btn') && !e.target.closest('.card-like-btn')) {
                    window.location.href = productUrl;
                }
            });

            // Play button
            const playBtn = card.querySelector('.quick-play-btn');
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.handleTrackPlay(e, productId);
                });
            }

            // Like button — ANIMATION FIRST, then logic
            const likeBtn = card.querySelector('.card-like-btn');
            if (likeBtn) {
                likeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    const icon = likeBtn.querySelector('i');
                    const wasLiked = likeBtn.classList.contains('liked');

                    // 1. INSTANT VISUAL FEEDBACK (animation-first)
                    if (wasLiked) {
                        likeBtn.classList.remove('liked');
                        icon.classList.remove('bi-heart-fill');
                        icon.classList.add('bi-heart');
                        icon.style.color = '';
                    } else {
                        likeBtn.classList.add('liked');
                        icon.classList.remove('bi-heart');
                        icon.classList.add('bi-heart-fill');
                        icon.style.color = '#ef4444';
                        // Mini scale animation
                        likeBtn.style.transform = 'scale(1.25)';
                        setTimeout(() => { likeBtn.style.transform = ''; }, 200);
                    }

                    // 2. THEN fire the API logic (pass icon for potential correction/sync)
                    window.FavoritesManager?.toggleLike(productId, icon);
                });
            }
        });
    }
}

function renderResults(products, producers, exactProducer) {
    const container = document.getElementById('search-results-container');
    const countEl = document.getElementById('results-count-val');
    const isMobile = window.innerWidth <= 768;

    if (!container) return;

    const totalCount = products.length + producers.length + (exactProducer ? 1 : 0);
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
        html += products.map(p => isMobile ? renderTrackRowMobile(p) : renderTrackRow(p)).join('');
    }

    // C. REMAINING PRODUCERS
    const otherProducers = producers ? producers.filter(p => !exactProducer || p.id !== exactProducer.id) : [];
    if (otherProducers.length > 0) {
        html += `<div class="search-section-title">Productores</div>`;
        html += otherProducers.map(p => renderProducerRow(p)).join('');
    }

    if (totalCount === 0) {
        container.innerHTML = '<div style="padding:40px; text-align:center; color:#666;">No se encontraron resultados para tu búsqueda.</div>';
        return;
    }

    container.innerHTML = html;

    // Trigger r2-loader if exists
    if (window.R2Loader && typeof window.R2Loader.init === 'function') {
        window.R2Loader.init();
    }
}

// signAllR2Images is now handled globally by r2-loader.js MutationObserver
// This function is kept as a no-op for backward compatibility (called from renderNoResultsFallback)
async function signAllR2Images(parent) {
    // r2-loader.js handles this automatically via MutationObserver
    return;
}

//** Modular Mobile Renderer (V2) - Strictly uses classes from HTML head style block */
function renderTrackRowMobile(p) {
    const imgUrl = p.image_url || '/images/portada-default.png';
    const title = p.name || 'Untitled';
    const type = (p.product_type || 'Beat').toUpperCase();
    const producerNick = p.producer_nickname || p.producer_name || 'OFFSZN';
    const productUrl = getProductUrl(p);

    const licenses = p._resolvedLicenses || [];
    const lowestPrice = licenses.length > 0 ? Math.min(...licenses.map(l => l.price)) : (parseFloat(p.price_basic) || 0);
    const displayPrice = lowestPrice > 0
        ? (window.CurrencyManager?.format(lowestPrice) || `$${lowestPrice}`)
        : 'GRATIS';
    const storageVer = p.storage_version || p.r2_version || 'v2';
    const imgPlaceholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const imgAttr = `src="${imgPlaceholder}" data-r2-src="${escapeHTML(imgUrl)}"`;

    const isLiked = window.FavoritesManager?.isLiked(p.id) || false;
    const isPlaying = window.StickyPlayer?.currentTrack?.id === p.id && !window.StickyPlayer?.paused;
    const likeHandler = `window.handleLike(event, '${p.id}', this)`;

    const tags = [];
    if (p.bpm) tags.push(`${p.bpm} BPM`);
    tags.push(type);
    if (p.key_name || p.key) tags.push(p.key_name || p.key);

    return `
        <div class="offszn-m-track-v2" data-product-id="${p.id}" onclick="window.location.href='/product.html?id=${p.id}'">
            <div class="m-v2-main-row">
                <div class="m-v2-thumb" onclick="event.stopPropagation(); window.handleTrackPlay(event, '${p.id}')">
                    <img ${imgAttr} data-r2-version="${storageVer}" data-product-id="${p.id}" alt="${escapeHTML(title)}">
                    <div class="m-v2-play-overlay">
                        <i class="bi ${isPlaying ? 'bi-pause-fill' : 'bi-play-fill'}"></i>
                    </div>
                </div>
                <div class="m-v2-info">
                    <span class="m-v2-title">${escapeHTML(title)}</span>
                    <span class="m-v2-producer" onclick="event.stopPropagation(); window.location.href='/@${encodeURIComponent(p.producer_nickname || 'producer')}'">${escapeHTML(producerNick)}</span>
                    <div class="m-v2-meta-row">
                        ${tags.map(t => `<span class="m-v2-tag">${escapeHTML(t)}</span>`).join('')}
                    </div>
                </div>
                <div class="m-v2-actions">
                    <button class="m-v2-action-heart" 
                            onclick="event.stopPropagation(); window.handleLike(event, '${p.id}', this)">
                        <i class="bi ${isLiked ? 'bi-heart-fill liked' : 'bi-heart'}"></i>
                    </button>
                    <div class="m-v2-price-btn ${displayPrice === 'GRATIS' ? 'free' : ''}" 
                         onclick="event.stopPropagation(); window.location.href='/product.html?id=${p.id}'">
                        ${displayPrice === 'GRATIS' ? '<i class="bi bi-download"></i>' : escapeHTML(displayPrice)}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderTrackRow(p) {
    // Detect mobile and use a completely separate renderer with unique class names
    if (window.innerWidth <= 768) {
        return renderTrackRowMobile(p);
    }

    const imgUrl = p.image_url || '/images/portada-default.png';
    const type = (p.product_type || 'Beat').toUpperCase();
    const producer = p.producer_name || 'OFFSZN';
    const productUrl = getProductUrl(p);

    // Resolve display price from licenses or fallback to price_basic
    const licenses = p._resolvedLicenses || [];
    const lowestPrice = licenses.length > 0 ? Math.min(...licenses.map(l => l.price)) : (parseFloat(p.price_basic) || 0);
    const displayPrice = lowestPrice > 0
        ? (window.CurrencyManager?.format(lowestPrice) || `$${lowestPrice}`)
        : 'GRATIS';
    const storageVer = p.storage_version || p.r2_version || 'v2';
    const isLiked = window.FavoritesManager?.isLiked(p.id) || false;
    const isActuallyR2 = window.AuthUtils && window.AuthUtils.isR2Url(imgUrl) && storageVer !== 'supabase';
    const imgPlaceholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    // Always use data-r2-src so r2-loader.js can sign it (works for supabase too if version is correct)
    const imgAttr = `src="${imgPlaceholder}" data-r2-src="${escapeHTML(imgUrl)}"`;

    return `
        <div class="track-row" data-product-id="${p.id}">
            <div class="track-left">
                <div class="thumb-container" onclick="window.location.href='${productUrl}'">
                    <img ${imgAttr} data-r2-version="${storageVer}" data-product-id="${p.id}" class="track-thumb" alt="cover">
                    <div class="thumb-play-overlay" onclick="window.handleTrackPlay(event, '${p.id}')">
                        <i class="bi bi-play-fill"></i>
                    </div>
                </div>
                <div class="track-info">
                    <div class="track-title" onclick="window.location.href='${productUrl}'">${escapeHTML(p.name)}</div>
                    <div class="track-meta">
                        <span class="producer-name" onclick="event.stopPropagation(); window.location.href='/@${encodeURIComponent(p.producer_nickname || 'producer')}'">${escapeHTML(producer)}</span>
                        <span class="meta-separator">•</span>
                        <span class="product-type">${escapeHTML(type)}</span>
                        
                        <div class="track-stats-inline">
                            ${(() => {
            const pTypeLower = (p.product_type || '').toLowerCase();
            if (pTypeLower === 'loopkit' || pTypeLower === 'drumkit') {
                return `<div class="stat-pill-v2">${p.sounds_count || 0} sonidos</div>`;
            } else if (pTypeLower === 'preset') {
                return `<div class="stat-pill-v2">${escapeHTML(p.category || 'Preset')}</div>`;
            } else {
                return `
                                        <div class="stat-pill-v2">${p.bpm || '--'}</div>
                                        <span class="meta-separator-v2">|</span>
                                        <div class="stat-pill-v2">${p.key || p.key_scale || '--'}</div>
                                    `;
            }
        })()}
                        </div>
                    </div>
                </div>
            </div>

            <div class="track-actions-right">
                <div class="track-actions">
                    <i class="bi bi-stars action-icon" onclick="event.stopPropagation();" title="Generar"></i>
                    <i class="bi ${isLiked ? 'bi-heart-fill liked' : 'bi-heart'} action-icon" onclick="event.stopPropagation(); window.FavoritesManager?.toggleLike('${p.id}', this, ${JSON.stringify(p).replace(/"/g, '&quot;')})" title="Like"></i>
                    <i class="bi bi-download action-icon" onclick="event.stopPropagation(); window.location.href='${productUrl}'" title="Download"></i>
                    <i class="bi bi-share action-icon" onclick="event.stopPropagation(); window.openShareModal?.(${JSON.stringify(p).replace(/"/g, '&quot;')})" title="Share"></i>
                </div>
                <button class="track-price-btn" onclick="event.stopPropagation(); window.location.href='${productUrl}'">
                    ${displayPrice}
                </button>
            </div>
        </div>
    `;
}


function renderExactProducerCard(p) {
    const isMobile = window.innerWidth <= 768;
    const imgUrl = p.avatar_url || '/images/default-avatar.png';
    const producer = p.nickname || p.name || 'Productor';
    const profileUrl = `/@${encodeURIComponent(producer)}`;

    if (isMobile) {
        injectModularSearchStyles();
        return `
            <div class="offszn-m-track-v2" data-product-id="${p.id}">
                <div class="m-v2-main-row" style="grid-template-columns: 52px 1fr 105px;">
                    <div class="m-v2-thumb" onclick="window.location.href='${profileUrl}'">
                        <img src="${imgUrl}" alt="avatar">
                    </div>
                    <div class="m-v2-info" onclick="window.location.href='${profileUrl}'">
                        <div class="m-v2-title">${escapeHTML(producer)}</div>
                        <div class="m-v2-producer">Ver Perfil Oficial</div>
                    </div>
                    <div class="m-v2-actions">
                        <div class="m-v2-action-circle" style="width: 100%; border-radius: 8px; background: #fff; color: #000; font-weight: 700; font-size: 0.8rem; padding: 0 12px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer;" onclick="window.location.href='${profileUrl}'">
                            VER PERFIL
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    const defaultAvatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(producer) + '&background=random';
    const avatar = p.avatar_url || defaultAvatarUrl;
    const isR2 = window.AuthUtils && window.AuthUtils.isR2Url(avatar);
    const imgPlaceholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const imgAttr = isR2 ? `src="${imgPlaceholder}" data-r2-src="${escapeHTML(avatar)}"` : `src="${escapeHTML(avatar)}"`;

    return `
        <div class="exact-match-card" onclick="window.location.href='${profileUrl}'" style="cursor:pointer; background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; display: flex; align-items: center; gap: 20px; transition: all 0.3s ease; margin-bottom: 30px;">
            <div style="position: relative;">
                <img ${imgAttr} data-r2-version="${p.r2_version || 'v2'}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #fff;">
                ${p.is_verified ? '<i class="bi bi-patch-check-fill" style="position: absolute; bottom: 0; right: 0; color: #fff; font-size: 1.2rem; background: #000; border-radius: 50%;"></i>' : ''}
            </div>
            <div style="flex: 1;">
                <div style="font-size: 0.7rem; color: #fff; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px; opacity: 0.5;">Productor Destacado</div>
                <div style="font-size: 1.5rem; color: #fff; font-weight: 800; margin-bottom: 4px;">${escapeHTML(producer)}</div>
                <div style="font-size: 0.9rem; color: #888; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">${escapeHTML(p.bio || 'Sin biografía disponible.')}</div>
            </div>
            <div class="view-profile-btn" style="padding: 10px 20px; background: #fff; color: #000; border-radius: 8px; font-weight: 700; font-size: 0.85rem;">Ver Perfil</div>
        </div>
    `;
}

function renderProducerRow(p) {
    const producer = p.nickname || p.name || 'Productor';
    const profileUrl = `/@${encodeURIComponent(producer)}`;
    const avatar = p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(producer)}`;

    return `
        <div class="producer-row" onclick="window.location.href='${profileUrl}'" style="cursor:pointer; display: flex; align-items: center; gap: 16px; padding: 12px; border-radius: 12px; transition: background 0.2s; margin-bottom: 8px;">
            <img src="${avatar}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; background: #1a1a1a;">
            <div style="flex: 1;">
                <div style="color: #fff; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                    ${escapeHTML(producer)}
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
    if (e) e.stopPropagation();

    // Check if we have a direct reference or need to find it
    const product = allProducts.find(p => String(p.id) === String(id));
    if (!product) {
        console.error('[OFFSZN] Track not found in allProducts pool:', id);
        return;
    }

    // Format for StickyPlayer
    const audioUrl = getProductAudio(product);
    const pName = product.producer_name || product.producer_nickname || 'OFFSZN';

    const trackData = {
        ...product,
        audio_url: audioUrl,
        artist_users: {
            nickname: pName,
            id: product.producer_id,
            avatar_url: product.producer_avatar || null,
            is_verified: product.producer_is_verified || false
        }
    };

    if (window.StickyPlayer && typeof window.StickyPlayer.play === 'function') {
        if (window.StickyPlayer.updatePlaylist && filteredResults.length > 0) {
            const formattedPlaylist = filteredResults.map(p => {
                const aUrl = getProductAudio(p);
                const pNick = p.producer_name || p.producer_nickname || 'OFFSZN';
                return {
                    ...p,
                    audio_url: aUrl,
                    artist_users: {
                        nickname: pNick,
                        id: p.producer_id,
                        avatar_url: p.producer_avatar || null,
                        is_verified: p.producer_is_verified || false
                    }
                };
            });
            window.StickyPlayer.updatePlaylist(formattedPlaylist, 'Resultados de Búsqueda');
        }

        window.StickyPlayer.play(trackData);

        // Visual toggle for all V2 overlays
        document.querySelectorAll('.m-v2-play-overlay i').forEach(i => {
            i.className = 'bi bi-play-fill';
        });

        // Toggle current one if playing
        const row = document.querySelector(`.offszn-m-track-v2[data-product-id="${id}"]`);
        if (row) {
            const icon = row.querySelector('.m-v2-play-overlay i');
            const isNowPlaying = window.StickyPlayer?.currentTrack?.id === id && !window.StickyPlayer?.paused;
            if (icon) icon.className = isNowPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
        }
    }
};

window.handleAddToCart = (e, id) => {
    e.stopPropagation();
    if (window.CartManager && typeof window.CartManager.addItem === 'function') {
        window.CartManager.addItem(id);
    }
};

window.handleLike = (e, id, el) => {
    e.stopPropagation();
    // el is the button, we need the icon inside it
    const icon = el.querySelector('i') || el;
    if (window.FavoritesManager && typeof window.FavoritesManager.toggleLike === 'function') {
        window.FavoritesManager.toggleLike(id, icon);
    }
};

window.handleDownloadRedirect = (e, url) => {
    e.stopPropagation();
    window.location.href = url;
};

window.handleShare = (e, id) => {
    e.stopPropagation();
    // Find product in local cache - use loose equality for ID matching
    const prod = filteredResults.find(p => String(p.id) === String(id)) ||
        allProducts.find(p => String(p.id) === String(id));

    if (prod && window.openShareModal) {
        window.openShareModal(prod);
    } else if (window.ShareManager && typeof window.ShareManager.open === 'function') {
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
    const imgUrl = p.image_url || '/images/portada-default.png';
    const storageVer = p.storage_version || p.r2_version || 'v2';
    const isR2 = window.AuthUtils && window.AuthUtils.isR2Url(imgUrl) && storageVer !== 'supabase';
    const imgPlaceholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    let imgAttr = '';
    if (isR2) {
        imgAttr = `src="${imgPlaceholder}" data-r2-src="${escapeHTML(imgUrl)}"`;
    } else {
        const finalSrc = window.AuthUtils?.getFormattedSupabaseUrl ? window.AuthUtils.getFormattedSupabaseUrl(imgUrl) : imgUrl;
        imgAttr = `src="${escapeHTML(finalSrc)}"`;
    }

    return `
        <div class="fallback-card" data-product-id="${p.id}" onclick="window.location.href='${productUrl}'">
            <div class="fallback-card-img">
                <img ${imgAttr} data-r2-version="${storageVer}">
                <div class="fallback-card-overlay"><i class="bi bi-play-fill"></i></div>
            </div>
            <div class="fallback-card-info">
                <span class="fallback-card-name">${escapeHTML(p.name)}</span>
                <span class="fallback-card-producer" onclick="event.stopPropagation(); window.location.href='/@${encodeURIComponent(p.producer_nickname || 'producer')}'">${escapeHTML(p.producer_name || 'OFFSZN')}</span>
                <span class="fallback-card-price">${price}</span>
            </div>
        </div>
    `;
}

// Subscription for Realtime Favorite Updates
if (window.FavoritesManager) {
    window.FavoritesManager.subscribe(() => {
        syncLikes();
    });
}

function syncLikes() {
    const rows = document.querySelectorAll('.track-row, .fallback-card, .offszn-m-track-v2');
    rows.forEach(row => {
        const productId = row.getAttribute('data-product-id');
        if (!productId) return;

        const isLiked = window.FavoritesManager?.isLiked?.(String(productId));
        const heart = row.querySelector('.bi-heart, .bi-heart-fill');
        if (heart) {
            // Check if it's the premium mobile layout
            if (row.classList.contains('offszn-m-track-v2')) {
                heart.className = isLiked ? 'bi bi-heart-fill liked' : 'bi bi-heart';
            } else {
                heart.className = isLiked ? 'bi bi-heart-fill liked action-icon' : 'bi bi-heart action-icon';
            }
        }
    });
}

// Subscribe to FavoritesManager updates
if (window.FavoritesManager && typeof window.FavoritesManager.subscribe === 'function') {
    window.FavoritesManager.subscribe(syncLikes);
}

// Initial Sync
window.addEventListener('load', () => {
    setTimeout(syncLikes, 1000);
});

// --- Accordion Helpers ---
window.toggleFilterAccordion = function (header) {
    const group = header.closest('.filter-group');
    const icon = header.querySelector('.accordion-icon');
    const isActive = group.classList.toggle('active');

    if (icon) {
        icon.classList.toggle('bi-chevron-down', !isActive);
        icon.classList.toggle('bi-chevron-up', isActive);
    }
};

window.filterOptions = function (input) {
    const term = input.value.toLowerCase();
    const container = input.closest('.filter-content').querySelector('.filter-options');
    const options = container.querySelectorAll('.premium-checkbox');

    options.forEach(opt => {
        const text = opt.querySelector('.label-text').textContent.toLowerCase();
        opt.style.display = text.includes(term) ? 'flex' : 'none';
    });
};

window.toggleShowMoreKeys = function (btn) {
    const container = document.getElementById('key-options-container');
    const isExpanded = container.classList.toggle('expanded');
    const btnText = btn.querySelector('.btn-text');
    const icon = btn.querySelector('i');

    if (isExpanded) {
        btnText.textContent = 'Mostrar menos';
        icon.classList.replace('bi-plus', 'bi-dash');
    } else {
        btnText.textContent = 'Mostrar más';
        icon.classList.replace('bi-dash', 'bi-plus');
    }
    initKeyFilters();
};

function initKeyFilters() {
    const container = document.getElementById('key-options-container');
    if (!container) return;

    const allKeys = [
        'C', 'Cm', 'C#', 'C#m', 'D', 'Dm', 'D#', 'D#m', 'E', 'Em', 'F', 'Fm',
        'F#', 'F#m', 'G', 'Gm', 'G#', 'G#m', 'A', 'Am', 'A#', 'A#m', 'B', 'Bm'
    ];

    const commonKeys = ['C', 'Cm', 'Am', 'Fm', 'Dm'];
    const isExpanded = container.classList.contains('expanded');
    const shownKeys = isExpanded ? allKeys : commonKeys;

    container.innerHTML = allKeys.map(key => `
        <label class="premium-checkbox" style="display: ${shownKeys.includes(key) ? 'flex' : 'none'}">
            <input type="checkbox" class="key-check" value="${key}" ${currentFilters.keys.includes(key) ? 'checked' : ''}>
            <span class="checkmark"></span>
            <span class="label-text">${key}</span>
        </label>
    `).join('');

    // Re-attach listeners because we re-rendered
    container.querySelectorAll('.key-check').forEach(check => {
        check.addEventListener('change', (e) => {
            const val = e.target.value;
            if (e.target.checked) {
                if (!currentFilters.keys.includes(val)) currentFilters.keys.push(val);
            } else {
                currentFilters.keys = currentFilters.keys.filter(k => k !== val);
            }
            applyFilters();
        });
    });
}

/**
 * Applies sorting to a results array based on currentFilters.sort
 */
function applySorting(results) {
    const sortVal = currentFilters.sort || 'relevance';
    if (sortVal === 'relevance') {
        results.sort((a, b) => (b._matchScore || 0) - (a._matchScore || 0));
    } else if (sortVal === 'newest') {
        results.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortVal === 'price_low') {
        results.sort((a, b) => {
            const pA = getMinPrice(a);
            const pB = getMinPrice(b);
            return pA - pB;
        });
    } else if (sortVal === 'price_high') {
        results.sort((a, b) => {
            const pA = getMinPrice(a);
            const pB = getMinPrice(b);
            return pB - pA;
        });
    }
}

function getMinPrice(product) {
    const licenses = product._resolvedLicenses || [];
    if (licenses.length === 0) return 999999;
    return Math.min(...licenses.map(l => l.price || 0));
}

// Custom Sort Dropdown Listeners
document.addEventListener('DOMContentLoaded', () => {
    const sortTrigger = document.getElementById('sortTrigger');
    const sortContainer = document.getElementById('customSortContainer');
    const sortMenu = document.getElementById('sortMenu');
    const sortLabel = document.getElementById('current-sort-label');

    if (sortTrigger && sortContainer) {
        sortTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            sortContainer.classList.toggle('active');
        });

        // Close when clicking outside
        document.addEventListener('click', () => {
            sortContainer.classList.remove('active');
        });

        // Handle Item Selection
        if (sortMenu) {
            sortMenu.querySelectorAll('.sort-item').forEach(item => {
                item.addEventListener('click', () => {
                    const value = item.getAttribute('data-value');
                    const label = item.textContent;

                    // Update State
                    currentFilters.sort = value;

                    // Update UI
                    sortLabel.textContent = label;
                    sortMenu.querySelectorAll('.sort-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');

                    // Close menu
                    sortContainer.classList.remove('active');

                    // Apply
                    applyFilters();
                });
            });
        }
    }
});
