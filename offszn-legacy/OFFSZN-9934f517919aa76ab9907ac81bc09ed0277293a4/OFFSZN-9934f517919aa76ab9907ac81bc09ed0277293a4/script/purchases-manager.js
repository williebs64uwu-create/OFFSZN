/**
 * PURCHASES MANAGER V3
 * Optimized for strict grid alignment and long text handling.
 * Integrates standard orders and dedicated analyzer sales.
 */

window.PurchasesManager = (function () {
    let isInitialized = false;
    let currentUser = null;

    async function init() {
        if (isInitialized) return;

        const container = document.getElementById('purchases-list');
        if (!container) return;

        // Wait for Supabase to be ready
        if (!window.supabaseClient) {
            let attempts = 0;
            const maxAttempts = 10;
            const checkSupabase = setInterval(() => {
                attempts++;
                if (window.supabaseClient) {
                    clearInterval(checkSupabase);
                    startManager();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkSupabase);
                }
            }, 500);
            return;
        }

        startManager();
    }

    async function startManager() {
        injectSidebarSkeletons();

        const { data: { session }, error: sessionError } = await window.supabaseClient.auth.getSession();

        if (sessionError || !session) {
            const currentPath = window.location.pathname.split('/').pop() || '/explorar.html';
            window.location.href = `/pages/login.html?redirect=${currentPath}`;
            return;
        }

        currentUser = session.user;
        const userId = session.user.id;

        try {
            await new Promise(resolve => setTimeout(resolve, 800)); // Slight delay for UX
            await fetchPurchases(userId);
            isInitialized = true;
        } finally {
            removeSidebarSkeletons();
        }
    }

    async function fetchPurchases(userId) {
        const container = document.getElementById('purchases-list');
        if (!container) return;

        try {
            // 1. Fetch Regular Orders & Analyzer Sales Concurrently
            const [ordersRes, analyzerRes] = await Promise.all([
                window.supabaseClient
                    .from('orders')
                    .select(`
                        id, 
                        created_at, 
                        total_price, 
                        transaction_id,
                        status,
                        order_items (
                            id,
                            price_at_purchase,
                            license_name,
                            product_id,
                            products (
                                id,
                                name,
                                image_url,
                                product_type,
                                audio_url,
                                download_url_mp3,
                                mp3_url,
                                download_url_wav,
                                wav_url,
                                stems_url,
                                kit_url,
                                users!products_producer_id_fkey (
                                    id,
                                    nickname,
                                    email,
                                    socials,
                                    license_settings
                                ),
                                r2_version
                            )
                        )
                    `)
                    .eq('user_id', userId)
                    .in('status', ['approved', 'completed']),

                window.supabaseClient
                    .from('analyzer_sales')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('status', 'completed')
            ]);

            if (ordersRes.error) throw ordersRes.error;
            if (analyzerRes.error) throw analyzerRes.error;

            const orders = ordersRes.data || [];
            const analyzerSales = analyzerRes.data || [];

            if (orders.length === 0 && analyzerSales.length === 0) {
                renderEmptyState(container);
                return;
            }

            // Combine and Sort by Date
            const combined = [
                ...orders.flatMap(o => (o.order_items || []).map(item => ({ ...item, order: o, type: 'standard' }))),
                ...analyzerSales.map(s => ({ ...s, type: 'analyzer', created_at: s.created_at }))
            ].sort((a, b) => {
                const dateA = new Date(a.type === 'standard' ? a.order.created_at : a.created_at);
                const dateB = new Date(b.type === 'standard' ? b.order.created_at : b.created_at);
                return dateB - dateA;
            });

            renderPurchases(combined, container);

        } catch (err) {
            console.error("Error fetching purchases:", err);
            renderErrorState(container);
        }
    }

    function renderPurchases(items, container) {
        container.innerHTML = '';
        const fragment = document.createDocumentFragment();

        items.forEach(item => {
            if (item.type === 'analyzer') {
                fragment.appendChild(createAnalyzerPurchaseRow(item));
            } else {
                const product = item.products;
                if (!product) {
                    fragment.appendChild(createDeletedPurchaseRow(item.order, item));
                } else {
                    fragment.appendChild(createPurchaseRow(item.order, item, product));
                }
            }
        });

        container.appendChild(fragment);
    }

    function createAnalyzerPurchaseRow(sale) {
        const row = document.createElement('div');
        row.className = 'purchase-row purchases-grid-layout';

        const dateFormatted = new Date(sale.created_at).toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        const isFree = sale.amount == 0;
        const montoHtml = isFree ? `<span class="badge-free">FREE</span>` : `$${sale.amount || 0}`;

        row.innerHTML = `
            <img src="/images/analyzer-cover.png" class="purchase-cover" alt="X Flow Analyzer" onerror="this.src='/images/portada-default.png'">
            <div class="purchase-info">
                <span class="purchase-name">X Flow - Analyzer</span>
                <span class="purchase-producer">OFFSZN</span>
                <span style="font-size:0.75rem; color:#888;">SOFTWARE / VST</span>
            </div>
            <div class="purchase-monto">${montoHtml}</div>
            <div class="purchase-date">${dateFormatted}</div>
            <div class="purchase-id" title="ID: ${sale.paypal_order_id}">${(sale.paypal_order_id || '').substring(0, 10)}...</div>
            <div class="purchase-actions">
                <button class="download-btn primary" onclick="window.PurchasesManager.downloadAnalyzer(this)" title="Descargar Instalador">
                    <i class="bi bi-download"></i> Descargar
                </button>
            </div>
        `;
        return row;
    }

    function createDeletedPurchaseRow(order, item) {
        const row = document.createElement('div');
        row.className = 'purchase-row purchases-grid-layout';

        const dateFormatted = new Date(order.created_at).toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        const isFree = order.total_price === 0 || item.price_at_purchase === 0;
        const montoHtml = isFree ? `<span class="badge-free">FREE</span>` : `$${item.price_at_purchase || 0}`;

        row.innerHTML = `
            <img src="/images/portada-default.png" class="purchase-cover" style="opacity: 0.5; filter: grayscale(100%);" alt="Eliminado">
            <div class="purchase-info">
                <span class="purchase-name" style="color: #666; font-style: italic;">Producto no disponible</span>
                <span class="purchase-producer" style="color: #ef4444; font-size: 0.8rem;">Eliminado por el autor</span>
            </div>
            <div class="purchase-monto" style="opacity: 0.7;">${montoHtml}</div>
            <div class="purchase-date" style="opacity: 0.7;">${dateFormatted}</div>
            <div class="purchase-id" style="opacity: 0.7;">${(order.transaction_id || '').substring(0, 10)}...</div>
            <div class="purchase-actions">
                <button class="download-btn disabled-cooldown" style="opacity:0.4; cursor:not-allowed;" title="Archivos no disponibles">
                    <i class="bi bi-slash-circle"></i> No disponible
                </button>
            </div>
        `;
        return row;
    }

    function createPurchaseRow(order, item, product) {
        const row = document.createElement('div');
        row.className = 'purchase-row purchases-grid-layout';

        const producerName = product.users?.nickname || 'Producer';
        const dateFormatted = new Date(order.created_at).toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        const isFree = order.total_price === 0 || item.price_at_purchase === 0;
        const montoHtml = isFree ? `<span class="badge-free">FREE</span>` : `$${item.price_at_purchase || 0}`;

        let actionsHtml = '';
        const orderId = order.id;
        const productId = product.id;
        const pType = product.product_type || '';
        const isKit = ['drumkit', 'loopkit', 'preset'].includes(pType);
        const producerData = encodeURIComponent(JSON.stringify({
            nickname: producerName,
            email: product.users?.email || '',
            socials: product.users?.socials || {}
        }));

        const hasMp3 = product.mp3_url || product.download_url_mp3 || product.audio_url;
        const hasWav = product.wav_url || product.download_url_wav;

        if (isFree && pType === 'beat') {
            if (hasMp3) actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'mp3', '${producerData}')" title="Bajar MP3"><i class="bi bi-music-note-beamed"></i> MP3</button>`;
        } else if (isFree && isKit) {
            if (product.kit_url) actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'kit', '${producerData}')" title="Bajar ZIP"><i class="bi bi-box-seam"></i> ZIP</button>`;
        } else {
            if (hasMp3) actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'mp3', '${producerData}')" title="Bajar MP3"><i class="bi bi-music-note-beamed"></i> MP3</button>`;
            if (hasWav) actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'wav', '${producerData}')" title="Bajar WAV"><i class="bi bi-music-note-beamed"></i> WAV</button>`;
            if (product.stems_url) actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'stems', '${producerData}')" title="Bajar STEMS"><i class="bi bi-archive"></i> STEMS</button>`;
            if (product.kit_url || isKit) actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'kit', '${producerData}')" title="Bajar ZIP"><i class="bi bi-box-seam"></i> ZIP</button>`;
        }

        const licenseType = item.license_name || 'basic';
        if (!isFree) {
            const buyerName = currentUser?.user_metadata?.nickname || currentUser?.email?.split('@')[0] || 'Cliente';
            const pdfData = {
                productName: product.name, producerName: producerName, amount: item.price_at_purchase,
                buyerName: buyerName, buyerEmail: currentUser?.email || '', purchaseDate: order.created_at,
                orderId: order.id, licenseType: licenseType, productType: product.product_type,
                licenseSettings: product.users?.license_settings || {}
            };
            const pdfDataStr = encodeURIComponent(JSON.stringify(pdfData));
            actionsHtml += `<button class="download-btn primary" onclick="window.PurchasesManager.generatePDF(this, '${pdfDataStr}')" title="Licencia PDF"><i class="bi bi-file-earmark-pdf"></i> PDF</button>`;
        }

        let imageUrl = product.image_url || '/images/portada-default.png';
        if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/images/')) {
            // Eliminar slash inicial y asegurar que use el proxy local
            const cleanUrl = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
            imageUrl = `/api/r2-public/${cleanUrl}`;
        }

        row.innerHTML = `
            <img src="${imageUrl}" class="purchase-cover" alt="Portada" onerror="this.src='/images/portada-default.png'">
            <div class="purchase-info">
                <span class="purchase-name">${product.name}</span>
                <span class="purchase-producer">${producerName}</span>
                <span style="font-size:0.75rem; color:#888;">${licenseType.toUpperCase()}</span>
            </div>
            <div class="purchase-monto">${montoHtml}</div>
            <div class="purchase-date">${dateFormatted}</div>
            <div class="purchase-id">${(order.transaction_id || '').substring(0, 10)}...</div>
            <div class="purchase-actions">${actionsHtml}</div>
        `;
        return row;
    }

    async function downloadFile(btnElement, orderId, productId, fileType, producerDataStr) {
        if (btnElement?.classList.contains('disabled-cooldown')) return;
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) return window.toast ? window.toast.error('Debes iniciar sesión') : alert('Debes iniciar sesión');

        if (btnElement) {
            btnElement.classList.add('disabled-cooldown');
            btnElement.style.opacity = '0.5';
        }

        try {
            if (window.toast) window.toast.info('Preparando descarga...');
            const res = await fetch(`/api/orders/download-link?orderId=${orderId}&productId=${productId}&fileType=${fileType}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!res.ok) {
                // Si falla, mostrar modal de contactar productor
                let producerInfo = null;
                try { producerInfo = JSON.parse(decodeURIComponent(producerDataStr)); } catch(e) {}
                showContactProducerModal(producerInfo);
                return;
            }
            const { signedUrl } = await res.json();
            
            // Forzar descarga directa con Content-Disposition
            const a = document.createElement('a');
            a.href = signedUrl;
            a.download = '';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            if (window.toast) window.toast.success('Descarga iniciada');
        } catch (err) {
            // En caso de error de red, mostrar modal de contacto
            let producerInfo = null;
            try { producerInfo = JSON.parse(decodeURIComponent(producerDataStr)); } catch(e) {}
            showContactProducerModal(producerInfo);
        } finally {
            if (btnElement) setTimeout(() => { btnElement.classList.remove('disabled-cooldown'); btnElement.style.opacity = '1'; }, 4000);
        }
    }

    function showContactProducerModal(producer) {
        // Remover modal anterior si existe
        const existing = document.getElementById('contact-producer-modal');
        if (existing) existing.remove();

        const name = producer?.nickname || 'el productor';
        const email = producer?.email || '';
        const socials = producer?.socials || {};

        // Construir links de redes sociales
        let socialsHtml = '';
        const socialIcons = {
            instagram: { icon: 'bi-instagram', label: 'Instagram', prefix: 'https://instagram.com/' },
            tiktok: { icon: 'bi-tiktok', label: 'TikTok', prefix: 'https://tiktok.com/@' },
            youtube: { icon: 'bi-youtube', label: 'YouTube', prefix: 'https://youtube.com/' },
            twitter: { icon: 'bi-twitter-x', label: 'X / Twitter', prefix: 'https://x.com/' },
            soundcloud: { icon: 'bi-soundwave', label: 'SoundCloud', prefix: 'https://soundcloud.com/' },
            spotify: { icon: 'bi-spotify', label: 'Spotify', prefix: '' },
            beatstars: { icon: 'bi-music-note-list', label: 'BeatStars', prefix: '' }
        };

        Object.entries(socials).forEach(([key, value]) => {
            if (!value) return;
            const info = socialIcons[key.toLowerCase()] || { icon: 'bi-link-45deg', label: key, prefix: '' };
            const url = value.startsWith('http') ? value : (info.prefix + value);
            socialsHtml += `<a href="${url}" target="_blank" rel="noopener" class="contact-social-link"><i class="bi ${info.icon}"></i> ${info.label}</a>`;
        });

        const modal = document.createElement('div');
        modal.id = 'contact-producer-modal';
        modal.className = 'contact-producer-overlay';
        modal.innerHTML = `
            <div class="contact-producer-card">
                <button class="contact-producer-close" onclick="this.closest('.contact-producer-overlay').remove()">&times;</button>
                <div class="contact-producer-icon"><i class="bi bi-exclamation-triangle"></i></div>
                <h3>Archivo no disponible</h3>
                <p>No pudimos generar el enlace de descarga. Contacta directamente a <strong>${name}</strong> para obtener el archivo.</p>
                ${email ? `<a href="mailto:${email}" class="contact-email-btn"><i class="bi bi-envelope"></i> ${email}</a>` : ''}
                ${socialsHtml ? `<div class="contact-socials-grid">${socialsHtml}</div>` : ''}
                <div class="contact-producer-divider"></div>
                <p class="contact-support-text">¿Necesitas ayuda? Escríbenos a <a href="mailto:soporte@offszn.lat">soporte@offszn.lat</a></p>
            </div>
        `;
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    }

    async function downloadAnalyzer(btnElement) {
        if (btnElement?.classList.contains('disabled-cooldown')) return;
        if (btnElement) { btnElement.classList.add('disabled-cooldown'); btnElement.style.opacity = '0.5'; }

        try {
            if (window.toast) window.toast.info('Generando enlace...');
            const signedUrl = await AuthUtils.getAuthorizedUrl('plugins/X - FLOW - ANALIZER Win_Installer.rar', 'v2');
            if (!signedUrl) throw new Error('Error de enlace');
            const a = document.createElement('a'); a.href = signedUrl; a.click();
            if (window.toast) window.toast.success('Descarga iniciada');
        } catch (err) {
            if (window.toast) window.toast.error(err.message);
        } finally {
            if (btnElement) setTimeout(() => { btnElement.classList.remove('disabled-cooldown'); btnElement.style.opacity = '1'; }, 4000);
        }
    }

    async function generatePDF(btnElement, dataStr) {
        if (btnElement?.classList.contains('disabled-cooldown')) return;
        if (!window.generarLicencia) return window.toast?.error('No cargado');

        if (btnElement) { btnElement.classList.add('disabled-cooldown'); btnElement.style.opacity = '0.5'; }
        try {
            const data = JSON.parse(decodeURIComponent(dataStr));
            await window.generarLicencia(data);
            if (window.toast) window.toast.success('PDF generado');
        } catch (err) {
            if (window.toast) window.toast.error('Error PDF');
        } finally {
            if (btnElement) setTimeout(() => { btnElement.classList.remove('disabled-cooldown'); btnElement.style.opacity = '1'; }, 4000);
        }
    }

    function renderEmptyState(container) {
        container.innerHTML = `<div class="empty-state">
            <i class="bi bi-bag-plus empty-icon"></i>
            <h3 class="empty-title">Aún no tienes compras</h3>
            <p class="empty-subtitle">Explora los mejores beats y drum kits creados por la comunidad de OFFSZN.</p>
            <div class="explore-grid">
                <a href="/explorar.html?type=beat" class="explore-card"><i class="bi bi-music-note-beamed"></i><h4>Beats</h4><p>Encuentra tu hit.</p></a>
                <a href="/explorar.html?type=drumkit" class="explore-card"><i class="bi bi-disc"></i><h4>Drum Kits</h4><p>Librerías profesionales.</p></a>
                <a href="/explorar.html?type=loopkit" class="explore-card"><i class="bi bi-soundwave"></i><h4>Loop Kits</h4><p>Melodías puras.</p></a>
            </div>
            <a href="/explorar.html" class="download-btn primary" style="margin-top: 40px; display: inline-flex;">Explorar Marketplace</a>
        </div>`;
    }

    function renderErrorState(container) {
        container.innerHTML = `<div class="empty-state">
            <i class="bi bi-exclamation-triangle" style="font-size: 3rem; color:#ef4444;"></i>
            <h3>Error al cargar</h3><button onclick="location.reload()" class="download-btn">Reintentar</button>
        </div>`;
    }

    function injectSidebarSkeletons() {
        ['sidebarName', 'sidebarRole', 'sidebarAvatar'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('skeleton-base');
        });
    }

    function removeSidebarSkeletons() {
        ['sidebarName', 'sidebarRole', 'sidebarAvatar'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('skeleton-base');
        });
    }

    return { init, downloadFile, generatePDF, downloadAnalyzer, showContactProducerModal };
})();

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { if (document.getElementById('purchases-list')) window.PurchasesManager.init(); });
} else {
    if (document.getElementById('purchases-list')) window.PurchasesManager.init();
}
