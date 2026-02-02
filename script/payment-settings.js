const PaymentSettings = {
    userId: null,

    init: async function () {
        console.log("Payment Settings Initialized");

        // Safety Check
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

        // Load All Data
        await Promise.all([
            this.loadSidebarData(),
            this.loadStatus(),
            this.loadSalesHistory()
        ]);

        this.setupListeners();
    },

    getSession: async function () {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        return session;
    },

    loadSidebarData: async function () {
        try {
            const { data, error } = await window.supabaseClient
                .from('users')
                .select('nickname, avatar_url, role, first_name, last_name, email')
                .eq('id', this.userId)
                .single();

            if (error) throw error;

            // Populate Sidebar
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
        } catch (err) {
            console.error("Error loading sidebar data:", err);
        }
    },

    loadStatus: async function () {
        try {
            const { data: user, error } = await window.supabaseClient
                .from('users')
                .select('payment_methods')
                .eq('id', this.userId)
                .single();

            if (error) throw error;

            const paypal = user?.payment_methods?.paypal;
            this.updateUI(paypal);
        } catch (err) {
            console.error("Error loading payment status:", err);
        }
    },

    loadSalesHistory: async function () {
        const container = document.getElementById('sales-history-container');
        if (!container) return;

        try {
            // Fetch order items for products owned by this producer
            // We join with products to filter by producer_id, and orders to get the status and customer ID
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

            // Filter out null products (though shouldn't happen with inner joins if we had them)
            // Supabase JS doesn't do true inner join filtering easily without RPC or standard JS filtering
            const mySales = data.filter(item => item.product && item.product.producer_id === this.userId);

            if (!mySales || mySales.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        <i class="bi bi-clipboard-data" style="font-size: 3rem; opacity: 0.2; display: block; margin-bottom: 16px;"></i>
                        <p>No tienes ventas registradas aún.</p>
                        <a href="/cuenta/subir-kit.html" style="color: var(--accent); font-weight: 600; text-decoration: none;">¡Sube tu primer producto!</a>
                    </div>
                `;
                return;
            }

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
                    <div class="transaction-item">
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
                    </div>
                `;
            }).join('');

        } catch (err) {
            console.error("Error loading sales history:", err);
            container.innerHTML = `<p style="color:#ef4444; text-align:center;">Error al cargar el historial.</p>`;
        }
    },

    updateUI: function (paypalEmail) {
        const label = document.getElementById('paypal-status-label');
        const dot = document.getElementById('paypal-status-dot');
        const emailDisplay = document.getElementById('paypal-display-email');
        const btn = document.getElementById('btn-connect-paypal');

        if (!label || !dot) return;

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
        // Robust listener registration
        const btn = document.getElementById('btn-connect-paypal');
        if (btn) {
            btn.addEventListener('click', () => this.openModal());
        }

        const saveBtn = document.getElementById('btn-save-paypal');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.save());
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

        // Basic sanitization: strip any non-email characters if accidentally pasted
        email = email.match(/[a-zA-Z0-9._%+-]+@?[a-zA-Z0-9.-]+\.?[a-zA-Z]{0,}/)?.[0] || email;

        if (!this.isValidEmail(email)) {
            if (window.showToast) window.showToast("Por favor ingresa un correo de PayPal válido.", "error");
            else alert("Por favor ingresa un correo de PayPal válido.");
            return;
        }

        try {
            // Get current methods first to avoid overwriting other potential methods
            const { data: user } = await supabaseClient
                .from('users')
                .select('payment_methods')
                .eq('id', this.userId)
                .single();

            const currentMethods = user?.payment_methods || {};
            currentMethods.paypal = email;

            const { error } = await supabaseClient
                .from('users')
                .update({ payment_methods: currentMethods })
                .eq('id', this.userId);

            if (error) throw error;

            if (window.showToast) window.showToast("PayPal configurado correctamente.", "success");
            else alert("PayPal configurado correctamente.");

            this.closeModal();
            await this.loadStatus();

            // Re-run navbar check if available
            if (window.checkPaymentSetup) window.checkPaymentSetup(this.userId);

        } catch (err) {
            console.error("Error saving PayPal:", err);
            if (window.showToast) window.showToast("Error al guardar: " + err.message, "error");
            else alert("Error al guardar: " + err.message);
        }
    }
};

// Make it global for inline onclick handlers
window.PaymentSettings = PaymentSettings;
window.paymentsettings = PaymentSettings; // Case-insensitive fallback

// Auto-init
document.addEventListener('DOMContentLoaded', () => PaymentSettings.init());
