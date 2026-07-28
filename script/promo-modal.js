/**
 * OFFSZN 2x1 Promo Modal Engine
 * Displays an exclusive popup offer for Easy Mix + Easy Master 2x1 bundle
 * 5 seconds after entering OFFSZN.
 */

class PromoModal2x1 {
    constructor() {
        this.delayMs = 5000; // 5 segundos
        this.storageKey = 'offszn_promo_2x1_modal_seen_v2';
        this.endTime = new Date("2026-07-31T23:59:59-05:00").getTime();
        this.timerInterval = null;
        this.init();
    }

    init() {
        const isLocal = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
        const hasSeen = sessionStorage.getItem(this.storageKey);
        
        // En producción, solo mostrar 1 vez por sesión. En local, mostrar siempre al recargar.
        if (hasSeen && !isLocal) {
            return;
        }

        setTimeout(() => {
            this.renderModal();
        }, this.delayMs);
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
                    <i class="bi bi-fire"></i> OFERTA 2X1 EXCLUSIVA — FIN DE MES
                </div>

                <div class="promo-2x1-showcase">
                    <div class="promo-plugin-item">
                        <img src="/images/plugins/easy mixx.png" alt="Easy Mix VST">
                        <span>Easy Mix VST</span>
                    </div>
                    <div class="promo-plus-sign">+</div>
                    <div class="promo-plugin-item">
                        <img src="/images/plugins/EASY MASTER IMAGE.png" alt="Easy Master VST">
                        <span>Easy Master VST</span>
                    </div>
                </div>

                <h2 class="promo-2x1-title">
                    ¡Llévate los 2 Plugins por solo <span class="highlight">$5 USD</span>!
                </h2>

                <p class="promo-2x1-subtitle">
                    Obtén el combo definitivo para Mezcla y Masterización Vocal en FL Studio con Licencia de Por Vida.
                </p>

                <!-- Dynamic Countdown -->
                <div class="promo-2x1-timer-box">
                    <span class="timer-label"><i class="bi bi-clock-history"></i> La oferta expira en:</span>
                    <span class="timer-value" id="modal-countdown-val">Cargando...</span>
                </div>

                <ul class="promo-2x1-benefits">
                    <li><i class="bi bi-check-circle-fill"></i> <strong>Easy Mix VST</strong>: Voces pro en segundos.</li>
                    <li><i class="bi bi-check-circle-fill"></i> <strong>Easy Master VST</strong>: Masterización limpia y potente.</li>
                    <li><i class="bi bi-check-circle-fill"></i> <strong>2 Licencias De Por Vida</strong> ($25 cada uno &rarr; $5 los dos).</li>
                </ul>

                <a href="/plugins/promo-2x1.html" class="promo-2x1-btn" id="promo-2x1-cta">
                    <i class="bi bi-bag-check-fill"></i> ¡Obtener Oferta 2x1 Ahora ($5 USD)!
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
            sessionStorage.setItem(this.storageKey, 'true');
            if (this.timerInterval) clearInterval(this.timerInterval);
            setTimeout(() => modal.remove(), 400);
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (dismissBtn) dismissBtn.addEventListener('click', closeModal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Trigger entrance animation
        setTimeout(() => {
            modal.classList.add('active');
            this.startCountdown();
        }, 50);
    }

    startCountdown() {
        const timerVal = document.getElementById('modal-countdown-val');
        if (!timerVal) return;

        const updateTimer = () => {
            const now = new Date().getTime();
            const distance = this.endTime - now;

            if (distance < 0) {
                timerVal.innerText = "Oferta Expirada";
                if (this.timerInterval) clearInterval(this.timerInterval);
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            if (days > 0) {
                timerVal.innerText = `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
            } else {
                timerVal.innerText = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
            }
        };

        updateTimer();
        this.timerInterval = setInterval(updateTimer, 1000);
    }

    injectStyles() {
        if (document.getElementById('offszn-promo-modal-styles')) return;

        const style = document.createElement('style');
        style.id = 'offszn-promo-modal-styles';
        style.innerHTML = `
            .promo-2x1-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.82);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .promo-2x1-overlay.active {
                opacity: 1;
                pointer-events: auto;
            }
            .promo-2x1-card {
                background: linear-gradient(145deg, #0d0d10 0%, #050507 100%);
                border: 1.5px solid rgba(255, 159, 10, 0.35);
                border-radius: 24px;
                padding: 32px 28px;
                max-width: 480px;
                width: 92%;
                text-align: center;
                box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 50px rgba(255, 159, 10, 0.12);
                position: relative;
                transform: scale(0.92) translateY(20px);
                transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
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
                width: 34px;
                height: 34px;
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
                transform: scale(1.08);
            }
            .promo-2x1-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: rgba(255, 159, 10, 0.12);
                border: 1px solid rgba(255, 159, 10, 0.4);
                color: #ff9f0a;
                font-size: 0.72rem;
                font-weight: 800;
                letter-spacing: 1.5px;
                padding: 6px 14px;
                border-radius: 100px;
                text-transform: uppercase;
                margin-bottom: 20px;
            }
            .promo-2x1-showcase {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 14px;
                margin-bottom: 20px;
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
                border-radius: 14px;
            }
            .promo-plugin-item img {
                width: 100%;
                height: 85px;
                object-fit: contain;
                filter: drop-shadow(0 6px 12px rgba(0,0,0,0.5));
                transition: transform 0.3s;
            }
            .promo-plugin-item:hover img {
                transform: scale(1.05);
            }
            .promo-plugin-item span {
                font-size: 0.78rem;
                font-weight: 700;
                color: #ddd;
            }
            .promo-plus-sign {
                font-size: 1.6rem;
                font-weight: 900;
                color: #ff9f0a;
            }
            .promo-2x1-title {
                font-size: 1.45rem;
                font-weight: 800;
                line-height: 1.25;
                margin-bottom: 8px;
                color: #fff;
            }
            .promo-2x1-title .highlight {
                color: #ff9f0a;
                background: linear-gradient(135deg, #ff9f0a 0%, #ff7b00 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .promo-2x1-subtitle {
                font-size: 0.85rem;
                color: #aaa;
                line-height: 1.45;
                margin-bottom: 18px;
            }
            .promo-2x1-timer-box {
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 159, 10, 0.25);
                border-radius: 10px;
                padding: 10px 14px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 18px;
                font-size: 0.85rem;
            }
            .timer-label {
                color: #888;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .timer-value {
                font-family: monospace;
                font-size: 0.95rem;
                font-weight: 800;
                color: #ff9f0a;
                letter-spacing: 0.5px;
            }
            .promo-2x1-benefits {
                list-style: none;
                padding: 0;
                margin: 0 0 22px 0;
                text-align: left;
                font-size: 0.83rem;
                color: #ccc;
            }
            .promo-2x1-benefits li {
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .promo-2x1-benefits i {
                color: #ff9f0a;
                font-size: 0.95rem;
            }
            .promo-2x1-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                width: 100%;
                background: linear-gradient(135deg, #ff9f0a 0%, #ff7b00 100%);
                color: #000;
                font-weight: 900;
                font-size: 1rem;
                padding: 14px 20px;
                border-radius: 12px;
                text-decoration: none;
                box-shadow: 0 8px 25px rgba(255, 159, 10, 0.35);
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .promo-2x1-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 12px 35px rgba(255, 159, 10, 0.5);
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
                transition: color 0.2s;
            }
            .promo-2x1-footer-note span:hover {
                color: #aaa;
            }
        `;

        document.head.appendChild(style);
    }
}

// Auto instantiate promo modal
document.addEventListener('DOMContentLoaded', () => {
    window.promoModal2x1 = new PromoModal2x1();
});
