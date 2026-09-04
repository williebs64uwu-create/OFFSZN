/**
 * OFFSZN - Yape Checkout Integration (Mercado Pago Perú)
 * ======================================================
 * Minimalist Black & White / Monochrome Design.
 * Clean, professional, zero-glow, high-conversion checkout for Yape.
 */

(function () {
    class YapePluginCheckout {
        constructor() {
            this.exchangeRate = 3.30;
            this.publicKey = 'APP_USR-ca918f8a-784b-4413-aebb-d3fc5a6ae79c';
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
            this.setupOTPBoxHandlers();
            this.setupPhoneFormatter();
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
                    console.log('✅ [YapeCheckout] Mercado Pago SDK initialized.');
                } catch (err) {
                    console.error('[YapeCheckout] Failed to initialize Mercado Pago SDK:', err);
                }
            }
        }

        getPriceUSD() {
            return window.CURRENT_PROMO_PRICE || 10;
        }

        getPricePEN() {
            if (window.YAPE_FIXED_PRICE_PEN) {
                return Number(window.YAPE_FIXED_PRICE_PEN).toFixed(2);
            }
            const usd = this.getPriceUSD();
            const solesMap = { 5: 19, 10: 38, 15: 57, 20: 76 };
            if (solesMap[usd]) return Number(solesMap[usd]).toFixed(2);
            return (usd * this.exchangeRate).toFixed(2);
        }

        injectStyles() {
            if (document.getElementById('yape-checkout-styles')) return;

            const style = document.createElement('style');
            style.id = 'yape-checkout-styles';
            style.innerHTML = `
                /* Yape Trigger Button on Landing Page */
                .btn-yape-white {
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 10px !important;
                    width: 100% !important;
                    padding: 14px 20px !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                    border: 1px solid #ffffff !important;
                    border-radius: 10px !important;
                    font-family: 'Geist', 'Plus Jakarta Sans', sans-serif !important;
                    font-size: 1rem !important;
                    font-weight: 800 !important;
                    cursor: pointer !important;
                    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4) !important;
                    transition: all 0.2s ease !important;
                    margin-bottom: 12px !important;
                    text-decoration: none !important;
                }

                .btn-yape-white:hover {
                    background: #e4e4e7 !important;
                    border-color: #e4e4e7 !important;
                    transform: translateY(-1px) !important;
                }

                /* Modal Overlay */
                .yape-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    display: none;
                    align-items: center;
                    justify-content: center;
                    z-index: 99999;
                    padding: 16px;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }

                .yape-modal-overlay.active {
                    display: flex;
                    opacity: 1;
                }

                /* Modal Card - Clean Black & White */
                .yape-modal-card {
                    background: #09090b;
                    border: 1px solid #27272a;
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85);
                    border-radius: 16px;
                    width: 100%;
                    max-width: 420px;
                    color: #ffffff;
                    font-family: 'Geist', 'Plus Jakarta Sans', -apple-system, sans-serif;
                    overflow: hidden;
                    position: relative;
                    transform: scale(0.96);
                    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .yape-modal-overlay.active .yape-modal-card {
                    transform: scale(1);
                }

                /* Header */
                .yape-modal-header {
                    padding: 18px 22px;
                    border-bottom: 1px solid #27272a;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .yape-brand-group {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .yape-modal-title {
                    font-size: 1.05rem;
                    font-weight: 700;
                    margin: 0;
                    color: #ffffff;
                    letter-spacing: -0.2px;
                }

                .yape-close-btn {
                    background: transparent;
                    border: 1px solid #27272a;
                    color: #71717a;
                    width: 30px;
                    height: 30px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 1rem;
                    transition: all 0.15s;
                }

                .yape-close-btn:hover {
                    background: #18181b;
                    color: #ffffff;
                    border-color: #3f3f46;
                }

                /* Price summary bar */
                .yape-price-badge-bar {
                    background: #121215;
                    border-bottom: 1px solid #27272a;
                    padding: 12px 22px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .yape-price-label {
                    font-size: 0.82rem;
                    color: #a1a1aa;
                    font-weight: 500;
                }

                .yape-price-highlight {
                    font-size: 1.15rem;
                    font-weight: 800;
                    color: #ffffff;
                    letter-spacing: -0.3px;
                }

                .yape-modal-body {
                    padding: 22px;
                }

                .yape-form-group {
                    margin-bottom: 16px;
                }

                .yape-form-label {
                    display: block;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #a1a1aa;
                    margin-bottom: 6px;
                }

                /* Input Styles - Solid Minimal Dark */
                .yape-input {
                    width: 100% !important;
                    padding: 12px 14px !important;
                    background: #121215 !important;
                    border: 1px solid #27272a !important;
                    border-radius: 8px !important;
                    color: #ffffff !important;
                    font-family: inherit !important;
                    font-size: 0.92rem !important;
                    transition: border-color 0.15s ease !important;
                    outline: none !important;
                    box-sizing: border-box !important;
                }

                .yape-input:focus {
                    background: #18181b !important;
                    border-color: #ffffff !important;
                    color: #ffffff !important;
                }

                .yape-input::placeholder {
                    color: #52525b !important;
                }

                /* Phone Input */
                .yape-input-phone {
                    width: 100% !important;
                    padding: 12px 14px !important;
                    background: #121215 !important;
                    border: 1px solid #27272a !important;
                    border-radius: 8px !important;
                    color: #ffffff !important;
                    font-family: monospace, inherit !important;
                    font-size: 1.05rem !important;
                    font-weight: 700 !important;
                    letter-spacing: 1.5px !important;
                    transition: border-color 0.15s ease !important;
                    outline: none !important;
                    box-sizing: border-box !important;
                }

                .yape-input-phone:focus {
                    background: #18181b !important;
                    border-color: #ffffff !important;
                    color: #ffffff !important;
                }

                .yape-input-phone::placeholder {
                    color: #52525b !important;
                }

                /* 6 OTP Boxes Container */
                .yape-otp-grid {
                    display: grid;
                    grid-template-columns: repeat(6, 1fr);
                    gap: 8px;
                    margin-top: 4px;
                }

                .yape-otp-box {
                    width: 100%;
                    height: 48px;
                    background: #121215;
                    border: 1px solid #27272a;
                    border-radius: 8px;
                    color: #ffffff;
                    font-family: monospace, inherit;
                    font-size: 1.25rem;
                    font-weight: 800;
                    text-align: center;
                    outline: none;
                    transition: all 0.15s ease;
                    box-sizing: border-box;
                    padding: 0;
                }

                .yape-otp-box:focus {
                    background: #18181b;
                    border-color: #ffffff;
                }

                .yape-otp-box.filled {
                    border-color: #52525b;
                    background: #18181b;
                }

                /* Neutralize browser autofill white background */
                .yape-input:-webkit-autofill,
                .yape-input:-webkit-autofill:hover, 
                .yape-input:-webkit-autofill:focus,
                .yape-input:-webkit-autofill:active,
                .yape-input-phone:-webkit-autofill,
                .yape-input-phone:-webkit-autofill:focus {
                    -webkit-text-fill-color: #ffffff !important;
                    -webkit-box-shadow: 0 0 0px 1000px #121215 inset !important;
                    box-shadow: 0 0 0px 1000px #121215 inset !important;
                    transition: background-color 5000s ease-in-out 0s !important;
                }

                /* Minimalist helper guide */
                .yape-otp-guide-clean {
                    margin-top: 8px;
                    font-size: 0.76rem;
                    color: #71717a;
                    line-height: 1.4;
                }

                .yape-otp-guide-clean strong {
                    color: #a1a1aa;
                }

                /* Submit Button (Clean solid white, black bold text) */
                .yape-btn-submit {
                    width: 100%;
                    padding: 14px;
                    background: #ffffff;
                    color: #000000;
                    border: none;
                    border-radius: 8px;
                    font-family: inherit;
                    font-size: 1rem;
                    font-weight: 800;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    margin-top: 20px;
                    transition: all 0.15s ease;
                }

                .yape-btn-submit:hover:not(:disabled) {
                    background: #e4e4e7;
                }

                .yape-btn-submit:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .yape-error-box {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    color: #f87171;
                    border-radius: 8px;
                    padding: 10px 12px;
                    font-size: 0.8rem;
                    margin-top: 12px;
                    display: none;
                    line-height: 1.4;
                }

                /* Loading Spinner */
                .yape-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(0, 0, 0, 0.2);
                    border-top-color: #000000;
                    border-radius: 50%;
                    animation: yapeSpin 0.7s linear infinite;
                    display: inline-block;
                }

                @keyframes yapeSpin {
                    to { transform: rotate(360deg); }
                }

                /* Success View */
                .yape-success-view {
                    text-align: center;
                    padding: 24px 20px;
                    display: none;
                }

                .yape-success-icon-wrap {
                    width: 52px;
                    height: 52px;
                    background: rgba(255, 255, 255, 0.08);
                    border: 1px solid #ffffff;
                    border-radius: 50%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    color: #ffffff;
                    margin-bottom: 14px;
                }

                .yape-license-card {
                    background: #121215;
                    border: 1px solid #27272a;
                    border-radius: 10px;
                    padding: 16px;
                    margin: 16px 0;
                    text-align: center;
                }

                .yape-key-text {
                    font-family: monospace;
                    font-size: 1.15rem;
                    font-weight: 800;
                    color: #ffffff;
                    letter-spacing: 1px;
                    margin: 8px 0;
                    word-break: break-all;
                }

                .yape-btn-copy {
                    background: #ffffff;
                    border: none;
                    color: #000000;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    cursor: pointer;
                    margin-top: 6px;
                    transition: all 0.15s;
                }

                .yape-btn-copy:hover {
                    background: #e4e4e7;
                }

                .yape-download-actions {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-top: 16px;
                }

                .yape-download-btn {
                    padding: 11px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 700;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }

                .yape-download-win {
                    background: #ffffff;
                    color: #000000;
                }

                .yape-download-mac {
                    background: #18181b;
                    border: 1px solid #27272a;
                    color: #ffffff;
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
                                <h3 class="yape-modal-title">Pagar con Yape</h3>
                            </div>
                            <button id="yape-modal-close" class="yape-close-btn" aria-label="Cerrar">&times;</button>
                        </div>

                        <!-- Price Banner -->
                        <div class="yape-price-badge-bar">
                            <span class="yape-price-label">Total a pagar:</span>
                            <span id="yape-modal-price" class="yape-price-highlight">S/. 16.50</span>
                        </div>

                        <!-- Form View -->
                        <div id="yape-form-view" class="yape-modal-body">
                            <form id="yape-checkout-form" onsubmit="return false;">
                                <div class="yape-form-group">
                                    <label class="yape-form-label" for="yape-email">Correo Electrónico</label>
                                    <input type="email" id="yape-email" class="yape-input" placeholder="tu@correo.com" required autocomplete="email">
                                    <span style="font-size:0.72rem; color:#71717a; margin-top:4px; display:block;">Aquí recibirás tu licencia y links de descarga.</span>
                                </div>

                                <div class="yape-form-group">
                                    <label class="yape-form-label" for="yape-phone">Celular Yape</label>
                                    <input type="tel" id="yape-phone" class="yape-input-phone" placeholder="9XX XXX XXX" maxlength="11" required>
                                </div>

                                <div class="yape-form-group">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                        <label class="yape-form-label" style="margin-bottom:0;">Código de aprobación</label>
                                        <span style="font-size:0.72rem; color:#71717a;">6 dígitos</span>
                                    </div>
                                    
                                    <!-- 6 Individual OTP Boxes -->
                                    <div class="yape-otp-grid" id="yape-otp-grid">
                                        <input type="tel" maxlength="1" class="yape-otp-box" data-idx="0" pattern="[0-9]" inputmode="numeric" autocomplete="one-time-code">
                                        <input type="tel" maxlength="1" class="yape-otp-box" data-idx="1" pattern="[0-9]" inputmode="numeric">
                                        <input type="tel" maxlength="1" class="yape-otp-box" data-idx="2" pattern="[0-9]" inputmode="numeric">
                                        <input type="tel" maxlength="1" class="yape-otp-box" data-idx="3" pattern="[0-9]" inputmode="numeric">
                                        <input type="tel" maxlength="1" class="yape-otp-box" data-idx="4" pattern="[0-9]" inputmode="numeric">
                                        <input type="tel" maxlength="1" class="yape-otp-box" data-idx="5" pattern="[0-9]" inputmode="numeric">
                                    </div>

                                    <div class="yape-otp-guide-clean">
                                        Encuéntralo en tu <strong>app Yape &gt; Menú &gt; Código de aprobación</strong>.
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
                            <h2 style="font-size:1.25rem; font-weight:800; margin:0 0 6px;">¡Pago con Yape Exitoso!</h2>
                            <p style="color:#a1a1aa; font-size:0.82rem; margin:0 0 16px;">Tu compra ha sido verificada y tu licencia está lista.</p>

                            <div class="yape-license-card">
                                <span style="font-size:0.72rem; color:#71717a; text-transform:uppercase; letter-spacing:1px; font-weight:700;">🔑 Tu Clave de Activación</span>
                                <div id="yape-success-serial" class="yape-key-text">CARGANDO...</div>
                                <button type="button" id="yape-copy-serial-btn" class="yape-btn-copy">
                                    Copiar Clave
                                </button>
                            </div>

                            <p style="font-size:0.8rem; color:#a1a1aa; margin:0 0 10px; font-weight:600;">📥 Descarga tu plugin:</p>
                            <div class="yape-download-actions">
                                <a id="yape-download-win" href="#" target="_blank" class="yape-download-btn yape-download-win">
                                    Windows (.exe)
                                </a>
                                <a id="yape-download-mac" href="#" target="_blank" class="yape-download-btn yape-download-mac">
                                    macOS (.dmg)
                                </a>
                            </div>

                            <p style="color:#71717a; font-size:0.75rem; margin-top:16px;">
                                Hemos enviado una copia con tus accesos a tu correo.
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
                    btn.innerText = '¡Copiado!';
                    setTimeout(() => {
                        btn.innerText = 'Copiar Clave';
                    }, 2000);
                }
            });
        }

        setupPhoneFormatter() {
            const phoneInput = document.getElementById('yape-phone');
            if (!phoneInput) return;

            phoneInput.addEventListener('input', (e) => {
                let raw = e.target.value.replace(/\D/g, '').substring(0, 9);
                let formatted = '';
                if (raw.length > 0) formatted = raw.substring(0, 3);
                if (raw.length > 3) formatted += ' ' + raw.substring(3, 6);
                if (raw.length > 6) formatted += ' ' + raw.substring(6, 9);
                e.target.value = formatted;
            });
        }

        setupOTPBoxHandlers() {
            const boxes = document.querySelectorAll('.yape-otp-box');
            if (!boxes.length) return;

            boxes.forEach((box, idx) => {
                box.addEventListener('input', (e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    e.target.value = val ? val[0] : '';

                    if (val && idx < boxes.length - 1) {
                        boxes[idx + 1].focus();
                        boxes[idx + 1].select();
                    }
                    this.updateBoxState(boxes);
                });

                box.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !box.value && idx > 0) {
                        boxes[idx - 1].focus();
                        boxes[idx - 1].select();
                    }
                });

                box.addEventListener('paste', (e) => {
                    e.preventDefault();
                    const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').substring(0, 6);
                    if (text) {
                        for (let i = 0; i < text.length && i < boxes.length; i++) {
                            boxes[i].value = text[i];
                        }
                        const nextIdx = Math.min(text.length, boxes.length - 1);
                        boxes[nextIdx].focus();
                        this.updateBoxState(boxes);
                    }
                });

                box.addEventListener('focus', () => box.select());
            });
        }

        updateBoxState(boxes) {
            boxes.forEach(b => {
                if (b.value) b.classList.add('filled');
                else b.classList.remove('filled');
            });
        }

        getOTPValue() {
            const boxes = document.querySelectorAll('.yape-otp-box');
            let otp = '';
            boxes.forEach(b => otp += b.value.trim());
            return otp;
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

            // Clear OTP boxes
            const boxes = document.querySelectorAll('.yape-otp-box');
            boxes.forEach(b => { b.value = ''; b.classList.remove('filled'); });

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
            const otp = this.getOTPValue();

            if (!email || !email.includes('@')) {
                this.showError('Por favor ingresa un correo electrónico válido.');
                return;
            }

            if (phone.length < 9) {
                this.showError('Ingresa un número de celular de 9 dígitos válido.');
                return;
            }

            if (otp.length !== 6) {
                this.showError('Ingresa los 6 dígitos completos del código de aprobación.');
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
                if (!this.mpInstance && window.MercadoPago) {
                    this.initMP();
                }

                if (!this.mpInstance || typeof this.mpInstance.yape !== 'function') {
                    throw new Error('El servicio de Yape no está disponible en este momento. Por favor recarga la página.');
                }

                try {
                    const pricePEN = parseFloat(this.getPricePEN());
                    const yape = this.mpInstance.yape({
                        otp: otp,
                        phoneNumber: phone,
                        amount: pricePEN
                    });
                    const tokenObj = await yape.create();
                    yapeToken = (typeof tokenObj === 'string') ? tokenObj : (tokenObj?.id || tokenObj?.token || tokenObj);
                    console.log('[YapeCheckout] Token created for S/.', pricePEN, '→', typeof yapeToken);
                } catch (sdkErr) {
                    console.error('[YapeCheckout] SDK token error:', sdkErr);
                    let errorMsg = 'El código de aprobación es incorrecto o ha expirado. Revisa tu app de Yape.';
                    if (sdkErr?.message) errorMsg = sdkErr.message;
                    throw new Error(errorMsg);
                }

                if (!yapeToken) {
                    throw new Error('Código de aprobación inválido. Genera uno nuevo en tu app de Yape.');
                }

                submitText.innerHTML = '<span class="yape-spinner"></span> Procesando cobro...';

                // 2. Call backend charge endpoint
                const attribution = (window.MetaPixel && typeof window.MetaPixel.getAttributionData === 'function')
                    ? window.MetaPixel.getAttributionData()
                    : {};

                const isPromo2x1 = Boolean(window.IS_PROMO_2X1 || (this.pluginName && this.pluginName.includes('2x1')));

                const bodyPayload = {
                    token: yapeToken,
                    email: email,
                    phoneNumber: phone,
                    productId: this.productId,
                    pluginName: this.pluginName,
                    isPromo2x1: isPromo2x1,
                    customPrice: this.getPriceUSD(),
                    attribution: attribution
                };

                if (window.YAPE_FIXED_PRICE_PEN) {
                    bodyPayload.customPricePEN = Number(window.YAPE_FIXED_PRICE_PEN);
                }

                const response = await fetch('/api/orders/yape/charge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyPayload)
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
            document.addEventListener('click', (e) => {
                const target = e.target.closest('[data-action="open-yape-checkout"], #btn-yape-checkout, #btn-yape, .btn-yape-trigger, .btn-yape-white, .btn-yape, a[href*="Yape"], a[href*="yape"]');
                if (target) {
                    const href = target.getAttribute('href') || '';
                    if (href.includes('problemas') || href.includes('instalar') || href.includes('soporte') || href.includes('flp') || href.includes('tutorial')) {
                        return;
                    }
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
