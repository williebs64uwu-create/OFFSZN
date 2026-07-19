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

        // Download links based on product ID
        this.downloads = this.productId === 900 ? {
            name: 'Easy Master',
            win: 'https://drive.google.com/file/d/1JF4oDN_beOOxnOO5ca3TLGDCEQyOeWjh/view',
            mac: 'https://drive.google.com/file/d/14Lc6-vOtEYgw7IbQcpBe7h2kIiGTrP6Q/view?usp=sharing'
        } : {
            name: 'Easy Mix',
            win: 'https://drive.google.com/file/d/1WfaTrrbuaxymcFhnHGjmrump_rG-LGUW/view?usp=sharing',
            mac: 'https://drive.google.com/file/d/1o1q0Ca5eghr1CJmtxmOw52MgEXi_wKl9/view?usp=sharing'
        };

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
        // Multi-party/split payment compatibility
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture&merchant-id=*`;
        script.setAttribute('data-merchant-id', 'MXV5F6X8JXG4S,willie2008garay@gmail.com');

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

                    const response = await fetch('/api/orders/paypal/create', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({ directProductId: this.productId })
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

                    const response = await fetch('/api/orders/paypal/capture', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({ 
                            orderID: data.orderID,
                            directProductId: this.productId 
                        })
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
                transition: all 0.3s;
            }
            .plugin-dl-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.2);
                color: #fff;
            }
            .plugin-dl-btn i {
                font-size: 1.15rem;
            }
            .plugin-modal-close-btn {
                width: 100%;
                background: transparent;
                border: 1.5px solid rgba(255, 255, 255, 0.15);
                color: #fff;
                font-weight: 700;
                padding: 14px;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s;
                font-size: 0.95rem;
            }
            .plugin-modal-close-btn:hover {
                background: rgba(255, 255, 255, 0.05);
                border-color: rgba(255, 255, 255, 0.3);
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

        modal.innerHTML = `
            <div class="plugin-modal-card">
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

                <button class="plugin-modal-close-btn" id="plugin-modal-finish-btn">Ir a Mis Compras</button>
            </div>
        `;

        // Bind copy button action
        const copyBtn = modal.querySelector('#plugin-copy-key-btn');
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(serialKey).then(() => {
                copyBtn.innerText = '¡Copiado!';
                copyBtn.style.background = '#10b981'; // Green color for success feedback
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

        // Bind finish button action
        const finishBtn = modal.querySelector('#plugin-modal-finish-btn');
        finishBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            window.location.href = '/mis-compras.html';
        });

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
