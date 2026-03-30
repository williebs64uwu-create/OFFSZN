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
        this.renderYapeStatus();
        this.renderSalesHistory();

        this.setupListeners();
        this.setupYapeListeners();

        // Check if there's a pending verification from a page reload
        this.checkPendingVerification();
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
            const customerName = sale.order?.buyer?.nickname || (sale.order?.guest_email ? "Invitado" : "Usuario Anónimo");
            const customerEmail = sale.order?.buyer?.email || sale.order?.guest_email || "N/A";
            const statusStr = sale.order?.status || 'completed';
            const amountStr = parseFloat(sale.price_at_purchase || 0).toFixed(2);

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

        // Save pending verification state and open the modal
        this._pendingYapePhone = finalPhone;
        localStorage.setItem('yape_pending_phone', finalPhone);
        localStorage.setItem('yape_pending_time', Date.now().toString());

        this.openVerifyModal(finalPhone);
    },

    // --- YAPE VERIFICATION MODAL ---

    _resendInterval: null,
    _pendingYapePhone: null,

    checkPendingVerification: function () {
        const pendingPhone = localStorage.getItem('yape_pending_phone');
        const pendingTime = localStorage.getItem('yape_pending_time');
        if (!pendingPhone || !pendingTime) return;

        // Expire after 10 minutes
        const elapsed = Date.now() - parseInt(pendingTime, 10);
        if (elapsed > 10 * 60 * 1000) {
            localStorage.removeItem('yape_pending_phone');
            localStorage.removeItem('yape_pending_time');
            return;
        }

        this._pendingYapePhone = pendingPhone;
        this.openVerifyModal(pendingPhone);
    },

    openVerifyModal: async function (phone) {
        const modal = document.getElementById('modal-yape-verify');
        const phoneDisplay = document.getElementById('verify-phone-display');
        if (!modal) return;

        // Format phone for display: +51 993 525 005
        const digits = phone.replace('+51', '');
        const formatted = `+51 ${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6, 9)}`;
        if (phoneDisplay) phoneDisplay.textContent = formatted;

        // Reset OTP inputs
        const boxes = modal.querySelectorAll('.otp-box');
        boxes.forEach(b => { 
            b.value = ''; 
            b.classList.remove('error', 'filled');
            b.disabled = false;
        });

        // Reset error
        const errMsg = document.getElementById('otp-error-msg');
        if (errMsg) { errMsg.style.display = 'none'; errMsg.textContent = ''; }

        // Disable verify button
        const btnConfirm = document.getElementById('btn-confirm-otp');
        if (btnConfirm) {
            btnConfirm.disabled = true;
            btnConfirm.textContent = 'Verificar';
        }

        // Show modal early
        modal.classList.add('active');
        this.setupOtpInputs();
        
        // Focus first box
        setTimeout(() => { if (boxes[0]) boxes[0].focus(); }, 200);

        try {
            // Trigger Edge Function to send SMS
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            const response = await fetch(`${window.SUPABASE_URL}/functions/v1/verify-yape-phone`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ phone, action: 'send' })
            });

            const result = await response.json();

            // 🔥 BYPASS LOGIC: Si el backend detectó Trial de Twilio, ya guardó el número
            if (result.bypassed) {
                console.log("Bypass mode detected:", result.message);
                this.data.yapePhone = phone;
                this.renderYapeStatus();
                this.toggleYapeEdit(false);
                this.closeVerifyModal();
                if (window.showToast) window.showToast("Número guardado exitosamente.", "success");
                return;
            }

            if (!response.ok) {
                let errMsg = result.error || 'Error al enviar SMS';
                if (result.details) {
                    console.error("Twilio Error Details:", result.details);
                    if (result.details.message) errMsg += `: ${result.details.message}`;
                }
                throw new Error(errMsg);
            }

            this.startResendTimer();
            if (window.showToast) window.showToast("Código de verificación enviado.", "success");
        } catch (err) {
            console.error("SMS Error:", err);
            if (window.showToast) window.showToast(err.message, "error");
            this.closeVerifyModal();
        }
    },

    closeVerifyModal: function () {
        const modal = document.getElementById('modal-yape-verify');
        if (modal) modal.classList.remove('active');
        if (this._resendInterval) {
            clearInterval(this._resendInterval);
            this._resendInterval = null;
        }
        localStorage.removeItem('yape_pending_phone');
        localStorage.removeItem('yape_pending_time');
    },

    setupOtpInputs: function () {
        const modal = document.getElementById('modal-yape-verify');
        if (!modal) return;

        const boxes = Array.from(modal.querySelectorAll('.otp-box'));
        const btnConfirm = document.getElementById('btn-confirm-otp');
        const btnClose = document.getElementById('btn-close-verify');
        const btnResend = document.getElementById('btn-resend-otp');

        // Close button
        if (btnClose) btnClose.onclick = () => this.closeVerifyModal();

        // Confirm button
        if (btnConfirm) btnConfirm.onclick = () => this.confirmOtp();

        // Resend button
        if (btnResend) btnResend.onclick = () => this.resendCode();

        const checkAllFilled = () => {
            const allFilled = boxes.every(b => b.value.length === 1);
            if (btnConfirm) btnConfirm.disabled = !allFilled;
        };

        boxes.forEach((box, i) => {
            box.oninput = (e) => {
                box.value = box.value.replace(/\D/g, '');
                if (box.value.length === 1) {
                    box.classList.add('filled');
                    if (i < boxes.length - 1) boxes[i + 1].focus();
                } else {
                    box.classList.remove('filled');
                }
                checkAllFilled();
            };

            box.onkeydown = (e) => {
                if (e.key === 'Backspace' && box.value.length === 0 && i > 0) {
                    boxes[i - 1].focus();
                    boxes[i - 1].value = '';
                    boxes[i - 1].classList.remove('filled');
                    checkAllFilled();
                }
            };

            // Handle paste
            box.onpaste = (e) => {
                e.preventDefault();
                const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').substring(0, 6);
                pasted.split('').forEach((char, j) => {
                    if (boxes[j]) {
                        boxes[j].value = char;
                        boxes[j].classList.add('filled');
                    }
                });
                const focusIdx = Math.min(pasted.length, boxes.length - 1);
                boxes[focusIdx].focus();
                checkAllFilled();
            };
        });
    },

    startResendTimer: function () {
        const countdown = document.getElementById('resend-countdown');
        const label = document.getElementById('resend-label');
        const btnResend = document.getElementById('btn-resend-otp');

        if (this._resendInterval) clearInterval(this._resendInterval);

        let seconds = 60;
        if (countdown) { countdown.textContent = `${seconds}s`; countdown.style.display = ''; }
        if (label) { label.textContent = 'Puedes reenviar en '; label.style.display = ''; }
        if (btnResend) { btnResend.style.display = 'none'; btnResend.classList.add('disabled'); }

        this._resendInterval = setInterval(() => {
            seconds--;
            if (countdown) countdown.textContent = `${seconds}s`;

            if (seconds <= 0) {
                clearInterval(this._resendInterval);
                this._resendInterval = null;
                if (countdown) countdown.style.display = 'none';
                if (label) label.style.display = 'none';
                if (btnResend) {
                    btnResend.style.display = 'inline';
                    btnResend.classList.remove('disabled');
                }
            }
        }, 1000);
    },

    resendCode: async function () {
        const btnResend = document.getElementById('btn-resend-otp');
        if (!btnResend || btnResend.classList.contains('disabled')) return;

        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            const response = await fetch(`${window.SUPABASE_URL}/functions/v1/verify-yape-phone`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ phone: this._pendingYapePhone, action: 'send' })
            });

            if (!response.ok) throw new Error("Error al reenviar SMS");

            if (window.showToast) window.showToast("Código reenviado.", "success");
            this.startResendTimer();
        } catch (err) {
            if (window.showToast) window.showToast(err.message, "error");
        }
    },

    confirmOtp: async function () {
        const modal = document.getElementById('modal-yape-verify');
        const boxes = Array.from(modal.querySelectorAll('.otp-box'));
        const code = boxes.map(b => b.value).join('');
        const btnConfirm = document.getElementById('btn-confirm-otp');
        const errMsg = document.getElementById('otp-error-msg');

        if (code.length !== 6) return;

        btnConfirm.disabled = true;
        btnConfirm.textContent = 'Verificando...';
        boxes.forEach(b => b.disabled = true);

        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            const response = await fetch(`${window.SUPABASE_URL}/functions/v1/verify-yape-phone`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ 
                    phone: this._pendingYapePhone, 
                    code, 
                    action: 'check' 
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Código incorrecto');
            }

            // Success!
            this.data.yapePhone = this._pendingYapePhone;
            this.renderYapeStatus();
            this.toggleYapeEdit(false);
            this.closeVerifyModal();

            if (window.showToast) window.showToast("Número de Yape verificado exitosamente.", "success");
        } catch (err) {
            console.error('Verification error:', err);
            boxes.forEach(b => {
                b.disabled = false;
                b.classList.add('error');
            });
            if (errMsg) {
                errMsg.textContent = err.message || 'Error al verificar. Intenta de nuevo.';
                errMsg.style.display = 'block';
            }
            setTimeout(() => boxes.forEach(b => b.classList.remove('error')), 600);
            btnConfirm.disabled = false;
            btnConfirm.textContent = 'Verificar';
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
