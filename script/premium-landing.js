/**
 * OFFSZN Premium Landing JS
 * Lightweight logic for FAQ, smooth transitions, and anchor navigation.
 */

document.addEventListener('DOMContentLoaded', () => {
    initFaq();
    initScrollReveal();
    initMobileNav();
    initSmoothScroll();
    initPricingToggle();
    // NOTE: initAuthState is called from the navbar fetch callback in index.html
    // because the navbar DOM doesn't exist here yet (loaded via fetch).
});

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
        // Wait for Supabase client to be ready (loaded in <head>)
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
            // === LOGGED IN ===
            // 1. Hide guest buttons (must use class, not inline style,
            //    because .nav-cta has display:flex!important that beats inline)
            loggedOutEl.classList.add('auth-hidden');

            // 2. Show profile bar
            loggedInEl.classList.add('active');

            // 3. Inject real user data
            const user = session.user;
            const meta = user.user_metadata || {};
            const displayName = meta.nickname || meta.full_name || meta.name || 'Mi Perfil';

            const nameEl   = document.getElementById('nav-user-name');
            const avatarEl = document.getElementById('nav-profile-avatar');

            if (nameEl)   nameEl.textContent = displayName;
            if (avatarEl && meta.avatar_url) avatarEl.src = meta.avatar_url;
        }
        // If no session → default HTML is correct (logged-out visible, logged-in hidden via CSS)
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
            
            // Close all items
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
                const otherContent = otherItem.querySelector('.faq-content');
                if (otherContent) otherContent.style.maxHeight = null;
            });
            
            // Toggle current item
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
 * Basic Scroll Reveal (Using Intersection Observer)
 */
function initScrollReveal() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    revealElements.forEach(el => {
        observer.observe(el);
    });
}

/**
 * Mobile Navigation (Simple)
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
                window.scrollTo({
                    top: target.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * GSAP Animations for the 3-Step Simulator Guide
 */
function initSimulatorAnimations() {
    if (!window.gsap || !window.ScrollTrigger) return;
    
    gsap.registerPlugin(ScrollTrigger);

    // Animate Step Items one by one
    gsap.from(".step-item", {
        scrollTrigger: {
            trigger: ".steps-guide",
            start: "top 80%",
        },
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: "power3.out"
    });

    // Animate Dropzone
    gsap.from(".simulator-interaction-box", {
        scrollTrigger: {
            trigger: ".simulator-interaction-box",
            start: "top 85%",
        },
        scale: 0.95,
        opacity: 0,
        duration: 1,
        ease: "expo.out"
    });

    // Animate Pricing Cards
    gsap.from(".pricing-card", {
        scrollTrigger: {
            trigger: ".pricing-section",
            start: "top 75%",
        },
        y: 40,
        opacity: 0,
        duration: 1,
        stagger: 0.15,
        ease: "power4.out"
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
