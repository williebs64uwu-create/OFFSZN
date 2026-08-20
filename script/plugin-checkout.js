/**
 * OFFSZN Plugin Direct Checkout
 * Renders PayPal Smart Buttons directly on the plugin page for immediate checkout,
 * bypassing the global shopping cart, and displays a premium success modal with the serial key.
 */

class PluginDirectCheckout {
    constructor() {
        this.container = document.getElementById('plugin-paypal-button-container');
        this.productId = window.PLUGIN_ID;
        this.paypalInitialized = false;

        // Download links based on product ID / name
        const isCoke = this.productId === 903 || window.PLUGIN_NAME === 'Coca-Cola' || window.PLUGIN_NAME === 'COCA COLA';
        const isMaster = this.productId === 900 || window.PLUGIN_NAME === 'Easy Master';
        const isInka = this.productId === 902 || window.PLUGIN_NAME === 'INKA KOLA' || window.PLUGIN_NAME === 'Inka Kola';

        if (isCoke) {
            this.downloads = {
                name: 'Coca-Cola',
                win: '/downloads/OFFSZN_COCA_COLA_Setup.exe',
                mac: 'https://drive.google.com/file/d/14Lc6-vOtEYgw7IbQcpBe7h2kIiGTrP6Q/view?usp=sharing'
            };
        } else if (isInka) {
            this.downloads = {
                name: 'Inka Kola',
                win: '/installer_output/INKA_KOLA_Setup.exe',
                mac: 'https://drive.google.com/file/d/14Lc6-vOtEYgw7IbQcpBe7h2kIiGTrP6Q/view?usp=sharing'
            };
        } else if (isMaster) {
            this.downloads = {
                name: 'Easy Master',
                win: 'https://drive.google.com/file/d/1JF4oDN_beOOxnOO5ca3TLGDCEQyOeWjh/view',
                mac: 'https://drive.google.com/file/d/14Lc6-vOtEYgw7IbQcpBe7h2kIiGTrP6Q/view?usp=sharing'
            };
        } else {
            this.downloads = {
                name: 'Easy Mix',
                win: 'https://drive.google.com/file/d/12UsLyKVAmk7AdVCvXDQJL-COWXqeGUbe/view?usp=sharing',
                mac: 'https://drive.google.com/file/d/1OUMuGr4trI7M5J0JvaLc-4n5xaTyN17z/view?usp=sharing'
            };
        }

        this.init();
    }

    init() {
        if (!this.container || !this.productId) {
            console.warn('[PluginCheckout] Missing container (#plugin-paypal-button-container) or window.PLUGIN_ID');
            return;
        }

        // Initialize PayPal SDK loading
        this.loadPayPalSDK();
        this.injectModalCSS();
    }

    async loadPayPalSDK() {
        // Prevent loading multiple instances
        if (document.getElementById('paypal-sdk-plugin-direct')) {
            this.renderPayPalButtons();
            return;
        }

        const clientId = window.PAYPAL_CLIENT_ID || '';
        if (!clientId) {
            console.error('[PluginCheckout] PayPal Client ID not found');
            return;
        }

        // Create elegant loading skeleton if not present
        if (!this.container.querySelector('.skeleton-container')) {
            this.container.innerHTML = `
                <div class="skeleton-container" style="display: flex; flex-direction: column; gap: 12px; margin-top: 15px; width: 100%;">
                    <div class="skeleton" style="width: 100%; height: 48px; border-radius: 8px; background: rgba(255,255,255,0.05); animation: pulse 1.5s infinite ease-in-out;"></div>
                    <div class="skeleton" style="width: 100%; height: 48px; border-radius: 8px; background: rgba(255,255,255,0.05); animation: pulse 1.5s infinite ease-in-out;"></div>
                </div>
                <style>
                    @keyframes pulse {
                        0% { opacity: 0.6; }
                        50% { opacity: 0.3; }
                        100% { opacity: 0.6; }
                    }
                </style>
            `;
        }

        const script = document.createElement('script');
        script.id = 'paypal-sdk-plugin-direct';
        // Use merchant-id to match your PayPal account MXV5F6X8JXG4S
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture&merchant-id=MXV5F6X8JXG4S`;
        script.setAttribute('data-merchant-id', 'MXV5F6X8JXG4S');

        script.onload = () => this.renderPayPalButtons();
        document.head.appendChild(script);
    }

    renderPayPalButtons() {
        if (!window.paypal || !this.container) return;

        window.paypal.Buttons({
            createOrder: async () => {
                try {
                    const token = window.AuthUtils && typeof window.AuthUtils.getSession === 'function' 
                        ? (await window.AuthUtils.getSession())?.access_token 
                        : null;

                    const headers = { 'Content-Type': 'application/json' };
                    if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                    }

                    const createPayload = { directProductId: this.productId };
                    if (window.CURRENT_PROMO_PRICE) {
                        createPayload.customPrice = window.CURRENT_PROMO_PRICE;
                    }

                    const response = await fetch('/api/orders/paypal/create', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(createPayload)
                    });

                    if (!response.ok) {
                        const errData = await response.json();
                        throw new Error(errData.error || 'Error al iniciar pago');
                    }

                    const data = await response.json();
                    return data.id;
                } catch (err) {
                    console.error('[PluginCheckout] Create Order Error:', err);
                    alert('Error al iniciar el pago: ' + err.message);
                    throw err;
                }
            },
            onApprove: async (data) => {
                try {
                    // Show spinner or modal loading state
                    this.showProcessingState();

                    const token = window.AuthUtils && typeof window.AuthUtils.getSession === 'function' 
                        ? (await window.AuthUtils.getSession())?.access_token 
                        : null;

                    const headers = { 'Content-Type': 'application/json' };
                    if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                    }

                    const capturePayload = { 
                        orderID: data.orderID,
                        directProductId: this.productId 
                    };
                    if (window.CURRENT_PROMO_PRICE) {
                        capturePayload.customPrice = window.CURRENT_PROMO_PRICE;
                    }

                    const response = await fetch('/api/orders/paypal/capture', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(capturePayload)
                    });

                    if (!response.ok) {
                        const errData = await response.json();
                        throw new Error(errData.error || 'Error al procesar pago');
                    }

                    const result = await response.json();

                    if (result.status === 'COMPLETED' || result.status === 'APPROVED' || result.id) {
                        // Display the premium success modal with the generated key!
                        const key = result.generatedLicenseKey || 'EASY-FULL-XXXX-XXXX';
                        this.showSuccessModal(key);
                    } else {
                        this.hideProcessingState();
                        alert('El pago no pudo completarse. Por favor reintenta.');
                    }
                } catch (err) {
                    this.hideProcessingState();
                    console.error('[PluginCheckout] Capture Error:', err);
                    alert('Error al capturar el pago: ' + err.message);
                }
            },
            onError: (err) => {
                console.error('[PluginCheckout] PayPal Error:', err);
            },
            style: {
                layout: 'vertical',
                color: 'gold',
                shape: 'rect',
                label: 'pay'
            }
        }).render('#plugin-paypal-button-container').then(() => {
            // Hide skeleton container once buttons render
            const skeletons = this.container.querySelector('.skeleton-container');
            if (skeletons) skeletons.style.display = 'none';
        });

        this.paypalInitialized = true;
    }

    injectModalCSS() {
        if (document.getElementById('plugin-success-modal-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'plugin-success-modal-styles';
        styles.innerHTML = `
            #plugin-paypal-button-container {
                background: #ffffff;
                padding: 14px 12px 6px;
                border-radius: 14px;
                margin-top: 14px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                box-sizing: border-box;
                width: 100%;
                transition: all 0.3s ease;
            }
            #plugin-paypal-button-container iframe {
                color-scheme: light !important;
            }
            .paypal-button-card-fields-container,
            .paypal-card {
                background: #ffffff !important;
                color: #111111 !important;
            }
            .plugin-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(12px);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.4s ease;
            }
            .plugin-modal-overlay.active {
                opacity: 1;
                pointer-events: auto;
            }
            .plugin-modal-card {
                background: #0d0d0d;
                border: 1.5px solid rgba(255, 159, 10, 0.25);
                border-radius: 24px;
                padding: 40px;
                max-width: 520px;
                width: 90%;
                text-align: center;
                box-shadow: 0 30px 60px rgba(0, 0, 0, 0.7), 0 0 100px rgba(255, 159, 10, 0.05);
                transform: scale(0.92);
                transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                position: relative;
                color: #fff;
                overflow: visible;
            }
            .plugin-modal-overlay.active .plugin-modal-card {
                transform: scale(1);
            }
            .plugin-modal-success-icon {
                width: 72px;
                height: 72px;
                background: rgba(255, 159, 10, 0.1);
                border: 2px solid #ff9f0a;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 24px;
                color: #ff9f0a;
                font-size: 2.2rem;
                box-shadow: 0 0 25px rgba(255, 159, 10, 0.2);
                animation: scaleIn 0.5s ease;
            }
            @keyframes scaleIn {
                0% { transform: scale(0); }
                100% { transform: scale(1); }
            }
            .plugin-modal-title {
                font-size: 1.8rem;
                font-weight: 800;
                margin-bottom: 12px;
                background: linear-gradient(135deg, #fff 30%, #ff9f0a 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .plugin-modal-desc {
                color: #aaa;
                font-size: 0.95rem;
                line-height: 1.6;
                margin-bottom: 28px;
            }
            .plugin-key-container {
                background: rgba(255, 255, 255, 0.03);
                border: 1px dashed rgba(255, 159, 10, 0.4);
                border-radius: 12px;
                padding: 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 30px;
                font-family: monospace;
            }
            .plugin-key-value {
                font-size: 1.15rem;
                font-weight: 700;
                letter-spacing: 1px;
                color: #ff9f0a;
                word-break: break-all;
            }
            .plugin-copy-btn {
                background: #ff9f0a;
                color: #000;
                border: none;
                border-radius: 8px;
                padding: 8px 16px;
                font-weight: 700;
                font-size: 0.85rem;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
            }
            .plugin-copy-btn:hover {
                background: #ffa826;
                transform: translateY(-1px);
            }
            .plugin-copy-btn:active {
                transform: translateY(0);
            }
            .plugin-download-section {
                border-top: 1px solid rgba(255,255,255,0.08);
                padding-top: 24px;
                margin-bottom: 30px;
            }
            .plugin-download-title {
                font-size: 0.85rem;
                text-transform: uppercase;
                letter-spacing: 2px;
                color: #888;
                font-weight: 700;
                margin-bottom: 16px;
            }
            .plugin-download-buttons {
                display: flex;
                gap: 12px;
                justify-content: center;
            }
            .plugin-dl-btn {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #fff;
                padding: 12px;
                border-radius: 12px;
                text-decoration: none;
                font-weight: 600;
                font-size: 0.9rem;
            }
            .plugin-dl-btn i {
                font-size: 1.15rem;
            }
            .plugin-modal-close-x {
                position: absolute;
                top: 14px;
                right: 16px;
                background: transparent;
                border: none;
                color: #555;
                font-size: 1.2rem;
                cursor: pointer;
                line-height: 1;
                padding: 4px;
            }
            /* Processing Overlay Style */
            .plugin-processing-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.9);
                backdrop-filter: blur(8px);
                z-index: 10001;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
                color: #fff;
            }
            .plugin-processing-overlay.active {
                opacity: 1;
                pointer-events: auto;
            }
            .plugin-spinner {
                width: 50px;
                height: 50px;
                border: 3px solid rgba(255, 159, 10, 0.1);
                border-top-color: #ff9f0a;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(styles);
    }

    showProcessingState() {
        let overlay = document.getElementById('plugin-processing-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'plugin-processing-overlay';
            overlay.className = 'plugin-processing-overlay';
            overlay.innerHTML = `
                <div class="plugin-spinner"></div>
                <h3 style="font-weight: 700; margin: 0 0 8px;">Procesando Pago...</h3>
                <p style="color: #888; font-size: 0.9rem; margin: 0;">Por favor no cierres ni recargues esta pestaña</p>
            `;
            document.body.appendChild(overlay);
        }
        overlay.classList.add('active');
    }

    hideProcessingState() {
        const overlay = document.getElementById('plugin-processing-overlay');
        if (overlay) overlay.classList.remove('active');
    }

    showSuccessModal(serialKey) {
        this.hideProcessingState();

        let modal = document.getElementById('plugin-success-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'plugin-success-modal';
            modal.className = 'plugin-modal-overlay';
            document.body.appendChild(modal);
        }

        // Check if we received multiple keys (e.g. "Easy Mix: KEY1 | Easy Master (REGALO): KEY2")
        const isMultiKey = serialKey.includes(' | ');
        let modalHtml = '';

        if (isMultiKey) {
            const keyParts = serialKey.split(' | ');
            const licenses = keyParts.map(part => {
                const parts = part.split(': ');
                return {
                    name: parts[0] || 'Plugin',
                    key: parts[1] || part
                };
            });

            // Links configuration for 2x1 combo
            const mixLinks = {
                win: 'https://drive.google.com/file/d/12UsLyKVAmk7AdVCvXDQJL-COWXqeGUbe/view?usp=sharing',
                mac: 'https://drive.google.com/file/d/1OUMuGr4trI7M5J0JvaLc-4n5xaTyN17z/view?usp=sharing'
            };
            const masterLinks = {
                win: 'https://drive.google.com/file/d/1JF4oDN_beOOxnOO5ca3TLGDCEQyOeWjh/view',
                mac: 'https://drive.google.com/file/d/14Lc6-vOtEYgw7IbQcpBe7h2kIiGTrP6Q/view?usp=sharing'
            };

            let keysMarkup = '';
            licenses.forEach((lic, idx) => {
                keysMarkup += `
                    <div style="text-align: left; margin-bottom: 15px;">
                        <span style="font-size: 0.8rem; font-weight: 700; color: #ff9f0a; text-transform: uppercase; letter-spacing: 1px;">${lic.name}</span>
                        <div class="plugin-key-container" style="margin-top: 6px; margin-bottom: 0; padding: 12px 16px;">
                            <span class="plugin-key-value" style="font-size: 0.95rem;">${lic.key}</span>
                            <button class="plugin-copy-btn btn-copy-multi" data-key="${lic.key}" style="padding: 6px 12px; font-size: 0.8rem;">Copiar</button>
                        </div>
                    </div>
                `;
            });

            modalHtml = `
                <div class="plugin-modal-card" style="max-width: 520px;">
                    <button class="plugin-modal-close-x" id="plugin-modal-close-x" title="Cerrar">&times;</button>
                    <div class="plugin-modal-success-icon">
                        <i class="bi bi-check-lg"></i>
                    </div>
                    <h2 class="plugin-modal-title">¡Compra Completada!</h2>
                    <p class="plugin-modal-desc" style="margin-bottom: 20px;">
                        ¡Gracias por tu compra! Aquí tienes tus Serial Keys de por vida listas para activar en tu DAW:
                    </p>

                    ${keysMarkup}

                    <!-- MIX DOWNLOADS -->
                    <div class="plugin-download-section" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 18px; margin-top: 20px; text-align: left;">
                        <h3 class="plugin-download-title" style="margin-bottom: 10px; font-size: 0.72rem;">Instaladores Easy Mix</h3>
                        <div class="plugin-download-buttons">
                            <a href="${mixLinks.win}" class="plugin-dl-btn" target="_blank" rel="noopener noreferrer" style="padding: 10px; font-size: 0.85rem;">
                                <i class="bi bi-windows" style="color: #0078d4;"></i> Windows
                            </a>
                            <a href="${mixLinks.mac}" class="plugin-dl-btn" target="_blank" rel="noopener noreferrer" style="padding: 10px; font-size: 0.85rem;">
                                <i class="bi bi-apple"></i> macOS
                            </a>
                        </div>
                    </div>

                    <!-- MASTER DOWNLOADS -->
                    <div class="plugin-download-section" style="border-top: none; padding-top: 12px; margin-top: 5px; text-align: left;">
                        <h3 class="plugin-download-title" style="margin-bottom: 10px; font-size: 0.72rem;">Instaladores Easy Master</h3>
                        <div class="plugin-download-buttons">
                            <a href="${masterLinks.win}" class="plugin-dl-btn" target="_blank" rel="noopener noreferrer" style="padding: 10px; font-size: 0.85rem;">
                                <i class="bi bi-windows" style="color: #0078d4;"></i> Windows
                            </a>
                            <a href="${masterLinks.mac}" class="plugin-dl-btn" target="_blank" rel="noopener noreferrer" style="padding: 10px; font-size: 0.85rem;">
                                <i class="bi bi-apple"></i> macOS
                            </a>
                        </div>
                    </div>
                </div>
            `;
        } else {
            modalHtml = `
                <div class="plugin-modal-card">
                    <button class="plugin-modal-close-x" id="plugin-modal-close-x" title="Cerrar">&times;</button>
                    <div class="plugin-modal-success-icon">
                        <i class="bi bi-check-lg"></i>
                    </div>
                    <h2 class="plugin-modal-title">¡Compra Completada!</h2>
                    <p class="plugin-modal-desc">
                        ¡Gracias por adquirir <b>${this.downloads.name}</b>! Aquí tienes tu Serial Key FULL para activar el plugin en tu DAW:
                    </p>

                    <div class="plugin-key-container">
                        <span class="plugin-key-value" id="plugin-serial-key-text">${serialKey}</span>
                        <button class="plugin-copy-btn" id="plugin-copy-key-btn">Copiar</button>
                    </div>

                    <div class="plugin-download-section">
                        <h3 class="plugin-download-title">Descargar instaladores</h3>
                        <div class="plugin-download-buttons">
                            <a href="${this.downloads.win}" class="plugin-dl-btn" target="_blank" rel="noopener noreferrer">
                                <i class="bi bi-windows" style="color: #0078d4;"></i> Windows
                            </a>
                            <a href="${this.downloads.mac}" class="plugin-dl-btn" target="_blank" rel="noopener noreferrer">
                                <i class="bi bi-apple"></i> macOS
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }

        modal.innerHTML = modalHtml;

        // Bind X close button
        const closeX = modal.querySelector('#plugin-modal-close-x');
        closeX.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        // Bind copy button(s)
        if (isMultiKey) {
            const copyButtons = modal.querySelectorAll('.btn-copy-multi');
            copyButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const textToCopy = btn.getAttribute('data-key');
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        btn.innerText = 'Copiado';
                        btn.style.background = '#10b981';
                        btn.style.color = '#fff';
                        setTimeout(() => {
                            btn.innerText = 'Copiar';
                            btn.style.background = '#ff9f0a';
                            btn.style.color = '#000';
                        }, 2000);
                    }).catch(err => {
                        console.error('Copy failed:', err);
                    });
                });
            });
        } else {
            const copyBtn = modal.querySelector('#plugin-copy-key-btn');
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(serialKey).then(() => {
                    copyBtn.innerText = '¡Copiado!';
                    copyBtn.style.background = '#10b981';
                    copyBtn.style.color = '#fff';
                    setTimeout(() => {
                        copyBtn.innerText = 'Copiar';
                        copyBtn.style.background = '#ff9f0a';
                        copyBtn.style.color = '#000';
                    }, 2000);
                }).catch(err => {
                    console.error('Copy failed:', err);
                });
            });
        }

        // Activate the modal display
        setTimeout(() => {
            modal.classList.add('active');
        }, 100);
    }
}

// Instantiate checkout logic
document.addEventListener('DOMContentLoaded', () => {
    window.pluginDirectCheckout = new PluginDirectCheckout();
});
