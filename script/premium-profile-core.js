/**
 * Premium Profile - Core Engine
 * Handles data fetching, event listeners, and initialization.
 */

(function() {
    let currentCategory = 'BEATS';
    let allProducts = [];
    let isOwner = false;
    let userNickname = "";
    const userId = window.OFFSZN_USER_ID;

    // --- INITIALIZATION ---
    document.addEventListener('DOMContentLoaded', async () => {
        if (!userId) {
            console.error("❌ No User ID provided for profile loader");
            return;
        }

        AuthUtils.initSupabase();
        const supabase = window.supabaseClient;

        // Register GSAP Plugins
        if (window.ScrollTrigger) {
            gsap.registerPlugin(ScrollTrigger);
        }

        try {
            // 1. Parallel Data Fetch
            const [userRes, productsRes, currentUser] = await Promise.all([
                supabase.from('users').select('*').eq('id', userId).single(),
                supabase.from('products').select('*').eq('producer_id', userId).eq('visibility', 'public').order('created_at', { ascending: false }),
                AuthUtils.getCurrentUser()
            ]);

            isOwner = currentUser && currentUser.id === userId;

            if (userRes.data) {
                const user = userRes.data;
                userNickname = user.nickname || "Artista";
                
                // Set globals if needed for templates
                window.userNickname = userNickname; 

                // Render Sections
                PremiumRender.renderLicenses('premium-licenses-grid', 'licencias-section', user.license_settings);
                
                const services = user.socials?.custom_services || [];
                PremiumRender.renderServices('services-shelf', 'services-section', services, userNickname, isOwner);

                // Polling for ProfLoader (Navbar/Footer)
                initLoaderUI(user);

                // Update Contact Email
                const contactEmail = user.email || (currentUser ? currentUser.email : "contacto@offszn.lat");
                const emailEl = document.getElementById('dynamic-contact-email');
                if (emailEl) {
                    emailEl.innerText = contactEmail;
                    emailEl.href = `mailto:${contactEmail}`;
                }
            }

            if (productsRes.data) {
                allProducts = productsRes.data;
                initTabs();
            }

            // 5. Check Subscription Status (Specifically for jdagust/Ending subscriptions)
            if (isOwner) {
                checkSubscriptionStatus(supabase, currentUser.id);
            }

            // Finish Loading
            // Particles
            if (window.initParticles) window.initParticles();

            // Scroll Animations
            initScrollAnimations();

            hideInitialLoader();
        } catch (err) {
            console.error("❌ Error loading profile data:", err);
            hideInitialLoader(); // At least show the page even if empty
        }
    });

    async function checkSubscriptionStatus(supabase, uid) {
        try {
            const { data: sub, error } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', uid)
                .eq('status', 'active')
                .single();

            if (sub && sub.current_period_end) {
                const endDate = new Date(sub.current_period_end);
                const now = new Date();
                const diffTime = endDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Show modal if subscription is ending soon (e.g. < 15 days)
                // We also check if they've seen it this session
                const hasSeenModal = sessionStorage.getItem('offszn_sub_modal_seen');

                if (diffDays <= 15 && !hasSeenModal) {
                    const planName = (sub.plan_id || 'Premium').split('_')[0].toUpperCase();
                    
                    document.getElementById('modal-plan-name').innerText = planName;
                    document.getElementById('modal-days-left').innerText = diffDays > 0 ? diffDays : '0';
                    document.getElementById('modal-next-date').innerText = endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
                    
                    if (sub.provider === 'manual') {
                        document.getElementById('modal-renewal-info').innerHTML = `<i class="bi bi-exclamation-triangle"></i> <span>Tu acceso expira el <strong>${endDate.toLocaleDateString()}</strong>. Renueva para no perder beneficios.</span>`;
                    }

                    setTimeout(() => {
                        if (typeof openSubscriptionModal === 'function') openSubscriptionModal();
                        sessionStorage.setItem('offszn_sub_modal_seen', 'true');
                    }, 2000);
                }
            }
        } catch (e) {
            console.warn("⚠️ Subscription check failed:", e);
        }
    }

    // --- UI HELPERS ---
    function hideInitialLoader() {
        const loader = document.getElementById('initial-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.visibility = 'hidden';
            }, 500);
        }
        
        // Animación entrada Hero
        const tl = gsap.timeline();
        tl.to('#hero-content', { autoAlpha: 1, y: 0, duration: 1.2, ease: 'power4.out' });
        
        // Animación sutil para los tabs si ya están listos
        if (document.querySelector('.tab-trigger')) {
            tl.from('.tab-trigger', { autoAlpha: 0, y: 15, stagger: 0.08, duration: 0.8, ease: 'back.out(1.7)' }, "-=0.6");
        }
    }

    function initLoaderUI(user) {
        let attempts = 0;
        const checkLoader = setInterval(() => {
            if (window.ProfLoader) {
                window.ProfLoader.init(user);
                clearInterval(checkLoader);
                
                // Inicializar comportamientos del Nav
                setupSmoothNav();
                initNavbarScroll();
            } else if (attempts++ > 50) {
                clearInterval(checkLoader);
            }
        }, 100);
    }

    function setupSmoothNav() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.onclick = (e) => {
                const targetId = link.getAttribute('href');
                if (targetId && targetId.startsWith('#')) {
                    e.preventDefault();
                    const targetEl = document.querySelector(targetId);
                    if (targetEl) {
                        const offset = 80; // Navbar height offset
                        const targetPos = targetEl.getBoundingClientRect().top + window.pageYOffset - offset;
                        
                        window.scrollTo({
                            top: targetPos,
                            behavior: 'smooth'
                        });
                    }
                }
            };
        });
    }

    function initScrollAnimations() {
        if (!window.ScrollTrigger) return;

        // Revelar secciones sutilmente al hacer scroll
        const sections = [
            '#products-section',
            '#services-section',
            '#licencias-section',
            '#playlists-section',
            '#faq-section'
        ];

        sections.forEach(sel => {
            const el = document.querySelector(sel);
            if (!el) return;

            gsap.from(el, {
                scrollTrigger: {
                    trigger: el,
                    start: "top 85%", // Empieza cuando el tope de la sección llega al 85% del viewport
                    toggleActions: "play none none none"
                },
                autoAlpha: 0,
                y: 40,
                duration: 1,
                ease: "power2.out"
            });
        });
    }
    function initNavbarScroll() {
        const checkNav = setInterval(() => {
            const nav = document.querySelector('.prof-nav');
            if (nav) {
                clearInterval(checkNav);
                window.addEventListener('scroll', () => {
                    nav.classList.toggle('scrolled', window.scrollY > 50);
                });
            }
        }, 100);
    }

    function initTabs() {
        const categories = ['BEATS', 'DRUMKITS', 'LOOPKITS', 'PRESETS'];
        const tabsContainer = document.getElementById('product-tabs');
        if (!tabsContainer) return;

        let visibleCategories = categories.filter(cat => {
            if (isOwner) return true;
            const count = allProducts.filter(p => {
                const type = (p.product_type || '').toUpperCase();
                if (cat === 'BEATS') return type === 'BEAT';
                if (cat === 'DRUMKITS') return type === 'DRUMKIT';
                if (cat === 'LOOPKITS') return type === 'LOOPKIT';
                if (cat === 'PRESETS') return type.includes('PRESET') || type === 'TEMPLATE';
                return false;
            }).length;
            return count > 0;
        });

        if (visibleCategories.length > 0) {
            document.getElementById('products-section').style.display = 'block';
            tabsContainer.innerHTML = `<div class="tabs-inner">` + visibleCategories.map(cat => 
                `<button class="tab-trigger" onclick="switchTab('${cat}')">${cat}</button>`
            ).join('') + `</div>`;
            switchTab(visibleCategories[0]);
            initShelfNavigation('products-grid', 'products-prev', 'products-next');
        }
    }

    function initShelfNavigation(shelfId, prevId, nextId) {
        const shelf = document.getElementById(shelfId);
        const prevBtn = document.getElementById(prevId);
        const nextBtn = document.getElementById(nextId);
        
        if (!shelf || !prevBtn || !nextBtn) return;

        const updateArrows = () => {
            if (shelf.scrollLeft <= 5) {
                prevBtn.classList.add('disabled');
            } else {
                prevBtn.classList.remove('disabled');
            }
            if (shelf.scrollLeft >= shelf.scrollWidth - shelf.clientWidth - 5) {
                nextBtn.classList.add('disabled');
            } else {
                nextBtn.classList.remove('disabled');
            }
        };

        prevBtn.onclick = () => {
            const card = shelf.querySelector('.premium-product-card');
            const scrollAmount = card ? (card.clientWidth + 16) * 2 : 400;
            shelf.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        };
        nextBtn.onclick = () => {
            const card = shelf.querySelector('.premium-product-card');
            const scrollAmount = card ? (card.clientWidth + 16) * 2 : 400;
            shelf.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        };
        
        shelf.addEventListener('scroll', updateArrows);
        window.addEventListener('resize', updateArrows);
        setTimeout(updateArrows, 100);
    }

    // --- EXPOSED FUNCTIONS ---
    window.switchTab = function(cat) {
        const filtered = allProducts.filter(p => {
            const type = (p.product_type || '').toUpperCase();
            if (cat === 'BEATS') return type === 'BEAT';
            if (cat === 'DRUMKITS') return type === 'DRUMKIT';
            if (cat === 'LOOPKITS') return type === 'LOOPKIT';
            if (cat === 'PRESETS') return type.includes('PRESET') || type === 'TEMPLATE';
            return false;
        });

        window.currentTabProducts = filtered; // For StickyPlayer
        
        // Limit to 5 products max as requested
        const maxProducts = filtered.slice(0, 5);
        PremiumRender.renderProducts('products-grid', maxProducts, cat, userNickname, isOwner);
        
        document.querySelectorAll('.tab-trigger').forEach(t => {
            t.classList.toggle('active', t.innerText === cat);
        });

        // Animación de entrada para los nuevos productos cargados
        gsap.from(".premium-product-card", {
            autoAlpha: 0,
            y: 30,
            stagger: 0.06,
            duration: 0.7,
            ease: "power3.out",
            clearProps: "opacity,visibility,transform"
        });

        const viewAllBtn = document.getElementById('view-all-products');
        if (viewAllBtn) {
            const catMap = { 'BEATS': 'beat', 'DRUMKITS': 'drumkit', 'LOOPKITS': 'loopkit', 'PRESETS': 'preset' };
            viewAllBtn.onclick = () => window.location.href = `/search.html?cat=${catMap[cat]}&producer=${userNickname}`;
        }
        
        // Reset scroll position when switching tabs
        const shelf = document.getElementById('products-grid');
        if (shelf) {
            shelf.scrollLeft = 0;
            setTimeout(() => shelf.dispatchEvent(new Event('scroll')), 50);
        }
    };

    window.handlePlay = function(e, index) {
        if (e) e.stopPropagation();
        if (window.StickyPlayer && window.currentTabProducts && window.currentTabProducts[index]) {
            const productsWithMeta = window.currentTabProducts.map(p => ({
                ...p,
                artist_users: { nickname: userNickname }
            }));
            window.StickyPlayer.loadTrack(productsWithMeta[index], productsWithMeta);
        }
    };

    window.handleLike = async function(e, productId, producerId) {
        if (e) e.stopPropagation();
        if (!window.FavoritesManager) return;
        
        const btn = document.getElementById(`like-btn-${productId}`);
        
        // toggleLike handles auth check, guest modal, api call and UI icon toggle
        await window.FavoritesManager.toggleLike(productId, btn);
    };

    window.toggleFaq = function(btn) {
        const item = btn.parentElement;
        const isActive = item.classList.contains('active');
        document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
        if (!isActive) item.classList.add('active');
    };

})();
