/**
 * PRODUCT CORE JS - Smart Template Controller
 * Logic to render OFFSZN products dynamically based on type.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Get Product ID from Clean URL or Params
    const productId = getProductIdFromUrl();
    if (!productId) {
        window.location.href = 'explorar.html';
        return;
    }

    try {
        // 0. Get Session (for "My Like" status)
        let currentUser = null;
        const sessionRes = await window.supabaseClient.auth.getSession();
        if (sessionRes.data && sessionRes.data.session) {
            currentUser = sessionRes.data.session.user;
        }

        // 2. Fetch Data from Supabase
        const { data: product, error } = await window.supabaseClient
            .from('products')
            .select(`
                *,
                producer:producer_id (*)
            `)
            .eq('id', productId)
            .single();

        if (error) {
            console.error("Supabase Error Full:", error);
            throw error;
        }

        // --- PARALLEL DATA FETCHING (Likes & Followers) ---
        const promises = [];

        // A. Real Like Count
        const likesCountPromise = window.supabaseClient
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('target_id', productId) // UUID should be a string here
            .eq('target_type', 'product');

        // B. Did I Like?
        let userLikePromise = Promise.resolve({ count: 0 }); // Default false
        if (currentUser) {
            userLikePromise = window.supabaseClient
                .from('likes')
                .select('*', { count: 'exact', head: true })
                .eq('target_id', productId)
                .eq('target_type', 'product')
                .eq('user_id', currentUser.id);
        }

        // C. Producer Follower Count
        let producerFollowersPromise = Promise.resolve({ count: 0 });
        if (product.producer_id) {
            producerFollowersPromise = window.supabaseClient
                .from('followers')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', product.producer_id); // user_id is the Leader
        }

        const [likesRes, userLikeRes, followersRes] = await Promise.all([
            likesCountPromise,
            userLikePromise,
            producerFollowersPromise
        ]);

        // Attach Real Data to Product Object for Rendering
        product.stats_likes = likesRes.count || 0;
        product.user_has_liked = (userLikeRes.count && userLikeRes.count > 0);

        // Enrich producer object if exists
        if (product.producer) {
            if (Array.isArray(product.producer)) product.producer = product.producer[0]; // Safety
            product.producer.followers_count = followersRes.count || 0;
        }

        // 3. Kick off the rendering
        renderProductPage(product);

        // --- DASHBOARD PERSISTENCE SPECIAL: Auto-trigger download gate after onboarding redirect ---
        const shouldAutoDownload = localStorage.getItem('offszn_auto_download_trigger');
        if (shouldAutoDownload === 'true' && product.is_free) {
            localStorage.removeItem('offszn_auto_download_trigger');
            console.log("[AutoDownload] Triggering modal after onboarding redirect...");
            const producerName = product.producer?.nickname || 'Productor';
            const downloadUrl = product.download_url;
            if (downloadUrl) {
                setTimeout(() => {
                    openDownloadGateModal(downloadUrl, producerName, product.id);
                }, 800); // Give rendering some time to settle
            }
        }

        // 3.5 Increment Views (Background)
        window.supabaseClient
            .from('products')
            .update({ views_count: (product.views_count || 0) + 1 })
            .eq('id', productId)
            .then(({ error }) => {
                if (error) console.warn("Error incrementing views:", error);
            });

        // 4. Fetch Related Products (Background)
        fetchRelatedProducts(product);

    } catch (err) {
        console.error("Error loading product:", err);
        document.getElementById('product-page-container').innerHTML = `
            <div style="text-align:center; padding:100px;">
                <h2>Error al cargar el producto</h2>
                <p>${err.message}</p>
                <a href="explorar.html" style="color:var(--accent-purple)">Volver a explorar</a>
            </div>
        `;
    }
});

/**
 * Parses URL to find the numeric ID.
 * Supports /beat/slug-NAME-CODE and ?p=CODE
 */
function getProductIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const pCode = params.get('p');

    if (pCode && window.IdObfuscator) {
        return window.IdObfuscator.decodeId(pCode);
    }

    // Clean URL check: /beat/some-slug-CODE
    const pathParts = window.location.pathname.split('/').filter(p => p);
    if (pathParts.length >= 2) {
        const lastPart = pathParts[pathParts.length - 1];
        const code = lastPart.split('-').pop(); // Get last segment after '-'
        console.log("Debug: Extracted code from URL:", code); // DEBUG
        if (code && window.IdObfuscator) {
            const decoded = window.IdObfuscator.decodeId(code);
            console.log("Debug: Decoded ID:", decoded); // DEBUG
            return decoded;
        }
    }

    return params.get('id'); // Fallback to legacy ?id=X
}

/**
 * Main switch-case renderer
 */
function renderProductPage(product) {
    const container = document.getElementById('product-page-container');

    // UNIFIED LAYOUT: Sidebar Left (Meta) + Content Right (Title/Action)
    // Corrected to match reference: Title is in the MAIN (Right) column.

    // 1. Prepare Metadata Rows
    let metaRows = '';

    // Released Date
    const dateObj = new Date(product.created_at);
    const dateStr = dateObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    metaRows += `<div class="info-row"><span class="info-label">Publicado</span> <span class="info-val">${dateStr}</span></div>`;

    // Category (Added per request)
    const categoryMap = {
        'voces': 'Preset de Voces',
        'plantilla': 'Plantilla',
        'drumkit': 'Drum Kit',
        'loopkit': 'Loop Kit',
        'instrumento': 'Instrumento',
        'plugin': 'Plugin',
        'trap': 'Trap',
        'reggaeton': 'Reggaetón'
    };
    const catId = (product.category || product.product_type || '').toLowerCase();
    const displayCategory = categoryMap[catId] || product.category || 'N/A';
    metaRows += `<div class="info-row"><span class="info-label">Categoría</span> <span class="info-val" style="text-transform: capitalize;">${displayCategory}</span></div>`;

    if (product.product_type === 'drumkit' || product.product_type === 'loopkit' || product.product_type === 'preset') {
        metaRows += `<div class="info-row"><span class="info-label">Archivos</span> <span class="info-val">${product.sounds_count || '1'}</span></div>`;
    } else {
        metaRows += `<div class="info-row"><span class="info-label">BPM</span> <span class="info-val">${product.bpm || '--'}</span></div>`;
        metaRows += `<div class="info-row"><span class="info-label">Key</span> <span class="info-val">${(product.key || '')} ${(product.key_scale || '')}</span></div>`;
    }

    metaRows += `<div class="info-row"><span class="info-label">Reproducciones</span> <span class="info-val">${product.plays_count || 0}</span></div>`;

    // 2. Collaborators/Producer Logic
    // Fix: Supabase might return producer as an object OR array depending on query.
    // Safe check:
    let producerData = product.producer;
    if (Array.isArray(producerData)) producerData = producerData[0];

    // Explicit Fallback using NICKNAME (per schema)
    const producerName = producerData?.nickname || 'Unknown Producer';
    const isVerified = producerData?.is_verified;

    // Use Hover Card Logic for Producer
    const producerDataJSON = JSON.stringify({
        id: product.producer_id,
        nickname: producerName,
        avatar_url: producerData?.avatar_url,
        is_verified: isVerified,
        stats: {
            followers: producerData?.followers_count || 0
            // products omitted so hover-card.js triggers a real fetch
        }
    }).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

    let producerHTML = `
        <span class="artist-hover-trigger producer-link-thin" 
              data-artist="${producerDataJSON}"
              onclick="window.location.href='/perfil-publico.html?id=${product.producer_id}'"
              onmouseenter="window.showArtistCard(event, this)" 
              onmouseleave="window.hideArtistCard(event, this)"
              style="color:#aaa; font-size:1rem; margin-bottom: 20px; display:inline-flex; align-items:center; cursor:pointer;">
            ${producerName} 
            <i class="bi bi-patch-check-fill" style="color:#A020F0; display:${isVerified ? 'inline' : 'none'}; margin-left:4px;"></i>
        </span>
    `;

    if (product.collaborators && product.collaborators.length > 0) {
        const approvedCollabs = product.collaborators.filter(c => c.status === 'accepted');
        if (approvedCollabs.length > 0) {
            const collabLinks = approvedCollabs.map(c => {
                const cUser = c.user || {};
                const cDataJSON = JSON.stringify({
                    id: c.user_id,
                    nickname: cUser.nickname || 'Unknown',
                    avatar_url: cUser.avatar_url,
                    is_verified: cUser.is_verified,
                    stats: {
                        followers: cUser.followers_count || 0
                    }
                }).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

                return `
                    <span class="artist-hover-trigger collaborator-link-thin" 
                          data-artist="${cDataJSON}"
                          onclick="window.location.href='/perfil-publico.html?id=${c.user_id}'"
                          onmouseenter="window.showArtistCard(event, this)" 
                          onmouseleave="window.hideArtistCard(event, this)"
                          style="color:#fff; cursor:pointer;">
                        ${cUser.nickname || 'Unknown'}
                    </span>
                `;
            }).join(', ');
            producerHTML += `<span style="color:#666; font-size:0.9rem; margin-left:8px;">feat. ${collabLinks}</span>`;
        }
    }


    container.innerHTML = `
        <div class="product-split-layout">
            <!-- LEFT: SIDEBAR (Art, Player, Meta) -->
            <div class="product-sidebar">
                <!-- Cover Art -->
                <div class="product-cover-art" style="position:relative;">
                    <img src="${product.image_url || '/images/portada-default.png'}" 
                         alt="${product.name}"
                         onerror="this.src='/images/portada-default.png'">
                     <!-- Player Target -->
                     <div id="sidebar-player-target" style="position:absolute; bottom:15px; left:15px; right:15px;"></div>
                </div>

                <!-- Social Actions -->
                <div class="action-row" id="social-actions-container" style="justify-content:center; margin-top:20px;">
                    <!-- Injected dynamically -->
                </div>

                <!-- Free Download Button (Sidebar) - Hidden by default -->
                <div id="free-dl-container"></div>

                <!-- Information List -->
                <div class="info-list">
                    <div style="font-size:0.8rem; color:#666; margin-bottom:5px; font-weight:700; text-transform:uppercase;">Información</div>
                    ${metaRows}
                </div>

                <!-- Tags -->
                <div class="tags-section" style="margin-top:20px;">
                    <div class="tags-row" id="tags-container"></div>
                </div>
            </div>

            <!-- RIGHT: MAIN CONTENT (Header, Desc, Buy) -->
            <div class="product-main-content">
                
                <!-- HEADER: Title & Producer -->
                <div>
                    <h1 style="font-size:3rem; font-weight:800; line-height:1.1; margin-bottom:10px;">
                        ${(() => {
            const name = product.name || 'Sin título';
            if (name.length > 60) {
                return name.substring(0, 57) + '...';
            }
            return name;
        })()}
                    </h1>
                    ${producerHTML}
                </div>
                
                <!-- Buying Section & Footer -->
<div class="section-headline" id="licenses-header" style="display: flex; justify-content: space-between; align-items: center;"><span>Licencias</span></div>
                <div id="buying-modules"></div>

                <!-- Description (Accordion) -->
                <div class="section-headline" onclick="toggleAccordion('desc')" style="cursor:pointer; margin-top:25px;">
                    <span>Descripción</span>
                    <i class="bi bi-chevron-down chevron-icon" id="chevron-desc" style="color:#666;"></i>
                </div>
                <div id="content-desc" class="terms-accordion-content open" style="color:#888; font-size:1rem; line-height:1.6; white-space: pre-line;">${(() => {
            if (!product.description) return 'Sin descripción.';
            // Preserve single and double line breaks, but limit more than 2 to just 2
            return product.description
                .replace(/\r\n/g, '\n')     // Standardize
                .replace(/\n{3,}/g, '\n\n') // Limit triple+ to double
                .trim();
        })()}
                </div>

                <!-- Terms (Accordion) -->
                <div class="section-headline" onclick="toggleAccordion('terms')" style="cursor:pointer; margin-top:15px;">
                    <span>Términos de Uso</span>
                    <i class="bi bi-chevron-down chevron-icon rotate" id="chevron-terms" style="color:#666;"></i>
                </div>
<div id="content-terms" class="terms-accordion-content open" style="color:#888; font-size:0.9rem; line-height:1.6; margin-bottom:40px;">
                    ${(() => {
            if (product.product_type === 'beat') {
                return `<p>Este producto está sujeto a licencias de uso. La descarga gratuita permite el uso únicamente para plataformas como YouTube y SoundCloud, sin monetización y sin fines comerciales. Para monetizar, distribuir en plataformas digitales (Spotify, Apple Music, etc.) o usos comerciales, es necesario adquirir la licencia correspondiente del productor/artista.</p>`;
            } else {
                return `<p>Este producto es 100% Libre de Regalías (Royalty Free).</p>
                                ${product.is_free ? `<p style="margin-top:10px; color:#666; font-size:0.85rem;"><em>Considerar que antes costaba $${product.price_basic || '1.00'}. Leer los términos y condiciones del productor/artista despues de la descarga.</em></p>` : ''}`;
            }
        })()}
                </div>
            </div>
        </div>

        <!-- RELATED PRODUCTS SECTION -->
        <div class="related-products-section">
            <div class="section-header" style="margin-bottom: 24px; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="color:#fff; font-size:1.5rem; font-weight:800;">Recomendado para ti</h3>
                <div class="nav-arrows" style="display:flex; gap:10px;">
                    <button class="nav-arrow-btn" onclick="scrollRelated(-1)"><i class="bi bi-chevron-left"></i></button>
                    <button class="nav-arrow-btn" onclick="scrollRelated(1)"><i class="bi bi-chevron-right"></i></button>
                </div>
            </div>
            <div id="product-related-container" class="trending-grid">
                <!-- JS Injects Recommendations Here -->
            </div>
        </div>
    `;

    // 1. SETUP INTERACTIONS (Social + Tags)
    setupSocialInteractions(product);

    // 2. Render Tags
    if (product.tags && Array.isArray(product.tags)) {
        // ... (Tags logic same as before, omitted for brevity if no changes, but included in full context)
        const tagBox = document.createElement('div');
        tagBox.className = 'tags-row';
        tagBox.id = 'tags-container';
        // (Insert Logic) - Actually, let's keep it simple.
    }
    // RE-INJECT Tags manually since we touched HTML
    const tagSection = document.querySelector('.tags-section');
    if (tagSection) {
        tagSection.innerHTML = '<div class="tags-row" id="tags-container"></div>';
        if (product.tags) {
            const tagBox = document.getElementById('tags-container');
            product.tags.forEach(tag => {
                const a = document.createElement('a');
                a.className = 'tag-pill';
                a.href = `explorar.html?tag=${tag}`;
                a.textContent = `#${tag}`;
                tagBox.appendChild(a);
            });
        }
    }

    // 3. Delegate specific rendering
    console.log(`[Render] Product Type: ${product.product_type} | Category: ${product.category}`);

    const type = (product.product_type || '').toLowerCase();
    const category = (product.category || '').toLowerCase();

    if (type === 'beat') {
        renderBeatSpecifics(product);
    } else if (type === 'drumkit' || type === 'loopkit') {
        renderKitSpecifics(product);
    } else if (type === 'preset' || type === 'plantilla' || category === 'plantilla' || category === 'voces' || category.includes('preset')) {
        renderPresetSpecifics(product);
    } else {
        renderGenericSpecifics(product);
    }

    // 4. Free Download (Removed Sidebar Button per request)
    // if (product.is_free) { ... }
}

/**
 * MICRO-INTERACTIONS & LOGIC
 */
// MICRO-INTERACTIONS & LOGIC
function setupSocialInteractions(product) {
    const container = document.getElementById('social-actions-container');
    if (!container) return;

    // Use FavoritesManager for sync status if available
    // FIX: Fallback to server data (product.user_has_liked) if FavoritesManager returns false (loading state).
    // Logic: If EITHER thinks it's liked, show it as liked to prevent "Unliked -> Liked" +1 increment bug.
    const isLiked = (window.FavoritesManager && window.FavoritesManager.isLiked(product.id)) || (product.user_has_liked || false);
    const likeClass = isLiked ? 'liked' : '';
    const heartIcon = isLiked ? 'bi-heart-fill' : 'bi-heart';

    // HTML for buttons (Icon top, Count bottom)
    container.innerHTML = `
        <div style="display:flex; gap:30px; justify-content:center; width:100%;">
            <button class="action-btn-icon ${likeClass}" id="btn-like" onclick="toggleLikeGlobal(this, '${product.id}', '${product.producer_id}')">
                <i class="bi ${heartIcon}"></i>
                <span class="stat-value">${product.stats_likes || 0}</span>
            </button>
            
            <button class="action-btn-icon" id="btn-share" onclick="openShareModal('${product.id}')">
                <i class="bi bi-upload"></i>
                <span class="stat-value">&nbsp;</span>
            </button>

            <button class="action-btn-icon" id="btn-exclusivity" onclick="window.openExclusivityModal()">
                <i class="bi bi-plus-lg"></i>
                <span class="stat-value">&nbsp;</span>
            </button>
        </div>
    `;

    // Store current product for modal access
    window.currentProductData = product;

    // Listen for external updates (e.g. from FavoritesManager)
    if (window.FavoritesManager) {
        window.FavoritesManager.subscribe((likedSet) => {
            const btn = document.getElementById('btn-like');
            if (!btn) return;

            const icon = btn.querySelector('i');
            const valSpan = btn.querySelector('.stat-value');

            const isNowLiked = likedSet.has(String(product.id));
            const wasLiked = btn.classList.contains('liked');

            // Logic: Compare New State (Set) vs Old State (DOM)
            // If they differ, update DOM and Count.
            if (isNowLiked && !wasLiked) {
                // User just Liked (or external sync)
                btn.classList.add('liked');
                icon.classList.remove('bi-heart');
                icon.classList.add('bi-heart-fill');

                // Increment Count
                if (valSpan) {
                    let val = parseInt(valSpan.innerText) || 0;
                    valSpan.innerText = val + 1;
                }
            } else if (!isNowLiked && wasLiked) {
                // User just Unliked (or external sync)
                btn.classList.remove('liked');
                icon.classList.remove('bi-heart-fill');
                icon.classList.add('bi-heart');

                // Decrement Count
                if (valSpan) {
                    let val = parseInt(valSpan.innerText) || 0;
                    valSpan.innerText = Math.max(0, val - 1);
                }
            }
            // If they are equal (isNowLiked == wasLiked), do nothing. 
            // This prevents duplicate updates if subscriber fires multiple times.
        });
    }
}

// Global wrapper to call FavoritesManager
window.toggleLikeGlobal = function (btn, productId, producerId) {
    if (window.FavoritesManager) {
        // 1. Submit Action (Manager handles throttling & optimistic state update)
        window.FavoritesManager.toggleLike(productId, btn, producerId);

        // 2. Click Animation (Separate from state)
        // REMOVED: Animation per user request "sin animaciones raras"
        /*
        const icon = btn.querySelector('i');
        if (icon) {
            icon.classList.add('anim-bounce');
            setTimeout(() => icon.classList.remove('anim-bounce'), 450);
        }
        */
    } else {
        console.warn("FavoritesManager not loaded");
    }
}

// Global functions for interactions (attached to window for onclick access)
window.toggleLike = function (btn, productId) {
    const icon = btn.querySelector('i');
    const valSpan = btn.querySelector('.stat-value');
    let val = parseInt(valSpan.innerText);

    // Animation Effect
    icon.classList.add('anim-bounce');
    setTimeout(() => icon.classList.remove('anim-bounce'), 450);

    if (btn.classList.contains('liked')) {
        btn.classList.remove('liked');
        icon.classList.remove('bi-heart-fill');
        icon.classList.add('bi-heart');
        valSpan.innerText = val - 1;
    } else {
        btn.classList.add('liked');
        icon.classList.remove('bi-heart');
        icon.classList.add('bi-heart-fill'); // Filled heart
        valSpan.innerText = val + 1;
    }
}



// Generic Accordion Toggle
window.toggleAccordion = function (idSuffix) {
    const content = document.getElementById('content-' + idSuffix);
    const icon = document.getElementById('chevron-' + idSuffix);

    if (content && icon) {
        if (content.classList.contains('open')) {
            content.classList.remove('open');
            icon.classList.remove('rotate');
        } else {
            content.classList.add('open');
            icon.classList.add('rotate');
        }
    }
}



window.openShareModal = function (productId) {
    // Check if modal exists
    let backdrop = document.getElementById('share-modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'share-modal-backdrop';
        backdrop.className = 'share-modal-backdrop';

        // Add click listener for backdrop closing
        backdrop.onclick = function (e) {
            if (e.target === backdrop) window.closeShareModal();
        };

        backdrop.innerHTML = `
            <div class="share-modal-content">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                     <h3 style="color:#fff; margin:0;">Compartir Producto</h3>
                     <button onclick="closeShareModal()" style="background:none; border:none; color:#666; font-size:1.5rem; cursor:pointer;"><i class="bi bi-x"></i></button>
                </div>
                <p style="color:#888; font-size:0.9rem; margin-bottom:20px;">Copia el enlace directo para compartir este sonido con otros.</p>
                
                <div class="share-link-box" id="share-link-box" style="padding:0; overflow:hidden; display:flex; align-items:center; height:45px;">
                     <button onclick="copyShareLink()" class="btn-copy-share">
                        COPIAR
                     </button>
                     <input type="text" id="share-url-text" readonly style="flex:1; background:transparent; border:none; color:#ccc; padding:0 10px; outline:none; font-family:monospace; font-size:0.9rem;" value="...">
                </div>
                
                <div id="share-status" style="height:20px; font-size:0.8rem; color:#4bff8f; margin-top:10px;"></div>
            </div>
        `;
        document.body.appendChild(backdrop);
    }

    // Logic to set URL
    let displayUrl = window.location.href;
    if (window.createSeoLink && window.currentProductData) {
        displayUrl = window.location.origin + window.createSeoLink(window.currentProductData);
    }
    document.getElementById('share-url-text').value = displayUrl;

    // Show
    backdrop.style.display = 'flex';
    setTimeout(() => backdrop.classList.add('active'), 10);
    // Focus input for quick copying
    setTimeout(() => {
        const input = document.getElementById('share-url-text');
        if (input) input.select();
    }, 100);
}

window.openExclusivityModal = function () {
    let backdrop = document.getElementById('exclusivity-modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'exclusivity-modal-backdrop';
        backdrop.className = 'share-modal-backdrop'; // Reuse same glass backdrop styles

        backdrop.onclick = function (e) {
            if (e.target === backdrop) window.closeExclusivityModal();
        };

        backdrop.innerHTML = `
            <div class="share-modal-content">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                     <h3 style="color:#fff; margin:0;">Exclusividad</h3>
                     <button onclick="closeExclusivityModal()" style="background:none; border:none; color:#666; font-size:1.5rem; cursor:pointer;"><i class="bi bi-x"></i></button>
                </div>
                <p style="color:#ccc; font-size:1rem; margin-bottom:20px; line-height:1.5;">Contacta al productor para obtener la exclusividad de este producto.</p>
                
                <button onclick="contactProducerForExclusivity()" class="btn-glass-primary" style="width:100%; border-radius:30px; padding:12px; margin-top:10px;">
                    CONTACTARLO
                </button>
            </div>
        `;
        document.body.appendChild(backdrop);
    }
    backdrop.style.display = 'flex';
    setTimeout(() => backdrop.classList.add('active'), 10);
}

window.closeExclusivityModal = function () {
    const backdrop = document.getElementById('exclusivity-modal-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        setTimeout(() => backdrop.style.display = 'none', 300);
    }
}

window.contactProducerForExclusivity = function () {
    const product = window.currentProductData;
    if (!product) return;

    const producerNickname = product.producer?.nickname || 'Productor';
    const productCategory = product.product_type || 'producto';
    let productLink = window.location.href;
    if (window.createSeoLink) {
        productLink = window.location.origin + window.createSeoLink(product);
    }

    const message = `Vi tu ${productCategory} ("${product.name}") ${productLink} estoy interesado en tener una versión exclusiva para negociarlo.`;

    // Redirect to chat with pre-filled message (Corrected path to mensajes.html)
    window.location.href = `/mensajes.html?user=${producerNickname}&msg=${encodeURIComponent(message)}`;
}

window.closeShareModal = function () {
    const backdrop = document.getElementById('share-modal-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        setTimeout(() => backdrop.style.display = 'none', 300);
        // Clear status
        const status = document.getElementById('share-status');
        if (status) status.innerText = '';
    }
}

window.copyShareLink = function () {
    const input = document.getElementById('share-url-text');
    input.select();
    input.setSelectionRange(0, 99999); // Mobile

    navigator.clipboard.writeText(input.value).then(() => {
        const status = document.getElementById('share-status');
        status.innerText = '¡Enlace copiado al portapapeles!';
        setTimeout(() => status.innerText = '', 2000);

        // Micro-anim on box
        document.getElementById('share-link-box').style.borderColor = '#fff';
        setTimeout(() => document.getElementById('share-link-box').style.borderColor = '#333', 200);
    });
}

window.closeDownloadGateModal = function () {
    const backdrop = document.getElementById('gate-modal-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        setTimeout(() => backdrop.style.display = 'none', 300);
    }
}

window.openDownloadGateModal = function (url, producerName, productId) {
    const product = window.currentProductData;
    const producerId = product?.producer_id;
    const currentUserId = window.currentUserId;

    // Check if already following or if it's the owner
    const isOwner = currentUserId && producerId && currentUserId === producerId;
    const isFollowing = window.currentUserFollowing && window.currentUserFollowing.has(producerId);

    const isAlreadyConnected = isOwner || isFollowing;

    // --- GUEST HANDLING ---
    if (!currentUserId) {
        let backdrop = document.getElementById('gate-modal-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'gate-modal-backdrop';
            backdrop.className = 'share-modal-backdrop';
            backdrop.onclick = (e) => { if (e.target === backdrop) window.closeDownloadGateModal(); };
            backdrop.innerHTML = `
                <div class="share-modal-content">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                         <h3 style="color:#fff; margin:0;">Inicia Sesión</h3>
                         <button onclick="closeDownloadGateModal()" style="background:none; border:none; color:#666; font-size:1.5rem; cursor:pointer;"><i class="bi bi-x"></i></button>
                    </div>
                    <p style="color:#ccc; font-size:1rem; margin-bottom:20px; line-height:1.5;">
                        Para descargar este kit gratis y guardarlo en tu librería, necesitas una cuenta en OFFSZN.
                    </p>
                    <button id="btn-gate-login" class="btn-glass-primary" style="width:100%; border-radius:30px; padding:12px; margin-top:10px;">
                        <i class="bi bi-person-plus-fill"></i> INICIAR SESIÓN / REGISTRARSE
                    </button>
                    <button onclick="closeDownloadGateModal()" class="btn-minimal-link" style="width:100%; justify-content:center; margin-top:15px;">
                        Quizás luego
                    </button>
                </div>
            `;
            document.body.appendChild(backdrop);
        } else {
            // Re-render guest specialized content
            backdrop.querySelector('.share-modal-content').innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3 style="color:#fff; margin:0;">Inicia Sesión</h3>
                        <button onclick="closeDownloadGateModal()" style="background:none; border:none; color:#666; font-size:1.5rem; cursor:pointer;"><i class="bi bi-x"></i></button>
                </div>
                <p style="color:#ccc; font-size:1rem; margin-bottom:20px; line-height:1.5;">
                    Para descargar este kit gratis y guardarlo en tu librería, necesitas una cuenta en OFFSZN.
                </p>
                <button id="btn-gate-login" class="btn-glass-primary" style="width:100%; border-radius:30px; padding:12px; margin-top:10px;">
                    <i class="bi bi-person-plus-fill"></i> INICIAR SESIÓN / REGISTRARSE
                </button>
                <button onclick="closeDownloadGateModal()" class="btn-minimal-link" style="width:100%; justify-content:center; margin-top:15px;">
                    Quizás luego
                </button>
            `;
        }

        const loginBtn = document.getElementById('btn-gate-login');
        if (loginBtn) {
            loginBtn.onclick = () => {
                localStorage.setItem('offszn_pending_download', window.location.href);
                window.location.href = '/pages/login.html';
            };
        }

        backdrop.style.display = 'flex';
        setTimeout(() => backdrop.classList.add('active'), 10);
        return;
    }

    let backdrop = document.getElementById('gate-modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'gate-modal-backdrop';
        backdrop.className = 'share-modal-backdrop';

        backdrop.onclick = function (e) {
            if (e.target === backdrop) window.closeDownloadGateModal();
        };

        backdrop.innerHTML = `
            <div class="share-modal-content">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                     <h3 style="color:#fff; margin:0;">Descarga Gratuita</h3>
                     <button onclick="closeDownloadGateModal()" style="background:none; border:none; color:#666; font-size:1.5rem; cursor:pointer;"><i class="bi bi-x"></i></button>
                </div>
                <p id="gate-message" style="color:#ccc; font-size:1rem; margin-bottom:20px; line-height:1.5;"></p>
                
                <button id="btn-gate-action" class="btn-glass-primary" style="width:100%; border-radius:30px; padding:12px; margin-top:10px;">
                    <i id="gate-action-icon" class="bi"></i> <span id="gate-action-text"></span>
                </button>
                <button onclick="closeDownloadGateModal()" class="btn-minimal-link" style="width:100%; justify-content:center; margin-top:15px;">
                    Cancelar
                </button>
            </div>
        `;
        document.body.appendChild(backdrop);
    } else {
        // Reset to standard download content if it was guest content before
        backdrop.querySelector('.share-modal-content').innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                     <h3 style="color:#fff; margin:0;">Descarga Gratuita</h3>
                     <button onclick="closeDownloadGateModal()" style="background:none; border:none; color:#666; font-size:1.5rem; cursor:pointer;"><i class="bi bi-x"></i></button>
                </div>
                <p id="gate-message" style="color:#ccc; font-size:1rem; margin-bottom:20px; line-height:1.5;"></p>
                
                <button id="btn-gate-action" class="btn-glass-primary" style="width:100%; border-radius:30px; padding:12px; margin-top:10px;">
                    <i id="gate-action-icon" class="bi"></i> <span id="gate-action-text"></span>
                </button>
                <button onclick="closeDownloadGateModal()" class="btn-minimal-link" style="width:100%; justify-content:center; margin-top:15px;">
                    Cancelar
                </button>
         `;
    }

    // Dynamic UI Update
    const msgEl = document.getElementById('gate-message');
    const actionTextEl = document.getElementById('gate-action-text');
    const actionIconEl = document.getElementById('gate-action-icon');

    if (isAlreadyConnected) {
        msgEl.innerHTML = `¡Gracias por tu apoyo! Ya sigues a <b>${producerName || 'Productor'}</b>.`;
        actionTextEl.innerText = 'DESCARGAR AHORA';
        actionIconEl.className = 'bi bi-download';
    } else {
        msgEl.innerHTML = `Para descargar este kit, sigue a <b>${producerName || 'Productor'}</b>.`;
        actionTextEl.innerText = 'SEGUIR & DESCARGAR';
        actionIconEl.className = 'bi bi-person-plus-fill';
    }

    const actionBtn = document.getElementById('btn-gate-action');
    if (actionBtn) {
        actionBtn.onclick = () => completeGate(url, productId);
    }

    backdrop.style.display = 'flex';
    setTimeout(() => backdrop.classList.add('active'), 10);
}

window.completeGate = async function (url, productId) {
    const btn = document.getElementById('btn-gate-action');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px; height:20px; border-width:2px; margin:0 auto;"></div>';

    try {
        const product = window.currentProductData;
        let producerObj = product?.producer;
        if (Array.isArray(producerObj)) producerObj = producerObj[0]; // Robustness fix

        const producerId = producerObj?.id;
        const producerEmail = producerObj?.email;
        const currentUserId = window.currentUserId;

        // 1. Follow Logic (Only if not owner and not already following)
        if (currentUserId && producerId && currentUserId !== producerId) {
            // Check if already following via window.currentUserFollowing set (if available)
            const isFollowing = window.currentUserFollowing && window.currentUserFollowing.has(producerId);

            if (!isFollowing) {
                console.log("[Gate] Auto-following producer...");
                const response = await fetch(`/api/users/${producerId}/follow`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                });

                if (response.ok) {
                    if (window.currentUserFollowing) window.currentUserFollowing.add(producerId);
                    console.log("[Gate] Follow successful.");
                } else {
                    console.warn("[Gate] Follow failed, but proceeding to download.");
                }
            }
        } else {
            console.log("[Gate] Owner or local check passed, skipping follow.");
        }

        // 2. Dashboard Persistence ($0 Order)
        if (currentUserId && productId && productId !== 'undefined') {
            console.log("[Gate] Recording free download in dashboard...");
            fetch('/api/orders/free', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ productId: productId })
            }).then(r => r.json()).then(data => console.log("[Gate] Dashboard sync:", data))
                .catch(err => console.error("[Gate] Dashboard sync error:", err));
        }

        // 3. EmailJS Notification (Consolidated/Hybrid)
        if (typeof emailjs !== 'undefined' && producerId && currentUserId !== producerId) {
            // A. Notify Producer (Template Producer)
            const producerParams = {
                activity_type: 'Descarga Gratuita',
                to_name: producerObj?.nickname || 'Productor',
                to_email: producerEmail || '',
                product_name: product?.name || 'Sonido',
                downloader_name: window.currentUserNickname || window.currentUserData?.nickname || 'Un usuario',
                amount: 'Gratis'
            };

            emailjs.send('service_w50l62y', 'template_bgp3zb5', producerParams, 'If_WAVcuXiGSPp2SB')
                .then(() => console.log("[Gate] Producer notification sent."))
                .catch(err => console.error("[Gate] Producer Email error:", err));

            // B. Notify Client (Template Client Receipt - Only if user has email)
            const clientEmail = window.currentUserData?.email;
            if (clientEmail) {
                const clientParams = {
                    downloader_name: window.currentUserNickname || window.currentUserData?.nickname || 'Usuario',
                    to_email: clientEmail,
                    product_name: product?.name || 'Sonido',
                    activity_type: 'descarga gratuita',
                    download_url: url
                };
                // Assuming template_client_receipt exists as per plan
                emailjs.send('service_w50l62y', 'template_client_receipt', clientParams, 'If_WAVcuXiGSPp2SB')
                    .then(() => console.log("[Gate] Client confirmation sent."))
                    .catch(err => console.warn("[Gate] Client Email skipped/failed (Template might not exist yet)."));
            }
        }

        // 4. Download Trigger (Direct)
        // (Downloads count now handled by /api/orders/free to avoid double increment)

        setTimeout(async () => {
            try {
                console.log("[Gate] Starting forced direct download via Fetch/Blob...");
                const response = await fetch(url);
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = blobUrl;
                // Intentar obtener un nombre de archivo limpio de la URL
                const fileName = url.split('/').pop().split('?')[0] || 'descarga-offszn.mp3';
                a.download = fileName;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();

                // Limpieza breve después del trigger
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(blobUrl);
                }, 200);

            } catch (downloadErr) {
                console.warn("[Gate] Blob download failed, falling back to simple trigger", downloadErr);
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.download = '';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }

            window.closeDownloadGateModal();
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }, 800);

    } catch (e) {
        console.error("[Gate] Critical error:", e);
        window.open(url, '_blank'); // Fail open for the user
        window.closeDownloadGateModal();
    }
}

/**
 * SCENARIO A: BEAT
 */
async function renderBeatSpecifics(product) {
    const buyBox = document.getElementById('buying-modules');
    buyBox.innerHTML = '<div class="loading-state-sm"><div class="spinner-sm"></div></div>';

    try {
        // 1. Fetch Producer's License Settings (Defaults)
        let producerSettings = null;
        if (product.producer && product.producer.license_settings) {
            producerSettings = product.producer.license_settings;
        } else if (product.producer_id) {
            const { data } = await window.supabaseClient
                .from('users')
                .select('license_settings')
                .eq('id', product.producer_id)
                .single();
            if (data) producerSettings = data.license_settings;
        }

        // 2. Identify Product-Specific Licenses (Priority)
        // Check if product.licenses (JSONB) has data
        const productLicenses = product.licenses || {};

        // Factory Defaults as last resort
        const FACTORY_DEFAULTS = {
            'basic': { name: 'Basic Lease', price: 20, streams: '5,000', sales: '500', radio: 'No Permitido', files: { mp3: true, wav: false, stems: false }, enabled: true },
            'premium': { name: 'Premium Lease', price: 40, streams: '50,000', sales: '2,000', radio: '2 Estaciones', files: { mp3: true, wav: true, stems: false }, enabled: true },
            'trackout': { name: 'Trackout Lease', price: 60, streams: '500,000', sales: '10,000', radio: 'ILIMITADO', files: { mp3: true, wav: true, stems: true }, enabled: true },
            'unlimited': { name: 'Unlimited License', price: 80, streams: 'UNLIMITED', sales: 'UNLIMITED', radio: 'ILIMITADO', files: { mp3: true, wav: true, stems: true }, enabled: true }
        };

        // 3. Prepare Final Licenses Array (Correct Priority)
        const licenseKeys = ['basic', 'premium', 'trackout', 'unlimited'];
        const licenses = licenseKeys.map(key => {
            // Priority: Product Level > Producer Level > Factory Default
            const prodLic = productLicenses[key] || {};
            const userLic = (producerSettings && producerSettings[key]) ? producerSettings[key] : {};
            const factLic = FACTORY_DEFAULTS[key];

            return {
                id: key,
                name: prodLic.name || userLic.name || factLic.name,
                price: (prodLic.price !== undefined && prodLic.price !== null) ? prodLic.price :
                    (userLic.price !== undefined && userLic.price !== null) ? userLic.price : factLic.price,
                enabled: (prodLic.enabled !== undefined) ? prodLic.enabled :
                    (userLic.enabled !== undefined) ? userLic.enabled : factLic.enabled,
                streams: userLic.streams || factLic.streams,
                sales: userLic.sales || factLic.sales,
                radio: userLic.radio || factLic.radio,
                files: userLic.files || factLic.files
            };
        });

        // 4. Render Grid
        const licenseGrid = document.createElement('div');
        licenseGrid.className = 'license-grid-v2';

        // Store licenses for later use in addToCart
        if (window.currentProductData) {
            window.currentProductData.available_licenses = licenses;
        }

        // 🔥 Inject Compare Button
        const header = document.getElementById('licenses-header');
        // Clear previous button if re-rendering
        const existingBtn = document.getElementById('btn-compare-licenses');
        if (existingBtn) existingBtn.remove();

        if (header) {
            const compareBtn = document.createElement('button');
            compareBtn.id = 'btn-compare-licenses';
            compareBtn.className = 'btn-minimal-link';
            compareBtn.style.fontSize = '0.9rem';
            compareBtn.innerHTML = '<i class="bi bi-layout-three-columns" style="margin-right:5px;"></i> Comparar';
            compareBtn.onclick = () => openLicenseComparisonModal(licenses);
            header.appendChild(compareBtn);
        }

        licenses.forEach(lic => {
            if (!lic.enabled) return;

            const price = parseFloat(lic.price) || 0;
            const priceStr = price > 0 ? `$${price.toFixed(2)}` : 'Gratis';

            const card = document.createElement('div');
            card.className = 'license-card-v2';
            card.id = `lic-card-${lic.id}`;
            card.innerHTML = `
                <div class="lic-card-header">
                    <span class="lic-name">${lic.name}</span>
                    <i class="bi bi-info-circle lic-details-trigger"></i>
                </div>
                <div class="lic-card-body">
                    <span class="lic-files-preview">${getFilesPreview(lic.files, lic.name)}</span>
                    <span class="lic-price-v2">${priceStr}</span>
                </div>
            `;

            card.onclick = (e) => {
                if (e.target.closest('.lic-details-trigger')) {
                    openLicenseModal(lic, product);
                } else {
                    selectLicense(lic.id);
                }
            };

            licenseGrid.appendChild(card);
        });

        buyBox.innerHTML = '';
        buyBox.appendChild(licenseGrid);

        // 🔥 Auto-select Logic (Persisted or Default)
        const savedLicId = localStorage.getItem(`offszn_lic_select_${product.id}`);
        const validLicIds = licenses.filter(l => l.enabled).map(l => l.id);

        console.log(`[LicPersistence] Product ${product.id} - Saved: ${savedLicId}, Valid: ${validLicIds.join(',')}`);

        if (savedLicId && validLicIds.includes(savedLicId)) {
            console.log(`[LicPersistence] Restoring selection: ${savedLicId}`);
            selectLicense(savedLicId);
        } else if (validLicIds.length > 0) {
            console.log(`[LicPersistence] Defaulting to first: ${validLicIds[0]}`);
            selectLicense(validLicIds[0]);
        }

        // 5. Action Footer (Add to Cart + Free Download)
        const footerActions = document.createElement('div');
        footerActions.className = 'beat-actions-footer';
        footerActions.style.marginTop = '20px';
        footerActions.style.display = 'flex';
        footerActions.style.flexDirection = 'column';
        footerActions.style.gap = '10px';

        const cartBtn = document.createElement('button');
        cartBtn.className = 'btn-glass-primary';
        cartBtn.innerHTML = '<i class="bi bi-cart-plus"></i> Añadir al Carrito';
        cartBtn.onclick = () => {
            const selected = document.querySelector('.license-card-v2.selected');
            if (selected) {
                const licId = selected.id.replace('lic-card-', '');
                addToCart(product.id, licId);
            } else {
                alert('Por favor selecciona una licencia');
            }
        };
        footerActions.appendChild(cartBtn);

        // FREE DOWNLOAD BUTTON (Bypasses licenses if active)
        if (product.is_free) {
            const freeBtn = document.createElement('button');
            freeBtn.className = 'btn-minimal-link';
            freeBtn.style.justifyContent = 'center';
            freeBtn.style.width = '100%';
            freeBtn.innerHTML = '<i class="bi bi-download"></i> Descargar Gratis (MP3 con Tag)';
            freeBtn.onclick = () => {
                if (window.openDownloadGateModal) {
                    window.openDownloadGateModal(product.audio_url, product.producer?.nickname, product.id);
                } else {
                    window.open(product.audio_url, '_blank');
                }
            };
            footerActions.appendChild(freeBtn);
        }

        buyBox.appendChild(footerActions);

    } catch (err) {
        console.error("Error rendering beat licenses:", err);
        buyBox.innerHTML = '<p style="color:red;">Error al cargar las licencias.</p>';
    }

    // Standard Player (Targeting Sidebar Overlay)
    initStandardPlayer(product);
}

function getFilesPreview(files, licenseName) {
    const active = ['MP3']; // 🔥 Always included
    if (files?.wav) active.push('WAV');
    if (files?.stems) active.push('STEMS');

    // 🔥 Unlimited check for Exclusivity
    if (licenseName && licenseName.toLowerCase().includes('unlimited')) {
        active.push('EXCLUSIVIDAD');
    }

    return active.join(', ');
}

function selectLicense(id) {
    document.querySelectorAll('.license-card-v2').forEach(c => c.classList.remove('selected'));
    const target = document.getElementById(`lic-card-${id}`);
    if (target) {
        target.classList.add('selected');
        // Persist Selection
        if (window.currentProductData) {
            const key = `offszn_lic_select_${window.currentProductData.id}`;
            localStorage.setItem(key, id);
            console.log(`[LicPersistence] Saved selection '${id}' to '${key}'`);
        } else {
            console.warn("[LicPersistence] Cannot save selection - No currentProductData");
        }
    }
}

/**
 * LICENSE MODAL LOGIC
 */
window.openLicenseModal = function (lic, product) {
    let backdrop = document.getElementById('lic-details-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'lic-details-backdrop';
        backdrop.className = 'share-modal-backdrop'; // Reuse same backdrop style
        backdrop.onclick = (e) => { if (e.target === backdrop) closeLicenseModal(); };
        document.body.appendChild(backdrop);
    }

    const price = lic.price || 0;
    const priceStr = price > 0 ? `$${parseFloat(price).toFixed(2)}` : 'Gratis';

    backdrop.innerHTML = `
        <div class="share-modal-content lic-modal">
            <div class="lic-modal-header">
                <h3>Detalles de la Licencia</h3>
                <button onclick="closeLicenseModal()" class="lic-modal-close"><i class="bi bi-x-lg"></i></button>
            </div>
            
            <div class="lic-modal-body">
                <div class="lic-top-info">
                    <div class="lic-main-meta">
                        <span class="lic-modal-name">${lic.name || 'Licencia'}</span>
                        <span class="lic-modal-files">${getFilesPreview(lic.files, lic.name)}</span>
                    </div>
                    <div class="lic-modal-price">${priceStr}</div>
                </div>

                <div class="lic-section">
                    <span class="lic-section-title">DETALLES DE USO</span>
                    <div class="lic-features-list">
                        <div class="lic-feature-item">
                            <i class="bi bi-music-note-beamed"></i>
                            <span><b>Streams:</b> ${lic.streams || 'Limitado'}</span>
                        </div>
                        <div class="lic-feature-item">
                            <i class="bi bi-cart-check"></i>
                            <span><b>Ventas:</b> ${lic.sales || 'Limitado'}</span>
                        </div>
                        <div class="lic-feature-item">
                            <i class="bi bi-broadcast"></i>
                            <span><b>Radio:</b> ${lic.radio || 'No permitido'}</span>
                        </div>
                        <div class="lic-feature-item">
                            <i class="bi bi-file-earmark-pdf"></i>
                            <span><b>Certificado:</b> PDF Oficial</span>
                        </div>
                    </div>
                </div>

                <div class="lic-section">
                    <span class="lic-section-title">ARCHIVOS INCLUIDOS</span>
                    <div class="lic-check-grid">
                        <div class="lic-check-item active"> <!-- 🔥 MP3 ALWAYS GREEN -->
                            <i class="bi bi-check-circle-fill"></i> MP3
                        </div>
                        <div class="lic-check-item ${lic.files?.wav ? 'active' : ''}">
                            <i class="bi bi-check-circle-fill"></i> WAV
                        </div>
                        <div class="lic-check-item ${lic.files?.stems ? 'active' : ''}">
                            <i class="bi bi-check-circle-fill"></i> STEMS
                        </div>
                        <div class="lic-check-item active">
                            <i class="bi bi-check-circle-fill"></i> PDF LICENSE
                        </div>
                    </div>
                </div>

                <button class="btn-glass-primary-v2" style="width:100%; margin-top:20px;" onclick="selectLicenseAndClose('${lic.id}')">
                    OK, SELECCIONAR
                </button>
            </div>
        </div>
    `;

    backdrop.style.display = 'flex';
    setTimeout(() => backdrop.classList.add('active'), 10);
}

window.closeLicenseModal = function () {
    const backdrop = document.getElementById('lic-details-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        setTimeout(() => backdrop.style.display = 'none', 300);
    }
}

window.selectLicenseAndClose = function (id) {
    selectLicense(id);
    window.closeLicenseModal();
    window.closeLicenseComparisonModal(); // Also close comparison if open
}

window.openLicenseComparisonModal = function (licenses) {
    let backdrop = document.getElementById('lic-compare-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'lic-compare-backdrop';
        backdrop.className = 'share-modal-backdrop';
        backdrop.style.zIndex = '10000'; // High z-index
        backdrop.onclick = (e) => { if (e.target === backdrop) closeLicenseComparisonModal(); };
        document.body.appendChild(backdrop);
    }

    const enabledLicenses = licenses.filter(l => l.enabled);

    // Build Header
    let gridCols = `1fr repeat(${enabledLicenses.length}, 1fr)`;

    let html = `
        <div class="share-modal-content lic-modal" style="max-width: 900px; width: 95%;">
            <div class="lic-modal-header">
                <h3>Comparar Licencias</h3>
                <button onclick="closeLicenseComparisonModal()" class="lic-modal-close"><i class="bi bi-x-lg"></i></button>
            </div>
            
            <div class="lic-modal-body" style="overflow-x: auto;">
                <div class="compare-grid" style="display: grid; grid-template-columns: ${gridCols}; gap: 10px; min-width: 600px;">
                    
                    <!-- Header Row: Names -->
                    <div class="compare-cell header feature-col">Beneficios</div>
                    ${enabledLicenses.map(l => `<div class="compare-cell header">${l.name}</div>`).join('')}

                    <!-- Price Row -->
                    <div class="compare-cell feature-col">Precio</div>
                    ${enabledLicenses.map(l => `<div class="compare-cell price">${parseFloat(l.price) > 0 ? '$' + parseFloat(l.price).toFixed(2) : 'Gratis'}</div>`).join('')}

                    <!-- MP3 -->
                    <div class="compare-cell feature-col">MP3</div>
                    ${enabledLicenses.map(l => `<div class="compare-cell check"><i class="bi bi-check-circle-fill active"></i></div>`).join('')}

                    <!-- WAV -->
                    <div class="compare-cell feature-col">WAV</div>
                    ${enabledLicenses.map(l => `<div class="compare-cell check">${l.files?.wav ? '<i class="bi bi-check-circle-fill active"></i>' : '<i class="bi bi-x-circle inactive"></i>'}</div>`).join('')}

                    <!-- STEMS -->
                    <div class="compare-cell feature-col">Trackout (Stems)</div>
                    ${enabledLicenses.map(l => `<div class="compare-cell check">${l.files?.stems ? '<i class="bi bi-check-circle-fill active"></i>' : '<i class="bi bi-x-circle inactive"></i>'}</div>`).join('')}

                    <!-- STREAMS -->
                    <div class="compare-cell feature-col">Streams</div>
                    ${enabledLicenses.map(l => `<div class="compare-cell">${l.streams}</div>`).join('')}
                    
                    <!-- SALES -->
                    <div class="compare-cell feature-col">Ventas</div>
                    ${enabledLicenses.map(l => `<div class="compare-cell">${l.sales}</div>`).join('')}

                    <!-- RADIO -->
                    <div class="compare-cell feature-col">Radio</div>
                    ${enabledLicenses.map(l => `<div class="compare-cell">${l.radio}</div>`).join('')}

                    <!-- EXCLUSIVITY ROW (Only if Unlimited exists) -->
                    <div class="compare-cell feature-col" style="color: #A020F0; font-weight: bold;">Exclusividad</div>
                     ${enabledLicenses.map(l => `<div class="compare-cell check">${(l.name.toLowerCase().includes('unlimited')) ? '<i class="bi bi-check-circle-fill active" style="color:#A020F0"></i>' : '<i class="bi bi-x-circle inactive"></i>'}</div>`).join('')}

                    <!-- SELECT BUTTONS -->
                    <div class="compare-cell feature-col"></div>
                    ${enabledLicenses.map(l => `
                        <div class="compare-cell">
                            <button class="btn-glass-primary-v2" style="font-size:0.8rem; padding: 6px 12px; height: auto;" onclick="selectLicenseAndClose('${l.id}')">
                                Elegir
                            </button>
                        </div>
                    `).join('')}

                </div>
            </div>
            
            <style>
                .compare-cell { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; text-align: center; color: #ccc; font-size: 0.9rem; }
                .compare-cell.feature-col { justify-content: flex-start; text-align: left; font-weight: 600; color: #fff; background: rgba(255,255,255,0.02); }
                .compare-cell.header { font-weight: 800; color: #fff; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 15px; align-items: flex-end; }
                .compare-cell.price { color: #00ff88; font-weight: bold; font-size: 1.1rem; }
                .compare-cell.check i { font-size: 1.2rem; }
                .compare-cell.check i.active { color: #00ff88; }
                .compare-cell.check i.inactive { color: #444; }
                
                @media (max-width: 600px) {
                    .compare-cell { font-size: 0.8rem; padding: 5px; }
                     /* Force horizontal scroll on mobile */
                }
            </style>
        </div>
    `;

    backdrop.innerHTML = html;
    backdrop.style.display = 'flex';
    setTimeout(() => backdrop.classList.add('active'), 10);
}

window.closeLicenseComparisonModal = function () {
    const backdrop = document.getElementById('lic-compare-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        setTimeout(() => backdrop.style.display = 'none', 300);
    }
}

/**
 * SCENARIO B: PRESET
 */
function renderPresetSpecifics(product) {
    const category = (product.category || '').toLowerCase();
    const productType = (product.product_type || '').toLowerCase();

    // Broad matching for A/B comparison capability
    const isAB = category.includes('voces') ||
        category.includes('plantilla') ||
        productType === 'plantilla' ||
        (product.audio_before_url && product.audio_before_url !== 'null');

    console.log(`[PresetRender] isAB: ${isAB} | Before: ${product.audio_before_url} | After: ${product.audio_after_url}`);

    const buyBox = document.getElementById('buying-modules');
    if (!buyBox) return;

    buyBox.innerHTML = '';
    const buyBtn = document.createElement('button');
    buyBtn.className = 'btn-purchase-kit';

    if (product.is_free) {
        buyBtn.innerHTML = 'DESCARGA GRATIS';
        buyBtn.onclick = () => {
            const downloadUrl = product.download_url_wav || product.download_url_stems || product.wav_url || product.stems_url || product.audio_url;
            if (window.openDownloadGateModal) {
                window.openDownloadGateModal(downloadUrl, product.producer?.nickname, product.id);
            } else {
                window.open(downloadUrl, '_blank');
                incrementProductStat(product.id, 'downloads_count');
            }
        };
    } else {
        buyBtn.innerHTML = `Comprar Preset - $${product.price_basic || '0.00'}`;
        buyBtn.onclick = () => addToCart(product.id, 'basic');
    }
    buyBox.appendChild(buyBtn);

    if (isAB) {
        // 🔥 Inject "Comparar" button into header (matching Beat style)
        const header = document.getElementById('licenses-header');

        // Finalized naming check: User might be looking for "Comparar"
        if (header) {
            // Remove previous if exists
            const existing = document.getElementById('btn-ab-compare-link');
            if (existing) existing.remove();

            const abLink = document.createElement('button');
            abLink.id = 'btn-ab-compare-link';
            abLink.className = 'btn-minimal-link';
            abLink.style.fontSize = '0.9rem';
            abLink.style.fontWeight = '600';
            abLink.style.color = '#A020F0'; // Purple for A/B vs White for License Comp
            abLink.innerHTML = '<i class="bi bi-intersect" style="margin-right:5px;"></i> Comparar A/B';

            // Mapping for Presets: "Before" is usually audio_url (Standard preview) 
            // and "After" is audio_after_url.
            const urlBefore = (product.audio_before_url && product.audio_before_url !== 'null')
                ? product.audio_before_url
                : product.audio_url; // Use standard audio_url as Before for Presets/Plantillas

            const urlAfter = (product.audio_after_url && product.audio_after_url !== 'null')
                ? product.audio_after_url
                : null;

            const hasFiles = urlBefore && urlBefore !== 'null' && urlAfter && urlAfter !== 'null';

            abLink.onclick = () => {
                if (hasFiles) {
                    openABModal(urlBefore, urlAfter, product);
                } else {
                    alert("Esta plantilla no tiene configurados los audios ANTES y DESPUÉS.");
                }
            };
            header.appendChild(abLink);
            console.log("[A/B] Button injected for Preset/Plantilla");
        }

        // Use standard player in sidebar as backup/preview
        initStandardPlayer(product);
    } else {
        initStandardPlayer(product);
    }
}

/**
 * SCENARIO D: GENERIC / FALLBACK
 */
function renderGenericSpecifics(product) {
    const buyBox = document.getElementById('buying-modules');
    if (!buyBox) return;

    buyBox.innerHTML = '';
    const buyBtn = document.createElement('button');
    buyBtn.className = 'btn-glass-primary';

    if (product.is_free) {
        buyBtn.innerHTML = 'DESCARGAR GRATIS';
        buyBtn.onclick = () => {
            const downloadUrl = product.download_url || product.audio_url;
            window.open(downloadUrl, '_blank');
        };
    } else {
        buyBtn.innerHTML = `Comprar - $${product.price_basic || '0.00'}`;
        buyBtn.onclick = () => addToCart(product.id, 'basic');
    }
    buyBox.appendChild(buyBtn);
    initStandardPlayer(product);
}

/**
 * SCENARIO C: KITS
 */
/**
 * SCENARIO C: KITS
 */
function renderKitSpecifics(product) {
    // Metadata handled in MAIN render. Only Buying Buttons here.
    const buyBox = document.getElementById('buying-modules');

    // Primary Buy Button (Glass)
    const buyBtn = document.createElement('button');
    buyBtn.className = 'btn-glass-primary'; // LUXURY STYLE (WHITE/BLACK)

    if (product.is_free) {
        // Free Product: Show "DESCARGA GRATIS" ONLY (Clean)
        buyBtn.innerHTML = `DESCARGA GRATIS`;
        buyBtn.onclick = () => {
            const downloadUrl = product.download_url_wav || product.download_url_stems || product.wav_url || product.stems_url || product.audio_url;
            if (window.openDownloadGateModal) {
                window.openDownloadGateModal(downloadUrl, product.producer?.nickname, product.id);
            } else {
                window.open(downloadUrl, '_blank');
                incrementProductStat(product.id, 'downloads_count');
            }
        };
    } else {
        // Paid Product
        buyBtn.innerHTML = `COMPRAR KIT - $${product.price_basic || '0.00'}`;
        buyBtn.onclick = () => addToCart(product.id, 'basic');
    }

    buyBox.appendChild(buyBtn);

    // Free Download (Secondary) - Rendered HERE for Luxury Layout
    // Fix: Do not show secondary free button if the main button is already Free (Drumkits).
    // Only show for Beats where "Free Download" is secondary to "Buy License".
    if (product.is_free && product.product_type !== 'drumkit' && product.product_type !== 'loopkit') {
        const freeBtn = document.createElement('button');
        freeBtn.className = 'btn-minimal-link';
        freeBtn.style.margin = '10px auto';
        freeBtn.innerHTML = `<i class="bi bi-arrow-down-circle"></i> Descargar Demo / Gratis`;
        freeBtn.onclick = () => window.open(product.audio_url, '_blank');
        buyBox.appendChild(freeBtn);
    }

    initStandardPlayer(product);
}

/**
 * AUDIO LOGIC: Standard Wrapper - Delegates to StickyPlayer
 */
// let wavesurfer = null; // Removed local instance to avoid conflicts

function initStandardPlayer(product) {
    const playerTarget = document.getElementById('sidebar-player-target');
    if (!playerTarget) return;

    // Check if we are in "Luxury" mode (Box style) or "Overlay" mode
    const isLuxury = playerTarget.classList.contains('product-hero-player-box');
    const btnId = `btn-play-${product.id}`;

    if (isLuxury) {
        // LINEAR WAVEFORM LAYOUT
        playerTarget.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <button id="${btnId}" style="background:none; border:none; color:#fff; font-size:1.5rem; cursor:pointer; transition: transform 0.2s;" onclick="toggleProductPlay('${product.id}')">
                    <i class="bi bi-play-fill"></i>
                </button>
                <div id="waveform-linear" style="flex:1; opacity:0.5;"></div>
            </div>
            <div style="font-size:0.7rem; color:#666; margin-top:6px; text-align:right;">PREVIEW</div>
        `;
        // Optional: Render a static waveform or just leave empty for now. 
        // Syncing a sidebar waveform to StickyPlayer requires more complex logic (like in profile-public.js).
        // For now, we prioritize the functionality: BUTTON TRIGGERS STICKY PLAYER.

    } else {
        // OVERLAY BUTTON (Standard)
        playerTarget.innerHTML = `
             <button class="play-btn-circle" id="${btnId}" style="width:50px; height:50px; font-size:1.5rem; box-shadow:0 4px 12px rgba(0,0,0,0.5);" onclick="toggleProductPlay('${product.id}')">
                <i class="bi bi-play-fill"></i>
            </button>
        `;
        // function addToCart... replacement pending verify
        window.toggleProductPlay = function (id) {
            // We need the product object. Since we are inside the closure or render loop, 
            // the cleanest way without passing big objects in HTML is to rely on cache or pass it here.
            // But we already have 'product' in scope of initStandardPlayer.
            // Wait, onclick stringification is messy for objects.
            // Better: use direct element assignment or cache.

            if (window.StickyPlayer) {
                // If ID matches current, toggle. Else play.
                // But we need the object to play new. 
                // Let's store currentProduct globally or use a closure for the button.
            }
        };
    }

    // BETTER APPROACH: Direct Event Listener to avoid stringifying
    setTimeout(() => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.onclick = (e) => {
                e.stopPropagation();
                if (window.StickyPlayer) {
                    window.StickyPlayer.play(product);
                }
            };
        }
    }, 0);
}

/**
 * AUDIO LOGIC: Advanced A/B Switcher (Synchronized Dual Waveforms)
 */
/**
 * AUDIO LOGIC: A/B Modal (Fullscreen Comparison)
 */
window.openABModal = function (beforeUrl, afterUrl, product) {
    if (!beforeUrl || beforeUrl === 'null' || !afterUrl || afterUrl === 'null') {
        console.warn("A/B files not available for this product");
        return;
    }
    const productName = product.name;
    let backdrop = document.getElementById('ab-modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'ab-modal-backdrop';
        backdrop.className = 'share-modal-backdrop';
        backdrop.style.zIndex = '10001';

        backdrop.onclick = (e) => { if (e.target === backdrop) window.closeABModal(); };

        backdrop.innerHTML = `
            <div class="share-modal-content ab-modal-box" style="max-width: 800px; padding: 45px; border-radius: 32px; background: radial-gradient(circle at top left, rgba(25, 25, 25, 0.98), rgba(10, 10, 10, 0.99)); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(30px); box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.8);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:35px;">
                     <div style="display:flex; flex-direction:column; gap:8px;">
                        <h3 style="color:#fff; margin:0; font-size: 1.85rem; font-weight: 800; letter-spacing: -0.8px; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">Comparación A/B</h3>
                        <span id="ab-modal-product-name" style="color:#A020F0; font-size: 1rem; font-weight: 600; opacity: 0.9; display: flex; align-items: center; gap: 8px;">
                            <i class="bi bi-disc-fill"></i> ${productName}
                        </span>
                     </div>
                     <button onclick="closeABModal()" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:#fff; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);" onmouseover="this.style.background='rgba(255,255,255,0.15)'; this.style.transform='rotate(90deg) scale(1.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.transform='rotate(0) scale(1)'">
                        <i class="bi bi-x-lg"></i>
                     </button>
                </div>
                
                <div id="ab-modal-player-container"></div>

                <div style="margin-top: 45px; padding: 18px; background: linear-gradient(90deg, rgba(160, 32, 240, 0.1), rgba(160, 32, 240, 0.02)); border-radius: 20px; border: 1px solid rgba(160, 32, 240, 0.2); color: #c896ff; font-size: 0.95rem; text-align: center; display: flex; align-items: center; justify-content: center; gap: 14px; font-weight: 500; letter-spacing: 0.2px;">
                    <i class="bi bi-info-circle-fill" style="color: #A020F0; font-size: 1.2rem; filter: drop-shadow(0 0 5px rgba(160, 32, 240, 0.5));"></i> Ambos archivos se reproducen en sincronía. Pulsa ANTES o DESPUÉS para comparar en tiempo real.
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
    } else {
        document.getElementById('ab-modal-product-name').innerHTML = `<i class="bi bi-disc-fill"></i> ${productName}`;
    }

    const playerContainer = document.getElementById('ab-modal-player-container');
    initABPlayerInContainer(beforeUrl, afterUrl, playerContainer, product.id);

    backdrop.style.display = 'flex';
    setTimeout(() => backdrop.classList.add('active'), 10);
};

window.closeABModal = function () {
    const backdrop = document.getElementById('ab-modal-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        setTimeout(() => {
            backdrop.style.display = 'none';
            if (window.modalWsBefore) { window.modalWsBefore.destroy(); window.modalWsBefore = null; }
            if (window.modalWsAfter) { window.modalWsAfter.destroy(); window.modalWsAfter = null; }
        }, 300);
    }
};

function initABPlayerInContainer(beforeUrl, afterUrl, container, productId) {
    let hasCountedPlay = false;

    container.innerHTML = `
        <div class="ab-modal-player-container">
            <div class="ab-waveforms">
                <div class="wave-row">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                        <div class="wave-label" style="color:#fff; opacity: 0.8;">
                            <i class="bi bi-mic-fill" style="color: #666; font-size: 1rem;"></i> ANTES (RAW)
                        </div>
                        <div id="modal-time-before" style="font-family: 'Inter', monospace; font-size: 0.85rem; color: #888; font-weight: 600;">0:00</div>
                    </div>
                    <div class="wave-container" id="modal-waveform-before"></div>
                </div>
                <div class="wave-row">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                        <div class="wave-label" style="color:#A020F0;">
                            <i class="bi bi-magic" style="font-size: 1.1rem; filter: drop-shadow(0 0 5px rgba(160, 32, 240, 0.4));"></i> DESPUÉS (PRO)
                        </div>
                        <div id="modal-time-after" style="font-family: 'Inter', monospace; font-size: 0.85rem; color: #888; font-weight: 600;">0:00</div>
                    </div>
                    <div class="wave-container" id="modal-waveform-after"></div>
                </div>
            </div>
            
            <div class="ab-controls" style="margin-top:45px; display: flex; align-items: center; justify-content: center; gap: 35px;">
                <button class="modal-ab-play-pause" id="modal-ab-play-pause">
                    <i class="bi bi-play-fill"></i>
                </button>
                
                <div class="ab-toggle-switch-premium">
                    <button class="ab-toggle-btn active" id="modal-btn-raw">Antes</button>
                    <button class="ab-toggle-btn" id="modal-btn-pro">Después</button>
                </div>
            </div>
        </div>
    `;

    const vibrantTheme = {
        waveColor: '#444',
        progressColor: '#8b5cf6',
        cursorColor: '#fff',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 90
    };

    const mutedTheme = {
        waveColor: '#222',
        progressColor: '#444',
        cursorColor: 'transparent',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 90
    };

    const commonWsConfig = {
        normalize: true,
        interact: true,
        responsive: true
    };

    const wsBefore = WaveSurfer.create({
        ...commonWsConfig,
        ...vibrantTheme,
        container: '#modal-waveform-before',
        url: beforeUrl
    });

    const wsAfter = WaveSurfer.create({
        ...commonWsConfig,
        ...mutedTheme,
        container: '#modal-waveform-after',
        url: afterUrl
    });

    window.modalWsBefore = wsBefore;
    window.modalWsAfter = wsAfter;

    wsAfter.setVolume(0);
    wsBefore.setVolume(1);

    const playBtn = document.getElementById('modal-ab-play-pause');
    const timeBefore = document.getElementById('modal-time-before');
    const timeAfter = document.getElementById('modal-time-after');

    const formatTime = (time) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    playBtn.onclick = () => {
        if (wsBefore.isPlaying()) {
            wsBefore.pause();
            wsAfter.pause();
        } else {
            wsBefore.play();
            wsAfter.play();

            // Track Play only once per modal session
            if (!hasCountedPlay && productId) {
                if (window.incrementProductStat) {
                    window.incrementProductStat(productId, 'plays_count');
                } else {
                    console.log("[A/B] Play tracking fallback skip");
                }
                hasCountedPlay = true;
            }
        }
    };

    wsBefore.on('play', () => playBtn.innerHTML = '<i class="bi bi-pause-fill"></i>');
    wsBefore.on('pause', () => playBtn.innerHTML = '<i class="bi bi-play-fill"></i>');

    // 🚀 Optimized Sync Logic (Avoids constant seeking jitter)
    wsBefore.on('timeupdate', (time) => {
        timeBefore.innerText = formatTime(time);

        // Only seek wsAfter if it drifts by more than 0.3s (Loose sync for audio smoothness)
        if (Math.abs(wsAfter.getCurrentTime() - time) > 0.3) {
            wsAfter.setTime(time);
        }
    });

    wsAfter.on('timeupdate', (time) => {
        timeAfter.innerText = formatTime(time);
    });

    wsBefore.on('interaction', (time) => wsAfter.setTime(time));
    wsAfter.on('interaction', (time) => wsBefore.setTime(time));
    wsBefore.on('drag', (time) => wsAfter.setTime(time));
    wsAfter.on('drag', (time) => wsBefore.setTime(time));

    const rawBtn = document.getElementById('modal-btn-raw');
    const proBtn = document.getElementById('modal-btn-pro');

    rawBtn.onclick = () => {
        wsAfter.setVolume(0);
        wsBefore.setVolume(1);

        // Lighter theme switching (only update non-heavy properties if possible)
        wsBefore.setOptions(vibrantTheme);
        wsAfter.setOptions(mutedTheme);

        rawBtn.classList.add('active');
        rawBtn.style.background = '#fff';
        rawBtn.style.color = '#000';
        rawBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
        proBtn.classList.remove('active');
        proBtn.style.background = 'transparent';
        proBtn.style.color = '#888';
        proBtn.style.boxShadow = 'none';
    };

    proBtn.onclick = () => {
        wsBefore.setVolume(0);
        wsAfter.setVolume(1);

        wsAfter.setOptions(vibrantTheme);
        wsBefore.setOptions(mutedTheme);

        proBtn.classList.add('active');
        proBtn.style.background = '#fff';
        proBtn.style.color = '#000';
        proBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
        rawBtn.classList.remove('active');
        rawBtn.style.background = 'transparent';
        rawBtn.style.color = '#888';
        rawBtn.style.boxShadow = 'none';
    };
}

/**
 * Placeholder for global cart integration
 */
window.addToCart = (id, license) => {
    // 1. Get Product Data from global scope (set in init)
    const product = window.currentProductData;
    if (!product) {
        console.error("No product data found for cart add");
        return;
    }

    // 2. Determine Price & License Name & Details
    let finalPrice = parseFloat(product.price_basic) || 0;
    let licenseName = 'Basic License'; // Default
    let licenseId = license || 'basic';
    let licenseDetails = {};

    // Get available licenses dict if present
    const availLicenses = product.available_licenses || [];
    let selectedLicObj = null;

    // If it's a beat/license selection
    const selectedCard = document.querySelector('.license-card-v2.selected');
    if (selectedCard) {
        licenseId = selectedCard.id.replace('lic-card-', '');
        selectedLicObj = availLicenses.find(l => l.id === licenseId);
    } else if (license) {
        // Direct pass (fallback)
        selectedLicObj = availLicenses.find(l => l.id === licenseId);
    }

    if (selectedLicObj) {
        finalPrice = parseFloat(selectedLicObj.price) || 0;
        licenseName = selectedLicObj.name;
        // Enrich details for accordion
        licenseDetails = {
            files_preview: getFilesPreview(selectedLicObj.files, selectedLicObj.name),
            streams: selectedLicObj.streams,
            sales: selectedLicObj.sales,
            radio: selectedLicObj.radio
        };
    }

    // 3. Construct Cart Item Object
    const cartItem = {
        id: product.id,
        name: product.name,
        price_basic: finalPrice, // Use the license price
        image_url: product.image_url,
        product_type: product.product_type,
        license: {
            id: licenseId,
            name: licenseName,
            details: licenseDetails // Pass details to cart
        }
    };

    // 4. Call Manager
    if (window.CartManager) {
        window.CartManager.addToCart(cartItem);
    } else {
        console.error("CartManager not initialized");
        alert("Error: Carrito no disponible");
    }
};

/**
 * RELATED PRODUCTS LOGIC
 */
async function fetchRelatedProducts(currentProduct) {
    const container = document.getElementById('product-related-container');
    if (!container) return;

    try {
        console.log("[Related] Fetching for:", currentProduct.id, currentProduct.product_type, currentProduct.category);

        let allRelated = [];

        // STAGE 1: Same Producer + Same Category
        const { data: stage1 } = await window.supabaseClient
            .from('products')
            .select('*, producer:producer_id (nickname, avatar_url, is_verified)')
            .eq('producer_id', currentProduct.producer_id)
            .eq('category', currentProduct.category)
            .eq('product_type', currentProduct.product_type)
            .neq('id', currentProduct.id)
            .limit(10);

        if (stage1 && stage1.length > 0) {
            allRelated = [...stage1];
            console.log("[Related] Stage 1 found:", stage1.length);
        }

        // STAGE 2: Same Category (Other Producers) if needed
        if (allRelated.length < 10 && currentProduct.category) {
            const { data: stage2 } = await window.supabaseClient
                .from('products')
                .select('*, producer:producer_id (nickname, avatar_url, is_verified)')
                .neq('producer_id', currentProduct.producer_id)
                .eq('category', currentProduct.category)
                .eq('product_type', currentProduct.product_type)
                .neq('id', currentProduct.id)
                .limit(10 - allRelated.length);

            if (stage2 && stage2.length > 0) {
                allRelated = [...allRelated, ...stage2];
                console.log("[Related] Stage 2 found:", stage2.length);
            }
        }

        // STAGE 3: Same Type (Any Category) if still needed
        if (allRelated.length < 5) {
            const excludeIds = allRelated.map(p => p.id);
            excludeIds.push(currentProduct.id);

            const { data: stage3 } = await window.supabaseClient
                .from('products')
                .select('*, producer:producer_id (nickname, avatar_url, is_verified)')
                .eq('product_type', currentProduct.product_type)
                .not('id', 'in', `(${excludeIds.join(',')})`)
                .limit(10 - allRelated.length);

            if (stage3 && stage3.length > 0) {
                allRelated = [...allRelated, ...stage3];
                console.log("[Related] Stage 3 found:", stage3.length);
            }
        }

        // STAGE 4: ANY Product as absolute fallback
        if (allRelated.length < 3) {
            const excludeIds = allRelated.map(p => p.id);
            excludeIds.push(currentProduct.id);

            const { data: stage4 } = await window.supabaseClient
                .from('products')
                .select('*, producer:producer_id (nickname, avatar_url, is_verified)')
                .not('id', 'in', `(${excludeIds.join(',')})`)
                .limit(10 - allRelated.length);

            if (stage4 && stage4.length > 0) {
                allRelated = [...allRelated, ...stage4];
                console.log("[Related] Stage 4 found:", stage4.length);
            }
        }

        if (allRelated.length === 0) {
            container.innerHTML = '<div style="width:100%; text-align:center; color:#666; padding: 40px; font-size: 0.9rem;">No hay más productos recomendados en este momento.</div>';
            return;
        }

        renderRelatedGrid(allRelated, container);
    } catch (err) {
        console.error("Error fetching related products:", err);
    }
}

function renderRelatedGrid(products, container) {
    container.innerHTML = '';

    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'trending-card';

        const producer = p.producer || {};
        const producerName = producer.nickname || 'Unknown';
        const seoLink = window.createSeoLink ? window.createSeoLink(p) : `/product.html?id=${p.id}`;
        const plays = p.plays_count || 0;

        // Construct JSON for artist hover card
        const producerDataJSON = JSON.stringify({
            id: p.producer_id,
            nickname: producerName,
            avatar_url: producer.avatar_url,
            is_verified: producer.is_verified,
            stats: {
                followers: p.producer_followers || 0
            }
        }).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

        // Use EXACTLY the same structure as Profile Trending Cards (Trending / Packs)
        card.innerHTML = `
            <div class="t-card-cover">
                <img src="${p.image_url || '/images/portada-default.png'}" 
                     alt="${p.name}"
                     onerror="this.src='/images/portada-default.png'"
                     onclick="window.location.href='${seoLink}'">
                
                <button class="t-play-btn" id="t-play-${p.id}" title="Reproducir">
                    <i class="bi bi-play-fill"></i>
                </button>

                <div class="t-overlay-badge" title="Reproducciones" onclick="window.location.href='${seoLink}'">
                    <i class="bi bi-music-note-beamed"></i> ${plays}
                </div>
            </div>
            <div class="t-card-info">
                <h4 title="${p.name}" onclick="window.location.href='${seoLink}'">${p.name}</h4>
                <p class="t-card-author artist-hover-trigger collaborator-link-thin" 
                   data-artist="${producerDataJSON}"
                   onmouseenter="window.showArtistCard(event, this)" 
                   onmouseleave="window.hideArtistCard(event, this)"
                   onclick="window.location.href='/perfil-publico.html?id=${p.producer_id}'"
                   style="cursor:pointer; display: inline-block;">
                    ${producerName}
                </p>
            </div>
            <div class="t-meta-row" style="display: flex; gap: 6px; align-items: center; margin-top: -6px; font-size: 0.75rem; color: #555;">
                <span style="text-transform: capitalize;">${p.product_type || 'Beat'}</span>
                <span style="font-size:0.4rem;">●</span>
                <span>${p.bpm ? p.bpm + ' BPM' : 'New'}</span>
            </div>
        `;

        // Direct event listener for the play button to prevent navigation
        const playBtn = card.querySelector('.t-play-btn');
        if (playBtn) {
            playBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.StickyPlayer) {
                    window.StickyPlayer.play(p);
                }
            };
        }
        container.appendChild(card);
    });
}

// Global scroll function for arrows
window.scrollRelated = function (direction) {
    const container = document.getElementById('product-related-container');
    if (!container) return;

    // Scroll by 1 card width + gap (approx 20%)
    const scrollAmount = container.clientWidth * 0.2 * direction;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
};
/**
 * STATS LOGIC: Increment counters in Supabase
 */
window.incrementProductStat = async function (id, column) {
    // 1. Check LocalStorage Guard (Fast Client-side check)
    const storageKey = 'offszn_counted_stats';
    const countedStr = localStorage.getItem(storageKey) || '{}';
    let counted = {};
    try {
        counted = JSON.parse(countedStr);
    } catch (e) { counted = {}; }

    if (!counted[column]) counted[column] = [];

    if (counted[column].includes(String(id))) {
        console.log(`[Stats] ${column} already counted for ${id} in this session.`);
        return;
    }

    try {
        // 2. Determine Endpoint
        let endpoint = null;
        if (column === 'downloads_count') endpoint = `/api/products/${id}/download`;
        else if (column === 'views') endpoint = `/api/products/${id}/play`;

        if (endpoint) {
            // Use Server-side API (More robust, IP-limited)
            const token = localStorage.getItem('sb-access-token'); // Simple token retrieval
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(endpoint, { method: 'POST', headers });
            if (!res.ok) throw new Error(`API Error: ${res.status}`);

            const data = await res.json();
            if (data.counted) {
                // Mark as counted locally only if server actually counted it
                counted[column].push(String(id));
                localStorage.setItem(storageKey, JSON.stringify(counted));
            }
            console.log(`[Stats] ${column} synced via API:`, data.message);
        } else if (window.supabaseClient) {
            // Fallback for other columns (e.g. shares, etc if they exist)
            const { data, error: fetchErr } = await window.supabaseClient
                .from('products')
                .select(column)
                .eq('id', id)
                .single();

            if (fetchErr) throw fetchErr;

            const newCount = (data[column] || 0) + 1;
            await window.supabaseClient
                .from('products')
                .update({ [column]: newCount })
                .eq('id', id);

            counted[column].push(String(id));
            localStorage.setItem(storageKey, JSON.stringify(counted));
            console.log(`[Stats] ${column} incremented via direct DB for ${id} to ${newCount}`);
        }
    } catch (e) {
        console.warn(`[Stats] Error incrementing ${column}:`, e);
    }
}

// --- 10. GLOBAL CART OVERRIDE (CRITICAL FIX FOR LICENSE PRICE) ---
// This ensures that when "Add to Cart" is clicked, we grab the CURRENTLY SELECTED license price.
window.addToCart = (id, license) => {
    console.log("[Cart] Add requested for ID:", id);

    // 1. Get Product Data from global scope (set in init or passed)
    let product = window.currentProductData;

    // Fallback: Try to find in window.allProducts if defined (Context: Exploring/Marketplace)
    if (!product && window.allProducts) {
        product = window.allProducts.find(p => p.id == id);
    }

    if (!product) {
        console.error("No product data found for cart add");
        alert("Error: Datos del producto no cargados.");
        return;
    }

    // 2. Determine Price & License Name
    // DEFAULT from product
    let finalPrice = parseFloat(product.price_basic) || 0;
    let licenseName = product.product_type === 'beat' ? 'Basic Lease' : 'Standard License';
    let licenseId = license || 'basic'; // ID passed or default

    // CHECK FOR SELECTED LICENSE CARD (Detailed View)
    // The UI uses .license-card-v2.selected to indicate choice
    const selectedCard = document.querySelector('.license-card-v2.selected');

    if (selectedCard) {
        // We are in Detailed View and user selected a license
        // FIX: The class is .lic-price-v2 (found in renderBeatSpecifics)
        const cardPriceEl = selectedCard.querySelector('.lic-price-v2') || selectedCard.querySelector('.lic-price');
        const cardNameEl = selectedCard.querySelector('.lic-name');

        if (cardPriceEl) {
            // ROBUST PARSING: Extract digits and dot only.
            const rawPrice = cardPriceEl.innerText.trim();
            const match = rawPrice.match(/[0-9.]+/);
            if (match) {
                finalPrice = parseFloat(match[0]);
            } else if (rawPrice.toLowerCase().includes('gratis')) {
                finalPrice = 0;
            }
        }

        if (cardNameEl) {
            licenseName = cardNameEl.innerText.trim();
        }

        licenseId = selectedCard.id.replace('lic-card-', ''); // Ensure ID

    } else if (license && product.available_licenses) {
        // Passed explicit license ID (e.g. from specific button)
        // Try to find in product.available_licenses metadata if it exists
        const licObj = product.available_licenses.find(l => l.id === license);
        if (licObj) {
            finalPrice = parseFloat(licObj.price);
            licenseName = licObj.name;
        }
    }

    // 3. Construct Cart Item
    // IMPORTANT: WE PASS finalPrice AS 'price_basic' SO CART MANAGER SEES IT AS VARIANT PRICE
    const checkProduct = {
        ...product,
        price_basic: finalPrice, // OVERRIDE PRICE for Cart Item
        license: {
            name: licenseName,
            id: licenseId
        }
    };

    console.log(`[Cart] Adding ${product.name} - License: ${licenseName} ($${finalPrice})`);

    // 4. Call Manager
    if (window.CartManager) {
        window.CartManager.addToCart(checkProduct);
    } else {
        console.error("CartManager not initialized");
        alert("Error: Carrito no disponible. Recarga la página.");
    }
};
