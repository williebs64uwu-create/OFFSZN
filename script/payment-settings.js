const PaymentSettings = {
    userId: null,

    // Store fetched data
    data: {
        sidebar: null,
        status: null,
        sales: []
    },

    init: async function () {
        // 1. Inject Skeletons IMMEDIATELY
        this.injectSidebarSkeletons();
        this.injectSalesSkeletons();
        this.injectButtonSkeleton();
        this.injectEmailSkeleton();
        this.injectPayPalStatusSkeleton();

        console.log("Payment Settings Initialized");

        if (!window.supabaseClient) {
            console.warn("PaymentSettings: Supabase client not found.");
            return;
        }

        const session = await this.getSession();
        if (!session) {
            window.location.href = '/pages/login.html';
            return;
        }

        this.userId = session.user.id;

        // 2. Start Minimum Wait Timer (1.5s)
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
                .select('payment_methods')
                .eq('id', this.userId)
                .single();
            if (error) throw error;
            this.data.status = user?.payment_methods?.paypal;
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

            // Filter
            this.data.sales = data.filter(item => item.product && item.product.producer_id === this.userId);
        } catch (err) {
            console.error("Error fetching sales history:", err);
            this.data.sales = null; // Mark as error
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

    // --- RENDERING ACTIONS ---

    injectSalesSkeletons: function () {
        const container = document.getElementById('sales-history-container');
        if (!container) return;

        // Matches .transaction-item .tx-grid structure exactly
        container.innerHTML = Array(5).fill(0).map(() => `
            <div class="skeleton-row">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="skeleton-base skeleton-circle" style="width:40px; height:40px;"></div>
                    <div style="flex:1;">
                        <div class="skeleton-base skeleton-text" style="width:120px; margin-bottom:6px;"></div>
                        <div class="skeleton-base skeleton-text" style="width:160px; margin-bottom:0;"></div>
                    </div>
                </div>
                <div class="skeleton-base skeleton-text" style="width:80px; margin-bottom:0;"></div>
                <div><div class="skeleton-base skeleton-status"></div></div>
                <div class="skeleton-base skeleton-amount"></div>
            </div>
        `).join('');
    },

    injectButtonSkeleton: function () {
        const btn = document.getElementById('btn-connect-paypal');
        if (btn) {
            console.log("Applying skeleton to PayPal button");
            btn.classList.add('btn-loading-skeleton');
        }
    },

    injectEmailSkeleton: function () {
        const emailEl = document.getElementById('paypal-display-email');
        if (emailEl) {
            emailEl.innerHTML = `<div class="skeleton-base" style="width: 160px; height: 16px; border-radius: 4px; display: inline-block; vertical-align: middle;"></div>`;
        }
    },

    injectPayPalStatusSkeleton: function () {
        const label = document.getElementById('paypal-status-label');
        const dot = document.getElementById('paypal-status-dot');
        if (label) {
            label.innerHTML = `<div class="skeleton-base" style="width: 70px; height: 14px; border-radius: 4px; display: inline-block;"></div>`;
        }
        if (dot) {
            dot.style.backgroundColor = "rgba(255,255,255,0.05)";
        }
    },

    renderSidebar: function () {
        if (!this.data.sidebar) return; // Or handle error state

        const data = this.data.sidebar;
        const nameEl = document.getElementById('sidebarName');
        const roleEl = document.getElementById('sidebarRole');
        const avatarEl = document.getElementById('sidebarAvatar');

        if (nameEl) nameEl.textContent = data.nickname || (data.first_name ? `${data.first_name} ${data.last_name || ''}` : 'Usuario');
        if (roleEl) roleEl.textContent = data.role || 'Productor';

        if (avatarEl) {
            if (data.avatar_url) {
                avatarEl.innerHTML = `<img src="${data.avatar_url}" alt="Avatar" style="width:100%; height:100%; border-radius:inherit; object-fit:cover;">`;
                avatarEl.style.background = "transparent";
            } else {
                avatarEl.textContent = (data.nickname || data.email || 'U').charAt(0).toUpperCase();
            }
        }
    },

    renderStatus: function () {
        // data.status is the paypal email or undefined
        const paypalEmail = this.data.status;
        this.updateUI(paypalEmail);
    },

    renderSalesHistory: function () {
        const container = document.getElementById('sales-history-container');
        if (!container) return;

        const mySales = this.data.sales;

        if (mySales === null) {
            container.innerHTML = `<p style="color:#ef4444; text-align:center;">Error al cargar el historial.</p>`;
            return;
        }

        if (mySales.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="bi bi-clipboard-data" style="font-size: 3rem; opacity: 0.2; display: block; margin-bottom: 16px;"></i>
                    <p>No tienes ventas registradas aún.</p>
                    <a href="/cuenta/subir-kit.html" style="color: var(--accent); font-weight: 600; text-decoration: none;">¡Sube tu primer producto!</a>
                </div>
            `;
            return;
        }

        // Use .tx-grid + .transaction-item
        container.innerHTML = mySales.map(sale => {
            const date = new Date(sale.created_at).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            const customerName = sale.order?.buyer?.nickname || "Usuario Anónimo";
            const customerEmail = sale.order?.buyer?.email || "N/A";
            const status = sale.order?.status || 'completed';
            const amount = parseFloat(sale.price_at_purchase).toFixed(2);

            return `
                <div class="transaction-item tx-grid">
                    <div class="tr-customer">
                        <i class="bi bi-person-circle" style="font-size: 1.5rem; color: #444;"></i>
                        <div class="tr-customer-info">
                            <h4>${customerName}</h4>
                            <p>${customerEmail}</p>
                        </div>
                    </div>
                    <div class="tr-date">${date}</div>
                    <div><span class="tr-status ${status}">${status}</span></div>
                    <div class="tr-amount">$${amount}</div>
                    <div style="display: flex; justify-content: flex-end;">
                        <button class="btn-security-log" onclick="PaymentSettings.viewSecurityLogs('${sale.order?.id}')" title="Ver Bitácora de Seguridad">
                            <i class="bi bi-shield-lock"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    updateUI: function (paypalEmail) {
        const label = document.getElementById('paypal-status-label');
        const dot = document.getElementById('paypal-status-dot');
        const emailDisplay = document.getElementById('paypal-display-email');
        const btn = document.getElementById('btn-connect-paypal');

        if (!label || !dot) return;

        // Remove Skeleton States
        if (btn) btn.classList.remove('btn-loading-skeleton');
        if (dot) dot.style.backgroundColor = "";

        if (paypalEmail && this.isValidEmail(paypalEmail)) {
            label.textContent = "Conectado";
            label.style.color = "#10b981";
            dot.className = "status-dot online";
            if (emailDisplay) emailDisplay.textContent = paypalEmail;
            if (btn) btn.textContent = "Actualizar PayPal";
        } else {
            label.textContent = "No configurado";
            label.style.color = "#ef4444";
            dot.className = "status-dot offline";
            if (emailDisplay) emailDisplay.textContent = "Desconectado";
            if (btn) btn.textContent = "Conectar PayPal";
        }
    },

    isValidEmail: function (email) {
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(String(email).toLowerCase());
    },

    setupListeners: function () {
        const btn = document.getElementById('btn-connect-paypal');
        if (btn) {
            // Remove old listeners? No easy way, but this element persists. 
            // Better to clone or check if listener added. 
            // For now, assuming simple page load.
            btn.onclick = () => this.openModal();
        }

        const saveBtn = document.getElementById('btn-save-paypal');
        if (saveBtn) {
            saveBtn.onclick = () => this.save();
        }
    },

    openModal: function () {
        const modal = document.getElementById('modalPayPal');
        if (modal) modal.classList.add('active');
    },

    closeModal: function () {
        const modal = document.getElementById('modalPayPal');
        if (modal) modal.classList.remove('active');
        const input = document.getElementById('inputPaypalEmail');
        if (input) input.value = "";
    },

    save: async function () {
        const input = document.getElementById('inputPaypalEmail');
        let email = input.value.trim().toLowerCase();

        email = email.match(/[a-zA-Z0-9._%+-]+@?[a-zA-Z0-9.-]+\.?[a-zA-Z]{0,}/)?.[0] || email;

        if (!this.isValidEmail(email)) {
            if (window.showToast) window.showToast("Por favor ingresa un correo de PayPal válido.", "error");
            else alert("Por favor ingresa un correo de PayPal válido.");
            return;
        }

        try {
            const { data: user } = await window.supabaseClient
                .from('users')
                .select('payment_methods')
                .eq('id', this.userId)
                .single();

            const currentMethods = user?.payment_methods || {};
            currentMethods.paypal = email;

            const { error } = await window.supabaseClient
                .from('users')
                .update({ payment_methods: currentMethods })
                .eq('id', this.userId);

            if (error) throw error;

            if (window.showToast) window.showToast("PayPal configurado correctamente.", "success");
            else alert("PayPal configurado correctamente.");

            this.closeModal();

            // Reload just status and render it
            await this.fetchStatus();
            this.renderStatus();

            if (window.checkPaymentSetup) window.checkPaymentSetup(this.userId);

        } catch (err) {
            console.error("Error saving PayPal:", err);
            if (window.showToast) window.showToast("Error al guardar: " + err.message, "error");
            else alert("Error al guardar: " + err.message);
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

        content.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Consultando base de datos...</div>';

        try {
            // Check if download_logs table exists and search by order_id
            // If it doesn't exist yet, we show a clean "No records" state with explanation
            const { data, error } = await window.supabaseClient
                .from('download_logs') // This is the table we planned
                .select('*')
                .eq('order_id', orderId)
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === 'PGRST116' || error.message.includes('not found')) {
                    content.innerHTML = `
                        <div style="text-align: center; padding: 30px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px;">
                            <i class="bi bi-info-circle" style="font-size: 2rem; color: #555; display: block; margin-bottom: 12px;"></i>
                            <p style="color: #999; font-size: 0.9rem; margin: 0;">No hay descargas registradas para este pedido aún.</p>
                            <p style="color: #666; font-size: 0.8rem; margin-top: 8px;">Las descargas se registran automáticamente al iniciar la descarga del archivo.</p>
                        </div>
                    `;
                    return;
                }
                throw error;
            }

            if (!data || data.length === 0) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 30px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px;">
                        <i class="bi bi-info-circle" style="font-size: 2rem; color: #555; display: block; margin-bottom: 12px;"></i>
                        <p style="color: #999; font-size: 0.9rem; margin: 0;">No se han detectado intentos de descarga.</p>
                    </div>
                `;
                return;
            }

            content.innerHTML = data.map(log => `
                <div class="security-log-item">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span class="log-date">${new Date(log.created_at).toLocaleString()}</span>
                        <span class="log-ip">${log.ip_address || 'IP Desconocida'}</span>
                    </div>
                    <div style="color: #666; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${log.user_agent}">
                        ${log.user_agent || 'N/A'}
                    </div>
                </div>
            `).join('');

        } catch (err) {
            console.warn("Security logs not available or table missing:", err);
            content.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="bi bi-shield-slash" style="color: #444; font-size: 1.5rem;"></i>
                    <p style="color: #888; font-size: 0.85rem; margin-top: 10px;">El monitoreo de seguridad está activado pero no se encontraron registros previos para esta transacción.</p>
                </div>
            `;
        }
    }
};

// Make it global for inline onclick handlers
window.PaymentSettings = PaymentSettings;
window.paymentsettings = PaymentSettings; // Case-insensitive fallback

// Auto-init
document.addEventListener('DOMContentLoaded', () => PaymentSettings.init());
