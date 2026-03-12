/**
 * PURCHASES MANAGER V3
 * Optimized for strict grid alignment and long text handling.
 */

window.PurchasesManager = (function () {
    let isInitialized = false;
    let currentUser = null;

    async function init() {
        if (isInitialized) return;

        // 🛡️ SPA SAFEGUARD: Only running logic if on purchases page.
        // Usually we check if the container exists before starting full fetch.
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
                    // console.error("❌ Supabase failed to initialize after 10 attempts.");
                }
            }, 500);
            return;
        }

        startManager();
    }

    async function startManager() {
        // Initialize Sidebar Skeletons IMMEDIATELY (Before session check)
        injectSidebarSkeletons();

        // First check if user is logged in
        const { data: { session }, error: sessionError } = await window.supabaseClient.auth.getSession();

        if (sessionError || !session) {
            // console.warn("No active session found. Redirecting to login...");
            // Redirect with a query param to come back after login
            const currentPath = window.location.pathname.split('/').pop() || 'index.html';
            window.location.href = `/pages/login.html?redirect=${currentPath}`;
            return;
        }

        currentUser = session.user;
        const userId = session.user.id;

        try {
            // Add artificial delay for smoother visual transition (unify with other settings)
            await new Promise(resolve => setTimeout(resolve, 1200));
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
            // Fetch approved orders for this user
            const { data: orders, error } = await window.supabaseClient
                .from('orders')
                .select(`
                    id,
                    transaction_id,
                    status,
                    total_price,
                    created_at,
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
                            mp3_url,
                            wav_url,
                            stems_url,
                            kit_url,
                            users!products_producer_id_fkey (
                                id,
                                nickname,
                                license_settings
                            ),
                            r2_version
                        )
                    )
                `)
                .eq('user_id', userId)
                .in('status', ['approved', 'completed'])
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!orders || orders.length === 0) {
                renderEmptyState(container);
                return;
            }

            renderPurchases(orders, container);

        } catch (err) {
            // console.error("Error fetching purchases:", err);
            renderErrorState(container);
        }
    }

    function renderPurchases(orders, container) {
        container.innerHTML = '';
        const fragment = document.createDocumentFragment();

        orders.forEach(order => {
            if (!order.order_items) return;
            order.order_items.forEach(item => {
                const product = item.products;

                // --- MANEJO DE PRODUCTO ELIMINADO ---
                if (!product) {
                    const deletedRow = createDeletedPurchaseRow(order, item);
                    fragment.appendChild(deletedRow);
                    return;
                }

                const row = createPurchaseRow(order, item, product);
                fragment.appendChild(row);
            });
        });

        container.appendChild(fragment);
    }

    function createDeletedPurchaseRow(order, item) {
        const row = document.createElement('div');
        row.className = 'purchase-row purchases-grid-layout';

        const dateFormatted = new Date(order.created_at).toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        const isFree = order.total_price === 0 || item.price_at_purchase === 0;
        const montoHtml = isFree ? `<span class="badge-free">FREE</span>` : `$${item.price_at_purchase || 0}`;
        const licenseType = item.license_name || 'basic';

        row.innerHTML = `
            <img src="/images/portada-default.png" class="purchase-cover" style="opacity: 0.5; filter: grayscale(100%);" alt="Eliminado">
            <div class="purchase-info">
                <span class="purchase-name" style="color: #666; font-style: italic;"></span>
                <span class="purchase-producer" style="color: #ef4444; font-size: 0.8rem;">Eliminado por el autor</span>
                <span style="font-size:0.75rem; color:#888;">${licenseType.toUpperCase()}</span>
            </div>
            <div class="purchase-monto" style="opacity: 0.7;">${montoHtml}</div>
            <div class="purchase-date" style="opacity: 0.7;">${dateFormatted}</div>
            <div class="purchase-id" style="opacity: 0.7;" title="Transacción: ${order.transaction_id}">${(order.transaction_id || '').substring(0, 10)}...</div>
            <div class="purchase-actions">
                <button class="download-btn disabled-cooldown" style="opacity:0.4; cursor:not-allowed;" title="Archivos no disponibles">
                    <i class="bi bi-slash-circle"></i> No disponible
                </button>
            </div>
        `;

        // Secure Text Injection
        const nameSpan = row.querySelector('.purchase-name');
        if (nameSpan) nameSpan.textContent = 'Producto no disponible';

        return row;
    }

    function createPurchaseRow(order, item, product) {
        const row = document.createElement('div');
        // CRITICAL: Must use the same grid class as the header
        row.className = 'purchase-row purchases-grid-layout';

        const producerName = product.users?.nickname || 'Producer';
        const dateFormatted = new Date(order.created_at).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const isFree = order.total_price === 0 || item.price_at_purchase === 0;
        const montoHtml = isFree ? `<span class="badge-free">FREE</span>` : `$${item.price_at_purchase || 0}`;

        // Download Actions
        let actionsHtml = '';
        const orderId = order.id;
        const productId = product.id;
        const pType = product.product_type || '';
        const isKit = ['drumkit', 'loopkit', 'preset'].includes(pType);

        // 🛡️ PERMISSION LOGIC:
        // FREE beats  → MP3 only (no WAV, no STEMS, no PDF)
        // FREE kits   → ZIP only (no PDF)
        // PAID items  → all applicable buttons + PDF license
        if (isFree && pType === 'beat') {
            // FREE BEAT: Only MP3
            if (product.mp3_url) {
                actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'mp3')" title="Bajar MP3"><i class="bi bi-music-note-beamed"></i> MP3</button>`;
            }
        } else if (isFree && isKit) {
            // FREE KIT: Only ZIP
            if (product.kit_url) {
                actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'kit')" title="Bajar ZIP"><i class="bi bi-box-seam"></i> ZIP</button>`;
            }
        } else {
            // PAID: Show all available file buttons
            if (product.mp3_url) {
                actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'mp3')" title="Bajar MP3"><i class="bi bi-music-note-beamed"></i> MP3</button>`;
            }
            if (product.wav_url) {
                actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'wav')" title="Bajar WAV"><i class="bi bi-music-note-beamed"></i> WAV</button>`;
            }
            if (product.stems_url) {
                actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'stems')" title="Bajar STEMS"><i class="bi bi-archive"></i> STEMS</button>`;
            }
            if (product.kit_url || isKit) {
                actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'kit')" title="Bajar ZIP"><i class="bi bi-box-seam"></i> ZIP</button>`;
            }
        }

        // License PDF — ONLY for PAID purchases (free downloads don't include a usage license)
        const licenseType = item.license_name || 'basic';

        if (!isFree) {
            const buyerName = window.currentUser?.user_metadata?.nickname || window.currentUser?.email?.split('@')[0] || 'Cliente';
            const buyerEmail = window.currentUser?.email || '';

            const pdfData = {
                productName: product.name,
                producerName: producerName,
                amount: item.price_at_purchase,
                buyerName: buyerName,
                buyerEmail: buyerEmail,
                purchaseDate: order.created_at,
                orderId: order.id,
                licenseType: licenseType,
                productType: product.product_type,
                licenseSettings: product.users?.license_settings || {}
            };

            const pdfDataStr = encodeURIComponent(JSON.stringify(pdfData));
            actionsHtml += `<button class="download-btn primary" onclick="window.PurchasesManager.generatePDF(this, '${pdfDataStr}')" title="Descargar Licencia de Uso"><i class="bi bi-file-earmark-pdf"></i> PDF</button>`;
        }

        // Row Content - Truncation is handled by CSS, but we inject clean data
        row.innerHTML = `
            <img src="${product.image_url || '/images/portada-default.png'}" 
                 data-r2-version="${product.r2_version || 'v1'}" 
                 class="purchase-cover" alt="Portada" 
                 onerror="this.src='/images/portada-default.png'">
            <div class="purchase-info">
                <span class="purchase-name" title=""></span>
                <span class="purchase-producer"></span>
                <span style="font-size:0.75rem; color:#888;">${licenseType.toUpperCase()}</span>
            </div>
            <div class="purchase-monto">${montoHtml}</div>
            <div class="purchase-date">${dateFormatted}</div>
            <div class="purchase-id" title="Transacción: ${order.transaction_id}">${(order.transaction_id || '').substring(0, 10)}...</div>
            <div class="purchase-actions">
                ${actionsHtml}
            </div>
        `;

        // 🛡️ SECURE TEXT INJECTION (Prevent XSS)
        const nameSpan = row.querySelector('.purchase-name');
        const producerSpan = row.querySelector('.purchase-producer');
        if (nameSpan) {
            nameSpan.textContent = product.name;
            nameSpan.title = product.name; // Set title securely too
        }
        if (producerSpan) producerSpan.textContent = producerName;

        return row;
    }

    async function downloadFile(btnElement, orderId, productId, fileType) {
        // COOLDOWN CHECK
        if (btnElement && btnElement.classList.contains('disabled-cooldown')) return;

        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) {
            if (window.toast) window.toast.error('Debes iniciar sesión para descargar');
            else alert('Debes iniciar sesión para descargar');
            return;
        }

        // SET COOLDOWN
        if (btnElement) {
            btnElement.classList.add('disabled-cooldown');
            btnElement.style.opacity = '0.5';
            btnElement.style.cursor = 'not-allowed';
        }

        try {
            if (window.toast) window.toast.info('Preparando descarga segura...');

            const res = await fetch(`/api/orders/download-link?orderId=${orderId}&productId=${productId}&fileType=${fileType}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Error al generar enlace');
            }

            const { signedUrl } = await res.json();

            // Trigger download
            const a = document.createElement('a');
            a.href = signedUrl;
            a.download = '';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            if (window.toast) window.toast.success('Descarga iniciada');
        } catch (err) {
            // console.error("Download Error:", err);
            if (window.toast) window.toast.error(err.message || 'Error en la descarga');
            else alert(err.message);
        } finally {
            // REMOVE COOLDOWN
            if (btnElement) {
                setTimeout(() => {
                    btnElement.classList.remove('disabled-cooldown');
                    btnElement.style.opacity = '1';
                    btnElement.style.cursor = 'pointer';
                }, 4000); // 4 Seconds cooldown
            }
        }
    }

    function renderEmptyState(container) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-bag-plus empty-icon"></i>
                <h3 class="empty-title">Aún no tienes compras</h3>
                <p class="empty-subtitle">Explora los mejores beats, drum kits y presets creados por la comunidad de OFFSZN.</p>
                
                <div class="explore-grid">
                    <a href="/explorar.html?type=beat" class="explore-card">
                        <i class="bi bi-music-note-beamed"></i>
                        <h4>Beats Instrumentales</h4>
                        <p>Encuentra el sonido ideal para tu hit.</p>
                    </a>
                    <a href="/explorar.html?type=drumkit" class="explore-card">
                        <i class="bi bi-disc"></i>
                        <h4>Drum Kits</h4>
                        <p>Librerías profesionales curadas.</p>
                    </a>
                    <a href="/explorar.html?type=loopkit" class="explore-card">
                        <i class="bi bi-soundwave"></i>
                        <h4>Loop Kits</h4>
                        <p>Melodías para inspirarte.</p>
                    </a>
                </div>

                <a href="/explorar.html" class="download-btn primary" style="margin-top: 50px; display: inline-flex; padding: 14px 28px;">Explorar Marketplace <i class="bi bi-arrow-right" style="margin-left:8px;"></i></a>
            </div>
            `;
    }

    function renderErrorState(container) {
        if (!container) return;
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle" style="font-size: 3rem; color: #ef4444; margin-bottom: 24px;"></i>
                <h3 class="empty-title">Problema al cargar compras</h3>
                <p class="empty-subtitle">No logramos conectar con el servidor. Reconecta e intenta de nuevo.</p>
                <button onclick="location.reload()" class="download-btn" style="margin: 0 auto; display: flex;">Reintentar</button>
            </div>
            `;
    }

    async function generatePDF(btnElement, dataStr) {
        // COOLDOWN CHECK
        if (btnElement && btnElement.classList.contains('disabled-cooldown')) return;

        if (!window.generarLicencia) {
            if (window.toast) window.toast.error('El módulo de licencias no está cargado');
            else alert('El módulo de licencias no está cargado');
            return;
        }

        // SET COOLDOWN
        if (btnElement) {
            btnElement.classList.add('disabled-cooldown');
            btnElement.style.opacity = '0.5';
            btnElement.style.cursor = 'not-allowed';
        }

        try {
            if (window.toast) window.toast.info('Generando licencia PDF...');
            const data = JSON.parse(decodeURIComponent(dataStr));
            await window.generarLicencia(data);
            if (window.toast) window.toast.success('Licencia descargada');
        } catch (err) {
            // console.error("PDF Gen Error:", err);
            if (window.toast) window.toast.error('Error al generar licencia');
            else alert('Error al generar licencia');
        } finally {
            // REMOVE COOLDOWN
            if (btnElement) {
                setTimeout(() => {
                    btnElement.classList.remove('disabled-cooldown');
                    btnElement.style.opacity = '1';
                    btnElement.style.cursor = 'pointer';
                }, 4000); // 4 Seconds cooldown
            }
        }
    }

    function renderSidebarInfo(userId) {
        // We'll fetch it separately if needed, but usually it's handled by other scripts.
        // However, for consistency we'll implement it here if needed.
        // For now, let's just implement the UI removal.
    }

    function injectSidebarSkeletons() {
        const name = document.getElementById('sidebarName');
        const role = document.getElementById('sidebarRole');
        const avatar = document.getElementById('sidebarAvatar');
        if (name) name.classList.add('skeleton-base', 'skeleton-name');
        if (role) role.classList.add('skeleton-base', 'skeleton-role');
        if (avatar) avatar.classList.add('skeleton-base', 'skeleton-avatar');
    }

    function removeSidebarSkeletons() {
        const name = document.getElementById('sidebarName');
        const role = document.getElementById('sidebarRole');
        const avatar = document.getElementById('sidebarAvatar');
        if (name) name.classList.remove('skeleton-base', 'skeleton-name');
        if (role) role.classList.remove('skeleton-base', 'skeleton-role');
        if (avatar) avatar.classList.remove('skeleton-base', 'skeleton-avatar');
    }

    return { init, downloadFile, generatePDF };
})();

// Auto-run if element exists
// Auto-run if element exists
const initPurchases = () => {
    if (document.getElementById('purchases-list')) {
        window.PurchasesManager.init();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPurchases);
} else {
    initPurchases();
}
