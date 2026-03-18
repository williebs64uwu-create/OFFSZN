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
    freeOnly: false,
    keys: []
};
let renderTimeout = null; // Debounce for results rendering

// --- Skeletons ---
function showResultsSkeletons(count = 15) {
    const container = document.getElementById('search-results-container');
    if (!container) return;

    let html = '';
    for (let i = 0; i < count; i++) {
        html += `<div class="skeleton-row skeleton"></div>`;
    }
    container.innerHTML = html;
}

function showRecommendationSkeletons(count = 4) {
    const container = document.getElementById('recommendations-container');
    if (!container) return;

    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-card">
                <div class="skeleton-card-img skeleton"></div>
                <div class="skeleton-text medium skeleton"></div>
                <div class="skeleton-text short skeleton"></div>
            </div>
        `;
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

async function fetchProducts() {
    try {
        if (!window.supabaseClient) {
            console.error("Supabase client not initialized");
            return [];
        }

        const { data: products, error } = await window.supabaseClient
            .from('products')
            .select('*')
            .neq('status', 'deleted')
            .eq('visibility', 'public');

        if (error) throw error;
        return products || [];
    } catch (err) {
        console.error("Error fetching products:", err);
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
            .select('id, nickname, avatar_url, is_verified, is_producer, bio, r2_version, license_settings')
            .eq('is_producer', true); // Removed limit to ensure all producers are available

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
        const producer = fetchedProducers.find(pr => pr.id === p.producer_id || pr.id === p.user_id);
        const nameFallback = producer?.nickname || p.producer_nickname || 'OFFSZN';
        const licenses = resolveProductLicenses(p, producer);
        return {
            ...p,
            producer_name: nameFallback,
            producer_nickname: nameFallback, // Simplified
            producer_avatar: producer?.avatar_url,
            producer_is_verified: (producer?.is_verified || p.producer_is_verified) || false,
            _resolvedLicenses: licenses // Store for filtering/rendering
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

            // Only assign exactProducer if we haven't found a better one yet
            if (query !== '' && !exactProducer) {
                const exactSimilarity = getSimilarity(p.nickname, query);
                if (normNick === normalizeString(query) || exactSimilarity > 0.85) {
                    exactProducer = p;
                }
            }
            return isMatch;
        });

        // Ensure the exact producer is NOT included in the matched producers list
        // so it doesn't render twice (once as exact card, once as standard row).
        if (exactProducer) {
            matchedProducers = matchedProducers.filter(p => p.id !== exactProducer.id);
        }
    }

    // 2. FILTER PRODUCTS
    let matchedProducts = allProducts.map(p => {
        const score = getMatchScore(p, query, normalizeString(query));

        // Category Filter
        let matchesCat = true;
        if (category === 'Beats') matchesCat = p.product_type === 'beat';
        else if (category === 'Drum Kits') matchesCat = p.product_type === 'drumkit';
        else if (category === 'Samples') matchesCat = p.product_type === 'loopkit';
        else if (category === 'Presets') matchesCat = p.product_type === 'preset';
        else if (category === 'Plantillas') matchesCat = p.product_type === 'template';

        return { ...p, _matchScore: score, _matchesCat: matchesCat };
    })
        .filter(p => p._matchScore > 0 && p._matchesCat)
        .sort((a, b) => b._matchScore - a._matchScore); // Sort by relevance descending

    // De-duplicate (Just in case the DB query returned duplicates or overlap)
    const seenIds = new Set();
    matchedProducts = matchedProducts.filter(p => {
        if (seenIds.has(p.id)) return false;
        seenIds.add(p.id);
        return true;
    });

    // 3. UI RENDERING
    // Clean up temporary score/cat properties before rendering if desired, though not strictly necessary
    renderResults(matchedProducts, matchedProducers, exactProducer);
    renderRecommendations(allProducts);
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
        // Sync initial state
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
        const updatePriceDisplay = (val) => {
            if (!priceDisplay) return;
            const formatted = window.CurrencyManager?.format(val) || `$${val}`;
            // If it's at the maximum (1000), we can show it's any price up to that, 
            // but the user wants to see the range clearly.
            priceDisplay.textContent = val >= 1000 ? 'Cualquiera' : formatted;
        };

        priceSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            currentFilters.priceMax = val >= 1000 ? 1000000 : val; // Set very high if "Cualquiera"
            updatePriceDisplay(val);
            applyFilters();
        });

        // Initial state sync
        updatePriceDisplay(parseFloat(priceSlider.value));
    }

    // Gratis Filter Checkbox
    const freeCheck = document.getElementById('free-filter-check');
    if (freeCheck) {
        // Init from state if URL param was set
        if (currentFilters.freeOnly) {
            freeCheck.checked = true;
            if (priceSlider) priceSlider.disabled = true;
            if (priceDisplay) priceDisplay.textContent = 'Gratis';
        }

        freeCheck.addEventListener('change', (e) => {
            currentFilters.freeOnly = e.target.checked;
            if (priceSlider) {
                priceSlider.disabled = currentFilters.freeOnly;
            }
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
                // Determine initial value (avoid "Cualquiera" word)
                const currentVal = (currentFilters.priceMax === 1000000 || currentFilters.priceMax >= 1000) 
                    ? "1000.00" 
                    : currentFilters.priceMax.toFixed(2);

                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentVal;
                
                // Style input to fit perfectly
                Object.assign(input.style, {
                    width: '65px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    padding: '2px 6px',
                    textAlign: 'right',
                    outline: 'none',
                    marginRight: '0px'
                });

                priceDisplay.innerHTML = '';
                priceDisplay.appendChild(input);
                input.focus();
                input.select();

                let isFinishing = false;
                const finishEditing = () => {
                    if (isFinishing) return;
                    isFinishing = true;
                    
                    let val = parseFloat(input.value);
                    if (isNaN(val) || val < 0) val = 1000;
                    
                    // Update state
                    currentFilters.priceMax = val >= 1000 ? 1000000 : val;
                    if (priceSlider) priceSlider.value = Math.min(val, 1000);
                    
                    // UI Refresh
                    updatePriceDisplay(val >= 1000 ? 1000 : val);
                    applyFilters();
                };

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') input.blur();
                    if (e.key === 'Escape') {
                        input.value = currentVal;
                        input.blur();
                    }
                });

                input.addEventListener('input', (e) => {
                    // Strict validation: max XX.XX
                    let v = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = v.split('.');
                    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
                    if (parts[1] && parts[1].length > 2) v = parts[0] + '.' + parts[1].slice(0, 2);
                    
                    // Prevent more than 2 digits after dot if already there
                    e.target.value = v;
                });

                input.addEventListener('blur', finishEditing);
            });
        }

    // Key Initializer
    initKeyFilters();

    // Accordion Listeners
    document.querySelectorAll('.key-check').forEach(check => {
        // Sync initial state
        if (currentFilters.keys.includes(check.value)) {
            check.checked = true;
        }

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

    // Clear Filters
    const clearBtn = document.getElementById('clear-filters-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            currentFilters = {
                categories: [],
                genres: [],
                priceMax: 1000,
                bpmMin: 40,
                bpmMax: 250,
                doubleTempo: false,
                freeOnly: false,
                keys: []
            };
            // Reset UI
            document.querySelectorAll('.category-check, .key-check').forEach(c => c.checked = false);
            const freeFilter = document.getElementById('free-filter-check');
            if (freeFilter) freeFilter.checked = false;
            if (priceSlider) {
                priceSlider.value = 1000;
                priceSlider.disabled = false;
            }
            if (bpmMinSlider) bpmMinSlider.value = 40;
            if (bpmMaxSlider) bpmMaxSlider.value = 250;
            if (bpmDisplay) bpmDisplay.textContent = '40 - 250';
            if (priceDisplay) priceDisplay.textContent = 'Cualquiera';
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
    // Skip full filter logic if products aren't fetched yet
    if (allProducts.length === 0) return;

    // Clear previous timeout to debounce rapid changes
    if (renderTimeout) clearTimeout(renderTimeout);

    renderTimeout = setTimeout(() => {
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
        if (currentFilters.categories.length > 0 &&
            !currentFilters.categories.includes('Todo') &&
            !currentFilters.categories.includes('Todas')) {
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

        // 4. Price Filter (License Aware)
        if (currentFilters.priceMax !== null || currentFilters.freeOnly) {
            results = results.filter(p => {
                const licenses = p._resolvedLicenses || [];
                if (currentFilters.freeOnly) {
                    return licenses.some(l => l.price === 0);
                }
                const max = (currentFilters.priceMax !== null) ? currentFilters.priceMax : 1000000;
                return licenses.some(l => l.price <= max);
            });
        }

        // 5. Key Filter
        if (currentFilters.keys && currentFilters.keys.length > 0) {
            results = results.filter(p => {
                const pk = (p.key || p.key_scale || '').trim();
                return currentFilters.keys.includes(pk);
            });
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
                const isMatch = nick.includes(query) || normNick.includes(normQuery) || similarity > 0.7;

                if (query !== '') {
                    const exactSimilarity = getSimilarity(p.nickname, query);
                    if (normNick === normalizeString(query) || exactSimilarity > 0.85) exactProducer = p;
                }
                return isMatch;
            });
        }

        renderResults(filteredResults, matchedProducers, exactProducer);
        renderRecommendations();
    }, 50); // 50ms delay for performance without artificial lag
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
        <div class="recommendation-card" onclick="window.location.href='${getProductUrl(p)}'">
            <div class="recommendation-card-img-wrapper">
                <img crossorigin="anonymous" src="${p.image_url || '/images/portada-default.png'}" alt="${escapeHTML(p.name)}">
            </div>
            <div class="recommendation-card-title">${escapeHTML(p.name)}</div>
            <div class="recommendation-card-producer">${escapeHTML(p.producer_name || 'OFFSZN')}</div>
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
        // "Productos" title removed per user request
        html += products.map(p => renderTrackRow(p)).join('');
    }

    // C. REMAINING PRODUCERS (if not exact or if more than 1)
    const otherProducers = producers.filter(p => p.id !== exactProducer?.id);
    if (otherProducers.length > 0) {
        html += `<div class="search-section-title">Productores</div>`;
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
    
    const isR2 = window.AuthUtils && window.AuthUtils.isR2Url(imgUrl);
    const imgPlaceholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const imgAttr = isR2 ? `src="${imgPlaceholder}" data-r2-src="${escapeHTML(imgUrl)}"` : `src="${escapeHTML(imgUrl)}"`;

    return `
        <div class="track-row" data-product-id="${p.id}">
            <div class="track-left">
                <div class="thumb-container" onclick="window.location.href='${productUrl}'">
                    <img crossorigin="anonymous" ${imgAttr} data-r2-version="${p.r2_version || 'v2'}" class="track-thumb" alt="cover">
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
                    <i class="bi bi-heart action-icon" onclick="event.stopPropagation(); window.FavoritesManager?.toggleLike('${p.id}', this, ${JSON.stringify(p).replace(/"/g, '&quot;')})" title="Like"></i>
                    <i class="bi bi-download action-icon" onclick="event.stopPropagation(); window.openDownloadModal?.('${p.id}')" title="Download"></i>
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
    const defaultAvatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.nickname || 'Producer') + '&background=random';
    const avatar = p.avatar_url || defaultAvatarUrl;
    const profileUrl = `/@${encodeURIComponent(p.nickname || 'producer')}`;
    const isR2 = window.AuthUtils && window.AuthUtils.isR2Url(avatar);
    const imgPlaceholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const imgAttr = isR2 ? `src="${imgPlaceholder}" data-r2-src="${escapeHTML(avatar)}"` : `src="${escapeHTML(avatar)}"`;

    return `
        <div class="exact-match-card" onclick="window.location.href='${profileUrl}'" style="cursor:pointer; background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; display: flex; align-items: center; gap: 20px; transition: all 0.3s ease; margin-bottom: 30px;">
            <div style="position: relative;">
                <img crossorigin="anonymous" ${imgAttr} data-r2-version="${p.r2_version || 'v2'}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #fff;">
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
    const isR2 = window.AuthUtils && window.AuthUtils.isR2Url(avatar);
    const imgPlaceholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const imgAttr = isR2 ? `src="${imgPlaceholder}" data-r2-src="${escapeHTML(avatar)}"` : `src="${escapeHTML(avatar)}"`;

    return `
        <div class="producer-row" onclick="window.location.href='${profileUrl}'" style="cursor:pointer; display: flex; align-items: center; gap: 16px; padding: 12px; border-radius: 12px; transition: background 0.2s; margin-bottom: 8px;">
            <img crossorigin="anonymous" ${imgAttr} data-r2-version="${p.r2_version || 'v2'}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; background: #1a1a1a;">
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

    // Fix for naming: prioritize nickname
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
        // Update playlist context if available
        if (window.StickyPlayer.updatePlaylist && filteredResults.length > 0) {
            const formattedPlaylist = filteredResults.map(p => {
                const aUrl = p.mp3_url || p.download_url_mp3 || p.preview_url ||
                    p.audio_url || p.tagged_file || p.demo_file ||
                    p.file_url || p.url_file;
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

        // Visual toggle
        document.querySelectorAll('.thumb-play-overlay i').forEach(i => i.className = 'bi bi-play-fill');
        if (icon) icon.className = 'bi bi-pause-fill';
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
    const icon = el || e.currentTarget;
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
    const isR2 = window.AuthUtils && window.AuthUtils.isR2Url(imgUrl);
    const imgPlaceholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const imgAttr = isR2 ? `src="${imgPlaceholder}" data-r2-src="${escapeHTML(imgUrl)}"` : `src="${escapeHTML(imgUrl)}"`;

    return `
        <div class="fallback-card" data-product-id="${p.id}" onclick="window.location.href='${productUrl}'">
            <div class="fallback-card-img">
                <img crossorigin="anonymous" ${imgAttr} data-r2-version="${p.r2_version || 'v2'}">
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
    const rows = document.querySelectorAll('.track-row, .fallback-card');
    rows.forEach(row => {
        const productId = row.getAttribute('data-product-id');
        if (!productId) return;

        const isLiked = window.FavoritesManager?.isLiked?.(productId);
        const heart = row.querySelector('.bi-heart, .bi-heart-fill');
        if (heart) {
            heart.className = isLiked ? 'bi bi-heart-fill liked action-icon' : 'bi bi-heart action-icon';
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
