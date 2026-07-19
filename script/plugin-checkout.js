/**
 * OFFSZN Plugin Direct Checkout
 * Renders PayPal Smart Buttons directly on the plugin page for immediate checkout,
 * bypassing the global shopping cart.
 */

class PluginDirectCheckout {
    constructor() {
        this.container = document.getElementById('plugin-paypal-button-container');
        this.productId = window.PLUGIN_ID;
        this.paypalInitialized = false;

        this.init();
    }

    init() {
        if (!this.container || !this.productId) {
            console.warn('[PluginCheckout] Missing container (#plugin-paypal-button-container) or window.PLUGIN_ID');
            return;
        }

        // Initialize PayPal SDK loading
        this.loadPayPalSDK();
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

                    if (result.success) {
                        window.location.href = `/pages/success.html?order_id=${data.orderID}`;
                    } else {
                        alert('El pago no pudo completarse. Por favor reintenta.');
                    }
                } catch (err) {
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
}

// Instantiate checkout logic
document.addEventListener('DOMContentLoaded', () => {
    window.pluginDirectCheckout = new PluginDirectCheckout();
});
