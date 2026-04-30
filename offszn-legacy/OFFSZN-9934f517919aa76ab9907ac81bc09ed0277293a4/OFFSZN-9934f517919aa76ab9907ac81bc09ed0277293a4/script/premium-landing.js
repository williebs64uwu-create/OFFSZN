/**
 * OFFSZN Premium Landing JS
 * Lightweight logic for FAQ, smooth transitions, and anchor navigation.
 */

document.addEventListener('DOMContentLoaded', () => {
    initLenis();
    initFaq();
    initMobileNav();
    initSmoothScroll();
    initPricingToggle();
    initGsapAnimations();
});

/**
 * Smooth Scroll (Lenis)
 * Provides the premium "buttery" scroll feel.
 */
function initLenis() {
    if (typeof Lenis === 'undefined') return;

    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        smoothTouch: false,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Sync ScrollTrigger with Lenis
    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);
    
    window.lenis = lenis; // Global access if needed
}

/**
 * Auth State Handler
 * Detects Supabase session and toggles Navbar CTAs.
 * Called ONLY from the navbar fetch callback (after DOM is ready).
 */
async function initAuthState() {
    const loggedOutEl = document.getElementById('nav-logged-out');
    const loggedInEl  = document.getElementById('nav-logged-in');

    // If navbar elements don't exist yet, bail
    if (!loggedOutEl || !loggedInEl) return;

    try {
        if (!window.supabaseClient) {
            if (window.AuthUtils && typeof window.AuthUtils.initSupabase === 'function') {
                window.AuthUtils.initSupabase();
            }
            await new Promise(resolve => {
                const check = setInterval(() => {
                    if (window.supabaseClient) { clearInterval(check); resolve(); }
                }, 150);
                setTimeout(() => { clearInterval(check); resolve(); }, 3000);
            });
        }

        if (!window.supabaseClient) return;

        const { data: { session } } = await window.supabaseClient.auth.getSession();

        if (session) {
            loggedOutEl.classList.add('auth-hidden');
            loggedInEl.classList.add('active');

            const user = session.user;
            const meta = user.user_metadata || {};
            const displayName = meta.nickname || meta.full_name || meta.name || 'Mi Perfil';

            const nameEl   = document.getElementById('nav-user-name');
            const avatarEl = document.getElementById('nav-profile-avatar');

            if (nameEl)   nameEl.textContent = displayName;
            if (avatarEl && meta.avatar_url) avatarEl.src = meta.avatar_url;
        }
    } catch (err) {
        console.warn('Auth state check skipped:', err.message);
    }
}

/**
 * FAQ Accordion Toggle
 */
function initFaq() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const trigger = item.querySelector('.faq-trigger');
        const content = item.querySelector('.faq-content');
        trigger.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
                const otherContent = otherItem.querySelector('.faq-content');
                if (otherContent) otherContent.style.maxHeight = null;
            });
            if (!isActive) {
                item.classList.add('active');
                if (content) content.style.maxHeight = content.scrollHeight + "px";
            } else {
                item.classList.remove('active');
                if (content) content.style.maxHeight = null;
            }
        });
    });
}

/**
 * Mobile Navigation
 */
function initMobileNav() {
    const toggle = document.getElementById('mobile-toggle');
    const header = document.querySelector('.navbar-landing');
    if (toggle && header) {
        toggle.addEventListener('click', () => {
            header.classList.toggle('mobile-menu-active');
        });
    }
}

/**
 * Smooth Scroll for Anchors
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            const target = document.querySelector(targetId);
            if (target) {
                if (window.lenis) {
                    window.lenis.scrollTo(target, { offset: -80 });
                } else {
                    window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' });
                }
            }
        });
    });
}

/**
 * GSAP Animations: Advanced Reveal Engine
 */
function initGsapAnimations() {
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    const isMobile = window.innerWidth <= 768;
    const revealOffset = isMobile ? 15 : 30;
    const heroOffset = isMobile ? 10 : 20;

    // Initial states
    gsap.set(".reveal-content", { y: "110%" });
    gsap.set(".reveal-group > *", { opacity: 0, y: revealOffset, filter: "blur(4px)" });
    gsap.set(".hero-v4-visual", { scale: isMobile ? 0.95 : 0.9, opacity: 0 });
    gsap.set(".hero-cta-buttons", { opacity: 0, y: heroOffset });
    // NEW: Subtle initial state for Hero text
    gsap.set(".hero-v4-title, .hero-v4-subtext", { opacity: 0, y: 20, filter: "blur(10px)" });
    gsap.set([".reveal-mask", ".reveal-group", ".gsap-reveal"], { visibility: "visible", opacity: 1 });

    // Hero Entry Sequence
    const heroTl = gsap.timeline({ defaults: { ease: "power3.out", duration: 1.5 } });
    heroTl.to(".hero-v4-title", { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.5 })
          .to(".hero-v4-subtext", { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.3 }, "-=1.1")
          .to(".hero-cta-buttons", { opacity: 1, y: 0, duration: 1.2 }, "-=1.0")
          .to(".hero-v4-visual", { scale: 1, opacity: 1, duration: 2, ease: "power2.out" }, "-=1.2");

    gsap.from(".logo-cloud-section", {
        scrollTrigger: {
            trigger: ".logo-cloud-section",
            start: "top bottom",
            end: "bottom top",
            scrub: 1
        },
        y: 50,
        opacity: 0.5,
        ease: "none"
    });

    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        const maskTitles = section.querySelectorAll('.reveal-mask .reveal-content');
        const groups     = section.querySelectorAll('.reveal-group');
        const cards      = section.querySelectorAll('.reveal-group > *');
        if (maskTitles.length === 0 && groups.length === 0) return;

        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: section,
                start: "top 80%",
                toggleActions: "play none none none"
            }
        });

        if (maskTitles.length > 0) {
            tl.to(maskTitles, { y: 0, duration: 1.2, stagger: 0.1, ease: "expo.out" });
        }
        if (cards.length > 0) {
            tl.to(cards, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1, stagger: 0.1, ease: "power4.out" }, maskTitles.length > 0 ? "-=0.8" : "0");
        }
    });

    document.querySelectorAll('.gsap-reveal').forEach(el => {
        gsap.to(el, {
            scrollTrigger: { trigger: el, start: "top 90%", toggleActions: "play none none none" },
            autoAlpha: 1, y: 0, duration: 1, ease: "power3.out"
        });
    });
}

/**
 * Pricing Toggle Logic
 */
function initPricingToggle() {
    const toggle = document.getElementById('pricing-toggle');
    const labelMonthly = document.getElementById('label-monthly');
    const labelAnnual = document.getElementById('label-annual');
    
    // Price containers
    const priceStarter    = document.getElementById('price-starter');
    const pricePro        = document.getElementById('price-pro');

    if (!toggle) return;

    const prices = {
        monthly: {
            starter: '$5<span class="price-period">/mes</span>',
            pro: '$7<span class="price-period">/mes</span>'
        },
        annual: {
            starter: '$1.66<span class="price-period">/mes</span>',
            pro: '$2.50<span class="price-period">/mes</span>'
        }
    };

    // Toggle click handler
    toggle.addEventListener('click', () => {
        const isAnnual = toggle.classList.toggle('annual');
        updatePricing(isAnnual);
    });

    function updatePricing(isAnnual) {
        if (isAnnual) {
            labelAnnual.classList.add('active');
            labelMonthly.classList.remove('active');
            
            if (priceStarter)   priceStarter.innerHTML      = prices.annual.starter;
            if (pricePro)       pricePro.innerHTML          = prices.annual.pro;
        } else {
            labelAnnual.classList.remove('active');
            labelMonthly.classList.add('active');
            
            if (priceStarter)   priceStarter.innerHTML      = prices.monthly.starter;
            if (pricePro)       pricePro.innerHTML          = prices.monthly.pro;
        }
    }

    // Label click handlers
    labelMonthly.addEventListener('click', () => {
        if (toggle.classList.contains('annual')) {
            toggle.classList.remove('annual');
            updatePricing(false);
        }
    });
    labelAnnual.addEventListener('click', () => {
        if (!toggle.classList.contains('annual')) {
            toggle.classList.add('annual');
            updatePricing(true);
        }
    });

    // Default to Annual (User suggested: "creoque mejor anual?")
    toggle.classList.add('annual');
    updatePricing(true);
}
