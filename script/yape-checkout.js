/**
 * OFFSZN - Yape Checkout Integration (Mercado Pago Perú)
 * ======================================================
 * Renders an ultra-sleek, responsive modal for instant Yape payments in Peru (PEN).
 * Handles OTP (código de aprobación), phone number, automatic tokenization,
 * and displays lifetime activation serial keys and download links immediately upon approval.
 */

(function () {
    class YapePluginCheckout {
        constructor() {
            this.exchangeRate = 3.30;
            this.publicKey = 'TEST-70d4423f-6d23-4bb3-807a-0b9565693d83';
            this.mpInstance = null;
            this.modalElement = null;
            this.productId = window.PLUGIN_ID || 899;
            this.pluginName = window.PLUGIN_NAME || 'Easy Mix';

            this.init();
        }

        async init() {
            this.injectStyles();
            this.createModal();
            this.attachButtonTriggers();
            await this.loadConfigAndSDK();
        }

        async loadConfigAndSDK() {
            try {
                const res = await fetch('/api/orders/yape/config');
                if (res.ok) {
                    const data = await res.json();
                    if (data.publicKey) this.publicKey = data.publicKey;
                    if (data.exchangeRate) this.exchangeRate = data.exchangeRate;
                }
            } catch (e) {
                console.warn('[YapeCheckout] Using fallback config:', e);
            }

            // Load MercadoPago.js v2 SDK if not already loaded
            if (!window.MercadoPago) {
                const script = document.createElement('script');
                script.src = 'https://sdk.mercadopago.com/js/v2';
                script.onload = () => {
                    this.initMP();
                };
                document.head.appendChild(script);
            } else {
                this.initMP();
            }
        }

        initMP() {
            if (window.MercadoPago && !this.mpInstance) {
                try {
                    this.mpInstance = new window.MercadoPago(this.publicKey, {
                        locale: 'es-PE'
                    });
                    console.log('✅ [YapeCheckout] Mercado Pago Perú SDK initialized.');
                } catch (err) {
                    console.error('[YapeCheckout] Failed to initialize Mercado Pago SDK:', err);
                }
            }
        }

        getPriceUSD() {
            return window.CURRENT_PROMO_PRICE || 10;
        }

        getPricePEN() {
            const usd = this.getPriceUSD();
            return (usd * this.exchangeRate).toFixed(2);
        }

        injectStyles() {
            if (document.getElementById('yape-checkout-styles')) return;

            const style = document.createElement('style');
            style.id = 'yape-checkout-styles';
            style.innerHTML = `
                /* Yape Trigger Button */
                .btn-yape-trigger {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    width: 100%;
                    padding: 15px 24px;
                    background: linear-gradient(135deg, #742284 0%, #8e2a9b 50%, #ec4899 100%);
                    color: #ffffff;
                    border: 1px solid rgba(236, 72, 153, 0.4);
                    border-radius: 12px;
                    font-family: 'Geist', 'Plus Jakarta Sans', sans-serif;
                    font-size: 1.02rem;
                    font-weight: 800;
                    cursor: pointer;
                    box-shadow: 0 8px 24px rgba(116, 34, 132, 0.35);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    margin-top: 10px;
                    text-decoration: none;
                }

                .btn-yape-trigger:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 30px rgba(116, 34, 132, 0.55);
                    border-color: rgba(236, 72, 153, 0.8);
                }

                .btn-yape-trigger .yape-badge-icon {
                    background: #ffffff;
                    color: #742284;
                    font-size: 0.72rem;
                    font-weight: 900;
                    padding: 2px 7px;
                    border-radius: 6px;
                    letter-spacing: 0.5px;
                }

                /* Modal Overlay */
                .yape-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.82);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    display: none;
                    align-items: center;
                    justify-content: center;
                    z-index: 99999;
                    padding: 16px;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .yape-modal-overlay.active {
                    display: flex;
                    opacity: 1;
                }

                /* Modal Card */
                .yape-modal-card {
                    background: #0d0d12;
                    background-image: radial-gradient(circle at top right, rgba(116, 34, 132, 0.15), transparent 70%),
                                      radial-gradient(circle at bottom left, rgba(236, 72, 153, 0.08), transparent 60%);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(116, 34, 132, 0.2);
                    border-radius: 20px;
                    width: 100%;
                    max-width: 440px;
                    color: #ffffff;
                    font-family: 'Geist', 'Plus Jakarta Sans', -apple-system, sans-serif;
                    overflow: hidden;
                    position: relative;
                    transform: scale(0.95);
                    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                .yape-modal-overlay.active .yape-modal-card {
                    transform: scale(1);
                }

                .yape-modal-header {
                    padding: 22px 24px 18px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .yape-brand-group {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .yape-brand-circle {
                    width: 38px;
                    height: 38px;
                    background: linear-gradient(135deg, #742284, #ec4899);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 900;
                    font-size: 1.1rem;
                    color: #fff;
                    box-shadow: 0 4px 12px rgba(116, 34, 132, 0.4);
                }

                .yape-modal-title {
                    font-size: 1.15rem;
                    font-weight: 800;
                    margin: 0;
                    color: #fff;
                    line-height: 1.2;
                }

                .yape-modal-sub {
                    font-size: 0.8rem;
                    color: #a1a1aa;
                    margin: 2px 0 0;
                }

                .yape-close-btn {
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #999;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 1.1rem;
                    transition: all 0.2s;
                }

                .yape-close-btn:hover {
                    background: rgba(255, 255, 255, 0.15);
                    color: #fff;
                }

                /* Price summary bar */
                .yape-price-badge-bar {
                    background: rgba(116, 34, 132, 0.12);
                    border-bottom: 1px solid rgba(116, 34, 132, 0.25);
                    padding: 12px 24px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .yape-price-label {
                    font-size: 0.85rem;
                    color: #d4d4d8;
                    font-weight: 600;
                }

                .yape-price-highlight {
                    font-size: 1.25rem;
                    font-weight: 900;
                    color: #4ade80;
                    letter-spacing: -0.5px;
                }

                .yape-modal-body {
                    padding: 24px;
                }

                .yape-form-group {
                    margin-bottom: 18px;
                }

                .yape-form-label {
                    display: block;
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: #e4e4e7;
                    margin-bottom: 7px;
                }

                .yape-input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .yape-input-icon {
                    position: absolute;
                    left: 14px;
                    color: #71717a;
                    font-size: 1rem;
                }

                .yape-input {
                    width: 100%;
                    padding: 13px 14px 13px 40px;
                    background: rgba(255, 255, 255, 0.04);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 10px;
                    color: #fff;
                    font-family: inherit;
                    font-size: 0.95rem;
                    transition: all 0.2s ease;
                    outline: none;
                }

                .yape-input:focus {
                    background: rgba(255, 255, 255, 0.07);
                    border-color: #a855f7;
                    box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.2);
                }

                .yape-input::placeholder {
                    color: #52525b;
                }

                /* OTP helper callout */
                .yape-otp-guide {
                    background: rgba(116, 34, 132, 0.15);
                    border: 1px dashed rgba(236, 72, 153, 0.4);
                    border-radius: 10px;
                    padding: 10px 14px;
                    margin-top: 8px;
                    font-size: 0.78rem;
                    color: #e4e4e7;
                    line-height: 1.4;
                    display: flex;
                    gap: 8px;
                    align-items: flex-start;
                }

                .yape-otp-guide i {
                    color: #ec4899;
                    font-size: 0.95rem;
                    margin-top: 2px;
                }

                .yape-btn-submit {
                    width: 100%;
                    padding: 15px;
                    background: linear-gradient(135deg, #742284 0%, #8e2a9b 50%, #ec4899 100%);
                    color: #ffffff;
                    border: none;
                    border-radius: 12px;
                    font-family: inherit;
                    font-size: 1.05rem;
                    font-weight: 800;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    margin-top: 24px;
                    box-shadow: 0 8px 24px rgba(116, 34, 132, 0.4);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .yape-btn-submit:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 30px rgba(116, 34, 132, 0.6);
                }

                .yape-btn-submit:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }

                .yape-error-box {
                    background: rgba(239, 68, 68, 0.15);
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    color: #fca5a5;
                    border-radius: 10px;
                    padding: 12px 14px;
                    font-size: 0.83rem;
                    margin-top: 14px;
                    display: none;
                    line-height: 1.4;
                }

                /* Loading Spinner inside submit button */
                .yape-spinner {
                    width: 18px;
                    height: 18px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: yapeSpin 0.8s linear infinite;
                    display: inline-block;
                }

                @keyframes yapeSpin {
                    to { transform: rotate(360deg); }
                }

                /* Success View */
                .yape-success-view {
                    text-align: center;
                    padding: 28px 24px;
                    display: none;
                }

                .yape-success-icon-wrap {
                    width: 68px;
                    height: 68px;
                    background: rgba(34, 197, 94, 0.15);
                    border: 2px solid #22c55e;
                    border-radius: 50%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                    color: #22c55e;
                    margin-bottom: 16px;
                    animation: yapePop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                @keyframes yapePop {
                    0% { transform: scale(0.5); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }

                .yape-license-card {
                    background: #15141e;
                    border: 1px dashed #742284;
                    border-radius: 12px;
                    padding: 18px;
                    margin: 20px 0;
                    text-align: center;
                }

                .yape-key-text {
                    font-family: monospace;
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: #4ade80;
                    letter-spacing: 1.5px;
                    margin: 8px 0;
                    word-break: break-all;
                }

                .yape-btn-copy {
                    background: rgba(255, 255, 255, 0.08);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    color: #fff;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 0.82rem;
                    font-weight: 700;
                    cursor: pointer;
                    margin-top: 6px;
                    transition: all 0.2s;
                }

                .yape-btn-copy:hover {
                    background: rgba(255, 255, 255, 0.18);
                }

                .yape-download-actions {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-top: 20px;
                }

                .yape-download-btn {
                    padding: 12px;
                    border-radius: 10px;
                    text-decoration: none;
                    font-weight: 700;
                    font-size: 0.88rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }

                .yape-download-win {
                    background: #742284;
                    color: #fff;
                }

                .yape-download-mac {
                    background: #27272a;
                    color: #fff;
                }
            `;
            document.head.appendChild(style);
        }

        createModal() {
            if (document.getElementById('yape-checkout-modal')) return;

            const modalHtml = `
                <div id="yape-checkout-modal" class="yape-modal-overlay">
                    <div class="yape-modal-card">
                        <!-- Header -->
                        <div class="yape-modal-header">
                            <div class="yape-brand-group">
                                <div class="yape-brand-circle">Y</div>
                                <div>
                                    <h3 class="yape-modal-title">Pagar con Yape</h3>
                                    <p class="yape-modal-sub">Débito directo e instantáneo (Perú 🇵🇪)</p>
                                </div>
                            </div>
                            <button id="yape-modal-close" class="yape-close-btn" aria-label="Cerrar">&times;</button>
                        </div>

                        <!-- Price Banner -->
                        <div class="yape-price-badge-bar">
                            <span class="yape-price-label">Monto total a transferir:</span>
                            <span id="yape-modal-price" class="yape-price-highlight">S/. 16.50</span>
                        </div>

                        <!-- Form View -->
                        <div id="yape-form-view" class="yape-modal-body">
                            <form id="yape-checkout-form" onsubmit="return false;">
                                <div class="yape-form-group">
                                    <label class="yape-form-label" for="yape-email">Tu Correo Electrónico:</label>
                                    <div class="yape-input-wrapper">
                                        <i class="bi bi-envelope yape-input-icon"></i>
                                        <input type="email" id="yape-email" class="yape-input" placeholder="tu@correo.com" required autocomplete="email">
                                    </div>
                                    <span style="font-size:0.72rem; color:#71717a; margin-top:4px; display:block;">Aquí recibirás tu serial key y links de descarga.</span>
                                </div>

                                <div class="yape-form-group">
                                    <label class="yape-form-label" for="yape-phone">Celular registrado en Yape:</label>
                                    <div class="yape-input-wrapper">
                                        <i class="bi bi-phone yape-input-icon"></i>
                                        <input type="tel" id="yape-phone" class="yape-input" placeholder="9XX XXX XXX" maxlength="9" required>
                                    </div>
                                </div>

                                <div class="yape-form-group">
                                    <label class="yape-form-label" for="yape-otp">Código de Aprobación (6 dígitos):</label>
                                    <div class="yape-input-wrapper">
                                        <i class="bi bi-shield-lock yape-input-icon"></i>
                                        <input type="text" id="yape-otp" class="yape-input" placeholder="123456" maxlength="6" pattern="[0-9]{6}" required autocomplete="off">
                                    </div>
                                    <div class="yape-otp-guide">
                                        <i class="bi bi-info-circle-fill"></i>
                                        <span><strong>¿Dónde encontrarlo?</strong> Abre tu app Yape &gt; Toca el menú lateral de las 3 rayitas &gt; <strong>Código de aprobación</strong>.</span>
                                    </div>
                                </div>

                                <div id="yape-error-box" class="yape-error-box"></div>

                                <button type="submit" id="yape-submit-btn" class="yape-btn-submit">
                                    <span id="yape-submit-text">Yapear S/. 16.50</span>
                                </button>
                            </form>
                        </div>

                        <!-- Success View -->
                        <div id="yape-success-view" class="yape-success-view">
                            <div class="yape-success-icon-wrap">
                                <i class="bi bi-check-lg"></i>
                            </div>
                            <h2 style="font-size:1.4rem; font-weight:800; margin:0 0 6px;">¡Pago con Yape Exitoso!</h2>
                            <p style="color:#a1a1aa; font-size:0.88rem; margin:0 0 16px;">Tu compra ha sido verificada y tu licencia está lista.</p>

                            <div class="yape-license-card">
                                <span style="font-size:0.75rem; color:#a855f7; text-transform:uppercase; letter-spacing:1px; font-weight:700;">🔑 Tu Clave de Activación</span>
                                <div id="yape-success-serial" class="yape-key-text">CARGANDO...</div>
                                <button type="button" id="yape-copy-serial-btn" class="yape-btn-copy">
                                    <i class="bi bi-clipboard"></i> Copiar Clave
                                </button>

                                <div id="yape-bonus-card" style="display:none; margin-top:14px; padding-top:14px; border-top:1px dashed rgba(255,255,255,0.15);">
                                    <span style="font-size:0.75rem; color:#ec4899; text-transform:uppercase; letter-spacing:1px; font-weight:700;">🎁 REGALO 2X1: Easy Master</span>
                                    <div id="yape-bonus-serial" class="yape-key-text" style="color:#ec4899;">...</div>
                                </div>
                            </div>

                            <p style="font-size:0.82rem; color:#e4e4e7; margin:0 0 10px; font-weight:600;">📥 Descarga tu plugin ahora:</p>
                            <div class="yape-download-actions">
                                <a id="yape-download-win" href="#" target="_blank" class="yape-download-btn yape-download-win">
                                    <i class="bi bi-windows"></i> Windows (.exe)
                                </a>
                                <a id="yape-download-mac" href="#" target="_blank" class="yape-download-btn yape-download-mac">
                                    <i class="bi bi-apple"></i> macOS (.dmg)
                                </a>
                            </div>

                            <p style="color:#71717a; font-size:0.75rem; margin-top:20px;">
                                Hemos enviado una copia de tus accesos a tu correo.
                            </p>
                        </div>
                    </div>
                </div>
            `;

            const wrapper = document.createElement('div');
            wrapper.innerHTML = modalHtml;
            document.body.appendChild(wrapper.firstElementChild);

            this.modalElement = document.getElementById('yape-checkout-modal');

            // Event Listeners
            document.getElementById('yape-modal-close').addEventListener('click', () => this.closeModal());
            this.modalElement.addEventListener('click', (e) => {
                if (e.target === this.modalElement) this.closeModal();
            });

            document.getElementById('yape-checkout-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.processPayment();
            });

            document.getElementById('yape-copy-serial-btn').addEventListener('click', () => {
                const serial = document.getElementById('yape-success-serial').innerText;
                if (serial && serial !== 'CARGANDO...') {
                    navigator.clipboard.writeText(serial);
                    const btn = document.getElementById('yape-copy-serial-btn');
                    btn.innerHTML = '<i class="bi bi-check"></i> ¡Copiado!';
                    setTimeout(() => {
                        btn.innerHTML = '<i class="bi bi-clipboard"></i> Copiar Clave';
                    }, 2000);
                }
            });
        }

        openModal() {
            if (!this.modalElement) return;

            const pricePEN = this.getPricePEN();
            document.getElementById('yape-modal-price').innerText = `S/. ${pricePEN}`;
            document.getElementById('yape-submit-text').innerText = `Yapear S/. ${pricePEN}`;

            // Reset views
            document.getElementById('yape-form-view').style.display = 'block';
            document.getElementById('yape-success-view').style.display = 'none';
            this.hideError();

            this.modalElement.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Auto focus email or phone
            const emailInput = document.getElementById('yape-email');
            if (emailInput && !emailInput.value) emailInput.focus();
        }

        closeModal() {
            if (!this.modalElement) return;
            this.modalElement.classList.remove('active');
            document.body.style.overflow = '';
        }

        showError(msg) {
            const box = document.getElementById('yape-error-box');
            if (box) {
                box.innerText = msg;
                box.style.display = 'block';
            }
        }

        hideError() {
            const box = document.getElementById('yape-error-box');
            if (box) {
                box.innerText = '';
                box.style.display = 'none';
            }
        }

        async processPayment() {
            const email = document.getElementById('yape-email').value.trim();
            const phone = document.getElementById('yape-phone').value.trim().replace(/\D/g, '');
            const otp = document.getElementById('yape-otp').value.trim();

            if (!email || !email.includes('@')) {
                this.showError('Por favor ingresa un correo válido.');
                return;
            }

            if (phone.length < 9) {
                this.showError('Ingresa un número de celular de 9 dígitos válido.');
                return;
            }

            if (otp.length !== 6) {
                this.showError('El código de aprobación debe tener exactamente 6 dígitos.');
                return;
            }

            this.hideError();

            const submitBtn = document.getElementById('yape-submit-btn');
            const submitText = document.getElementById('yape-submit-text');
            submitBtn.disabled = true;
            submitText.innerHTML = '<span class="yape-spinner"></span> Validando con Yape...';

            try {
                if (!this.mpInstance) {
                    this.initMP();
                }

                let yapeToken = null;

                // 1. Generate token with Mercado Pago SDK
                if (this.mpInstance && typeof this.mpInstance.yape === 'function') {
                    try {
                        const yape = this.mpInstance.yape({
                            otp: otp,
                            phoneNumber: phone
                        });
                        const tokenObj = await yape.create();
                        yapeToken = tokenObj?.id || tokenObj;
                    } catch (sdkErr) {
                        console.error('[YapeCheckout] SDK token error:', sdkErr);
                        throw new Error(sdkErr.message || 'Código de aprobación inválido o expirado. Revisa tu app Yape.');
                    }
                } else {
                    // Fallback test token or direct token
                    yapeToken = 'TEST_YAPE_' + Date.now();
                }

                if (!yapeToken) {
                    throw new Error('No se pudo generar el token de Yape. Revisa el código de aprobación.');
                }

                submitText.innerHTML = '<span class="yape-spinner"></span> Procesando cobro...';

                // 2. Call backend charge endpoint
                const attribution = (window.MetaPixel && typeof window.MetaPixel.getAttributionData === 'function')
                    ? window.MetaPixel.getAttributionData()
                    : {};

                const response = await fetch('/api/orders/yape/charge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: yapeToken,
                        email: email,
                        phoneNumber: phone,
                        productId: this.productId,
                        customPrice: this.getPriceUSD(),
                        attribution: attribution
                    })
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.error || 'No se pudo completar el pago con Yape.');
                }

                // 3. Render Success Screen
                this.renderSuccess(result);

            } catch (err) {
                console.error('[YapeCheckout] Error:', err);
                this.showError(err.message || 'Error al procesar el pago.');
            } finally {
                submitBtn.disabled = false;
                submitText.innerText = `Yapear S/. ${this.getPricePEN()}`;
            }
        }

        renderSuccess(data) {
            document.getElementById('yape-form-view').style.display = 'none';
            document.getElementById('yape-success-view').style.display = 'block';

            document.getElementById('yape-success-serial').innerText = data.serialKey || 'Activo en tu cuenta';

            if (data.bonusKey) {
                const bonusCard = document.getElementById('yape-bonus-card');
                bonusCard.style.display = 'block';
                document.getElementById('yape-bonus-serial').innerText = data.bonusKey;
            }

            if (data.downloads) {
                if (data.downloads.win) document.getElementById('yape-download-win').href = data.downloads.win;
                if (data.downloads.mac) document.getElementById('yape-download-mac').href = data.downloads.mac;
            }

            // Track Meta Pixel Purchase
            if (window.MetaPixel && typeof window.MetaPixel.trackPurchase === 'function') {
                window.MetaPixel.trackPurchase({
                    content_ids: ['easy_mix'],
                    content_name: 'Easy Mix VST',
                    content_type: 'product',
                    value: this.getPriceUSD(),
                    currency: 'USD',
                    order_id: String(data.orderId || data.paymentId)
                });
            }
        }

        attachButtonTriggers() {
            // Find existing Yape buttons or inject a dedicated button in the checkout section
            document.addEventListener('click', (e) => {
                const target = e.target.closest('[data-action="open-yape-checkout"], #btn-yape-checkout, .btn-yape-trigger');
                if (target) {
                    e.preventDefault();
                    this.openModal();
                }
            });
        }
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.YapeCheckout = new YapePluginCheckout();
        });
    } else {
        window.YapeCheckout = new YapePluginCheckout();
    }
})();
