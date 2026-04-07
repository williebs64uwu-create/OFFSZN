const PaymentSettings = {
    userId: null,

    escapeHTML: function (str) {
        if (!str) return "";
        return str.replace(/[&<>"']/g, function (m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[m];
        });
    },

    // Store fetched data
    data: {
        sidebar: null,
        status: null,
        yapePhone: null,
        isVerified: false,
        sales: [],
        filteredSales: [],
        selectedSalesIds: new Set(),
        currentPage: 1,
        rowsPerPage: 10
    },

    init: async function () {
        // 1. Inject Skeletons IMMEDIATELY
        this.injectSidebarSkeletons();
        this.injectSalesSkeletons();
        this.injectButtonSkeleton();
        this.injectEmailSkeleton();

        if (!window.supabaseClient) {
            return;
        }

        const session = await this.getSession();
        if (!session) {
            window.location.href = '/pages/login.html';
            return;
        }

        this.userId = session.user.id;

        // 2. Start Minimum Wait Timer (1.5s) for smooth skeleton transition
        const timerPromise = new Promise(resolve => setTimeout(resolve, 1500));

        // 3. Start Data Fetching
        const uniqueFetchPromise = Promise.all([
            this.fetchSidebarData(),
            this.fetchStatus(),
            this.fetchSalesHistory()
        ]);

        // 4. Wait for BOTH (Timer + Data)
        await Promise.all([timerPromise, uniqueFetchPromise]);

        // 5. Render Everything Simultaneously
        this.renderSidebar();
        this.renderStatus();
        this.renderYapeStatus();
        
        // Initial filter and render
        this.data.filteredSales = [...(this.data.sales || [])];
        this.renderSalesHistory();

        this.setupListeners();
        this.setupYapeListeners();
        this.setupTableListeners();
    },

    getSession: async function () {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        return session;
    },

    // --- FETCHING ACTIONS ---

    fetchSidebarData: async function () {
        try {
            const { data, error } = await window.supabaseClient
                .from('users')
                .select('nickname, avatar_url, role, first_name, last_name, email')
                .eq('id', this.userId)
                .single();
            if (error) throw error;
            this.data.sidebar = data;
        } catch (err) {
            console.error("Error fetching sidebar data:", err);
        }
    },

    fetchStatus: async function () {
        try {
            const { data: user, error } = await window.supabaseClient
                .from('users')
                .select('paypal_email, paypal_verified, payment_methods, yape_phone, preferred_currency')
                .eq('id', this.userId)
                .single();
            if (error) throw error;
            
            let paypalEmail = user?.paypal_email;
            const legacyPaypal = user?.payment_methods?.paypal;

            // Silent Migration: if paypal_email is empty but legacy data exists, sync it
            if (!paypalEmail && legacyPaypal) {
                paypalEmail = legacyPaypal;
                // No need to await here to not block the UI, but we'll do it for consistency
                await window.supabaseClient
                    .from('users')
                    .update({ paypal_email: legacyPaypal })
                    .eq('id', this.userId);
            }

            this.data.status = paypalEmail;
            this.data.isVerified = user?.paypal_verified || false;
            this.data.yapePhone = user?.yape_phone || null;
            this.data.preferredCurrency = user?.preferred_currency || 'USD';
        } catch (err) {
            console.error("Error fetching payment status:", err);
        }
    },

    fetchSalesHistory: async function () {
        try {
            const { data, error } = await window.supabaseClient
                .from('order_items')
                .select(`
                    id,
                    price_at_purchase,
                    created_at,
                    product:products(id, name, producer_id),
                    order:orders(id, transaction_id, status, user_id, guest_email, buyer:users(nickname, email))
                `)
                .eq('products.producer_id', this.userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Filter to ensure only items belonging to this producer
            this.data.sales = data.filter(item => item.product && item.product.producer_id === this.userId);
        } catch (err) {
            console.error("Error fetching sales history:", err);
            this.data.sales = null; 
        }
    },

    // --- SKELETON ACTIONS ---

    injectSidebarSkeletons: function () {
        const name = document.getElementById('sidebarName');
        const role = document.getElementById('sidebarRole');
        const avatar = document.getElementById('sidebarAvatar');
        if (name) name.classList.add('skeleton-base', 'skeleton-name');
        if (role) role.classList.add('skeleton-base', 'skeleton-role');
        if (avatar) avatar.classList.add('skeleton-base', 'skeleton-avatar');
    },

    removeSidebarSkeletons: function () {
        const name = document.getElementById('sidebarName');
        const role = document.getElementById('sidebarRole');
        const avatar = document.getElementById('sidebarAvatar');
        if (name) name.classList.remove('skeleton-base', 'skeleton-name');
        if (role) role.classList.remove('skeleton-base', 'skeleton-role');
        if (avatar) avatar.classList.remove('skeleton-base', 'skeleton-avatar');
    },

    injectSalesSkeletons: function () {
        const container = document.getElementById('sales-history-container');
        if (!container) return;

        container.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const row = document.createElement('div');
            row.className = 'skeleton-row';

            const leftCol = document.createElement('div');
            leftCol.style.display = 'flex';
            leftCol.style.alignItems = 'center';
            leftCol.style.gap = '12px';

            const circle = document.createElement('div');
            circle.className = 'skeleton-base skeleton-circle';
            circle.style.width = '40px';
            circle.style.height = '40px';

            const info = document.createElement('div');
            info.style.flex = '1';
            const text1 = document.createElement('div');
            text1.className = 'skeleton-base skeleton-text';
            text1.style.width = '120px';
            text1.style.marginBottom = '6px';
            const text2 = document.createElement('div');
            text2.className = 'skeleton-base skeleton-text';
            text2.style.width = '160px';
            text2.style.marginBottom = '0';

            info.appendChild(text1);
            info.appendChild(text2);
            leftCol.appendChild(circle);
            leftCol.appendChild(info);

            const date = document.createElement('div');
            date.className = 'skeleton-base skeleton-text';
            date.style.width = '80px';
            date.style.marginBottom = '0';

            const statusContainer = document.createElement('div');
            const status = document.createElement('div');
            status.className = 'skeleton-base skeleton-status';
            statusContainer.appendChild(status);

            const amount = document.createElement('div');
            amount.className = 'skeleton-base skeleton-amount';

            row.appendChild(leftCol);
            row.appendChild(date);
            row.appendChild(statusContainer);
            row.appendChild(amount);

            container.appendChild(row);
        }
    },

    injectButtonSkeleton: function () {
        const btn = document.getElementById('btn-connect-paypal');
        const yapeBtn = document.getElementById('btn-toggle-yape');
        if (btn) btn.classList.add('btn-loading-skeleton');
        if (yapeBtn) yapeBtn.classList.add('btn-loading-skeleton');
    },

    injectEmailSkeleton: function () {
        const emailEl = document.getElementById('paypal-display-email');
        if (emailEl) {
            emailEl.innerHTML = '';
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-base';
            skeleton.style.width = "160px";
            skeleton.style.height = "16px";
            skeleton.style.borderRadius = "4px";
            skeleton.style.display = "inline-block";
            skeleton.style.verticalAlign = "middle";
            emailEl.appendChild(skeleton);
        }

        const yapeEl = document.getElementById('yape-display-phone');
        if (yapeEl) {
            yapeEl.innerHTML = '';
            const skelYape = document.createElement('div');
            skelYape.className = 'skeleton-base';
            skelYape.style.width = "140px";
            skelYape.style.height = "16px";
            skelYape.style.borderRadius = "4px";
            skelYape.style.display = "inline-block";
            skelYape.style.verticalAlign = "middle";
            yapeEl.appendChild(skelYape);
        }
    },

    // --- RENDERING ACTIONS ---

    renderSidebar: function () {
        if (!this.data.sidebar) return;

        this.removeSidebarSkeletons();

        const data = this.data.sidebar;
        const nameEl = document.getElementById('sidebarName');
        const roleEl = document.getElementById('sidebarRole');
        const avatarEl = document.getElementById('sidebarAvatar');

        if (nameEl) nameEl.textContent = data.nickname || (data.first_name ? `${data.first_name} ${data.last_name || ''}` : 'Usuario');
        if (roleEl) roleEl.textContent = data.role || 'Productor';

        if (avatarEl) {
            avatarEl.innerHTML = '';
            if (data.avatar_url) {
                const img = document.createElement('img');
                img.src = data.avatar_url;
                img.alt = "Avatar";
            // img.crossOrigin = "anonymous";
                img.style.width = "100%";
                img.style.height = "100%";
                img.style.borderRadius = "inherit";
                img.style.objectFit = "cover";
                avatarEl.appendChild(img);
                avatarEl.style.background = "transparent";
            } else {
                avatarEl.textContent = (data.nickname || data.email || 'U').charAt(0).toUpperCase();
            }
        }
    },

    renderStatus: function () {
        const paypalEmail = this.data.status;
        this.updateUI(paypalEmail);
    },

    renderSalesHistory: function () {
        const container = document.getElementById('sales-history-container');
        if (!container) return;

        const allFiltered = this.data.filteredSales || [];
        const totalRows = allFiltered.length;
        const totalPages = Math.ceil(totalRows / this.data.rowsPerPage);
        
        // Clamp current page
        if (this.data.currentPage > totalPages && totalPages > 0) this.data.currentPage = totalPages;
        if (this.data.currentPage < 1) this.data.currentPage = 1;

        const start = (this.data.currentPage - 1) * this.data.rowsPerPage;
        const end = start + this.data.rowsPerPage;
        const pageSales = allFiltered.slice(start, end);

        // Update Pagination Info
        this.updatePaginationUI(totalRows, totalPages);

        if (allFiltered.length === 0) {
            container.innerHTML = '';
            const div = document.createElement('div');
            div.style.textAlign = "center";
            div.style.padding = "60px 40px";
            div.style.color = "var(--text-secondary)";

            const i = document.createElement('i');
            i.className = "bi bi-search";
            i.style.fontSize = "3rem";
            i.style.opacity = "0.15";
            i.style.display = "block";
            i.style.marginBottom = "16px";

            const p = document.createElement('p');
            p.textContent = this.data.sales?.length === 0 ? "No tienes ventas registradas aún." : "No se encontraron transacciones para ese filtro.";

            div.appendChild(i);
            div.appendChild(p);
            container.appendChild(div);
            return;
        }

        container.innerHTML = '';
        pageSales.forEach(sale => {
            const customerEmail = sale.order?.buyer?.email || sale.order?.guest_email || "N/A";
            const statusType = (sale.order?.status || 'completed').toLowerCase();
            const amount = parseFloat(sale.price_at_purchase || 0);
            
            const isSelected = this.data.selectedSalesIds.has(sale.id);

            const row = document.createElement('div');
            row.className = 'transaction-item tx-grid';

            // 1. Checkbox
            const cbContainer = document.createElement('div');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'tx-checkbox';
            cb.checked = isSelected;
            cb.onclick = (e) => {
                e.stopPropagation();
                this.toggleRowSelection(sale.id);
            };
            cbContainer.appendChild(cb);

            // 2. Status
            const statusContainer = document.createElement('div');
            const statusSpan = document.createElement('span');
            const mapped = this.mapStatus(statusType);
            statusSpan.className = `tr-status ${mapped.class}`;
            statusSpan.innerHTML = `<i class="bi ${mapped.icon}"></i> ${mapped.text}`;
            statusContainer.appendChild(statusSpan);

            // 3. Email
            const emailDiv = document.createElement('div');
            emailDiv.className = 'tr-email';
            emailDiv.textContent = customerEmail;
            emailDiv.title = customerEmail;

            // 3.5 Date
            const dateDiv = document.createElement('div');
            dateDiv.className = 'tr-date';
            dateDiv.style.fontSize = '0.85rem';
            dateDiv.style.color = '#71717a';
            dateDiv.style.fontWeight = '500';
            
            const saleDate = new Date(sale.created_at);
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);
            
            const isToday = saleDate.getDate() === today.getDate() && saleDate.getMonth() === today.getMonth() && saleDate.getFullYear() === today.getFullYear();
            const isYesterday = saleDate.getDate() === yesterday.getDate() && saleDate.getMonth() === yesterday.getMonth() && saleDate.getFullYear() === yesterday.getFullYear();
            
            if (isToday) {
                dateDiv.textContent = "Hoy";
            } else if (isYesterday) {
                dateDiv.textContent = "Ayer";
            } else {
                dateDiv.textContent = `${saleDate.getDate()}/${(saleDate.getMonth() + 1).toString().padStart(2, '0')}`;
            }

            // 4. Amount
            const amountDiv = document.createElement('div');
            amountDiv.className = 'tr-amount';
            if (amount <= 0) {
                amountDiv.style.color = "#fff";
                amountDiv.innerHTML = '<span style="font-weight: 800; letter-spacing: 0.5px;">GRATIS</span>';
            } else {
                amountDiv.textContent = `$${amount.toFixed(2)}`;
            }

            // 5. Actions
            const actionDiv = document.createElement('div');
            actionDiv.style.display = 'flex';
            actionDiv.style.justifyContent = 'center';
            const detailsBtn = document.createElement('button');
            detailsBtn.className = 'btn-details';
            detailsBtn.title = "Ver Detalles";
            detailsBtn.innerHTML = '<i class="bi bi-three-dots"></i>';
            detailsBtn.onclick = () => this.showTransactionDetails(sale);
            actionDiv.appendChild(detailsBtn);

            row.appendChild(cbContainer);
            row.appendChild(statusContainer);
            row.appendChild(emailDiv);
            row.appendChild(dateDiv);
            row.appendChild(amountDiv);
            row.appendChild(actionDiv);

            container.appendChild(row);
        });
    },

    mapStatus: function(status) {
        if (status.includes('complet') || status.includes('approv') || status.includes('success')) {
            return { text: 'Completado', class: 'completado', icon: 'bi-check-circle-fill' };
        }
        if (status.includes('process') || status.includes('pend') || status.includes('yape')) {
            return { text: 'Procesando', class: 'procesando', icon: 'bi-hourglass-split' };
        }
        return { text: 'Fallado', class: 'fallado', icon: 'bi-exclamation-circle-fill' };
    },

    updatePaginationUI: function(totalRows, totalPages) {
        const summary = document.getElementById('selection-summary');
        const prevBtn = document.getElementById('btn-prev-page');
        const nextBtn = document.getElementById('btn-next-page');
        const exportBtn = document.getElementById('btn-export-reports');

        const selectedCount = this.data.selectedSalesIds.size;

        if (summary) {
            summary.textContent = `${selectedCount} de ${totalRows} fila(s) seleccionada(s).`;
        }

        if (exportBtn) {
            if (selectedCount === 0) {
                exportBtn.style.opacity = '0.5';
                exportBtn.style.pointerEvents = 'none';
            } else {
                exportBtn.style.opacity = '1';
                exportBtn.style.pointerEvents = 'auto';
            }
        }

        if (prevBtn) prevBtn.disabled = this.data.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.data.currentPage >= totalPages || totalPages === 0;
    },

    toggleRowSelection: function(id) {
        if (this.data.selectedSalesIds.has(id)) {
            this.data.selectedSalesIds.delete(id);
        } else {
            this.data.selectedSalesIds.add(id);
        }
        this.renderSalesHistory();
    },

    toggleAllSelection: function(checked) {
        const allFiltered = this.data.filteredSales || [];
        if (checked) {
            allFiltered.forEach(sale => this.data.selectedSalesIds.add(sale.id));
        } else {
            this.data.selectedSalesIds.clear();
        }
        this.renderSalesHistory();
    },

    setupTableListeners: function() {
        // Search Filter
        const searchInput = document.getElementById('tx-search-input');
        if (searchInput) {
            searchInput.oninput = (e) => {
                const val = e.target.value.toLowerCase();
                this.data.filteredSales = this.data.sales.filter(sale => {
                    const email = (sale.order?.buyer?.email || sale.order?.guest_email || "").toLowerCase();
                    return email.includes(val);
                });
                this.data.currentPage = 1;
                this.renderSalesHistory();
            };
        }

        // Export Button
        const exportBtn = document.getElementById('btn-export-reports');
        if (exportBtn) {
            exportBtn.onclick = () => this.exportToCSV();
        }

        // Pagination
        const prevBtn = document.getElementById('btn-prev-page');
        const nextBtn = document.getElementById('btn-next-page');
        if (prevBtn) {
            prevBtn.onclick = () => {
                this.data.currentPage--;
                this.renderSalesHistory();
            };
        }
        if (nextBtn) {
            nextBtn.onclick = () => {
                this.data.currentPage++;
                this.renderSalesHistory();
            };
        }

        // Header Checkbox
        const headerCb = document.getElementById('header-checkbox');
        if (headerCb) {
            headerCb.onchange = (e) => this.toggleAllSelection(e.target.checked);
        }

        // Modal Close
        const closeBtn1 = document.getElementById('btn-close-tx-details');
        const closeBtn2 = document.getElementById('btn-close-tx-details-alt');
        if (closeBtn1) closeBtn1.onclick = () => this.closeDetailsModal();
        if (closeBtn2) closeBtn2.onclick = () => this.closeDetailsModal();
    },

    exportToCSV: function() {
        const selectedIds = this.data.selectedSalesIds;
        let toExport = [];
        
        if (selectedIds.size > 0) {
            toExport = this.data.sales.filter(s => selectedIds.has(s.id));
        } else {
            toExport = this.data.filteredSales;
        }

        if (toExport.length === 0) {
            if (window.showToast) window.showToast("No hay transacciones para exportar.", "info");
            return;
        }

        const headers = ["Fecha", "Email Comprador", "Producto", "Monto", "Estado", "ID Transaccion"];
        const rows = toExport.map(s => [
            new Date(s.created_at).toLocaleString(),
            s.order?.buyer?.email || s.order?.guest_email || "N/A",
            s.product?.name || "Eliminado",
            s.price_at_purchase || 0,
            this.mapStatus(s.order?.status || 'completed').text,
            s.order?.transaction_id || "N/A"
        ]);

        let csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `reporte_ventas_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (window.showToast) window.showToast("Reporte exportado correctamente.", "success");
    },

    showTransactionDetails: function(sale) {
        const modal = document.getElementById('modal-tx-details');
        const content = document.getElementById('tx-details-content');
        if (!modal || !content) return;

        const date = new Date(sale.created_at).toLocaleString('es-ES', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const buyer = sale.order?.buyer?.nickname || (sale.order?.guest_email ? "Invitado" : "Usuario");
        const buyerEmail = sale.order?.buyer?.email || sale.order?.guest_email || "N/A";
        const status = this.mapStatus(sale.order?.status || 'completed');

        content.innerHTML = `
            <div class="tx-detail-row">
                <span class="tx-detail-label">Producto</span>
                <span class="tx-detail-value">${sale.product?.name || 'Producto Eliminado'}</span>
            </div>
            <div class="tx-detail-row">
                <span class="tx-detail-label">Fecha</span>
                <span class="tx-detail-value">${date}</span>
            </div>
            <div class="tx-detail-row">
                <span class="tx-detail-label">Comprador</span>
                <span class="tx-detail-value">${buyer}</span>
            </div>
            <div class="tx-detail-row">
                <span class="tx-detail-label">Email</span>
                <span class="tx-detail-value">${buyerEmail}</span>
            </div>
            <div class="tx-detail-row">
                <span class="tx-detail-label">Monto</span>
                <span class="tx-detail-value" style="color: #fff; font-size: 1.1rem;">$${parseFloat(sale.price_at_purchase || 0).toFixed(2)}</span>
            </div>
            <div class="tx-detail-row">
                <span class="tx-detail-label">Estado</span>
                <span class="tr-status ${status.class}">${status.text}</span>
            </div>
            <div class="tx-detail-row" style="border-bottom: none;">
                <span class="tx-detail-label">ID Transacción</span>
                <span class="tx-detail-value" style="font-family: monospace; font-size: 0.8rem; background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px;">${sale.order?.transaction_id || 'N/A'}</span>
            </div>
        `;

        modal.classList.add('active');
    },

    closeDetailsModal: function() {
        const modal = document.getElementById('modal-tx-details');
        if (modal) modal.classList.remove('active');
    },

    updateUI: function (paypalEmail) {
        const label = document.getElementById('paypal-status-label');
        const dot = document.getElementById('paypal-status-dot');
        const emailDisplay = document.getElementById('paypal-display-email');
        const btn = document.getElementById('btn-connect-paypal');

        if (!label || !dot) return;

        if (btn) btn.classList.remove('btn-loading-skeleton');
        if (dot) dot.style.backgroundColor = "";

        if (paypalEmail && this.isValidEmail(paypalEmail)) {
            label.textContent = "Configurado";
            label.style.color = "#10b981";
            dot.className = "status-dot online";
            if (emailDisplay) emailDisplay.textContent = paypalEmail;
            if (btn) btn.textContent = "Cambiar Cuenta PayPal";
        } else {
            label.textContent = "No configurado";
            label.style.color = "#ef4444";
            dot.className = "status-dot offline";
            if (emailDisplay) emailDisplay.textContent = "Desconectado";
            if (btn) btn.textContent = "Configurar PayPal";
        }
    },

    isValidEmail: function (email) {
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(String(email).toLowerCase());
    },

    renderYapeStatus: function () {
        const container = document.getElementById('yape-setup-container');
        if (!container) return;

        // Temporarily disabled currency guard for testing
        // if (this.data.preferredCurrency !== 'PEN') {
        //     container.style.display = 'none';
        //     return;
        // }

        container.style.display = 'block';

        const yapePhone = this.data.yapePhone;
        const label = document.getElementById('yape-status-label');
        const dot = document.getElementById('yape-status-dot');
        const displayPhone = document.getElementById('yape-display-phone');
        const btnToggle = document.getElementById('btn-toggle-yape');

        if (!label || !dot) return;

        if (btnToggle) btnToggle.classList.remove('btn-loading-skeleton');

        // Format for display: +51 999 888 777
        if (yapePhone && yapePhone.length === 12) {
            const formatted = `+51 ${yapePhone.substring(3, 6)} ${yapePhone.substring(6, 9)} ${yapePhone.substring(9, 12)}`;
            label.textContent = "Configurado";
            label.style.color = "#10b981";
            dot.className = "status-dot online";
            if (displayPhone) displayPhone.textContent = formatted;
            if (btnToggle) btnToggle.textContent = "Cambiar Cuenta Yape";
        } else {
            label.textContent = "No configurado";
            label.style.color = "#ef4444";
            dot.className = "status-dot offline";
            if (displayPhone) displayPhone.textContent = "Desconectado";
            if (btnToggle) btnToggle.textContent = "Configurar Yape";
        }
    },

    setupYapeListeners: function () {
        const btnToggle = document.getElementById('btn-toggle-yape');
        const btnSave = document.getElementById('btn-save-yape');
        const btnCancel = document.getElementById('btn-cancel-yape');

        if (btnToggle) btnToggle.onclick = () => this.toggleYapeEdit(true);
        if (btnCancel) btnCancel.onclick = () => this.toggleYapeEdit(false);
        if (btnSave) btnSave.onclick = () => this.saveYapePhone();

        // Checkbox interaction
        const terms = document.getElementById('yape-terms-checkbox');
        const visual = document.getElementById('yape-checkbox-visual');
        if (terms && btnSave && visual) {
            terms.onchange = () => {
                const isChecked = terms.checked;
                btnSave.disabled = !isChecked;
                
                // Force B&W styles via JS to override any global purple CSS
                visual.style.background = isChecked ? '#fff' : 'rgba(255,255,255,0.05)';
                visual.style.borderColor = isChecked ? '#fff' : 'rgba(255,255,255,0.2)';
                const icon = visual.querySelector('i');
                if (icon) {
                    icon.style.display = isChecked ? 'block' : 'none';
                    icon.style.color = '#000';
                }
            };
        }

        // Auto-focus next input logic for blocks
        const p1 = document.getElementById('yape-p1');
        const p2 = document.getElementById('yape-p2');
        const p3 = document.getElementById('yape-p3');

        if (p1 && p2 && p3) {
            [p1, p2, p3].forEach((input, index, array) => {
                input.oninput = (e) => {
                    // Only digits
                    input.value = input.value.replace(/\D/g, '');
                    if (input.value.length === 3 && index < 2) {
                        array[index + 1].focus();
                    }
                };
                
                input.onkeydown = (e) => {
                    if (e.key === "Backspace" && input.value.length === 0 && index > 0) {
                        array[index - 1].focus();
                    }
                };
            });
        }
    },

    toggleYapeEdit: function (isEditing) {
        const displayArea = document.getElementById('yape-display-area');
        const configArea = document.getElementById('yape-config-area');
        const btnToggle = document.getElementById('btn-toggle-yape');
        const btnSave = document.getElementById('btn-save-yape');
        const btnCancel = document.getElementById('btn-cancel-yape');

        if (isEditing) {
            displayArea.style.display = 'none';
            configArea.style.display = 'flex';
            btnToggle.style.display = 'none';
            btnSave.style.display = 'block';
            btnCancel.style.display = 'block';

            // Reset inputs if already configured
            const phone = this.data.yapePhone;
            if (phone && phone.length === 12) {
                document.getElementById('yape-p1').value = phone.substring(3, 6);
                document.getElementById('yape-p2').value = phone.substring(6, 9);
                document.getElementById('yape-p3').value = phone.substring(9, 12);
            }
        } else {
            displayArea.style.display = 'block';
            configArea.style.display = 'none';
            btnToggle.style.display = 'block';
            btnSave.style.display = 'none';
            btnCancel.style.display = 'none';
            
            // Reset terms checkbox
            const terms = document.getElementById('yape-terms-checkbox');
            const visual = document.getElementById('yape-checkbox-visual');
            if (terms) {
                terms.checked = false;
                if (btnSave) btnSave.disabled = true;
                if (visual) {
                    visual.style.background = 'rgba(255,255,255,0.05)';
                    visual.style.borderColor = 'rgba(255,255,255,0.2)';
                    const icon = visual.querySelector('i');
                    if (icon) icon.style.display = 'none';
                }
            }
        }
    },

    saveYapePhone: async function () {
        const p1 = document.getElementById('yape-p1').value.trim();
        const p2 = document.getElementById('yape-p2').value.trim();
        const p3 = document.getElementById('yape-p3').value.trim();
        const terms = document.getElementById('yape-terms-checkbox').checked;
        const btnSave = document.getElementById('btn-save-yape');

        if (!terms) {
            if (window.showToast) window.showToast("Debes aceptar los términos y condiciones.", "error");
            return;
        }

        const fullNumber = p1 + p2 + p3;
        if (fullNumber.length !== 9) {
            if (window.showToast) window.showToast("El número de Yape debe tener 9 dígitos.", "error");
            return;
        }

        const finalPhone = "+51" + fullNumber;

        try {
            if (btnSave) {
                btnSave.disabled = true;
                btnSave.textContent = "Guardando...";
            }

            const { error } = await window.supabaseClient
                .from('users')
                .update({ yape_phone: finalPhone })
                .eq('id', this.userId);

            if (error) throw error;

            this.data.yapePhone = finalPhone;
            this.renderYapeStatus();
            this.toggleYapeEdit(false);
            
            if (window.showToast) window.showToast("Número de Yape guardado exitosamente.", "success");
        } catch (err) {
            console.error("Error saving Yape phone:", err);
            if (window.showToast) window.showToast("Error al guardar el número.", "error");
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.textContent = "Guardar Cambios";
            }
        }
    },

    setupListeners: function () {
        const btn = document.getElementById('btn-connect-paypal');
        if (btn) {
            btn.onclick = () => this.openPayPalModal();
        }
    },

    // --- MODAL ACTIONS ---

    openPayPalModal: function () {
        const modal = document.getElementById('modal-paypal-email');
        const input = document.getElementById('paypal-input-email');
        if (modal) {
            modal.classList.add('active');
            if (input) input.value = this.data.status || "";
        }
    },

    closePayPalModal: function () {
        const modal = document.getElementById('modal-paypal-email');
        if (modal) modal.classList.remove('active');
    },

    savePayPalEmail: async function () {
        const email = document.getElementById('paypal-input-email').value.trim().toLowerCase();
        const btn = document.getElementById('btn-save-paypal-email');

        if (email && !this.isValidEmail(email)) {
            if (window.showToast) window.showToast("Por favor ingresa un correo válido.", "error");
            return;
        }

        try {
            btn.disabled = true;
            btn.textContent = "Guardando...";

            const { error } = await window.supabaseClient
                .from('users')
                .update({ paypal_email: email })
                .eq('id', this.userId);

            if (error) throw error;

            this.data.status = email;
            this.renderStatus();
            this.closePayPalModal();

            // Refresh Onboarding Widget in real-time
            if (window.refreshOnboardingWidget) {
                window.refreshOnboardingWidget();
            }

            if (window.showToast) window.showToast("Cuenta PayPal actualizada correctamente.", "success");
        } catch (err) {
            console.error("Error saving paypal email:", err);
            if (window.showToast) window.showToast("Error al guardar los cambios.", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Guardar Cambios";
        }
    },

    openSecurityModal: function () {
        const modal = document.getElementById('modalSecurityLogs');
        if (modal) modal.classList.add('active');
    },

    closeSecurityModal: function () {
        const modal = document.getElementById('modalSecurityLogs');
        if (modal) modal.classList.remove('active');
    },

    viewSecurityLogs: async function (orderId) {
        this.openSecurityModal();
        const content = document.getElementById('security-logs-content');
        if (!content) return;

        content.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Cargando...</div>';

        try {
            const { data, error } = await window.supabaseClient
                .from('download_logs')
                .select('*')
                .eq('order_id', orderId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                content.innerHTML = '<div style="text-align:center; padding:30px; border:1px dashed rgba(255,255,255,0.1); border-radius:12px; color:#666;">No hay registros para este pedido.</div>';
                return;
            }

            content.innerHTML = '';
            data.forEach(log => {
                const item = document.createElement('div');
                item.className = 'security-log-item';
                item.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span class="log-date">${new Date(log.created_at).toLocaleString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                        <span class="log-ip">${log.ip_address || 'IP Oculta'}</span>
                    </div>
                    <div class="log-ua">
                        <i class="bi bi-cpu"></i>
                        <span>${log.user_agent || 'Dispositivo Desconocido'}</span>
                    </div>
                `;
                content.appendChild(item);
            });

        } catch (err) {
            content.innerHTML = '<div style="text-align:center; padding:20px; color:#ef4444;">Error al cargar bitácora.</div>';
        }
    }
};

window.PaymentSettings = PaymentSettings;
document.addEventListener('DOMContentLoaded', () => PaymentSettings.init());
