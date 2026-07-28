/**
 * OFFSZN Mercado Pago Banner for Willieinspired Products
 * Injects a Mercado Pago banner (with Argentina flag 🇦🇷)
 * on all products (presets, beats, templates, kits, plugins, etc.) owned by willieinspired.
 */

(function () {
    const MERCADOPAGO_WA_LINK = 'https://wa.link/8762r5';

    function isWillieProduct(product) {
        const path = window.location.pathname.toLowerCase();
        
        // Match specific path patterns
        if (path.includes('preset-de-remers') || path.includes('preset-definitivo') || path.includes('easy-mix') || path.includes('easy-master')) {
            return true;
        }

        if (!product) return false;
        
        const producer = Array.isArray(product.producer) ? product.producer[0] : product.producer;
        const nickname = (producer?.nickname || '').toLowerCase();
        const username = (producer?.username || '').toLowerCase();
        const email = (producer?.email || '').toLowerCase();

        // Match willieinspired or Willie
        if (username.includes('willie') || nickname.includes('willie') || email.includes('willie')) {
            return true;
        }

        return false;
    }

    function injectMercadoPagoBanner() {
        if (document.getElementById('willie-mercadopago-banner')) return;

        const product = window.currentProductData;
        if (!isWillieProduct(product) && !window.location.pathname.includes('preset-de-remers')) return;

        // Create the banner element
        const banner = document.createElement('a');
        banner.id = 'willie-mercadopago-banner';
        banner.href = MERCADOPAGO_WA_LINK;
        banner.target = '_blank';
        banner.rel = 'noopener noreferrer';
        banner.className = 'mercadopago-willie-banner';
        banner.innerHTML = `
            <div class="mp-banner-inner">
                <span class="mp-flag">🇦🇷</span>
                <span class="mp-text">HAZ CLICK AQUÍ PARA PAGAR CON MERCADO PAGO</span>
                <i class="bi bi-chevron-right mp-arrow"></i>
            </div>
        `;

        // Inject banner into the product hero / buy section / price card
        const targetContainer = document.querySelector('.license-selector-container') ||
                                document.querySelector('.price-card') || 
                                document.querySelector('.product-price-section') || 
                                document.querySelector('.product-buy-box') || 
                                document.querySelector('.price-box') || 
                                document.querySelector('.hero-action-buttons') ||
                                document.querySelector('.product-actions-container') ||
                                document.querySelector('.hero-right-col') ||
                                document.querySelector('.product-hero') ||
                                document.getElementById('product-page-container');

        if (targetContainer) {
            targetContainer.prepend(banner);
        }
    }

    // Auto-check periodically until product data or DOM is available
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        if (window.currentProductData || document.querySelector('.product-hero') || attempts > 25) {
            injectMercadoPagoBanner();
            if (window.currentProductData || attempts > 25) clearInterval(interval);
        }
    }, 400);

    // Style Injection
    if (!document.getElementById('mercadopago-willie-banner-styles')) {
        const style = document.createElement('style');
        style.id = 'mercadopago-willie-banner-styles';
        style.innerHTML = `
            .mercadopago-willie-banner {
                display: block;
                width: 100%;
                margin: 16px 0;
                background: linear-gradient(135deg, #009EE3 0%, #0073B7 100%);
                color: #ffffff !important;
                text-decoration: none !important;
                border-radius: 14px;
                padding: 14px 20px;
                box-shadow: 0 6px 20px rgba(0, 158, 227, 0.4);
                transition: all 0.3s ease;
                box-sizing: border-box;
                border: 1px solid rgba(255, 255, 255, 0.25);
            }
            .mercadopago-willie-banner:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 30px rgba(0, 158, 227, 0.6);
                background: linear-gradient(135deg, #00aaff 0%, #0080ce 100%);
                color: #ffffff !important;
            }
            .mp-banner-inner {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                text-align: center;
                font-weight: 800;
                font-size: 0.92rem;
                letter-spacing: 0.5px;
                text-transform: uppercase;
            }
            .mp-flag {
                font-size: 1.3rem;
                line-height: 1;
            }
            .mp-arrow {
                font-size: 1.1rem;
                transition: transform 0.2s;
            }
            .mercadopago-willie-banner:hover .mp-arrow {
                transform: translateX(4px);
            }
        `;
        document.head.appendChild(style);
    }
})();
