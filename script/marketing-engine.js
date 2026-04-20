/**
 * OFFSZN MARKETING ENGINE
 * Handles A/B Testing, Conversion Popups, and Metrics Tracking.
 */

const MarketingEngine = {
    CONFIG: {
        targetProductSlug: 'preset-de-kuraimokha',
        membershipPayhipUrl: 'https://payhip.com/b/Kihtx',
        couponCode: 'OFFSZN-9L9L',
        producerId: '0382a813-85c7-46c3-8d2c-61a5692adffd'
    },

    state: {
        group: null, // 'A' or 'B'
        sessionId: null,
        isKuraimokhaPage: false,
        popupsShown: {
            membership: false,
            discount: false
        }
    },

    init: async function() {
        this.state.sessionId = this.getOrCreateSessionId();
        this.state.group = this.getOrCreateGroup();
        this.state.isKuraimokhaPage = window.location.pathname.includes(this.CONFIG.targetProductSlug);

        console.log(`[MarketingEngine] Init: Group ${this.state.group} | Session: ${this.state.sessionId}`);

        if (this.state.isKuraimokhaPage) {
            this.handleProductPageLogic();
        }

        if (window.location.pathname.includes('checkout.html')) {
            this.handleCheckoutPageLogic();
        }
    },

    getTimerEnd: function() {
        let end = localStorage.getItem('offszn_mkt_timer_end');
        if (!end) {
            end = Date.now() + (24 * 60 * 60 * 1000);
            localStorage.setItem('offszn_mkt_timer_end', end);
        }
        return parseInt(end);
    },

    startTimer: function(displayElementId) {
        const endTime = this.getTimerEnd();
        const update = () => {
            const now = Date.now();
            const diff = endTime - now;
            
            if (diff <= 0) {
                document.getElementById(displayElementId).innerText = "00:00:00";
                return;
            }

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            const format = (n) => n.toString().padStart(2, '0');
            const el = document.getElementById(displayElementId);
            if (el) {
                el.innerText = `${format(h)}:${format(m)}:${format(s)}`;
            }
        };

        update();
        return setInterval(update, 1000);
    },

    getOrCreateSessionId: function() {
        let sid = sessionStorage.getItem('offszn_mkt_sid');
        if (!sid) {
            sid = Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('offszn_mkt_sid', sid);
        }
        return sid;
    },

    getOrCreateGroup: function() {
        let group = localStorage.getItem('offszn_mkt_group');
        if (!group) {
            group = Math.random() < 0.5 ? 'A' : 'B';
            localStorage.setItem('offszn_mkt_group', group);
        }
        return group;
    },

    trackEvent: async function(eventType) {
        console.log(`[MarketingEngine] Event: ${eventType}`);
        try {
            const userId = localStorage.getItem('userId');
            const { error } = await window.supabaseClient
                .from('marketing_stats')
                .insert([{
                    session_id: this.state.sessionId,
                    variant: this.state.group,
                    event_type: eventType,
                    product_slug: this.CONFIG.targetProductSlug,
                    page_url: window.location.href,
                    user_id: userId || null,
                    is_guest: !userId
                }]);
            if (error) throw error;
        } catch (e) {
            console.warn("[MarketingEngine] Tracking fail:", e);
        }
    },

    handleProductPageLogic: function() {
        if (this.state.group === 'A') {
            // Variant A: Membership ONLY on product page
            setTimeout(() => this.showMembershipPopup(), 100);
        } else {
            // Variant B: Discount ONLY on product page
            setTimeout(() => this.showDiscountPopup('¡Felicidades! Tienes un Cupón de Bienvenida'), 100);
        }
    },

    handleCheckoutPageLogic: function() {
        // Synergy: If Group A comes to checkout, show them the Welcome Discount
        setTimeout(() => {
            const hasKuraimokhaInCart = document.body.innerText.includes('Kuraimokha');
            const alreadyApplied = localStorage.getItem('offszn_applied_coupon');
            
            if (hasKuraimokhaInCart && !alreadyApplied && this.state.group === 'A') {
                this.showDiscountPopup('¡Regalo de Bienvenida para tu primera compra!');
            }
        }, 1500);
    },

    showMembershipPopup: function() {
        if (this.state.popupsShown.membership) return;
        this.state.popupsShown.membership = true;

        const html = `
            <div class="mkt-overlay" id="mkt-membership-overlay">
                <div class="mkt-card">
                    <button class="mkt-close" onclick="MarketingEngine.closePopup('mkt-membership-overlay')">&times;</button>
                    <div class="mkt-header">
                        <span class="mkt-label">La oferta termina en:</span>
                        <div class="mkt-timer" id="mkt-timer-membership">--:--:--</div>
                    </div>
                    <h2 class="mkt-title">¿Quieres sonar como Kuraimokha?</h2>
                    <p class="mkt-desc">Únete a la membresía OFFSZN y desbloquea este preset + 32 presets exclusivos de artistas.</p>
                    <button class="mkt-btn" onclick="MarketingEngine.handleCtaClick('membership', '${this.CONFIG.membershipPayhipUrl}')">
                        Desbloquear +32 Presets <i class="bi bi-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;
        this.injectAndShow(html, 'mkt-membership-overlay', 'view_membership');
        this.state.timerInterval = this.startTimer('mkt-timer-membership');
    },

    showDiscountPopup: function(titleText = '¡Espera! Obtén un 25% de Descuento') {
        if (this.state.popupsShown.discount) return;
        this.state.popupsShown.discount = true;

        const html = `
            <div class="mkt-overlay mkt-theme-discount" id="mkt-discount-overlay">
                <div class="mkt-card">
                    <button class="mkt-close" onclick="MarketingEngine.closePopup('mkt-discount-overlay')">&times;</button>
                    <div class="mkt-header">
                        <span class="mkt-label">La oferta termina en:</span>
                        <div class="mkt-timer" id="mkt-timer-discount">--:--:--</div>
                    </div>
                    <h2 class="mkt-title">${titleText}</h2>
                    <p class="mkt-desc">Usa el código <b style="color:#fff">${this.CONFIG.couponCode}</b> en el checkout para comprar este preset por solo $3.75.</p>
                    <button class="mkt-btn" onclick="MarketingEngine.handleCtaClick('discount')">
                        Aplicar Cupón de Bienvenida
                    </button>
                </div>
            </div>
        `;
        this.injectAndShow(html, 'mkt-discount-overlay', 'view_discount');
        this.state.timerInterval = this.startTimer('mkt-timer-discount');
    },

    injectAndShow: function(html, id, eventName) {
        if (document.getElementById(id)) return;
        document.body.insertAdjacentHTML('beforeend', html);
        const overlay = document.getElementById(id);
        setTimeout(() => overlay.classList.add('active'), 10);
        this.trackEvent(eventName);
    },

    closePopup: function(id) {
        const overlay = document.getElementById(id);
        if (overlay) {
            overlay.classList.remove('active');
            if (this.state.timerInterval) clearInterval(this.state.timerInterval);
            this.trackEvent(`close_${id.split('-')[1]}`);
            setTimeout(() => overlay.remove(), 400);
        }
    },

    handleCtaClick: function(type, url) {
        this.trackEvent(`click_${type}`);
        if (type === 'discount') {
            // Copy coupon and go to checkout
            localStorage.setItem('offszn_applied_coupon', this.CONFIG.couponCode);
            localStorage.setItem('offszn_coupon_data', JSON.stringify({ valid: true, discount_percent: 25, applies_to: 'all' }));
            
            if (window.location.pathname.includes('checkout.html')) {
                window.location.reload(); // Refresh to apply
            } else {
                // If on product page, maybe just close and tell them it's applied
                this.closePopup('mkt-discount-overlay');
                if (window.showToast) {
                    window.showToast('¡Cupón del 25% aplicado! Se verá en el checkout.', 'success');
                } else {
                    alert('¡Cupón del 25% aplicado! Agrégalo al carrito para ver el descuento.');
                }
            }
        } else if (url) {
            window.open(url, '_blank');
            this.closePopup('mkt-membership-overlay');
        }
    }
};

// Auto-run if Supabase is ready
document.addEventListener('DOMContentLoaded', () => {
    const checkSupabase = setInterval(() => {
        if (window.supabaseClient) {
            clearInterval(checkSupabase);
            MarketingEngine.init();
        }
    }, 100);
});
