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
            const solesMap = { 5: 19, 8: 25, 10: 38, 15: 57, 17: 65, 20: 76, 25: 95 };
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

                /* Modal Card - Clean White High-Trust Banking Style */
                .yape-modal-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.04);
                    border-radius: 20px;
                    width: 100%;
                    max-width: 410px;
                    color: #0f172a;
                    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    overflow: hidden;
                    position: relative;
                    transform: scale(0.96);
                    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    box-sizing: border-box;
                }

                .yape-modal-overlay.active .yape-modal-card {
                    transform: scale(1);
                }

                /* Header */
                .yape-modal-header {
                    padding: 18px 22px;
                    border-bottom: 1px solid #f1f5f9;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: #ffffff;
                }

                .yape-brand-group {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .yape-brand-badge-img {
                    width: 24px;
                    height: 24px;
                    border-radius: 6px;
                    object-fit: contain;
                }

                .yape-modal-title {
                    font-size: 1.08rem;
                    font-weight: 800;
                    margin: 0;
                    color: #0f172a;
                    letter-spacing: -0.3px;
                }

                .yape-close-btn {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    color: #64748b;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 1.1rem;
                    transition: all 0.15s;
                }

                .yape-close-btn:hover {
                    background: #f1f5f9;
                    color: #0f172a;
                    border-color: #cbd5e1;
                }

                .yape-modal-body {
                    padding: 22px 22px 26px;
                    background: #ffffff;
                    box-sizing: border-box;
                }

                .yape-form-group {
                    margin-bottom: 18px;
                    width: 100%;
                    box-sizing: border-box;
                }

                .yape-label-row {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-bottom: 8px;
                }

                .yape-form-label {
                    display: block;
                    font-size: 0.84rem;
                    font-weight: 700;
                    color: #1e293b;
                    margin: 0;
                    letter-spacing: -0.1px;
                }

                .yape-info-circle {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 17px;
                    height: 17px;
                    border-radius: 50%;
                    background: #e2e8f0;
                    color: #475569;
                    font-size: 0.68rem;
                    font-weight: 700;
                    cursor: help;
                    transition: all 0.15s ease;
                }

                .yape-info-circle:hover {
                    background: #cbd5e1;
                    color: #0f172a;
                }

                /* Phone Input Container with +51 prefix - Perfectly Aligned */
                .yape-phone-wrap {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    height: 50px;
                    background: #f8fafc;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 0 14px;
                    box-sizing: border-box;
                    transition: all 0.2s ease;
                }

                .yape-phone-wrap:focus-within {
                    background: #ffffff;
                    border-color: #0f172a;
                    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
                }

                .yape-phone-prefix {
                    color: #475569;
                    font-weight: 700;
                    font-size: 1.02rem;
                    margin-right: 10px;
                    user-select: none;
                    letter-spacing: 0.5px;
                    display: flex;
                    align-items: center;
                }

                .yape-input-phone {
                    flex: 1;
                    width: 100% !important;
                    height: 100% !important;
                    padding: 0 !important;
                    background: transparent !important;
                    border: none !important;
                    color: #0f172a !important;
                    font-family: inherit !important;
                    font-size: 1.02rem !important;
                    font-weight: 700 !important;
                    letter-spacing: 1.5px !important;
                    outline: none !important;
                    box-sizing: border-box !important;
                }

                .yape-input-phone::placeholder {
                    color: #94a3b8 !important;
                    font-weight: 500 !important;
                }

                /* 6 OTP Boxes Grid - Perfectly Aligned to Full Width */
                .yape-otp-grid {
                    display: grid;
                    grid-template-columns: repeat(6, minmax(0, 1fr));
                    gap: 8px;
                    width: 100%;
                    box-sizing: border-box;
                    margin-top: 2px;
                }

                .yape-otp-box {
                    width: 100%;
                    height: 50px;
                    background: #f8fafc;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 12px;
                    color: #0f172a;
                    font-family: inherit;
                    font-size: 1.35rem;
                    font-weight: 800;
                    text-align: center;
                    outline: none;
                    transition: all 0.15s ease;
                    box-sizing: border-box;
                    padding: 0;
                }

                .yape-otp-box:focus {
                    background: #ffffff;
                    border-color: #0f172a;
                    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
                }

                .yape-otp-box.filled {
                    border-color: #64748b;
                    background: #ffffff;
                }

                /* Neutralize browser autofill white background */
                .yape-input:-webkit-autofill,
                .yape-input:-webkit-autofill:hover, 
                .yape-input:-webkit-autofill:focus,
                .yape-input:-webkit-autofill:active,
                .yape-input-phone:-webkit-autofill,
                .yape-input-phone:-webkit-autofill:focus {
                    -webkit-text-fill-color: #0f172a !important;
                    -webkit-box-shadow: 0 0 0px 1000px #f8fafc inset !important;
                    box-shadow: 0 0 0px 1000px #f8fafc inset !important;
                    transition: background-color 5000s ease-in-out 0s !important;
                }

                /* Minimalist helper guide matching native Yape */
                .yape-otp-guide-clean {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    margin-top: 9px;
                    font-size: 0.8rem;
                    color: #64748b;
                    font-weight: 500;
                    line-height: 1.4;
                }

                .yape-otp-guide-clean svg {
                    flex-shrink: 0;
                    stroke: #0284c7;
                }

                /* Email Input - Solid Crisp Light */
                .yape-input {
                    width: 100% !important;
                    height: 50px !important;
                    padding: 0 14px !important;
                    background: #f8fafc !important;
                    border: 1.5px solid #e2e8f0 !important;
                    border-radius: 12px !important;
                    color: #0f172a !important;
                    font-family: inherit !important;
                    font-size: 0.95rem !important;
                    font-weight: 600 !important;
                    transition: all 0.2s ease !important;
                    outline: none !important;
                    box-sizing: border-box !important;
                }

                .yape-input:focus {
                    background: #ffffff !important;
                    border-color: #0f172a !important;
                    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08) !important;
                }

                .yape-input::placeholder {
                    color: #94a3b8 !important;
                    font-weight: 400 !important;
                }

                .yape-field-helper {
                    font-size: 0.76rem;
                    color: #64748b;
                    margin-top: 6px;
                    display: block;
                    line-height: 1.35;
                    font-weight: 400;
                }

                /* Submit Button (Clean solid jet black, bold white text) */
                .yape-btn-submit {
                    width: 100%;
                    height: 52px;
                    background: #0f172a;
                    color: #ffffff;
                    border: none;
                    border-radius: 12px;
                    font-family: inherit;
                    font-size: 1.02rem;
                    font-weight: 800;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    margin-top: 22px;
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    letter-spacing: -0.2px;
                    box-sizing: border-box;
                    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.18);
                }

                .yape-btn-submit:hover:not(:disabled) {
                    background: #000000;
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
                }

                .yape-btn-submit:disabled {
                    background: #e2e8f0;
                    color: #94a3b8;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                .yape-error-box {
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    color: #b91c1c;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    margin-top: 14px;
                    display: none;
                    line-height: 1.4;
                }

                /* Loading Spinner */
                .yape-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: #ffffff;
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
                    background: #ffffff;
                }

                .yape-success-icon-wrap {
                    width: 52px;
                    height: 52px;
                    background: rgba(34, 197, 94, 0.12);
                    border: 2px solid #22c55e;
                    border-radius: 50%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    color: #16a34a;
                    margin-bottom: 14px;
                }

                .yape-license-card {
                    background: #f8fafc;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 16px;
                    margin: 16px 0;
                    text-align: center;
                }

                .yape-key-text {
                    font-family: monospace;
                    font-size: 1.15rem;
                    font-weight: 800;
                    color: #0f172a;
                    letter-spacing: 1px;
                    margin: 8px 0;
                    word-break: break-all;
                }

                .yape-btn-copy {
                    background: #0f172a;
                    border: none;
                    color: #ffffff;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 0.82rem;
                    font-weight: 700;
                    cursor: pointer;
                    margin-top: 6px;
                    transition: all 0.15s;
                }

                .yape-btn-copy:hover {
                    background: #000000;
                }

                .yape-download-actions {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-top: 16px;
                }

                .yape-download-btn {
                    padding: 12px;
                    border-radius: 10px;
                    text-decoration: none;
                    font-weight: 700;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }

                .yape-download-win {
                    background: #0f172a;
                    color: #ffffff;
                }

                .yape-download-mac {
                    background: #f1f5f9;
                    border: 1.5px solid #e2e8f0;
                    color: #0f172a;
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
                                <img src="/images/payments/yape.png" alt="Yape" class="yape-brand-badge-img" onerror="this.style.display='none'">
                                <h3 class="yape-modal-title">Pagar con Yape</h3>
                            </div>
                            <button id="yape-modal-close" class="yape-close-btn" aria-label="Cerrar">&times;</button>
                        </div>

                        <!-- Form View -->
                        <div id="yape-form-view" class="yape-modal-body">
                            <form id="yape-checkout-form" onsubmit="return false;">
                                <!-- 1. Celular Yape -->
                                <div class="yape-form-group">
                                    <div class="yape-label-row">
                                        <label class="yape-form-label" for="yape-phone">Ingresa tu celular Yape</label>
                                        <span class="yape-info-circle" title="Número de celular registrado en tu cuenta de Yape">?</span>
                                    </div>
                                    <div class="yape-phone-wrap">
                                        <span class="yape-phone-prefix">+51</span>
                                        <input type="tel" id="yape-phone" name="yape_phone" class="yape-input-phone" placeholder="000 000 000" maxlength="11" required autocomplete="tel">
                                    </div>
                                </div>

                                <!-- 2. Código de aprobación -->
                                <div class="yape-form-group">
                                    <div class="yape-label-row">
                                        <label class="yape-form-label" for="yape-otp-0">Código de aprobación</label>
                                    </div>
                                    
                                    <!-- 6 Individual OTP Boxes -->
                                    <div class="yape-otp-grid" id="yape-otp-grid">
                                        <input type="tel" id="yape-otp-0" name="yape_otp_0" maxlength="1" class="yape-otp-box" data-idx="0" pattern="[0-9]" inputmode="numeric" autocomplete="one-time-code" aria-label="Dígito 1 del código">
                                        <input type="tel" id="yape-otp-1" name="yape_otp_1" maxlength="1" class="yape-otp-box" data-idx="1" pattern="[0-9]" inputmode="numeric" aria-label="Dígito 2 del código">
                                        <input type="tel" id="yape-otp-2" name="yape_otp_2" maxlength="1" class="yape-otp-box" data-idx="2" pattern="[0-9]" inputmode="numeric" aria-label="Dígito 3 del código">
                                        <input type="tel" id="yape-otp-3" name="yape_otp_3" maxlength="1" class="yape-otp-box" data-idx="3" pattern="[0-9]" inputmode="numeric" aria-label="Dígito 4 del código">
                                        <input type="tel" id="yape-otp-4" name="yape_otp_4" maxlength="1" class="yape-otp-box" data-idx="4" pattern="[0-9]" inputmode="numeric" aria-label="Dígito 5 del código">
                                        <input type="tel" id="yape-otp-5" name="yape_otp_5" maxlength="1" class="yape-otp-box" data-idx="5" pattern="[0-9]" inputmode="numeric" aria-label="Dígito 6 del código">
                                    </div>

                                    <div class="yape-otp-guide-clean">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                        <span>Encuéntralo en el menú de Yape.</span>
                                    </div>
                                </div>

                                <!-- 3. Correo Electrónico (al final) -->
                                <div class="yape-form-group">
                                    <label class="yape-form-label" for="yape-email">Correo Electrónico</label>
                                    <input type="email" id="yape-email" name="yape_email" class="yape-input" placeholder="tu@correo.com" required autocomplete="email">
                                    <span class="yape-field-helper">Aquí recibirás tu licencia y links de descarga.</span>
                                </div>

                                <div id="yape-error-box" class="yape-error-box"></div>

                                <button type="submit" id="yape-submit-btn" class="yape-btn-submit">
                                    <span id="yape-submit-text">Yapear S/ 65.00</span>
                                </button>
                            </form>
                        </div>

                        <!-- Success View -->
                        <div id="yape-success-view" class="yape-success-view">
                            <div class="yape-success-icon-wrap">
                                <i class="bi bi-check-lg"></i>
                            </div>
                            <h2 style="font-size:1.25rem; font-weight:800; margin:0 0 6px; color:#0f172a;">¡Pago con Yape Exitoso!</h2>
                            <p style="color:#64748b; font-size:0.82rem; margin:0 0 16px;">Tu compra ha sido verificada y tu licencia está lista.</p>

                            <div class="yape-license-card">
                                <span style="font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:1px; font-weight:700;">🔑 Tu Clave de Activación</span>
                                <div id="yape-success-serial" class="yape-key-text">CARGANDO...</div>
                                <button type="button" id="yape-copy-serial-btn" class="yape-btn-copy">
                                    Copiar Clave
                                </button>
                            </div>

                            <p style="font-size:0.8rem; color:#475569; margin:0 0 10px; font-weight:600;">📥 Descarga tu plugin:</p>
                            <div class="yape-download-actions">
                                <a id="yape-download-win" href="#" target="_blank" class="yape-download-btn yape-download-win">
                                    Windows (.exe)
                                </a>
                                <a id="yape-download-mac" href="#" target="_blank" class="yape-download-btn yape-download-mac">
                                    macOS (.dmg)
                                </a>
                            </div>

                            <p style="color:#64748b; font-size:0.75rem; margin-top:16px;">
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
                let raw = e.target.value.replace(/\D/g, '');
                if (raw.length === 11 && raw.startsWith('51')) {
                    raw = raw.substring(2);
                }
                raw = raw.substring(0, 9);

                let formatted = '';
                if (raw.length > 0) formatted = raw.substring(0, 3);
                if (raw.length > 3) formatted += ' ' + raw.substring(3, 6);
                if (raw.length > 6) formatted += ' ' + raw.substring(6, 9);
                e.target.value = formatted;

                // Auto-advance to OTP when 9 digits are typed
                if (raw.length === 9) {
                    const firstOtp = document.getElementById('yape-otp-0');
                    if (firstOtp && !firstOtp.value) {
                        firstOtp.focus();
                        firstOtp.select();
                    }
                }
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
                    } else if (val && idx === boxes.length - 1) {
                        // Auto-advance to email when 6th OTP digit is completed
                        const emailInput = document.getElementById('yape-email');
                        if (emailInput && !emailInput.value) {
                            emailInput.focus();
                        }
                    }
                    this.updateBoxState(boxes);
                });

                box.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !box.value && idx > 0) {
                        boxes[idx - 1].focus();
                        boxes[idx - 1].select();
                    } else if (e.key === 'ArrowLeft' && idx > 0) {
                        boxes[idx - 1].focus();
                        boxes[idx - 1].select();
                    } else if (e.key === 'ArrowRight' && idx < boxes.length - 1) {
                        boxes[idx + 1].focus();
                        boxes[idx + 1].select();
                    }
                });

                box.addEventListener('paste', (e) => {
                    e.preventDefault();
                    const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').substring(0, 6);
                    if (text) {
                        const startIdx = (text.length >= 6) ? 0 : idx;
                        for (let i = 0; i < text.length && (startIdx + i) < boxes.length; i++) {
                            boxes[startIdx + i].value = text[i];
                        }
                        const nextIdx = Math.min(startIdx + text.length, boxes.length - 1);
                        boxes[nextIdx].focus();
                        this.updateBoxState(boxes);
                        if (text.length >= 6) {
                            const emailInput = document.getElementById('yape-email');
                            if (emailInput && !emailInput.value) emailInput.focus();
                        }
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
            const priceEl = document.getElementById('yape-modal-price');
            if (priceEl) priceEl.innerText = `S/. ${pricePEN}`;
            
            const submitText = document.getElementById('yape-submit-text');
            if (submitText) submitText.innerText = `Yapear S/ ${pricePEN}`;

            // Reset views
            document.getElementById('yape-form-view').style.display = 'block';
            document.getElementById('yape-success-view').style.display = 'none';
            this.hideError();

            // Clear OTP boxes
            const boxes = document.querySelectorAll('.yape-otp-box');
            boxes.forEach(b => { b.value = ''; b.classList.remove('filled'); });

            this.modalElement.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Auto focus phone since it's the first field now
            const phoneInput = document.getElementById('yape-phone');
            if (phoneInput) setTimeout(() => phoneInput.focus(), 100);
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

                let deviceId = null;
                try {
                    deviceId = window.MP_DEVICE_SESSION_ID || (window.MercadoPago && window.MercadoPago.device_id) || null;
                } catch (e) {}

                const currentAffiliate = window.OFFSZN_AFFILIATE || localStorage.getItem('offszn_ref') || null;

                const bodyPayload = {
                    token: yapeToken,
                    email: email,
                    phoneNumber: phone,
                    productId: this.productId,
                    pluginName: this.pluginName,
                    isPromo2x1: isPromo2x1,
                    customPrice: this.getPriceUSD(),
                    affiliate: currentAffiliate,
                    attribution: attribution,
                    deviceId: deviceId
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
                submitText.innerText = `Yapear S/ ${this.getPricePEN()}`;
            }
        }

        renderSuccess(data) {
            document.getElementById('yape-form-view').style.display = 'none';
            const successView = document.getElementById('yape-success-view');
            successView.style.display = 'block';

            const isPromo2x1 = Boolean(data.isPromo2x1 || data.bonusSerialKey || window.IS_PROMO_2X1);

            if (isPromo2x1 && (data.bonusSerialKey || data.serialKey)) {
                const mixKey = data.serialKey || 'Activo en tu cuenta';
                const masterKey = data.bonusSerialKey || 'Activo en tu cuenta';

                successView.innerHTML = `
                    <div class="yape-success-icon-wrap" style="border-color:#f59e0b; color:#d97706; background:rgba(245,158,11,0.12);">
                        <i class="bi bi-gift-fill"></i>
                    </div>
                    <h2 style="font-size:1.25rem; font-weight:800; margin:0 0 6px; color:#0f172a;">¡Promo 2x1 Activada! 🎁</h2>
                    <p style="color:#64748b; font-size:0.82rem; margin:0 0 16px;">Tus 2 licencias vitalicias han sido generadas con éxito.</p>

                    <!-- KEY 1: EASY MIX -->
                    <div class="yape-license-card" style="margin-bottom:12px; border-color:#e2e8f0; background:#f8fafc;">
                        <span style="font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:1px; font-weight:700;">1. Clave Easy Mix VST</span>
                        <div class="yape-key-text" style="font-size:0.95rem; color:#0f172a;">${mixKey}</div>
                        <button type="button" class="yape-btn-copy" onclick="navigator.clipboard.writeText('${mixKey}'); this.innerText='¡Copiado!'; setTimeout(()=>this.innerText='Copiar Clave', 2000)">
                            Copiar Clave
                        </button>
                    </div>

                    <!-- KEY 2: EASY MASTER -->
                    <div class="yape-license-card" style="margin-bottom:16px; border-color:#fed7aa; background:#fffbeb;">
                        <span style="font-size:0.72rem; color:#d97706; text-transform:uppercase; letter-spacing:1px; font-weight:800;">2. Clave Easy Master VST (REGALO)</span>
                        <div class="yape-key-text" style="font-size:0.95rem; color:#b45309;">${masterKey}</div>
                        <button type="button" class="yape-btn-copy" style="background:#d97706; color:#ffffff;" onclick="navigator.clipboard.writeText('${masterKey}'); this.innerText='¡Copiado!'; setTimeout(()=>this.innerText='Copiar Clave', 2000)">
                            Copiar Clave
                        </button>
                    </div>

                    <p style="font-size:0.8rem; color:#475569; margin:0 0 8px; font-weight:600;">📥 Descargar Easy Mix:</p>
                    <div class="yape-download-actions" style="margin-bottom:12px;">
                        <a href="https://drive.google.com/file/d/1FXEF4CsSlClVKTZ8lzfq7027-4Pa-Jh1/view?usp=sharing" target="_blank" class="yape-download-btn yape-download-win">Windows</a>
                        <a href="https://drive.google.com/file/d/1Wd_NgGsuc_FG6kjQOTjnF0qIodnK-iO4/view?usp=sharing" target="_blank" class="yape-download-btn yape-download-mac">macOS</a>
                    </div>

                    <p style="font-size:0.8rem; color:#d97706; margin:0 0 8px; font-weight:600;">📥 Descargar Easy Master:</p>
                    <div class="yape-download-actions">
                        <a href="https://drive.google.com/file/d/1JF4oDN_beOOxnOO5ca3TLGDCEQyOeWjh/view" target="_blank" class="yape-download-btn yape-download-win">Windows</a>
                        <a href="https://drive.google.com/file/d/14Lc6-vOtEYgw7IbQcpBe7h2kIiGTrP6Q/view?usp=sharing" target="_blank" class="yape-download-btn yape-download-mac">macOS</a>
                    </div>

                    <p style="color:#64748b; font-size:0.75rem; margin-top:16px;">
                        Hemos enviado una copia con ambas licencias e instaladores a tu correo.
                    </p>
                `;
            } else {
                document.getElementById('yape-success-serial').innerText = data.serialKey || 'Activo en tu cuenta';

                if (data.downloads) {
                    if (data.downloads.win) document.getElementById('yape-download-win').href = data.downloads.win;
                    if (data.downloads.mac) document.getElementById('yape-download-mac').href = data.downloads.mac;
                }
            }

            // Track Meta Pixel Purchase
            if (window.MetaPixel && typeof window.MetaPixel.trackPurchase === 'function') {
                const pluginCode = isPromo2x1 ? 'promo_2x1' : (this.pluginName ? this.pluginName.toLowerCase().replace(/\s+/g, '_') : 'easy_mix');
                const pluginLabel = isPromo2x1 ? 'Promo 2x1 (Easy Mix + Easy Master)' : ((this.pluginName || 'Easy Mix') + ' VST');
                window.MetaPixel.trackPurchase({
                    content_ids: [pluginCode],
                    content_name: pluginLabel,
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
