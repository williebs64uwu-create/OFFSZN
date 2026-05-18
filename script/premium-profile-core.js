/**
 * Premium Profile - Core Engine
 * Handles data fetching, section compiling, and RendererEngine initialization.
 */

(function() {
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

        window.IS_LIVE_PROFILE = true;

        AuthUtils.initSupabase();
        const supabase = window.supabaseClient;

        try {
            // 1. Fetch live data from Supabase
            const [userRes, productsRes, configRes, currentUser] = await Promise.all([
                supabase.from('users').select('*').eq('id', userId).single(),
                supabase.from('products').select('*').eq('producer_id', userId).eq('visibility', 'public').order('created_at', { ascending: false }),
                supabase.from('store_configs').select('config_json').eq('user_id', userId).maybeSingle(),
                AuthUtils.getCurrentUser()
            ]);

            isOwner = currentUser && currentUser.id === userId;
            window.IS_OWNER = isOwner;

            if (!userRes.data) {
                console.error("❌ User not found");
                hideInitialLoader();
                return;
            }

            const user = userRes.data;
            userNickname = user.nickname || "Artista";
            window.builderNickname = userNickname;
            window.userNickname = userNickname;

            const userAvatar = user.avatar_url || "";
            const userBio = user.bio || "";
            const userEmail = user.email || (currentUser ? currentUser.email : "contacto@offszn.lat");
            const socials = user.socials || {};
            const playlists = socials.playlists || [];
            const services = socials.custom_services || [];

            // 2. Parse License Settings with safe defaults
            const systemDefaults = {
                basic: { name: 'Basic Lease', price: 20, enabled: true, usage: { streams: '50000', sales: '2000', radio: 'No Permitido' }, files: { mp3: true, wav: false, stems: false }, publishing: 50, royalties: 50, is_favorite: false },
                premium: { name: 'Premium Lease', price: 50, enabled: true, usage: { streams: '500000', sales: '5000', radio: '2 Estaciones' }, files: { mp3: true, wav: true, stems: false }, publishing: 50, royalties: 50, is_favorite: false },
                trackout: { name: 'Trackout Lease', price: 100, enabled: true, usage: { streams: '1000000', sales: '10000', radio: 'ILIMITADO' }, files: { mp3: true, wav: true, stems: true }, publishing: 50, royalties: 50, is_favorite: false },
                unlimited: { name: 'Unlimited License', price: 300, enabled: true, usage: { streams: 'UNLIMITED', sales: 'UNLIMITED', radio: 'ILIMITADO' }, files: { mp3: true, wav: true, stems: true }, publishing: 50, royalties: 50, is_favorite: false }
            };

            let finalSettings = [];
            const baseSettings = user.license_settings || {};

            ['basic', 'premium', 'trackout', 'unlimited'].forEach((key, index) => {
                let userLic = {};
                if (key === 'trackout') {
                    userLic = baseSettings['offszn_unlimited'] || baseSettings['trackout'] || {};
                } else if (key === 'unlimited') {
                    userLic = baseSettings['offszn_exclusive'] || baseSettings['unlimited'] || {};
                } else {
                    userLic = baseSettings[`offszn_${key}`] || baseSettings[key] || {};
                }
                const sysLic = systemDefaults[key];
                
                // If the license specifically exists in the database, respect its true enabled state.
                // If it doesn't exist, default to system defaults (which is true in systemDefaults).
                const enabled = (userLic.enabled !== undefined) ? (userLic.enabled !== false && userLic.enabled !== 'false' && userLic.enabled !== "") : true;

                if (enabled) {
                    finalSettings.push({
                        id: key,
                        nombre: userLic.name || sysLic.name,
                        precio: userLic.price !== undefined ? userLic.price : sysLic.price,
                        isFeatured: (key === 'premium') || (index === 1),
                        publishing: userLic.publishing !== undefined ? userLic.publishing : sysLic.publishing,
                        royalties: userLic.royalties !== undefined ? userLic.royalties : sysLic.royalties,
                        files: {
                            mp3: true,
                            wav: userLic.files?.wav !== undefined ? !!userLic.files?.wav : sysLic.files.wav,
                            stems: userLic.files?.stems !== undefined ? !!userLic.files?.stems : sysLic.files.stems
                        },
                        is_favorite: !!userLic.is_favorite,
                        usage: {
                            streams: userLic.usage?.streams || userLic.streams || sysLic.usage.streams,
                            sales: userLic.usage?.sales || userLic.sales || sysLic.usage.sales,
                            radio: userLic.usage?.radio || userLic.radio || sysLic.usage.radio
                        }
                    });
                }
            });

            // Sort favorites to the top
            finalSettings.sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));

            // 3. Setup dynamic theme properties
            let configJson = null;
            if (configRes && configRes.data && configRes.data.config_json) {
                configJson = configRes.data.config_json;
            }

            const theme = (configJson && configJson.theme) || {};
            const appEl = document.getElementById('app');
            if (appEl) {
                if (theme.primaryColor) {
                    appEl.style.setProperty('--theme-primary', theme.primaryColor);
                    document.documentElement.style.setProperty('--accent-white', theme.primaryColor);
                }
                if (theme.backgroundColor) {
                    appEl.style.setProperty('--theme-bg', theme.backgroundColor);
                    document.documentElement.style.setProperty('--bg-dark', theme.backgroundColor);
                }
                if (theme.fontFamily) {
                    appEl.style.setProperty('--theme-font', theme.fontFamily);
                    document.documentElement.style.setProperty('--font-family', theme.fontFamily);
                    document.body.style.fontFamily = theme.fontFamily;
                }
            }

            // Products list
            allProducts = productsRes.data || [];
            window.currentTabProducts = allProducts.filter(p => (p.product_type || '').toUpperCase() === 'BEAT');

            // 4. Compile dynamic sections list
            let sectionsList = [];
            if (configJson && configJson.sections && configJson.sections.length > 0) {
                sectionsList = JSON.parse(JSON.stringify(configJson.sections));
            } else {
                // Fallback default premium layout
                sectionsList = [
                    { id: 'sec-navbar', type: 'navbar', props: {} },
                    { id: 'sec-hero', type: 'hero', props: {} },
                    { id: 'sec-products', type: 'products', props: {} },
                    { id: 'sec-licenses', type: 'licenses', props: {} },
                    { id: 'sec-services', type: 'services', props: {} },
                    { id: 'sec-playlists', type: 'playlists', props: {} },
                    { id: 'sec-faq', type: 'faq', props: {} },
                    { id: 'sec-footer', type: 'footer', props: {} }
                ];
            }

            // Populates real live DB values for each active section
            const compiledSections = sectionsList.map(sec => {
                const section = { ...sec };
                section.props = section.props || {};

                switch (section.type) {
                    case 'navbar':
                        // Use customized links from builder config if they exist
                        if (!section.props.links || section.props.links.length === 0) {
                            const enabledLinks = ['BEATS'];
                            if (finalSettings.length > 0) enabledLinks.push('SOBRE MI'); // Map to licencias/sobrediseño
                            if (services.length > 0) enabledLinks.push('SERVICIOS');
                            if (playlists.length > 0) enabledLinks.push('PLAYLISTS');
                            enabledLinks.push('FAQ');
                            section.props.links = enabledLinks;
                        }
                        if (!section.props.logoText) {
                            section.props.logoText = userNickname;
                        }
                        if (!section.props.avatarUrl) {
                            section.props.avatarUrl = userAvatar;
                        }
                        break;

                    case 'hero':
                        // Use customized hero title and subtitle from builder if they exist
                        if (!section.props.title) {
                            section.props.title = userNickname;
                        }
                        if (!section.props.subtitle) {
                            section.props.subtitle = userBio;
                        }
                        if (!section.props.avatarUrl) {
                            section.props.avatarUrl = userAvatar;
                        }
                        break;

                    case 'products':
                        section.props.products = allProducts;
                        section.props.userNickname = userNickname;
                        break;

                    case 'licenses':
                        section.props.licenses = finalSettings;
                        break;

                    case 'services':
                        section.props.services = services;
                        section.props.userAvatar = userAvatar;
                        break;

                    case 'playlists':
                        section.props.playlists = playlists;
                        break;

                    case 'faq':
                        section.props.email = userEmail;
                        break;

                    case 'footer':
                        section.props.socials = socials;
                        break;
                }
                return section;
            });

            // 5. Render Everything with RendererEngine
            const mainApp = document.getElementById('app');
            const state = {
                sections: compiledSections,
                theme: theme
            };
            const engine = new window.RendererEngine(mainApp, state);
            engine.render(state);

            // No need to load duplicate static nav/footers anymore as engine renders them dynamically

            // Check Subscription Status
            if (isOwner) {
                checkSubscriptionStatus(supabase, currentUser.id);
            }

            // Fire Particles Background
            if (window.initParticles) window.initParticles();

            // Bind grab drag scroll
            if (window.bindDragScroll) {
                window.bindDragScroll();
            }

            hideInitialLoader();
        } catch (err) {
            console.error("❌ Error loading profile data:", err);
            hideInitialLoader();
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
                loader.style.display = 'none';
            }, 500);
        }
        
        const heroContent = document.getElementById('hero-content');
        if (heroContent) {
            heroContent.style.opacity = '1';
            heroContent.style.transform = 'translateY(0)';
            heroContent.style.transition = 'all 0.5s ease-out';
        }
    }

    function initLoaderUI(user) {
        let attempts = 0;
        const checkLoader = setInterval(() => {
            if (window.ProfLoader) {
                window.ProfLoader.init(user);
                clearInterval(checkLoader);
                initNavbarScroll();
            } else if (attempts++ > 50) {
                clearInterval(checkLoader);
            }
        }, 100);
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

    // --- PUBLIC DRAG TO SCROLL ENGINE ---
    window.bindDragScroll = function(rootEl) {
        const parent = rootEl || document;
        const horizontalContainers = parent.querySelectorAll('.products-shelf, .premium-lic-grid, .shelf-container, .filter-pills, .tabs-inner');
        
        horizontalContainers.forEach(el => {
            if (el.dataset.dragBound) return;
            el.dataset.dragBound = 'true';
            
            let isDown = false;
            let startX;
            let scrollLeft;
            
            el.style.cursor = 'grab';
            
            el.addEventListener('mousedown', (e) => {
                if (e.target.closest('button, a, input, select, textarea, .explore-heart-action, .explore-play-action, .tab-trigger, .pill')) {
                    return;
                }
                isDown = true;
                el.style.cursor = 'grabbing';
                startX = e.pageX - el.offsetLeft;
                scrollLeft = el.scrollLeft;
                e.stopPropagation();
                e.preventDefault();
            });
            
            el.addEventListener('mouseleave', () => {
                isDown = false;
                el.style.cursor = 'grab';
            });
            
            el.addEventListener('mouseup', () => {
                isDown = false;
                el.style.cursor = 'grab';
            });
            
            el.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                e.stopPropagation();
                e.preventDefault();
                const x = e.pageX - el.offsetLeft;
                const walk = (x - startX) * 1.5;
                el.scrollLeft = scrollLeft - walk;
            });
        });
    };

    window.toggleFaq = function(btn) {
        const item = btn.parentElement;
        const isActive = item.classList.contains('active');
        document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
        if (!isActive) item.classList.add('active');
    };

})();
