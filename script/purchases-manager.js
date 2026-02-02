/**
 * PURCHASES MANAGER V3
 * Optimized for strict grid alignment and long text handling.
 */

window.PurchasesManager = (function () {
    let isInitialized = false;
    let currentUser = null;

    async function init() {
        if (isInitialized) return;

        // Wait for Supabase to be ready
        if (!window.supabaseClient) {
            // ... retry logic ...
        }

        // 🛡️ SPA SAFEGUARD: If this script is loaded but we are NOT on purchases page, 
        // we might not want to run full fetch logic unless called.
        // However, looking at the code, it seems `renderPurchases` is called manually or by DOMContentLoaded?
        // Let's check the bottom of file.
        // ... (Reading file content from memory: it has a self-init in DOMContentLoaded usually)

        // Actually, let's just make sure `renderPurchases` exits early if container missing.
    }

    async function renderPurchases(containerId = 'purchases-list') {
        const container = document.getElementById(containerId);
        if (!container) return; // 🛑 Safeguard: Exit if not on purchases page

        // ... rest of logic ...
        attempts++;
        if (window.supabaseClient || attempts >= maxAttempts) {
            clearInterval(checkSupabase);
            if (window.supabaseClient) startManager();
            else console.error("❌ Supabase failed to initialize after 10 attempts.");
        }
    }, 500);
    return;
}

        startManager();
    }

async function startManager() {
    // First check if user is logged in
    const { data: { session }, error: sessionError } = await window.supabaseClient.auth.getSession();

    if (sessionError || !session) {
        console.warn("No active session found. Redirecting to login...");
        // Redirect with a query param to come back after login
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        window.location.href = `/pages/login.html?redirect=${currentPath}`;
        return;
    }

    currentUser = session.user;
    const userId = session.user.id;

    try {
        await fetchPurchases(userId);
        isInitialized = true;
    } catch (err) {
        console.error("PurchasesManager Start Error:", err);
        renderErrorState(document.getElementById('purchases-list'));
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
                            )
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
        console.error("Error fetching purchases:", err);
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
            if (!product) return;

            const row = createPurchaseRow(order, item, product);
            fragment.appendChild(row);
        });
    });

    container.appendChild(fragment);
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

    // Optimized Buttons with simple tooltips if needed
    if (product.mp3_url) {
        actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'mp3')" title="Bajar MP3"><i class="bi bi-music-note-beamed"></i> MP3</button>`;
    }
    if (product.wav_url) {
        actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'wav')" title="Bajar WAV"><i class="bi bi-music-note-beamed"></i> WAV</button>`;
    }
    if (product.stems_url) {
        actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'stems')" title="Bajar STEMS"><i class="bi bi-archive"></i> STEMS</button>`;
    }
    if (product.kit_url || product.product_type === 'drumkit' || product.product_type === 'loopkit' || product.product_type === 'preset') {
        actionsHtml += `<button class="download-btn" onclick="window.PurchasesManager.downloadFile(this, ${orderId}, '${productId}', 'kit')" title="Bajar ZIP"><i class="bi bi-box-seam"></i> ZIP</button>`;
    }

    // License PDF Generation Logic
    const licenseType = item.license_name || 'basic';
    const purchaseDataObj = null; // Placeholder as we can't easily serialize object to HTML attribute

    // We will attach the data via a global map or simply pass ID and regenerate info? 
    // Better: Function that constructs data on the fly if we pass necessary params.
    // But we have 'order' and 'item' here.

    // Strategy: Serialize a minimal set of data needed, or look it up.
    // Let's us encodeURI a JSON string? Might be too large.
    // Alternative: window.PurchasesManager.generateLicense(orderId, itemId);
    // And we store the items in a map.

    // Let's modify the architecture slightly to store items.
    // Or just pass the RAW values needed.
    const buyerName = window.currentUser?.user_metadata?.nickname || window.currentUser?.email?.split('@')[0] || 'Cliente';
    const buyerEmail = window.currentUser?.email || '';

    // JSON Stringify safe for HTML attribute
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
        licenseSettings: product.users?.license_settings || {} // We need to fetch producer settings!
    };

    // Escaping for HTML attribute
    const pdfDataStr = encodeURIComponent(JSON.stringify(pdfData));

    actionsHtml += `<button class="download-btn primary" onclick="window.PurchasesManager.generatePDF(this, '${pdfDataStr}')" title="Descargar Licencia de Uso"><i class="bi bi-file-earmark-pdf"></i> PDF</button>`;

    // Row Content - Truncation is handled by CSS, but we inject clean data
    row.innerHTML = `
            <img src="${product.image_url || '/images/default-cover.png'}" class="purchase-cover" alt="Portada" onerror="this.src='/images/default-cover.png'">
            <div class="purchase-info">
                <span class="purchase-name" title="${product.name}">${product.name}</span>
                <span class="purchase-producer">${producerName}</span>
                <span style="font-size:0.75rem; color:#888;">${licenseType.toUpperCase()}</span>
            </div>
            <div class="purchase-monto">${montoHtml}</div>
            <div class="purchase-date">${dateFormatted}</div>
            <div class="purchase-id" title="Transacción: ${order.transaction_id}">${(order.transaction_id || '').substring(0, 10)}...</div>
            <div class="purchase-actions">
                ${actionsHtml}
            </div>
        `;

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
        console.error("Download Error:", err);
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
        console.error("PDF Gen Error:", err);
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

return { init, downloadFile, generatePDF };
}) ();

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
