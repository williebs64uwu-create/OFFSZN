/**
 * OFFSZN 2x1 Promo Modal & Side Tab Engine
 * Displays 2x1 Offer Modal 5s after entry, and docks a sleek side tab on PC.
 */

class PromoModal2x1 {
    constructor() {
        this.delayMs = 5000; // 5 segundos
        this.storageKey = 'offszn_promo_2x1_last_shown_v4';
        this.sideTabKey = 'offszn_promo_2x1_side_tab_closed';
        this.init();
    }

    init() {
        const isLocal = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
        const lastShown = localStorage.getItem(this.storageKey);
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        // Mostrar modal si pasaron 24 horas o en pruebas locales
        const shouldShowModal = !lastShown || (now - parseInt(lastShown, 10)) > twentyFourHours || isLocal;

        if (shouldShowModal) {
            setTimeout(() => {
                this.renderModal();
            }, this.delayMs);
        } else {
            // Si ya se mostró hoy, renderizar pestaña lateral en PC
            this.renderSideTab();
        }
    }

    renderModal() {
        if (document.getElementById('offszn-promo-2x1-modal')) return;

        this.injectStyles();

        const modal = document.createElement('div');
        modal.id = 'offszn-promo-2x1-modal';
        modal.className = 'promo-2x1-overlay';
        modal.innerHTML = `
            <div class="promo-2x1-card">
                <button class="promo-2x1-close" id="promo-2x1-close-btn" title="Cerrar">&times;</button>
                
                <div class="promo-2x1-badge">
                    <i class="bi bi-fire"></i> OFERTA 2X1 SOLO HASTA FIN DE MES
                </div>

                <div class="promo-2x1-showcase">
                    <a href="/plugins/easy-mix.html" target="_blank" rel="noopener noreferrer" class="promo-plugin-item" title="Ver Easy Mix VST (Clic para abrir)">
                        <img src="/images/plugins/easy mixx.png" alt="Easy Mix VST">
                        <span>Easy Mix VST</span>
                    </a>
                    <div class="promo-plus-sign">+</div>
                    <a href="/plugins/easy-master.html" target="_blank" rel="noopener noreferrer" class="promo-plugin-item" title="Ver Easy Master VST (Clic para abrir)">
                        <img src="/images/plugins/EASY MASTER IMAGE.png" alt="Easy Master VST">
                        <span>Easy Master VST</span>
                    </a>
                </div>

                <h2 class="promo-2x1-title">
                    ¡LLÉVATE UN PLUGIN DE MASTER DE REGALO!
                </h2>

                <ul class="promo-2x1-benefits">
                    <li><i class="bi bi-check-circle-fill"></i> +50 Presets de voces</li>
                    <li><i class="bi bi-check-circle-fill"></i> Plugin de master con 3 skins</li>
                    <li><i class="bi bi-check-circle-fill"></i> Licencias de por vida + actualizaciones</li>
                </ul>

                <a href="/plugins/promo-2x1.html" class="promo-2x1-btn" id="promo-2x1-cta">
                    Obtenerlo ahora!
                </a>

                <div class="promo-2x1-footer-note">
                    <span id="promo-2x1-dismiss">No gracias, continuar navegando</span>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Bind events
        const closeBtn = modal.querySelector('#promo-2x1-close-btn');
        const dismissBtn = modal.querySelector('#promo-2x1-dismiss');
        
        const closeModal = () => {
            modal.classList.remove('active');
            localStorage.setItem(this.storageKey, Date.now().toString());
            setTimeout(() => {
                modal.remove();
                this.renderSideTab(); // Al cerrar el modal, aparece la pestaña lateral fija en PC
            }, 350);
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (dismissBtn) dismissBtn.addEventListener('click', closeModal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Trigger entrance animation
        setTimeout(() => {
            modal.classList.add('active');
        }, 50);
    }

    renderSideTab() {
        if (document.getElementById('offszn-promo-side-tab')) return;
        if (localStorage.getItem(this.sideTabKey) === 'true') return;

        this.injectStyles();

        const sideTab = document.createElement('div');
        sideTab.id = 'offszn-promo-side-tab';
        sideTab.className = 'promo-2x1-side-tab';
        sideTab.innerHTML = `
            <button class="side-tab-close" id="side-tab-close-btn" title="Cerrar pestaña">&times;</button>
            <div class="side-tab-content" id="side-tab-open-btn">
                <span>🎁 Oferta 2x1 — Plugin de master gratis</span>
            </div>
        `;

        document.body.appendChild(sideTab);

        const closeBtn = sideTab.querySelector('#side-tab-close-btn');
        const openBtn = sideTab.querySelector('#side-tab-open-btn');

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sideTab.remove();
            localStorage.setItem(this.sideTabKey, 'true');
        });

        openBtn.addEventListener('click', () => {
            this.renderModal();
        });
    }

    injectStyles() {
        if (document.getElementById('offszn-promo-modal-styles')) return;

        const style = document.createElement('style');
        style.id = 'offszn-promo-modal-styles';
        style.innerHTML = `
            /* OVERLAY & CENTER MODAL */
            .promo-2x1-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.82);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .promo-2x1-overlay.active {
                opacity: 1;
                pointer-events: auto;
            }
            .promo-2x1-card {
                background: #0d0d10;
                border: 1.5px solid rgba(255, 159, 10, 0.4);
                border-radius: 20px;
                padding: 32px 28px;
                max-width: 460px;
                width: 92%;
                text-align: center;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9);
                position: relative;
                transform: scale(0.94) translateY(15px);
                transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
                color: #fff;
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
            }
            .promo-2x1-overlay.active .promo-2x1-card {
                transform: scale(1) translateY(0);
            }
            .promo-2x1-close {
                position: absolute;
                top: 14px;
                right: 18px;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.12);
                color: #aaa;
                font-size: 1.4rem;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                line-height: 1;
            }
            .promo-2x1-close:hover {
                background: rgba(255, 255, 255, 0.2);
                color: #fff;
            }
            .promo-2x1-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: rgba(255, 159, 10, 0.1);
                border: 1px solid rgba(255, 159, 10, 0.35);
                color: #ff9f0a;
                font-size: 0.72rem;
                font-weight: 800;
                letter-spacing: 1.2px;
                padding: 6px 14px;
                border-radius: 100px;
                text-transform: uppercase;
                margin-bottom: 22px;
            }
            .promo-2x1-showcase {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                margin-bottom: 22px;
            }
            .promo-plugin-item {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
                padding: 10px;
                border-radius: 12px;
                text-decoration: none;
                transition: border-color 0.2s, background 0.2s;
            }
            .promo-plugin-item:hover {
                border-color: rgba(255, 159, 10, 0.4);
                background: rgba(255, 159, 10, 0.05);
            }
            .promo-plugin-item img {
                width: 100%;
                height: 85px;
                object-fit: contain;
            }
            .promo-plugin-item span {
                font-size: 0.78rem;
                font-weight: 700;
                color: #fff;
            }
            .promo-plus-sign {
                font-size: 1.5rem;
                font-weight: 900;
                color: #ff9f0a;
            }
            .promo-2x1-title {
                font-size: 1.4rem;
                font-weight: 900;
                line-height: 1.25;
                margin-bottom: 20px;
                color: #fff;
                letter-spacing: -0.5px;
            }
            .promo-2x1-benefits {
                list-style: none;
                padding: 0;
                margin: 0 0 24px 0;
                text-align: left;
                font-size: 0.88rem;
                color: #ddd;
            }
            .promo-2x1-benefits li {
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .promo-2x1-benefits i {
                color: #ff9f0a;
                font-size: 1.05rem;
            }
            .promo-2x1-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                background: #ff9f0a;
                color: #000000;
                font-weight: 900;
                font-size: 1.05rem;
                padding: 14px 20px;
                border-radius: 10px;
                text-decoration: none;
                border: none;
                transition: background 0.2s;
            }
            .promo-2x1-btn:hover {
                background: #ff7b00;
                color: #000;
            }
            .promo-2x1-footer-note {
                margin-top: 14px;
                font-size: 0.75rem;
            }
            .promo-2x1-footer-note span {
                color: #666;
                cursor: pointer;
                text-decoration: underline;
            }
            .promo-2x1-footer-note span:hover {
                color: #aaa;
            }

            /* STICKY SIDE TAB (PC ONLY) */
            .promo-2x1-side-tab {
                position: fixed;
                left: 0;
                top: 40%;
                transform: translateY(-50%);
                z-index: 9998;
                display: flex;
                align-items: center;
                animation: slideInSide 0.4s ease-out;
            }
            @keyframes slideInSide {
                from { transform: translateY(-50%) translateX(-100%); }
                to { transform: translateY(-50%) translateX(0); }
            }
            .side-tab-content {
                background: #111116;
                border: 1.5px solid rgba(255, 159, 10, 0.4);
                border-left: none;
                border-radius: 0 12px 12px 0;
                padding: 16px 12px;
                color: #ffffff;
                font-weight: 800;
                font-size: 0.85rem;
                cursor: pointer;
                box-shadow: 4px 0 20px rgba(0, 0, 0, 0.6);
                writing-mode: vertical-rl;
                letter-spacing: 0.5px;
                white-space: nowrap;
                transition: background 0.2s, border-color 0.2s;
            }
            .side-tab-content:hover {
                background: #1a1a22;
                border-color: #ff9f0a;
            }
            .side-tab-close {
                position: absolute;
                top: -10px;
                right: -8px;
                background: #22222a;
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #fff;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                font-size: 0.85rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                line-height: 1;
            }
            .side-tab-close:hover {
                background: #ff3b30;
                border-color: #ff3b30;
            }

            /* OCULTAR PESTAÑA LATERAL EN MÓVILES */
            @media (max-width: 768px) {
                .promo-2x1-side-tab {
                    display: none !important;
                }
            }
        `;

        document.head.appendChild(style);
    }
}

// Auto instantiate promo modal
document.addEventListener('DOMContentLoaded', () => {
    window.promoModal2x1 = new PromoModal2x1();
});
