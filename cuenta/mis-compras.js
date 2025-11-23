document.addEventListener('DOMContentLoaded', async () => {
    
    const token = localStorage.getItem('authToken');
    const CACHE_KEY = 'offszn_user_cache';
    
    // ===== CONFIGURACIÓN DE API =====
    let API_URL = '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_URL = 'http://localhost:3000/api';
    } else {
        API_URL = 'https://offszn-academy.onrender.com/api';
    }

    // ===== VERIFICAR AUTH =====
    if (!token) {
        window.location.replace('/pages/login.html');
        return;
    }

    // ===== ELEMENTOS DOM =====
    const purchasesGrid = document.getElementById('purchases-grid');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search-purchases');
    
    // Filtros
    const filterType = document.getElementById('filter-type');
    const filterSort = document.getElementById('filter-sort');

    // ===== ESTADO GLOBAL =====
    let allPurchases = [];

    // ===== FUNCIONES DE UTILIDAD =====
    function showSkeleton() {
        if(purchasesGrid) {
            purchasesGrid.style.display = 'grid';
            // Generamos 3 tarjetas de carga
            purchasesGrid.innerHTML = Array(3).fill(0).map(() => `
                <div class="purchase-card">
                    <div class="purchase-image skeleton" style="height: 180px;"></div>
                    <div class="purchase-info">
                        <div class="purchase-title skeleton" style="height:20px; width:80%; margin-bottom:10px;"></div>
                        <div class="purchase-meta skeleton" style="height:15px; width:50%;"></div>
                    </div>
                </div>
            `).join('');
        }
        if(emptyState) emptyState.style.display = 'none';
    }

    // ===== CARGAR COMPRAS DESDE API =====
    async function loadPurchases() {
        showSkeleton();

        try {
            // Llamamos al endpoint que ya creaste en el backend
            const response = await fetch(`${API_URL}/my-products`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('No se pudieron cargar las compras');

            const products = await response.json();
            console.log('📦 Productos comprados cargados:', products);

            allPurchases = products; // Guardamos en estado global
            
            updateStats(products);
            applyFilters(); // Renderiza aplicando filtros por defecto

        } catch (error) {
            console.error('❌ Error cargando compras:', error);
            if(purchasesGrid) purchasesGrid.innerHTML = '';
            if(emptyState) emptyState.style.display = 'block';
        }
    }

    // ===== ACTUALIZAR ESTADÍSTICAS =====
    function updateStats(products) {
        // Calculamos totales basados en los datos reales
        const totalCount = products.length;
        const drumkitsCount = products.filter(p => p.product_type === 'drumkit').length;
        const beatsCount = products.filter(p => p.product_type === 'beat').length;
        
        // Nota: El endpoint /my-products actual devuelve productos únicos, 
        // no el historial de transacciones con precios históricos. 
        // Para "Gasto Total" exacto necesitaríamos consultar la tabla 'orders'.
        // Por ahora, sumamos el precio actual del producto como aproximado.
        const totalSpent = products.reduce((sum, p) => sum + (parseFloat(p.price_basic) || 0), 0);

        // Actualizamos el DOM
        const statValues = document.querySelectorAll('.stat-value');
        if(statValues.length >= 4) {
            // 0: Compras Totales
            statValues[0].textContent = totalCount;
            statValues[0].classList.remove('skeleton');
            
            // 1: Drum Kits
            statValues[1].textContent = drumkitsCount;
            statValues[1].classList.remove('skeleton');

            // 2: Beats & Samples
            statValues[2].textContent = beatsCount;
            statValues[2].classList.remove('skeleton');

            // 3: Gasto (Aproximado)
            statValues[3].textContent = `$${totalSpent.toFixed(2)}`;
            statValues[3].classList.remove('skeleton');
        }
    }

    // ===== RENDERIZAR COMPRAS =====
    function renderPurchasesList(products) {
        if (!purchasesGrid) return;

        if (products.length === 0) {
            purchasesGrid.style.display = 'none';
            if(emptyState) emptyState.style.display = 'block';
            return;
        }

        purchasesGrid.style.display = 'grid';
        if(emptyState) emptyState.style.display = 'none';

        purchasesGrid.innerHTML = products.map(p => {
            // Determinar imagen (usar placeholder si no hay)
            let imgUrl = p.image_url;
            if (imgUrl && imgUrl.includes('supabase')) {
                 // Optimización opcional de imagen si usas CDN
                 imgUrl = imgUrl.replace('/object/', '/render/image/'); 
            }

            // Determinar tipo para el badge
            const type = p.product_type || 'Pack';

            return `
            <div class="purchase-card fade-in">
                <div class="purchase-image">
                    <img src="${imgUrl}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover;">
                    <span class="purchase-badge">${type}</span>
                </div>
                
                <div class="purchase-info">
                    <div class="purchase-title">${p.name}</div>
                    <div class="purchase-creator">
                        <i class="fas fa-user"></i> ${p.producer_nickname || 'OFFSZN'}
                    </div>
                    <div class="purchase-meta">
                        <span><i class="fas fa-check-circle"></i> Adquirido</span>
                    </div>
                </div>

                <div class="purchase-actions">
                    <button class="action-btn download" onclick="downloadProduct('${p.download_url_mp3 || p.download_url || '#'}', '${p.name}')">
                        <i class="fas fa-download"></i> Descargar
                    </button>
                    <button class="action-btn" onclick="window.location.href='/pages/producto.html?id=${p.id}'">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                </div>
            </div>
            `;
        }).join('');
    }

    // ===== LÓGICA DE FILTROS Y BÚSQUEDA =====
    function applyFilters() {
        let filtered = [...allPurchases];

        // 1. Filtro por Tipo
        const type = filterType ? filterType.value : 'all';
        if (type !== 'all') {
            filtered = filtered.filter(p => p.product_type === type);
        }

        // 2. Búsqueda
        const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
        if (term) {
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(term) || 
                (p.producer_nickname && p.producer_nickname.toLowerCase().includes(term))
            );
        }

        // 3. Ordenamiento
        const sort = filterSort ? filterSort.value : 'recent';
        if (sort === 'name-az') {
            filtered.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sort === 'name-za') {
            filtered.sort((a, b) => b.name.localeCompare(a.name));
        } 
        // Nota: 'recent' y 'oldest' dependen de la fecha. 
        // Si el endpoint /my-products no devuelve fecha de compra, usaremos created_at del producto o el ID como fallback.
        else if (sort === 'recent') {
            filtered.sort((a, b) => b.id - a.id); 
        } else if (sort === 'oldest') {
            filtered.sort((a, b) => a.id - b.id);
        }

        renderPurchasesList(filtered);
    }

    // ===== EVENT LISTENERS =====
    if(filterType) filterType.addEventListener('change', applyFilters);
    if(filterSort) filterSort.addEventListener('change', applyFilters);
    if(searchInput) searchInput.addEventListener('input', applyFilters);

    // ===== FUNCIONES GLOBALES (para el onclick del HTML) =====
    window.downloadProduct = (url, name) => {
        if (!url || url === '#' || url === 'null') {
            alert('El enlace de descarga no está disponible para este producto.');
            return;
        }
        
        // Crear un enlace temporal para forzar la descarga
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank'; 
        link.download = name; // Intenta sugerir el nombre
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ===== INICIALIZAR =====
    // Cargamos datos de usuario para el sidebar (esto ya lo hace tu script inline, pero aseguramos)
    // loadUserData(); <--- Si ya tienes esto en el HTML inline, no lo dupliques aquí.
    
    // Cargamos las compras
    await loadPurchases();
});