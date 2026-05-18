/**
 * engine.js
 * Toma el estado (JSON) y lo "dibuja" en el contenedor destino.
 */

// Global tab switching logic for products in preview
if (!window.switchStoreTab) {
    window.switchStoreTab = function(btnEl, cat, sectionId) {
        // Alternar clase active en los botones
        const container = btnEl.closest('.tabs-header');
        if (container) {
            container.querySelectorAll('.tab-trigger').forEach(b => b.classList.remove('active'));
        }
        btnEl.classList.add('active');

        const allProducts = window.builderProducts ? window.builderProducts[sectionId] : [];
        const userNickname = window.builderNickname || 'Artista';

        // Filtrar productos por tipo
        let filtered = (allProducts || []).filter(p => {
            const type = (p.product_type || '').toUpperCase();
            if (cat === 'BEATS') return type === 'BEAT';
            if (cat === 'DRUMKITS') return type === 'DRUMKIT';
            if (cat === 'LOOPKITS') return type === 'LOOPKIT';
            if (cat === 'PRESETS') return type.includes('PRESET') || type === 'TEMPLATE';
            return false;
        });

        if (window.IS_LIVE_PROFILE) {
            window.currentTabProducts = filtered;
        }

        const grid = document.getElementById(`products-grid-${sectionId}`);
        if (!grid) return;

        // Generar pills si es BEATS y tiene géneros
        let pillsHtml = '';
        if (cat === 'BEATS' && filtered.length > 0) {
            const genres = ['TODOS', ...new Set(filtered.map(p => p.genre).filter(Boolean))];
            if (genres.length > 1) {
                pillsHtml = `<div class="filter-pills" style="margin-bottom: 24px; display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; width: max-content; max-width: 100%; margin: 0 auto 24px auto; padding: 4px 16px; -webkit-overflow-scrolling: touch;">
                    ${genres.map((g, idx) => `
                        <button class="pill ${idx === 0 ? 'active' : ''}" onclick="window.filterStoreByGenre(event, '${g}', '${sectionId}', '${cat}')" style="
                            padding: 6px 16px;
                            border-radius: 99px;
                            background: ${idx === 0 ? '#fff' : 'rgba(255,255,255,0.05)'};
                            color: ${idx === 0 ? '#000' : '#fff'};
                            font-weight: 600;
                            font-size: 0.8rem;
                            border: 1px solid rgba(255,255,255,0.1);
                            white-space: nowrap;
                            flex-shrink: 0;
                            cursor: pointer;
                            transition: all 0.2s ease;
                        ">${g}</button>
                    `).join('')}
                </div>`;
            }
        }

        // Add pills container if it doesn't exist, just before the grid
        let pillsContainer = grid.previousElementSibling;
        if (pillsContainer && pillsContainer.classList.contains('pills-wrapper-builder')) {
            pillsContainer.innerHTML = pillsHtml;
        } else if (pillsHtml) {
            const wrapper = document.createElement('div');
            wrapper.className = 'pills-wrapper-builder';
            wrapper.style.width = '100%';
            wrapper.style.maxWidth = '100%';
            wrapper.style.overflow = 'hidden';
            wrapper.innerHTML = pillsHtml;
            grid.parentNode.insertBefore(wrapper, grid);
        } else if (pillsContainer && pillsContainer.classList.contains('pills-wrapper-builder')) {
            pillsContainer.innerHTML = ''; // clear if not BEATS
        }

        // Helper para resolver imagen
        const resolveImg = (path, storageVer) => {
            if (!path) return 'https://offszn.lat/images/portada-default.png';
            if (path.startsWith('http')) return path;
            let cleanPath = path;
            if (path.startsWith('products/')) {
                cleanPath = path.substring(9);
            }
            if (storageVer !== 'supabase' || path.includes('covers/')) {
                return `https://offszn.lat/api/r2-public/products/${cleanPath}`;
            }
            return `https://qtjpvztpgfymjhhpoouq.supabase.co/storage/v1/object/public/products/${cleanPath}`;
        };

        grid.innerHTML = filtered.map((p, idx) => {
            const img = resolveImg(p.image_url, p.r2_version || p.storage_version);
            if (window.IS_LIVE_PROFILE) {
                const type = p.product_type?.toLowerCase() || 'beat';
                const identifier = p.public_slug || (window.IdObfuscator ? window.IdObfuscator.encodeId(p.id) : p.id);
                const link = `/${type}/${identifier}`;
                const isLiked = window.FavoritesManager ? window.FavoritesManager.isLiked(String(p.id)) : false;
                
                return `
                    <div class="premium-product-card" onclick="window.location.href='${link}'" style="cursor: pointer;">
                        <div class="explore-img-container">
                            <img src="${img}" class="explore-main-img" alt="${p.name}" onerror="this.src='https://offszn.lat/images/portada-default.png'">
                            <button class="explore-heart-action" id="like-btn-${p.id}" onclick="window.handleLike(event, '${p.id}', '${p.producer_id}')">
                                <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}" style="color: ${isLiked ? '#ef4444' : '#fff'}"></i>
                            </button>
                            <button class="explore-play-action" onclick="window.handlePlay(event, ${idx})">
                                <i class="bi bi-play-fill" style="font-size: 1.5rem;"></i>
                            </button>
                        </div>
                        <div class="explore-product-info">
                            <div class="explore-product-name">${p.name}</div>
                            <div class="explore-product-author">${userNickname}</div>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="premium-product-card">
                    <div class="explore-img-container">
                        <img src="${img}" class="explore-main-img" alt="${p.name}" onerror="this.src='https://offszn.lat/images/portada-default.png'">
                        <button class="explore-heart-action" onclick="event.stopPropagation()">
                            <i class="bi bi-heart"></i>
                        </button>
                        <button class="explore-play-action" onclick="event.stopPropagation()">
                            <i class="bi bi-play-fill" style="font-size: 1.5rem;"></i>
                        </button>
                    </div>
                    <div class="explore-product-info">
                        <div class="explore-product-name">${p.name}</div>
                        <div class="explore-product-author">${userNickname}</div>
                    </div>
                </div>
            `;
        }).join('');

        if (window.bindDragScroll) {
            setTimeout(() => { window.bindDragScroll(grid.parentNode); }, 50);
        }
    };
}

if (!window.filterStoreByGenre) {
    window.filterStoreByGenre = function(e, genre, sectionId, cat) {
        if (e) e.stopPropagation();
        
        const pillBtn = e.currentTarget;
        const container = pillBtn.closest('.filter-pills');
        if (container) {
            container.querySelectorAll('.pill').forEach(btn => {
                btn.classList.remove('active');
                btn.style.background = 'rgba(255,255,255,0.05)';
                btn.style.color = '#fff';
            });
        }
        pillBtn.classList.add('active');
        pillBtn.style.background = '#fff';
        pillBtn.style.color = '#000';

        const allProducts = window.builderProducts ? window.builderProducts[sectionId] : [];
        const userNickname = window.builderNickname || 'Artista';

        // Filtrar beats por género
        const baseBeats = (allProducts || []).filter(p => (p.product_type || '').toUpperCase() === 'BEAT');
        const genreFiltered = genre === 'TODOS' 
            ? baseBeats 
            : baseBeats.filter(p => p.genre === genre);

        if (window.IS_LIVE_PROFILE) {
            window.currentTabProducts = genreFiltered;
        }

        const grid = document.getElementById(`products-grid-${sectionId}`);
        if (!grid) return;

        if (genreFiltered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px 0; width: 100%;">
                    <p style="color: #888; margin-bottom: 20px;">No hay beats en este género.</p>
                </div>
            `;
            return;
        }

        // Helper para resolver imagen
        const resolveImg = (path, storageVer) => {
            if (!path) return 'https://offszn.lat/images/portada-default.png';
            if (path.startsWith('http')) return path;
            let cleanPath = path;
            if (path.startsWith('products/')) {
                cleanPath = path.substring(9);
            }
            if (storageVer !== 'supabase' || path.includes('covers/')) {
                return `https://offszn.lat/api/r2-public/products/${cleanPath}`;
            }
            return `https://qtjpvztpgfymjhhpoouq.supabase.co/storage/v1/object/public/products/${cleanPath}`;
        };

        grid.innerHTML = genreFiltered.map((p, idx) => {
            const img = resolveImg(p.image_url, p.r2_version || p.storage_version);
            if (window.IS_LIVE_PROFILE) {
                const type = p.product_type?.toLowerCase() || 'beat';
                const identifier = p.public_slug || (window.IdObfuscator ? window.IdObfuscator.encodeId(p.id) : p.id);
                const link = `/${type}/${identifier}`;
                const isLiked = window.FavoritesManager ? window.FavoritesManager.isLiked(String(p.id)) : false;
                
                return `
                    <div class="premium-product-card" onclick="window.location.href='${link}'" style="cursor: pointer;">
                        <div class="explore-img-container">
                            <img src="${img}" class="explore-main-img" alt="${p.name}" onerror="this.src='https://offszn.lat/images/portada-default.png'">
                            <button class="explore-heart-action" id="like-btn-${p.id}" onclick="window.handleLike(event, '${p.id}', '${p.producer_id}')">
                                <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}" style="color: ${isLiked ? '#ef4444' : '#fff'}"></i>
                            </button>
                            <button class="explore-play-action" onclick="window.handlePlay(event, ${idx})">
                                <i class="bi bi-play-fill" style="font-size: 1.5rem;"></i>
                            </button>
                        </div>
                        <div class="explore-product-info">
                            <div class="explore-product-name">${p.name}</div>
                            <div class="explore-product-author">${userNickname}</div>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="premium-product-card">
                    <div class="explore-img-container">
                        <img src="${img}" class="explore-main-img" alt="${p.name}" onerror="this.src='https://offszn.lat/images/portada-default.png'">
                        <button class="explore-heart-action" onclick="event.stopPropagation()">
                            <i class="bi bi-heart"></i>
                        </button>
                        <button class="explore-play-action" onclick="event.stopPropagation()">
                            <i class="bi bi-play-fill" style="font-size: 1.5rem;"></i>
                        </button>
                    </div>
                    <div class="explore-product-info">
                        <div class="explore-product-name">${p.name}</div>
                        <div class="explore-product-author">${userNickname}</div>
                    </div>
                </div>
            `;
        }).join('');

        if (window.bindDragScroll) {
            setTimeout(() => { window.bindDragScroll(grid.parentNode); }, 50);
        }
    };
}

if (!window.slideStoreShelf) {
    window.slideStoreShelf = function(sectionId, dir) {
        const shelf = document.getElementById(`products-grid-${sectionId}`);
        if (!shelf) return;
        const card = shelf.querySelector('.premium-product-card');
        const scrollAmount = card ? (card.clientWidth + 16) * 2 : 400;
        shelf.scrollBy({ left: scrollAmount * dir, behavior: 'smooth' });
    };
}

// --- PREMIUM LICENSE DETAIL MODAL LOGIC ---
window.closeLicenseDetailsModal = function() {
    const modalEl = document.getElementById('lic-detail-modal');
    if (!modalEl) return;
    const overlay = modalEl.querySelector('.lic-modal-overlay');
    const card = modalEl.querySelector('.lic-modal-card');
    if (overlay) overlay.style.opacity = '0';
    if (card) {
        card.style.transform = 'scale(0.9) translateY(20px)';
        card.style.opacity = '0';
    }
    setTimeout(() => {
        modalEl.style.display = 'none';
    }, 300);
};

window.showLicenseDetailsModal = function(e, encodedData) {
    if (e) e.stopPropagation();
    const lic = JSON.parse(decodeURIComponent(encodedData));
    
    // Ensure modal container exists
    let modalEl = document.getElementById('lic-detail-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'lic-detail-modal';
        modalEl.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 100000;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;
        modalEl.innerHTML = `
            <div class="lic-modal-overlay" style="position: absolute; inset: 0; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(12px); opacity: 0; transition: opacity 0.3s ease;"></div>
            <div class="lic-modal-card custom-scrollbar" style="position: relative; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; background: #0c0c0e; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 28px; padding: 32px; transform: scale(0.9) translateY(20px); opacity: 0; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); color: #fff; font-family: 'Plus Jakarta Sans', sans-serif;">
                <button class="lic-modal-close" style="position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: #888; cursor: pointer; font-size: 1.2rem; transition: all 0.2s; z-index: 20;" onmouseover="this.style.color='#fff'; this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.color='#888'; this.style.background='rgba(255,255,255,0.03)'"><i class="bi bi-x"></i></button>
                <div id="lic-modal-content-area"></div>
            </div>
        `;
        document.body.appendChild(modalEl);

        // Add event listeners
        modalEl.querySelector('.lic-modal-overlay').addEventListener('click', window.closeLicenseDetailsModal);
        modalEl.querySelector('.lic-modal-close').addEventListener('click', window.closeLicenseDetailsModal);
    }
    
    const contentArea = document.getElementById('lic-modal-content-area');
    if (!contentArea) return;

    // Resolve included files checkboxes
    const files = lic.files || { mp3: true, wav: false, stems: false };
    const formatLabel = (v) => {
        if (!v) return 'Ilimitado';
        if (v.toString().toLowerCase() === 'unlimited' || v.toString().toLowerCase() === 'ilimitado') return 'Ilimitado';
        let n = parseInt(v);
        if (isNaN(n)) return v;
        return n.toLocaleString();
    };

    const streamsText = formatLabel(lic.usage?.streams);
    const salesText = formatLabel(lic.usage?.sales);
    const radioText = lic.usage?.radio || 'No Permitido';
    const publishingText = lic.publishing !== undefined ? `${lic.publishing}% / ${100 - lic.publishing}%` : '50% / 50%';
    const royaltiesText = lic.royalties !== undefined ? `${lic.royalties}%` : '50%';

    contentArea.innerHTML = `
        <div style="margin-bottom: 24px; text-align: left;">
            <div style="font-size: 0.8rem; font-weight: 800; color: #0cbc87; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <span>Detalles de Licencia</span>
                ${lic.is_favorite ? '<span style="background: rgba(255, 215, 0, 0.1); color: #ffd700; font-size: 0.7rem; padding: 2px 8px; border-radius: 99px; border: 1px solid rgba(255, 215, 0, 0.2); font-weight: 700;"><i class="bi bi-star-fill"></i> Recomendada</span>' : ''}
            </div>
            <h3 style="font-size: 1.75rem; font-weight: 900; margin: 0; color: #fff; letter-spacing: -0.5px;">${lic.nombre}</h3>
            <div style="font-size: 2.2rem; font-weight: 900; color: #fff; margin-top: 10px;">
                <span style="font-size: 1.2rem; font-weight: 700; vertical-align: top; margin-right: 2px;">$</span>${lic.precio}
            </div>
        </div>

        <!-- Archivos Incluidos -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 16px; margin-bottom: 20px; text-align: left;">
            <div style="font-size: 0.8rem; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Archivos Incluidos</div>
            <div style="display: flex; gap: 16px; justify-content: space-around;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="bi bi-check-circle-fill" style="color: #0cbc87; font-size: 1.1rem;"></i>
                    <span style="font-size: 0.9rem; font-weight: 600; color: #fff;">MP3</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; opacity: ${files.wav ? '1' : '0.4'}">
                    <i class="bi ${files.wav ? 'bi-check-circle-fill' : 'bi-x-circle'}" style="color: ${files.wav ? '#0cbc87' : '#666'}; font-size: 1.1rem;"></i>
                    <span style="font-size: 0.9rem; font-weight: 600; color: ${files.wav ? '#fff' : '#888'};">WAV</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; opacity: ${files.stems ? '1' : '0.4'}">
                    <i class="bi ${files.stems ? 'bi-check-circle-fill' : 'bi-x-circle'}" style="color: ${files.stems ? '#0cbc87' : '#666'}; font-size: 1.1rem;"></i>
                    <span style="font-size: 0.9rem; font-weight: 600; color: ${files.stems ? '#fff' : '#888'};">STEMS</span>
                </div>
            </div>
        </div>

        <!-- Límites de Uso Comercial -->
        <div style="margin-bottom: 24px; text-align: left;">
            <div style="font-size: 0.8rem; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Límites de Distribución</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 12px; padding: 12px;">
                    <div style="font-size: 0.75rem; color: #666; font-weight: 600;">Reproducciones</div>
                    <div style="font-size: 1rem; font-weight: 700; color: #fff; margin-top: 4px;">${streamsText}</div>
                </div>
                <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 12px; padding: 12px;">
                    <div style="font-size: 0.75rem; color: #666; font-weight: 600;">Ventas Físicas</div>
                    <div style="font-size: 1rem; font-weight: 700; color: #fff; margin-top: 4px;">${salesText}</div>
                </div>
                <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 12px; padding: 12px; grid-column: 1 / -1;">
                    <div style="font-size: 0.75rem; color: #666; font-weight: 600;">Transmisión de Radio</div>
                    <div style="font-size: 1rem; font-weight: 700; color: #fff; margin-top: 4px;">${radioText}</div>
                </div>
            </div>
        </div>

        <!-- Splits y Opciones Avanzadas (Publishing & Royalties) -->
        <div style="margin-bottom: 24px; text-align: left;">
            <div style="font-size: 0.8rem; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Regalías & Derechos de Autor</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 12px; padding: 12px;">
                    <div style="font-size: 0.75rem; color: #666; font-weight: 600;">Publishing (Productor/Artista)</div>
                    <div style="font-size: 1rem; font-weight: 700; color: #fff; margin-top: 4px;">${publishingText}</div>
                </div>
                <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 12px; padding: 12px;">
                    <div style="font-size: 0.75rem; color: #666; font-weight: 600;">Royalties del Beat</div>
                    <div style="font-size: 1rem; font-weight: 700; color: #fff; margin-top: 4px;">${royaltiesText}</div>
                </div>
            </div>
        </div>

        <button onclick="window.closeLicenseDetailsModal()" style="width: 100%; padding: 16px; background: #fff; border: none; border-radius: 14px; color: #000; font-weight: 800; font-size: 0.95rem; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='#fff'">Entendido</button>
    `;

    // Show modal
    modalEl.style.display = 'flex';
    // Trigger animations
    setTimeout(() => {
        const overlay = modalEl.querySelector('.lic-modal-overlay');
        const card = modalEl.querySelector('.lic-modal-card');
        if (overlay) overlay.style.opacity = '1';
        if (card) {
            card.style.transform = 'scale(1) translateY(0)';
            card.style.opacity = '1';
        }
    }, 10);
};

export class RendererEngine {
    constructor(rootElement, storeState) {
        this.root = typeof rootElement === 'string' ? document.querySelector(rootElement) : rootElement;
        this.storeState = storeState;
    }

    render(state) {
        const finalState = state || this.storeState || {};
        // 1. Aplicar Variables de Tema Dinámicas
        if (finalState.theme) {
            if (finalState.theme.primaryColor) {
                this.root.style.setProperty('--theme-primary', finalState.theme.primaryColor);
            }
            if (finalState.theme.backgroundColor) {
                this.root.style.setProperty('--theme-bg', finalState.theme.backgroundColor);
            }
        }

        // 2. Limpiar Root
        this.root.innerHTML = '';

        // 3. Renderizar Secciones en orden
        if (finalState.sections && finalState.sections.length > 0) {
            finalState.sections.forEach(sec => {
                const html = this.generateHtmlForSection(sec);
                if (html) {
                    this.root.appendChild(html);
                }
            });
        } else {
            this.root.innerHTML = '<div style="padding: 100px; text-align: center; color: #666;">Tienda Vacía. Añade bloques.</div>';
        }
    }

    // Generador modular
    generateHtmlForSection(section) {
        const div = document.createElement('div');
        div.dataset.sectionId = section.id;
        
        switch (section.type) {
            case 'navbar':
                div.className = 'rendered-navbar prof-nav'; // Agregada clase de su navbar
                let linksHtml = '';
                const userNickname = window.builderNickname || 'Artista';
                
                if (window.IS_LIVE_PROFILE) {
                    const linkMap = {
                        'BEATS': '#products-section',
                        'SERVICIOS': '#services-section',
                        'PLAYLISTS': '#playlists-section',
                        'SOBRE MI': '#about-section',
                        'FAQ': '#faq-section'
                    };
                    linksHtml = (section.props.links || []).map(link => {
                        const href = linkMap[link.toUpperCase()] || '#';
                        return `<a href="${href}" class="nav-link">${link}</a>`;
                    }).join('');
                } else {
                    linksHtml = (section.props.links || []).map(link => `<a href="#">${link}</a>`).join('');
                }

                const avatarHtml = section.props.avatarUrl 
                    ? `<img src="${section.props.avatarUrl}" alt="Avatar" style="width:32px; height:32px; border-radius:50%; object-fit:cover; margin-right:10px;">` 
                    : `<i class="bi bi-fire" style="color: #ff3300; font-size: 18px; margin-right:10px;"></i>`;
                
                div.innerHTML = `
                    <div class="nav-left-group" style="display:flex; align-items:center; gap:16px;">
                        <button class="mobile-hamburger-btn" style="display:none; background:none; border:none; color:#fff; font-size:1.6rem; cursor:pointer; padding:4px; align-items:center; justify-content:center;" onclick="const drawer = document.getElementById('mobile-nav-drawer'); if(drawer) drawer.classList.add('active');">
                            <i class="bi bi-list"></i>
                        </button>
                        <div class="logo" style="display:flex; align-items:center; cursor:pointer;" onclick="if(window.IS_LIVE_PROFILE) { window.location.href='/@${userNickname}' }">
                            ${avatarHtml}
                            <span class="user-nav-name" style="font-weight: 800; font-size: 1rem; color: #fff; text-transform: uppercase;">${section.props.logoText || userNickname}</span>
                        </div>
                    </div>
                    <div class="links">${linksHtml}</div>
                    
                    <div class="navbar-right" style="display:flex; align-items:center; gap:16px;">
                        <!-- Volver a Explorar -->
                        <a href="/explorar.html" class="nav-text-btn" style="color:#aaa; font-size:0.85rem; font-weight:600; text-decoration:none; margin-right: 4px; display: flex; align-items: center; gap: 4px;">
                            Explorar <i class="bi bi-arrow-right-short" style="font-size: 1.1rem; line-height: 1;"></i>
                        </a>

                        <!-- Carrito -->
                        <a href="#" class="nav-icon-btn" title="Carrito" onclick="if(typeof toggleCartPanel === 'function') { toggleCartPanel(event); } else { event.preventDefault(); }" style="position:relative; color:#fff; font-size:1.2rem; text-decoration:none; display:flex; align-items:center;">
                            <i class="bi bi-cart3"></i>
                            <span id="cart-count-badge" class="cart-label-count" style="display:none; position:absolute; top:-6px; right:-6px; background:#ff3300; color:#fff; font-size:0.65rem; font-weight:800; padding:2px 6px; border-radius:10px; line-height:1;">0</span>
                        </a>

                        <!-- Auth section standard -->
                        <div id="nav-auth-section" style="display: none; align-items: center; gap: 12px;">
                            <div class="user-dropdown" style="position:relative;">
                                <div class="user-trigger" onclick="if(typeof toggleUserDropdown === 'function') { toggleUserDropdown(event); } else { event.preventDefault(); }" style="cursor: pointer; display:flex; align-items:center;">
                                    <div id="user-avatar-display" class="user-avatar-placeholder" style="width:32px; height:32px; border-radius:50%; background:#222; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.9rem; border:1px solid rgba(255,255,255,0.1);">W</div>
                                </div>
                                <div class="user-dropdown-menu" style="width: 320px; position:absolute; top:120%; right:0; background:#0f0f0f; border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; display:none; flex-direction:column; gap:8px; box-shadow:0 10px 30px rgba(0,0,0,0.5); z-index:1001;">
                                    <div class="user-dropdown-header" onclick="window.location.href='/perfil-publico.html'" style="display: flex; align-items: center; gap: 12px; background-color: #1a1a1a; border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; cursor: pointer; transition: background-color 0.2s;">
                                        <div class="user-dropdown-avatar-lg" style="width: 36px; height: 36px; font-size: 1rem; border-radius: 50%; background:#222; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold;">W</div>
                                        <div style="display: flex; flex-direction: column;">
                                            <h4 id="dropdown-username" style="margin: 0; font-size: 0.9rem; color: #fff; font-weight: 600;">Usuario</h4>
                                            <span style="color: #999; font-size: 0.75rem;">Ver perfil</span>
                                        </div>
                                    </div>
                                    <a href="/cuenta/mis-kits" class="w-list-item auth-protected" style="color:#ccc; text-decoration:none; padding:8px; font-size:0.85rem; display:flex; align-items:center; gap:8px; border-radius:6px;"><i class="fas fa-folder-open"></i> Catálogo</a>
                                    <a href="/mis-compras.html" class="w-list-item auth-protected" style="color:#ccc; text-decoration:none; padding:8px; font-size:0.85rem; display:flex; align-items:center; gap:8px; border-radius:6px;"><i class="fas fa-layer-group"></i> Compras</a>
                                    <a href="/favoritos.html" class="w-list-item auth-protected" style="color:#ccc; text-decoration:none; padding:8px; font-size:0.85rem; display:flex; align-items:center; gap:8px; border-radius:6px;"><i class="fas fa-heart"></i> Favoritos</a>
                                    <div style="height: 1px; background: rgba(255,255,255,0.05); margin: 4px 0;"></div>
                                    <a href="/account-settings.html" class="w-list-item auth-protected" style="color:#ccc; text-decoration:none; padding:8px; font-size:0.85rem; display:flex; align-items:center; gap:8px; border-radius:6px;"><i class="fas fa-sliders-h"></i> Configuración</a>
                                    <a href="#" id="navbar-logout-btn" class="w-list-item" style="color: #ef4444; text-decoration:none; padding:8px; font-size:0.85rem; display:flex; align-items:center; gap:8px; border-radius:6px; margin-top: 4px;"><i class="fas fa-sign-out-alt" style="color: #ef4444;"></i> Cerrar Sesión</a>
                                </div>
                            </div>
                        </div>

                        <!-- Guest section standard -->
                        <div id="nav-guest-section" style="display: none; align-items: center; gap: 12px;">
                            <a href="/pages/login.html" class="navbar-login-link" style="color:#ccc; font-size:0.85rem; font-weight:600; text-decoration:none;">Entrar</a>
                            <a href="/pages/register.html" class="btn-join" style="background:#fff; color:#000; font-size:0.8rem; font-weight:700; padding:6px 12px; border-radius:20px; text-decoration:none;">Únete</a>
                        </div>
                    </div>

                    <!-- Mobile Navigation Drawer -->
                    <div id="mobile-nav-drawer" class="mobile-drawer">
                        <div class="drawer-backdrop" onclick="const drawer = document.getElementById('mobile-nav-drawer'); if(drawer) drawer.classList.remove('active');"></div>
                        <div class="drawer-content">
                            <div class="drawer-header">
                                <span class="drawer-title">Navegación</span>
                                <button id="drawer-close-btn" class="drawer-close" aria-label="Cerrar" onclick="const drawer = document.getElementById('mobile-nav-drawer'); if(drawer) drawer.classList.remove('active');">
                                    <i class="bi bi-x"></i>
                                </button>
                            </div>
                            <div class="drawer-links">
                                <a href="#products-section" id="mobile-link-beats" class="drawer-link" onclick="const drawer = document.getElementById('mobile-nav-drawer'); if(drawer) drawer.classList.remove('active');">
                                    <i class="bi bi-music-note-beamed"></i> Beats
                                </a>
                                <a href="#services-section" id="mobile-link-services" class="drawer-link" onclick="const drawer = document.getElementById('mobile-nav-drawer'); if(drawer) drawer.classList.remove('active');">
                                    <i class="bi bi-briefcase"></i> Servicios
                                </a>
                                <a href="#playlists-section" id="mobile-link-playlists" class="drawer-link" onclick="const drawer = document.getElementById('mobile-nav-drawer'); if(drawer) drawer.classList.remove('active');">
                                    <i class="bi bi-music-note-list"></i> Playlists
                                </a>
                                <a href="#faq-section" id="mobile-link-about" class="drawer-link" onclick="const drawer = document.getElementById('mobile-nav-drawer'); if(drawer) drawer.classList.remove('active');">
                                    <i class="bi bi-info-circle"></i> Sobre mi
                                </a>
                            </div>
                        </div>
                    </div>
                `;
                return div;

            case 'hero':
                div.className = 'hero';
                div.innerHTML = `
                    <canvas id="particles-bg"></canvas>
                    <div class="hero-content">
                        <h1 class="hero-title">${section.props.title || 'Tu Tienda'}</h1>
                        <p class="hero-subtitle">${section.props.subtitle || ''}</p>
                    </div>
                `;
                return div;

            case 'products':
                div.className = 'tabs-section';
                div.id = 'products-section';
                div.style.marginBottom = '100px';
                
                // Guardar los productos reales/mock en window para que el selector de pestañas los use
                if (!window.builderProducts) window.builderProducts = {};
                window.builderProducts[section.id] = section.props.products || [];
                window.builderNickname = section.props.userNickname || 'Artista';

                const allProds = section.props.products || [];
                const hasBeats = allProds.some(p => (p.product_type || '').toUpperCase() === 'BEAT');
                const hasDrumkits = allProds.some(p => (p.product_type || '').toUpperCase() === 'DRUMKIT');
                const hasLoopkits = allProds.some(p => (p.product_type || '').toUpperCase() === 'LOOPKIT');
                const hasPresets = allProds.some(p => (p.product_type || '').toUpperCase().includes('PRESET') || (p.product_type || '').toUpperCase() === 'TEMPLATE');

                const showBeats = hasBeats || (!hasDrumkits && !hasLoopkits && !hasPresets);

                let tabsHtml = '';
                let firstActive = '';
                
                if (showBeats) {
                    tabsHtml += `<button class="tab-trigger ${!firstActive ? 'active' : ''}" onclick="window.switchStoreTab(this, 'BEATS', '${section.id}')">BEATS</button>`;
                    if (!firstActive) firstActive = 'BEATS';
                }
                if (hasDrumkits) {
                    tabsHtml += `<button class="tab-trigger ${!firstActive ? 'active' : ''}" onclick="window.switchStoreTab(this, 'DRUMKITS', '${section.id}')">DRUMKITS</button>`;
                    if (!firstActive) firstActive = 'DRUMKITS';
                }
                if (hasLoopkits) {
                    tabsHtml += `<button class="tab-trigger ${!firstActive ? 'active' : ''}" onclick="window.switchStoreTab(this, 'LOOPKITS', '${section.id}')">LOOPKITS</button>`;
                    if (!firstActive) firstActive = 'LOOPKITS';
                }
                if (hasPresets) {
                    tabsHtml += `<button class="tab-trigger ${!firstActive ? 'active' : ''}" onclick="window.switchStoreTab(this, 'PRESETS', '${section.id}')">PRESETS</button>`;
                    if (!firstActive) firstActive = 'PRESETS';
                }

                div.innerHTML = `
                    <div class="tabs-header" id="product-tabs">
                        <div class="tabs-inner">
                            ${tabsHtml}
                        </div>
                    </div>
                    
                    <div class="products-container-modular">
                        <div class="products-row-header">
                            <div></div>
                            <div class="row-actions">
                                <div class="view-all" id="view-all-products" style="cursor: pointer;">
                                    Ver todos <i class="bi bi-arrow-right"></i>
                                </div>
                                <button class="btn-nav-mini prev" onclick="window.slideStoreShelf('${section.id}', -1)"><i class="bi bi-chevron-left"></i></button>
                                <button class="btn-nav-mini next" onclick="window.slideStoreShelf('${section.id}', 1)"><i class="bi bi-chevron-right"></i></button>
                            </div>
                        </div>
                        <div id="products-grid-${section.id}" class="products-shelf">
                            <!-- Los productos se inyectan dinámicamente aquí -->
                        </div>
                    </div>
                `;

                // Render inicial
                setTimeout(() => {
                    const btn = div.querySelector('.tab-trigger.active');
                    if (btn && window.switchStoreTab) {
                        window.switchStoreTab(btn, firstActive || 'BEATS', section.id);
                    }
                }, 50);

                return div;

            case 'licenses':
                if (window.IS_LIVE_PROFILE && (!section.props.licenses || section.props.licenses.length === 0)) {
                    return null;
                }
                div.className = 'premium-lic-section';
                div.id = 'licencias-section';
                
                let licensesHtml = '';
                if (section.props.licenses && section.props.licenses.length > 0) {
                    const sortedLicenses = [...section.props.licenses].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));
                    licensesHtml = sortedLicenses.map((lic, index) => {
                        const isFeatured = lic.isFeatured || (sortedLicenses.length > 1 && index === 1);
                        
                        let featuresHtml = '';
                        if (lic.beneficios) {
                            const features = lic.beneficios.split(/[,\n]/);
                            featuresHtml = features.map(f => `<li><i class="bi bi-check2-circle"></i> ${f.trim()}</li>`).join('');
                        } else {
                            const formatVal = (v) => {
                                if (!v) return 'Unlimited';
                                if (v.toString().toLowerCase() === 'unlimited' || v.toString().toLowerCase() === 'ilimitado') return 'Unlimited';
                                let n = parseInt(v);
                                if (isNaN(n)) return v;
                                return n.toLocaleString();
                            };
                            const streamsVal = lic.usage ? formatVal(lic.usage.streams) : '50,000';
                            const salesVal = lic.usage ? formatVal(lic.usage.sales) : '2,000';
                            featuresHtml = `
                                <li><i class="bi bi-check2-circle"></i> <strong>${streamsVal}</strong> Streams</li>
                                <li><i class="bi bi-check2-circle"></i> <strong>${salesVal}</strong> Ventas</li>
                                <li><i class="bi bi-check2-circle"></i> Uso Comercial</li>
                                <li><i class="bi bi-check2-circle"></i> Contrato Pro</li>
                            `;
                        }

                        const licDataAttr = encodeURIComponent(JSON.stringify(lic));
                        const recommendedStyle = lic.is_favorite 
                            ? `border: 2px dashed #ffd700; position: relative; box-shadow: 0 0 20px rgba(255,215,0,0.15);` 
                            : '';
                        const recommendedBadge = lic.is_favorite 
                            ? `<div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #ffd700; color: #000; font-size: 0.65rem; font-weight: 900; padding: 2px 10px; border-radius: 99px; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 10;">Recomendada</div>` 
                            : '';

                        return `
                            <div class="lic-card-premium ${isFeatured ? 'featured' : ''}" style="${recommendedStyle}">
                                ${recommendedBadge}
                                <div class="lic-name-label" style="display: flex; align-items: center; gap: 6px; margin-bottom: 24px;">
                                    <span style="font-weight: 800;">${lic.nombre || 'Licencia'}</span>
                                    ${lic.is_favorite ? '<i class="bi bi-star-fill" style="color: #ffd700; font-size: 0.9rem;" title="Recomendada"></i>' : ''}
                                </div>
                                <div class="lic-price-tag"><span>$</span>${lic.precio || '0'}</div>
                                <ul class="lic-feature-list">${featuresHtml}</ul>
                                <button class="lic-cta-btn" onclick="window.showLicenseDetailsModal(event, '${licDataAttr}')" style="transition: all 0.2s;">VER DETALLES</button>
                            </div>
                        `;
                    }).join('');
                } else {
                    licensesHtml = `<p style="color:var(--theme-muted); text-align:center;">Cargando licencias...</p>`;
                }

                div.innerHTML = `
                    <div class="section-header" style="text-align: center; margin-bottom: 40px;">
                        <h2>Licencias</h2>
                        <p>Derechos de uso profesional para tu carrera.</p>
                    </div>
                    <div class="premium-lic-grid">
                        ${licensesHtml}
                    </div>
                `;
                return div;

            case 'services':
                if (window.IS_LIVE_PROFILE && (!section.props.services || section.props.services.length === 0) && !window.IS_OWNER) {
                    return null;
                }
                div.className = 'explore-row';
                div.id = 'services-section';
                div.style.marginTop = '60px';
                
                const servicesList = section.props.services || [];
                const producerAvatar = section.props.userAvatar || '';

                let servicesHtml = '';
                if (servicesList.length > 0) {
                    servicesHtml = servicesList.map(s => {
                        const img = s.image_url || producerAvatar || 'https://offszn.lat/images/portada-default.png';
                        if (window.IS_LIVE_PROFILE) {
                            const serviceSlug = s.slug || (window.IdObfuscator ? window.IdObfuscator.encodeId(s.id) : s.id);
                            return `
                                <div class="shelf-card" onclick="window.location.href='/servicio/${serviceSlug}'" style="cursor: pointer;">
                                    <img src="${img}" class="shelf-card-img" onerror="this.src='https://offszn.lat/images/portada-default.png'">
                                    <div class="shelf-card-info">
                                        <div class="shelf-card-title">${s.title || s.name}</div>
                                        <div class="shelf-card-sub">${s.category || 'Servicio profesional'} • Desde $${s.price || s.price_basic || '0'}</div>
                                    </div>
                                </div>
                            `;
                        }
                        return `
                            <div class="shelf-card">
                                <img src="${img}" class="shelf-card-img" onerror="this.src='https://offszn.lat/images/portada-default.png'">
                                <div class="shelf-card-info">
                                    <div class="shelf-card-title">${s.title || s.name}</div>
                                    <div class="shelf-card-sub">${s.category || 'Servicio profesional'} • Desde $${s.price || s.price_basic || '0'}</div>
                                </div>
                            </div>
                        `;
                    }).join('');
                } else {
                    servicesHtml = `
                        <div style="flex: 1; text-align: center; padding: 60px 0; border: 1px dashed rgba(255,255,255,0.08); border-radius: 24px; width: 100%;">
                            <p style="color: #888; margin-bottom: 20px;">Aún no has añadido servicios profesionales.</p>
                            ${window.IS_OWNER ? `
                                <button class="lic-cta-btn" style="width: auto; padding: 12px 30px; margin: 0 auto; display: block; background: #fff; color: #000;" 
                                        onclick="window.location.href='/dashboard/services'">
                                    <i class="bi bi-plus-lg"></i> Sube tu primer servicio
                                </button>
                            ` : ''}
                        </div>
                    `;
                }

                div.innerHTML = `
                    <div class="row-header" style="justify-content: center; margin-bottom: 24px;">
                        <h2 class="row-title">Servicios</h2>
                    </div>
                    <div class="shelf-container" id="services-shelf" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;">
                        ${servicesHtml}
                    </div>
                `;
                return div;

            case 'playlists':
                if (window.IS_LIVE_PROFILE && (!section.props.playlists || section.props.playlists.length === 0)) {
                    return null;
                }
                div.className = 'explore-row';
                div.id = 'playlists-section';
                div.style.padding = '60px 0';
                
                const playlistsList = section.props.playlists || [];
                const nickname = window.builderNickname || 'Artista';
                let playlistsHtml = '';
                
                if (playlistsList.length > 0) {
                    playlistsHtml = playlistsList.map(p => {
                        const img = p.cover_url ? (p.cover_url.startsWith('http') ? p.cover_url : `https://offszn.lat/api/r2-public/${p.cover_url}`) : 'https://offszn.lat/images/portada-default.png';
                        if (window.IS_LIVE_PROFILE) {
                            const finalSlug = p.slug || (p.title ? p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : '');
                            const link = finalSlug ? `/@${nickname}/${finalSlug}` : `/playlist.html`;
                            return `
                                <div class="shelf-card" onclick="window.location.href='${link}'" style="cursor: pointer;">
                                    <img src="${img}" class="shelf-card-img" onerror="this.src='https://offszn.lat/images/portada-default.png'">
                                    <div class="shelf-card-info">
                                        <div class="shelf-card-title">${p.title || 'Playlist'}</div>
                                        <div class="shelf-card-sub">${p.category || 'Colección'} • ${p.track_ids?.length || 0} tracks</div>
                                    </div>
                                </div>
                            `;
                        }
                        return `
                            <div class="shelf-card">
                                <img src="${img}" class="shelf-card-img" onerror="this.src='https://offszn.lat/images/portada-default.png'">
                                <div class="shelf-card-info">
                                    <div class="shelf-card-title">${p.title || 'Playlist'}</div>
                                    <div class="shelf-card-sub">${p.category || 'Colección'} • ${p.track_ids?.length || 0} tracks</div>
                                </div>
                            </div>
                        `;
                    }).join('');
                } else {
                    playlistsHtml = `
                        <div style="flex: 1; text-align: center; padding: 60px 0; border: 1px dashed rgba(255,255,255,0.08); border-radius: 24px; width: 100%;">
                            <p style="color: #888;">Aún no has añadido playlists.</p>
                        </div>
                    `;
                }

                div.innerHTML = `
                    <div class="section-header" style="text-align: center; margin-bottom: 30px;">
                        <h2 style="font-size: 2.5rem; font-weight: 900; letter-spacing: -0.03em;">Playlists</h2>
                    </div>
                    <div class="shelf-container" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;">
                        ${playlistsHtml}
                    </div>
                `;
                return div;

            case 'faq':
                div.className = 'faq-section';
                div.id = 'faq-section';
                div.innerHTML = `
                    <div class="section-header" style="text-align: center; margin-bottom: 40px;">
                        <h2>Preguntas Frecuentes</h2>
                    </div>
                    <div class="faq-item">
                        <button class="faq-question" onclick="window.toggleFaq(this)">
                            ¿Cómo recibo mis archivos después de la compra? <i class="bi bi-plus"></i>
                        </button>
                        <div class="faq-answer">
                            Inmediatamente después del pago, recibirás un correo con los enlaces de descarga directa de tus archivos.
                        </div>
                    </div>
                    <div class="faq-item">
                        <button class="faq-question" onclick="window.toggleFaq(this)">
                            ¿Qué incluye cada licencia? <i class="bi bi-plus"></i>
                        </button>
                        <div class="faq-answer">
                            Dependiendo del nivel, recibes desde el MP3 hasta los Stems para una mezcla profesional.
                        </div>
                    </div>
                    <div class="faq-item">
                        <button class="faq-question" onclick="window.toggleFaq(this)">
                            ¿Puedo subir mi canción a Spotify? <i class="bi bi-plus"></i>
                        </button>
                        <div class="faq-answer">
                            Sí, todas nuestras licencias permiten la distribución en plataformas digitales.
                        </div>
                    </div>
                    <div class="contact-footer" style="text-align: center; margin-top: 60px; padding-bottom: 40px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 40px;">
                        <p style="color: rgba(255,255,255,0.5); font-size: 0.95rem; font-weight: 500;">
                            ¿No encontraste lo que buscabas? <span style="color: #fff; margin-left: 5px;">Contáctanos:</span>
                            <a href="mailto:${section.props.email || 'hola@offszn.lat'}" style="color: #fff; text-decoration: none; font-weight: 700; margin-left: 5px; transition: opacity 0.2s;">
                                ${section.props.email || 'hola@offszn.lat'}
                            </a>
                        </p>
                    </div>
                `;
                return div;

            case 'footer':
                div.className = 'rendered-footer';
                
                const footerSocials = section.props.socials || {};
                const getSocialUrl = (platform, usernameOrUrl) => {
                    if (!usernameOrUrl) return '#';
                    if (usernameOrUrl.startsWith('http://') || usernameOrUrl.startsWith('https://')) {
                        return usernameOrUrl;
                    }
                    const clean = usernameOrUrl.replace('@', '');
                    switch (platform) {
                        case 'instagram': return `https://instagram.com/${clean}`;
                        case 'youtube': return `https://youtube.com/${clean}`;
                        case 'spotify': return `https://open.spotify.com/artist/${clean}`;
                        case 'tiktok': return `https://tiktok.com/@${clean}`;
                        default: return '#';
                    }
                };

                const igUrl = getSocialUrl('instagram', footerSocials.instagram);
                const ytUrl = getSocialUrl('youtube', footerSocials.youtube);
                const spUrl = getSocialUrl('spotify', footerSocials.spotify);

                const igHtml = footerSocials.instagram ? `<a href="${igUrl}" target="_blank" rel="noopener noreferrer" style="color:inherit;"><i class="bi bi-instagram"></i></a>` : '';
                const ytHtml = footerSocials.youtube ? `<a href="${ytUrl}" target="_blank" rel="noopener noreferrer" style="color:inherit;"><i class="bi bi-youtube"></i></a>` : '';
                const spHtml = footerSocials.spotify ? `<a href="${spUrl}" target="_blank" rel="noopener noreferrer" style="color:inherit;"><i class="bi bi-spotify"></i></a>` : '';

                div.innerHTML = `
                    <div class="footer-social">
                        ${igHtml}
                        ${ytHtml}
                        ${spHtml}
                    </div>
                    <div class="footer-brand">
                        <span>Hecho con <strong>OFFSZN</strong></span>
                        <a href="https://offszn.lat" target="_blank" rel="noopener noreferrer" class="btn-create" style="background:#fff; color:#000; padding:8px 16px; border-radius:20px; font-weight:800; font-size:10px; display:inline-block; transition: transform 0.2s ease;">CREA LA TUYA</a>
                    </div>
                `;
                return div;

            default:
                return null;
        }
    }
}

window.RendererEngine = RendererEngine;


