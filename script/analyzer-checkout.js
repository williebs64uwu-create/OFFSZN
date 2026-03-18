/**
 * Analyzer Checkout Logic
 * Dedicated script for X Flow - Analyzer purchase flow.
 */

class AnalyzerCheckout {
    constructor() {
        this.modal = document.getElementById('analyzer-checkout-modal');
        this.closeBtn = this.modal?.querySelector('.close-modal');
        this.paypalContainer = document.getElementById('analyzer-paypal-button-container');
        this.buyButtons = document.querySelectorAll('.btn-buy-analyzer, .btn-buy-nav');
        
        this.init();
    }

    init() {
        if (!this.modal) return;

        // Open Modal
        this.buyButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openModal();
            });
        });

        // Close Modal
        this.closeBtn?.addEventListener('click', () => this.closeModal());
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        // Initialize PayPal if SDK is loaded
        this.checkPayPalSDK();
    }

    openModal() {
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        if (!window.paypal) {
            this.loadPayPalSDK();
        } else if (!this.paypalInitialized) {
            this.renderPayPalButtons();
        }
    }

    closeModal() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    checkPayPalSDK() {
        if (window.paypal && !this.paypalInitialized) {
            this.renderPayPalButtons();
        }
    }

    async loadPayPalSDK() {
        if (document.getElementById('paypal-sdk-analyzer')) return;

        const clientId = window.PAYPAL_CLIENT_ID || '';
        if (!clientId) {
            console.error('[Analyzer] No PayPal Client ID found');
            return;
        }

        const script = document.createElement('script');
        script.id = 'paypal-sdk-analyzer';
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture&merchant-id=MXV5F6X8JXG4S`; 
        // Note: The merchant-id in the SDK URL is for the "platform" side of multiparty if needed, 
        // but here we are doing simple direct multi-payee in the backend. 
        // Actually, just the client-id is enough for the buttons to show.
        
        script.onload = () => this.renderPayPalButtons();
        document.head.appendChild(script);
    }

    renderPayPalButtons() {
        if (!window.paypal || !this.paypalContainer) return;

        window.paypal.Buttons({
            createOrder: async () => {
                try {
                    const response = await fetch('/api/analyzer/create-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await response.json();
                    return data.id;
                } catch (err) {
                    console.error('[Analyzer] Create Order Error:', err);
                    throw err;
                }
            },
            onApprove: async (data) => {
                try {
                    const response = await fetch('/api/analyzer/capture-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderID: data.orderID })
                    });
                    const result = await response.json();

                    if (result.status === 'COMPLETED' || result.status === 'APPROVED') {
                        window.location.href = '/recursos/success-analyzer.html?orderId=' + data.orderID;
                    } else {
                        alert('Error al procesar el pago. Por favor intenta de nuevo.');
                    }
                } catch (err) {
                    console.error('[Analyzer] Capture Error:', err);
                    alert('Error técnico al capturar el pago.');
                }
            },
            onError: (err) => {
                console.error('[Analyzer] PayPal Error:', err);
            },
            style: {
                layout: 'vertical',
                color: 'gold',
                shape: 'rect',
                label: 'pay'
            }
        }).render('#analyzer-paypal-button-container');

        this.paypalInitialized = true;
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    window.analyzerCheckout = new AnalyzerCheckout();
});
