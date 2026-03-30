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
        this.freeDownloadButtons = document.querySelectorAll('.btn-free-download');
        
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

        // Handle Free Download
        this.freeDownloadButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleFreeDownload();
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

    async handleFreeDownload() {
        try {
            console.log('[Analyzer] Initiating free download flow...');
            
            if (typeof AuthUtils === 'undefined') {
                console.error('[Analyzer] AuthUtils not found');
                return;
            }

            // 1. Check Session
            const user = await AuthUtils.getCurrentUser();

            if (!user) {
                console.log('[Analyzer] Guest detected, opening Download Gate...');
                
                // Prepare dummy product data for download-gate.js
                window.currentProductData = {
                    id: 'x-flow-analyzer',
                    name: 'X Flow - Analyzer',
                    is_free: true,
                    producer_id: 'offszn-official',
                    producer: { nickname: 'OFFSZN', is_verified: true }
                };

                if (typeof openDownloadGateModal !== 'undefined') {
                    // For guest downloads, we just proceed with the email collection tool.
                    // No redirection per user request.
                    openDownloadGateModal(
                        'plugins/X - FLOW - ANALIZER Win_Installer.rar', 
                        'OFFSZN', 
                        'x-flow-analyzer'
                    );
                } else {
                    alert('El sistema de descargas no está listo. Por favor refresca la página.');
                }
                return;
            }

            // 2. Logged-in Flow: First, record the download in the backend
            console.log('[Analyzer] Recording free download for user:', user.id);
            try {
                const token = (await AuthUtils.getSession())?.access_token;
                const regResponse = await fetch('/api/analyzer/free-order', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    }
                });
                
                if (!regResponse.ok) {
                    console.error('[Analyzer] Backend registration failed');
                    // We proceed anyway to not block the user, but log the error
                }
            } catch (regErr) {
                console.error('[Analyzer] Backend registration error:', regErr);
            }

            // 3. Get signed URL from R2 (v2 bucket)
            const signedUrl = await AuthUtils.getAuthorizedUrl('plugins/X - FLOW - ANALIZER Win_Installer.rar', 'v2');
            
            if (!signedUrl) {
                console.error('[Analyzer] Failed to get signed URL');
                alert('Hubo un error al generar el enlace de descarga. Intenta de nuevo.');
                return;
            }

            // 4. Trigger Download
            const link = document.createElement('a');
            link.href = signedUrl;
            link.download = 'X - FLOW - ANALIZER Win_Installer.rar';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // 5. Redirect to mis-compras.html after a slight delay
            setTimeout(() => {
                window.location.href = '/mis-compras.html';
            }, 1500);

        } catch (err) {
            console.error('[Analyzer] Free Download Error:', err);
            alert('Error al procesar la descarga.');
        }
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
        }).render('#analyzer-paypal-button-container').then(() => {
            // Hide skeletons once buttons are rendered
            const skeletons = this.paypalContainer.querySelector('.skeleton-container');
            if (skeletons) skeletons.style.display = 'none';
        });

        this.paypalInitialized = true;
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    window.analyzerCheckout = new AnalyzerCheckout();
});
