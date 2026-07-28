/**
 * OFFSZN Mercado Pago Banner & Alternative Payment Link for Willieinspired Products
 * 1. Smooth 2-second top banner above navbar: "HAZ CLICK AQUÍ = PARA PAGAR CON MERCADO PAGO 🇦🇷" -> https://wa.link/ebw8ut
 * 2. Underlined text link "Otros Métodos de Pago" under "COMPRAR - $10.00" -> https://wa.link/r1cm47
 */

(function () {
    const MERCADOPAGO_WA_LINK = 'https://wa.link/ebw8ut';
    const OTROS_PAGOS_WA_LINK = 'https://wa.link/r1cm47';

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

        if (username.includes('willie') || nickname.includes('willie') || email.includes('willie')) {
            return true;
        }

        return false;
    }

    function injectTopBanner() {
        if (document.getElementById('willie-mercadopago-topbanner')) return;

        const product = window.currentProductData;
        if (!isWillieProduct(product) && !window.location.pathname.includes('preset-de-remers')) return;

        // Remove any old in-page banner if present
        const oldBanner = document.getElementById('willie-mercadopago-banner');
        if (oldBanner) oldBanner.remove();

        // Create top banner container
        const banner = document.createElement('a');
        banner.id = 'willie-mercadopago-topbanner';
        banner.href = MERCADOPAGO_WA_LINK;
        banner.target = '_blank';
        banner.rel = 'noopener noreferrer';
        banner.className = 'willie-mp-topbanner';
        banner.innerHTML = `
            <div class="mp-topbanner-inner">
                <span class="mp-flag">🇦🇷</span>
                <span class="mp-text">HAZ CLICK AQUÍ = PARA PAGAR CON MERCADO PAGO</span>
                <i class="bi bi-chevron-right mp-arrow"></i>
            </div>
        `;

        // Prepend to body before navbar
        document.body.prepend(banner);

        // Trigger 2-second smooth entrance animation
        setTimeout(() => {
            banner.classList.add('visible');
        }, 100);
    }

    function injectOtrosPagosBtn() {
        if (document.getElementById('willie-otros-pagos-btn')) return;

        const product = window.currentProductData;
        if (!isWillieProduct(product) && !window.location.pathname.includes('preset-de-remers')) return;

        // Find main buy button / license box container
        const targetContainer = document.getElementById('buying-modules') ||
                                document.querySelector('.buying-section-wrapper') ||
                                document.querySelector('.btn-buy-license') ||
                                document.querySelector('.license-buy-btn') ||
                                document.querySelector('.btn-checkout-single') ||
                                document.querySelector('.license-selector-container') ||
                                document.querySelector('.price-card') ||
                                document.querySelector('.product-price-section') ||
                                document.querySelector('.product-main-content');

        if (!targetContainer) return;

        const otrosBtn = document.createElement('a');
        otrosBtn.id = 'willie-otros-pagos-btn';
        otrosBtn.href = OTROS_PAGOS_WA_LINK;
        otrosBtn.target = '_blank';
        otrosBtn.rel = 'noopener noreferrer';
        otrosBtn.className = 'willie-otros-pagos-link';
        otrosBtn.innerText = 'Otros Métodos de Pago';

        targetContainer.insertAdjacentElement('beforeend', otrosBtn);
    }

    // Auto-check periodically until DOM is ready
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        const hasProductData = window.currentProductData || document.querySelector('.product-hero') || document.getElementById('buying-modules') || attempts > 25;
        
        if (hasProductData) {
            injectTopBanner();
            injectOtrosPagosBtn();
            if ((window.currentProductData || document.getElementById('buying-modules')) && attempts > 5) {
                clearInterval(interval);
            }
        }
    }, 300);

    // Style Injection
    if (!document.getElementById('mercadopago-willie-banner-styles')) {
        const style = document.createElement('style');
        style.id = 'mercadopago-willie-banner-styles';
        style.innerHTML = `
            /* TOP BANNER ABOVE NAVBAR WITH 2s SMOOTH FADE */
            .willie-mp-topbanner {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                background: linear-gradient(90deg, #009EE3 0%, #0073B7 100%);
                color: #ffffff !important;
                text-decoration: none !important;
                padding: 11px 16px;
                box-sizing: border-box;
                position: relative;
                z-index: 10001;
                opacity: 0;
                transform: translateY(-100%);
                transition: opacity 1.8s cubic-bezier(0.16, 1, 0.3, 1), transform 1.8s cubic-bezier(0.16, 1, 0.3, 1);
                box-shadow: 0 4px 15px rgba(0, 158, 227, 0.35);
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            }
            .willie-mp-topbanner.visible {
                opacity: 1;
                transform: translateY(0);
            }
            .willie-mp-topbanner:hover {
                background: linear-gradient(90deg, #00aaff 0%, #0080ce 100%);
                color: #ffffff !important;
            }
            .mp-topbanner-inner {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                text-align: center;
                font-weight: 800;
                font-size: 0.9rem;
                letter-spacing: 0.5px;
                text-transform: uppercase;
            }
            .mp-flag {
                font-size: 1.25rem;
                line-height: 1;
            }
            .mp-arrow {
                font-size: 1.05rem;
                transition: transform 0.25s ease;
            }
            .willie-mp-topbanner:hover .mp-arrow {
                transform: translateX(5px);
            }

            /* OTROS MÉTODOS DE PAGO UNDERLINED LINK UNDER COMPRAR $10 */
            .willie-otros-pagos-link {
                display: block !important;
                width: 100%;
                text-align: center;
                margin-top: 14px;
                margin-bottom: 10px;
                color: #aaaaaa !important;
                text-decoration: underline !important;
                font-weight: 700;
                font-size: 0.9rem;
                letter-spacing: 0.5px;
                transition: color 0.2s ease;
                cursor: pointer;
            }
            .willie-otros-pagos-link:hover {
                color: #ffffff !important;
            }
        `;
        document.head.appendChild(style);
    }
})();
