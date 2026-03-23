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
        isVerified: false,
        sales: []
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
        this.removeSidebarSkeletons();
        this.renderSidebar();
        this.renderStatus();
        this.renderSalesHistory();

        this.setupListeners();
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
                .select('paypal_email, paypal_verified, payment_methods')
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
                    order:orders(id, transaction_id, status, user_id, buyer:users(nickname, email))
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
        if (btn) {
            btn.classList.add('btn-loading-skeleton');
        }
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
    },

    // --- RENDERING ACTIONS ---

    renderSidebar: function () {
        if (!this.data.sidebar) return;

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

        const mySales = this.data.sales;

        if (mySales === null) {
            container.innerHTML = '';
            const p = document.createElement('p');
            p.style.color = "#ef4444";
            p.style.textAlign = "center";
            p.textContent = "Error al cargar el historial.";
            container.appendChild(p);
            return;
        }

        if (mySales.length === 0) {
            container.innerHTML = '';
            const div = document.createElement('div');
            div.style.textAlign = "center";
            div.style.padding = "40px";
            div.style.color = "var(--text-secondary)";

            const i = document.createElement('i');
            i.className = "bi bi-clipboard-data";
            i.style.fontSize = "3rem";
            i.style.opacity = "0.2";
            i.style.display = "block";
            i.style.marginBottom = "16px";

            const p = document.createElement('p');
            p.textContent = "No tienes ventas registradas aún.";

            const a = document.createElement('a');
            a.href = "/cuenta/subir-kit.html";
            a.style.color = "var(--accent)";
            a.style.fontWeight = "600";
            a.style.textDecoration = "none";
            a.textContent = "¡Sube tu primer producto!";

            div.appendChild(i);
            div.appendChild(p);
            div.appendChild(a);
            container.appendChild(div);
            return;
        }

        container.innerHTML = '';
        mySales.forEach(sale => {
            const dateStr = new Date(sale.created_at).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            const customerName = sale.order?.buyer?.nickname || "Usuario Anónimo";
            const customerEmail = sale.order?.buyer?.email || "N/A";
            const statusStr = sale.order?.status || 'completed';
            const amountStr = parseFloat(sale.price_at_purchase).toFixed(2);

            const row = document.createElement('div');
            row.className = 'transaction-item tx-grid';

            const customerDiv = document.createElement('div');
            customerDiv.className = 'tr-customer';
            const icon = document.createElement('i');
            icon.className = 'bi bi-person-circle';
            icon.style.fontSize = '1.5rem';
            icon.style.color = '#444';
            const infoDiv = document.createElement('div');
            infoDiv.className = 'tr-customer-info';
            const h4 = document.createElement('h4');
            h4.textContent = customerName;
            const p = document.createElement('p');
            p.textContent = customerEmail;
            infoDiv.appendChild(h4);
            infoDiv.appendChild(p);
            customerDiv.appendChild(icon);
            customerDiv.appendChild(infoDiv);

            const dateDiv = document.createElement('div');
            dateDiv.className = 'tr-date';
            dateDiv.textContent = dateStr;

            const statusContainer = document.createElement('div');
            const statusSpan = document.createElement('span');
            statusSpan.className = `tr-status ${statusStr}`;
            statusSpan.textContent = statusStr;
            statusContainer.appendChild(statusSpan);

            const amountDiv = document.createElement('div');
            amountDiv.className = 'tr-amount';
            amountDiv.textContent = `$${amountStr}`;

            const actionDiv = document.createElement('div');
            actionDiv.style.display = 'flex';
            actionDiv.style.justifyContent = 'flex-end';
            const logBtn = document.createElement('button');
            logBtn.className = 'btn-security-log';
            logBtn.title = "Ver Bitácora de Seguridad";
            logBtn.innerHTML = '<i class="bi bi-shield-lock"></i>';
            logBtn.onclick = () => this.viewSecurityLogs(sale.order?.id);
            actionDiv.appendChild(logBtn);

            row.appendChild(customerDiv);
            row.appendChild(dateDiv);
            row.appendChild(statusContainer);
            row.appendChild(amountDiv);
            row.appendChild(actionDiv);

            container.appendChild(row);
        });
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
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span class="log-date">${new Date(log.created_at).toLocaleString()}</span>
                        <span class="log-ip">${log.ip_address || 'IP Oculta'}</span>
                    </div>
                    <div style="color:#666; font-size:0.7rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${log.user_agent || 'N/A'}</div>
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
