/**
 * Premium Profile - Rendering Engine
 * Handles the dynamic UI generation for products, services, playlists, and licenses.
 */

window.PremiumRender = {
    /**
     * Helper to resolve image URLs based on storage version
     */
    resolveImg: function(path, storageVer) {
        if (!path) return '/images/portada-default.png';
        if (path.startsWith('http')) return path;

        let cleanPath = path;
        if (path.startsWith('products/')) {
            cleanPath = path.substring(9);
        }

        if (storageVer !== 'supabase' || path.includes('covers/')) {
            return `https://offszn.lat/api/r2-public/products/${cleanPath}`;
        }

        return `https://qtjpvztpgfymjhhpoouq.supabase.co/storage/v1/object/public/products/${cleanPath}`;
    },

    /**
     * Renders the product grid for a specific category
     */
    renderProducts: function(containerId, products, category, userNickname, isOwner) {
        const grid = document.getElementById(containerId);
        if (!grid) return;

        if (products.length === 0) {
            const msg = `Sube tu primer ${category.toLowerCase().slice(0, -1)}`;
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px 0; width: 100%;">
                    <p style="color: #888; margin-bottom: 20px;">No hay ${category.toLowerCase()} disponibles.</p>
                    ${isOwner ? `
                        <button class="lic-cta-btn" style="width: auto; padding: 12px 30px; margin: 0 auto; display: block; background: #fff; color: #000;" 
                                onclick="window.location.href='/dashboard/upload'">
                            <i class="bi bi-plus-lg"></i> ${msg}
                        </button>` : ''}
                </div>
            `;
            return;
        }

        grid.innerHTML = products.map((p, idx) => {
            const img = this.resolveImg(p.image_url, p.r2_version || p.storage_version);
            const type = p.product_type?.toLowerCase() || 'beat';
            const identifier = p.public_slug || (window.IdObfuscator ? window.IdObfuscator.encodeId(p.id) : p.id);
            const link = `/${type}/${identifier}`;
            const isLiked = window.FavoritesManager ? window.FavoritesManager.isLiked(String(p.id)) : false;

            return `
                <div class="premium-product-card" onclick="window.location.href='${link}'">
                    <div class="explore-img-container">
                        <img src="${img}" class="explore-main-img" alt="${p.name}" onerror="this.src='/images/portada-default.png'">
                        <button class="explore-heart-action" id="like-btn-${p.id}" onclick="handleLike(event, '${p.id}', '${p.producer_id}')">
                            <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}" style="color: ${isLiked ? '#ef4444' : '#fff'}"></i>
                        </button>
                        <button class="explore-play-action" onclick="handlePlay(event, ${idx})">
                            <i class="bi bi-play-fill" style="font-size: 1.5rem;"></i>
                        </button>
                    </div>
                    <div class="explore-product-info">
                        <div class="explore-product-name">${p.name}</div>
                        <div class="explore-product-author">${userNickname || 'Productor'}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Renders the services shelf (Explore style)
     */
    renderServices: function(containerId, sectionId, services, userNickname, isOwner, userAvatar) {
        const container = document.getElementById(containerId);
        const section = document.getElementById(sectionId);
        if (!container || !section) return;

        if (services.length > 0 || isOwner) {
            section.style.display = 'block';
            
            if (services.length === 0 && isOwner) {
                container.innerHTML = `
                    <div style="flex: 1; text-align: center; padding: 60px 0; border: 1px dashed rgba(255,255,255,0.08); border-radius: 24px;">
                        <p style="color: #888; margin-bottom: 20px;">Aún no has añadido servicios profesionales.</p>
                        <button class="lic-cta-btn" style="width: auto; padding: 12px 30px; margin: 0 auto; display: block; background: #fff; color: #000;" 
                                onclick="window.location.href='/dashboard/services'">
                            <i class="bi bi-plus-lg"></i> Sube tu primer servicio
                        </button>
                    </div>
                `;
                return;
            }

            container.innerHTML = services.map((s, i) => {
                const img = s.image_url || userAvatar || '/images/portada-default.png';
                const slug = (s.title || 'servicio').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
                const code = window.IdObfuscator ? window.IdObfuscator.encodeId(s.id) : s.id;
                
                const serviceSlug = `${slug}-${code}-${userNickname}`;
                const link = `/servicio/${serviceSlug}`;

                return `
                    <div class="shelf-card" onclick="window.location.href='${link}'">
                        <img src="${img}" class="shelf-card-img" onerror="this.src='${userAvatar || '/images/portada-default.png'}'">
                        <div class="shelf-card-info">
                            <div class="shelf-card-title">${s.title || s.name}</div>
                            <div class="shelf-card-sub">${s.category || 'Servicio profesional'} • Desde $${s.price || s.price_basic || '0'}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    },

    /**
     * Renders the playlists shelf
     */
    renderPlaylists: function(containerId, sectionId, playlists, userNickname) {
        const container = document.getElementById(containerId);
        const section = document.getElementById(sectionId);
        if (!container || !section) return;

        if (playlists.length > 0) {
            section.style.display = 'block';
            
            container.innerHTML = playlists.map((p, i) => {
                const img = p.cover_url ? (p.cover_url.startsWith('http') ? p.cover_url : `https://offszn.lat/api/r2-public/${p.cover_url}`) : '/images/portada-default.png';
                const finalSlug = p.slug || (p.title ? p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : '');
                const link = finalSlug ? `/@${userNickname}/${finalSlug}` : `/playlist.html`;

                return `
                    <div class="shelf-card" onclick="window.location.href='${link}'">
                        <img src="${img}" class="shelf-card-img" onerror="this.src='/images/portada-default.png'">
                        <div class="shelf-card-info">
                            <div class="shelf-card-title">${p.title || 'Playlist'}</div>
                            <div class="shelf-card-sub">${p.category || 'Colección'} • ${p.track_ids?.length || 0} tracks</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    },

    /**
     * Renders the license grid
     */
    renderLicenses: function(containerId, sectionId, settings) {
        const grid = document.getElementById(containerId);
        const section = document.getElementById(sectionId);
        if (!grid || !section) return;

        const systemDefaults = {
            basic: { name: 'Basic Lease', price: 20, enabled: true, usage: { streams: '50000', sales: '2000' } },
            premium: { name: 'Premium Lease', price: 50, enabled: true, usage: { streams: '500000', sales: '5000' } },
            trackout: { name: 'Trackout Lease', price: 100, enabled: true, usage: { streams: '1000000', sales: '10000' } },
            unlimited: { name: 'Unlimited License', price: 300, enabled: true, usage: { streams: 'UNLIMITED', sales: 'UNLIMITED' } }
        };

        let finalSettings = {};
        const baseSettings = settings || {};

        ['basic', 'premium', 'trackout', 'unlimited'].forEach(key => {
            let userLic = {};
            if (key === 'trackout') {
                userLic = baseSettings['trackout'] || baseSettings['exclusive'] || baseSettings['offszn_exclusive'] || {};
            } else {
                userLic = baseSettings[key] || baseSettings[`offszn_${key}`] || {};
            }
            const sysLic = systemDefaults[key];
            finalSettings[key] = {
                ...sysLic,
                ...userLic,
                enabled: userLic.enabled !== false,
                name: userLic.name || sysLic.name,
                price: userLic.price !== undefined ? userLic.price : sysLic.price,
                usage: {
                    streams: userLic.usage?.streams || userLic.streams || sysLic.usage.streams,
                    sales: userLic.usage?.sales || userLic.sales || sysLic.usage.sales
                }
            };
        });

        const activeKeys = Object.keys(finalSettings).filter(k => finalSettings[k].enabled);

        if (activeKeys.length > 0) {
            section.style.display = 'block';
            grid.innerHTML = activeKeys.map((key, i) => {
                const lic = finalSettings[key];
                const isFeatured = (key === 'premium') || (activeKeys.length > 1 && i === 1);
                const formatVal = (v) => {
                    if (!v) return 'Unlimited';
                    if (v.toString().toLowerCase() === 'unlimited' || v.toString().toLowerCase() === 'ilimitado') return 'Unlimited';
                    let n = parseInt(v);
                    if (isNaN(n)) return v;
                    return n.toLocaleString();
                };

                return `
                    <div class="lic-card-premium ${isFeatured ? 'featured' : ''}">
                        <div class="lic-name-label">${lic.name}</div>
                        <div class="lic-price-tag"><span>$</span>${lic.price}</div>
                        <ul class="lic-feature-list">
                            <li><i class="bi bi-check2-circle"></i> <strong>${formatVal(lic.usage.streams)}</strong> Streams</li>
                            <li><i class="bi bi-check2-circle"></i> <strong>${formatVal(lic.usage.sales)}</strong> Ventas</li>
                            <li><i class="bi bi-check2-circle"></i> Uso Comercial</li>
                            <li><i class="bi bi-check2-circle"></i> Contrato Pro</li>
                        </ul>
                    </div>
                `;
            }).join('');
        }
    }
};
