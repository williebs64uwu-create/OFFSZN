/**
 * NAVBAR LOGIC CENTRALIZED
 * Handles: Search, Authentication, Currency, and UI Toggles.
 * Used by: index.html, href.html, and potentially others.
 */

// ==================== STATE MANAGEMENT ==================== //
window.NavbarState = {
    search: {
        debounceTimer: null,
        currentCategory: 'Todo',
        history: (JSON.parse(localStorage.getItem('offszn_search_history')) || [{ type: 'text', term: 'Dark Piano' }, { type: 'text', term: 'Tainy Drums' }]).slice(0, 5),
        selectedIndex: -1,
        activeTags: [],
        isHovering: false,
        lastResults: [] // Cache for instant currency toggle
    }
};

const NavbarState = window.NavbarState;

// ==================== DOM ELEMENTS (Lazy Load) ==================== //
// We use getters or lookups inside functions to safely handle pages where elements might be missing
const getEl = (id) => document.getElementById(id);


// ==================== STRICT UI INTERACTION LOGIC ==================== //

function isAnyUIOpen() {
    if (document.querySelector('.dropdown-parent.dropdown-active')) return true;
    if (document.querySelector('.user-dropdown.active')) return true;
    if (document.querySelector('.notification-dropdown.active')) return true;
    if (getEl('currency-menu') && getEl('currency-menu').classList.contains('active')) return true;
    if (getEl('search-filter-dropdown') && getEl('search-filter-dropdown').style.display === 'flex') return true;
    if (getEl('globalCartPanel') && getEl('globalCartPanel').classList.contains('active')) return true;
    return false;
}

function closeAllUI(exceptSearch = false) {
    // Navbar
    document.querySelectorAll('.dropdown-parent').forEach(p => p.classList.remove('dropdown-active'));

    // Profile & Notifs
    const userDrop = document.querySelector('.user-dropdown');
    if (userDrop) userDrop.classList.remove('active');

    const notifDrop = document.querySelector('.notification-dropdown');
    if (notifDrop) notifDrop.classList.remove('active');

    // Currency
    const cMenu = getEl('currency-menu');
    if (cMenu) cMenu.classList.remove('active');
    const cBtn = getEl('currency-toggle-btn');
    if (cBtn) cBtn.classList.remove('active-currency');

    // Search Filters
    const sFilter = getEl('search-filter-dropdown');
    if (sFilter) sFilter.style.display = 'none';

    // Search Trend Panel
    const sTrend = getEl('search-trending-panel');
    if (sTrend && !exceptSearch) {
        sTrend.style.display = 'none';
        sTrend.classList.remove('active');
    }

    // Cart & Overlays
    const cart = getEl('globalCartPanel');
    const back = getEl('globalBackdrop');
    if (cart) cart.classList.remove('active');
    if (back) back.classList.remove('active');

    // Search Overlay
    const sOverlay = getEl('search-overlay');
    if (sOverlay && !exceptSearch) sOverlay.classList.remove('active');

    // Global Guest Modal - REMOVED AUTO-CLOSE
    // closeGuestModal();
}

/**
 * GLOBAL GUEST AUTH MODAL
 */
window.showGuestModal = function (title = "Inicia Sesión", text = "Para realizar esta acción, necesitas una cuenta en OFFSZN.") {
    let modal = getEl('globalGuestModal');

    // --- SELF-HEALING: Inject Modal if missing ---
    if (!modal) {
        console.warn("Navbar: globalGuestModal missing, injecting...");
        const modalHtml = `
            <div class="guest-auth-modal" id="globalGuestModal" onclick="if(event.target === this) closeGuestModal()">
                <div class="guest-auth-card">
                    <span class="guest-modal-close" onclick="closeGuestModal()"><i class="bi bi-x"></i></span>
                    <div class="guest-auth-title" id="guestModalTitle"></div>
                    <div class="guest-auth-text" id="guestModalText"></div>
                    <div class="guest-auth-btns">
                        <a href="/pages/login.html" class="guest-btn-primary">
                            <i class="bi bi-person-plus-fill"></i> INICIAR SESIÓN / REGISTRARSE
                        </a>
                        <button class="guest-btn-secondary" onclick="closeGuestModal()">Quizás luego</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = getEl('globalGuestModal');
    }

    const titleEl = getEl('guestModalTitle');
    const textEl = getEl('guestModalText');

    if (modal) {
        if (titleEl) titleEl.innerText = title;
        if (textEl) textEl.innerText = text;

        modal.classList.add('active');
        modal.style.display = 'flex';
        // Force reflow for opacity transition if needed
        setTimeout(() => modal.style.opacity = '1', 10);
    }
};

window.closeGuestModal = function () {
    const modal = getEl('globalGuestModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }, 300);
    }
};

function handleSmartToggle(targetType, targetElement) {
    // If mobile menu is open, close it (User requirement: close menu before opening overlays like cart)
    if (typeof window.closeMobileMenu === 'function') {
        window.closeMobileMenu();
    }

    const ANY_OPEN = isAnyUIOpen();
    let THIS_WAS_OPEN = false;

    if (targetType === 'navbar' && targetElement.classList.contains('dropdown-active')) THIS_WAS_OPEN = true;
    if (targetType === 'user' && targetElement.classList.contains('active')) THIS_WAS_OPEN = true;
    if (targetType === 'notif' && targetElement.classList.contains('active')) THIS_WAS_OPEN = true;
    if (targetType === 'currency' && getEl('currency-menu')?.classList.contains('active')) THIS_WAS_OPEN = true;
    if (targetType === 'filter' && getEl('search-filter-dropdown')?.style.display === 'flex') THIS_WAS_OPEN = true;
    if (targetType === 'cart' && getEl('globalCartPanel')?.classList.contains('active')) THIS_WAS_OPEN = true;

    closeAllUI();

    if (ANY_OPEN) return; // Strict Reset behavior

    if (!ANY_OPEN) {
        if (targetType === 'navbar') targetElement.classList.add('dropdown-active');
        if (targetType === 'user') targetElement.classList.add('active');
        if (targetType === 'notif') targetElement.classList.add('active');

        if (targetType === 'currency') {
            const menu = getEl('currency-menu');
            const btn = getEl('currency-toggle-btn');
            if (menu) menu.classList.add('active');
            if (btn) btn.classList.add('active-currency');

            // Sync UI
            const curr = getEl('current-currency')?.innerText.trim();
            if (curr) highlightCurrencyItem(curr);
        }

        if (targetType === 'filter') {
            const fil = getEl('search-filter-dropdown');
            if (fil) fil.style.display = 'flex';
        }

        if (targetType === 'cart') {
            const cart = getEl('globalCartPanel');
            const back = getEl('globalBackdrop'); // or created dynamically
            if (cart) cart.classList.add('active');
            // Check if backdrop exists, if not, maybe cart has its own overlay logic or we use global-overlays.css logic
            if (back) back.classList.add('active');
        }
    }
}


// ==================== SEARCH LOGIC ==================== //

function sanitizeSearchQuery(query) {
    if (!query) return '';
    // 1. Trim leading/trailing spaces
    // 2. Replace multiple spaces with a single space
    // 3. Remove characters that could break basic search logic but keep common ones
    // 4. Remove emojis or very weird chars if any, but keep alphanumeric
    return query.trim().replace(/\s+/g, ' ').replace(/[^\w\s\u00C0-\u017F]/gi, '');
}

/**
 * Normalizes a string for comparison: removes spaces, accents, and converts to lowercase.
 */
function normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/\s+/g, '')             // Remove all spaces
        .replace(/[^\w]/g, '');          // Remove symbols
}

/**
 * Basic Dice Coefficient for fuzzy string similarity (0 to 1)
 */
function getSimilarity(s1, s2) {
    const n1 = normalizeString(s1);
    const n2 = normalizeString(s2);
    if (n1 === n2) return 1.0;
    if (n1.length < 2 || n2.length < 2) return 0;

    const bigrams1 = new Set();
    for (let i = 0; i < n1.length - 1; i++) bigrams1.add(n1.substring(i, i + 2));
    const bigrams2 = new Set();
    for (let i = 0; i < n2.length - 1; i++) bigrams2.add(n2.substring(i, i + 2));

    let intersection = 0;
    for (const b of bigrams1) {
        if (bigrams2.has(b)) intersection++;
    }
    return (2.0 * intersection) / (bigrams1.size + bigrams2.size);
}

function initSearch() {
    const searchContainer = document.querySelector('.navbar-search');
    const searchInput = getEl('navbarSearchInput');
    const mobileInput = getEl('mobileSearchInput');
    const searchOverlay = getEl('search-overlay');
    const trendPanel = getEl('search-trending-panel');
    const clearBtn = getEl('search-clear-btn');

    if (!searchContainer || !searchInput || !trendPanel) return;

    // Helper to handle search input (shared logic)
    const handleSearchInput = (inputEl) => {
        const query = sanitizeSearchQuery(inputEl.value);

        // Sync values if they both exist
        if (inputEl === searchInput && mobileInput) mobileInput.value = inputEl.value;
        if (inputEl === mobileInput && searchInput) searchInput.value = inputEl.value;

        if (clearBtn) clearBtn.style.display = query.length > 0 ? 'block' : 'none';

        if (query.length > 0) {
            openSearchUI();
            if (NavbarState.search.debounceTimer) clearTimeout(NavbarState.search.debounceTimer);
            NavbarState.search.debounceTimer = setTimeout(() => {
                performSearch(query, NavbarState.search.currentCategory);
            }, 300);
        } else {
            // Cancel any pending search if cleared
            if (NavbarState.search.debounceTimer) clearTimeout(NavbarState.search.debounceTimer);
            renderHistoryAndTrends();
        }
    };

    // Desktop Input Listeners
    searchInput.addEventListener('focus', () => {
        if (trendPanel && searchContainer) {
            trendPanel.style.top = 'calc(100% + 4px)';
            trendPanel.style.marginTop = '0';
            trendPanel.style.width = '100%';
            trendPanel.style.left = '0';
            searchContainer.appendChild(trendPanel);
        }
        closeAllUI(true);
        openSearchUI();
        handleSearchInput(searchInput);
    });

    searchInput.addEventListener('input', () => handleSearchInput(searchInput));

    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (!NavbarState.search.isHovering && document.activeElement !== searchInput) {
                closeSearchUI();
            }
        }, 250);
    });

    // Mobile Input Listeners
    if (mobileInput) {
        mobileInput.addEventListener('focus', () => {
            const mobileWrapper = getEl('mobile-search-wrapper');
            if (trendPanel && mobileWrapper) {
                trendPanel.style.top = '100%';
                trendPanel.style.marginTop = '-4px';
                trendPanel.style.width = 'calc(100% - 32px)';
                trendPanel.style.left = '16px';
                mobileWrapper.appendChild(trendPanel);
            }
            closeAllUI(true);
            openSearchUI();
            handleSearchInput(mobileInput);
        });

        mobileInput.addEventListener('input', () => handleSearchInput(mobileInput));

        mobileInput.addEventListener('blur', () => {
            setTimeout(() => {
                if (!NavbarState.search.isHovering && document.activeElement !== mobileInput) {
                    closeSearchUI();
                }
            }, 250);
        });

        mobileInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = mobileInput.value.trim();
                const cat = NavbarState.search.currentCategory || 'Todo';
                if (query.length > 0) {
                    if (window.saveToHistory) {
                        window.saveToHistory({ type: 'text', term: query });
                    }
                    window.location.href = `/search.html?q=${encodeURIComponent(query)}&cat=${cat}`;
                }
            }
        });
    }

    // Clear Button Logic
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            searchInput.value = '';
            if (mobileInput) mobileInput.value = '';
            clearBtn.style.display = 'none';
            searchInput.focus();
            renderHistoryAndTrends();
        });
    }

    // Common Listeners
    searchContainer.addEventListener('mouseenter', () => NavbarState.search.isHovering = true);
    searchContainer.addEventListener('mouseleave', () => NavbarState.search.isHovering = false);
    if (searchOverlay) searchOverlay.addEventListener('click', closeSearchUI);

    // Keyboard Nav (Desktop)
    searchInput.addEventListener('keydown', (e) => {
        const items = trendPanel.querySelectorAll('.search-result-item, .recent-item, .trend-tag');
        if (items.length === 0) return;

        if (e.key === 'Escape') {
            closeSearchUI();
            searchInput.blur();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            NavbarState.search.selectedIndex = (NavbarState.search.selectedIndex + 1) % items.length;
            highlightItem(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            NavbarState.search.selectedIndex = (NavbarState.search.selectedIndex - 1 + items.length) % items.length;
            highlightItem(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (NavbarState.search.selectedIndex >= 0 && items[NavbarState.search.selectedIndex]) {
                items[NavbarState.search.selectedIndex].click();
            } else {
                const val = searchInput.value.trim();
                if (val) performSearch(val, NavbarState.search.currentCategory, true);
            }
        }
    });
}

function openSearchUI() {
    const searchContainer = document.querySelector('.navbar-search');
    const searchOverlay = getEl('search-overlay');
    const trendPanel = getEl('search-trending-panel');

    if (searchContainer) searchContainer.classList.add('focused');
    if (searchOverlay) searchOverlay.classList.add('active');
    if (trendPanel) {
        trendPanel.classList.add('active');
        trendPanel.style.display = 'block';
    }
    NavbarState.search.selectedIndex = -1;
}

function closeSearchUI() {
    const searchContainer = document.querySelector('.navbar-search');
    const searchOverlay = getEl('search-overlay');
    const trendPanel = getEl('search-trending-panel');

    if (searchContainer) searchContainer.classList.remove('focused');
    if (searchOverlay) searchOverlay.classList.remove('active');
    if (trendPanel) {
        trendPanel.classList.remove('active');
        trendPanel.style.display = 'none';
    }
}

function highlightItem(items) {
    items.forEach(i => i.classList.remove('selected'));
    if (items[NavbarState.search.selectedIndex]) {
        items[NavbarState.search.selectedIndex].classList.add('selected');
        items[NavbarState.search.selectedIndex].scrollIntoView({ block: 'nearest' });
    }
}

window.NavbarSearchCache = {
    products: null,
    users: null,
    profileMap: {},
    lastFetch: 0
};

async function getSearchCache() {
    if (!window.supabaseClient) return null;
    const now = Date.now();
    if (window.NavbarSearchCache.products && window.NavbarSearchCache.users && (now - window.NavbarSearchCache.lastFetch < 300000)) {
        return window.NavbarSearchCache;
    }

    try {
        const [pRes, uRes] = await Promise.all([
            window.supabaseClient.from('products').select('*').eq('visibility', 'public').neq('status', 'draft'),
            window.supabaseClient.from('users').select('id, nickname, avatar_url, is_verified, is_producer, bio, r2_version').eq('is_producer', true)
        ]);

        let profileMap = {};
        if (uRes.data) {
            uRes.data.forEach(u => profileMap[u.id] = u);
        }

        window.NavbarSearchCache = {
            products: pRes.data || [],
            users: uRes.data || [],
            profileMap: profileMap,
            lastFetch: now
        };
        return window.NavbarSearchCache;
    } catch (err) {
        console.error("Cache fetch error:", err);
        return null;
    }
}

async function performSearch(query, category, autoRedirectExact = false) {
    try {
        const trendPanel = getEl('search-trending-panel');
        if (trendPanel) {
            trendPanel.innerHTML = `
                ${Array(3).fill(0).map(() => `
                    <div style="display:flex; align-items:center; gap:12px; padding:10px;">
                        <div class="skeleton" style="width:36px; height:36px; border-radius:50%;"></div>
                        <div style="flex:1;">
                            <div class="skeleton" style="width:60%; height:14px; margin-bottom:6px;"></div>
                            <div class="skeleton" style="width:40%; height:10px;"></div>
                        </div>
                    </div>
                `).join('')}
            `;
        }

        let realResults = [];
        const cache = await getSearchCache();

        if (!cache) return; // Fallback if supabase fails

        // RACE CONDITION FIX
        if (getEl('navbarSearchInput').value.trim() === '') return;

        const lQuery = query.toLowerCase().trim();
        const normQuery = normalizeString(lQuery);

        // --- 1. SEARCH USERS ---
        let matchedUsers = [];
        if (!category || category === 'Todo' || category === 'Productores') {
            matchedUsers = cache.users.filter(u => {
                const nick = (u.nickname || '').toLowerCase();
                const normNick = normalizeString(nick);
                const similarity = getSimilarity(nick, lQuery);
                return nick.includes(lQuery) || normNick.includes(normQuery) || similarity > 0.7;
            }).slice(0, 3);
        }

        // --- 2. SEARCH PRODUCTS ---
        let matchedProducts = [];
        if (!category || category !== 'Productores') {
            matchedProducts = cache.products.filter(p => {
                const name = (p.name || '').toLowerCase();
                const normName = normalizeString(name);
                const producer = cache.profileMap[p.producer_id]; // Fallback if producer missing
                const prodName = producer ? (producer.nickname || '').toLowerCase() : '';
                const normProd = normalizeString(prodName);

                const matchesCat = (!category || category === 'Todo') ? true :
                    (category === 'Beats' ? p.product_type === 'beat' :
                        category === 'Drum Kits' ? p.product_type === 'kit' :
                            category === 'Presets' ? p.product_type === 'preset' :
                                category === 'Plantillas' ? p.product_type === 'template' : true);

                if (!matchesCat) return false;

                return name.includes(lQuery) || normName.includes(normQuery) || prodName.includes(lQuery) || normProd.includes(normQuery);
            }).slice(0, 3);
        }

        // --- FALLBACK: IF NO RESULTS MATCH, FETCH TOP 3 ---
        if (matchedProducts.length === 0 && matchedUsers.length === 0) {
            matchedProducts = [...cache.products].sort((a, b) => (b.plays_count || 0) - (a.plays_count || 0)).slice(0, 3).map(item => ({ ...item, isFallback: true }));
        }

        if (matchedProducts.length > 0) {
            realResults = [...matchedProducts.map(p => {
                const producer = cache.profileMap[p.producer_id];
                return {
                    type: p.product_type === 'beat' ? 'beat' : 'kit',
                    product_type: p.product_type,
                    name: p.name,
                    public_slug: p.public_slug,
                    id: p.id,
                    title: p.name || 'Untitled',
                    producer: producer ? producer.nickname : 'OFFSZN',
                    price: p.price_basic ? `$${p.price_basic}` : 'Free',
                    img: p.image_url,
                    r2_version: p.r2_version || 'v2',
                    isFallback: p.isFallback || false
                };
            })];
        }

        // --- COMBINE AND PRIORITIZE ---
        if (matchedUsers.length > 0 && realResults.length < 3) {
            const remainingSlots = 3 - realResults.length;
            const userItems = matchedUsers.slice(0, remainingSlots).map(u => ({
                type: 'user',
                title: u.nickname || 'OFFSZN',
                stats: 'Producer',
                img: u.avatar_url,
                r2_version: u.r2_version || 'v2',
                id: u.id
            }));
            realResults = [...realResults, ...userItems];
        } else if (matchedUsers.length > 0 && realResults.length >= 3) {
            const userItem = {
                type: 'user',
                title: matchedUsers[0].nickname || 'OFFSZN',
                stats: 'Producer',
                img: matchedUsers[0].avatar_url,
                r2_version: matchedUsers[0].r2_version || 'v2',
                id: matchedUsers[0].id
            };
            realResults.pop();
            realResults.unshift(userItem);
        }

        NavbarState.search.lastResults = realResults; // Cache for instant currency

        if (autoRedirectExact) {
            const normQuery = normalizeString(query);
            // Find EXACT match or HIGH SIMILARITY match for typo resilience
            const exactMatch = realResults.find(r => {
                const normTitle = normalizeString(r.title);
                const normName = normalizeString(r.name || '');
                const similarity = Math.max(getSimilarity(r.title, query), getSimilarity(r.name || '', query));

                return normTitle === normQuery || normName === normQuery || similarity > 0.85;
            });

            if (exactMatch && !exactMatch.isFallback) {
                // Save to history with correct type before redirecting
                const termObj = exactMatch.type === 'user' ?
                    { type: 'user', term: exactMatch.title, subtitle: 'Producer', img: exactMatch.img, r2_version: exactMatch.r2_version } :
                    { type: exactMatch.type, term: exactMatch.title, subtitle: exactMatch.producer || exactMatch.price, img: exactMatch.img, id: exactMatch.id, r2_version: exactMatch.r2_version };

                await window.saveToHistory(termObj);

                // Navigate directly to exact match
                let targetUrl = exactMatch.type === 'user' ?
                    `/@${encodeURIComponent(exactMatch.title)}` :
                    (window.createSeoLink ? window.createSeoLink(exactMatch) : `/producto.html?id=${exactMatch.id}`);
                window.location.href = targetUrl;
                return;
            }

            // NO EXACT MATCH -> REDIRECT TO SEARCH PAGE
            const cat = NavbarState.search.currentCategory || 'Todo';
            if (window.saveToHistory) {
                await window.saveToHistory({ type: 'text', term: query });
            }
            window.location.href = `/search.html?q=${encodeURIComponent(query)}&cat=${cat}`;
            return;
        }

        renderActualResults(realResults);
    } catch (err) {
        console.error("Search Error", err);
        // On error, if it was an Enter press, still try to go to search page
        if (autoRedirectExact) {
            const cat = NavbarState.search.currentCategory || 'Todo';
            if (window.saveToHistory) {
                await window.saveToHistory({ type: 'text', term: query });
            }
            window.location.href = `/search.html?q=${encodeURIComponent(query)}&cat=${cat}`;
        } else {
            renderActualResults([]);
        }
    }
}


function renderActualResults(results) {
    const trendPanel = getEl('search-trending-panel');
    if (!trendPanel) return;
    trendPanel.classList.add('fade-in');

    const hasFallback = results && results.some(r => r.isFallback);

    if (!results || results.length === 0) {
        trendPanel.innerHTML = `<div style="padding:10px; color:#888; text-align:center;">No se encontraron resultados.</div>`;
        return;
    }

    const sanitizeTextLocal = (text) => {
        if (!text) return '';
        const el = document.createElement('span');
        el.textContent = text;
        return el.innerHTML;
    };

    let html = '';
    if (hasFallback) {
        html += `<div style="padding:4px 10px 8px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.7rem; color: #555; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Tal vez te interese:</div>`;
    }

    for (let i = 0; i < results.length; i++) {
        const item = results[i];
        const isUser = item.type === 'user';

        // Target URL Logic
        const targetUrl = isUser ?
            `/@${encodeURIComponent(item.title)}` :
            (window.createSeoLink ? window.createSeoLink(item) : `/producto.html?id=${item.id}`);

        // Data for history saving
        const itemData = encodeURIComponent(JSON.stringify(item));

        // Price Formatting if available
        let displayPrice = item.price || '';
        if (item.price && window.CurrencyManager) {
            displayPrice = window.CurrencyManager.formatFromString(item.price);
        }

        const isSelected = (i === NavbarState.search.selectedIndex);

        // 🔥 ASSET RESOLUTION:
        // isUser -> ImageKit (speed)
        // isProduct -> R2/Supabase (direct/signed)
        let imgDisplaySrc = '';
        let isImageKit = false;
        
        if (item.img) {
            if (isUser) {
                const IK_BASE = 'https://ik.imagekit.io/6gzqp4xam/';
                if (!item.img.startsWith('http')) {
                    const cleanImg = item.img.startsWith('/') ? item.img.substring(1) : item.img;
                    imgDisplaySrc = `${IK_BASE}${cleanImg}?tr:w-100,h-100,fo-auto`;
                    isImageKit = true;
                } else if (item.img.includes('ik.imagekit.io')) {
                    imgDisplaySrc = item.img.includes('?') ? item.img : `${item.img}?tr:w-100,h-100,fo-auto`;
                    isImageKit = true;
                } else {
                    imgDisplaySrc = item.img;
                }
            } else {
                // Products (Beats/Kits) -> ALWAYS R2/Supabase
                imgDisplaySrc = item.img;
            }
        } else {
            // PRO PLACEHOLDER: Clean circular avatars for missing images
            const placeholderBase = 'https://ui-avatars.com/api/?background=252525&color=fff&size=128&bold=true';
            imgDisplaySrc = isUser 
                ? `${placeholderBase}&name=${encodeURIComponent(item.title || 'User')}`
                : `${placeholderBase}&name=${encodeURIComponent(item.title?.charAt(0) || 'P')}`;
        }

        html += `
            <div class="search-result-item ${isSelected ? 'selected' : ''}" 
                 onclick="handleResultClick('${targetUrl}', '${itemData}')">
                <div class="result-img">
                     <img data-r2-version="${item.r2_version || item.storage_version || 'v2'}"
                          data-r2-src="${imgDisplaySrc}" 
                          src="${isImageKit ? imgDisplaySrc : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}" 
                          alt="thumb" 
                          style="width:100%; height:100%; border-radius: 50%; object-fit:cover; transition: transform 0.3s ease; opacity: ${isImageKit ? '1' : '0.4'};">
                </div>
                <div class="result-info">
                    <div class="result-title">${sanitizeTextLocal(item.title)}</div>
                    <div class="result-meta">${sanitizeTextLocal(isUser ? (item.stats || 'Producer') : (item.producer || 'OFFSZN'))}</div>
                </div>
                ${!isUser && item.price ? `
                <div class="result-price-pill">
                    ${displayPrice}
                </div>` : ''}
            </div>
        `;
    }
    trendPanel.innerHTML = html;

    // 🔥 POST-RENDER: Sign R2 images asynchronously
    const signImages = async () => {
        const images = trendPanel.querySelectorAll('img[data-r2-src]');
        if (images.length === 0) return;

        if (!window.getAuthorizedUrl) {
            let waited = 0;
            while (!window.getAuthorizedUrl && waited < 2000) {
                await new Promise(r => setTimeout(r, 100));
                waited += 100;
            }
        }

        images.forEach(async (img) => {
            const rawSrc = img.getAttribute('data-r2-src');
            if (!rawSrc) return;

            // 🔥 FAST-PATH: If already a full URL or ImageKit/Cloudinary, skip signing
            if (rawSrc.startsWith('http') || 
                rawSrc.includes('cloudinary.com') || 
                rawSrc.includes('googleusercontent.com') || 
                rawSrc.includes('ik.imagekit.io')) {
                img.src = rawSrc;
                img.style.opacity = '1';
                return;
            }

            try {
                if (window.getAuthorizedUrl) {
                    const r2Version = img.getAttribute('data-r2-version') || 'v1';
                    const signedUrl = await window.getAuthorizedUrl(rawSrc, r2Version);
                    if (signedUrl) {
                        img.src = signedUrl;
                        img.style.opacity = '1';
                    }
                } else {
                    img.src = rawSrc;
                    img.style.opacity = '1';
                }
            } catch (e) {
                img.src = rawSrc;
                img.style.opacity = '1';
            }
        });
    };
    signImages();
}

function renderHistoryAndTrends() {
    const trendPanel = getEl('search-trending-panel');
    if (!trendPanel) return;

    const sanitizeTextLocal = (text) => {
        if (!text) return '';
        const el = document.createElement('span');
        el.textContent = text;
        return el.innerHTML;
    };

    const historyHtml = NavbarState.search.history.map(item => {
        let historyObj = typeof item === 'string' ? { type: 'text', term: item } : item;
        // fallback robust check
        if (!historyObj.term) historyObj = { type: 'text', term: historyObj };

        const safeTerm = historyObj.term.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;");

        let iconHtml = '<div class="bi bi-clock-history" style="width:24px; height:24px; display:flex; align-items:center; justify-content:center; background:#222; border-radius:50%; font-size:0.8rem;"></div>';
        const isUserHistory = historyObj.type === 'user';
        
        if (historyObj.img) {
            iconHtml = `<img data-r2-version="${historyObj.r2_version || historyObj.storage_version || 'v2'}" data-r2-src="${historyObj.img}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" style="width:24px; height:24px; border-radius:50%; object-fit:cover; background:#1a1a1a; opacity: 0.4;">`;
        } else if (isUserHistory) {
            const placeholderBase = 'https://ui-avatars.com/api/?background=252525&color=fff&size=64&bold=true';
            const placeholder = `${placeholderBase}&name=${encodeURIComponent(historyObj.term || 'U')}`;
            iconHtml = `<img src="${placeholder}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">`;
        } else if (historyObj.type === 'beat' || historyObj.type === 'kit') {
            const placeholderBase = 'https://ui-avatars.com/api/?background=252525&color=fff&size=64&bold=true';
            const placeholder = `${placeholderBase}&name=${encodeURIComponent(historyObj.term?.charAt(0) || 'P')}`;
            iconHtml = `<img src="${placeholder}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">`;
        }

        let subtitleHtml = historyObj.subtitle ? `<span style="font-size:0.7rem; color:#666; margin-left:8px;">• ${sanitizeTextLocal(historyObj.subtitle)}</span>` : '';

        // Include full data for rich redirects
        const historyData = encodeURIComponent(JSON.stringify({
            term: historyObj.term,
            type: historyObj.type,
            id: historyObj.id,
            public_slug: historyObj.public_slug,
            product_type: historyObj.product_type,
            img: historyObj.img,
            subtitle: historyObj.subtitle,
            r2_version: historyObj.r2_version || historyObj.storage_version || 'v2'
        }));

        return `<div class="recent-item" onclick="setSearchRich('${historyData}', event)">
            ${iconHtml}
            <span style="flex:1; margin-left: 8px;">${sanitizeTextLocal(historyObj.term)}${subtitleHtml}</span>
            <i class="bi bi-x history-delete-btn" onclick="deleteHistoryItem('${safeTerm}', event)" title="Eliminar"></i>
         </div>`;
    }).join('');

    let historySection = NavbarState.search.history.length > 0 ? `
        <div style="margin-bottom: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                <span style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.7rem; color: #555; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Búsquedas Recientes</span>
                <span style="font-size: 0.75rem; color: #8b5cf6; cursor: pointer; font-weight: 500;" onclick="window.location.href='/history.html'">Ver todo</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">${historyHtml}</div>
        </div>` : '';

    trendPanel.innerHTML = `
        ${historySection}
        <span style="display: block; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.7rem; color: #555; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 12px; text-transform: uppercase;">Tendencias Ahora</span>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <span class="trend-tag" onclick="setSearch('Dark Trap', event)"><i class="bi bi-graph-up-arrow"></i> Dark Trap</span>
            <span class="trend-tag" onclick="setSearch('Reggaeton 2025', event)"><i class="bi bi-fire"></i> Reggaeton 2025</span>
        </div>`;

    // 🔥 POST-RENDER: Sign R2 images in history items
    const signHistoryImages = async () => {
        const imgs = trendPanel.querySelectorAll('img[data-r2-src]');
        if (imgs.length === 0) return;
        // Wait for getAuthorizedUrl if not ready
        if (!window.getAuthorizedUrl) {
            let waited = 0;
            while (!window.getAuthorizedUrl && waited < 2000) {
                await new Promise(r => setTimeout(r, 100));
                waited += 100;
            }
        }
        imgs.forEach(async (img) => {
            const rawSrc = img.getAttribute('data-r2-src');
            if (!rawSrc) return;
            // Public URLs don't need signing
            if (rawSrc.startsWith('http') || 
                rawSrc.includes('cloudinary.com') || 
                rawSrc.includes('googleusercontent.com') ||
                rawSrc.includes('ik.imagekit.io')) {
                img.src = rawSrc;
                img.style.opacity = '1';
                return;
            }
            try {
                if (window.getAuthorizedUrl) {
                    const r2Version = img.getAttribute('data-r2-version') || 'v1';
                    const signedUrl = await window.getAuthorizedUrl(rawSrc, r2Version);
                    if (signedUrl) {
                        img.src = signedUrl;
                        img.style.opacity = '1';
                    }
                } else {
                    img.src = rawSrc;
                    img.style.opacity = '1';
                }
            } catch (e) {
                img.src = rawSrc;
                img.style.opacity = '1';
            }
        });
    };
    signHistoryImages();
}

// Global functions for HTML onclick attributes
window.setSearch = function (text, event, type = 'text', id = '') {
    if (event) event.stopPropagation();
    const searchInput = getEl('navbarSearchInput');
    if (searchInput) {
        searchInput.value = text;

        // Instant search and redirect if exact match
        performSearch(text, NavbarState.search.currentCategory, true);
    }
};

window.setSearchRich = function (historyDataEncoded, event) {
    if (event) event.stopPropagation();
    try {
        const item = JSON.parse(decodeURIComponent(historyDataEncoded));
        const searchInput = getEl('navbarSearchInput');
        if (searchInput) {
            searchInput.value = item.term;

            if (item.type === 'user') {
                window.location.href = `/@${encodeURIComponent(item.term)}`;
                return;
            } else if (item.type === 'beat' || item.type === 'kit' || item.type === 'preset' || item.type === 'template') {
                const url = window.createSeoLink ? window.createSeoLink({
                    id: item.id,
                    name: item.term,
                    public_slug: item.public_slug,
                    product_type: item.type
                }) : `/producto.html?id=${item.id}`;
                window.location.href = url;
                return;
            }

            // Fallback for plain text
            performSearch(item.term, NavbarState.search.currentCategory, true);
        }
    } catch (e) {
        console.warn("setSearchRich failed:", e);
    }
};

window.deleteHistoryItem = async function (term, e) {
    if (e) e.stopPropagation();

    const lowerTerm = term.toLowerCase().trim();
    const fullHistory = JSON.parse(localStorage.getItem('offszn_search_history')) || [];

    // Case-insensitive filtering, supporting both old string arrays and new object arrays
    const updatedFullHistory = fullHistory.filter(t => {
        const textVal = typeof t === 'string' ? t : t.term;
        return textVal.toLowerCase().trim() !== lowerTerm;
    });

    // Use Universal Sync
    await window.updateUniversalSearchHistory(updatedFullHistory);
}

window.saveToHistory = async function (termObj) {
    // Overload check: if passed a string, assume it's a plain text search
    if (typeof termObj === 'string') {
        termObj = { type: 'text', term: termObj };
    }

    // Safety check just in case
    if (!termObj || !termObj.term) return;

    const lowerTerm = termObj.term.toLowerCase().trim();
    let fullHistory = JSON.parse(localStorage.getItem('offszn_search_history')) || [];

    // Remove if exists
    fullHistory = fullHistory.filter(t => {
        const textVal = typeof t === 'string' ? t : t.term;
        return textVal.toLowerCase().trim() !== lowerTerm;
    });

    // Add to front
    fullHistory.unshift(termObj);

    // Limit storage to 50
    if (fullHistory.length > 50) fullHistory.pop();

    // Use Universal Sync
    await window.updateUniversalSearchHistory(fullHistory);
}

// 🌐 UNIVERSAL SYNC FUNCTION
window.updateUniversalSearchHistory = async function (newFullHistory) {
    // 1. Update Local Storage
    localStorage.setItem('offszn_search_history', JSON.stringify(newFullHistory));

    // 2. Update Navbar Internal State
    if (window.NavbarState) {
        window.NavbarState.search.history = newFullHistory.slice(0, 5);
        // Refresh UI instantly
        renderHistoryAndTrends();
    }

    // 3. Dispatch Event for other pages (like history.html)
    window.dispatchEvent(new CustomEvent('offszn-history-changed', {
        detail: { history: newFullHistory }
    }));

    // 4. 🔥 Sync to Supabase if Logged In
    if (typeof window.supabaseClient !== 'undefined') {
        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session?.user) {
                // Confirming table name is 'profiles' as per user screenshot
                await window.supabaseClient
                    .from('profiles')
                    .update({ search_history: newFullHistory })
                    .eq('id', session.user.id);
            }
        } catch (err) {
            console.warn("History Sync Failed:", err);
        }
    }
};

// 🔄 CROSS-TAB SYNC: Listen for storage changes from other tabs
window.addEventListener('storage', (e) => {
    if (e.key === 'offszn_search_history' && e.newValue) {
        const newHistory = JSON.parse(e.newValue);
        // Update local state and UI silently
        if (window.NavbarState) {
            window.NavbarState.search.history = newHistory.slice(0, 5);
            if (typeof renderHistoryAndTrends === 'function') {
                renderHistoryAndTrends();
            }
        }
        // Notify local history page if present
        window.dispatchEvent(new CustomEvent('offszn-history-changed', {
            detail: { history: newHistory }
        }));
    }
});

function addTag(term) {
    if (!NavbarState.search.activeTags.includes(term)) {
        NavbarState.search.activeTags.push(term);
        renderTags();
    }
}

window.removeTag = function (term) {
    NavbarState.search.activeTags = NavbarState.search.activeTags.filter(t => t !== term);
    renderTags();
}

function renderTags() {
    const tagsContainer = getEl('active-search-tags');
    const trendPanel = getEl('search-trending-panel');
    if (!tagsContainer) return;

    tagsContainer.innerHTML = NavbarState.search.activeTags.map(tag => `
        <div class="search-tag-chip">
            <span>${tag}</span>
            <i class="bi bi-x" onclick="removeTag('${tag}')"></i>
        </div>`).join('');

    if (trendPanel) {
        trendPanel.style.marginTop = NavbarState.search.activeTags.length > 0 ? '42px' : '12px';
    }
}

// ==================== AUTH & CURRENCY ==================== //

async function initAuth() {
    // Safeguard: Ensure AuthUtils is loaded
    if (!window.AuthUtils) {
        console.error("❌ CRITICAL: AuthUtils not loaded. Authentication headers missing.");
        return;
    }
    if (typeof window.supabaseClient === 'undefined') return;

    const { data } = await window.supabaseClient.auth.getSession();

    // 🔒 ONBOARDING GUARD: Check if user has a nickname (profile complete)
    // 🛡️ REFINEMENT: Only trigger for CONFIRMED users. Guests waiting for email shouldn't be redirected.
    if (data.session && data.session.user && data.session.user.email_confirmed_at) {
        // Skip if we are already on welcome page (Supports both .html and clean URLs)
        const isWelcomePage = window.location.pathname.startsWith('/pages/welcome');
        if (!isWelcomePage) {
            try {
                const { data: profile, error: profileError } = await window.supabaseClient
                    .from('users')
                    .select('nickname')
                    .eq('id', data.session.user.id)
                    .single();

                // 🛡️ ROBUST CHECK: Only redirect if we are SURE nickname is missing
                // profileError.code 'PGRST116' means no rows found (new user)
                if (profileError) {
                    if (profileError.code === 'PGRST116') {
                        console.log("🚦 Usuario nuevo detectado (sin perfil). Redirigiendo a Onboarding...");
                        window.location.replace('/pages/welcome.html');
                        return;
                    } else {
                        console.warn("⚠️ Error consultando perfil en Navbar:", profileError.message);
                        // Transient error - don't redirect verified users to onboarding by mistake
                    }
                } else if (!profile || !profile.nickname) {
                    console.log("🚦 Usuario incompleto detectado. Redirigiendo a Onboarding...");
                    window.location.replace('/pages/welcome.html');
                    return;
                }
            } catch (err) {
                console.error("❌ Fallo crítico en Onboarding Guard:", err);
            }
        }
    }

    // Self-healing: If no Supabase session but we have a token (zombie state), clear it.
    if (!data.session && localStorage.getItem('authToken')) {
        console.warn("Found stale authToken with no active session. Clearing it.");
        localStorage.removeItem('authToken');
    }

    updateAuthUI(data.session);

    // Initial Notification Sync
    if (data.session?.user && window.NotificationsManager) {
        window.NotificationsManager.setUser(data.session.user);
    }

    // 🚀 STABILITY FIX: Signal that session check is done
    window.dispatchEvent(new CustomEvent('offszn-session-ready', {
        detail: { session: data.session, user: data.session?.user }
    }));

    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session?.user) {
                syncSearchHistory(session.user);
                // Notifications Sync
                if (window.NotificationsManager) {
                    window.NotificationsManager.setUser(session.user);
                }
            }
        }
        if (event === 'SIGNED_OUT') {
            // 🚀 STABILITY FIX: Only redirect if on a protected page
            const protectedPrefixes = ['/cuenta/', '/mensajes.html', '/favoritos.html', '/carrito.html', '/notificaciones.html'];
            const isProtected = protectedPrefixes.some(p => window.location.pathname.includes(p));

            if (isProtected) {
                window.location.href = '/explorar.html';
            } else {
                console.log("Navbar: User signed out on public page. Updating UI only.");
            }

            // Notifications Clear
            if (window.NotificationsManager) {
                window.NotificationsManager.setUser(null);
            }
        }
        updateAuthUI(session);

        // 🚀 STABILITY FIX: Signal update/refresh
        window.dispatchEvent(new CustomEvent('offszn-session-ready', {
            detail: { session: session, user: session?.user }
        }));
    });
}

async function updateAuthUI(session) {
    const authSection = getEl('nav-auth-section');
    const guestSection = getEl('nav-guest-section');

    if (session) {
        // --- GLOBAL STATE FOR OTHER SCRIPTS ---
        window.currentUserId = session.user.id;
        window.currentUserData = { ...session.user.user_metadata, email: session.user.email };

        if (authSection) authSection.style.display = 'flex';
        if (guestSection) guestSection.style.display = 'none';

        // --- MOBILE SYNC ---
        const mobileAuth = getEl('mobile-auth-actions');
        const mobileGuest = getEl('mobile-guest-actions');
        if (mobileAuth) mobileAuth.style.display = 'flex';
        if (mobileGuest) mobileGuest.style.display = 'none';

        // 🚀 NEW: Hide promo banner for logged-in users
        const promoBanner = document.querySelector('.promo-banner');
        if (promoBanner) promoBanner.style.display = 'none';

        // 1. TRY CACHE FIRST (Instant Load)
        const cachedNick = localStorage.getItem('offszn_cached_nickname');
        const cachedAvatar = localStorage.getItem('offszn_cached_avatar');

        let displayName = cachedNick || session.user.email.split('@')[0];
        let displayLetter = displayName.charAt(0).toUpperCase();
        let avatarUrl = cachedAvatar || null;

        // Apply Cached/Default State Immediately
        window.currentUserNickname = displayName;
        updateUserVisuals(displayName, displayLetter, avatarUrl);

        // 🚀 NEW: Check for external avatars and internalize them
        if (window.AvatarManager && window.AvatarManager.maybeInternalize) {
            window.AvatarManager.maybeInternalize(session);
        }

        // 2. FETCH FRESH DATA (Background)
        if (typeof window.supabaseClient !== 'undefined') {
            try {
                // Fetch fundamental details
                const [{ data: userProfile }, { data: profileExtra }] = await Promise.all([
                    window.supabaseClient.from('users').select('nickname, avatar_url, reward_balance, preferred_currency').eq('id', session.user.id).single(),
                    window.supabaseClient.from('profiles').select('plan').eq('id', session.user.id).single()
                ]);

                if (userProfile || profileExtra) {
                    let needsUpdate = false;

                    if (userProfile?.nickname && userProfile.nickname !== cachedNick) {
                        displayName = userProfile.nickname;
                        window.currentUserNickname = displayName;
                        displayLetter = displayName.charAt(0).toUpperCase();
                        localStorage.setItem('offszn_cached_nickname', userProfile.nickname);
                        needsUpdate = true;
                    }

                    if (userProfile?.avatar_url && userProfile.avatar_url !== cachedAvatar) {
                        avatarUrl = userProfile.avatar_url;
                        localStorage.setItem('offszn_cached_avatar', userProfile.avatar_url);
                        needsUpdate = true;
                    }

                    const plan = profileExtra?.plan || 'free';
                    const rewardBalance = userProfile?.reward_balance || 0;

                    // Repaint with fresh data
                    updateUserVisuals(displayName, displayLetter, avatarUrl, plan, rewardBalance);

                    // --- CURRENCY SYNC (DB -> Local) ---
                    if (userProfile?.preferred_currency && window.CurrencyManager) {
                        const currentLocal = window.CurrencyManager.getCurrency();
                        if (currentLocal !== userProfile.preferred_currency) {
                            if (window.OFFSZN_DEBUG) console.log(`[Navbar] Syncing currency from DB: ${userProfile.preferred_currency}`);
                            localStorage.setItem('OFFSZN_CURRENCY', userProfile.preferred_currency);
                            // Avoid reload loop by checking if we actually changed it
                            // but usually initial load is fine.
                            const el = getEl('current-currency');
                            if (el) el.innerText = userProfile.preferred_currency;
                        }
                    }

                    // Dynamic Profile Link
                    const dropdownHeader = document.querySelector('.user-dropdown-header');
                    if (dropdownHeader) {
                        dropdownHeader.onclick = () => window.location.href = `/@${displayName}`;
                    }
                }
            } catch (err) {
                console.warn("Navbar: Could not fetch profile data", err);
            }
        }
    } else {
        if (authSection) authSection.style.display = 'none';
        if (guestSection) guestSection.style.display = 'flex';

        // --- MOBILE SYNC ---
        const mobileAuth = getEl('mobile-auth-actions');
        const mobileGuest = getEl('mobile-guest-actions');
        if (mobileAuth) mobileAuth.style.display = 'none';
        if (mobileGuest) mobileGuest.style.display = 'flex';

        // 🚀 NEW: Show promo banner for guest users
        const promoBanner = document.querySelector('.promo-banner');
        if (promoBanner) promoBanner.style.display = 'flex';

        // Clear cache on logout/no-session
        window.currentUserId = null;
        window.currentUserData = null;
        localStorage.removeItem('offszn_cached_nickname');
        localStorage.removeItem('offszn_cached_avatar');
    }
}

// Helper to update DOM elements
function updateUserVisuals(displayName, displayLetter, avatarUrl, plan = 'free', rewardBalance = 0) {
    const avatarEl = getEl('user-avatar-display');
    const dropdownAvatarEl = document.querySelector('.user-dropdown-avatar-lg');
    const dropdownNameEl = getEl('dropdown-username');
    const userNameDisplayEl = getEl('user-name-display');

    // New Plan Elements
    const planBtn = getEl('nav-user-plan-btn');
    const balanceEl = getEl('dropdown-reward-balance');
    const mobilePlanTag = getEl('mobile-plan-tag');
    const mobilePlanTitle = getEl('mobile-plan-title');

    // 1. Navbar Avatar (Small)
    if (avatarEl) {
        if (avatarUrl) {
            // Prevent flickering by checking if src is already correct
            const currentImg = avatarEl.querySelector('img');
            if (!currentImg || currentImg.src !== avatarUrl) {
                avatarEl.innerHTML = `<img src="${avatarUrl}" alt="${displayName}" onerror="if(window.AvatarManager) window.AvatarManager.handleError(this, '${displayName.replace(/'/g, "\\'")}')">`;
                avatarEl.classList.add('user-avatar-placeholder');
            }
        } else {
            avatarEl.innerText = displayLetter;
            avatarEl.classList.add('user-avatar-placeholder');
        }
    }

    // 2. Dropdown Avatar (Large)
    if (dropdownAvatarEl) {
        if (avatarUrl) {
            const currentImg = dropdownAvatarEl.querySelector('img');
            if (!currentImg || currentImg.src !== avatarUrl) {
                dropdownAvatarEl.innerHTML = `<img src="${avatarUrl}" alt="${displayName}" onerror="if(window.AvatarManager) window.AvatarManager.handleError(this, '${displayName.replace(/'/g, "\\'")}')">`;
            }
        } else {
            dropdownAvatarEl.innerText = displayLetter;
        }
    }

    // 3. Mobile Avatar
    const mobileBtn = document.getElementById('mobile-avatar-btn');
    const mobileAvatarInit = document.getElementById('mobile-avatar-initial');
    if (mobileBtn) {
        if (avatarUrl) {
            mobileBtn.innerHTML = `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else if (mobileAvatarInit) {
            mobileBtn.innerHTML = `<span id="mobile-avatar-initial">${displayLetter}</span>`;
        }
    }

    if (dropdownNameEl) dropdownNameEl.innerText = displayName;
    if (userNameDisplayEl) userNameDisplayEl.innerText = displayName;

    // 4. Plan & Balance Update
    if (balanceEl) balanceEl.innerText = `${rewardBalance} Créditos`;

    if (plan && plan !== 'free') {
        const planUpper = plan.toUpperCase();
        if (planBtn) {
            planBtn.innerHTML = `<i class="bi bi-star-fill"></i> PLAN ${planUpper}`;
            planBtn.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';
            planBtn.style.color = '#fff';
            planBtn.style.border = 'none';
            planBtn.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
        }
        if (mobilePlanTag) mobilePlanTag.innerText = `OFFSZN ${planUpper}`;
        if (mobilePlanTitle) mobilePlanTitle.innerText = 'Tu Plan Actual';
    } else {
        if (planBtn) {
            planBtn.innerHTML = `<i class="bi bi-plus-circle-fill"></i> Suscribirse`;
            planBtn.style.background = '';
            planBtn.style.color = '';
            planBtn.style.border = '';
            planBtn.style.boxShadow = '';
        }
        if (mobilePlanTag) mobilePlanTag.innerText = 'OFFSZN PRO';
        if (mobilePlanTitle) mobilePlanTitle.innerText = 'Mejorar Plan';
    }
}



window.handleLogout = async function (e) {
    if (e) e.preventDefault();
    if (typeof supabaseClient !== 'undefined') {
        await supabaseClient.auth.signOut();
        localStorage.removeItem('authToken'); // Explicitly clear token
        window.location.href = '/explorar'; // Redirect to ensure state refresh
    }
}


// --- Currency Helpers ---
window.toggleCurrency = function (e) {
    e.stopPropagation();
    handleSmartToggle('currency', null);
}

window.setCurrency = function (curr) {
    const el = getEl('current-currency');
    if (el) el.innerText = curr;

    // Close menu manually or via helper
    const cMenu = getEl('currency-menu');
    if (cMenu) cMenu.classList.remove('active');
    const cBtn = getEl('currency-toggle-btn');
    if (cBtn) cBtn.classList.remove('active-currency');

    highlightCurrencyItem(curr);

    // Use CurrencyManager if available (handles localStorage + event dispatch)
    if (window.CurrencyManager) {
        window.CurrencyManager.setCurrency(curr);
    } else {
        localStorage.setItem('OFFSZN_CURRENCY', curr);
    }

    // Sync to DB if logged in
    if (window.AuthUtils && window.AuthUtils.syncCurrencyPreference) {
        window.AuthUtils.syncCurrencyPreference(curr);
    }

    // Reload page to refresh all prices — EXCEPT checkout/cart (don't disrupt payment)
    const path = window.location.pathname.toLowerCase();
    const skipReload = ['/checkout', '/venta', '/cart', '/cuenta/ventas'];
    const shouldSkip = skipReload.some(p => path.includes(p));
    if (!shouldSkip) {
        window.location.reload();
    } else {
        // On checkout pages, just re-render search results if open
        if (NavbarState.search.lastResults && NavbarState.search.lastResults.length > 0) {
            renderActualResults(NavbarState.search.lastResults);
        }
    }
}

function highlightCurrencyItem(curr) {
    document.querySelectorAll('.currency-item').forEach(el => el.classList.remove('selected'));
    const all = Array.from(document.querySelectorAll('.currency-item'));
    const match = all.find(el => el.innerText.trim() === curr);
    if (match) match.classList.add('selected');
}


// ==================== GLOBAL EXPORTS & INIT ==================== //

// Expose Smart Toggles to Global Scope for Onclick
window.toggleDropdown = (el) => handleSmartToggle('navbar', el.closest('.dropdown-parent'));
window.toggleUserDropdown = (e) => { e.stopPropagation(); handleSmartToggle('user', document.querySelector('.user-dropdown')); };
window.toggleNotificationDropdown = (e) => { e.stopPropagation(); handleSmartToggle('notif', document.querySelector('.notification-dropdown')); };
window.toggleSearchFilter = (e) => { e.stopPropagation(); handleSmartToggle('filter', null); };
window.selectSearchFilter = function (label) {
    // Logic specific to search filter selection
    window.event.stopPropagation();
    NavbarState.search.currentCategory = label;
    const lbl = getEl('search-filter-label');
    if (lbl) lbl.innerText = label;

    const trigger = document.querySelector('.search-filter-trigger');
    if (trigger) {
        label !== 'Todo' ? trigger.classList.add('active-filter') : trigger.classList.remove('active-filter');
    }

    // FIX: Update visual selection in dropdown
    document.querySelectorAll('.search-filter-item').forEach(item => {
        item.classList.remove('selected');
        if (item.innerText.trim() === label) item.classList.add('selected');
    });

    document.querySelector('#search-filter-dropdown').style.display = 'none'; // Close self

    // Re-trigger search focus or input?
    getEl('navbarSearchInput')?.dispatchEvent(new Event('input'));
};

// Helper for clicking results (Ensures save completes before redirect)
window.handleResultClick = async function (url, itemDataString) {
    try {
        if (itemDataString) {
            // Support both raw JSON and URI-encoded JSON (backward compat)
            let parsed;
            try {
                parsed = JSON.parse(itemDataString);
            } catch (_) {
                parsed = JSON.parse(decodeURIComponent(itemDataString));
            }
            const item = parsed;
            let termObj = { type: 'text', term: item.title };

            if (item.type === 'user') {
                termObj = { type: 'user', term: item.title, subtitle: 'Producer', img: item.img };
            } else {
                termObj = {
                    type: item.product_type || item.type,
                    term: item.title,
                    subtitle: item.producer || item.price,
                    img: item.img,
                    id: item.id,
                    public_slug: item.public_slug,
                    product_type: item.product_type || item.type
                };
            }
            await window.saveToHistory(termObj);
        }
    } catch (e) {
        console.warn("History save failed or format error, proceeding:", e);
    }

    if (NavbarState.search.debounceTimer) clearTimeout(NavbarState.search.debounceTimer);
    window.location.href = url;
};

window.toggleCartPanel = (e) => {
    e.preventDefault(); e.stopPropagation();
    handleSmartToggle('cart', null);
};
window.closeAllOverlays = () => closeAllUI();


// --- HISTORY PERSISTENCE & SYNC ---

// 1. Sync Guest History to User Profile (Call on Login)
async function syncSearchHistory(user) {
    if (!user) return;

    // A. Get Local (Guest) History
    const localHistory = JSON.parse(localStorage.getItem('offszn_search_history')) || [];

    // B. Get Remote (Profile) History
    // Assuming 'metadata' JSONB column or similar. If not, we might need to create it.
    // For now, let's assume we just store it in local storage keyed by user ID to avoid schema changes if not ready.
    // BETTER APPROACH requested by user: "Merge them".

    // Let's use a composite key for authenticated users in localStorage if DB isn't ready, 
    // BUT the prompt implies true persistence. 
    // Let's try to update the 'profiles' table if we can, otherwise fallback to "User-Specific LocalStorage".

    // Fallback/Simpler plan for now (as per "local para no logeado y supabase logeados"):
    // We will try to fetch from Supabase.

    try {
        const { data: profiles, error } = await supabaseClient
            .from('profiles')
            .select('search_history')
            .eq('id', user.id);

        if (error) {
            // Gracefully handle missing column "search_history" (42703)
            if (error.code === '42703') {
                console.warn("Search Persistence: 'search_history' column missing. Sync disabled.");
                return;
            }
            console.error("Error fetching remote history:", error);
        }

        let remoteHistory = (profiles && profiles.length > 0 && profiles[0].search_history)
            ? profiles[0].search_history
            : [];

        // Normalize legacy string items to objects for deduplication
        const normalize = (val) => typeof val === 'string' ? { type: 'text', term: val } : val;

        const localNormalized = localHistory.map(normalize);
        const remoteNormalized = remoteHistory.map(normalize);

        // Deduplicate using 'term' as unique key (case insensitive)
        const mergedMap = new Map();
        [...remoteNormalized, ...localNormalized].forEach(item => {
            if (item && item.term) {
                mergedMap.set(item.term.toLowerCase().trim(), item); // Local overrides remote due to order
            }
        });

        const mergedArray = Array.from(mergedMap.values()).slice(0, 50); // Limit to 50 for full history

        // D. Save Back to Profile
        const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ search_history: mergedArray })
            .eq('id', user.id);

        if (!updateError) {
            // E. Clear Guest LocalStorage (optional, but good cleanup) or keep it synced?
            // "seguira sus 3 busquedas recientes" -> Update local state to match merged
            NavbarState.search.history = mergedArray.slice(0, 5); // UI only shows 5
            localStorage.setItem('offszn_search_history', JSON.stringify(mergedArray)); // Keep local synced for performance
        }

    } catch (err) {
        console.warn("Sync history failed, using local only", err);
    }
}


// --- INIT ---
window.initNavbarUI = async function () {
    // Prevent double init if called both by DOMContentLoaded and fetch loader
    if (window._navbarInitialized) return;
    window._navbarInitialized = true;

    // Restore Currency
    const savedCurr = (window.CurrencyManager ? window.CurrencyManager.getCurrency() : localStorage.getItem('OFFSZN_CURRENCY')) || 'USD';
    const currEl = getEl('current-currency');
    if (currEl) currEl.innerText = savedCurr;

    // Start Subsystems
    initSearch();
    await initAuth(); // Wait for auth to check user

    // Click Outside Listener (Global)
    document.addEventListener('click', function (e) {
        const isInside = e.target.closest('.dropdown-parent') ||
            e.target.closest('.user-dropdown') ||
            e.target.closest('.notification-dropdown') ||
            e.target.closest('.currency-dropdown') ||
            e.target.closest('.search-filter-container') ||
            e.target.closest('#search-filter-dropdown') ||
            e.target.closest('.search-filter-trigger') ||
            e.target.closest('.navbar-icon-button') ||
            e.target.closest('.side-panel') ||
            e.target.closest('.navbar-search') ||
            e.target.closest('.mobile-search-wrapper') ||
            e.target.closest('#search-trending-panel');

        if (!isInside) {
            closeAllUI();
        }
    });

    // 🛡️ AUTH PROTECTION: Intercept clicks on sensitive links for Guests
    document.addEventListener('click', function (e) {
        const protectedLink = e.target.closest('.auth-protected');
        if (protectedLink && !window.currentUserId) {
            e.preventDefault();
            console.log("🚦 Protected link clicked as Guest. Redirecting to Register...");
            window.location.href = '/pages/register.html';
        }
    });

    // Logout Button Listener
    const logoutBtn = getEl('navbar-logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', window.handleLogout);

    // Global Avatar Tooltip (Ensure all user-triggers have the "Perfil" label)
    document.querySelectorAll('.user-trigger').forEach(el => {
        if (!el.hasAttribute('data-label')) {
            el.setAttribute('data-label', 'Perfil');
        }
    });

    // Initialize Mobile Menu
    setupMobileMenu();
};

document.addEventListener('DOMContentLoaded', () => {
    // If the navbar is hardcoded in the HTML, init immediately
    if (document.querySelector('.navbar')) {
        window.initNavbarUI();
    }
});

// If the navbar is dynamically loaded by load-navbar.js
window.addEventListener('offszn-navbar-loaded', () => {
    window.initNavbarUI();
});

/* ==================== MOBILE MENU LOGIC (NEW) ==================== */
function setupMobileMenu() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navContainer = document.getElementById('nav-container');

    if (hamburgerBtn && navContainer) {
        // Create Backdrop if not exists
        let backdrop = document.querySelector('.mobile-menu-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'mobile-menu-backdrop';
            document.body.appendChild(backdrop);
        }

        let savedScrollY = 0;

        const lockScroll = () => {
            savedScrollY = window.scrollY;
            const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

            document.documentElement.style.setProperty('--scrollbar-width', `${scrollBarWidth}px`);

            // Only apply overflow:hidden to body to prevent double-scrollbar or double-offset issues
            // that cause the navbar (fixed/sticky) to jump on some mobile browsers.
            document.body.classList.add('menu-open');
        };

        const unlockScroll = () => {
            document.body.classList.remove('menu-open');
            document.documentElement.style.removeProperty('--scrollbar-width');
        };

        const toggleMenu = (e) => {
            if (e) e.stopPropagation();
            navContainer.classList.toggle('active');
            backdrop.classList.toggle('active');

            if (navContainer.classList.contains('active')) {
                lockScroll();
            } else {
                unlockScroll();
            }
        };

        const closeMenu = () => {
            navContainer.classList.remove('active');
            backdrop.classList.remove('active');
            unlockScroll();
        };

        // Expose closeMenu globally so it can be called from toggleCartPanel
        window.closeMobileMenu = closeMenu;

        // Toggle
        hamburgerBtn.addEventListener('click', toggleMenu);

        // Close on Backdrop
        backdrop.addEventListener('click', closeMenu);

        // Close on sidebar close button
        const sidebarCloseBtn = navContainer.querySelector('.sidebar-close-btn');
        if (sidebarCloseBtn) {
            sidebarCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeMenu();
            });
        }

        // Close on Link Click (except toggles)
        navContainer.querySelectorAll('a').forEach(link => {
            // If it's a toggle link (like 'Recursos'), let it toggle the submenu
            if (!link.classList.contains('nav-toggle-link') && !link.classList.contains('search-filter-trigger')) {
                link.addEventListener('click', closeMenu);
            }
        });
    }
}


// ==================== MOBILE MENU ACTIONS ==================== //
window.openSubmenu = function (menuId) {
    const slider = document.getElementById('mobile-menu-slides');

    // Hide all submenus first
    document.querySelectorAll('.submenu-content').forEach(el => el.style.display = 'none');

    // Show the specific submenu
    const targetSub = document.getElementById('submenu-' + menuId);
    if (targetSub) {
        targetSub.style.display = 'block';
    }

    if (slider) {
        slider.style.transform = 'translateX(-50%)'; // Slide to View 2
    }
};

window.closeSubmenu = function (e) {
    if (e && e.stopPropagation) e.stopPropagation();
    console.log('[DEBUG] closeSubmenu called');
    const slider = document.getElementById('mobile-menu-slides');
    if (slider) {
        console.log('[DEBUG] slider found, applying translateX(0%)');
        slider.style.transform = 'translateX(0%)'; // Back to View 1
    } else {
        console.error('[DEBUG] slider NOT found');
    }
};

// Also export to global for inline onclick
window.syncMobileCartBadge = function (count) {
    const mobileBadge = document.getElementById('mobile-cart-badge');
    if (mobileBadge) {
        mobileBadge.textContent = count;
        mobileBadge.style.display = count > 0 ? 'flex' : 'none';
    }
};
