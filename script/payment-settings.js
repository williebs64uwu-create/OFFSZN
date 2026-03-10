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
        // 0. Handle OAuth Redirect Params
        this.handleUrlParams();

        // 1. Inject Skeletons IMMEDIATELY
        this.injectSidebarSkeletons();
        this.injectSalesSkeletons();
        this.injectButtonSkeleton();
        this.injectEmailSkeleton();
        // this.injectPayPalStatusSkeleton();

        // console.log("Payment Settings Initialized with OAuth Flow");

        if (!window.supabaseClient) {
            // console.warn("PaymentSettings: Supabase client not found.");
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

    handleUrlParams: function () {
        const params = new URLSearchParams(window.location.search);
        const paypalStatus = params.get('paypal');

        if (paypalStatus === 'success') {
            if (window.showToast) window.showToast("¡PayPal conectado y verificado correctamente!", "success");
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (paypalStatus === 'error') {
            const msg = params.get('msg') || 'Error desconocido';
            if (window.showToast) window.showToast("Error al conectar PayPal: " + msg, "error");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
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
            // console.error("Error fetching sidebar data:", err);
        }
    },

    fetchStatus: async function () {
        try {
            const { data: user, error } = await window.supabaseClient
                .from('users')
                .select('payment_methods, paypal_verified')
                .eq('id', this.userId)
                .single();
            if (error) throw error;
            this.data.status = user?.payment_methods?.paypal;
            this.data.isVerified = user?.paypal_verified || false;
        } catch (err) {
            // console.error("Error fetching payment status:", err);
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
            // console.error("Error fetching sales history:", err);
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
            // console.log("Applying skeleton to PayPal button");
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

    injectPayPalStatusSkeleton: function () {
        const label = document.getElementById('paypal-status-label');
        const dot = document.getElementById('paypal-status-dot');
        if (label) {
            label.innerHTML = '';
            const skeleton = document.createElement('div');
            skeleton.className = "skeleton-base";
            skeleton.style.width = "70px";
            skeleton.style.height = "14px";
            skeleton.style.borderRadius = "4px";
            skeleton.style.display = "inline-block";
            label.appendChild(skeleton);
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
            avatarEl.innerHTML = '';
            if (data.avatar_url) {
                const img = document.createElement('img');
                img.src = data.avatar_url;
                img.alt = "Avatar";
                img.crossOrigin = "anonymous";
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
        // data.status is the paypal email or undefined
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
            logBtn.innerHTML = '<i class="bi bi-shield-lock"></i>'; // Static icon is okay
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
        const isVerified = this.data.isVerified;

        if (!label || !dot) return;

        // Remove Skeleton States
        if (btn) btn.classList.remove('btn-loading-skeleton');
        if (dot) dot.style.backgroundColor = "";

        if (paypalEmail && this.isValidEmail(paypalEmail)) {
            label.innerHTML = '';
            if (isVerified) {
                const icon = document.createElement('i');
                icon.className = 'bi bi-patch-check-fill';
                label.appendChild(icon);
                label.appendChild(document.createTextNode(' Verificado'));
            } else {
                label.textContent = 'Conectado';
            }
            label.style.color = "#10b981";
            dot.className = "status-dot online";
            if (emailDisplay) emailDisplay.textContent = paypalEmail;
            if (btn) btn.textContent = isVerified ? "Cambiar Cuenta PayPal" : "Verificar PayPal";
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
            btn.onclick = () => this.startOAuthFlow();
        }
    },

    startOAuthFlow: async function () {
        try {
            // 1. Obtener el token de la sesión actual de Supabase
            const { data: { session }, error: sessionError } = await window.supabaseClient.auth.getSession();

            if (sessionError || !session) {
                console.error('❌ No se pudo obtener la sesión:', sessionError);
                if (window.showToast) window.showToast('Sesión expirada. Por favor, inicia sesión de nuevo.', 'error');
                return;
            }

            const token = session.access_token;

            // 2. Llamar al backend para obtener la URL de PayPal con el header de Auth
            const response = await fetch('/api/auth/paypal/connect', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al iniciar conexión');
            }

            const data = await response.json();

            // 3. Si tenemos la URL, redirigimos
            if (data.url) {
                // console.log('🚀 Redirigiendo a PayPal...');
                window.location.href = data.url;
            } else {
                throw new Error('No se recibió la URL de redirección');
            }

        } catch (err) {
            console.error('❌ Error en startOAuthFlow:', err);
            if (window.showToast) {
                window.showToast(err.message || 'Error al conectar con PayPal', 'error');
            } else {
                alert('Error al conectar con PayPal: ' + err.message);
            }
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

        content.innerHTML = '';
        const loading = document.createElement('div');
        loading.style.textAlign = 'center';
        loading.style.color = '#666';
        loading.style.padding = '20px';
        loading.textContent = 'Consultando base de datos...';
        content.appendChild(loading);

        try {
            const { data, error } = await window.supabaseClient
                .from('download_logs')
                .select('*')
                .eq('order_id', orderId)
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === 'PGRST116' || error.message.includes('not found')) {
                    content.innerHTML = '';
                    const div = document.createElement('div');
                    div.style.textAlign = "center";
                    div.style.padding = "30px";
                    div.style.border = "1px dashed rgba(255,255,255,0.1)";
                    div.style.borderRadius = "12px";

                    const i = document.createElement('i');
                    i.className = "bi bi-info-circle";
                    i.style.fontSize = "2rem";
                    i.style.color = "#555";
                    i.style.display = "block";
                    i.style.marginBottom = "12px";

                    const p1 = document.createElement('p');
                    p1.style.color = "#999";
                    p1.style.fontSize = "0.9rem";
                    p1.style.margin = "0";
                    p1.textContent = "No hay descargas registradas para este pedido aún.";

                    const p2 = document.createElement('p');
                    p2.style.color = "#666";
                    p2.style.fontSize = "0.8rem";
                    p2.style.marginTop = "8px";
                    p2.textContent = "Las descargas se registran automáticamente al iniciar la descarga del archivo.";

                    div.appendChild(i);
                    div.appendChild(p1);
                    div.appendChild(p2);
                    content.appendChild(div);
                    return;
                }
                throw error;
            }

            if (!data || data.length === 0) {
                content.innerHTML = '';
                const div = document.createElement('div');
                div.style.textAlign = "center";
                div.style.padding = "30px";
                div.style.border = "1px dashed rgba(255,255,255,0.1)";
                div.style.borderRadius = "12px";

                const i = document.createElement('i');
                i.className = "bi bi-info-circle";
                i.style.fontSize = "2rem";
                i.style.color = "#555";
                i.style.display = "block";
                i.style.marginBottom = "12px";

                const p = document.createElement('p');
                p.style.color = "#999";
                p.style.fontSize = "0.9rem";
                p.style.margin = "0";
                p.textContent = "No se han detectado intentos de descarga.";

                div.appendChild(i);
                div.appendChild(p);
                content.appendChild(div);
                return;
            }

            content.innerHTML = '';
            data.forEach(log => {
                const item = document.createElement('div');
                item.className = 'security-log-item';

                const top = document.createElement('div');
                top.style.display = 'flex';
                top.style.justifyContent = 'space-between';
                top.style.marginBottom = '4px';

                const date = document.createElement('span');
                date.className = 'log-date';
                date.textContent = new Date(log.created_at).toLocaleString();

                const ip = document.createElement('span');
                ip.className = 'log-ip';
                ip.textContent = log.ip_address || 'IP Desconocida';

                top.appendChild(date);
                top.appendChild(ip);

                const ua = document.createElement('div');
                ua.style.color = '#666';
                ua.style.fontSize = '0.7rem';
                ua.style.whiteSpace = 'nowrap';
                ua.style.overflow = 'hidden';
                ua.style.textOverflow = 'ellipsis';
                ua.textContent = log.user_agent || 'N/A';
                ua.title = log.user_agent || 'N/A';

                item.appendChild(top);
                item.appendChild(ua);
                content.appendChild(item);
            });

        } catch (err) {
            content.innerHTML = '';
            const div = document.createElement('div');
            div.style.textAlign = "center";
            div.style.padding = "20px";

            const i = document.createElement('i');
            i.className = 'bi bi-shield-slash';
            i.style.color = '#444';
            i.style.fontSize = '1.5rem';

            const p = document.createElement('p');
            p.style.color = '#888';
            p.style.fontSize = '0.85rem';
            p.style.marginTop = '10px';
            p.textContent = 'El monitoreo de seguridad está activado pero no se encontraron registros previos para esta transacción.';

            div.appendChild(i);
            div.appendChild(p);
            content.appendChild(div);
        }
    }
};

// Make it global
window.PaymentSettings = PaymentSettings;
window.paymentsettings = PaymentSettings;

// Auto-init
document.addEventListener('DOMContentLoaded', () => PaymentSettings.init());
