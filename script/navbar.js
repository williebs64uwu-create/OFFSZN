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
        history: (JSON.parse(localStorage.getItem('offszn_search_history')) || ['Dark Piano', 'Tainy Drums']).slice(0, 5),
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

function initSearch() {
    const searchInput = getEl('navbarSearchInput');
    const searchContainer = document.querySelector('.navbar-search');
    const trendPanel = getEl('search-trending-panel');
    const searchOverlay = getEl('search-overlay');

    if (!searchInput || !trendPanel) return; // Search not present on this page

    // Disable browser autocomplete
    searchInput.setAttribute('autocomplete', 'off');

    // Event Listeners
    searchContainer.addEventListener('mouseenter', () => NavbarState.search.isHovering = true);
    searchContainer.addEventListener('mouseleave', () => NavbarState.search.isHovering = false);

    searchInput.addEventListener('focus', () => {
        closeAllUI(true); // Close everything ELSE
        openSearchUI();
        const val = searchInput.value.trim();
        if (val.length === 0) {
            renderHistoryAndTrends();
        } else {
            // Re-run search to ensure currency updates and results appear
            performSearch(val, NavbarState.search.currentCategory);
        }
    });

    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (!NavbarState.search.isHovering && document.activeElement !== searchInput) {
                closeSearchUI();
            }
        }, 250);
    });

    if (searchOverlay) searchOverlay.addEventListener('click', closeSearchUI);

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(NavbarState.search.debounceTimer);

        if (query.length > 0) {
            openSearchUI();
            NavbarState.search.debounceTimer = setTimeout(() => {
                performSearch(query, NavbarState.search.currentCategory);
            }, 300);
        } else {
            renderHistoryAndTrends();
        }
    });

    // Keyboard Nav
    searchInput.addEventListener('keydown', (e) => {
        const items = trendPanel.querySelectorAll('.search-result-item, .recent-item, .trend-tag'); // Selectable items
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
                // Save history immediately
                if (val) saveToHistory(val);
                console.log("Searching for:", val);
                // Redirect to Explore page with query
                window.location.href = 'explorar.html?q=' + encodeURIComponent(val) + '&type=' + encodeURIComponent(NavbarState.search.currentCategory);
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

async function performSearch(query, category) {
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
        // Supabase Search Logic
        if (typeof window.supabaseClient !== 'undefined') {
            // PRO SEARCH: Search in Name OR Description
            // Note: .or() requires the column filters to be inside parentheses
            let productsQuery = window.supabaseClient
                .from('products')
                .select('id, name, price_basic, image_url, product_type, producer_id, description')
                .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
                .limit(3); // Limited to 3 as requested

            if (category && category !== 'Todo') {
                // 2. Filtrar por Tipo y Categoría (si aplica)
                const filterMap = {
                    'Beats': { type: 'beat' },
                    'Drum Kits': { type: 'drumkit' },
                    'Samples': { type: 'loopkit' },
                    'Presets': { type: 'preset' },
                    'Plantillas': { type: 'preset', category: 'Plantilla' },
                    'Voces': { type: 'preset', category: 'Preset_de_voces' },
                    'Plugins': { type: 'preset', category: 'plugin_vst' },
                    'Instrumentos': { type: 'preset', category: 'instrumento' }
                };

                if (filterMap[category]) {
                    const filter = filterMap[category];
                    if (filter.type) {
                        productsQuery = productsQuery.eq('product_type', filter.type);
                    }
                    if (filter.category) {
                        productsQuery = productsQuery.eq('category', filter.category);
                    }
                }
            }
            // VISIBILITY FILTER: Only show public AND published products (Strict)
            productsQuery = productsQuery
                .eq('visibility', 'public')
                .neq('status', 'draft') // Explicitly exclude drafts
                .order('created_at', { ascending: false }); // Newest first

            // USERS SEARCH: Run if 'Todo' OR explicitly 'Productores'
            let usersQuery = null;
            if (category === 'Todo' || category === 'Productores') {
                usersQuery = window.supabaseClient
                    .from('users')
                    .select('nickname, avatar_url')
                    .ilike('nickname', `%${query}%`)
                    .limit(3);
            }

            // FILTER PRODUCTS: If 'Productores', don't search products
            if (category === 'Productores') {
                productsQuery = Promise.resolve({ data: [] });
            }

            // Execute Queries Parallel
            const promises = [productsQuery];
            if (usersQuery) promises.push(usersQuery);

            const results = await Promise.all(promises);
            const pRes = results[0];
            const uRes = usersQuery ? results[1] : { data: [] };

            // RACE CONDITION FIX: If user cleared input while waiting, discard results
            if (getEl('navbarSearchInput').value.trim() === '') return;

            // --- FALLBACK: IF NO RESULTS MATCH, FETCH TOP 3 ---
            if ((!pRes.data || pRes.data.length === 0) && (!uRes.data || uRes.data.length === 0)) {
                const { data: popular } = await window.supabaseClient
                    .from('products')
                    .select('id, name, price_basic, image_url, product_type, producer_id')
                    .eq('visibility', 'public')
                    .neq('status', 'draft')
                    .order('plays_count', { ascending: false })
                    .limit(3);

                if (popular && popular.length > 0) {
                    pRes.data = popular.map(item => ({ ...item, isFallback: true }));
                }
            }

            if (pRes.data && pRes.data.length > 0) {
                // Fetch Profiles manually to avoid join errors
                const producerIds = [...new Set(pRes.data.map(p => p.producer_id).filter(id => id))];
                let profileMap = {};

                if (producerIds.length > 0) {
                    // Fetch specifically from 'users' table for 'nickname'
                    const { data: users } = await window.supabaseClient
                        .from('users')
                        .select('id, nickname')
                        .in('id', producerIds);

                    if (users) {
                        users.forEach(u => {
                            profileMap[u.id] = u.nickname || 'OFFSZN';
                        });
                    }
                }

                realResults = [...realResults, ...pRes.data.map(p => {
                    return {
                        type: p.product_type === 'beat' ? 'beat' : 'kit', // Added type for icon logic
                        id: p.id,
                        title: p.name || 'Untitled', // Renamed name to title
                        producer: profileMap[p.producer_id] || 'OFFSZN',
                        price: p.price_basic ? `$${p.price_basic}` : 'Free',
                        img: p.image_url,
                        isFallback: p.isFallback || false
                    };
                })];
            }

            // --- COMBINE AND PRIORITIZE ---
            // 1. Products are already in realResults (up to 3)
            // 2. If we have less than 3 items, fill with users
            if (uRes && uRes.data && realResults.length < 3) {
                const remainingSlots = 3 - realResults.length;
                const userItems = uRes.data.slice(0, remainingSlots).map(u => ({
                    type: 'user',
                    title: u.nickname || 'OFFSZN',
                    stats: 'Producer',
                    img: u.avatar_url
                }));
                realResults = [...realResults, ...userItems];
            }

            // Final safety slice to exactly 3
            realResults = realResults.slice(0, 3);
        }
        NavbarState.search.lastResults = realResults; // Cache for instant currency
        renderActualResults(realResults);
    } catch (err) {
        console.error("Search Error", err);
        renderActualResults([]);
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

    let html = '';
    if (hasFallback) {
        html += `<div style="padding:4px 10px 8px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.7rem; color: #555; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Tal vez te interese:</div>`;
    }
    results.forEach(item => {
        // CURRENCY LOGIC
        let displayPrice = item.price;
        const userCurrency = localStorage.getItem('userCurrency') || 'USD';
        // FIX: Check if price exists before trying to replace (Users don't have price)
        if (userCurrency === 'PEN' && item.price && item.price !== 'Free') {
            const numPrice = parseFloat(item.price.replace('$', ''));
            if (!isNaN(numPrice)) {
                displayPrice = `S/${(numPrice * 3.8).toFixed(2)}`;
            }
        }

        // IMAGE LOGIC: Prefer image_url, fallback to icon
        let imgHtml = '';
        if (item.img) {
            imgHtml = `<img src="${item.img}" style="width:36px; height:36px; border-radius:6px; object-fit:cover;" alt="${item.title}" onerror="if(window.AvatarManager) window.AvatarManager.handleError(this, '${item.title.replace(/'/g, "\\'")}')">`;
        } else {
            let icon = item.type === 'user' ? 'person-circle' : (item.type === 'kit' ? 'box-seam' : 'music-note-beamed');
            imgHtml = `<div class="result-img" style="display:flex;align-items:center;justify-content:center;color:#666; background:rgba(255,255,255,0.05); border-radius:50%; width:36px; height:36px;"><i class="bi bi-${icon}"></i></div>`;
        }

        // CLICK ACTION
        let targetUrl = item.type === 'user' ?
            `/@${encodeURIComponent(item.title)}` :
            (window.createSeoLink ? window.createSeoLink(item) : `/producto.html?id=${item.id}`);

        html += `
            <div class="search-result-item" onclick="handleResultClick('${targetUrl}', '${item.title.replace(/'/g, "\\'")}')">
                ${imgHtml}
                <div class="result-info">
                    <div class="result-title">${item.title}</div>
                    <div class="result-meta">${item.producer || item.stats || item.price || ''}</div>
                </div>
                ${item.price ? `<div style="font-size:0.8rem; color:#8b5cf6; font-weight:600;">${displayPrice}</div>` : ''}
            </div>`;
    });
    trendPanel.innerHTML = html;
}

function renderHistoryAndTrends() {
    const trendPanel = getEl('search-trending-panel');
    if (!trendPanel) return;

    const historyHtml = NavbarState.search.history.map(term =>
        `<div class="recent-item" onclick="setSearch('${term}')">
            <i class="bi bi-clock-history"></i> 
            <span style="flex:1;">${term}</span>
            <i class="bi bi-x history-delete-btn" onclick="deleteHistoryItem('${term}', event)" title="Eliminar"></i>
         </div>`
    ).join('');

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
            <span class="trend-tag" onclick="setSearch('Dark Trap')"><i class="bi bi-graph-up-arrow"></i> Dark Trap</span>
            <span class="trend-tag" onclick="setSearch('Reggaeton 2025')"><i class="bi bi-fire"></i> Reggaeton 2025</span>
            <span class="trend-tag" onclick="setSearch('Drill UK')">Drill UK</span>
        </div>`;
}

// Global functions for HTML onclick attributes
window.setSearch = function (text) {
    const searchInput = getEl('navbarSearchInput');
    if (searchInput) {
        searchInput.value = text;
        saveToHistory(text);
        // addTag(text); // REMOVED: No distinct visual tags wanted
        searchInput.dispatchEvent(new Event('input'));
    }
}

window.deleteHistoryItem = async function (term, e) {
    if (e) e.stopPropagation();
    console.log("🗑️ Deleting history item:", term);

    const lowerTerm = term.toLowerCase().trim();
    const fullHistory = JSON.parse(localStorage.getItem('offszn_search_history')) || [];

    // Case-insensitive filtering
    const updatedFullHistory = fullHistory.filter(t => t.toLowerCase().trim() !== lowerTerm);

    // Use Universal Sync
    await window.updateUniversalSearchHistory(updatedFullHistory);
}

async function saveToHistory(term) {
    const lowerTerm = term.toLowerCase().trim();
    let fullHistory = JSON.parse(localStorage.getItem('offszn_search_history')) || [];

    // Remove if exists
    fullHistory = fullHistory.filter(t => t.toLowerCase().trim() !== lowerTerm);

    // Add to front
    fullHistory.unshift(term);

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
    if (data.session && data.session.user) {
        // Skip if we are already on welcome page
        if (!window.location.pathname.includes('/pages/welcome.html')) {
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
                window.location.href = '/';
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
    const avatarEl = getEl('user-avatar-display');
    const dropdownNameEl = getEl('dropdown-username');
    const userNameDisplayEl = getEl('user-name-display');
    const dropdownAvatarEl = document.querySelector('.user-dropdown-avatar-lg');

    if (session) {
        // --- GLOBAL STATE FOR OTHER SCRIPTS ---
        window.currentUserId = session.user.id;
        window.currentUserData = { ...session.user.user_metadata, email: session.user.email };

        if (authSection) authSection.style.display = 'flex';
        if (guestSection) guestSection.style.display = 'none';

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
                const { data: profile } = await window.supabaseClient
                    .from('users')
                    .select('nickname, avatar_url')
                    .eq('id', session.user.id)
                    .single();

                if (profile) {
                    let needsUpdate = false;

                    if (profile.nickname && profile.nickname !== cachedNick) {
                        displayName = profile.nickname;
                        window.currentUserNickname = displayName;
                        displayLetter = displayName.charAt(0).toUpperCase();
                        localStorage.setItem('offszn_cached_nickname', profile.nickname);
                        needsUpdate = true;
                    }

                    if (profile.avatar_url && profile.avatar_url !== cachedAvatar) {
                        avatarUrl = profile.avatar_url;
                        localStorage.setItem('offszn_cached_avatar', profile.avatar_url);
                        needsUpdate = true;
                    }

                    // Only repaint if data changed
                    if (needsUpdate) {
                        updateUserVisuals(displayName, displayLetter, avatarUrl);
                    }
                }
            } catch (err) {
                console.warn("Navbar: Could not fetch profile data", err);
            }
        }

        // Dynamic Profile Link
        const dropdownHeader = document.querySelector('.user-dropdown-header');
        if (dropdownHeader) {
            dropdownHeader.onclick = () => window.location.href = `/@${displayName}`;
        }



    } else {
        if (authSection) authSection.style.display = 'none';
        if (guestSection) guestSection.style.display = 'flex';

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
function updateUserVisuals(displayName, displayLetter, avatarUrl) {
    const avatarEl = getEl('user-avatar-display');
    const dropdownAvatarEl = document.querySelector('.user-dropdown-avatar-lg');
    const dropdownNameEl = getEl('dropdown-username');
    const userNameDisplayEl = getEl('user-name-display');

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

    if (dropdownNameEl) dropdownNameEl.innerText = displayName;
    if (userNameDisplayEl) userNameDisplayEl.innerText = displayName;
}



window.handleLogout = async function (e) {
    if (e) e.preventDefault();
    if (typeof supabaseClient !== 'undefined') {
        await supabaseClient.auth.signOut();
        localStorage.removeItem('authToken'); // Explicitly clear token
        window.location.href = '/'; // Redirect to ensure state refresh
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

    // Close manu manually or via helper
    const cMenu = getEl('currency-menu');
    if (cMenu) cMenu.classList.remove('active');
    const cBtn = getEl('currency-toggle-btn');
    if (cBtn) cBtn.classList.remove('active-currency');

    highlightCurrencyItem(curr);
    localStorage.setItem('userCurrency', curr);

    // Instant Re-render if we have cached results
    if (NavbarState.search.lastResults && NavbarState.search.lastResults.length > 0) {
        renderActualResults(NavbarState.search.lastResults);
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
window.handleResultClick = async function (url, title) {
    // Prevent default if necessary, but this is an onclick handler
    try {
        await saveToHistory(title);
    } catch (e) {
        console.warn("History save failed, proceeding:", e);
    }
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

        // C. Merge: Local (Guest) + Remote -> Unique Set
        // We prioritize Local (most recent) + Remote
        const mergedSet = new Set([...localHistory, ...remoteHistory]);
        const mergedArray = Array.from(mergedSet).slice(0, 50); // Limit to 50 for full history

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
document.addEventListener('DOMContentLoaded', async () => {
    // Restore Currency
    const savedCurr = localStorage.getItem('userCurrency') || 'PEN';
    const currEl = getEl('current-currency');
    if (currEl) currEl.innerText = savedCurr;

    // Start Subsystems
    initSearch();
    await initAuth(); // Wait for auth to check user

    // Sync Check
    // If we have a user from initAuth, we should sync. 
    // initAuth calls updateAuthUI, let's hook into onAuthStateChange actually.

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
            e.target.closest('#search-trending-panel');

        if (!isInside) {
            closeAllUI();
        }
    });

    // Logout Button Listener
    const logoutBtn = getEl('navbar-logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', window.handleLogout);

    // Initialize Mobile Menu
    setupMobileMenu();
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

        const toggleMenu = (e) => {
            if (e) e.stopPropagation();
            navContainer.classList.toggle('active');
            backdrop.classList.toggle('active');
            hamburgerBtn.innerHTML = navContainer.classList.contains('active') ? '✕' : '☰';

            if (navContainer.classList.contains('active')) {
                document.body.style.overflow = 'hidden'; // Prevent background scrolling
            } else {
                document.body.style.overflow = '';
            }
        };

        const closeMenu = () => {
            navContainer.classList.remove('active');
            backdrop.classList.remove('active');
            hamburgerBtn.innerHTML = '☰';
            document.body.style.overflow = '';
        };

        // Toggle
        hamburgerBtn.addEventListener('click', toggleMenu);

        // Close on Backdrop
        backdrop.addEventListener('click', closeMenu);

        // Close on Link Click (except toggles)
        navContainer.querySelectorAll('a').forEach(link => {
            // If it's a toggle link (like 'Recursos'), let it toggle the submenu
            if (!link.classList.contains('nav-toggle-link') && !link.classList.contains('search-filter-trigger')) {
                link.addEventListener('click', closeMenu);
            }
        });

        // Connect to Global UI Close
        // (Optional: if you want closeAllUI to also close this menu, you can add state check there)
    }
}
