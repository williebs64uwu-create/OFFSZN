/**
 * PRODUCT CORE JS - Smart Template Controller
 * Logic to render OFFSZN products dynamically based on type.
 */

// ============================================
// API CONFIG
// ============================================
let API_URL = `${window.OFFSZN_CONFIG?.API_BASE_URL || 'https://offszn.lat'}/api`;

/**
 * Utility: Sanitizes strings for DOM injection
 */
function escapeHTML(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, m => map[m]);
}

window.currentProductData = null;
window.claimedCouponData = null; // Store fetched coupon info

/** 
 * 🔥 DB SYNC: Check if the user has a claimed welcome coupon in the DB.
 * This ensures the "Coupon active" UI shows up even if they clear localStorage.
 */
async function syncClaimedCoupon(email) {
    if (!email) return;
    try {
        const { data, error } = await window.supabaseClient
            .from('cupones_bienvenida_offszn')
            .select('codigo_offszn, status_offszn')
            .eq('email_offszn', email)
            .maybeSingle();

        if (data && data.status_offszn === 'unclaimed') {

            localStorage.setItem('offszn_welcome_claimed', data.codigo_offszn);
            window.claimedCouponData = data.codigo_offszn;
        }
    } catch (err) {
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Get Product Data from Clean URL or Params
    const urlData = getProductIdFromUrl();
    if (!urlData.id && !urlData.slug) {
        window.location.href = 'explorar.html';
        return;
    }

    try {
        // 0. Get Session (for "My Like" status and Coupons)
        let currentUser = null;
        const sessionRes = await window.supabaseClient.auth.getSession();
        if (sessionRes.data && sessionRes.data.session) {
            currentUser = sessionRes.data.session.user;
            // Ensure userId is in localStorage for consistency in other checks
            localStorage.setItem('userId', currentUser.id);
            // Sync coupons if logged in
            if (currentUser.email) {
                await syncClaimedCoupon(currentUser.email);
            }
        }

        // 2. Fetch Data from Supabase (Dual Lookup: ID or Slug)
        // 2. Fetch Data from Supabase (Robust Dual Lookup)
        let product = null;
        let error = null;

        // Attempt 1: ID Lookup (Fastest)
        if (urlData.id) {
            const { data, error: err } = await window.supabaseClient
                .from('products')
                .select(`*, producer:producer_id (*)`)
                .eq('id', urlData.id)
                .neq('status', 'deleted') // Soft Delete Check
                .maybeSingle();

            // 🔥 SEO REDIRECT: If we found product via ID but the slug doesn't match the official public_slug,
            // we redirect to the correct canonical URL instead of failing.
            if (data && urlData.slug && data.public_slug && data.public_slug !== urlData.slug) {
                const currentPath = window.location.pathname;
                const newPath = currentPath.replace(urlData.slug, data.public_slug);
                if (newPath !== currentPath) {
                    window.location.replace(newPath);
                    return; // Prevent further execution
                }
            }
            product = data;
            error = err;
        }

        // Attempt 2: Slug Lookup (Fallback if ID failed or was invalid/collision)
        // This fixes cases where the URL parser mistakenly decodes part of the name (e.g. "bpm") as an ID.
        // Attempt 2: Slug Lookup (Fallback if ID failed or was invalid/collision)
        // This fixes cases where the URL parser mistakenly decodes part of the name (e.g. "bpm") as an ID.
        if (!product && urlData.slug) {

            const { data, error: err } = await window.supabaseClient
                .from('products')
                .select(`*, producer:producer_id (*)`)
                .eq('public_slug', urlData.slug)
                .neq('status', 'deleted') // Soft Delete Check
                .maybeSingle();

            product = data;
            if (err) error = err; // Update error only if this attempt also fails
        }

        if (error) {
            throw error;
        }

        if (!product) {
            throw new Error("Producto no encontrado.");
        }

        // --- PARALLEL DATA FETCHING (Likes & Followers) ---
        const promises = [];

        // A. Real Like Count
        const likesCountPromise = window.supabaseClient
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('target_id', product.id)
            .eq('target_type', 'product');

        // B. Did I Like?
        let userLikePromise = Promise.resolve({ count: 0 }); // Default false
        if (currentUser) {
            userLikePromise = window.supabaseClient
                .from('likes')
                .select('*', { count: 'exact', head: true })
                .eq('target_id', product.id)
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

        // 3. Inject Dynamic SEO (Title, Meta, Schema JSON-LD)
        injectDynamicSEO(product);

        // 4. Kick off the rendering
        renderProductPage(product);

        // --- NEW: Pending Coupon Activation on Return from Onboarding ---
        const pendingCoupon = localStorage.getItem('offszn_pending_coupon_claim');
        if (pendingCoupon === 'true' && currentUser) {
            localStorage.removeItem('offszn_pending_coupon_claim');


            try {
                // 1. Generate real code via Backend (Unique)
                const res = await fetch(`${API_URL.replace('/api', '')}/api/user/me/claim-welcome-coupon`, {
                    method: 'POST',
                    headers: AuthUtils.getAuthHeaderObj()
                });

                const data = await res.json();
                if (data.coupon) {
                    localStorage.setItem('offszn_welcome_claimed', data.coupon);
                    window.claimedCouponData = data.coupon;
                }

                // 2. Re-render to show code
                renderProductPage(product);

                // 3. Switch to promos tab
                setTimeout(() => {
                    if (typeof window.switchProductTab === 'function') {
                        window.switchProductTab('promos');
                    }
                }, 100);
            } catch (err) {
            }
        }

        // --- DASHBOARD PERSISTENCE SPECIAL: Auto-trigger download gate after onboarding redirect ---
        const shouldAutoDownload = localStorage.getItem('offszn_auto_download_trigger');
        if (shouldAutoDownload === 'true' && product.is_free) {
            localStorage.removeItem('offszn_auto_download_trigger');

            const producerName = product.producer?.nickname || 'Productor';
            const downloadUrl = product.download_url;
            if (downloadUrl) {
                setTimeout(() => {
                    openDownloadGateModal(downloadUrl, producerName, product.id);
                }, 800); // Give rendering some time to settle
            }
        }

        // 3.5 Increment Views (Backend API - Fixes 400 error)
        (async () => {
            try {
                await fetch(`${API_URL}/products/${product.id}/view`, { method: 'POST' });
            } catch (e) {
            }
        })();

        // 4. Fetch Related Products (Background)
        fetchRelatedProducts(product);

        // 5. 🔥 R2 Signing Check: Ensure all images (main + related) are signed
        if (window.signR2Images) {
            const container = document.getElementById('product-page-container');
            if (container) window.signR2Images(container);
        }

    } catch (err) {
        // 🛡️ SECURITY: Sanitize error message to prevent XSS if error comes from malicious input
        const safeErrMsg = (err.message || "Error desconocido").replace(/[<>{}\[\]]/g, '');
        document.getElementById('product-page-container').innerHTML = `
            <div style="text-align:center; padding:100px;">
                <h2>Error al cargar el producto</h2>
                <p>${safeErrMsg}</p>
                <a href="explorar.html" style="color:var(--accent-purple)">Volver a explorar</a>
            </div>
        `;
    }
});

/**
 * Parses URL to find the numeric ID or Public Slug.
 * Supports:
 * - /beat/slug-NAME-CODE (Auto-gen)
 * - /beat/custom-slug (Manual)
 * - ?p=CODE
 * - ?id=UUID
 */
function getProductIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const pCode = params.get('p');
    const legacyId = params.get('id');

    // 1. URL Path check: /beat/some-slug-CODE or /beat/some-custom-slug
    const pathParts = window.location.pathname.split('/').filter(p => p);

    // 🔥 NEW: Short Link Check: /p/CODE
    if (pathParts.length >= 2 && pathParts[pathParts.length - 2] === 'p') {
        const code = pathParts[pathParts.length - 1];
        if (code && window.IdObfuscator) {
            const decodedId = window.IdObfuscator.decodeId(code);

            if (decodedId && !isNaN(decodedId)) {
                return { id: decodedId, slug: null };
            }
        }
    }

    if (pathParts.length >= 2) {
        const lastPart = pathParts[pathParts.length - 1];
        const segments = lastPart.split('-');
        const code = segments.pop(); // Try to extract last part as code



        // Check if last segment is a valid ID code
        if (code && window.IdObfuscator) {
            const decodedId = window.IdObfuscator.decodeId(code);
            if (decodedId && !isNaN(decodedId)) {

                return { id: decodedId, slug: lastPart };
            }
        }

        // If no code or invalid code, treat the whole part as a manual slug
        return { id: null, slug: lastPart };
    }

    // 2. URL Param check: ?p=CODE
    if (pCode && window.IdObfuscator) {
        const decodedId = window.IdObfuscator.decodeId(pCode);
        return { id: decodedId, slug: null };
    }

    // 3. Legacy ID check: ?id=UUID
    if (legacyId) {
        // Robust check: matches both numeric (shuffled) and UUIDs
        if (!isNaN(legacyId) && legacyId.length < 15 && window.IdObfuscator) {
            const decoded = window.IdObfuscator.decodeId(legacyId);
            if (decoded) return { id: decoded, slug: null };
        }
        return { id: legacyId, slug: null };
    }

    return { id: null, slug: null };
}

/**
 * Description Formatter: Preserves line breaks and handles truncation
 */
window.formatDescription = function (text, limit = 800) {
    if (!text) return '';
    const cleanText = escapeHTML(text.trim());
    // Preserve line breaks faithfully but limit to 1 maximum consecutive break
    const faithfulText = cleanText.replace(/\n\s*\n+/g, '\n');
    const htmlText = faithfulText.replace(/\n/g, '<br>');

    if (faithfulText.length <= limit) return htmlText;

    // Split at limit but try to avoid cutting a word if possible
    const truncated = cleanText.substring(0, limit);
    const truncatedHtml = truncated.replace(/\n/g, '<br>');

    return `
        <div class="desc-content-wrapper">
            <div class="desc-short">${truncatedHtml}...</div>
            <div class="desc-full" style="display:none;">${htmlText}</div>
            <button class="desc-toggle-btn" onclick="window.toggleDescriptionDisplay(this)" style="background:none; border:none; color:#bb86fc; font-weight:700; padding:0; cursor:pointer; margin-top:5px; font-size:0.85rem;">Ver más</button>
        </div>
    `;
}

window.toggleDescriptionDisplay = function (btn) {
    const wrapper = btn.closest('.desc-content-wrapper');
    if (!wrapper) return;
    const short = wrapper.querySelector('.desc-short');
    const full = wrapper.querySelector('.desc-full');
    const isShowingFull = full.style.display !== 'none';

    if (isShowingFull) {
        full.style.display = 'none';
        short.style.display = 'block';
        btn.innerText = 'Ver más';
    } else {
        full.style.display = 'block';
        short.style.display = 'none';
        btn.innerText = 'Ver menos';
    }
}

/**
 * 🔥 SEO: Dynamically inject title, meta tags, OG tags, and JSON-LD Schema
 * This makes each product page discoverable by Google with rich snippets.
 */
function injectDynamicSEO(product) {
    // 1. Build SEO data
    const producerData = Array.isArray(product.producer) ? product.producer[0] : product.producer;
    const producerName = producerData?.nickname || 'OFFSZN';
    const pType = (product.product_type || '').toLowerCase();
    const categoryLabel = pType === 'beat' ? 'Beat' : pType === 'drumkit' ? 'Drum Kit' : pType === 'preset' ? 'Preset' : 'Producto';
    const price = product.price_basic || product.price || 0;
    const currency = 'USD';
    const coverUrl = product.image_url || 'https://offszn.lat/images/logo.webp';
    const productUrl = window.location.href;
    const safeProductName = escapeHTML(product.name);
    const safeProducerName = escapeHTML(producerName);

    // 2. Set Document Title (MOST IMPORTANT for Google)
    document.title = `${safeProductName} - ${safeProducerName} | OFFSZN`;

    // 3. Set or Update Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
    }
    const descText = product.is_free
        ? `Descarga GRATIS "${product.name}" por ${producerName}. ${categoryLabel} disponible en OFFSZN.lat`
        : `Escucha y compra "${product.name}" por ${producerName}. ${categoryLabel} a $${price}. Licencia disponible en OFFSZN.lat`;
    metaDesc.content = descText;

    // 4. Set Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
    }
    canonical.href = productUrl;

    // 5. Set Open Graph Tags
    const ogTags = {
        'og:title': `${product.name} - ${producerName} | OFFSZN`,
        'og:description': descText,
        'og:image': coverUrl,
        'og:url': productUrl,
        'og:type': 'product',
        'og:site_name': 'OFFSZN',
        'og:locale': 'es_PE'
    };

    for (const [prop, content] of Object.entries(ogTags)) {
        let tag = document.querySelector(`meta[property="${prop}"]`);
        if (!tag) {
            tag = document.createElement('meta');
            tag.setAttribute('property', prop);
            document.head.appendChild(tag);
        }
        tag.content = content;
    }

    // 6. Set Twitter Card Tags
    const twitterTags = {
        'twitter:card': 'summary_large_image',
        'twitter:title': `${safeProductName} - ${safeProducerName} | OFFSZN`,
        'twitter:description': descText,
        'twitter:image': coverUrl
    };

    for (const [name, content] of Object.entries(twitterTags)) {
        let tag = document.querySelector(`meta[name="${name}"]`);
        if (!tag) {
            tag = document.createElement('meta');
            tag.name = name;
            document.head.appendChild(tag);
        }
        tag.content = content;
    }

    // 7. Inject Product Schema JSON-LD (Rich Snippets with Price)
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': safeProductName,
        'description': escapeHTML(product.description || descText),
        'image': coverUrl,
        'brand': { '@type': 'Brand', 'name': 'OFFSZN' },
        'creator': { '@type': 'Person', 'name': producerName },
        'category': categoryLabel,
        'offers': {
            '@type': 'Offer',
            'price': String(price),
            'priceCurrency': currency,
            'availability': 'https://schema.org/InStock',
            'url': productUrl,
            'seller': { '@type': 'Organization', 'name': 'OFFSZN' }
        }
    };

    // Add BPM and Key for beats
    if (pType === 'beat') {
        schema.additionalProperty = [];
        if (product.bpm) schema.additionalProperty.push({ '@type': 'PropertyValue', 'name': 'BPM', 'value': String(product.bpm) });
        if (product.key) schema.additionalProperty.push({ '@type': 'PropertyValue', 'name': 'Key', 'value': `${product.key} ${product.key_scale || ''}`.trim() });
    }

    // Remove any existing product schema
    const existingSchema = document.querySelector('script[data-seo="product"]');
    if (existingSchema) existingSchema.remove();

    const scriptTag = document.createElement('script');
    scriptTag.type = 'application/ld+json';
    scriptTag.setAttribute('data-seo', 'product');
    scriptTag.textContent = JSON.stringify(schema);

    // 4. Breadcrumb Schema (Home > Resources > Type > Name)
    let breadcrumbScript = document.getElementById('breadcrumb-schema');
    if (!breadcrumbScript) {
        breadcrumbScript = document.createElement('script');
        breadcrumbScript.id = 'breadcrumb-schema';
        breadcrumbScript.type = 'application/ld+json';
        document.head.appendChild(breadcrumbScript);
    }

    const breadcrumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Inicio",
                "item": "https://offszn.lat/"
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": product.product_type === 'beat' ? "Beats" : "Recursos",
                "item": product.product_type === 'beat' ? "https://offszn.lat/recursos/beats-instrumentales" : "https://offszn.lat/explorar.html"
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": safeProductName,
                "item": productUrl
            }
        ]
    };
    breadcrumbScript.textContent = JSON.stringify(breadcrumbs);

    document.head.appendChild(scriptTag);


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

    // Category (Smart Logic)
    let displayCategory = product.category;
    const pType = (product.product_type || '').toLowerCase();

    // 1. Force 'Beat' for beats (User Request: SI O SI "Beat")
    if (pType === 'beat') {
        displayCategory = 'Beat';
    }

    // 2. Map technical keys to friendly labels
    const categoryMap = {
        'voces': 'Preset de Voces',
        'plantilla': 'Plantilla',
        'drumkit': 'Drum Kit',
        'loopkit': 'Loop Kit',
        'instrumento': 'Instrumento',
        'plugin': 'Plugin',
        'beat': 'Beat',
        'trap': 'Trap',
        'reggaeton': 'Reggaetón'
    };

    // 3. Resolve final display string
    let valToDisplay = displayCategory || pType;
    valToDisplay = categoryMap[valToDisplay.toLowerCase()] || valToDisplay || 'N/A';

    // Capitalize if it's the simple word "Beat"
    if (valToDisplay.toLowerCase() === 'beat') valToDisplay = 'Beat';

    metaRows += `<div class="info-row"><span class="info-label">Categoría</span> <span class="info-val" style="text-transform: capitalize;">${valToDisplay}</span></div>`;

    // Add BPM, Key & Plays to Sidebar for PC ONLY
    if (pType === 'beat') {
        metaRows += `
            <div class="info-row desktop-only-flex">
                <span class="info-label">BPM</span>
                <span class="info-val">${product.bpm || '--'}</span>
            </div>
            <div class="info-row desktop-only-flex">
                <span class="info-label">Key</span>
                <span class="info-val" style="text-transform: capitalize;">${(product.key || '')} ${(product.key_scale || '') || '--'}</span>
            </div>
        `;
    }

    // Reproducciones
    metaRows += `
        <div class="info-row desktop-only-flex" style="border-bottom: none;">
            <span class="info-label">Reproducciones</span>
            <span class="info-val">${product.plays_count || 0}</span>
        </div>
    `;

    // Mobile Metadata (BPM/KEY) - Scoped for the Info Pane
    const mobileMetaHTML = `
        <div class="mobile-tech-specs mobile-only" style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
            <div class="tech-spec-row" style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span style="color: #888; font-size: 0.85rem;"><i class="bi bi-speedometer2"></i> BPM</span>
                <b style="font-size: 0.95rem;">${product.bpm || '--'}</b>
            </div>
            <div class="tech-spec-row" style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span style="color: #888; font-size: 0.85rem;"><i class="bi bi-music-note"></i> KEY</span>
                <b style="font-size: 0.95rem; text-transform: uppercase;">${(product.key || '')} ${(product.key_scale || '') || '--'}</b>
            </div>
        </div>
    `;

    // metaRows used for backward compatibility if needed, but we'll use techGrid now.
    const formatDuration = (seconds) => {
        if (!seconds || isNaN(seconds)) return '--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const displayDuration = product.duration ?
        (typeof product.duration === 'string' && product.duration.includes(':') ? product.duration : formatDuration(product.duration))
        : '--';

    const techGrid = `
        <div class="info-list tech-list-simple" style="margin-top:20px; width: 100%;">
            <div class="info-row" style="display: flex; justify-content: space-between; align-items: center; border:none; padding: 5px 0; width: 100%;">
                <span class="info-label"><i class="bi bi-speedometer2"></i> BPM</span>
                <span class="info-val" style="font-weight: 800;">${product.bpm || '--'}</span>
            </div>
            <div class="info-row" style="display: flex; justify-content: space-between; align-items: center; border:none; padding: 5px 0; width: 100%;">
                <span class="info-label"><i class="bi bi-music-note"></i> KEY</span>
                <span class="info-val" style="font-weight: 800;">${(product.key || '')} ${(product.key_scale || '') || '--'}</span>
            </div>
        </div>
    `;



    // 2. Collaborators/Producer Logic
    // Fix: Supabase might return producer as an object OR array depending on query.
    // Safe check:
    let producerData = product.producer;
    if (Array.isArray(producerData)) producerData = producerData[0];

    // Explicit Fallback using NICKNAME (per schema)
    const producerName = producerData?.nickname || 'Unknown Producer';
    const safeProducerName = escapeHTML(producerName);
    const isVerified = producerData?.is_verified || producerData?.is_producer;


    // Use Hover Card Logic for Producer
    const producerDataJSON = JSON.stringify({
        id: product.producer_id,
        nickname: safeProducerName,
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
              onclick="window.location.href='/@' + encodeURIComponent('${producerName.replace(/'/g, "\\'")}')"
              onmouseenter="window.showArtistCard(event, this)" 
              onmouseleave="window.hideArtistCard(event, this)"
              style="display:inline-flex; align-items:center; cursor:pointer;">
            ${safeProducerName} 
            <i class="bi bi-patch-check-fill" style="color:#007bff; display:${isVerified ? 'inline' : 'none'}; margin-left:4px;"></i>
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
                          onclick="window.location.href='/@' + encodeURIComponent('${cUser.nickname || 'Unknown'}')"
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

    // --- 🧪 OPTIMIZATION: Check if it's R2 vs Supabase ---
    const rawImgMain = product.image_url || '/images/portada-default.png';
    const storageVerMain = product.storage_version || product.r2_version || 'v2';

    // Explicitly skip R2 signing if storage_version is 'supabase'
    const isR2Main = (storageVerMain !== 'supabase') && window.AuthUtils && window.AuthUtils.isR2Url(rawImgMain);
    const imgPlaceholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    let finalSrcMain = rawImgMain;
    if (!isR2Main && !rawImgMain.startsWith('http') && !rawImgMain.startsWith('/') && !rawImgMain.startsWith('data:')) {
        const sbUrl = window.SUPABASE_URL || "https://qtjpvztpgfymjhhpoouq.supabase.co";
        finalSrcMain = `${sbUrl}/storage/v1/object/public/products/${rawImgMain}`;
    }

    const initialImgMain = isR2Main ? imgPlaceholder : finalSrcMain;

    container.innerHTML = `
        <div class="product-split-layout">
            <!-- LEFT: SIDEBAR (Art, Player, Meta) -->
            <div class="product-sidebar">
                <!-- Cover Art -->
                <div class="product-cover-art" style="position:relative;">
                    <img src="${initialImgMain}" 
                         data-r2-src="${escapeHTML(rawImgMain)}" 
                         data-r2-version="${storageVerMain}" 
                         id="product-main-art"
                         alt="${escapeHTML(product.name)}"
                         class=""
                         onerror="this.src='/images/portada-default.png'">
                     <!-- Play Button Overlay -->
                     <div class="product-cover-play-btn" onclick="window.playProductCover()">
                        <i class="bi bi-play-fill"></i>
                     </div>
                     <!-- Plays Badge (Bottom-Left, match Trending style) -->
                     <div class="product-cover-badge desktop-only-flex">
                        <i class="bi bi-music-note-beamed"></i> ${product.plays_count || 0}
                     </div>
                     <!-- Player Target -->
                     <div id="sidebar-player-target" style="position:absolute;"></div>
                </div>

                <!-- Sidebar Actions Area (PC ONLY) -->
                <div id="sidebar-social-actions-container" class="desktop-only-flex action-row sidebar-actions" style="justify-content:center; margin: 0 0 5px;">
                    <!-- Injected dynamically -->
                </div>

                <!-- Information List -->
                <div class="info-list-container">
                    <div id="content-info" class="info-list">
                        <div class="info-title-desktop" style="font-size:0.8rem; color:#666; margin-bottom:5px; font-weight:700; text-transform:uppercase;">Información</div>
                        ${metaRows}
                    </div>
                </div>

                <!-- Tags -->
                <div class="tags-section" style="margin-top:20px;">
                    <div class="tags-row" id="tags-container"></div>
                </div>
            </div>

            <!-- RIGHT: MAIN CONTENT (Header, Desc, Buy) -->
            <div class="product-main-content">
                
                <!-- HEADER: Title & Producer -->
                <div class="product-header-wrapper">
                    <h1 style="font-size:3rem; font-weight:800; line-height:1.1; margin-bottom:10px; word-break: break-word; overflow-wrap: break-word; hyphens: auto;">
                        ${escapeHTML(product.name) || 'Sin título'}
                    </h1>
                    ${producerHTML}
                    <div class="header-price-mobile-only">${product.product_type === 'beat' ? (window.CurrencyManager ? window.CurrencyManager.format(product.price_basic || 0) : `$ ${product.price_basic || '--'}`) : (product.price_basic ? (window.CurrencyManager ? window.CurrencyManager.format(product.price_basic) : `$ ${product.price_basic}`) : '')}</div>
                    
                    <!-- Integrated Social Actions for Mobile Header Identity -->
                    <div class="action-row mobile-only" id="social-actions-container" style="justify-content:flex-start; margin-top:10px;">
                        <!-- Injected dynamically -->
                    </div>
                </div>
                
                <!-- Buying Section & Footer -->
                <div class="buying-section-wrapper" style="margin-top:-10px; margin-bottom: 10px;">
                    <div class="section-headline" id="licenses-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-dim); padding-bottom: 5px; margin-bottom: 15px;">
                        <span>Licencias</span>
                        <!-- Comparar button only for Desktop Beats -->
                        ${pType === 'beat' ? `
                        <span class="desktop-only-flex" onclick="if(window.currentProductData && window.currentProductData.available_licenses) openLicenseComparisonModal(window.currentProductData.available_licenses)" style="font-size: 0.8rem; color: #888; cursor: pointer; align-items: center; gap: 5px; font-weight: 500;">
                            <i class="bi bi-layout-sidebar-inset"></i> Comparar
                        </span>
                        ` : ''}
                    </div>
                    <!-- PC Button Text: Añadir al Carrito | Mobile Button Text: Comprar (per user) -->
                    <style>
                        #btn-buy-main span::after { content: "Añadir al carrito"; }
                        @media (max-width: 768px) {
                            #btn-buy-main span::after { content: "Comprar"; }
                        }
                        #btn-buy-main span { font-size: 0; }
                        #btn-buy-main span::after { font-size: 1.1rem; }
                    </style>
                    <div id="buying-modules"></div>
                </div>

                <!-- NEW: Integrated Tabs System (Match Image: Información, Promociones, Negociar) -->
                <div class="product-tabs-container">
                    <div class="product-tabs-nav">
                        <button class="tab-btn active" onclick="switchProductTab('info')">Información</button>
                        <button class="tab-btn" onclick="switchProductTab('promos')">Promociones</button>
                        <button class="tab-btn" onclick="switchProductTab('negotiate')">Negociar</button>
                        <div class="tab-indicator"></div>
                    </div>

                    
                    <div class="product-tab-panes">
                        <!-- Pane: Información -->
                        <div class="tab-pane active" id="pane-info">
                            <!-- Dynamic Terms (Now at the top) -->
                            <div id="dynamic-lic-terms" style="margin-top:0; border-top:none; padding-top:0;">
                                <!-- Updated by JS when license is selected -->
                            </div>

                            <!-- Description (PC & Mobile) -->
                            <div class="about-section" style="margin-top: 10px;">
                                <div style="color: #ccc; font-size: 0.95rem; line-height: 1.6;">
                                    ${window.formatDescription(product.description, 1200)}
                                </div>
                            </div>


                            <div class="credits-section mobile-only" style="margin-top: 5px; border:none; padding: 0;">
                                <div style="color:#888; line-height:1.6; font-size:0.85rem;">
                                    <span style="color:#777; font-weight:700;">Créditos:</span> Producido por <a href="/@${encodeURIComponent(producerName)}" style="color:#fff; font-weight:700; text-decoration:none; margin-left:4px;">${producerName}</a>
                                    ${(() => {
            if (!product.collaborators || product.collaborators.length === 0) return '';
            const approved = product.collaborators.filter(c => c.status === 'accepted');
            if (approved.length === 0) return '';
            const links = approved.map(c => {
                const nick = c.user?.nickname || 'Unknown';
                return `<a href="/@${encodeURIComponent(nick)}" style="color:#fff; text-decoration:none; font-weight:700; margin-left:4px;">${nick}</a>`;
            }).join(', ');
            return `<br><span style="color:#777; font-weight:700;">Colaboraciones:</span> ${links}`;
        })()}
                                </div>
                            </div>
                        </div>

                        <!-- Pane: Promociones -->
                        <div class="tab-pane" id="pane-promos">
                            <div class="promos-container" style="padding: 0;">
                                ${(() => {
            const isLoggedIn = !!localStorage.getItem('userId');
            const claimedCode = localStorage.getItem('offszn_welcome_claimed');
            const isPending = localStorage.getItem('offszn_pending_coupon_claim') === 'true';

            // 1. Prioritize claimed coupon
            if (claimedCode) {
                return `
                        <div class="promo-card-v2 claimed-style" style="margin-top:0; text-align:left;">
                            <div style="font-size:0.85rem; font-weight:800; color:#fff; letter-spacing:1.5px; margin-bottom:12px; display:flex; align-items:center; gap:8px; text-transform:uppercase;">
                                <i class="bi bi-check-circle-fill"></i> Cupón activo
                            </div>
                            <div style="font-size:0.85rem; color:#888; margin-bottom:20px; line-height:1.5;">Usa este código en el checkout para obtener tu descuento.</div>
                            
                            <div class="coupon-box-minimal" style="padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02); margin-bottom: 20px;">
                                <span id="active-coupon-code" style="color:#fff; font-weight: 700; letter-spacing: 2px;">${claimedCode}</span>
                                <button class="copy-coupon-btn" onclick="window.copyCouponToClipboard('${claimedCode}', this)" style="background: rgba(255,255,255,0.05); color: #ccc; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 0.7rem; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s ease;">
                                    <i class="bi bi-clipboard" style="font-size: 0.8rem;"></i> COPIAR
                                </button>
                            </div>

                            <div style="font-size:0.8rem; color:#555; text-align:center;">
                                <span><i class="bi bi-info-circle"></i> Válido para tu primera compra.</span>
                            </div>
                        </div>
                    `;
            }

            // 2. Show pending state if intent saved
            if (isPending) {
                return `
                    <div class="promo-card-v2 claimed-style" style="margin-top:15px; text-align:left;">
                        <div style="font-size:0.85rem; font-weight:800; color:#fff; letter-spacing:1.5px; margin-bottom:12px; display:flex; align-items:center; gap:8px; text-transform:uppercase;">
                            <i class="bi bi-clock-history"></i> Activación pendiente
                        </div>
                        <div style="font-size:0.9rem; color:#fff; font-weight:600; margin-bottom:10px;">¡Casi listo!</div>
                        <div style="font-size:0.85rem; color:#888; margin-bottom:20px; line-height:1.5;">Tu cupón de 10% de descuento se activará automáticamente al <b>completar tu perfil</b>.</div>
                        
                        <div style="background:rgba(255,255,255,0.03); border:1px dashed rgba(255,255,255,0.1); border-radius:10px; padding:20px; text-align:center; color:#555;">
                             EL CÓDIGO SE REVELARÁ AQUÍ
                        </div>

                        <div style="font-size:0.75rem; color:#555; margin-top:15px; background:rgba(255,255,255,0.01); padding:12px; border-radius:6px; border:1px solid rgba(255,255,255,0.03); text-align:center;">
                            <span>Verifica tu email para continuar.</span>
                        </div>
                    </div>
                `;
            }

            // 3. Fallback for logged-in users
            if (isLoggedIn) {
                return `
                                        <div style="text-align:center; padding: 40px 20px; color:#666;">
                                            <i class="bi bi-megaphone" style="font-size:2rem; display:block; margin-bottom:15px; opacity:0.3;"></i>
                                            <div style="font-size:0.95rem; font-weight:500;">No hay promociones activas para ti en este momento.</div>
                                        </div>
                                    `;
            }

            // 4. Default Guest View
            return `
                    <div class="promo-card-v2" id="welcome-promo-box" style="margin-top:15px; border-radius:15px; border:1px solid rgba(255,255,255,0.05); background:rgba(255,255,255,0.02); padding:25px; text-align:center;">
                        <div style="font-size:0.85rem; font-weight:800; color:#fff; letter-spacing:2px; margin-bottom:12px; text-transform:uppercase;">Oferta de Bienvenida</div>
                        <div style="color:#888; font-size:1rem; margin-bottom:25px; line-height:1.5;">Obtén un <b style="color:#fff;">10% OFF</b> inmediato en tu primera compra al unirte a la plataforma.</div>
                        <button class="btn-glass-primary-v2" style="padding:15px 40px; border-radius:10px; width:100%; max-width:280px; margin:0 auto; display:block; font-size:0.9rem; font-weight:800;" onclick="window.generateWelcomeCoupon()">
                            OBTENER MI DESCUENTO
                        </button>
                    </div>
                `;
        })()}
                            </div>
                        </div>



                        <!-- Pane: Negociar -->
                        <div class="tab-pane" id="pane-negotiate">
                            <div class="negotiate-pane-content">
                                ${(() => {
            const pType = (product.product_type || '').toLowerCase();
            // Bloqueamos solo si es un producto gratuito que NO es un Beat.
            // Los Beats, aunque tengan demo gratis, tienen licencias de pago.
            if (product.is_free && pType !== 'beat') {
                return `
                                            <div style="text-align:center; padding: 20px 0;">
                                                <div style="font-weight:800; color:#fff; font-size:1.2rem; margin-bottom:15px;">No se puede negociar este producto</div>
                                                <div style="color:#888; font-size:1rem; margin-bottom:25px; line-height:1.4;">Este producto es gratuito, por lo que no es necesaria una negociación.</div>
                                                
                                                <button class="btn-glass-secondary" 
                                                        style="padding:12px 25px; border-radius:10px; font-weight:700; font-size:0.9rem; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.03); color:#888; cursor:pointer; transition:0.2s;"
                                                        onclick="window.location.href='/@${encodeURIComponent(producerName)}'">
                                                    EXPLORAR MÁS DEL PRODUCTOR
                                                </button>
                                            </div>
                                        `;
            }

            return `
                                        <div style="font-weight:800; color:#fff; font-size:1.2rem; margin-bottom:5px;">¿Tienes un presupuesto diferente?</div>
                                        <div style="color:#888; font-size:1rem; margin-bottom:25px; line-height:1.4;">Envía tu oferta directamente al productor y recibe una respuesta en menos de 24h.</div>
                                        
                                        <div class="negotiate-form-inline" style="background:rgba(255,255,255,0.03); padding:20px; border-radius:15px; border:1px solid rgba(255,255,255,0.05);">
                                            <div style="display:flex; flex-direction:column; gap:5px;">
                                                <div class="floating-group has-prefix">
                                                    <span class="prefix">$</span>
                                                    <input type="text" id="offer-amount-inline" inputmode="numeric" placeholder=" ">
                                                    <label for="offer-amount-inline">TU OFERTA (USD)</label>
                                                </div>
                                                <div id="offer-error-inline" style="color: #ff4d4d; font-size: 0.8rem; margin-top: -15px; margin-bottom: 5px; display: none; font-weight: 600;">Monto mínimo $5.00</div>

                                                <div class="floating-group" style="margin-top:10px;">
                                                    <input type="email" id="offer-email-inline" placeholder=" ">
                                                    <label for="offer-email-inline">TU EMAIL</label>
                                                </div>

                                                <button class="btn-purchase-kit" style="height:50px !important; margin-top:10px; font-size:0.9rem; letter-spacing:0.3px;" onclick="window.submitNegotiationInline()">
                                                    ENVIAR PROPUESTA
                                                </button>
                                            </div>
                                        </div>
                                    `;
        })()}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>


        <!-- RELATED PRODUCTS SECTION -->
        <div class="related-products-section">
            <div class="related-container">
                <div class="section-header" style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
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
                a.href = `/search.html?tag=${encodeURIComponent(tag)}`;
                a.textContent = `#${tag}`;
                tagBox.appendChild(a);
            });
        }
    }

    // 3. Delegate specific rendering


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

    // 🔥 FIX: Authorize main image
    if (product.image_url) {
        const img = document.getElementById('product-main-art');
        if (img) {
            window.getAuthorizedUrl(product.image_url, product.storage_version || product.r2_version || 'v2', product.id).then(url => {
                if (url) {
                    img.onload = () => { img.style.opacity = 1; };
                    img.src = url;
                    if (img.complete) img.onload();
                }
            });
        }
    }

    // Initialize Tabs Indicator
    setTimeout(() => window.switchProductTab('info'), 50);

    // 4. Free Download (Removed Sidebar Button per request)

    // if (product.is_free) { ... }
}

/**
 * COVER PLAY BUTTON — Wires the overlay play button to StickyPlayer.
 * Resolves R2 audio URLs and toggles play/pause state.
 */
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

    // Prioritize "After" audio for presets if available
    if (isPresetProduct(product) && product.audio_after_url) {
        return product.audio_after_url;
    }

    // Fallback to "Before" audio for presets specifically
    if (isPresetProduct(product) && product.audio_before_url) {
        return product.audio_before_url;
    }

    // Comprehensive fallback chain
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
        (product.track_data ? product.track_data.audio_url : '') ||
        '';
}

window.playProductCover = async function () {
    const product = window.currentProductData;
    if (!product) return;

    // If StickyPlayer is already playing THIS track, just toggle
    if (window.StickyPlayer && window.StickyPlayer.getCurrentTrackId &&
        String(window.StickyPlayer.getCurrentTrackId()) === String(product.id)) {
        window.StickyPlayer.togglePlay();
        // Update cover icon
        const coverBtn = document.querySelector('.product-cover-play-btn i');
        if (coverBtn) {
            const isNowPlaying = window.StickyPlayer.isPlaying && window.StickyPlayer.isPlaying();
            coverBtn.className = isNowPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
        }
        return;
    }

    // Build audio URL
    let audioUrl = getProductAudio(product);

    if (!audioUrl) {
        alert("Este producto no tiene vista previa de audio.");
        return;
    }

    // Resolve R2 URL if needed
    let finalAudioUrl = audioUrl;
    if (window.getAuthorizedUrl && !(audioUrl.includes('pub-') && audioUrl.includes('.r2.dev'))) {
        try {
            finalAudioUrl = await window.getAuthorizedUrl(audioUrl, product.storage_version || product.r2_version || 'v2', product.id);
        } catch (e) {
        }
    }

    // Initialize StickyPlayer if not yet loaded
    if (window.StickyPlayer && window.StickyPlayer.init) {
        window.StickyPlayer.init();
    }

    // Resolve image URL
    const coverImg = document.getElementById('product-main-art');
    const imageUrl = coverImg ? coverImg.src : (product.image_url || '/images/portada-default.png');

    // Resolve producer info
    let producerData = product.producer;
    if (Array.isArray(producerData)) producerData = producerData[0];
    const producerName = producerData?.nickname || 'OFFSZN Artist';

    // Play via StickyPlayer
    if (window.StickyPlayer && window.StickyPlayer.play) {
        window.StickyPlayer.play({
            id: product.id,
            name: product.name,
            audio_url: finalAudioUrl,
            mp3_url: finalAudioUrl,
            image_url: imageUrl,
            producer_nickname: producerName,
            producer: producerData,
            price_basic: product.price_basic,
            is_free: product.is_free,
            product_type: product.product_type,
            r2_version: product.storage_version || product.r2_version || 'v2'
        });

        // Update cover icon to pause
        const coverBtn = document.querySelector('.product-cover-play-btn i');
        if (coverBtn) coverBtn.className = 'bi bi-pause-fill';
    }
};


/**
 * MICRO-INTERACTIONS & LOGIC
 */
// MICRO-INTERACTIONS & LOGIC
function setupSocialInteractions(product) {
    const headerContainer = document.getElementById('social-actions-container');
    const sidebarContainer = document.getElementById('sidebar-social-actions-container');

    // Safety check
    if (!headerContainer && !sidebarContainer) return;

    // Use FavoritesManager for sync status if available
    const productIdStr = String(product.id);
    const isLiked = (window.FavoritesManager && window.FavoritesManager.isLiked(productIdStr)) || (product.user_has_liked || false);
    const likeClass = isLiked ? 'liked' : '';
    const heartIcon = isLiked ? 'bi-heart-fill' : 'bi-heart';

    // HTML for buttons (Icon top, Count bottom)
    const actionsHTML = `
        <div class="social-actions-wrapper">
            <button class="action-btn-icon btn-like-action ${likeClass}" onclick="toggleLikeGlobal(this, '${product.id}', '${product.producer_id}')">
                <i class="bi ${heartIcon}"></i>
                <span class="stat-value">${product.likes_count || 0}</span>
            </button>
            
            <button class="action-btn-icon" id="btn-share" onclick="openShareModal(window.currentProductData)">
                <i class="bi bi-share"></i>
                <span class="stat-value" style="opacity:0;">0</span>
            </button>


            <button class="action-btn-icon" id="btn-exclusivity" onclick="window.openExclusivityModal()">
                <i class="bi bi-plus-lg"></i>
                <span class="stat-value" style="opacity:0;">0</span>
            </button>
        </div>
    `;

    if (headerContainer) headerContainer.innerHTML = actionsHTML;
    if (sidebarContainer) sidebarContainer.innerHTML = actionsHTML;

    // Store current product for modal access
    window.currentProductData = product;

    // Listen for external updates (e.g. from FavoritesManager)
    if (window.FavoritesManager) {
        window.FavoritesManager.subscribe((likedSet) => {
            // Find ALL like buttons on the page (Mobile + Desktop)
            const btns = document.querySelectorAll('.btn-like-action');
            if (btns.length === 0) return;

            const isNowLiked = likedSet.has(String(product.id));

            btns.forEach(btn => {
                const icon = btn.querySelector('i');
                const valSpan = btn.querySelector('.stat-value');
                const wasLiked = btn.classList.contains('liked');

                if (isNowLiked && !wasLiked) {
                    btn.classList.add('liked');
                    icon.classList.remove('bi-heart');
                    icon.classList.add('bi-heart-fill');
                    if (valSpan) {
                        let val = parseInt(valSpan.innerText) || 0;
                        valSpan.innerText = val + 1;
                    }
                } else if (!isNowLiked && wasLiked) {
                    btn.classList.remove('liked');
                    icon.classList.remove('bi-heart-fill');
                    icon.classList.add('bi-heart');
                    if (valSpan) {
                        let val = parseInt(valSpan.innerText) || 0;
                        valSpan.innerText = Math.max(0, val - 1);
                    }
                }
            });
        });
    }

    // Initialize money input formatting for negotiation
    setupMoneyInput('offer-amount-inline', 1000);
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
    }
}

// Global functions for interactions (attached to window for onclick access)
window.toggleLike = function (btn, productId) {
    if (window.toggleLikeGlobal) {
        const prodId = productId || (window.currentProductData ? window.currentProductData.id : null);
        const ownerId = window.currentProductData ? window.currentProductData.producer_id : null;
        window.toggleLikeGlobal(btn, prodId, ownerId);
    } else {
        // Fallback for safety (though toggleLikeGlobal should exist)
        if (window.FavoritesManager) {
            window.FavoritesManager.toggleLike(productId, btn);
        }
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




window.copyToClipboard = function (text, btn) {
    return navigator.clipboard.writeText(text).then(() => {
        if (btn) {
            const icon = btn.querySelector('i') || btn;
            const originalClass = icon.className;
            icon.className = 'bi bi-check-lg';
            icon.style.color = '#4bff8f';
            icon.style.transition = 'all 0.2s ease';
            btn.style.pointerEvents = 'none';
            setTimeout(() => {
                icon.className = originalClass;
                icon.style.color = '';
                btn.style.pointerEvents = '';
            }, 2000);
        }
    });
};


window.openExclusivityModal = function () {
    let backdrop = document.getElementById('exclusivity-modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'exclusivity-modal-backdrop';
        backdrop.className = 'share-modal-backdrop';
        backdrop.onclick = (e) => { if (e.target === backdrop) window.closeExclusivityModal(); };
        document.body.appendChild(backdrop);
    }

    backdrop.innerHTML = `
        <div class="share-modal-content" style="max-width: 480px; width: 95%; padding: 40px 30px; border-radius: 24px; background: #0a0a0a; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 50px 100px rgba(0,0,0,0.8);">
            <div class="modal-pull-bar"></div>
            <button class="share-modal-close-btn" onclick="window.closeExclusivityModal()" style="top: 20px; right: 20px;">&times;</button>

            <div style="text-align:center;">
                <div style="width: 70px; height: 70px; background: rgba(160, 32, 240, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 25px; border: 1px solid rgba(160, 32, 240, 0.2);">
                    <i class="bi bi-gem" style="color: #A020F0; font-size: 2rem;"></i>
                </div>

                <div style="font-size:0.85rem; color:#A020F0; font-weight:800; text-transform:uppercase; letter-spacing:2px; margin-bottom:12px;">Licencia Exclusiva</div>
                <h2 style="color: #fff; font-size: 1.75rem; font-weight: 800; margin-bottom: 20px; letter-spacing: -0.5px;">Sé el único dueño</h2>
                
                <p style="color:#888; font-size:1.05rem; margin-bottom:35px; line-height:1.7; font-weight:500; max-width: 320px; margin-left: auto; margin-right: auto;">
                    Contacta directamente al productor para negociar la exclusividad total de este producto y retirarlo del catálogo.
                </p>

                <button onclick="contactProducerForExclusivity()" class="btn-purchase-kit" style="width:100%; height: 56px !important; font-size: 1.05rem; font-weight:800; border-radius: 12px; background: #fff; color: #000;">
                    CONTACTAR AL PRODUCTOR
                </button>

                <div style="margin-top: 25px; font-size: 0.8rem; color: #444; font-weight: 600;">
                    <i class="bi bi-shield-check"></i> TRANSACCIÓN SEGURA VÍA OFFSZN
                </div>
            </div>
        </div>
    `;

    backdrop.style.display = 'flex';
    setTimeout(() => {
        backdrop.classList.add('active');
        const contentBox = backdrop.querySelector('.share-modal-content');
        if (contentBox && typeof initBottomSheetDrag === 'function') {
            initBottomSheetDrag(contentBox, window.closeExclusivityModal);
        }
    }, 10);
};

window.closeExclusivityModal = function () {
    const backdrop = document.getElementById('exclusivity-modal-backdrop');
    if (backdrop) {
        backdrop.classList.add('closing');
        backdrop.classList.remove('active');
        setTimeout(() => {
            backdrop.style.display = 'none';
            backdrop.classList.remove('closing');
        }, 350);
    }
};


window.contactProducerForExclusivity = function () {
    const product = window.currentProductData;
    if (!product) return;
    const producerNickname = product.producer?.nickname || 'Productor';
    const productCategory = product.product_type || 'producto';
    let productLink = window.location.href;
    const message = `Vi tu ${productCategory}("${product.name}") ${productLink} estoy interesado en tener una versión exclusiva.`;
    const targetUrl = `/mensajes.html?user=${producerNickname}&msg=${encodeURIComponent(message)}`;

    const token = window.getAccessToken ? window.getAccessToken() : null;
    if (!token) {
        window.location.href = `/pages/login.html?redirect=${encodeURIComponent(targetUrl)}`;
        return;
    }
    window.location.href = targetUrl;
};




/**
 * BLOCKED PAYMENT MODAL
 * Triggered when a producer has no valid payment methods (PayPal/Yape) configured.
 */
window.openBlockedPaymentModal = function (producer) {
    if (!producer) return;

    const productData = window.currentProductData;

    // 🚨 REGISTRO DE NOTIFICACIÓN PARA EL PRODUCTOR
    // Intentamos obtener quién es el comprador (si está logueado) para una mejor notificación
    const currentUser = window.AuthUtils && typeof window.AuthUtils.getCurrentUser === 'function'
        ? window.AuthUtils.getCurrentUser()
        : null;

    if (currentUser && currentUser.id !== producer.id) {
        const buyerUsername = currentUser.nickname || 'Un comprador';

        console.log(`[BlockedModal] Registrando notificación para ${producer.nickname} (ID: ${producer.id}) sobre intento de compra de ${buyerUsername}`);

        if (window.supabaseClient) {
            window.supabaseClient.from('notifications').insert({
                user_id: producer.id,
                type: 'payment_method_missing',
                title: 'Método de pago no configurado',
                message: `${buyerUsername} intentó comprar tu producto "${productData?.name || 'un producto'}", pero no tienes métodos de pago configurados (PayPal/Yape).`,
                link: '/cuenta/configuracion',
                is_read: false
            }).then(({ error }) => {
                if (error) console.error("[BlockedModal] Error enviando notificación:", error);
                else console.log("[BlockedModal] Notificación enviada con éxito.");
            });
        }
    } else if (!currentUser) {
        // Notificación anónima si no está logueado
        if (window.supabaseClient) {
            window.supabaseClient.from('notifications').insert({
                user_id: producer.id,
                type: 'payment_method_missing',
                title: 'Intento de compra fallido (Invitado)',
                message: `Un visitante intentó comprar "${productData?.name || 'un producto'}", pero necesitas configurar PayPal o Yape para recibir pagos.`,
                link: '/cuenta/configuracion',
                is_read: false
            });
        }
    }


    let backdrop = document.getElementById('blocked-payment-modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'blocked-payment-modal-backdrop';
        backdrop.className = 'share-modal-backdrop';
        backdrop.onclick = (e) => { if (e.target === backdrop) window.closeBlockedPaymentModal(); };
        document.body.appendChild(backdrop);
    }

    const nickname = producer.nickname || 'este productor';
    const email = producer.email || '';

    // Build context for message
    const category = (productData?.product_type || 'producto').toLowerCase();
    const productLink = window.location.href;
    const message = `Hola @${nickname}, intenté comprar tu ${category} "${productData?.name || 'este producto'}" (${productLink}) pero no logré completar el pago. ¿Cómo podemos coordinar?`;
    const contactUrl = `/mensajes.html?user=${encodeURIComponent(nickname)}&msg=${encodeURIComponent(message)}`;

    backdrop.innerHTML = `
        <div class="share-modal-content" style="max-width: 440px; width: 95%; padding: 45px 30px; border-radius: 28px; background: #0a0a0a; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 50px 100px rgba(0,0,0,0.9);">
            <div class="modal-pull-bar"></div>
            <button class="share-modal-close-btn" onclick="window.closeBlockedPaymentModal()" style="top: 25px; right: 25px;">&times;</button>

            <div style="text-align:center;">
                <div style="width: 60px; height: 60px; background: rgba(255, 255, 255, 0.03); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 25px; border: 1px solid rgba(255, 255, 255, 0.08);">
                    <i class="bi bi-info-circle" style="color: #fff; font-size: 1.8rem; opacity: 0.8;"></i>
                </div>

                <h2 style="color: #fff; font-size: 1.4rem; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.5px;">No se pudo añadir este ${category}</h2>
                
                <p style="color:#888; font-size:0.95rem; margin-bottom:30px; line-height:1.6; font-weight:500;">
                    <a href="/@${nickname}" style="color:#fff; text-decoration:none; font-weight:800;">@${nickname}</a> aún no ha configurado sus métodos de pago. Por favor, contáctalo directamente para completar tu compra.
                </p>

                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <button onclick="window.location.href='${contactUrl}'" class="btn-purchase-kit" style="width:100%; height: 56px !important; font-size: 1rem; font-weight:800; border-radius: 12px; background: #fff; color: #000; border: none; text-transform: uppercase;">
                        CONTACTAR AL PRODUCTOR
                    </button>

                    ${email ? `
                        <div style="margin-top: 10px; padding: 20px; background: rgba(255,255,255,0.03); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); text-align: center;">
                            <div style="color: #555; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; font-weight: 800;">Email de contacto</div>
                            <div style="color: #fff; font-size: 0.95rem; font-weight: 600; display: flex; justify-content: center; align-items: center; gap: 10px;">
                                ${email}
                                <i class="bi bi-clipboard" style="cursor: pointer; opacity: 0.4; font-size: 0.8rem;" onclick="window.copyToClipboard('${email}', this)"></i>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    backdrop.style.display = 'flex';
    setTimeout(() => {
        backdrop.classList.add('active');
        const contentBox = backdrop.querySelector('.share-modal-content');
        if (contentBox && typeof initBottomSheetDrag === 'function') {
            initBottomSheetDrag(contentBox, window.closeBlockedPaymentModal);
        }
    }, 10);
};

window.closeBlockedPaymentModal = function () {
    const backdrop = document.getElementById('blocked-payment-modal-backdrop');
    if (backdrop) {
        backdrop.classList.add('closing');
        backdrop.classList.remove('active');
        setTimeout(() => {
            backdrop.style.display = 'none';
            backdrop.classList.remove('closing');
        }, 350);
    }
};

// Download Gate functions moved to script/download-gate.js


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
        const colMap = {
            'basic': 'price_basic',
            'premium': 'price_premium',
            'trackout': 'price_stems',
            'unlimited': 'price_exclusive'
        };

        const licenses = licenseKeys.map(key => {
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
            let userLic = (producerSettings && (producerSettings[offsznKey] || producerSettings[key]))
                ? (producerSettings[offsznKey] || producerSettings[key])
                : {};

            if (key === 'unlimited' && producerSettings) {
                const exclusiveUserData = producerSettings['offszn_exclusive'] || producerSettings['exclusive'];
                if (exclusiveUserData && Object.keys(exclusiveUserData).length > 0) userLic = exclusiveUserData;
            } else if (key === 'trackout' && producerSettings) {
                if (Object.keys(userLic).length === 0) {
                    userLic = producerSettings['offszn_stems'] || producerSettings['stems'] || {};
                }
            }

            const factLic = FACTORY_DEFAULTS[key];

            // --- 3. Resolve Price: Priority logic ---
            let finalPrice = factLic.price;
            if (prodLic.price !== undefined && prodLic.price !== null) {
                finalPrice = parseFloat(prodLic.price);
            } else if (product[colMap[key]] !== undefined && product[colMap[key]] !== null && parseFloat(product[colMap[key]]) > 0) {
                finalPrice = parseFloat(product[colMap[key]]);
            } else if (userLic.price !== undefined && userLic.price !== null) {
                finalPrice = parseFloat(userLic.price);
            }

            // --- 4. Resolve Enabled Status ---
            let isEnabled = factLic.enabled;
            if (prodLic.enabled !== undefined) {
                isEnabled = prodLic.enabled;
            } else if (product[colMap[key]] !== undefined && product[colMap[key]] !== null) {
                isEnabled = parseFloat(product[colMap[key]]) > 0;
            } else if (userLic.enabled !== undefined) {
                isEnabled = userLic.enabled;
            }

            return {
                id: key,
                name: prodLic.name || userLic.name || factLic.name,
                price: finalPrice,
                enabled: isEnabled,
                streams: userLic.streams || factLic.streams,
                sales: userLic.sales || factLic.sales,
                radio: userLic.radio || factLic.radio,
                files: userLic.files || factLic.files
            };
        });

        // 4. Render Licenses (Desktop & Mobile separation)
        const enabledLicenses = licenses.filter(l => l.enabled);
        const firstEnabledLicense = enabledLicenses[0];

        // Store licenses for later use in addToCart
        if (window.currentProductData) {
            window.currentProductData.available_licenses = licenses;
        }

        if (enabledLicenses.length > 0) {
            buyBox.innerHTML = '';

            // --- FUNCTION TO CREATE LAYOUT (Reusable) ---
            const createBuyingLayout = (isMobile) => {
                const container = document.createElement('div');
                container.id = isMobile ? 'mobile-buying-container' : 'desktop-buying-container';
                container.className = isMobile ? 'mobile-only-flex licenses-layout-v2' : 'desktop-only-flex licenses-layout-v2';
                container.style.flexDirection = 'column';
                container.style.width = '100%';

                const grid = document.createElement('div');
                grid.className = 'licenses-grid-scrollable';
                grid.style.display = 'grid';
                let cols = enabledLicenses.length > 3 ? 3 : enabledLicenses.length;
                grid.style.gridTemplateColumns = isMobile ? '1fr' : `repeat(${cols}, 1fr)`;
                if (isMobile) {
                    grid.style.display = 'flex';
                    grid.style.overflowX = 'auto';
                }
                grid.style.gap = '12px';
                grid.style.width = '100%';
                grid.style.marginBottom = '15px';

                let selectedId = localStorage.getItem(`offszn_lic_select_${product.id}`);
                if (!enabledLicenses.find(l => l.id === selectedId)) {
                    selectedId = enabledLicenses[0].id;
                }

                enabledLicenses.forEach(lic => {
                    const price = parseFloat(lic.price) || 0;
                    const priceStr = price > 0 ? (window.CurrencyManager ? window.CurrencyManager.format(price) : `$${price.toFixed(2)}`) : 'GRATIS';

                    const card = document.createElement('div');
                    card.className = `license-card-v2 ${isMobile ? 'mobile-lic-card' : 'desktop-lic-card'} ${lic.id === selectedId ? 'selected' : ''}`;
                    card.id = `${isMobile ? 'mobile' : 'desktop'}-lic-${lic.id}`;
                    card.style.cursor = 'pointer';
                    card.style.maxWidth = '100%';

                    card.innerHTML = `
                        <div class="lic-card-header">
                            <span class="lic-name">${lic.name}</span>
                            <i class="bi bi-info-circle lic-details-trigger"></i>
                        </div>
                        <div class="lic-card-body" style="margin-top: 5px;">
                            <span class="lic-files-preview">${getFilesPreview(lic.files, lic.name)}</span>
                            <span class="lic-price-v2">${priceStr}</span>
                        </div>
                    `;

                    card.onclick = (e) => {
                        if (e.target.closest('.lic-details-trigger')) {
                            openLicenseModal(lic, product);
                        } else {
                            // Sync selection between mobile/desktop (ALL license cards)
                            document.querySelectorAll('.license-card-v2').forEach(c => c.classList.remove('selected'));

                            // Highlight current and mirrored cards
                            const allSameLic = document.querySelectorAll(`[id$="-lic-${lic.id}"]`);
                            allSameLic.forEach(c => c.classList.add('selected'));

                            localStorage.setItem(`offszn_lic_select_${product.id}`, lic.id);
                            if (window.updateTermsTab) window.updateTermsTab(lic.id);
                        }
                    };
                    grid.appendChild(card);
                });

                container.appendChild(grid);

                const purchaseBtn = document.createElement('button');
                purchaseBtn.className = 'btn-purchase-kit cart-btn-mobile-fix';
                purchaseBtn.style.padding = '16px';
                purchaseBtn.style.fontSize = '1.1rem';
                purchaseBtn.style.fontWeight = '800';
                purchaseBtn.style.display = 'flex';
                purchaseBtn.style.justifyContent = 'center';
                purchaseBtn.style.alignItems = 'center';
                purchaseBtn.style.gap = '10px';

                // Text remains "AÑADIR AL CARRITO" for PC, but "COMPRAR" for MOBILE
                purchaseBtn.innerHTML = `<i class="bi bi-cart-plus" style="font-size: 1.3rem;"></i> ${isMobile ? 'COMPRAR' : 'AÑADIR AL CARRITO'}`;

                purchaseBtn.onclick = () => {
                    const currentSelectedId = localStorage.getItem(`offszn_lic_select_${product.id}`) || enabledLicenses[0].id;
                    if (window.addToCart) {
                        window.addToCart(product.id, currentSelectedId);
                    }
                };
                container.appendChild(purchaseBtn);

                if (product.is_free) {
                    const freeBtn = document.createElement('button');
                    freeBtn.className = 'btn-minimal-link';
                    freeBtn.style.margin = '10px auto 0';
                    freeBtn.style.fontSize = '0.9rem';
                    freeBtn.style.color = '#ccc';
                    freeBtn.innerHTML = '<i class="bi bi-download"></i> DESCARGA GRATIS MP3 CON TAG';
                    freeBtn.onclick = () => {
                        if (window.openDownloadGateModal) window.openDownloadGateModal(product.audio_url, product.producer?.nickname, product.id);
                        else window.open(product.audio_url, '_blank');
                    };
                    container.appendChild(freeBtn);
                }

                return container;
            };

            // Render both (CSS handles visibility)
            buyBox.appendChild(createBuyingLayout(false)); // Desktop
            buyBox.appendChild(createBuyingLayout(true));  // Mobile

            // Initial Tab Update
            const initialSelected = localStorage.getItem(`offszn_lic_select_${product.id}`) || enabledLicenses[0].id;
            if (window.updateTermsTab) window.updateTermsTab(initialSelected);
        }


    } catch (err) {
        buyBox.innerHTML = '<p style="color:red;">Error al cargar las licencias.</p>';
    }

    // Standard Player (Targeting Sidebar Overlay)
    initStandardPlayer(product);
}

function getFilesPreview(files, licenseName) {
    const active = ['MP3']; // 🔥 Always included
    if (files?.wav) active.push('WAV');
    if (files?.stems) active.push('STEMS');

    // Exclusivity check removed per request


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

        } else {
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
    const priceStr = price > 0 ? `$${parseFloat(price).toFixed(2)}` : 'GRATIS';

    backdrop.innerHTML = `
        <div class="share-modal-content lic-modal" id="modal-lic-container">
            <div class="modal-pull-bar"></div>
            <div class="lic-modal-header">
                <h3 class="lic-modal-title">${lic.name || 'Detalles'}</h3>
            </div>
            
            <div class="lic-modal-body">
                <div class="lic-top-info" style="flex-direction: column; align-items: center; text-align: center; gap: 8px;">
                     <div class="lic-modal-price" style="font-size: 2.5rem; margin-bottom: 0;">${priceStr}</div>
                     <div class="lic-modal-files">${getFilesPreview(lic.files, lic.name)}</div>
                </div>

                <div class="lic-section" style="margin-top: 20px;">
                    <span class="lic-section-title" style="text-align: center;">DETALLES DE USO</span>
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
                    <span class="lic-section-title" style="text-align: center;">ARCHIVOS INCLUIDOS</span>
                    <div class="lic-check-grid">
                        <div class="lic-check-item active">
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

                <button class="btn-purchase-kit" style="width:100%; margin-top:10px; height: 50px !important;" onclick="selectLicenseAndClose('${lic.id}')">
                    OK, SELECCIONAR
                </button>
            </div>
        </div>
    `;

    backdrop.style.display = 'flex';
    setTimeout(() => {
        backdrop.classList.add('active');
        const modal = document.getElementById('modal-lic-container');
        if (modal && typeof initBottomSheetDrag === 'function') {
            initBottomSheetDrag(modal, closeLicenseModal);
        }
    }, 10);
};


window.closeLicenseModal = function () {
    const backdrop = document.getElementById('lic-details-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        setTimeout(() => backdrop.style.display = 'none', 300);
    }
}

window.openLicenseSelectionModal = function (licenses) {
    let backdrop = document.getElementById('lic-selection-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'lic-selection-backdrop';
        backdrop.className = 'share-modal-backdrop';
        backdrop.onclick = (e) => { if (e.target === backdrop) closeLicenseSelectionModal(); };
        document.body.appendChild(backdrop);
    }

    const enabledLicenses = licenses.filter(l => l.enabled);
    const selectedId = localStorage.getItem(`offszn_lic_select_${window.currentProductData?.id}`) || enabledLicenses[0]?.id;

    backdrop.innerHTML = `
        <div class="share-modal-content lic-modal" id="modal-lic-selection-container">
            <div class="modal-pull-bar"></div>
            <div class="lic-modal-header">
                <h3 class="lic-modal-title">Elegir Licencia</h3>
            </div>
            
            <div class="lic-modal-body">
                <div class="license-selection-list">
                    ${enabledLicenses.map(l => {
        const isSelected = l.id === selectedId;
        return `
                            <div class="license-list-item ${isSelected ? 'selected' : ''}" onclick="selectModalLicense('${l.id}', ${l.price})">
                                <div class="license-item-info">
                                    <span class="license-item-name">${l.name}</span>
                                    <span class="license-item-files">${getFilesPreview(l.files, l.name)}</span>
                                </div>
                                <div class="license-item-price">$${parseFloat(l.price).toFixed(2)}</div>
                            </div>
                        `;
    }).join('')}
                </div>

                <div class="modal-footer-actions">
                    <div class="total-row">
                        <span class="total-label">Subtotal</span>
                        <span id="modal-subtotal" class="total-amount">$${parseFloat(enabledLicenses.find(l => l.id === selectedId)?.price || 0).toFixed(2)}</span>
                    </div>
                    
                    <button class="btn-purchase-licenses" id="btn-modal-add-cart" onclick="confirmModalPurchase()" style="height: 50px !important;">
                        AÑADIR AL CARRITO
                    </button>
                </div>
            </div>
        </div>
    `;

    backdrop.style.display = 'flex';
    setTimeout(() => {
        backdrop.classList.add('active');
        const modal = document.getElementById('modal-lic-selection-container');
        if (modal && typeof initBottomSheetDrag === 'function') {
            initBottomSheetDrag(modal, closeLicenseSelectionModal);
        }
    }, 10);
};


window.closeLicenseSelectionModal = function () {
    const backdrop = document.getElementById('lic-selection-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        setTimeout(() => backdrop.style.display = 'none', 300);
    }
}

window.selectModalLicense = function (id, price) {
    document.querySelectorAll('.license-list-item').forEach(el => el.classList.remove('selected'));
    const target = event.currentTarget;
    if (target) target.classList.add('selected');

    const subtotal = document.getElementById('modal-subtotal');
    if (subtotal) subtotal.innerText = `$${parseFloat(price).toFixed(2)}`;

    // Persist
    if (window.currentProductData) {
        localStorage.setItem(`offszn_lic_select_${window.currentProductData.id}`, id);
    }
}

window.confirmModalPurchase = function () {
    const selected = document.querySelector('.license-list-item.selected');
    if (selected && window.currentProductData) {
        // Find ID from the html or re-read from localStorage
        const id = localStorage.getItem(`offszn_lic_select_${window.currentProductData.id}`);
        addToCart(window.currentProductData.id, id);
        closeLicenseSelectionModal();
    }
}


window.selectLicenseAndClose = function (id) {
    if (window.currentProductData) {
        window.addToCart(window.currentProductData.id, id);
    }
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
        <div class="share-modal-content lic-modal lic-modal-compare" style="width: 95%;">
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
                    ${enabledLicenses.map(l => `<div class="compare-cell price">${parseFloat(l.price) > 0 ? '$' + parseFloat(l.price).toFixed(2) : 'GRATIS'}</div>`).join('')}

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



                    <!-- SELECT BUTTONS -->
                    <div class="compare-cell feature-col" style="border-bottom:none;"></div>
                    ${enabledLicenses.map(l => `
                        <div class="compare-cell" style="border-bottom:none;">
                            <button class="btn-compare-select" onclick="selectLicenseAndClose('${l.id}')">
                                ELEGIR
                            </button>
                        </div>
                    `).join('')}

                </div>
            </div>
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



    const buyBox = document.getElementById('buying-modules');
    if (!buyBox) return;

    buyBox.innerHTML = '';
    const buyBtn = document.createElement('button');
    buyBtn.className = 'btn-purchase-kit';

    const isTrulyFree = product.is_free && (Number(product.price_basic) === 0 || !product.price_basic);

    if (isTrulyFree) {
        buyBtn.innerHTML = 'DESCARGA GRATIS';
        buyBtn.onclick = () => {
            const downloadUrl = product.kit_url || product.download_url_wav || product.download_url_stems || product.wav_url || product.stems_url || product.audio_url;
            if (window.openDownloadGateModal) {
                window.openDownloadGateModal(downloadUrl, product.producer?.nickname, product.id);
            } else {
                window.open(downloadUrl, '_blank');
                incrementProductStat(product.id, 'downloads_count');
            }
        };
    } else {
        buyBtn.innerHTML = `COMPRAR - ${window.CurrencyManager ? window.CurrencyManager.format(parseFloat(product.price_basic) || 0) : '$' + (product.price_basic || '0.00')}`;
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

            // Only show the button if both A/B audio files actually exist
            if (hasFiles) {
                abLink.onclick = () => {
                    openABModal(urlBefore, urlAfter, product);
                };
                header.appendChild(abLink);
            }

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

    const isTrulyFree = product.is_free && (parseFloat(product.price_basic) || 0) === 0;
    if (isTrulyFree) {
        buyBtn.innerHTML = 'DESCARGAR GRATIS';
        buyBtn.onclick = () => {
            const downloadUrl = product.download_url || product.audio_url;
            window.open(downloadUrl, '_blank');
        };
    } else {
        buyBtn.innerHTML = `COMPRAR - ${window.CurrencyManager ? window.CurrencyManager.format(parseFloat(product.price_basic) || 0) : '$' + (product.price_basic || '0.00')}`;
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

    const isTrulyFree = product.is_free && (parseFloat(product.price_basic) || 0) === 0;
    if (isTrulyFree) {
        // Free Product: Show "DESCARGA GRATIS" ONLY (Clean)
        buyBtn.innerHTML = `DESCARGA GRATIS`;
        buyBtn.onclick = () => {
            const downloadUrl = product.kit_url || product.download_url_wav || product.download_url_stems || product.wav_url || product.stems_url || product.audio_url;
            if (window.openDownloadGateModal) {
                window.openDownloadGateModal(downloadUrl, product.producer?.nickname, product.id);
            } else {
                window.open(downloadUrl, '_blank');
                incrementProductStat(product.id, 'downloads_count');
            }
        };
    } else {
        // Paid Product
        buyBtn.innerHTML = `COMPRAR - ${window.CurrencyManager ? window.CurrencyManager.format(parseFloat(product.price_basic) || 0) : '$' + (product.price_basic || '0.00')}`;
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
        freeBtn.innerHTML = `<i class="bi bi-arrow-down-circle"></i> Descargar GRATIS`;
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
            <button class="play-btn-circle" id="${btnId}" style="width:42px; height:42px; font-size:1.2rem; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
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
window.openABModal = async function (beforeUrl, afterUrl, product) {
    if (!beforeUrl || beforeUrl === 'null' || !afterUrl || afterUrl === 'null') {
        return;
    }

    // 🔥 FIX: Authorize both R2 URLs in parallel
    const [signedBefore, signedAfter] = await Promise.all([
        window.getAuthorizedUrl(beforeUrl, product.storage_version || product.r2_version || 'v2', product.id),
        window.getAuthorizedUrl(afterUrl, product.storage_version || product.r2_version || 'v2', product.id)
    ]);

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
    initABPlayerInContainer(signedBefore, signedAfter, playerContainer, product.id);

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
 * Placeholder for global cart integration - MOVED TO BOTTOM (Unified Override)
 */
// window.addToCart = (id, license) => { ... }

/**
 * RELATED PRODUCTS LOGIC
 */
async function fetchRelatedProducts(currentProduct) {
    const container = document.getElementById('product-related-container');
    if (!container) return;

    try {
        // console.log("[Related] Fetching for:", currentProduct.id, currentProduct.product_type, currentProduct.category);

        let allRelated = [];

        // STAGE 1: Same Producer + Same Category
        const { data: stage1 } = await window.supabaseClient
            .from('products')
            .select('*, producer:producer_id (nickname, avatar_url, is_verified)')
            .eq('producer_id', currentProduct.producer_id)
            .eq('category', currentProduct.category)
            .eq('product_type', currentProduct.product_type)
            .neq('id', currentProduct.id)
            .neq('status', 'deleted')
            .limit(10);

        if (stage1 && stage1.length > 0) {
            allRelated = [...stage1];
            // console.log("[Related] Stage 1 found:", stage1.length);
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
                .neq('status', 'deleted')
                .limit(10 - allRelated.length);

            if (stage2 && stage2.length > 0) {
                allRelated = [...allRelated, ...stage2];
                // console.log("[Related] Stage 2 found:", stage2.length);
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
                .neq('status', 'deleted')
                .limit(10 - allRelated.length);

            if (stage3 && stage3.length > 0) {
                allRelated = [...allRelated, ...stage3];
                // console.log("[Related] Stage 3 found:", stage3.length);
            }
        }

        // STAGE 4: ANY Product as absolute fallback (Ensure at least 5 items)
        if (allRelated.length < 5) {
            const excludeIds = allRelated.map(p => p.id);
            excludeIds.push(currentProduct.id);

            const { data: stage4 } = await window.supabaseClient
                .from('products')
                .select('*, producer:producer_id (nickname, avatar_url, is_verified)')
                .not('id', 'in', `(${excludeIds.join(',')})`)
                .neq('status', 'deleted')
                .limit(10 - allRelated.length);

            if (stage4 && stage4.length > 0) {
                allRelated = [...allRelated, ...stage4];
            }
        }

        if (allRelated.length === 0) {
            container.innerHTML = '<div style="width:100%; text-align:center; color:#666; padding: 40px; font-size: 0.9rem;">No hay más productos recomendados en este momento.</div>';
            return;
        }

        renderRelatedGrid(allRelated, container);
    } catch (err) {
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

        const rawImgRelated = p.image_url || '/images/portada-default.png';
        const storageVerRelated = p.storage_version || p.r2_version || 'v2';

        // Explicitly skip R2 signing if storage_version is 'supabase'
        const isR2Related = (storageVerRelated !== 'supabase') && window.AuthUtils && window.AuthUtils.isR2Url(rawImgRelated);
        const placeholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

        const finalSrcRelated = window.AuthUtils?.getFormattedSupabaseUrl ? window.AuthUtils.getFormattedSupabaseUrl(rawImgRelated) : rawImgRelated;

        const initialImgRelated = isR2Related ? placeholder : finalSrcRelated;

        // Use EXACTLY the same structure as Profile Trending Cards (Trending / Packs)
        card.innerHTML = `
            <div class="t-card-cover">
                <img src="${initialImgRelated}" 
                     data-r2-src="${escapeHTML(rawImgRelated)}" 
                     data-r2-version="${storageVerRelated}" 
                     id="related-img-${p.id}"
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
        // 🔥 FIX: Authorize related image WITHOUT skeleton (removes light line glitch)
        const img = card.querySelector('img');
        if (img && p.image_url) {
            window.getAuthorizedUrl(p.image_url, p.storage_version || p.r2_version || 'v2', p.id)
                .then(url => {
                    if (url) {
                        img.onload = () => { /* No-op, skeleton removed */ };
                        img.onerror = () => {
                            img.src = '/images/portada-default.png';
                        };
                        img.src = url;
                    }
                })
                .catch(() => {
                    img.src = '/images/portada-default.png';
                });
        } else if (img) {
            img.src = '/images/portada-default.png';
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
// incrementProductStat is now globally provided by sticky-player.js
// to ensure consistent history recording and stat tracking across all pages.

// --- 10. GLOBAL CART OVERRIDE (CRITICAL FIX FOR LICENSE PRICE) ---
// This ensures that when "Add to Cart" is clicked, we grab the CURRENTLY SELECTED license price.
window.addToCart = async (id, license) => {
    // 1. Get Product Data from global scope (set in init or passed)
    let product = window.currentProductData;

    // Fallback: Try to find in window.allProducts if defined (Marketplace)
    if (!product && window.allProducts) {
        product = window.allProducts.find(p => p.id == id);
    }

    if (!product) {
        alert("Error: Datos del producto no cargados.");
        return;
    }

    // --- PAYMENT ELIGIBILITY CHECK ---
    // Only block if NOT free. Free products are exempt.
    const isFree = product.is_free || false;
    if (!isFree) {
        let producer = product.producer;
        if (Array.isArray(producer)) producer = producer[0];

        if (producer) {
            // Check for PayPal (email or explicitly set in methods)
            const has_paypal = producer.paypal_email || (producer.payment_methods && producer.payment_methods.paypal?.enabled);
            // Check for Yape (verified phone)
            const has_yape = producer.yape_phone && producer.is_verified;

            if (!has_paypal && !has_yape) {
                if (window.openBlockedPaymentModal) {
                    window.openBlockedPaymentModal(producer, product);
                } else {
                    alert("Este productor no tiene configurados métodos de pago.");
                }
                return;
            }
        }
    }

    // 2. Determine Price, License Name, and Details
    let finalPrice = parseFloat(product.price_basic) || 0;
    let licenseId = license || 'basic';
    let licenseName = product.product_type === 'beat' ? 'Basic Lease' : 'Standard License';
    let licenseDetails = {};

    const availLicenses = product.available_licenses || [];

    // Check for selected card in UI (Robust logic for Desktop/Mobile)
    const selectedCard = document.querySelector('.license-card-v2.selected');
    if (selectedCard) {
        const fullId = selectedCard.id;
        // Strip prefixes: 'desktop-lic-', 'mobile-lic-', 'lic-card-'
        licenseId = fullId.replace(/^(desktop-lic-|mobile-lic-|lic-card-)/, '');
    }

    // Find the license object to get details
    const selectedLicObj = availLicenses.find(l => l.id === licenseId);

    if (selectedLicObj) {
        finalPrice = parseFloat(selectedLicObj.price);
        licenseName = selectedLicObj.name;
        licenseDetails = {
            files_preview: (window.getFilesPreview) ? window.getFilesPreview(selectedLicObj.files, selectedLicObj.name) : '',
            streams: selectedLicObj.streams,
            sales: selectedLicObj.sales,
            radio: selectedLicObj.radio
        };
    } else if (selectedCard) {
        // Fallback UI parsing if not in metadata
        const cardPriceEl = selectedCard.querySelector('.lic-price-v2') || selectedCard.querySelector('.lic-price');
        const cardNameEl = selectedCard.querySelector('.lic-name');

        if (cardPriceEl) {
            const rawPriceText = cardPriceEl.innerText.trim();
            if (rawPriceText.toLowerCase().includes('gratis')) {
                finalPrice = 0;
            } else {
                const match = rawPriceText.match(/[0-9.]+/);
                if (match) finalPrice = parseFloat(match[0]);
            }
        }
        if (cardNameEl) licenseName = cardNameEl.innerText.trim();
    }

    // 3. Construct Cart Item
    const checkProduct = {
        ...product,
        price_basic: finalPrice,
        license: {
            name: licenseName,
            id: licenseId,
            details: licenseDetails
        }
    };

    // 4. Call Manager
    if (window.CartManager) {
        // Await the addition to ensure state is ready before opening
        await window.CartManager.addToCart(checkProduct);
        // CartManager.addToCart already calls openCart(), but we can call it again for safety
        window.CartManager.openCart();
    } else {
        alert("Error: Carrito no disponible. Recarga la página.");
    }
};


// === TABS SYSTEM LOGIC (OFFSZN IDENTITY) ===

window.switchProductTab = function (tabId) {
    // 1. Update Buttons
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(btn => btn.classList.remove('active'));

    const activeBtn = document.querySelector(`.tab-btn[onclick*="'${tabId}'"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');

        // 2. Move Indicator
        const indicator = document.querySelector('.tab-indicator');
        if (indicator) {
            indicator.style.width = activeBtn.offsetWidth + 'px';
            indicator.style.left = activeBtn.offsetLeft + 'px';
        }
    }

    // 3. Update Panes
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    const targetPane = document.getElementById('pane-' + tabId);
    if (targetPane) {
        targetPane.classList.add('active');

        // 🔥 AUTO-FILL: If navigating to negotiation, fill email if logged in
        if (tabId === 'negotiate') {
            const emailInput = targetPane.querySelector('#offer-email-inline');
            if (emailInput && !emailInput.value) {
                window.supabaseClient?.auth.getSession().then(({ data }) => {
                    if (data?.session?.user?.email) {
                        emailInput.value = data.session.user.email;
                    }
                });
            }
        }
    }
};


window.updateTermsTab = function (licenseId) {
    const pane = document.getElementById('dynamic-lic-terms');
    if (!pane || !window.currentProductData) return;

    const licenses = window.currentProductData.available_licenses || [];
    const lic = licenses.find(l => l.id === licenseId);
    if (!lic) return;

    const price = parseFloat(lic.price) || 0;
    const isUnlimited = lic.name.toLowerCase().includes('unlimited');
    const checkColor = isUnlimited ? '#A020F0' : '#4bff8f';

    pane.innerHTML = `
        <div class="terms-content-v2" style="background:rgba(255,255,255,0.02); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <span style="font-size:0.85rem; font-weight:800; color:#fff; text-transform:uppercase;">${lic.name}</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 15px; font-size:0.82rem; color:#888;">
                <span style="display:flex; align-items:center; white-space:nowrap;"><i class="bi bi-check-circle-fill" style="color:${checkColor}; margin-right:6px; flex-shrink:0;"></i> ${getFilesPreview(lic.files, lic.name)}</span>
                <span style="display:flex; align-items:center; white-space:nowrap;"><i class="bi bi-check-circle-fill" style="color:${checkColor}; margin-right:6px; flex-shrink:0;"></i> ${lic.streams || 'Limitado'} Streams</span>
                <span style="display:flex; align-items:center; white-space:nowrap;"><i class="bi bi-check-circle-fill" style="color:${checkColor}; margin-right:6px; flex-shrink:0;"></i> ${lic.sales || 'Limitado'} Ventas</span>
                <span style="display:flex; align-items:center; white-space:nowrap;"><i class="bi bi-check-circle-fill" style="color:${checkColor}; margin-right:6px; flex-shrink:0;"></i> PDF Oficial</span>
            </div>

        </div>
    `;

};

// Helper to format as money (Bank-style: 0.00)
function setupMoneyInput(elId, maxValue = 1000) {
    const el = document.getElementById(elId);
    if (!el) return;

    el.addEventListener('input', function (e) {
        let value = this.value.replace(/\D/g, '');
        let cents = parseInt(value || 0);
        if (cents > maxValue * 100) cents = maxValue * 100;
        let formatted = (cents / 100).toFixed(2);
        this.value = formatted;
    });

    el.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && this.value === '0.00') {
            e.preventDefault();
        }
    });

    if (!el.value || el.value === "") el.value = "0.00";
}

window.submitNegotiationInline = async function () {
    try {
        const amount = document.getElementById('offer-amount-inline')?.value;
        const email = document.getElementById('offer-email-inline')?.value;
        const product = window.currentProductData;

        const amountNum = parseFloat(amount || "0");
        const errorEl = document.getElementById('offer-error-inline');

        // Hide error initially
        if (errorEl) errorEl.style.display = 'none';

        if (!amountNum || amountNum < 5) {
            if (errorEl) errorEl.style.display = 'block';
            return;
        }
        if (amountNum > 1000) {
            alert("El monto máximo de oferta es $1000.00");
            return;
        }
        if (!email || !email.includes('@')) {
            alert("Por favor, completa tu email correctamente.");
            return;
        }

        // --- 🔐 AUTH CONTEXT ---
        let userId = null;
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) userId = session.user.id;

        const activeLicTab = document.querySelector('.lic-tab.active');
        const selectedLicense = activeLicTab ? activeLicTab.textContent.trim() : 'Standard';

        /* --- ⏳ RATE LIMIT: 24h per product/email (Comentado para pruebas) ---
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: existing, error: checkError } = await window.supabaseClient
            .from('propuestas_offszn')
            .select('id')
            .eq('product_id', product.id)
            .eq('email_offszn', email)
            .gt('created_at', yesterday)
            .limit(1);

        if (existing && existing.length > 0) {
            alert("Vuelve a negociar en un plazo de 24 horas cuando obtengas la respuesta.");
            return;
        }
        */

        const { error } = await window.supabaseClient.from('propuestas_offszn').insert({
            product_id: product.id,
            producer_id: product.producer_id,
            email_offszn: email,
            amount_offszn: amountNum,
            status_offszn: 'pending',
            selected_license: selectedLicense
        });

        if (error) throw error;

        // --- 📧 Email Notification via Server ---
        fetch('/api/negotiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: product.id,
                producerId: product.producer_id,
                amount: amountNum,
                email: email,
                userId: userId
            })
        }).catch(err => console.warn('[Negotiation] Email notification failed (background):', err));

        alert("¡Propuesta enviada con éxito! Se envió un correo a ti mismo y al productor.");

        // Reset fields
        const amountEl = document.getElementById('offer-amount-inline');
        const emailEl = document.getElementById('offer-email-inline');
        if (amountEl) amountEl.value = '0.00';
        if (emailEl && !userId) emailEl.value = ''; // Only clear if guest

    } catch (err) {
        if (err.message && err.message.includes('user_id')) {
            alert("Hubo un error de base de datos. Por favor contacta soporte.");
        } else {
            alert("Hubo un error al enviar la propuesta.");
        }
    }
};

// === PROMO / NEGOTIATION / COUPON LOGIC ===

window.generateWelcomeCoupon = function () {
    const product = window.currentProductData;
    if (!product) return;

    const alreadyClaimed = localStorage.getItem('offszn_welcome_claimed');
    if (alreadyClaimed) {
        alert(`Ya tienes un código activo: ${alreadyClaimed}`);
        return;
    }

    // Modal for email
    let backdrop = document.getElementById('coupon-modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'coupon-modal-backdrop';
        backdrop.className = 'share-modal-backdrop bottom-sheet-layout';

        backdrop.onclick = (e) => {
            if (e.target === backdrop) window.closeCouponModal();
        };

        document.body.appendChild(backdrop);
    }

    backdrop.innerHTML = `
        <div class="share-modal-content welcome-coupon-modal-content" id="coupon-modal-content" style="text-align:center;">
            <div class="modal-pull-bar" id="coupon-pull-bar"></div>
            
            <div style="text-align:center; padding: 15px 20px 30px;">
                <div style="font-size:0.8rem; color:#888; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:20px;">Cupón de Bienvenida</div>
                
                <i class="bi bi-gift" style="font-size:3rem; color:var(--accent-purple); margin-bottom:20px; display:block;"></i>
                
                <div style="color:#aaa; font-size:1rem; margin-bottom:15px; line-height:1.6; font-weight:500;">
                    Introduce tu email para obtener un <b style="color:#fff;">10% OFF</b> en tu primera compra y activar beneficios exclusivos.
                </div>


                <div class="floating-group" style="margin-bottom: 12px;">
                    <input type="email" id="coupon-email-input" placeholder=" ">
                    <label for="coupon-email-input">TU EMAIL</label>
                </div>

                <button class="btn-glass-primary-v2" style="margin-top:5px; height:48px !important; width:100%; font-size:0.95rem; font-weight:800;" onclick="window.processCouponClaim()">
                    OBTENER MI DESCUENTO
                </button>


            </div>
        </div>
    `;




    backdrop.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Block scroll

    setTimeout(() => backdrop.classList.add('active'), 10);


    const content = document.getElementById('coupon-modal-content');
    const bar = document.getElementById('coupon-pull-bar');
    if (content && bar) initBottomSheetDrag(content, window.closeCouponModal);
};


window.closeCouponModal = function () {
    const b = document.getElementById('coupon-modal-backdrop');
    if (b) {
        b.classList.add('closing');
        b.classList.remove('active');
        document.body.style.overflow = ''; // Unlock scroll
        setTimeout(() => {
            b.style.display = 'none';
            b.classList.remove('closing');
        }, 400);
    }
};



window.processCouponClaim = async function () {
    const emailInput = document.getElementById('coupon-email-input');
    const email = emailInput?.value;
    const btn = document.querySelector('.btn-glass-primary-v2');

    if (!email || !email.includes('@')) {
        alert("Por favor, introduce un correo válido.");
        return;
    }

    // 🛡️ ANTI-TYPO GUARD: Check for .cm (common typo for .com)
    if (email.toLowerCase().endsWith('.cm') || email.toLowerCase().includes('gmail.cm')) {
        const confirmTypo = confirm(`Tu email termina en ".cm" (${email}). ¿Es correcto? Quizás quisiste decir ".com".`);
        if (!confirmTypo) return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> VERIFICANDO...';
    }

    try {
        // Step 1: Check if email exists in DB
        const checkRes = await fetch(`${API_URL}/auth/check-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const checkData = await checkRes.json();

        if (!checkData.available) {
            alert("Este correo ya tiene una cuenta. Por favor, inicia sesión para acceder a tus beneficios.");
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'OBTENER MI DESCUENTO';
            }
            return;
        }

        // Step 2: Generate Welcome Coupon Code
        const couponCode = 'OFFSZN-' + Math.random().toString(36).substring(2, 7).toUpperCase();

        // Step 3: Save to DB before SignUp (or as part of the flow)
        const { error: dbError } = await window.supabaseClient
            .from('cupones_bienvenida_offszn')
            .upsert({
                email_offszn: email,
                codigo_offszn: couponCode,
                status_offszn: 'unclaimed'
            });

        if (dbError) {
            // We proceed anyway as SignUp is more important, or we can choose to fail.
            // Let's at least keep a local record.
        }

        // Step 4: Trigger Supabase Auth Sign Up (to send verification email)
        const tempPassword = 'OFFSZN-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '!';
        const redirectUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? window.location.origin + '/explorar.html'
            : 'https://offszn.lat/explorar.html';


        const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
            email: email,
            password: tempPassword,
            options: {
                emailRedirectTo: redirectUrl,
                data: {
                    welcome_coupon: true,
                    coupon_code: couponCode
                }
            }
        });

        if (authError) {
            throw authError;
        }



        // Step 3: Save intent to claim coupon after onboarding
        localStorage.setItem('offszn_pending_coupon_claim', 'true');
        localStorage.setItem('offszn_return_after_welcome', window.location.href);

        // Update the Tab UI to show "Pending activation"
        const box = document.getElementById('welcome-promo-box');
        if (box) {
            box.className = 'promo-card-v2 claimed-style';
            box.innerHTML = `
                <div style="font-size:0.85rem; font-weight:800; color:#fff; letter-spacing:1.5px; margin-bottom:12px; display:flex; align-items:center; gap:8px; text-transform:uppercase;">
                    <i class="bi bi-clock-history"></i> Activación pendiente
                </div>
                <div style="font-size:0.9rem; color:#fff; font-weight:600; margin-bottom:10px;">¡Casi listo!</div>
                <div style="font-size:0.85rem; color:#888; margin-bottom:20px; line-height:1.5;">Tu cupón de 10% de descuento se activará automáticamente al <b>completar tu perfil</b>.</div>
                
                <div style="background:rgba(255,255,255,0.03); border:1px dashed rgba(255,255,255,0.1); border-radius:10px; padding:20px; text-align:center; color:#555;">
                     EL CÓDIGO SE REVELARÁ AQUÍ
                </div>

                <div style="font-size:0.75rem; color:#555; margin-top:15px; background:rgba(255,255,255,0.01); padding:12px; border-radius:6px; border:1px solid rgba(255,255,255,0.03); text-align: center;">
                    <span>Revisa tu email: <b>${email}</b></span>
                </div>
            `;
        }

        window.closeCouponModal();


    } catch (err) {
        // If it's a Supabase error (like rate limit), show it clearly
        const msg = err.message || "Error al procesar la solicitud.";
        alert(`Aviso: ${msg}. Si el correo no llega en 5 minutos, intenta de nuevo o revisa tu carpeta de SPAM.`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'OBTENER MI DESCUENTO';
        }
    }
};

window.resetCouponClaim = async function () {
    if (confirm("¿Quieres cambiar el email o cancelar la solicitud? Esto cerrará tu sesión temporal.")) {
        try {
            localStorage.removeItem('offszn_welcome_claimed');
            if (window.supabaseClient) {
                await window.supabaseClient.auth.signOut();
            }
            // Clear auth token for safety
            localStorage.removeItem('authToken');
            document.cookie = "sb-access-token=; path=/; max-age=0; SameSite=Strict; Secure";

            window.location.reload();
        } catch (e) {
            window.location.reload();
        }
    }
};

window.copyCouponToClipboard = function (text, btn) {
    const originalHtml = btn.innerHTML;
    const setCopiedState = () => {
        btn.innerHTML = '<i class="bi bi-check-lg"></i> COPIADO';
        btn.style.color = '#4bff8f';
        btn.style.pointerEvents = 'none';
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.style.color = '';
            btn.style.pointerEvents = '';
        }, 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {

            setCopiedState();
        }).catch(err => {
            fallbackCopy(text, setCopiedState);
        });
    } else {
        fallbackCopy(text, setCopiedState);
    }

    function fallbackCopy(textToCopy, successCallback) {
        try {
            const el = document.createElement('textarea');
            el.value = textToCopy;
            el.style.position = 'fixed';
            el.style.opacity = 0;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            successCallback();
        } catch (e) {
            alert("No se pudo copiar automáticamente. Código: " + textToCopy);
        }
    }
};



window.openNegotiationModal = function () {
    const product = window.currentProductData;
    if (!product) return;

    const producerName = product.producer?.nickname || 'Productor';
    const currentPrice = product.price_basic || 0;

    let backdrop = document.getElementById('negotiate-modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'negotiate-modal-backdrop';
        backdrop.className = 'share-modal-backdrop';
        backdrop.onclick = (e) => { if (e.target === backdrop) window.closeNegotiationModal(); };
        document.body.appendChild(backdrop);
    }

    backdrop.innerHTML = `
        <div class="share-modal-content" id="negotiate-modal-content" style="max-width:450px;">
            <div class="modal-pull-bar" id="negotiate-pull-bar"></div>
            <div class="lic-modal-header" style="margin-bottom:20px; border-bottom:none; justify-content:center;">
                <h3 style="font-weight:800; margin:0;">Haz una Propuesta</h3>
            </div>
            
            <div style="color:#888; font-size:0.95rem; margin-bottom:20px; line-height:1.5;">
                ¿Tienes un presupuesto diferente para <b style="color:#fff;">${product.name}</b>? Envíale tu oferta a <b style="color:#fff;">${producerName}</b> directamente.
            </div>

            <div class="negotiate-form" style="display:flex; flex-direction:column; gap:10px;">
                <div class="floating-group">
                    <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#fff; font-weight:700; z-index:5;">$</span>
                    <input type="number" id="offer-amount" placeholder=" " style="padding-left:30px !important;">
                    <label for="offer-amount" style="left:30px;">Tu Oferta (USD)</label>
                    <div style="font-size:0.75rem; color:#555; margin-top:5px;">Precio sugerido: $${currentPrice}</div>
                </div>


                <div class="floating-group">
                    <input type="email" id="offer-email" placeholder=" ">
                    <label for="offer-email">Tu Email</label>
                </div>

                <p style="font-size:0.75rem; color:#666; margin:0;">Límite: 1 propuesta por día. Te responderemos en menos de 24h.</p>

                <button class="cart-btn-mobile-fix" style="width:100%; height:50px !important; margin-top:10px;" onclick="window.submitNegotiation()">
                    LANZAR OFERTA
                </button>
            </div>
        </div>
    `;


    backdrop.style.display = 'flex';
    setTimeout(() => backdrop.classList.add('active'), 10);

    const content = document.getElementById('negotiate-modal-content');
    const bar = document.getElementById('negotiate-pull-bar');
    if (content && bar) initBottomSheetDrag(content, window.closeNegotiationModal);
};


window.closeNegotiationModal = function () {
    const backdrop = document.getElementById('negotiate-modal-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        setTimeout(() => backdrop.style.display = 'none', 300);
    }
};

window.submitNegotiation = async function () {
    const amount = document.getElementById('offer-amount')?.value;
    const email = document.getElementById('offer-email')?.value;
    const product = window.currentProductData;
    const btn = document.querySelector('.cart-btn-mobile-fix');

    const amountNum = parseFloat(amount);
    if (!amount || amountNum < 10 || !email || !email.includes('@')) {
        alert("La oferta mínima es de $10 USD. Por favor, completa tu email correctamente.");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> PROCESANDO...';
    }

    try {
        // Step 1: Check if email exists in DB
        const checkRes = await fetch(`${API_URL}/auth/check-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const checkData = await checkRes.json();

        // If guest, trigger registration
        if (checkData.available) {
            const tempPassword = 'OFFSZN-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '!';
            const redirectUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? window.location.origin + '/explorar.html'
                : 'https://offszn.lat/explorar.html';

            const { error: authError } = await window.supabaseClient.auth.signUp({
                email: email,
                password: tempPassword,
                options: { emailRedirectTo: redirectUrl }
            });

            if (authError) throw authError;

        } else {
            // For safety, warn them that they have an account (optional, but good for UX)

        }

        const activeLicTab = document.querySelector('.lic-tab.active');
        const selectedLicense = activeLicTab ? activeLicTab.textContent.trim() : 'Standard';

        // Step 2: Save the proposal
        const { error } = await window.supabaseClient.from('propuestas_offszn').insert({
            product_id: product.id,
            producer_id: product.producer_id,
            email: email,
            amount: amountNum,
            status: 'pending',
            selected_license: selectedLicense
        });

        if (error) throw error;

        alert("¡Propuesta enviada con éxito! Revisa tu correo pronto para activar tu cuenta y ver la respuesta.");
        window.closeNegotiationModal();

    } catch (err) {
        alert(err.message || "Hubo un error al enviar la propuesta. Inténtalo más tarde.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'LANZAR OFERTA';
        }
    }
};

/**
 * Helper: Bottom Sheet Drag Logic (Bro Style)
 */
function initBottomSheetDrag(element, closeFn) {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    let startTime = 0;

    if (window.innerWidth > 992) return;

    element.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        startTime = Date.now();
        isDragging = true;
        element.style.transition = 'none';
    }, { passive: false });

    element.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentY = e.touches[0].clientY - startY;

        // Follow finger 1:1 if dragging down
        if (currentY > 0) {
            if (e.cancelable) e.preventDefault(); // Stop page scrolling only if cancelable
            element.style.transform = `translateY(${currentY}px)`;
        } else {
            // Slight resistance when pulling up
            const resistance = Math.abs(currentY) / 10;
            element.style.transform = `translateY(-${resistance}px)`;
        }
    }, { passive: false });


    element.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;

        const duration = Date.now() - startTime;
        const velocity = currentY / duration;

        element.style.transition = 'transform 0.4s cubic-bezier(0.1, 0.9, 0.2, 1)';

        if (currentY > 100 || (velocity > 0.4 && currentY > 20)) {
            // Smoothly complete the close move
            element.style.transform = 'translateY(100%)';
            setTimeout(() => {
                closeFn();
                // Clear inline style after transition so it doesn't break next open
                setTimeout(() => { element.style.transform = ''; }, 400);
            }, 10);
        } else {
            element.style.transform = 'translateY(0)';
            // Clear manual transform after snapping back
            setTimeout(() => { if (!isDragging) element.style.transform = ''; }, 400);
        }
    }, { passive: false });


}
