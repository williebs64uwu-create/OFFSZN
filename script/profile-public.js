
// Logic for displaying public profile data based on /@username URL

const supabase = window.supabaseClient; // Initialized by auth-utils.js
window.activeWavesurfers = window.activeWavesurfers || [];
window.currentlyPlaying = window.currentlyPlaying || null;

/**
 * Sanitizes HTML to prevent XSS.
 * Required by security protocols.
 */
function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', async () => {
    // 0. INITIALIZE REVEAL PROMISES (Master Coordination)
    window.profileTimerPromise = new Promise(res => setTimeout(res, 2300));

    // Signals to reveal the content (Fired after preparation + timer)
    let triggerReveal;
    window.profileRevealSignal = new Promise(res => {
        triggerReveal = () => {
            // console.log("[Profile] Reveal Signal Fired!");
            res();
        };
    });
    window.triggerProfileReveal = triggerReveal;

    // 🔥 SAFETY: Force reveal after 5 seconds if something hangs
    setTimeout(() => {
        if (window.triggerProfileReveal) window.triggerProfileReveal();
    }, 5000);

    // 🔥 SPA FIX: Reset loading lock in case router re-triggered DOMContentLoaded
    isLoadingProducts = false;

    // 1. SAFETY CHECK: Only run if on Profile Page
    if (!document.getElementById('profile-root')) return;

    // 🔥 SPA FIX: Reset header-loaded so skeletons show fresh on re-navigation
    const profileRootInit = document.getElementById('profile-root');
    if (profileRootInit) profileRootInit.classList.remove('header-loaded');

    // 1. Get Username from URL
    // 1. Get Username from URL
    // Supports: /@willie, /u/willie, and /willie
    const path = window.location.pathname;
    let username = null;

    const atMatch = path.match(/\/@(.+)/);
    const uMatch = path.match(/\/u\/(.+)/);

    if (atMatch) {
        username = atMatch[1];
    } else if (uMatch) {
        username = uMatch[1];
    } else if (path !== '/' && !path.includes('.')) {
        // Root path fallback (e.g. /willieinspired)
        // Strip leading slash
        username = path.substring(1);
    }

    // --- PATCH: Support ?id=UUID for explicit routing ---
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get('id');

    if (idParam) {
        // If we have an ID, we need to fetch the username first to satisfy the rest of the flow
        // OR we can just load by ID. But let's fetch the username for consistency.
        try {
            const { data: uData, error } = await supabase.from('users').select('nickname').eq('id', idParam).single();
            if (uData && uData.nickname) {
                username = uData.nickname;
                // Update URL to be pretty (optional, but nice)
                window.history.replaceState({}, '', `/@${username}`);
            } else {
            }
        } catch (err) {
            // console.error("Error resolving ID to nickname:", err);
        }
    }

    if (!username) {
        // console.error("No username found in URL");
        // Optional: Redirect to 404 or home
        return;
    }

    // const username = match[1]; // REMOVED
    // console.log("Loading profile for:", username);

    // 3. Setup Following Data & Helper
    window.currentUserFollowing = new Set();
    window.currentUserId = null;
    window.profileInitPromise = Promise.resolve();

    const token = window.getAccessToken(); // Use GLOBAL
    if (token) {
        // Fetch both following list and current user identity in parallel
        window.profileInitPromise = Promise.all([
            fetch('/api/me/following', { headers: window.AuthUtils.getAuthHeaderObj() })
                .then(r => r.ok ? r.json() : [])
                .catch(err => []),
            fetch('/api/me', { headers: window.AuthUtils.getAuthHeaderObj() })
                .then(r => r.ok ? r.json() : null)
                .catch(err => null)
        ]).then(([ids, me]) => {
            if (Array.isArray(ids)) window.currentUserFollowing = new Set(ids);
            if (me && me.id) window.currentUserId = me.id;
            // console.log("Profile Init Data Loaded:", { following: window.currentUserFollowing.size, me: window.currentUserId });
        });
    }

    // 3. Fetch User Profile
    await loadUserProfile(username);
});

async function loadUserProfile(username) {
    const profileRoot = document.getElementById('profile-root');
    const loadingBar = document.getElementById('top-loading-bar');

    // --- START LOADING BAR ---
    if (loadingBar) {
        loadingBar.classList.add('loading');
        loadingBar.style.width = '30%';
    }

    // --- ANTI-FOUC SYNC ---
    // Check if the early head-script already applied a template class
    const tplApplied = document.documentElement.className.match(/template-[^\s]+/);

    if (tplApplied) {
        // If template is already known, just ensure profileRoot is ready
        if (profileRoot) {
            profileRoot.style.opacity = '1';
            // Sync class to root for legacy selectors
            profileRoot.classList.add(tplApplied[0]);
        }
    } else if (profileRoot) {
        // If unknown user, hide root until we fetch the data
        profileRoot.style.opacity = '0';
    }

    try {
        // Switch to the stable public users endpoint
        const response = await fetch(`/api/users/${username}`);

        if (!response.ok) {
            throw new Error('Usuario no encontrado');
        }

        const user = await response.json();
        console.log("DEBUG: Perfil cargado:", user.nickname, "Template:", user.template);
        window.currentUserProfile = user; // Store for tab rendering

        // --- 30-DAY TRIAL INITIALIZATION ---
        const isMe = window.currentUserId && (user.id === window.currentUserId);
        if (isMe && user.plan === 'free' && !user.plan_start_date) {
            console.log("[Trial] Initializing 30-day trial for owner...");
            const now = new Date().toISOString();
            await window.supabaseClient
                .from('users')
                .update({ plan_start_date: now })
                .eq('id', user.id);
            user.plan_start_date = now;
        }

        // --- CACHE TEMPLATE ---
        // Save the template for this user so we can predict it next time
        if (user.nickname && user.template) {
            localStorage.setItem(`tpl_${user.nickname.toLowerCase()}`, user.template);
        }

        // Wait for auth/following data to be ready before rendering header
        if (window.profileInitPromise) {
            await window.profileInitPromise;
        }

        // 2. Apply Template Class
        // 🔥 CRITICAL: ALWAYS clean up previous template classes, even if new profile has no template
        if (profileRoot) {
            const targets = [document.documentElement, document.body, profileRoot];
            targets.forEach(el => {
                const toRemove = [];
                el.classList.forEach(cls => {
                    if (cls.startsWith('template-')) toRemove.push(cls);
                });
                toRemove.forEach(cls => el.classList.remove(cls));
            });
        }

        if (profileRoot && user.template) {
            profileRoot.classList.add(`template-${user.template}`);
            document.documentElement.classList.add(`template-${user.template}`);

            const tabs = document.getElementById('profileTabs');
            const productList = document.getElementById('profileProductsList');
            const headerContent = document.querySelector('.profile-header-content');

            // Special case for Old School: reposition tabs to the main content area
            if (user.template === 'produccion_template_old_school') {
                const profileBody = document.querySelector('.profile-body');
                const proToolbar = document.querySelector('.pro-toolbar-container');
                if (tabs && profileBody) {
                    if (proToolbar) {
                        proToolbar.insertAdjacentElement('beforebegin', tabs);
                    } else {
                        profileBody.prepend(tabs);
                    }
                }

                // El skeleton de Old School ya viene hardcodeado en el HTML y se muestra vía CSS para evitar Layout Shift

                // Add grid-view class to the products list container
                if (productList) {
                    productList.classList.add('grid-view');
                }
            } else {
                // 🔥 RESET LOGIC: Revert Old School changes if template is anything else
                const profileDetails = document.querySelector('.profile-details');
                if (tabs && profileDetails) {
                    // Move tabs back to their original position in the bio/details area
                    profileDetails.appendChild(tabs);
                }
                if (productList) {
                    productList.classList.remove('grid-view');
                }
            }
        }

        // 2.5 REVEAL profile root now that the correct template layout is applied
        if (profileRoot) {
            void profileRoot.offsetWidth; // Force reflow so grid layout is computed
            profileRoot.style.transition = 'opacity 0.25s ease';
            profileRoot.style.opacity = '1';
        }

        // 3. Render Header Data (IMMEDIATE INITIAL POPULATION)
        // We render this immediately so elements exist, but skeletons still cover them.
        renderHeader(user, window.profileCategoryCounts);

        // 3.1 Inject Dynamic SEO for Profiles
        injectProfileSEO(user);

        // 4. Fetch User Products (via API) - SYNC WAIT
        // This ensures productsCache and other variables are ready.
        await loadUserProducts(user);
        renderGlobalPlaylists(user);

        // --- FINISH LOADING BAR ---
        if (loadingBar) {
            loadingBar.style.width = '100%';
            setTimeout(() => {
                loadingBar.classList.remove('loading');
                loadingBar.style.opacity = '0';
                setTimeout(() => { loadingBar.style.width = '0%'; }, 300);
            }, 400);
        }

        // 🔥 ATOMIC REVEAL COORDINATION
        // 1. Wait for the standard premium delay promise (master coordination)
        if (window.profileTimerPromise) await window.profileTimerPromise;

        // 2. Ensure everything is rendered in the DOM before we lose skeletons
        // (Note: loadUserProducts already populated productsCache, 
        // but we might need to re-trigger renderProductList if it was waiting on a signal)
        // Actually, renderProductList was called by loadUserProducts, so it already ran.

        // 3. Signal internal reveal (in case anything else is waiting)
        if (window.triggerProfileReveal) window.triggerProfileReveal();

        // 4. FINAL REVEAL: Add class to remove all skeletons simultaneously
        if (profileRoot) {
            profileRoot.classList.add('header-loaded');
            
            // Safety: ensure opacity is 1 if it wasn't already
            profileRoot.style.opacity = '1';

            // Ensure default tab content is correctly displayed
            window.setActiveTab('products');
        }

    } catch (e) {
        console.error("Error loading profile:", e);
        if (profileRoot) profileRoot.style.opacity = '1';
        if (loadingBar) {
            loadingBar.classList.remove('loading');
            loadingBar.style.opacity = '0';
        }
        document.getElementById('profileName').innerText = "Usuario no encontrado";
        document.getElementById('profileBio').innerText = "No se pudo cargar el perfil.";
    }
}

async function renderHeader(user, categoryCounts = null) {
    // --- TEMPLATE BRANCHING ---
    if (user.template === 'produccion_template_old_school') {
        renderOldSchoolSidebar(user, categoryCounts);
        return;
    }

    // 1. Avatar Setup
    // We render the container immediately with either the public URL (Supabase) or a transparent placeholder (R2).
    // R2 Authorization happens in the background.

    const isR2 = window.AuthUtils && window.AuthUtils.isR2Url && window.AuthUtils.isR2Url(user.avatar_url);
    const isAvExternalOpt = user.avatar_url && (user.avatar_url.includes('ik.imagekit.io') || user.avatar_url.includes('cloudinary.com'));

    const avatarContainer = document.getElementById('profileAvatar');

    if (user.avatar_url) {
        // Default to public URL or Placeholder
        const placeholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        let currentSrc = (isR2 && !isAvExternalOpt) ? placeholder : user.avatar_url;
        let diffOpacity = (isR2 && !isAvExternalOpt) ? 0 : 1;

        avatarContainer.innerHTML = '';
        const avatarImg = document.createElement('img');
        // avatarImg.crossOrigin = 'anonymous';
        avatarImg.src = currentSrc;
        if (isR2) {
            // dataset.r2Src removed to prevent r2-loader conflict since we fetch it below
            avatarImg.dataset.r2Version = user.r2_version || 'v2';
        }
        avatarImg.id = 'profileAvatarImg';
        avatarImg.alt = user.nickname || 'Avatar';
        avatarImg.className = 'skeleton-img-transition';
        avatarImg.style.opacity = diffOpacity;
        avatarImg.onerror = function () {
            if (window.AvatarManager) window.AvatarManager.handleError(this, user.nickname || 'User');
        };
        avatarContainer.appendChild(avatarImg);

        // Background Auth for R2
        if (isR2) {
            window.getAuthorizedUrl(user.avatar_url, user.r2_version || 'v2').then(url => {
                const img = document.getElementById('profileAvatarImg');
                if (img) {
                    img.onload = () => { img.style.opacity = 1; };
                    img.src = url;
                }
            }).catch(e => console.warn("Avatar Auth Failed", e));
        }

    } else {
        const initialText = (user.nickname || "U").charAt(0).toUpperCase();
        avatarContainer.innerHTML = '';
        const span = document.createElement('span');
        span.textContent = initialText;
        avatarContainer.appendChild(span);
    }

    // Text Info
    // User requested to use Nickname specifically.
    document.getElementById('profileName').innerText = user.nickname || "User";

    // Role / Verified
    const rolePlaceholder = document.getElementById('profileRolePlaceholder');
    if (rolePlaceholder) rolePlaceholder.style.display = 'none';

    const profileMeta = document.querySelector('.profile-meta');
    if (profileMeta) profileMeta.style.display = 'flex';

    if (user.is_verified || user.is_producer || user.plan) {
        const verifyBadge = document.getElementById('profileVerified');
        verifyBadge.style.display = 'inline-block';

        // Remove previous plan classes for clean state
        verifyBadge.classList.remove('starter', 'pro');
        if (user.plan) verifyBadge.classList.add(user.plan);

        // Tooltip logic
        verifyBadge.classList.add('verified-container');
        verifyBadge.innerHTML = ''; // Clear existing

        const badgeIcon = document.createElement('i');
        badgeIcon.className = 'bi bi-patch-check-fill';
        verifyBadge.appendChild(badgeIcon);

        const tooltip = document.createElement('div');
        tooltip.className = 'verified-tooltip';

        const ttHeader = document.createElement('div');
        ttHeader.className = 'v-tooltip-header';
        const ttIcon = document.createElement('i');
        ttIcon.className = 'bi bi-patch-check-fill';
        ttHeader.appendChild(ttIcon);

        let planTitle = ' VERIFICADO OFFSZN';
        if (user.plan === 'pro') planTitle = ' OFFSZN PRO';
        else if (user.plan === 'starter') planTitle = ' OFFSZN STARTER';

        const planLink = document.createElement('a');
        planLink.href = '/cuenta/planes';
        planLink.textContent = planTitle;
        ttHeader.appendChild(planLink);
        tooltip.appendChild(ttHeader);

        const ttBody = document.createElement('div');
        ttBody.className = 'v-tooltip-body';

        let planDesc = 'Plan Premium OFFSZN';
        if (user.plan === 'pro') planDesc = 'Usuario Pro';
        else if (user.plan === 'starter') planDesc = 'Usuario Starter';

        ttBody.appendChild(document.createTextNode(planDesc));

        // Add plan start date if available
        if (user.plan_start_date) {
            const date = new Date(user.plan_start_date);
            const options = { year: 'numeric', month: 'long' };
            const dateStr = date.toLocaleDateString('es-ES', options);

            ttBody.appendChild(document.createElement('br'));
            const dateEl = document.createElement('span');
            dateEl.style.color = user.plan === 'pro' ? '#fbbf24' : '#94a3b8';
            dateEl.style.fontSize = '0.75rem';
            dateEl.style.marginTop = '4px';
            dateEl.style.display = 'inline-block';
            dateEl.textContent = `Desde ${dateStr}`;
            ttBody.appendChild(dateEl);
        }

        tooltip.appendChild(ttBody);

        verifyBadge.appendChild(tooltip);
    }

    const roleEl = document.getElementById('profileRole');
    if (roleEl) {
        const roleText = user.role || '';
        roleEl.innerText = roleText;
        const lowerRole = roleText.toLowerCase();
        // Palabras clave que indican que el rol debe ir sin fondo (Ingeniería/Mixing/Mastering)
        const keywords = ['ingeniero', 'mezcla', 'master', 'mix', 'engineer', 'ingenieria'];
        if (keywords.some(k => lowerRole.includes(k))) {
            roleEl.classList.add('no-bg');
        } else {
            roleEl.classList.remove('no-bg');
        }
    }
    document.getElementById('profileBio').innerText = user.bio || '';

    // Apply Banner Style (Aligned to Schema: using banner_url for style string)
    if (user.banner_url) {
        const header = document.querySelector('.profile-header');
        if (header) {
            const val = user.banner_url;

            // 🔥 Enhanced Banner Parsing: Support url:, gif:, solid:, gradient:
            if (val.startsWith('url:') || val.startsWith('gif:')) {
                // Extract URL (everything after the first colon)
                const url = val.substring(val.indexOf(':') + 1);
                header.style.background = `url("${url}") center/cover no-repeat`;
            } else if (val.startsWith('http')) {
                // Legacy HTTP/HTTPS URL
                header.style.background = `url("${val}") center/cover no-repeat`;
            } else if (val.includes(':')) {
                // Solid or Gradient
                const [type, color] = val.split(':');
                if (type === 'solid') {
                    header.style.background = color;
                } else if (type === 'gradient') {
                    const gradientVal = val.substring(val.indexOf(':') + 1);
                    header.style.background = gradientVal;
                } else {
                    header.style.background = color;
                }
            }
        }
    }

    // --- DYNAMIC THEME ---
    let socials = {};
    try {
        socials = typeof user.socials === 'string' ? JSON.parse(user.socials) : (user.socials || {});
    } catch (e) {
        console.error("Error parsing socials for dynamic theme:", e);
    }
    const isThemeActive = socials.dynamic_theme === true || socials.dynamic_theme === "true";
    // console.log("Dynamic Theme Status on Load:", isThemeActive);
    applyDynamicThemeEffects(user.banner_url, isThemeActive);

    // Update Modal Toggle State (if me)
    const toggle = document.getElementById('dynamicThemeToggle');
    if (toggle) toggle.checked = isThemeActive;

    // Clear Location Skeleton (Fix stuck skeleton)
    const locEl = document.getElementById('profileLocation');
    if (locEl) {
        locEl.innerText = user.location || ''; // If no location, clear it.
    }

    // --- OWNER CONTROLS DETECTION ---
    const isMe = window.currentUserId && (user.id === window.currentUserId);

    if (isMe) {
        // Show owner buttons
        const personalizeBtn = document.getElementById('btnPersonalize');
        if (personalizeBtn) personalizeBtn.style.display = 'inline-block';

        const accBtn = document.getElementById('btnAccountSettings');
        if (accBtn) accBtn.style.display = 'inline-block';

        const changeAvatarBtn = document.getElementById('ownerChangeAvatar');
        if (changeAvatarBtn) changeAvatarBtn.style.display = 'flex';
    }

    // ACTIONS: Reveal Real Buttons, Remove Skeletons
    const skelActions = document.getElementById('skeletonActions');
    if (skelActions) skelActions.style.display = 'none';

    // Renamed local variable to avoid conflict with global or lower scope
    const headerFollowBtn = document.getElementById('btnFollow');
    if (headerFollowBtn) headerFollowBtn.style.display = isMe ? 'none' : 'inline-block'; // Hide if Me

    const headerShareBtn = document.getElementById('btnShareProfileGlobal');
    if (headerShareBtn) headerShareBtn.style.display = 'inline-flex'; // Reveal

    const msgBtn = document.getElementById('btnMessage');
    if (msgBtn) {
        // Hide if viewing own profile
        if (isMe) {
            msgBtn.style.display = 'none';
        } else {
            msgBtn.style.display = 'inline-block'; // Reveal
            msgBtn.innerHTML = ''; // Clear
            const msgIcon = document.createElement('i');
            msgIcon.className = 'bi bi-chat-dots-fill';
            msgIcon.style.marginRight = '6px';
            msgBtn.appendChild(msgIcon);
            msgBtn.appendChild(document.createTextNode(' Mensaje'));

            msgBtn.onclick = () => {
                window.location.href = `/mensajes.html?user=${user.nickname}`;
            };
        }
    }

    // Socials
    const socialLinks = document.getElementById('socialLinks');
    socialLinks.innerHTML = '';

    if (user.socials) {
        try {
            const socials = typeof user.socials === 'string' ? JSON.parse(user.socials) : user.socials;
            const icons = {
                tiktok: 'bi-tiktok',
                instagram: 'bi-instagram',
                facebook: 'bi-facebook',
                youtube: 'bi-youtube',
                spotify: 'bi-spotify',
                twitter: 'bi-twitter-x',
                discord: 'bi-discord',
                website: 'bi-globe'
            };

            Object.keys(socials).forEach(key => {
                const k = key.toLowerCase();
                const val = socials[key];
                if (val && icons[k] && typeof val === 'string') {
                    const a = document.createElement('a');
                    let href = val;
                    if (!val.startsWith('http')) {
                        if (k === 'instagram') href = `https://instagram.com/${val}`;
                        else if (k === 'tiktok') href = `https://tiktok.com/@${val}`;
                        else if (k === 'twitter') href = `https://twitter.com/${val}`;
                        else if (k === 'youtube') href = `https://youtube.com/@${val}`;
                    }
                    a.href = href;
                    a.target = '_blank';
                    a.className = 'social-link';

                    const sIcon = document.createElement('i');
                    sIcon.className = `bi ${icons[k]}`;
                    a.appendChild(sIcon);

                    socialLinks.appendChild(a);
                }
            });
        } catch (e) {
            console.error("Error parsing socials:", e);
        }
    }

    // --- Main Follow Button & Stats Logic ---
    const followBtn = document.getElementById('btnFollow');
    if (followBtn) followBtn.setAttribute('data-target-id', user.id); // Tag for global sync

    // Joined Date Formatting (Removed from header as per user request)
    /*
    if (user.created_at) {
        const joinedDate = new Date(user.created_at);
        const day = joinedDate.getDate();
        const month = joinedDate.toLocaleDateString('es-ES', { month: 'long' });
        const year = joinedDate.getFullYear();
        const formattedDate = `${day} de ${month} de ${year}`;

        const joinedEl = document.getElementById('profileJoined');
        if (joinedEl) joinedEl.innerText = `Miembro desde ${formattedDate}`;
    }
    */

    // Ensure accurate counts are displayed if elements exist
    const pCountEl = document.getElementById('profileProductsCount');
    if (pCountEl) {
        // ðŸ”¥ FIX: Ensure structure is preserved and text is visible
        const count = user.products_count !== undefined ? user.products_count : 0;
        pCountEl.innerHTML = '';
        pCountEl.appendChild(document.createTextNode(`${count} `));
        const pSpan = document.createElement('span');
        pSpan.style.fontWeight = '400';
        pSpan.textContent = 'Productos';
        pCountEl.appendChild(pSpan);
    }

    const fCountEl = document.getElementById('profileFollowersCount');
    if (fCountEl) {
        const count = user.followers_count || 0;
        const label = count === 1 ? 'Seguidor' : 'Seguidores';
        fCountEl.innerHTML = '';
        fCountEl.appendChild(document.createTextNode(`${count} `));
        const fSpan = document.createElement('span');
        fSpan.style.fontWeight = '400';
        fSpan.textContent = label;
        fCountEl.appendChild(fSpan);
    }

    const followingCountEl = document.getElementById('profileFollowingCount');
    if (followingCountEl) {
        // Removed as per request: "quitemos lo de x siguiendo"
        followingCountEl.parentNode.style.display = 'none';
    }

    if (followBtn) {
        // Hide if viewing own profile
        if (isMe) {
            followBtn.style.display = 'none';
        } else {
            followBtn.style.display = 'inline-block';

            // Initial Check (Instant because we awaited the data)
            const isFollowing = window.currentUserFollowing && window.currentUserFollowing.has(user.id);
            updateButtonVisuals(followBtn, isFollowing);
        }

        followBtn.onclick = async () => {
            const token = window.getAccessToken ? window.getAccessToken() : null;
            if (!token) {
                if (window.showGuestModal) {
                    window.showGuestModal(
                        "Â¡Sigue a este productor!",
                        "Crea una cuenta para seguir a tus artistas favoritos, recibir notificaciones de nuevos lanzamientos y mÃ¡s."
                    );
                } else {
                    window.location.href = '/pages/login.html';
                }
                return;
            }

            const isFollowing = followBtn.classList.contains('following-state');
            const method = isFollowing ? 'DELETE' : 'POST';

            followBtn.disabled = true;
            try {
                const res = await fetch(`/api/users/${user.id}/follow`, {
                    method: method,
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    const newState = !isFollowing;

                    // Global Sync
                    syncFollowState(user.id, newState); // updates this button + cache + others

                    // Update Main Count specifically
                    if (fCountEl) {
                        if (data.followersCount !== undefined) {
                            fCountEl.innerText = `${data.followersCount} Seguidores`;
                        } else {
                            // Fallback
                            let current = parseInt(fCountEl.innerText) || 0;
                            if (newState) current++; else current = Math.max(0, current - 1);
                            const label = current === 1 ? 'Seguidor' : 'Seguidores';
                            fCountEl.innerText = `${current} ${label}`;
                        }
                    }
                } else if (res.status === 400) {
                    const data = await res.json();
                    showToast(data.error || "No puedes realizar esta acciÃ³n");
                }
            } catch (e) { console.error(e); }
            finally { followBtn.disabled = false; }
        };
    }
}

// --- TAB SYSTEM ---
window.setActiveTab = function (tabName) {
    // console.log("Switching to tab:", tabName);

    // Update Tab Buttons UI
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
        // Find the button that matches the tabName
        const isThisTab = btn.getAttribute('onclick').includes(`'${tabName}'`);
        btn.classList.toggle('active', isThisTab);
    });

    // Toggle Content Sections
    const trendingArea = document.querySelector('.section-header'); // Trending title
    const trendingGrid = document.getElementById('trendingGrid');
    const toolbar = document.querySelector('.pro-toolbar-container');
    const productsList = document.getElementById('profileProductsList');

    // Services & About placeholders
    let servicesSection = document.getElementById('services-section');
    let aboutSection = document.getElementById('about-section');

    // Create if not exist
    if (!servicesSection) {
        servicesSection = document.createElement('div');
        servicesSection.id = 'services-section';
        servicesSection.className = 'about-section-container'; // Use about container style
        document.querySelector('.profile-body').appendChild(servicesSection);
    }

    if (!aboutSection) {
        aboutSection = document.createElement('div');
        aboutSection.id = 'about-section';
        aboutSection.className = 'about-section-container';
        document.querySelector('.profile-body').appendChild(aboutSection);
    }

    const plSection = document.getElementById('profilePlaylistsSection');

    // Logic
    if (tabName === 'products') {
        if (trendingArea) trendingArea.style.display = 'flex';
        if (trendingGrid) trendingGrid.style.display = '';
        if (toolbar) toolbar.style.display = 'flex';
        if (productsList) productsList.style.display = 'flex';
        if (plSection) plSection.style.display = 'block';
        servicesSection.style.display = 'none';
        aboutSection.style.display = 'none';
    } else if (tabName === 'services') {
        if (trendingArea) trendingArea.style.display = 'none';
        if (trendingGrid) trendingGrid.style.setProperty('display', 'none', 'important');
        if (toolbar) toolbar.style.display = 'none';
        if (productsList) productsList.style.display = 'none';
        if (plSection) plSection.style.display = 'none';
        servicesSection.style.display = 'block';
        aboutSection.style.display = 'none';

        // Render Services Content
        renderServicesTab(servicesSection);
    } else if (tabName === 'about') {
        if (trendingArea) trendingArea.style.display = 'none';
        if (trendingGrid) trendingGrid.style.setProperty('display', 'none', 'important');
        if (toolbar) toolbar.style.display = 'none';
        if (productsList) productsList.style.display = 'none';
        if (plSection) plSection.style.display = 'none';
        servicesSection.style.display = 'none';
        aboutSection.style.display = 'block';

        // Populate Bio & Info
        renderAboutTab(aboutSection);
    }
}

function renderAboutTab(container) {
    const user = window.currentUserProfile; // Assuming it's stored globally
    if (!user) return;

    container.innerHTML = '';

    const aboutGrid = document.createElement('div');
    aboutGrid.className = 'about-grid';
    aboutGrid.style.display = 'grid';
    aboutGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
    aboutGrid.style.gap = '24px';
    aboutGrid.style.marginTop = '20px';

    // Biografía Card
    const bioCard = document.createElement('div');
    bioCard.className = 'about-card';
    bioCard.style.cssText = 'background: #111; padding: 24px; border-radius: 12px; border: 1px solid #222;';

    const bioTitle = document.createElement('h4');
    bioTitle.style.cssText = 'color: #8b5cf6; margin-bottom: 12px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;';
    bioTitle.textContent = 'Biografí­a';
    bioCard.appendChild(bioTitle);

    const bioText = document.createElement('p');
    bioText.style.cssText = 'color: #ccc; line-height: 1.6; font-size: 0.95rem; white-space: pre-wrap;';
    bioText.textContent = user.bio || "Sin biografí­a disponible.";
    bioCard.appendChild(bioText);

    aboutGrid.appendChild(bioCard);

    // Detalles Card
    const detailsCard = document.createElement('div');
    detailsCard.className = 'about-card';
    detailsCard.style.cssText = 'background: #111; padding: 24px; border-radius: 12px; border: 1px solid #222;';

    const detailsTitle = document.createElement('h4');
    detailsTitle.style.cssText = 'color: #8b5cf6; margin-bottom: 20px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;';
    detailsTitle.textContent = 'Detalles';
    detailsCard.appendChild(detailsTitle);

    const detailsList = document.createElement('div');
    detailsList.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

    const createDetailItem = (label, value, isLast = false) => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
        if (!isLast) item.style.borderBottom = '1px solid #222';
        if (!isLast) item.style.paddingBottom = '12px';

        const labelSpan = document.createElement('span');
        labelSpan.style.cssText = 'color: #666; font-size: 0.85rem;';
        labelSpan.textContent = label;

        const valueSpan = document.createElement('span');
        valueSpan.style.cssText = 'color: #fff; font-weight: 600; font-size: 0.9rem;';
        valueSpan.textContent = value;

        item.appendChild(labelSpan);
        item.appendChild(valueSpan);
        return item;
    };

    detailsList.appendChild(createDetailItem('Experiencia', user.experience ? user.experience[0] : 'No especificada'));
    detailsList.appendChild(createDetailItem('DAW Principal', (user.daws && user.daws.length > 0) ? user.daws[0] : 'No especificado'));

    const joinedLabel = 'Miembro desde';
    const joinedDate = (() => {
        const d = new Date(user.created_at);
        return `${d.getDate()} de ${d.toLocaleDateString('es-ES', { month: 'long' })} de ${d.getFullYear()}`;
    })();
    detailsList.appendChild(createDetailItem(joinedLabel, joinedDate, true));

    detailsCard.appendChild(detailsList);
    aboutGrid.appendChild(detailsCard);

    container.appendChild(aboutGrid);
}

function renderGlobalPlaylists(user) {
    if (!user) return;
    const container = document.getElementById('playlists-feed-container');
    if (!container) return;

    container.innerHTML = '';
    const socials = user.socials || {};
    const playlists = socials.playlists || [];
    const isMe = window.currentUserId && (user.id === window.currentUserId);

    if (playlists.length === 0 && !isMe) {
        const section = document.getElementById('profilePlaylistsSection');
        if (section) section.style.display = 'none';
        
        const skel = document.getElementById('playlistsSkeleton');
        if (skel) skel.style.display = 'none';
        return;
    }

    // Hide Skeleton, Show Container
    const skel = document.getElementById('playlistsSkeleton');
    if (skel) skel.style.display = 'none';
    container.style.display = 'grid';

    const playlistSection = document.createElement('div');
    playlistSection.className = 'playlists-grid-offszn';
    playlistSection.id = 'playlists-grid-main';

    playlists.forEach(pl => {
        const card = document.createElement('div');
        card.className = 'playlist-card-spotify';
        card.style.position = 'relative'; 
        
        let ownerControls = '';
        if (isMe) {
            ownerControls = `
                <div style="position: absolute; top: 12px; right: 12px; display: flex; gap: 8px; z-index: 10;">
                    <button onclick="window.ServicesManager.editItem('playlist', '${pl.id}'); event.stopPropagation();" style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: background 0.2s;"><i class="bi bi-pencil-fill" style="font-size: 0.8rem;"></i></button>
                    <button onclick="window.ServicesManager.deleteItem('playlist', '${pl.id}'); event.stopPropagation();" style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); border: none; color: #ff4d4d; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: background 0.2s;"><i class="bi bi-trash-fill" style="font-size: 0.8rem;"></i></button>
                </div>
            `;
        }

        card.innerHTML = `
            ${ownerControls}
            <div class="playlist-cover-wrapper">
                <img src="${pl.cover_url || 'https://ik.imagekit.io/offszn/placeholder_playlist.png'}" alt="${pl.title}">
                <div class="playlist-play-overlay"><i class="bi bi-play-fill"></i></div>
            </div>
            <div class="playlist-info">
                <h4>${escapeHTML(pl.title)}</h4>
                <p>${pl.track_ids ? pl.track_ids.length : 0} Productos</p>
            </div>
        `;
        card.onclick = () => window.ServicesManager.openPlaylist(pl.id);
        playlistSection.appendChild(card);
    });

    if (isMe) {
        const placeholder = document.createElement('div');
        placeholder.className = 'service-card-placeholder';
        placeholder.id = 'playlist-placeholder-card';
        placeholder.innerHTML = `
            <i class="bi bi-plus-lg"></i>
            <span>Nueva Playlist</span>
        `;
        placeholder.onclick = () => {
             window.ServicesManager.openAddModal('playlist');
        };
        playlistSection.appendChild(placeholder);
    }

    container.appendChild(playlistSection);
}

function renderServicesTab(container) {
    const user = window.currentUserProfile;
    if (!user) return;

    container.innerHTML = '';
    const servicesContainer = document.createElement('div');
    servicesContainer.className = 'services-container';
    servicesContainer.style.marginTop = '20px';

    const socials = user.socials || {};
    const customServices = socials.custom_services || [];
    const isMe = window.currentUserId && (user.id === window.currentUserId);

    // --- RENDER CUSTOM SERVICES ---
    if (customServices.length > 0 || isMe) {
        const servicesGrid = document.createElement('div');
        servicesGrid.className = 'services-grid-redesign';
        servicesGrid.id = 'services-grid-main';


        customServices.forEach(s => {
            const card = document.createElement('div');
            card.className = 'service-card-premium';
            card.id = s.id;
            // ... (keeping icon logic same)

            // Logic for iframe embeds (like Spotify)
            let embedHtml = '';
            if (s.link && s.link.includes('open.spotify.com')) {
                let embedUrl = '';
                if (s.link.includes('/playlist/')) {
                    const id = s.link.split('/playlist/')[1].split('?')[0];
                    embedUrl = `https://open.spotify.com/embed/playlist/${id}?utm_source=generator&theme=0`;
                } else if (s.link.includes('/track/')) {
                    const id = s.link.split('/track/')[1].split('?')[0];
                    embedUrl = `https://open.spotify.com/embed/track/${id}?utm_source=generator&theme=0`;
                } else if (s.link.includes('/album/')) {
                    const id = s.link.split('/album/')[1].split('?')[0];
                    embedUrl = `https://open.spotify.com/embed/album/${id}?utm_source=generator&theme=0`;
                }

                if (embedUrl) {
                    const height = s.link.includes('/track/') ? '152' : '352';
                    embedHtml = `<iframe style="border-radius:12px; margin-top: 16px; width: 100%; border: none;" src="${embedUrl}" width="100%" height="${height}" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
                }
            }

            let ownerControls = '';
            if (isMe) {
                ownerControls = `
                    <div style="display: flex; gap: 8px;">
                        <button onclick="window.ServicesManager.editItem('service', '${s.id}'); event.stopPropagation();" style="background: rgba(255,255,255,0.05); border: none; color: #aaa; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: all 0.2s;" onmouseover="this.style.color='#fff'; this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.color='#aaa'; this.style.background='rgba(255,255,255,0.05)';"><i class="bi bi-pencil-fill" style="font-size: 0.8rem;"></i></button>
                        <button onclick="window.ServicesManager.deleteItem('service', '${s.id}'); event.stopPropagation();" style="background: rgba(255,255,255,0.05); border: none; color: #ff4d4d; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: all 0.2s;" onmouseover="this.style.color='#fff'; this.style.background='rgba(255,100,100,0.2)';" onmouseout="this.style.color='#ff4d4d'; this.style.background='rgba(255,255,255,0.05)';"><i class="bi bi-trash-fill" style="font-size: 0.8rem;"></i></button>
                    </div>
                `;
            }

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        ${s.category ? `<span class="service-category-tag">${escapeHTML(s.category)}</span>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${!embedHtml && s.link ? `<a href="${s.link}" target="_blank" class="service-link-btn" style="padding: 8px 16px; font-size: 0.8rem;" onclick="event.stopPropagation();">Ver Más</a>` : ''}
                        ${ownerControls}
                    </div>
                </div>
                <h3>${escapeHTML(s.title)}</h3>
                <p style="white-space: pre-line;">${escapeHTML(s.description)}</p>
                ${s.price ? `<span class="service-price">$${s.price}</span>` : ''}
                ${embedHtml}
            `;
            servicesGrid.appendChild(card);
        });

        // Add placeholder at the end
        if (isMe) {
            const placeholder = document.createElement('div');
            placeholder.className = 'service-card-placeholder';
            placeholder.id = 'service-placeholder-card';
            placeholder.style.minHeight = '300px';
            placeholder.innerHTML = `
                <i class="bi bi-plus-lg"></i>
                <span>Nuevo Servicio</span>
            `;
            placeholder.onclick = () => {
                if (trialExpired) {
                    window.ServicesManager.showUpgradeModal();
                } else {
                    window.ServicesManager.openAddModal('service');
                }
            };
            servicesGrid.appendChild(placeholder);
        }

        servicesContainer.appendChild(servicesGrid);
    }

    // --- RENDER LEGACY SERVICES (Only if no custom services exist) ---
    const legacyServices = socials.offered_services || {};
    const hasLegacy = legacyServices.mixing || legacyServices.mastering;

    if (customServices.length === 0 && hasLegacy) {
        const legacyGrid = document.createElement('div');
        legacyGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;';

        const createLegacyCard = (type) => {
            const card = document.createElement('div');
            card.className = 'service-card-premium'; // Use new style
            const data = legacyServices[type];
            if (!data) return null;

            card.innerHTML = `
                <div class="service-icon"><i class="bi bi-gear-fill"></i></div>
                <h3>${type.charAt(0).toUpperCase() + type.slice(1)}</h3>
                <p>${escapeHTML(data.details || '')}</p>
                ${data.price ? `<span class="service-price">$${data.price}</span>` : ''}
                <a href="${data.link || '#'}" target="_blank" class="service-link-btn">Contactar</a>
            `;
            return card;
        };

        ['mixing', 'mastering', 'production'].forEach(type => {
            const card = createLegacyCard(type);
            if (card) legacyGrid.appendChild(card);
        });
        servicesContainer.appendChild(legacyGrid);
    }

    // --- EMPTY STATE ---
    if (!hasLegacy && customServices.length === 0 && !isMe) {
        const emptyDiv = document.createElement('div');
        // ... (remaining empty state for visitors only)
        emptyDiv.className = 'empty-state';
        emptyDiv.style.cssText = 'padding: 40px 20px; text-align: center; background: #111; border-radius: 12px; border: 1px solid #222; margin-bottom: 32px;';

        const emptyIcon = document.createElement('i');
        emptyIcon.className = 'bi bi-grid-3x3-gap';
        emptyIcon.style.cssText = 'font-size: 2rem; color: #333; margin-bottom: 16px; display: block;';
        emptyDiv.appendChild(emptyIcon);

        const emptyP = document.createElement('p');
        emptyP.style.cssText = 'color: #666; margin: 0; font-size: 1rem; font-weight: 500;';
        emptyP.textContent = 'Aún no hay servicios ni playlists disponibles.';
        emptyDiv.appendChild(emptyP);

        if (isMe) {
            const emptySub = document.createElement('p');
            emptySub.style.cssText = 'color: #555; margin-top: 8px; font-size: 0.85rem;';
            emptySub.innerHTML = 'Usa los botones de arriba para añadir tu contenido.';
            emptyDiv.appendChild(emptySub);
        }

        servicesContainer.appendChild(emptyDiv);
    }


    if (socials.spotify_content) {
        const spotifyUrl = socials.spotify_content;
        let embedUrl = '';
        if (spotifyUrl.includes('playlist/')) {
            const id = spotifyUrl.split('playlist/')[1].split('?')[0];
            embedUrl = `https://open.spotify.com/embed/playlist/${id}`;
        } else if (spotifyUrl.includes('track/')) {
            const id = spotifyUrl.split('track/')[1].split('?')[0];
            embedUrl = `https://open.spotify.com/embed/track/${id}`;
        }

        if (embedUrl) {
            const spotifyDiv = document.createElement('div');
            spotifyDiv.style.marginTop = '32px';

            const h4 = document.createElement('h4');
            h4.style.cssText = 'color: #fff; margin-bottom: 16px; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;';

            const spIcon = document.createElement('i');
            spIcon.className = 'bi bi-spotify';
            spIcon.style.color = '#1DB954';
            h4.appendChild(spIcon);
            h4.appendChild(document.createTextNode(' Mi Portfolio / Playlist'));
            spotifyDiv.appendChild(h4);

            const iframe = document.createElement('iframe');
            iframe.style.borderRadius = '12px';
            iframe.src = `${embedUrl}?utm_source=generator&theme=0`;
            iframe.width = '100%';
            iframe.height = '380';
            iframe.frameBorder = '0';
            iframe.allowFullscreen = true;
            iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
            iframe.loading = 'lazy';
            spotifyDiv.appendChild(iframe);

            servicesContainer.appendChild(spotifyDiv);
        }
    }

    container.appendChild(servicesContainer);
}

// --- PERSONALIZATION PORTAL ---
window.ProfilePersonalizer = {
    isPro: false, // Will be fetched on open
    isUploadingGif: false, // Track if current flow is for static or animated

    open: function () {
        const modal = document.getElementById('personalizeModal');
        if (modal) {
            modal.style.display = 'block';
            const content = modal.querySelector('.p-modal-content');
            if (content) content.style.width = '440px';
        }
        // Reset view
        document.getElementById('sideBySideContainer').style.display = 'none';
        const mainView = document.getElementById('p-modal-main-menu');
        if (mainView) mainView.style.display = 'flex';

        // Fetch Plan Status
        this.checkPlan();

        // ðŸ”¥ Sync Mockup Data
        if (window.currentUserProfile) {
            this.syncMockupData(window.currentUserProfile);
        }
    },

    syncMockupData: function (user) {
        // 1. Text Info
        const nameEl = document.getElementById('previewName');
        const roleEl = document.getElementById('previewRole');
        const verifiedEl = document.getElementById('previewVerified');

        if (nameEl) nameEl.innerText = user.nickname || "User";
        if (roleEl) roleEl.innerText = user.role || "Productor â€¢ Artista";
        if (verifiedEl) verifiedEl.style.display = (user.is_verified || user.is_producer) ? 'inline-block' : 'none';

        // 2. Stats
        const prodCount = document.getElementById('previewProductsCount');
        const followCount = document.getElementById('previewFollowersCount');
        if (prodCount) prodCount.innerText = user.products_count || '0';
        if (followCount) followCount.innerText = user.followers_count || '0';

        // 3. Avatar
        const previewAvatarImg = document.getElementById('previewAvatarImg');
        const previewAvatarInitial = document.getElementById('previewAvatarInitial');

        if (user.avatar_url) {
            if (previewAvatarImg) {
                previewAvatarImg.src = user.avatar_url;
                previewAvatarImg.style.display = 'block';
            }
            if (previewAvatarInitial) previewAvatarInitial.style.display = 'none';
        } else {
            if (previewAvatarImg) previewAvatarImg.style.display = 'none';
            if (previewAvatarInitial) {
                previewAvatarInitial.style.display = 'flex';
                previewAvatarInitial.innerText = (user.nickname || "U").charAt(0).toUpperCase();
            }
        }

        // 4. Socials
        const socials = typeof user.socials === 'string' ? JSON.parse(user.socials) : (user.socials || {});
        const previewSocials = document.getElementById('previewSocials');
        if (previewSocials) {
            const icons = previewSocials.querySelectorAll('i');
            icons.forEach(icon => {
                const type = icon.classList.toString().split('bi-')[1]; // tiktok, spotify, youtube, instagram
                if (socials && socials[type]) {
                    icon.style.display = 'inline-block';
                } else {
                    icon.style.display = 'none';
                }
            });
        }

        // 5. Initial Header Background (Sync with actual page)
        const actualHeader = document.querySelector('.profile-header');
        const mockupHeader = document.getElementById('previewHeaderMockup');
        if (actualHeader && mockupHeader) {
            // Apply current template class to mockup
            mockupHeader.className = ''; // Reset
            if (user.template === 'produccion_template_old_school') {
                mockupHeader.classList.add('template-old_school');
            }

            // Sync background
            const computedStyle = window.getComputedStyle(actualHeader);
            mockupHeader.style.background = computedStyle.background || actualHeader.style.background;
            mockupHeader.style.backgroundImage = computedStyle.backgroundImage || actualHeader.style.backgroundImage;
            mockupHeader.style.backgroundColor = computedStyle.backgroundColor || actualHeader.style.backgroundColor;
            mockupHeader.style.backgroundSize = 'cover';
            mockupHeader.style.backgroundPosition = 'center';
        }
    },

    close: function () {
        const modal = document.getElementById('personalizeModal');
        if (modal) modal.style.display = 'none';
    },

    backToMain: function () {
        const modal = document.getElementById('personalizeModal');
        if (modal) {
            const content = modal.querySelector('.p-modal-content');
            if (content) {
                content.style.width = window.innerWidth > 1024 ? '440px' : '95vw';
                // Reset to default on back
            }
        }
        document.getElementById('sideBySideContainer').style.display = 'none';

        // Reset Banner Picker View state
        const controls = document.getElementById('bannerPickerControls');
        const cropView = document.getElementById('bannerCropView');
        const picker = document.getElementById('bannerPicker');
        if (controls) controls.style.display = 'flex';
        if (cropView) cropView.style.display = 'none';
        if (picker) picker.style.flex = '0 0 400px';

        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }

        const sideContainer = document.getElementById('sideBySideContainer');
        if (sideContainer) sideContainer.style.height = '600px';

        const mainView = document.getElementById('p-modal-main-menu');
        if (mainView) mainView.style.display = 'flex';
    },

    select: function (option) {
        if (option === 'avatar') {
            this.close();
            const currentImg = document.querySelector('#profileAvatar img')?.src;
            window.AvatarManager.open(currentImg);
        } else if (option === 'banner') {
            // Check Plan (Parallel with open)
            this.checkPlan();

            const modal = document.getElementById('personalizeModal');
            if (modal) {
                const content = modal.querySelector('.p-modal-content');
                if (content) {
                    content.style.width = window.innerWidth > 1024 ? '1000px' : '95vw';
                    content.style.transition = 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                    // ðŸ”¥ Trigger layout recalculation
                    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
                }
            }

            const mainView = document.getElementById('p-modal-main-menu');
            if (mainView) mainView.style.display = 'none';
            document.getElementById('sideBySideContainer').style.display = 'flex';

            // ðŸ”¥ Unified Preview Sync
            if (window.currentUserProfile) {
                this.syncMockupData(window.currentUserProfile);
            }
        }

        // AUTO-HIGHLIGHT: Mark the current banner as selected
        const currentBanner = window.currentUserProfile?.banner_url;
        if (currentBanner) {
            document.querySelectorAll('.banner-option').forEach(el => {
                const onclickAttr = el.getAttribute('onclick');
                if (onclickAttr && onclickAttr.includes(currentBanner)) {
                    el.classList.add('active');
                    el.style.borderColor = '#fff';
                } else {
                    el.classList.remove('active');
                    el.style.borderColor = 'transparent';
                }
            });
        }
    },

    applyBanner: function (style) {
        if (style.startsWith('gif:') && !this.isPro) {
            window.location.href = '/cuenta/planes.html';
            return;
        }
        this.selectedBanner = style;
        const [type, value] = style.split(':');

        const header = document.querySelector('.profile-header');
        if (header) header.style.background = value;

        const previewHeader = document.getElementById('previewHeaderMockup');
        if (previewHeader) previewHeader.style.background = value;

        document.querySelectorAll('.banner-option').forEach(el => {
            const onclickAttr = el.getAttribute('onclick');
            if (onclickAttr && onclickAttr.includes(style)) {
                el.classList.add('active');
                el.style.borderColor = '#fff';
            } else {
                el.classList.remove('active');
                el.style.borderColor = 'transparent';
            }
        });

        const isDynamicActive = document.getElementById('dynamicThemeToggle')?.checked || false;
        if (isDynamicActive && typeof applyDynamicThemeEffects === 'function') {
            applyDynamicThemeEffects(style, true);
        }

        if (!style.startsWith('gif:')) {
            this.saveBanner();
        }
    },

    triggerCustomBanner: function (isGif) {
        if (isGif && !this.isPro) {
            window.location.href = '/cuenta/planes.html';
            return;
        }
        this.isUploadingGif = !!isGif;
        document.getElementById('bannerCustomInput')?.click();
    },

    resetCrop: function () {
        if (this.cropper) {
            this.cropper.reset();
            // Optional: ensuring it fills the width perfectly
            this.cropper.setCropBoxData({
                left: 0,
                width: this.cropper.getContainerData().width
            });
        }
    },

    handleCustomBanner: function (e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 30 * 1024 * 1024) {
            if (window.showToast) window.showToast("El archivo es muy pesado (mÃ¡x 30MB).", "error");
            return;
        }

        const validExtensions = ['jpg', 'jpeg', 'png', 'jfif'];
        const fileExt = file.name.split('.').pop().toLowerCase();

        if (this.isUploadingGif) {
            if (fileExt !== 'gif' && file.type !== 'image/gif') {
                if (window.showToast) window.showToast("Solo se aceptan archivos GIF para banners animados.", "error");
                e.target.value = '';
                return;
            }
        } else {
            if (!validExtensions.includes(fileExt)) {
                if (window.showToast) window.showToast("Solo se aceptan formatos JPG, PNG y JFIF.", "error");
                e.target.value = ''; // Reset input
                return;
            }
        }

        this.customFile = file;

        const controls = document.getElementById('bannerPickerControls');
        const cropView = document.getElementById('bannerCropView');
        const picker = document.getElementById('bannerPicker');
        const preview = document.getElementById('panoramicPreview');
        const modalContainer = document.querySelector('#personalizeModal .p-modal-content');

        if (controls) controls.style.display = 'none';
        if (cropView) cropView.style.display = 'flex';

        if (picker) picker.style.flex = '1';
        if (preview) preview.style.display = 'none';

        if (modalContainer) {
            modalContainer.style.width = window.innerWidth > 1024 ? '1000px' : '95vw';
            modalContainer.style.transition = 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            // ðŸ”¥ Force recalculation to avoid clipping reported by user
            setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
        }

        const sideContainer = document.getElementById('sideBySideContainer');
        if (sideContainer) {
            // ðŸ”¥ LOCK HEIGHT: Use a fixed height during crop to prevent "jumping"
            sideContainer.style.height = '600px';
            sideContainer.style.overflow = 'hidden';
        }

        if (picker) {
            picker.style.padding = '32px';
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.getElementById('bannerCropImg');
            img.src = event.target.result;

            if (this.cropper) {
                this.cropper.destroy();
            }

            this.cropper = new Cropper(img, {
                aspectRatio: 1500 / 380,
                viewMode: 3, // 3 = Canvas should always fill the container. Best for banners.
                dragMode: 'move', // Allow moving image instead of box
                autoCropArea: 1, // Start with maximum area
                responsive: true,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: false, // Lock box since image covers everything
                cropBoxResizable: false, // Lock box for consistency
                toggleDragModeOnDblclick: false,
                background: false,
                checkOrientation: true,
                zoomOnWheel: true,
                ready: function () {
                    // ðŸ”¥ FORCE RECTANGULAR CROP
                    const viewBox = document.querySelector('#bannerCropView .cropper-view-box');
                    const face = document.querySelector('#bannerCropView .cropper-face');
                    if (viewBox) viewBox.style.borderRadius = '0';
                    if (face) face.style.borderRadius = '0';
                }
            });
        };
        reader.readAsDataURL(file);
    },

    confirmCrop: async function () {
        if (!this.cropper) return;

        const confirmBtn = document.getElementById('bannerConfirmBtn');
        const cancelBtn = document.getElementById('bannerCancelBtn');
        const closeBtn = document.getElementById('p-modal-close-btn');

        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '';
            const spinner = document.createElement('span');
            spinner.className = 'spinner-border spinner-border-sm';
            spinner.setAttribute('role', 'status');
            spinner.setAttribute('aria-hidden', 'true');
            spinner.style.cssText = 'width: 1em; height: 1em; border-width: 2px; margin-right: 8px; display: inline-block; vertical-align: middle; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spinner-border .75s linear infinite;';
            confirmBtn.appendChild(spinner);
            confirmBtn.appendChild(document.createTextNode(' Guardando...'));

            if (!document.getElementById('spinner-style-inline')) {
                const style = document.createElement('style');
                style.id = 'spinner-style-inline';
                style.textContent = `@keyframes spinner-border {to{transform:rotate(360deg)}}`;
                document.head.appendChild(style);
            }
        }

        // ðŸ”¥ LOCK UI: Disable cancel and close buttons
        if (cancelBtn) cancelBtn.disabled = true;
        if (closeBtn) closeBtn.style.visibility = 'hidden';

        // ðŸ”¥ LOCK CROPPER: Disable interaction while uploading
        if (this.cropper) {
            this.cropper.disable();
        }

        try {
            // Auto-Save upon confirmation
            // saveBanner handles the reload on success.
            await this.saveBanner();

            // If success, saveBanner triggers reload. We stay blocked.

        } catch (e) {
            console.error(e);
            // ðŸ”¥ UNLOCK UI: If error, allow user to try again or cancel
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = 'Confirmar';
            }
            if (cancelBtn) cancelBtn.disabled = false;
            if (closeBtn) closeBtn.style.visibility = 'visible';

            // ðŸ”¥ RE-ENABLE CROPPER
            if (this.cropper) {
                this.cropper.enable();
            }

            if (window.showToast) window.showToast("Error al guardar.", "error");
        }
    },

    cancelCrop: function () {
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
        this.customFile = null;
        document.getElementById('bannerCropView').style.display = 'none';
        document.getElementById('bannerPickerControls').style.display = 'flex';
        document.getElementById('bannerCustomInput').value = '';

        // ðŸ”¥ Restore Modal UI
        const picker = document.getElementById('bannerPicker');
        const preview = document.getElementById('panoramicPreview');
        const sideContainer = document.getElementById('sideBySideContainer');
        const modalContent = document.querySelector('#personalizeModal .p-modal-content');

        if (picker) {
            picker.style.flex = '0 0 400px';
            picker.style.padding = '32px'; // Restore original padding
        }
        if (preview) preview.style.display = 'flex';
        if (sideContainer) sideContainer.style.height = '600px'; // Restore original height

        if (modalContent) {
            modalContent.style.width = '1000px'; // Side-by-side wide
            setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
        }
    },

    checkPlan: async function () {
        try {
            const { data: profile } = await window.supabaseClient
                .from('profiles')
                .select('plan')
                .eq('id', window.currentUserId)
                .maybeSingle();
            this.isPro = profile?.plan === 'pro';
        } catch (e) {
            this.isPro = false;
        }
    },

    saveBanner: async function () {
        const bannerVal = this.selectedBanner || window.currentUserProfile?.banner_url;
        const isCustom = !!this.customFile;
        const isCustomGif = this.customFile?.type === 'image/gif';
        const isPresetGif = bannerVal?.startsWith('gif:');

        // ðŸ”¥ Gating: Only GIFs are Pro. Static images/colors/gradients are Free.
        if ((isCustomGif || isPresetGif) && !this.isPro) {
            if (window.showToast) window.showToast("Esta funciÃ³n es exclusiva para usuarios PRO.", "info");
            setTimeout(() => window.location.href = '/cuenta/planes.html', 1500);
            return;
        }

        const isDynamicActive = document.getElementById('dynamicThemeToggle')?.checked || false;

        try {
            if (window.showToast) window.showToast("Guardando cambios...", "info");

            let finalBannerUrl = bannerVal;

            // ðŸ”¥ Handle Custom Upload via Cloudinary (Optimized: Send Cropped Base64)
            if (this.customFile) {
                let uploadPayload = null;
                let isGif = this.customFile.type === 'image/gif';

                // ðŸ”¥ UPLOAD VIA FORMDATA (MULTIPART)
                // This is much more stable than Base64/JSON for large images.
                const formData = new FormData();

                if (isGif) {
                    formData.append('imageFile', this.customFile);
                } else if (this.cropper) {
                    const blob = await new Promise(resolve => {
                        this.cropper.getCroppedCanvas({
                            width: 1500, // Real 1:1 width
                            height: 380, // Real 1:1 height
                            imageSmoothingEnabled: true,
                            imageSmoothingQuality: 'high'
                        }).toBlob(resolve, 'image/jpeg', 0.85); // High quality blob
                    });
                    formData.append('imageFile', blob, 'banner.jpg');
                }

                if (isGif === undefined) isGif = false;

                formData.append('isGif', isGif);
                formData.append('fileSize', this.customFile.size);

                const { data: { session }, error: sessionError } = await window.supabaseClient.auth.getSession();

                if (sessionError || !session) {
                    throw new Error("Tu sesiÃ³n ha expirado. Por favor recarga la pÃ¡gina.");
                }

                const res = await fetch('/api/imagekit/banner', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                        // Browser automatically sets multi-part header with boundary
                    },
                    body: formData
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Error al subir banner");
                finalBannerUrl = `url:${data.url}`;
            }

            // Get Current Socials to avoid wiping them
            const { data: uData } = await window.supabaseClient
                .from('users')
                .select('socials')
                .eq('id', window.currentUserId)
                .single();

            const socials = typeof uData.socials === 'string' ? JSON.parse(uData.socials) : (uData.socials || {});
            socials.dynamic_theme = isDynamicActive;

            const { error } = await window.supabaseClient
                .from('users')
                .update({
                    banner_url: finalBannerUrl,
                    socials: socials
                })
                .eq('id', window.currentUserId);

            if (error) throw error;

            if (window.showToast) window.showToast("PersonalizaciÃ³n guardada.", "success");

            // ðŸ”¥ OPTIMISTIC UI UPDATE: Update the actual profile banner immediately so it feels instant
            const header = document.querySelector('.profile-header');
            if (header && finalBannerUrl) {
                if (finalBannerUrl.startsWith('url:')) {
                    const cleanUrl = finalBannerUrl.replace('url:', '');
                    header.style.background = `url('${cleanUrl}') center/cover no-repeat`;
                } else if (finalBannerUrl.startsWith('solid:')) {
                    header.style.background = finalBannerUrl.replace('solid:', '');
                } else if (finalBannerUrl.startsWith('gradient:')) {
                    header.style.background = finalBannerUrl.replace('gradient:', '');
                } else if (finalBannerUrl.startsWith('gif:')) {
                    const cleanGif = finalBannerUrl.replace('gif:', '');
                    header.style.background = `url('${cleanGif}') center/cover no-repeat`;
                }
            }

            // Update local state and UI
            if (window.currentUserProfile) window.currentUserProfile.banner_url = finalBannerUrl;

            // Reload page faster (300ms is enough to see the change and toast)
            setTimeout(() => window.location.reload(), 300);

        } catch (err) {
            console.error("Error saving personalization:", err);
            throw err;
        }
    },

    toggleDynamicTheme: async function (isActive) {
        // console.log("Toggle Dynamic Theme:", isActive);
        const banner = this.selectedBanner || window.currentUserProfile?.banner_url;
        applyDynamicThemeEffects(banner, isActive);

        // AUTO-SAVE: Immediately persist the toggle state
        try {
            const { data: uData } = await window.supabaseClient
                .from('users')
                .select('socials')
                .eq('id', window.currentUserId)
                .single();

            const socials = typeof uData.socials === 'string' ? JSON.parse(uData.socials) : (uData.socials || {});
            socials.dynamic_theme = isActive;

            const { error } = await window.supabaseClient
                .from('users')
                .update({ socials: socials })
                .eq('id', window.currentUserId);

            if (error) throw error;
            // console.log("Dynamic theme preference saved:", isActive);
        } catch (err) {
            console.error("Error auto-saving dynamic theme:", err);
            // Revert visual state on error? optional.
        }
    }
};

/**
 * Applies or removes the subtle background "bath" effect
 */
function applyDynamicThemeEffects(bannerVal, isActive) {
    const body = document.body;
    if (!isActive || !bannerVal) {
        body.classList.remove('dynamic-theme-active');
        body.style.setProperty('--dynamic-theme-color', 'transparent');
        return;
    }

    let color = '#000'; // Default
    if (bannerVal.includes(':')) {
        const [type, val] = bannerVal.split(':');
        if (type === 'solid') {
            color = val;
        } else if (type === 'gradient') {
            // Extract first color of gradient
            const match = val.match(/#[0-9a-fA-F]{3,6}|rgba?\([^)]+\)/);
            if (match) color = match[0];
        }
    }

    body.style.setProperty('--dynamic-theme-color', color);
    body.classList.add('dynamic-theme-active');
}


// Helper for Visuals (Shared)
// Helper for Visuals (Shared)
function updateButtonVisuals(btn, isFollowing) {
    if (isFollowing) {
        btn.textContent = 'Siguiendo';
        btn.classList.add('following-state');
        btn.style.background = 'transparent';
        btn.style.border = '1px solid rgba(255, 255, 255, 0.2)'; /* Soft Contour */
        btn.style.color = '#aaa'; /* Dimmed to imply "Done" */
        btn.style.fontWeight = '500';
        btn.style.outline = 'none';
    } else {
        // User requested "+" icon style
        btn.innerHTML = '';
        const icon = document.createElement('i');
        icon.className = 'bi bi-plus-lg';
        icon.style.marginRight = '4px';
        btn.appendChild(icon);
        btn.appendChild(document.createTextNode(' Seguir'));
        btn.classList.remove('following-state');
        btn.style.background = '#8A2BE2';
        btn.style.border = 'none'; /* Removed contour */
        btn.style.color = '#fff';
        btn.style.background = ''; // Allow CSS
        btn.style.outline = 'none';

        if (!btn.className.includes('btn-purple')) {
            btn.style.backgroundColor = '#8A2BE2'; // Force if needed
        }
    }
}

// Global Sync Function
function syncFollowState(targetId, isFollowing) {
    // 1. Update Cache
    if (window.currentUserFollowing) {
        if (isFollowing) window.currentUserFollowing.add(targetId);
        else window.currentUserFollowing.delete(targetId);
    }

    // 2. Update Main Header Button (if matches)
    const headerBtn = document.getElementById('btnFollow');
    if (headerBtn && headerBtn.getAttribute('data-target-id') == targetId) {
        updateButtonVisuals(headerBtn, isFollowing);

        // Update Count Optimistically
        const fCountEl = document.getElementById('profileFollowersCount');
        if (fCountEl) {
            let current = parseInt(fCountEl.innerText) || 0;
            if (isFollowing) current++; else current = Math.max(0, current - 1);
            const label = current === 1 ? 'Seguidor' : 'Seguidores';
            fCountEl.innerText = `${current} ${label}`;
        }
    }
}

// Global Event Listener for Hover Card Sync
window.addEventListener('follow-state-changed', (e) => {
    const { userId, isFollowing } = e.detail;
    // console.log("Global Follow Sync:", userId, isFollowing);
    syncFollowState(userId, isFollowing);
});



function isPresetProduct(p) {
    if (!p) return false;
    const type = (p.product_type || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    return type === 'preset' || type === 'vocalpreset' || type.includes('preset') ||
        type === 'template' || type === 'plantilla' ||
        cat === 'plantilla' || cat === 'vocal preset' || cat.includes('preset');
}

function getProductAudio(product) {
    if (!product) return '';

    const isPreset = isPresetProduct(product);

    // For presets, we try after -> before -> generic
    if (isPreset) {
        if (product.audio_after_url) return product.audio_after_url;
        if (product.audio_before_url) return product.audio_before_url;
        if (product.audio_url) return product.audio_url;
    }

    // Comprehensive fallback chain for all products
    return product.mp3_url ||
        product.audio_url ||
        product.download_url_mp3 ||
        product.preview_url ||
        product.demo_file ||
        product.tagged_file ||
        product.file_url ||
        product.url_file ||
        product.cloud_url ||
        product.audio_before_url ||
        product.audio_after_url ||
        (product.track_data ? product.track_data.audio_url : '') ||
        '';
}

// State
let productsCache = [];
let currentFilter = 'all';
let currentSearch = '';
let activeWavesurfers = []; // Store WS instances to clean up
window.activeWavesurfers = activeWavesurfers; // EXPOSE FOR SYNC
let currentlyPlaying = null; // Track currently playing instance
let trendingPage = 0; // Pagination for Trending Carousel
let isLoadingProducts = false; // LOCK to prevent AbortError overlap

async function loadUserProducts(user) {
    if (isLoadingProducts) return;
    isLoadingProducts = true;
    window.currentProfileData = user; // SAVE GLOBALLY AWAIT FOR SHARE MODAL
    const username = user.nickname;
    const trendGrid = document.getElementById('trendingGrid');
    const listContainer = document.getElementById('profileProductsList');

    // Hide Grid container if it exists, ensuring we stick to list
    const gridEl = document.getElementById('profileProductsGrid');
    if (gridEl) gridEl.style.display = 'none';

    // CLEANUP OLD WAVESURFERS (Fix sync issues)
    if (window.activeWavesurfers) {
        window.activeWavesurfers.forEach(ws => {
            try { ws.destroy(); } catch (e) { }
        });
        window.activeWavesurfers.length = 0; // Clear array
    }

    // Initial Loaders (Skeletons) - REMOVED!
    // Skeletons are now in HTML (usuarios.html) to allow instant render.
    // We do NOT wipe trendGrid or listContainer here, to avoid flicker.

    try {
        const response = await fetch(`/api/users/${username}/products`);
        if (!response.ok) throw new Error('Error fetch');

        const products = await response.json();
        productsCache = products || [];

        // --- CALCULATE PRODUCT CATEGORY COUNTS ---
        const categoryCounts = {
            beat: 0,
            preset: 0,
            loopkit: 0,
            drumkit: 0,
            soundkit: 0
        };
        productsCache.forEach(p => {
            const type = (p.product_type || '').toLowerCase();
            if (categoryCounts[type] !== undefined) {
                categoryCounts[type]++;
            } else if (type === 'beat') {
                categoryCounts.beat++;
            }
            // Add other mappings if necessary, e.g. 'sample pack' -> 'loopkit'
        });
        window.profileCategoryCounts = categoryCounts;

        // --- PRE-FETCH COLLABORATOR STATS ---
        const collabStats = {};
        const uniqueCollabs = new Set();

        productsCache.forEach(p => {
            (p.collaborators || []).forEach(c => {
                const name = c.nickname || c.name;
                if (name) uniqueCollabs.add(name);
            });
        });

        // Parallel Fetch (Background-ish but awaited slightly to ensure UI renders with data)
        // We await here to ensure "Instant" feel, usually fast (~100-300ms)
        // Parallel Fetch with Limit (Avoid overwhelming browser for profiles with 20+ collabs)
        if (uniqueCollabs.size > 0) {
            const collabArray = Array.from(uniqueCollabs);
            // Only fetch first 10 immediately to ensure speed, others can be lazy-fetched if needed
            const toFetch = collabArray.slice(0, 15);
            const promises = toFetch.map(async (nickname) => {
                try {
                    const res = await fetch(`/api/users/${nickname}`);
                    if (res.ok) {
                        const data = await res.json();
                        collabStats[nickname] = {
                            id: data.id,
                            products: data.products_count || 0,
                            followers: data.followers_count || 0,
                            avatar_url: data.avatar_url,
                            is_verified: data.is_verified
                        };
                    }
                } catch (e) { }
            });
            await Promise.all(promises);
        }

        // --- SORT BY TRENDING (Weighted Algorithm) ---
        // Score = Views + 2*Plays + 10*Likes + 20*Downloads + 50*Sales
        const getScore = (p) => {
            return (p.views_count || 0) * 1 +
                (p.plays_count || 0) * 2 +
                (p.stats_likes || 0) * 10 +
                (p.downloads_count || 0) * 20 +
                (p.sales_count || 0) * 50;
        };

        // We keep the original order for the "All" list, or sort it?
        // User wants "Trending" to be real. Let's create a sorted version for Trending.
        window.trendingProducts = [...productsCache].sort((a, b) => getScore(b) - getScore(a));

        // Update counts in user object just in case
        user.products_count = productsCache.length;

        // --- PRE-WARM IMAGE CACHE (For Synchronized Reveal) ---
        const urlsToWarm = [];
        if (user.avatar_url) urlsToWarm.push({ url: user.avatar_url, version: user.r2_version || 'v2' });

        // Extraer URL del banner para precargarlo
        if (user.banner_url) {
            let bUrl = user.banner_url;
            if (bUrl.startsWith('url:')) bUrl = bUrl.substring(bUrl.indexOf(':') + 1);
            else if (bUrl.startsWith('gif:')) bUrl = bUrl.substring(bUrl.indexOf(':') + 1);
            if (bUrl.startsWith('http')) urlsToWarm.push({ url: bUrl, version: 'v2' });
        }

        // Trending
        if (window.trendingProducts) {
            window.trendingProducts.slice(0, 5).forEach(p => {
                if (p.image_url) urlsToWarm.push({ url: p.image_url, version: p.storage_version || p.r2_version || 'v2' });
            });
        }

        // Main List (First 15 for instant reveal)
        productsCache.slice(0, 15).forEach(p => {
            if (p.image_url) urlsToWarm.push({ url: p.image_url, version: p.storage_version || p.r2_version || 'v2' });
        });

        if (urlsToWarm.length > 0 && window.getAuthorizedUrl) {
            // 1. Obtener URLs firmadas
            const authorizedArray = await Promise.all(urlsToWarm.map(obj => window.getAuthorizedUrl(obj.url, obj.version).catch(() => null)));

            // 2. Ejecutar Bulk Preload (Descarga a RAM)
            const preloadPromises = authorizedArray.map(finalUrl => {
                if (!finalUrl) return Promise.resolve();
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve();
                    img.onerror = () => resolve(); // No trabar si una falla
                    img.src = finalUrl;
                });
            });

            // 3. Race contra timeout (Max 1.5s extra para la red, sin exceder el profileTimer)
            const maxWaitPromise = new Promise(resolve => setTimeout(resolve, 1500));
            await Promise.race([Promise.allSettled(preloadPromises), maxWaitPromise]);
        }

        // 1. Start all preparation in parallel
        const headerPromise = renderHeader(user, categoryCounts);
        const trendPromise = updateTrendingView(user, collabStats);
        const listPromise = renderProductList(productsCache, user, collabStats);

        // 2. Wait for TIMER (The 2.3s minimum)
        await window.profileTimerPromise;

        // 3. MASTER TRIGGER: Reveal everything!
        if (window.triggerProfileReveal) window.triggerProfileReveal();

        // 4. Final Setup (Post-Reveal logic)
        await Promise.all([headerPromise, trendPromise, listPromise]);
        setupTrendingControls(user, collabStats);

        // 3. Setup Filter Logic
        setupProfileControls();
        setupBioCollapse(); // Initialize Bio Read More

        // 4. Prefetch Hover Data (Background)
        if (window.prefetchArtist) {
            // Prefetch Main User
            window.prefetchArtist(user.nickname);

            // Prefetch Collaborators
            uniqueCollabs.forEach(nick => window.prefetchArtist(nick));
        }

    } catch (e) {
        console.error("Error loading products:", e);
        // 🔥 Ensure reveal fires even on error so profile doesn't stay frozen
        if (window.triggerProfileReveal) window.triggerProfileReveal();
        const profileRoot = document.getElementById('profile-root');
        if (profileRoot) profileRoot.classList.add('header-loaded');
        listContainer.innerHTML = '';
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.textContent = 'Error cargando productos.';
        listContainer.appendChild(emptyDiv);
        if (trendGrid) trendGrid.innerHTML = '';
    } finally {
        isLoadingProducts = false;
    }
}

function setupBioCollapse() {
    const bioText = document.getElementById('profileBio');
    if (!bioText) return;

    // Clean text: max 1 space, max 1 newline as requested
    let rawText = bioText.innerText || "";
    let cleanText = rawText
        .replace(/[ ]+/g, ' ')           // Max 1 space
        .replace(/\n\s*\n/g, '\n')       // Max 1 newline (no empty lines)
        .trim();

    if (!cleanText) return;

    // --- MENTIONS CONVERSION ---
    const parseMentions = (text) => {
        const frag = document.createDocumentFragment();
        const parts = text.split(/(@[a-z0-9._-]+)/gi);
        parts.forEach(part => {
            if (part.startsWith('@')) {
                const username = part.substring(1);
                const a = document.createElement('a');
                a.href = `/@${username}`;
                a.className = 'bio-mention';
                a.textContent = part;
                frag.appendChild(a);
            } else if (part) {
                frag.appendChild(document.createTextNode(part));
            }
        });
        return frag;
    };

    const renderBio = (isShort) => {
        const text = isShort ? cleanText.substring(0, 150) + "..." : cleanText;
        bioText.innerHTML = '';
        bioText.appendChild(parseMentions(text));

        if (cleanText.length > 150) {
            bioText.appendChild(document.createElement('br'));
            const toggle = document.createElement('span');
            toggle.id = 'bioToggle';
            toggle.style.cssText = 'color:var(--p-accent); cursor:pointer; font-weight:600; margin-top:4px; display:inline-block;';
            toggle.textContent = isShort ? 'Ver mÃ¡s' : 'Ver menos';
            bioText.appendChild(toggle);
        }
    };

    if (cleanText.length > 150) {
        renderBio(true);
        bioText.onclick = (e) => {
            if (e.target.id === 'bioToggle') {
                const isExpanded = bioText.classList.contains('expanded');
                if (isExpanded) {
                    renderBio(true);
                    bioText.classList.remove('expanded');
                } else {
                    renderBio(false);
                    bioText.classList.add('expanded');
                }
            }
        };
    } else {
        bioText.innerHTML = '';
        bioText.appendChild(parseMentions(cleanText));
    }
}

function setupTrendingControls(user, collabStats) {
    const arrows = document.querySelectorAll('.nav-arrows button');
    if (arrows.length < 2) return;

    const [prevBtn, nextBtn] = arrows;
    const totalItems = (window.trendingProducts || productsCache).length;

    const isOldSchool = document.documentElement.classList.contains('template-produccion_template_old_school') || (user && user.template === 'produccion_template_old_school');
    const pageSize = isOldSchool ? 4 : 7;

    // Visibility Check
    if (totalItems <= pageSize) {
        prevBtn.style.opacity = '0.3';
        prevBtn.style.cursor = 'default';
        nextBtn.style.opacity = '0.3';
        nextBtn.style.cursor = 'default';
        prevBtn.onclick = null;
        nextBtn.onclick = null;
        return;
    } else {
        prevBtn.style.opacity = '1';
        prevBtn.style.cursor = 'pointer';
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';
    }

    // Next Logic
    nextBtn.onclick = () => {
        const source = window.trendingProducts || productsCache;
        const total = source.length;
        const maxPages = Math.ceil(total / pageSize);
        trendingPage = (trendingPage + 1) % maxPages;
        updateTrendingView(user, collabStats);
    };

    // Prev Logic
    prevBtn.onclick = () => {
        const source = window.trendingProducts || productsCache;
        const total = source.length;
        const maxPages = Math.ceil(total / pageSize);
        trendingPage = (trendingPage - 1 + maxPages) % maxPages;
        updateTrendingView(user, collabStats);
    };
}

function updateTrendingView(user, collabStats) {
    const isOldSchool = document.documentElement.classList.contains('template-produccion_template_old_school') || (user && user.template === 'produccion_template_old_school');
    const pageSize = isOldSchool ? 4 : 7;
    const start = trendingPage * pageSize; // Pagination starts here

    // USAR LISTA ORDENADA POR ALGORITMO
    const source = window.trendingProducts || productsCache;
    const sliced = source.slice(start, start + pageSize);

    // If slice is empty (shouldn't happen with correct math), reset
    if (sliced.length === 0 && productsCache.length > 0) {
        trendingPage = 0;
        updateTrendingView(user, collabStats);
        return;
    }

    renderTrending(sliced, user, collabStats);
}

async function renderTrending(items, user, collabStats = {}) {
    const container = document.getElementById('trendingGrid');
    if (!container) return;

    // 1. Pre-authorize ALL images in parallel while skeletons stay visible
    const authPromises = items.map(prod => {
        if (!prod.image_url) return Promise.resolve(null);
        return window.getAuthorizedUrl(prod.image_url, prod.storage_version || prod.r2_version || 'v2', prod.id);
    });
    const authorizedUrls = await Promise.all(authPromises);

    // 2. Prepare all cards in memory
    const fragment = document.createDocumentFragment();

    items.forEach((prod, idx) => {
        const div = document.createElement('div');
        div.className = 'ots-smart-card';
        const plays = prod.plays_count || 0;
        const seoLink = window.createSeoLink ? window.createSeoLink(prod) : '/producto.html?id=' + prod.id;

        // Initial image check (avoid broken icon)
        const rawImgTrending = prod.image_url || '/images/portada-default.png';
        const storageVerTrending = prod.storage_version || prod.r2_version || 'v2';

        // Explicitly skip R2 signing if storage_version is 'supabase'
        const isR2Trending = (storageVerTrending !== 'supabase') && window.AuthUtils && window.AuthUtils.isR2Url(rawImgTrending);
        const isExternalOpt = rawImgTrending.includes('ik.imagekit.io') || rawImgTrending.includes('cloudinary.com');
        const imgPlaceholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

        let finalSrcTrending = rawImgTrending;
        finalSrcTrending = window.AuthUtils?.getFormattedSupabaseUrl ? window.AuthUtils.getFormattedSupabaseUrl(rawImgTrending) : rawImgTrending;

        const initialImgTrending = (isR2Trending && !isExternalOpt) ? imgPlaceholder : finalSrcTrending;

        div.innerHTML = ''; // Ensure clear

        const coverDiv = document.createElement('div');
        coverDiv.className = 'ots-card-cover';

        const img = document.createElement('img');
        img.src = initialImgTrending;
        img.dataset.r2Version = storageVerTrending;
        img.id = `trending-img-${prod.id}`;
        img.alt = prod.name || 'Product';
        img.className = 'skeleton-img-transition';
        img.onclick = () => window.location.href = seoLink;
        coverDiv.appendChild(img);

        const overlay = document.createElement('div');
        overlay.className = 'ots-card-overlay';
        overlay.onclick = () => window.location.href = seoLink;
        coverDiv.appendChild(overlay);

        const playBtn = document.createElement('button');
        playBtn.className = 'ots-play-btn';
        playBtn.title = 'Reproducir';
        const playIcon = document.createElement('i');
        playIcon.className = 'bi bi-play-fill';
        playBtn.appendChild(playIcon);

        playBtn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            if (window.StickyPlayer) {
                const audioUrl = getProductAudio(prod);
                const trackData = { ...prod, audio_url: audioUrl, artist_users: user };
                window.StickyPlayer.play(trackData);
            }
        };
        coverDiv.appendChild(playBtn);

        // Add Heart Button to Cover
        const isLiked = window.FavoritesManager ? window.FavoritesManager.isLiked(prod.id) : false;
        const heartBtn = document.createElement('button');
        heartBtn.className = 'ots-heart-btn';
        heartBtn.dataset.id = prod.id;
        if (isLiked) heartBtn.classList.add('active');
        heartBtn.innerHTML = `<i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i>`;
        heartBtn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            if (window.FavoritesManager) {
                // FavoritesManager already applies the optimistic visual update 
                // instantly to the button element passed to it.
                window.FavoritesManager.toggleLike(prod.id, heartBtn);
            }
        };
        coverDiv.appendChild(heartBtn);

        const badgeDiv = document.createElement('div');
        badgeDiv.className = 'ots-overlay-badge';
        badgeDiv.title = 'Reproducciones Reales';
        badgeDiv.onclick = () => window.location.href = seoLink;
        const musicIcon = document.createElement('i');
        musicIcon.className = 'bi bi-music-note-beamed';
        badgeDiv.appendChild(musicIcon);
        badgeDiv.appendChild(document.createTextNode(` ${plays}`));
        coverDiv.appendChild(badgeDiv);

        div.appendChild(coverDiv);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'ots-card-info';

        const h4 = document.createElement('h4');
        h4.title = prod.name || '';
        h4.onclick = () => window.location.href = seoLink;
        h4.textContent = prod.name || 'Untiled';
        infoDiv.appendChild(h4);

        const authorDiv = document.createElement('div');
        authorDiv.className = 't-card-author';
        authorDiv.style.cssText = 'font-size:0.85rem; color:#888;';

        const createSpan = (name, data, extraClass = '') => {
            const span = document.createElement('span');
            span.className = `artist-hover-trigger ${extraClass}`;
            span.dataset.artist = JSON.stringify(data);
            span.title = name;
            span.textContent = name;
            span.onmouseenter = (e) => window.showArtistCard(e, span);
            span.onmouseleave = (e) => window.hideArtistCard(e, span);
            return span;
        };

        // Producer
        authorDiv.appendChild(createSpan(user.nickname || 'Producer', {
            id: user.id,
            nickname: user.nickname,
            avatar_url: user.avatar_url,
            is_verified: user.is_verified || user.is_producer,
            stats: { followers: user.followers_count || 0 }
        }, 'producer-link-thin'));

        const collabs = (prod.collaborators || [])
            .filter(c => {
                const hasName = (c.nickname || c.name) && (c.nickname || c.name).trim().length > 0;
                const isAccepted = c.status === 'accepted';
                return hasName && isAccepted;
            });

        if (collabs.length > 0) {
            const comma = document.createElement('span');
            comma.style.cssText = 'color:#666; margin-right:2px;';
            comma.textContent = ', ';
            authorDiv.appendChild(comma);

            collabs.slice(0, 2).forEach((c, cIdx) => {
                const cName = c.nickname || c.name;
                const pre = collabStats[cName] || {};
                authorDiv.appendChild(createSpan(cName, {
                    id: pre.id || '',
                    nickname: cName,
                    avatar_url: pre.avatar_url || c.avatar_url,
                    is_verified: (pre.is_verified !== undefined) ? pre.is_verified : (c.is_verified || false),
                    stats: { followers: pre.followers !== undefined ? pre.followers : 0 }
                }, 'collaborator-link-thin'));

                if (cIdx < Math.min(collabs.length, 2) - 1) {
                    const innerComma = document.createElement('span');
                    innerComma.style.cssText = 'color:#666; margin-right:2px;';
                    innerComma.textContent = ', ';
                    authorDiv.appendChild(innerComma);
                }
            });

            if (collabs.length > 2) {
                const more = document.createElement('span');
                more.style.color = '#666';
                more.textContent = '...';
                authorDiv.appendChild(more);
            }
        }

        infoDiv.appendChild(authorDiv);

        const metaRow = document.createElement('div');
        metaRow.className = 't-meta-row';

        const typeSpan = document.createElement('span');
        typeSpan.textContent = prod.product_type || 'Beat';
        metaRow.appendChild(typeSpan);

        const dot = document.createElement('span');
        dot.style.fontSize = '0.4rem';
        dot.textContent = ' â— ';
        metaRow.appendChild(dot);

        const bpmSpan = document.createElement('span');
        bpmSpan.textContent = prod.bpm ? prod.bpm + ' BPM' : 'New';
        metaRow.appendChild(bpmSpan);

        // infoDiv.appendChild(metaRow); // Removed as per user request


        // --- NEW: Inject Buy & Download actions for trending cards ---
        const tActions = document.createElement('div');
        tActions.className = 'ots-card-actions';

        const priceBtn = document.createElement('button');
        priceBtn.className = 'ots-btn-price';
        const pType = (prod.product_type || '').toLowerCase();
        const isTrulyFree = pType !== 'beat' && (prod.is_free === true || String(prod.is_free) === 'true' || Number(prod.price_basic) === 0);

        let priceValue = prod.price_basic !== undefined && prod.price_basic !== null ? prod.price_basic : '20';
        const priceTxt = isTrulyFree ? 'FREE' : (window.CurrencyManager ? window.CurrencyManager.format(parseFloat(priceValue) || 0) : '$' + parseFloat(priceValue).toFixed(2));

        priceBtn.innerHTML = '<i class="bi bi-bag" style="margin-right:6px;"></i>' + priceTxt;
        priceBtn.onclick = (e) => { e.stopPropagation(); window.location.href = seoLink; };

        const freeDLAvaliable = (prod.free_download_type && prod.free_download_type !== 'none') || (window.AuthUtils && window.AuthUtils.canFreeDownload && window.AuthUtils.canFreeDownload(prod));

        if (isTrulyFree) {
            tActions.appendChild(priceBtn);
        } else {
            tActions.appendChild(priceBtn);
            if (freeDLAvaliable) {
                const dlBtn = document.createElement('button');
                dlBtn.className = 'ots-btn-download';
                dlBtn.innerHTML = '<i class="bi bi-download"></i>';
                dlBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (window.openDownloadGateModal) {
                        const dlUrl = prod.free_download_url || getProductAudio(prod) || '';
                        window.openDownloadGateModal(dlUrl, user.nickname, prod.id);
                    } else {
                        window.location.href = seoLink;
                    }
                };
                tActions.appendChild(dlBtn);
            }
        }

        infoDiv.appendChild(tActions);

        div.appendChild(infoDiv);

        // Authorize trending image if authUrl exists
        const authUrl = authorizedUrls[idx];
        if (prod.image_url) {
            const parent = img.parentElement;
            if (parent) parent.classList.add('img-loading-skeleton'); // Safe skeleton

            img.onload = () => {
                if (parent) parent.classList.remove('img-loading-skeleton');
                img.style.opacity = 1;
            };
            img.onerror = () => {
                if (parent) parent.classList.remove('img-loading-skeleton');
                img.src = '/images/portada-default.png';
                img.style.opacity = 1;
            };

            if (authUrl) {
                img.src = authUrl;
            } else {
                img.src = prod.image_url || '/images/portada-default.png';
            }
            if (img.complete) img.onload();
        }

        fragment.appendChild(div);
    });

    // 3. Swap content
    if (window.profileRevealSignal) await window.profileRevealSignal;

    container.innerHTML = '';
    container.appendChild(fragment);
    container.classList.remove('fade-in');
    void container.offsetWidth; // Trigger reflow
    container.classList.add('fade-in');
}

async function renderProductList(items, user, collabStats = {}) {
    const list = document.getElementById('profileProductsList');
    if (!list) return;

    // 1. Pre-authorize ALL images in parallel
    const authPromises = items.map(prod => {
        if (!prod.image_url) return Promise.resolve(null);
        return window.getAuthorizedUrl(prod.image_url, prod.storage_version || prod.r2_version || 'v2', prod.id);
    });
    const authorizedUrls = await Promise.all(authPromises);

    // Cleanup old wavesurfers
    window.activeWavesurfers.forEach(ws => { try { ws.destroy(); } catch (e) { } });
    window.activeWavesurfers = [];
    window.currentlyPlaying = null;

    if (items.length === 0) {
        list.innerHTML = '';
        list.classList.add('fade-in');
        const isOwner = window.currentUserId && (user.id === window.currentUserId);

        const emptyDiv = document.createElement('div');
        if (isOwner) {
            emptyDiv.className = 'empty-state-cta';

            const iconDiv = document.createElement('div');
            iconDiv.className = 'empty-icon';
            const icon = document.createElement('i');
            icon.className = 'bi bi-cloud-arrow-up-fill';
            iconDiv.appendChild(icon);
            emptyDiv.appendChild(iconDiv);

            const h3 = document.createElement('h3');
            h3.textContent = 'Sube tu primer producto';
            emptyDiv.appendChild(h3);

            const p = document.createElement('p');
            p.textContent = 'Comparte tus beats, kits o sonidos con el mundo. Solo tú    puedes ver esto.';
            emptyDiv.appendChild(p);

            const btn = document.createElement('button');
            btn.className = 'btn-upload-first';
            btn.textContent = 'Subir ahora';
            btn.onclick = () => window.location.href = '/cuenta/subir-kit.html';
            emptyDiv.appendChild(btn);
        } else {
            emptyDiv.className = 'empty-state';
            emptyDiv.textContent = 'No se encontraron productos con estos filtros.';
        }
        list.appendChild(emptyDiv);

        if (window.StickyPlayer?.updatePlaylist) window.StickyPlayer.updatePlaylist([], user.nickname || 'Unknown');
        return;
    }

    const fragment = document.createDocumentFragment();
    const rowsMetadata = [];

    items.forEach((prod, index) => {
        const row = document.createElement('div');
        row.className = 'list-row';
        row.dataset.id = prod.id;
        const seoLink = window.createSeoLink ? window.createSeoLink(prod) : `/producto.html?id=${prod.id}`;

        const waveformId = `waveform-track-${prod.id}-${index}`;
        const audioUrl = getProductAudio(prod);

        const rawImgList = prod.image_url || '/images/portada-default.png';
        const storageVerList = prod.storage_version || prod.r2_version || 'v2';

        // Explicitly check if it's R2 using AuthUtils standardized helper
        const isR2List = (storageVerList !== 'supabase') && window.AuthUtils && window.AuthUtils.isR2Url && window.AuthUtils.isR2Url(rawImgList);
        const isExternalListOpt = rawImgList.includes('ik.imagekit.io') || rawImgList.includes('cloudinary.com');
        const imgPlaceholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

        let finalSrcList = rawImgList;
        finalSrcList = window.AuthUtils?.getFormattedSupabaseUrl ? window.AuthUtils.getFormattedSupabaseUrl(rawImgList) : rawImgList;

        const initialImgList = (isR2List && !isExternalListOpt) ? imgPlaceholder : finalSrcList;

        row.innerHTML = ''; // Start clean

        // Cover
        const coverDiv = document.createElement('div');
        coverDiv.className = 'list-cover';
        coverDiv.style.cursor = 'pointer';
        coverDiv.onclick = () => window.location.href = seoLink;
        const img = document.createElement('img');
        img.src = initialImgList;
        img.dataset.r2Version = storageVerList;
        img.id = `list-img-${prod.id}`;
        img.alt = 'cover';
        img.className = 'skeleton-img-transition';
        img.loading = 'lazy';
        coverDiv.appendChild(img);
        row.appendChild(coverDiv);

        // Info
        const infoDiv = document.createElement('div');
        infoDiv.className = 'list-col-info';
        infoDiv.style.cursor = 'pointer';
        infoDiv.onclick = (e) => { e.stopPropagation(); window.location.href = seoLink; };

        const titleSpan = document.createElement('span');
        titleSpan.className = 'list-track-title';
        titleSpan.textContent = prod.name || 'Untitled';
        infoDiv.appendChild(titleSpan);

        const authorSub = document.createElement('span');
        authorSub.className = 'list-author-sub';

        const createArtistSpan = (name, data, extraClass = '') => {
            const span = document.createElement('span');
            span.className = `artist-hover-trigger ${extraClass}`;
            span.dataset.artist = JSON.stringify(data);
            span.textContent = name;
            span.onmouseenter = (e) => window.showArtistCard(e, span);
            span.onmouseleave = (e) => window.hideArtistCard(e, span);
            return span;
        };

        authorSub.appendChild(createArtistSpan(user.nickname || 'Producer', {
            id: user.id,
            nickname: user.nickname,
            avatar_url: user.avatar_url,
            is_verified: user.is_verified || user.is_producer,
            stats: { products: user.products_count || 0, followers: user.followers_count || 0 }
        }, 'producer-link-thin'));

        const collabs = (prod.collaborators || []).filter(c => (c.nickname || c.name) && c.status === 'accepted');
        if (collabs.length > 0) {
            const comma = document.createElement('span');
            comma.style.cssText = 'color:#666; margin-right:2px;';
            comma.textContent = ', ';
            authorSub.appendChild(comma);

            collabs.slice(0, 2).forEach((c, cIdx) => {
                const cName = c.nickname || c.name;
                const pre = collabStats[cName] || {};
                authorSub.appendChild(createArtistSpan(cName, {
                    id: pre.id || '',
                    nickname: cName,
                    avatar_url: pre.avatar_url || c.avatar_url,
                    is_verified: (pre.is_verified !== undefined) ? pre.is_verified : (c.is_verified || false),
                    stats: { products: pre.products !== undefined ? pre.products : 0, followers: pre.followers !== undefined ? pre.followers : 0 }
                }, 'collaborator-link-thin'));
                if (cIdx < Math.min(collabs.length, 2) - 1) {
                    const innerComma = document.createElement('span');
                    innerComma.style.cssText = 'color:#666; margin-right:2px;';
                    innerComma.textContent = ', ';
                    authorSub.appendChild(innerComma);
                }
            });
            if (collabs.length > 2) authorSub.appendChild(document.createTextNode(', ...'));
        }
        infoDiv.appendChild(authorSub);
        row.appendChild(infoDiv);

        // Player
        const playerDiv = document.createElement('div');
        playerDiv.className = 'list-col-player';
        const playBtn = document.createElement('button');
        playBtn.className = 'btn-list-play';
        playBtn.id = `btn-play-${waveformId}`;
        const pIcon = document.createElement('i');
        pIcon.className = 'bi bi-play-fill';
        playBtn.appendChild(pIcon);
        playerDiv.appendChild(playBtn);

        const waveformDiv = document.createElement('div');
        waveformDiv.className = 'list-waveform-container list-waveform skeleton-waveform';
        waveformDiv.id = waveformId;
        waveformDiv.style.cssText = 'height:28px; flex:1; position:relative;';
        playerDiv.appendChild(waveformDiv);
        row.appendChild(playerDiv);

        // Tags
        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'list-col-tags';
        const durationSpan = document.createElement('span');
        durationSpan.id = `duration-${waveformId}`;
        durationSpan.style.cssText = 'font-size:0.75rem; color:#666; font-weight:700; margin-right:8px; min-width:30px;';
        durationSpan.textContent = '--:--';
        tagsDiv.appendChild(durationSpan);

        const wavBadge = document.createElement('span');
        wavBadge.className = 'badge-outline badge-type';
        wavBadge.textContent = 'WAV';
        tagsDiv.appendChild(wavBadge);

        const stemsBadge = document.createElement('span');
        stemsBadge.className = 'badge-outline badge-type';
        stemsBadge.textContent = 'STEMS';
        tagsDiv.appendChild(stemsBadge);
        row.appendChild(tagsDiv);

        // Price
        const priceDiv = document.createElement('div');
        priceDiv.className = 'list-col-price';
        const priceBtn = document.createElement('button');
        priceBtn.className = 'btn-list-price';
        priceBtn.onclick = (e) => { e.stopPropagation(); window.location.href = seoLink; };

        const pType = (prod.product_type || '').toLowerCase();
        const isTrulyFree = pType !== 'beat' && (prod.is_free === true || String(prod.is_free) === 'true' || Number(prod.price_basic) === 0);
        let priceValue = prod.price_basic !== undefined && prod.price_basic !== null ? prod.price_basic : '20';
        priceBtn.textContent = isTrulyFree ? 'FREE' : (window.CurrencyManager ? window.CurrencyManager.format(parseFloat(priceValue) || 0) : '$' + priceValue);
        priceDiv.appendChild(priceBtn);
        row.appendChild(priceDiv);

        // Actions
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'list-col-actions';
        actionsDiv.style.cssText = 'width:100%; justify-content:flex-end;';

        const mobilePlayBtn = document.createElement('button');
        mobilePlayBtn.className = 'btn-list-icon mobile-only-play';
        mobilePlayBtn.title = 'Reproducir';
        mobilePlayBtn.onclick = (e) => { e.stopPropagation(); document.getElementById(`btn-play-${waveformId}`)?.click(); };
        const mpIcon = document.createElement('i');
        mpIcon.className = 'bi bi-play-fill';
        mobilePlayBtn.appendChild(mpIcon);
        actionsDiv.appendChild(mobilePlayBtn);

        const isLiked = window.FavoritesManager ? window.FavoritesManager.isLiked(prod.id) : false;
        const heartBtn = document.createElement('button');
        heartBtn.className = 'btn-list-icon';
        heartBtn.title = 'Like';
        if (isLiked) heartBtn.style.color = '#ef4444';
        const hIcon = document.createElement('i');
        hIcon.className = isLiked ? 'bi bi-heart-fill' : 'bi bi-heart';
        heartBtn.appendChild(hIcon);
        actionsDiv.appendChild(heartBtn);

        const dlBtn = document.createElement('button');
        dlBtn.className = 'btn-list-icon';
        dlBtn.title = 'Download';
        const dlIcon = document.createElement('i');
        dlIcon.className = 'bi bi-download';
        dlBtn.appendChild(dlIcon);
        actionsDiv.appendChild(dlBtn);

        const shareBtn = document.createElement('button');
        shareBtn.className = 'btn-list-icon btn-share-product';
        shareBtn.title = 'Compartir';
        const shIcon = document.createElement('i');
        shIcon.className = 'bi bi-share';
        shareBtn.appendChild(shIcon);
        actionsDiv.appendChild(shareBtn);

        row.appendChild(actionsDiv);

        rowsMetadata.push({ row, prod, waveformId, audioUrl, authUrl: authorizedUrls[index] });
        fragment.appendChild(row);
    });

    // 3. Swap
    list.innerHTML = '';
    list.appendChild(fragment);

    list.classList.remove('fade-in');
    void list.offsetWidth;
    list.classList.add('fade-in');

    // 4. Post-Append Initialization
    rowsMetadata.forEach(async (meta) => {
        const { row, prod, waveformId, audioUrl, authUrl } = meta;

        // Authorize Image
        if (prod.image_url) {
            const img = row.querySelector('img');
            const parent = img?.parentElement;
            if (parent) parent.classList.add('img-loading-skeleton');

            if (img) {
                img.onload = () => {
                    if (parent) parent.classList.remove('img-loading-skeleton');
                    img.style.opacity = 1;
                };
                img.onerror = () => {
                    if (parent) parent.classList.remove('img-loading-skeleton');
                    img.src = '/images/portada-default.png';
                    img.style.opacity = 1;
                };

                if (authUrl) {
                    img.src = authUrl;
                } else {
                    img.src = prod.image_url || '/images/portada-default.png';
                }
                if (img.complete) img.onload();
            }
        }

        // Initialize WaveSurfer
        if (audioUrl && window.WaveSurfer) {
            try {
                const finalAudioUrl = await window.getAuthorizedUrl(audioUrl, prod.storage_version || prod.r2_version || 'v2', prod.id);
                const ws = WaveSurfer.create({
                    container: document.getElementById(waveformId),
                    waveColor: '#666',
                    progressColor: '#8b5cf6',
                    cursorColor: 'transparent',
                    barWidth: 2,
                    barRadius: 2,
                    barGap: 3,
                    height: 24,
                    url: finalAudioUrl,
                    normalize: true,
                    backend: 'MediaElement'
                });

                ws.on('ready', () => {
                    const container = document.getElementById(waveformId);
                    if (container) container.classList.remove('skeleton-waveform');
                    const durationEl = document.getElementById(`duration-${waveformId}`);
                    if (durationEl) {
                        const d = ws.getDuration();
                        const mins = Math.floor(d / 60);
                        const secs = Math.floor(d % 60).toString().padStart(2, '0');
                        durationEl.innerText = `${mins}:${secs}`;
                    }
                    window.activeWavesurfers.push(ws);
                });

                const playBtn = document.getElementById(`btn-play-${waveformId}`);
                if (playBtn) {
                    playBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (window.StickyPlayer) {
                            const audioUrl = getProductAudio(prod);
                            const trackData = { ...prod, audio_url: audioUrl, artist_users: user };
                            if (window.StickyPlayer.getCurrentTrackId() === prod.id) {
                                window.StickyPlayer.togglePlay();
                            } else {
                                window.StickyPlayer.play(trackData);
                            }
                        }
                    };
                }

                // Initialize Share Logic
                const shareBtnNode = row.querySelector('.btn-share-product');
                if (shareBtnNode) {
                    shareBtnNode.onclick = (e) => {
                        e.preventDefault(); e.stopPropagation();
                        if (window.openShareModal) {
                            window.openShareModal({ ...prod, artist_users: user });
                        }
                    };
                }
            } catch (err) {
                const el = document.getElementById(waveformId);
                if (el) { el.classList.remove('skeleton-waveform'); el.classList.add('waveform-static-fallback'); }
            }
        }
    });

    // UPDATE STICKY PLAYER PLAYLIST
    // Pass all tracks with artist_users data for proper navigation
    const tracksWithArtist = items.map(prod => ({
        ...prod,
        artist_users: user // Add producer/artist info
    }));

    if (window.StickyPlayer && window.StickyPlayer.updatePlaylist) {
        window.StickyPlayer.updatePlaylist(tracksWithArtist, user.nickname || 'Unknown');
        console.log(`[Profile] Updated StickyPlayer playlist: ${tracksWithArtist.length} tracks`);
    }
}

function setupProfileControls() {
    // 1. Search
    const searchWrapper = document.querySelector('.pro-search');
    const searchInput = document.getElementById('profileSearch');

    if (searchWrapper && searchInput) {
        // Mobile Toggle logic
        searchWrapper.onclick = (e) => {
            if (window.innerWidth <= 768) {
                if (!searchWrapper.classList.contains('active')) {
                    searchWrapper.classList.add('active');
                    searchInput.focus();
                    e.preventDefault(); // Prevent accidental bubble issues
                }
            }
        };

        // Close on blur if empty (optional, but clean)
        searchInput.onblur = () => {
            if (window.innerWidth <= 768 && !searchInput.value) {
                searchWrapper.classList.remove('active');
            }
        };

        searchInput.oninput = (e) => {
            currentSearch = e.target.value.toLowerCase();
            applyFilters();
        };

        // Handle enter or search icon click (if already active)
        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                searchInput.blur();
            }
        };
    }

    // 2. Tabs Controls (Filters)
    // Assume we have tabs like <button class="pro-text-filter" data-filter="all">TODOS</button>
    // Or check the user's specific HTML structure for toolbar filters
    document.querySelector('.pro-toolbar-container')?.addEventListener('click', (e) => {
        // Handle filter clicks if they exist within the toolbar 
        // e.g. text-filters
        if (e.target.closest('[data-filter]')) {
            const btn = e.target.closest('[data-filter]');

            // Update Active State
            document.querySelectorAll('[data-filter]').forEach(b => b.style.color = '#777');
            btn.style.color = '#fff'; // Active style

            currentFilter = btn.dataset.filter;
            applyFilters();
        }
    });

    // 3. Mobile Filter Button Toggle (Custom Modal)
    document.querySelector('.mobile-only-filter')?.addEventListener('click', () => {
        document.getElementById('profileFiltersModal')?.classList.add('active');
    });

    // Close modal on outside click
    document.getElementById('profileFiltersModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'profileFiltersModal') {
            e.target.classList.remove('active');
        }
    });

    // 4. Tempo Slider Initialization
    initTempoSlider();

    // 5. Key Selector Logic
    document.querySelector('.key-selector-grid')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.key-btn');
        if (btn) {
            document.querySelectorAll('.key-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
    });

    // 6. Apply Button Action
    document.getElementById('btnApplyFilters')?.addEventListener('click', () => {
        applyFilters();
        document.getElementById('profileFiltersModal')?.classList.remove('active');
    });
}

function initTempoSlider() {
    const minThumb = document.getElementById('tempo-thumb-min');
    const maxThumb = document.getElementById('tempo-thumb-max');
    const fill = document.querySelector('.tempo-slider-fill');
    const minVal = document.getElementById('tempo-min');
    const maxVal = document.getElementById('tempo-max');
    const track = document.querySelector('.tempo-slider-track');

    if (!minThumb || !maxThumb || !track) return;

    let min = 40;
    let max = 136;
    const TOTAL_RANGE = 136 - 40;

    const updateSlider = (percent, isMax) => {
        const bpm = Math.round(40 + (percent / 100) * TOTAL_RANGE);
        if (isMax) {
            if (bpm < min + 5) return; // Keep minimum distance
            max = bpm;
            maxVal.innerText = max;
            maxThumb.style.left = `${percent}%`;
        } else {
            if (bpm > max - 5) return;
            min = bpm;
            minVal.innerText = min;
            minThumb.style.left = `${percent}%`;
        }
        fill.style.left = `${((min - 40) / TOTAL_RANGE) * 100}%`;
        fill.style.width = `${((max - min) / TOTAL_RANGE) * 100}%`;

        // Save state on track/modal if needed, or just let applyFilters read minVal/maxVal text
    };

    const handleDrag = (e, isMax) => {
        const rect = track.getBoundingClientRect();
        let x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        let percent = Math.min(Math.max((x / rect.width) * 100, 0), 100);
        updateSlider(percent, isMax);
    };

    const addEvents = (thumb, isMax) => {
        const start = (e) => {
            const move = (ev) => handleDrag(ev, isMax);
            const stop = () => {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', stop);
                document.removeEventListener('touchmove', move);
                document.removeEventListener('touchend', stop);
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', stop);
            document.addEventListener('touchmove', move);
            document.addEventListener('touchend', stop);
            e.preventDefault();
        };
        thumb.addEventListener('mousedown', start, { passive: false });
        thumb.addEventListener('touchstart', start, { passive: false });
    };

    addEvents(minThumb, false);
    addEvents(maxThumb, true);
}


function applyFilters() {
    const modal = document.getElementById('profileFiltersModal');
    if (!modal) return;

    // 1. Get Values from Modal
    const sort = modal.querySelector('input[name="sort"]:checked')?.value || 'popular';

    // File Types
    const fileTypes = Array.from(modal.querySelectorAll('input[name="filetype"]:checked')).map(i => i.value);

    // Categories
    const categories = Array.from(modal.querySelectorAll('input[name="category"]:checked')).map(i => i.value);

    // Tempo
    const bpmMin = parseInt(document.getElementById('tempo-min').innerText);
    const bpmMax = parseInt(document.getElementById('tempo-max').innerText);

    // Key & Scale
    const mode = modal.querySelector('input[name="mode"]:checked')?.value || 'minor';
    const selectedKey = modal.querySelector('.key-btn.active')?.dataset.key || '';

    // Licenses
    const licenses = Array.from(modal.querySelectorAll('input[name="license"]:checked')).map(i => i.value);

    // 2. Perform Filtering
    let filtered = productsCache.filter(p => {
        // Text Search
        if (currentSearch && !p.name.toLowerCase().includes(currentSearch)) return false;

        // Category Check
        if (categories.length > 0) {
            const pType = (p.product_type || '').toLowerCase();
            const match = categories.some(cat => pType.includes(cat));
            if (!match) return false;
        }

        // BPM Check
        if (p.bpm) {
            if (p.bpm < bpmMin || p.bpm > bpmMax) return false;
        }

        // Key Check
        if (selectedKey && p.key) {
            const pKey = p.key.replace(/\s/g, ''); // Remove spaces
            // Simple loose match for now
            if (!pKey.includes(selectedKey)) return false;
            // Mode check
            if (mode === 'minor' && !pKey.toLowerCase().includes('m')) {
                // If it doesn't have 'm', assume major (loose logic)
            }
        }

        return true;
    });

    // 3. Sorting
    if (sort === 'trending' || sort === 'popular') {
        const getScore = (p) => (p.views_count || 0) + (p.plays_count || 0) * 2 + (p.stats_likes || 0) * 10;
        filtered.sort((a, b) => getScore(b) - getScore(a));
    } else if (sort === 'recent') {
        filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sort === 'random') {
        filtered.sort(() => Math.random() - 0.5);
    }

    // 4. Render
    const userNickname = document.getElementById('profileName')?.innerText || 'Unknown';
    const userData = {
        nickname: userNickname,
        id: window.currentProfileUserId || null,
        avatar_url: null,
        is_verified: false,
        products_count: productsCache.length,
        followers_count: 0
    };

    renderProductList(filtered, userData);
}

// === ARTIST HOVER CARD LOGIC ===
// Moved to /script/hover-card.js
// This file now relies on the shared script being imported in the HTML.

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // 1. Delegated Like Click (One-time binding)
    const listContainer = document.getElementById('profileProductsList');
    if (listContainer) {
        listContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-list-icon');
            if (btn && btn.title === 'Like') {
                e.stopPropagation();

                // --- GUEST GUARD (Explicit Check) ---
                const token = window.getAccessToken ? window.getAccessToken() : null;
                if (!token) {
                    if (window.showGuestModal) {
                        window.showGuestModal(
                            "Â¡Guarda tus favoritos!",
                            "Inicia sesiÃ³n para guardar estos sonidos en tu colecciÃ³n personal."
                        );
                    } else {
                        window.location.href = '/pages/login.html';
                    }
                    return;
                }

                const row = btn.closest('.list-row');
                if (row && window.FavoritesManager) {
                    const prodId = row.dataset.id;

                    // --- FAST FEEDBACK (Optimistic Toggle) ---
                    const icon = btn.querySelector('i');
                    const isCurrentlyLiked = icon.classList.contains('bi-heart-fill');

                    if (isCurrentlyLiked) {
                        icon.className = 'bi bi-heart';
                        btn.style.color = '';
                    } else {
                        icon.className = 'bi bi-heart-fill';
                        btn.style.color = '#ef4444';
                    }

                    // Animate
                    btn.style.transform = "scale(1.2)";
                    setTimeout(() => btn.style.transform = "scale(1)", 200);

                    // Call backend manager
                    window.FavoritesManager.toggleLike(prodId, btn);
                }
            }
        });
    }

    // 2. Favorites Subscription (Sync UI state)
    if (window.FavoritesManager) {
        window.FavoritesManager.subscribe((likedIds) => {
            // Update List View Rows
            document.querySelectorAll('.list-row[data-id]').forEach(row => {
                const prodId = row.dataset.id;
                const isLiked = likedIds.has(String(prodId));
                const btn = row.querySelector('.btn-list-icon[title="Like"]');
                if (btn) {
                    btn.innerHTML = '';
                    const icon = document.createElement('i');
                    icon.className = isLiked ? 'bi bi-heart-fill' : 'bi bi-heart';
                    btn.appendChild(icon);
                    btn.style.color = isLiked ? '#ef4444' : '';
                }
            });

            // Update Grid View Cards (Optimistic Sync)
            document.querySelectorAll('.ots-heart-btn[data-id]').forEach(btn => {
                const prodId = btn.dataset.id;
                const isLiked = likedIds.has(String(prodId));

                // Set active class
                btn.classList.toggle('active', isLiked);

                // Set icon
                btn.innerHTML = `<i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i>`;

                // If the element expects inline style for red:
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.style.color = isLiked ? '#ef4444' : '';
                }
            });
        });
    }
});

// --- DYNAMIC SEO FOR PROFILES ---
function injectProfileSEO(user) {
    if (!user) return;

    const nickname = user.nickname || "Productor";
    const role = user.role || "Productor Musical";
    const bio = user.bio ? user.bio.substring(0, 160) : `Mira el perfil oficial de ${nickname} en OFFSZN. Escucha sus beats, descarga sus kits y colabora.`;
    const profileUrl = window.location.href;
    const avatar = user.avatar_url || "https://offszn.lat/images/LOGO%20OFFSZN.webp";

    // 1. Browser Title
    document.title = `${nickname} | Perfil Oficial de Productor en OFFSZN`;

    // 2. Meta Tags
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = "description";
        document.head.appendChild(metaDesc);
    }
    metaDesc.content = bio;

    // Open Graph
    updateMetaTag('property', 'og:title', `${nickname} - OFFSZN`);
    updateMetaTag('property', 'og:description', bio);
    updateMetaTag('property', 'og:url', profileUrl);
    updateMetaTag('property', 'og:type', 'profile');
    if (avatar) updateMetaTag('property', 'og:image', avatar);

    // Profile specific OG
    updateMetaTag('property', 'profile:username', nickname);

    // 3. JSON-LD Schema (Person / MusicGroup)
    let schemaScript = document.getElementById('profile-schema');
    if (!schemaScript) {
        schemaScript = document.createElement('script');
        schemaScript.id = 'profile-schema';
        schemaScript.type = 'application/ld+json';
        document.head.appendChild(schemaScript);
    }

    const schema = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": nickname,
        "description": bio,
        "url": profileUrl,
        "image": avatar,
        "jobTitle": role,
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": profileUrl
        }
    };

    schemaScript.textContent = JSON.stringify(schema);
}

function updateMetaTag(attr, value, content) {
    let el = document.querySelector(`meta[${attr}="${value}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, value);
        document.head.appendChild(el);
    }
    el.content = content;
}

// ============================================================================
// REDESIGN: Old School Sidebar
// ============================================================================
async function renderOldSchoolSidebar(user, categoryCounts = null) {
    const header = document.querySelector('.profile-header');
    if (!header) return;

    const isMe = window.currentUserId && (user.id === window.currentUserId);

    // 1. Setup Header Content Container
    const content = header.querySelector('.profile-header-content');
    if (!content) return;
    content.innerHTML = ''; // Fresh start for Old School

    // --- AVATAR ---
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'profile-avatar-container';
    const avatarImgDiv = document.createElement('div');
    avatarImgDiv.id = 'profileAvatar';
    avatarImgDiv.className = 'profile-avatar-img';

    if (user.avatar_url) {
        const img = document.createElement('img');
        const isR2 = window.AuthUtils && window.AuthUtils.isR2Url(user.avatar_url);
        img.src = isR2 ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' : (window.AuthUtils?.getFormattedSupabaseUrl ? window.AuthUtils.getFormattedSupabaseUrl(user.avatar_url) : user.avatar_url);
        img.className = 'skeleton-img-transition';
        img.id = 'profileAvatarImg';
        avatarImgDiv.appendChild(img);

        if (isR2) {
            window.getAuthorizedUrl(user.avatar_url, user.r2_version || 'v2').then(url => {
                img.onload = () => img.style.opacity = 1;
                img.src = url;
            });
        } else {
            img.style.opacity = 1;
        }
    } else {
        const initial = (user.nickname || "U").charAt(0).toUpperCase();
        const span = document.createElement('span');
        span.textContent = initial;
        avatarImgDiv.appendChild(span);
    }
    avatarContainer.appendChild(avatarImgDiv);

    if (isMe) {
        const changeBtn = document.createElement('button');
        changeBtn.id = 'ownerChangeAvatar';
        changeBtn.className = 'owner-avatar-btn';
        changeBtn.innerHTML = '<i class="bi bi-plus-lg"></i>';
        changeBtn.onclick = () => window.AvatarManager && window.AvatarManager.open(document.querySelector('#profileAvatar img')?.src);
        avatarContainer.appendChild(changeBtn);
    }
    content.appendChild(avatarContainer);

    // --- NAME & ROLE ---
    const details = document.createElement('div');
    details.className = 'profile-details';

    const nameRow = document.createElement('div');
    nameRow.className = 'profile-top-row';
    const h1 = document.createElement('h1');
    h1.id = 'profileName';
    h1.textContent = user.nickname || "User";
    nameRow.appendChild(h1);

    if (user.is_verified || user.is_producer || user.plan) {
        const badge = document.createElement('div');
        badge.id = 'profileVerified';
        badge.className = 'verified-badge';
        if (user.plan) badge.classList.add(user.plan);
        badge.innerHTML = '<i class="bi bi-patch-check-fill"></i>';
        nameRow.appendChild(badge);
    }
    details.appendChild(nameRow);

    const roleDiv = document.createElement('div');
    roleDiv.id = 'profileRole';
    roleDiv.className = 'profile-role-sub';
    roleDiv.textContent = user.role || 'Productor';
    details.appendChild(roleDiv);

    // Check if location exists before appending
    if (user.location) {
        const locDiv = document.createElement('div');
        locDiv.id = 'profileLocation';
        locDiv.className = 'profile-location-sub';
        locDiv.textContent = user.location;
        details.appendChild(locDiv);
    }

    content.appendChild(details);

    // --- ACTIONS ---
    const actions = document.createElement('div');
    actions.className = 'profile-actions';

    if (isMe) {
        const persBtn = document.createElement('button');
        persBtn.id = 'btnPersonalize';
        persBtn.className = 'btn-personalize-compact';
        persBtn.innerHTML = '<i class="bi bi-pencil-fill" style="margin-right:6px;"></i> Personalizar';
        persBtn.onclick = () => {
            if (window.ProfilePersonalizer) {
                window.ProfilePersonalizer.open();
            } else {
                console.warn('ProfilePersonalizer not found on window');
            }
        };
        actions.appendChild(persBtn);

        const setBtn = document.createElement('button');
        setBtn.id = 'btnAccountSettings';
        setBtn.className = 'btn-secondary-compact';
        setBtn.innerHTML = '<i class="bi bi-gear-fill" style="margin-right:6px;"></i> Ajustes';
        setBtn.onclick = () => window.location.href = '/account-settings';
        actions.appendChild(setBtn);
    } else {
        const followBtn = document.createElement('button');
        followBtn.id = 'btnFollow';
        followBtn.className = 'btn-follow-compact';
        followBtn.setAttribute('data-target-id', user.id);
        followBtn.innerHTML = '<i class="bi bi-plus-lg"></i> Seguir';
        actions.appendChild(followBtn);

        const msgBtn = document.createElement('button');
        msgBtn.id = 'btnMessage';
        msgBtn.className = 'btn-secondary-compact';
        msgBtn.innerHTML = '<i class="bi bi-chat-dots-fill"></i> Mensaje';
        msgBtn.onclick = () => window.location.href = `/mensajes.html?user=${user.nickname}`;
        actions.appendChild(msgBtn);
    }
    content.appendChild(actions);

    // --- STATS ---
    const statsSection = document.createElement('div');
    statsSection.className = 'sidebar-section';
    statsSection.innerHTML = '<h3 class="sidebar-label">Estadísticas</h3>';

    const statsList = document.createElement('div');
    statsList.className = 'sidebar-stats-list';

    const createStatRow = (label, value) => {
        const row = document.createElement('div');
        row.className = 'sidebar-stat-row';

        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;

        const valB = document.createElement('b');
        valB.textContent = value;

        row.appendChild(labelSpan);
        row.appendChild(valB);
        return row;
    };

    // Format numbers like 2200 -> 2.2k
    const formatNumber = (num) => {
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num;
    };

    statsList.appendChild(createStatRow('Seguidores', formatNumber(user.followers_count || 0)));
    statsList.appendChild(createStatRow('Reproducciones', formatNumber(user.total_plays || 0)));
    statsList.appendChild(createStatRow('Productos', formatNumber(user.products_count || 0)));
    statsSection.appendChild(statsList);
    content.appendChild(statsSection);

    // --- PRODUCTS CHIPS ---
    if (categoryCounts) {
        const prodSection = document.createElement('div');
        prodSection.className = 'sidebar-section sidebar-products-section';
        prodSection.innerHTML = '<h3 class="sidebar-label">Productos</h3>';

        const chipsDiv = document.createElement('div');
        chipsDiv.className = 'sidebar-chips';

        const types = [
            { id: 'beat', label: 'Beats' },
            { id: 'preset', label: 'Presets' },
            { id: 'loopkit', label: 'Loopkits' },
            { id: 'drumkit', label: 'Drumkits' },
            { id: 'soundkit', label: 'Soundkits' }
        ];

        types.forEach(t => {
            const count = categoryCounts[t.id] || 0;
            if (count > 0) {
                const chip = document.createElement('div');
                chip.className = 'sidebar-chip';
                chip.innerHTML = `<span>${count}</span> ${t.label}`;
                chipsDiv.appendChild(chip);
            }
        });

        if (chipsDiv.children.length > 0) {
            prodSection.appendChild(chipsDiv);
            content.appendChild(prodSection);
        }
    }

    // --- ABOUT ME ---
    const bioSection = document.createElement('div');
    bioSection.className = 'sidebar-section sidebar-bio-section';
    bioSection.innerHTML = '<h3 class="sidebar-label">Acerca de mi</h3>';

    const bioText = document.createElement('div');
    bioText.id = 'profileBioSidebar';
    bioText.className = 'sidebar-bio';

    const rawBio = user.bio || '';
    const limit = 50;

    if (rawBio) {
        const renderBio = (isShort) => {
            bioText.innerHTML = '';

            let text = rawBio;
            if (isShort && rawBio.length > limit) {
                // Find nearest space to cut cleanly
                const spaceIndex = rawBio.lastIndexOf(' ', limit);
                const cutIndex = spaceIndex > 0 ? spaceIndex : limit;
                text = rawBio.substring(0, cutIndex) + '...';
            }

            bioText.textContent = text;

            if (rawBio.length > limit) {
                const toggle = document.createElement('span');
                toggle.className = 'bio-toggle-link';
                toggle.textContent = isShort ? 'Ver más' : 'Ver menos';
                toggle.onclick = () => renderBio(!isShort);
                bioText.appendChild(document.createElement('br'));
                bioText.appendChild(toggle);
            }
        };

        renderBio(true);
        bioSection.appendChild(bioText);
        content.appendChild(bioSection);
    }

    // --- FIND ME ON (Socials) ---
    if (user.socials) {
        try {
            const socials = typeof user.socials === 'string' ? JSON.parse(user.socials) : user.socials;
            const iconMap = {
                instagram: { icon: 'bi-instagram', label: 'Instagram' },
                youtube: { icon: 'bi-youtube', label: 'YouTube' },
                tiktok: { icon: 'bi-tiktok', label: 'TikTok' },
                spotify: { icon: 'bi-spotify', label: 'Spotify' },
                twitter: { icon: 'bi-twitter-x', label: 'Twitter' },
                facebook: { icon: 'bi-facebook', label: 'Facebook' },
                discord: { icon: 'bi-discord', label: 'Discord' },
                website: { icon: 'bi-globe', label: 'Website' }
            };

            const keys = Object.keys(socials).filter(k => {
                const val = socials[k];
                return val && String(val).trim() !== '' && iconMap[k.toLowerCase()];
            });

            if (keys.length > 0) {
                const socialSection = document.createElement('div');
                socialSection.className = 'sidebar-section sidebar-socials-section';
                socialSection.innerHTML = '<h3 class="sidebar-label">Redes</h3>';

                const socialList = document.createElement('div');
                socialList.className = 'sidebar-social-list';

                keys.forEach(key => {
                    const k = key.toLowerCase();
                    const val = socials[key];

                    const row = document.createElement('a');
                    row.className = 'sidebar-social-row';
                    row.target = '_blank';

                    let href = val;
                    if (!val.startsWith('http')) {
                        if (k === 'instagram') href = `https://instagram.com/${val}`;
                        else if (k === 'youtube') href = `https://youtube.com/@${val}`;
                        else if (k === 'tiktok') href = `https://tiktok.com/@${val}`;
                        else if (k === 'twitter') href = `https://twitter.com/${val}`;
                    }
                    row.href = href;

                    const icon = document.createElement('i');
                    icon.className = `bi ${iconMap[k].icon}`;
                    row.appendChild(icon);

                    const label = document.createElement('span');
                    label.textContent = iconMap[k].label;
                    row.appendChild(label);

                    socialList.appendChild(row);
                });
                socialSection.appendChild(socialList);
                content.appendChild(socialSection);
            }
        } catch (e) {
            console.error("Error parsing socials for sidebar:", e);
        }
    }
}
