
// Logic for displaying public profile data based on /@username URL

const supabase = window.supabaseClient; // Initialized by auth-utils.js
window.activeWavesurfers = window.activeWavesurfers || [];
window.currentlyPlaying = window.currentlyPlaying || null;

document.addEventListener('DOMContentLoaded', async () => {
    // 0. INITIALIZE REVEAL PROMISES (Master Coordination)
    window.profileTimerPromise = new Promise(res => setTimeout(res, 2300));

    // Signals to reveal the content (Fired after preparation + timer)
    let triggerReveal;
    window.profileRevealSignal = new Promise(res => { triggerReveal = res; });
    window.triggerProfileReveal = triggerReveal;

    // 1. SAFETY CHECK: Only run if on Profile Page
    if (!document.getElementById('profile-root')) return;

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
                console.error("User not found by ID:", idParam);
            }
        } catch (err) {
            console.error("Error resolving ID to nickname:", err);
        }
    }

    if (!username) {
        console.error("No username found in URL");
        // Optional: Redirect to 404 or home
        return;
    }

    // const username = match[1]; // REMOVED
    console.log("Loading profile for:", username);

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
            console.log("Profile Init Data Loaded:", { following: window.currentUserFollowing.size, me: window.currentUserId });
        });
    }

    // 3. Fetch User Profile
    await loadUserProfile(username);
});

async function loadUserProfile(username) {
    try {
        // Switch to the stable public users endpoint
        const response = await fetch(`/api/users/${username}`);

        if (!response.ok) {
            throw new Error('Usuario no encontrado');
        }

        const user = await response.json();
        window.currentUserProfile = user; // Store for tab rendering

        // Wait for auth/following data to be ready before rendering header
        if (window.profileInitPromise) {
            await window.profileInitPromise;
        }

        // 3. Render Header Data (IMMEDIATE)
        // We render this ASAP so the user sees the profile info while products load.
        renderHeader(user);

        // 4. Fetch User Products (via API) - SYNC WAIT
        // We wait for the products fetch to complete so we can remove ALL skeletons together.
        await loadUserProducts(user);
    } catch (e) {
        console.error("Error loading profile:", e);
        document.getElementById('profileName').innerText = "Usuario no encontrado";
        document.getElementById('profileBio').innerText = "No se pudo cargar el perfil.";
    }
}

async function renderHeader(user) {
    // 0. Hold reveal until signal
    if (window.profileRevealSignal) await window.profileRevealSignal;

    // 1. Avatar Setup
    // We render the container immediately with either the public URL (Supabase) or a transparent placeholder (R2).
    // R2 Authorization happens in the background.

    const isR2 = user.avatar_url && (user.avatar_url.includes('r2.cloudflarestorage.com') || user.avatar_url.includes('pub-'));
    const avatarContainer = document.getElementById('profileAvatar');

    if (user.avatar_url) {
        // Default to public URL or Placeholder
        let currentSrc = isR2 ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' : user.avatar_url;
        let diffOpacity = isR2 ? 0 : 1;

        avatarContainer.innerHTML = `<img src="${currentSrc}" id="profileAvatarImg" alt="${user.nickname}" class="skeleton-img-transition" style="opacity: ${diffOpacity}" onerror="if(window.AvatarManager) window.AvatarManager.handleError(this, '${user.nickname.replace(/'/g, "\\'")}')">`;

        // Background Auth for R2
        if (isR2) {
            window.getAuthorizedUrl(user.avatar_url).then(url => {
                const img = document.getElementById('profileAvatarImg');
                if (img) {
                    img.onload = () => { img.style.opacity = 1; };
                    img.src = url;
                }
            }).catch(e => console.warn("Avatar Auth Failed", e));
        }

    } else {
        const initial = (user.nickname || "U").charAt(0).toUpperCase();
        avatarContainer.innerHTML = `<span>${initial}</span>`;
    }

    // Text Info
    // User requested to use Nickname specifically.
    document.getElementById('profileName').innerText = user.nickname || "User";

    // Role / Verified
    if (user.is_verified || user.is_producer) {
        const verifyBadge = document.getElementById('profileVerified');
        verifyBadge.style.display = 'inline-block';

        // Tooltip logic
        verifyBadge.classList.add('verified-container');
        verifyBadge.innerHTML = `
            <i class="bi bi-patch-check-fill"></i>
            <div class="verified-tooltip">

                <div class="v-tooltip-header">
                    <i class="bi bi-patch-check-fill"></i> VERIFICADO OFFSZN
                </div>
                <div class="v-tooltip-body">
                    Plan Premium OFFSZN<br>
                    Productor Verificado<br>
                    <span style="color:#888; font-size:0.7rem;">Certificado Oficial</span>
                </div>
            </div>
        `;
    }

    document.getElementById('profileRole').innerText = user.role || '';
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
            } else if (val.includes(':')) {
                // Solid or Gradient
                const [type, color] = val.split(':');
                if (type === 'solid') {
                    header.style.background = color;
                } else if (type === 'gradient') {
                    // For gradients, the value might contain commas, so we take everything after 'gradient:'
                    // But simpler: just assume 'color' is the rest if split limit logic applied, 
                    // but split(':') splits ALL colons. 
                    // Let's use substring for robustness.
                    const gradientVal = val.substring(val.indexOf(':') + 1);
                    header.style.background = gradientVal;
                } else {
                    // Fallback for simple hex or other? 
                    // If it was just 'color', handled above? No, split logic is naive.
                    // If unknown type, try using as color?
                    header.style.background = color;
                }
            } else if (val.startsWith('http')) {
                // Legacy URL
                header.style.background = `url("${val}") center/cover no-repeat`;
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
    console.log("Dynamic Theme Status on Load:", isThemeActive, socials);
    applyDynamicThemeEffects(user.banner_url, isThemeActive);

    // Update Modal Toggle State (if me)
    const toggle = document.getElementById('dynamicThemeToggle');
    if (toggle) toggle.checked = isThemeActive;

    // Clear Location Skeleton (Fix stuck skeleton)
    const locEl = document.getElementById('profileLocation');
    if (locEl) {
        locEl.innerHTML = user.location || ''; // If no location, clear it.
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
    if (headerFollowBtn) headerFollowBtn.style.display = 'inline-block'; // Reveal

    const msgBtn = document.getElementById('btnMessage');
    if (msgBtn) {
        // Hide if viewing own profile
        if (isMe) {
            msgBtn.style.display = 'none';
        } else {
            msgBtn.style.display = 'inline-block'; // Reveal
            msgBtn.innerHTML = '<i class="bi bi-chat-dots-fill" style="margin-right:6px;"></i> Mensaje';
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
                if (val && icons[k]) {
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
                    a.innerHTML = `<i class="bi ${icons[k]}"></i>`;
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
        // 🔥 FIX: Ensure structure is preserved and text is visible
        const count = user.products_count !== undefined ? user.products_count : 0;
        pCountEl.innerHTML = `${count} <span style="font-weight:400;">Productos</span>`;
    }

    const fCountEl = document.getElementById('profileFollowersCount');
    if (fCountEl) {
        const count = user.followers_count || 0;
        const label = count === 1 ? 'Seguidor' : 'Seguidores';
        fCountEl.innerHTML = `${count} <span style="font-weight:400;">${label}</span>`;
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
                        "¡Sigue a este productor!",
                        "Crea una cuenta para seguir a tus artistas favoritos, recibir notificaciones de nuevos lanzamientos y más."
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
                    showToast(data.error || "No puedes realizar esta acción");
                }
            } catch (e) { console.error(e); }
            finally { followBtn.disabled = false; }
        };
    }
}

// --- TAB SYSTEM ---
window.setActiveTab = function (tabName) {
    console.log("Switching to tab:", tabName);

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

    // Logic
    if (tabName === 'products') {
        if (trendingArea) trendingArea.style.display = 'flex';
        if (trendingGrid) trendingGrid.style.display = 'grid';
        if (toolbar) toolbar.style.display = 'flex';
        if (productsList) productsList.style.display = 'flex';
        servicesSection.style.display = 'none';
        aboutSection.style.display = 'none';
    } else if (tabName === 'services') {
        if (trendingArea) trendingArea.style.display = 'none';
        if (trendingGrid) trendingGrid.style.display = 'none';
        if (toolbar) toolbar.style.display = 'none';
        if (productsList) productsList.style.display = 'none';
        servicesSection.style.display = 'block';
        aboutSection.style.display = 'none';

        // Render Services Content
        renderServicesTab(servicesSection);
    } else if (tabName === 'about') {
        if (trendingArea) trendingArea.style.display = 'none';
        if (trendingGrid) trendingGrid.style.display = 'none';
        if (toolbar) toolbar.style.display = 'none';
        if (productsList) productsList.style.display = 'none';
        servicesSection.style.display = 'none';
        aboutSection.style.display = 'block';

        // Populate Bio & Info
        renderAboutTab(aboutSection);
    }
}

function renderAboutTab(container) {
    const user = window.currentUserProfile; // Assuming it's stored globally
    if (!user) return;

    container.innerHTML = `
        <div class="about-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-top: 20px;">
            <div class="about-card" style="background: #111; padding: 24px; border-radius: 12px; border: 1px solid #222;">
                <h4 style="color: #8b5cf6; margin-bottom: 12px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">Biografía</h4>
                <p style="color: #ccc; line-height: 1.6; font-size: 0.95rem; white-space: pre-wrap;">${user.bio || "Sin biografía disponible."}</p>
            </div>
            <div class="about-card" style="background: #111; padding: 24px; border-radius: 12px; border: 1px solid #222;">
                <h4 style="color: #8b5cf6; margin-bottom: 20px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">Detalles</h4>
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid #222;">
                        <span style="color: #666; font-size: 0.85rem;">Experiencia</span>
                        <span style="color: #fff; font-weight: 600; font-size: 0.9rem;">${user.experience ? user.experience[0] : 'No especificada'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid #222;">
                        <span style="color: #666; font-size: 0.85rem;">DAW Principal</span>
                        <span style="color: #fff; font-weight: 600; font-size: 0.9rem;">${(user.daws && user.daws.length > 0) ? user.daws[0] : 'No especificado'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #666; font-size: 0.85rem;">Miembro desde</span>
                        <span style="color: #fff; font-weight: 600; font-size: 0.9rem;">
                            ${(() => {
            const d = new Date(user.created_at);
            return `${d.getDate()} de ${d.toLocaleDateString('es-ES', { month: 'long' })} de ${d.getFullYear()}`;
        })()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderServicesTab(container) {
    const user = window.currentUserProfile;
    if (!user) return;

    const socials = user.socials || {};
    const services = socials.offered_services || {};
    const hasServices = services.mixing || services.mastering;

    let servicesHtml = '';
    if (hasServices) {
        servicesHtml = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
                ${services.mixing ? `
                    <div style="background: #111; border: 1px solid #222; padding: 24px; border-radius: 12px; text-align: center;">
                        <i class="bi bi-mic-fill" style="font-size: 2rem; color: #8b5cf6; display: block; margin-bottom: 12px;"></i>
                        <h4 style="color: #fff; margin-bottom: 4px;">Servicio de Mezcla</h4>
                        <p style="color: #666; font-size: 0.8rem;">Mezcla profesional para tus tracks.</p>
                    </div>` : ''}
                ${services.mastering ? `
                    <div style="background: #111; border: 1px solid #222; padding: 24px; border-radius: 12px; text-align: center;">
                        <i class="bi bi-waveform" style="font-size: 2rem; color: #10b981; display: block; margin-bottom: 12px;"></i>
                        <h4 style="color: #fff; margin-bottom: 4px;">Servicio de Mastering</h4>
                        <p style="color: #666; font-size: 0.8rem;">El toque final para un sonido comercial.</p>
                    </div>` : ''}
                <div style="background: #181818; border: 1px dashed #333; padding: 24px; border-radius: 12px; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; cursor: pointer;" onclick="document.getElementById('btnMessage')?.click()">
                    <i class="bi bi-chat-left-text" style="font-size: 1.5rem; color: #555; margin-bottom: 8px;"></i>
                    <span style="color: #888; font-size: 0.85rem; font-weight: 600;">Contactar ahora</span>
                </div>
            </div>
        `;
    } else {
        servicesHtml = `
            <div class="empty-state" style="padding: 40px 20px; text-align: center; background: #111; border-radius: 12px; border: 1px solid #222; margin-bottom: 32px;">
                <p style="color: #666; margin: 0;">Este usuario no ofrece servicios listados actualmente.</p>
            </div>
        `;
    }

    let spotifyHtml = '';
    if (socials.spotify_content) {
        // Extract ID or URL
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
            spotifyHtml = `
                <div style="margin-top: 32px;">
                    <h4 style="color: #fff; margin-bottom: 16px; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;">
                        <i class="bi bi-spotify" style="color: #1DB954;"></i> Mi Portfolio / Playlist
                    </h4>
                    <iframe style="border-radius:12px" src="${embedUrl}?utm_source=generator&theme=0" width="100%" height="380" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
                </div>
            `;
        }
    }

    container.innerHTML = `
        <div class="services-container" style="margin-top: 20px;">
            ${servicesHtml}
            ${spotifyHtml}
        </div>
    `;
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
        const mainView = document.querySelector('.p-modal-main-view');
        if (mainView) mainView.style.display = 'flex';

        // Fetch Plan Status
        this.checkPlan();

        // 🔥 Sync Mockup Data
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
        if (roleEl) roleEl.innerText = user.role || "Productor • Artista";
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
            mockupHeader.style.background = actualHeader.style.background;
            mockupHeader.style.backgroundImage = actualHeader.style.backgroundImage;
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
                content.style.width = '440px';
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

        const mainView = document.querySelector('.p-modal-main-view');
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
                    content.style.width = '1000px'; // Wide for panoramic
                    content.style.transition = 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                    // 🔥 Trigger layout recalculation
                    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
                }
            }

            const mainView = document.querySelector('.p-modal-main-view');
            if (mainView) mainView.style.display = 'none';
            document.getElementById('sideBySideContainer').style.display = 'flex';

            // 🔥 Unified Preview Sync
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
            if (window.showToast) window.showToast("El archivo es muy pesado (máx 30MB).", "error");
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
            modalContainer.style.width = '1000px'; // Standardized wide width
            modalContainer.style.transition = 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            // 🔥 Force recalculation to avoid clipping reported by user
            setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
        }

        const sideContainer = document.getElementById('sideBySideContainer');
        if (sideContainer) {
            // 🔥 LOCK HEIGHT: Use a fixed height during crop to prevent "jumping"
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
                    // 🔥 FORCE RECTANGULAR CROP
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
            confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" style="width: 1em; height: 1em; border-width: 2px; margin-right: 8px; display: inline-block; vertical-align: middle; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spinner-border .75s linear infinite;"></span> Guardando...';

            if (!document.getElementById('spinner-style-inline')) {
                const style = document.createElement('style');
                style.id = 'spinner-style-inline';
                style.textContent = `@keyframes spinner-border {to{transform:rotate(360deg)}}`;
                document.head.appendChild(style);
            }
        }

        // 🔥 LOCK UI: Disable cancel and close buttons
        if (cancelBtn) cancelBtn.disabled = true;
        if (closeBtn) closeBtn.style.visibility = 'hidden';

        // 🔥 LOCK CROPPER: Disable interaction while uploading
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
            // 🔥 UNLOCK UI: If error, allow user to try again or cancel
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = 'Confirmar';
            }
            if (cancelBtn) cancelBtn.disabled = false;
            if (closeBtn) closeBtn.style.visibility = 'visible';

            // 🔥 RE-ENABLE CROPPER
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

        // 🔥 Restore Modal UI
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

        // 🔥 Gating: Only GIFs are Pro. Static images/colors/gradients are Free.
        if ((isCustomGif || isPresetGif) && !this.isPro) {
            if (window.showToast) window.showToast("Esta función es exclusiva para usuarios PRO.", "info");
            setTimeout(() => window.location.href = '/cuenta/planes.html', 1500);
            return;
        }

        const isDynamicActive = document.getElementById('dynamicThemeToggle')?.checked || false;

        try {
            if (window.showToast) window.showToast("Guardando cambios...", "info");

            let finalBannerUrl = bannerVal;

            // 🔥 Handle Custom Upload via Cloudinary (Optimized: Send Cropped Base64)
            if (this.customFile) {
                let uploadPayload = null;
                let isGif = this.customFile.type === 'image/gif';

                // 🔥 UPLOAD VIA FORMDATA (MULTIPART)
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
                    throw new Error("Tu sesión ha expirado. Por favor recarga la página.");
                }

                const res = await fetch('/api/cloudinary/banner', {
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

            if (window.showToast) window.showToast("Personalización guardada.", "success");

            // 🔥 OPTIMISTIC UI UPDATE: Update the actual profile banner immediately so it feels instant
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
        console.log("Toggle Dynamic Theme:", isActive);
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
            console.log("Dynamic theme preference saved:", isActive);
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
        btn.innerHTML = '<i class="bi bi-plus-lg" style="margin-right:4px;"></i> Seguir';
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
    console.log("Global Follow Sync:", userId, isFollowing);
    syncFollowState(userId, isFollowing);
});



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
        if (user.avatar_url) urlsToWarm.push(user.avatar_url);

        // Trending
        if (window.trendingProducts) {
            window.trendingProducts.slice(0, 5).forEach(p => { if (p.image_url) urlsToWarm.push(p.image_url); });
        }

        // Main List (First 15 for instant reveal)
        productsCache.slice(0, 15).forEach(p => { if (p.image_url) urlsToWarm.push(p.image_url); });

        if (urlsToWarm.length > 0 && window.getAuthorizedUrl) {
            await Promise.all(urlsToWarm.map(url => window.getAuthorizedUrl(url).catch(() => null)));
        }

        // 1. Start all preparation in parallel
        const headerPromise = renderHeader(user);
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
        listContainer.innerHTML = '<div class="empty-state">Error cargando productos.</div>';
        trendGrid.innerHTML = '';
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
    // Detect @username and wrap in <a> tag
    const formatMentions = (text) => {
        return text.replace(/@([a-z0-9._-]+)/gi, (match, username) => {
            return `<a href="/@${username}" class="bio-mention">@${username}</a>`;
        });
    };

    if (cleanText.length > 150) {
        const charLimit = 150;
        const shortText = cleanText.substring(0, charLimit) + "...";

        const fullHtml = formatMentions(cleanText);
        const shortHtml = formatMentions(shortText);

        bioText.setAttribute('data-full', fullHtml);
        bioText.setAttribute('data-short', shortHtml);

        // Initial render (short)
        bioText.innerHTML = `${shortHtml} <br> <span id="bioToggle" style="color:var(--p-accent); cursor:pointer; font-weight:600; margin-top:4px; display:inline-block;">Ver más</span>`;

        bioText.onclick = (e) => {
            if (e.target.id === 'bioToggle') {
                const isExpanded = bioText.classList.contains('expanded');
                if (isExpanded) {
                    bioText.innerHTML = `${shortHtml} <br> <span id="bioToggle" style="color:var(--p-accent); cursor:pointer; font-weight:600; margin-top:4px; display:inline-block;">Ver más</span>`;
                    bioText.classList.remove('expanded');
                } else {
                    bioText.innerHTML = `${fullHtml} <br> <span id="bioToggle" style="color:var(--p-accent); cursor:pointer; font-weight:600; margin-top:4px; display:inline-block;">Ver menos</span>`;
                    bioText.classList.add('expanded');
                }
            }
        };
    } else {
        // No truncation needed, just format mentions
        bioText.innerHTML = formatMentions(cleanText);
    }
}

function setupTrendingControls(user, collabStats) {
    const arrows = document.querySelectorAll('.nav-arrows button');
    if (arrows.length < 2) return;

    const [prevBtn, nextBtn] = arrows;
    const totalItems = (window.trendingProducts || productsCache).length;

    // Visibility Check
    if (totalItems <= 5) {
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
        const pageSize = 5;
        const maxPages = Math.ceil(totalItems / pageSize);
        trendingPage = (trendingPage + 1) % maxPages; // Cycle: 0 -> 1 -> 0
        updateTrendingView(user, collabStats);
    };

    // Prev Logic
    prevBtn.onclick = () => {
        const pageSize = 5;
        const maxPages = Math.ceil(totalItems / pageSize);
        trendingPage = (trendingPage - 1 + maxPages) % maxPages; // Cycle: 0 -> 1 -> 0
        updateTrendingView(user, collabStats);
    };
}

function updateTrendingView(user, collabStats) {
    const pageSize = 5;
    const start = trendingPage * pageSize; // 0, 5, 10

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
        return window.getAuthorizedUrl(prod.image_url);
    });
    const authorizedUrls = await Promise.all(authPromises);

    // 2. Prepare all cards in memory
    const fragment = document.createDocumentFragment();

    items.forEach((prod, idx) => {
        const div = document.createElement('div');
        div.className = 'trending-card';
        const plays = prod.plays_count || 0;
        const seoLink = window.createSeoLink ? window.createSeoLink(prod) : '/producto.html?id=' + prod.id;

        // Initial image check (avoid broken icon)
        const isR2Trending = prod.image_url && (prod.image_url.includes('r2.cloudflarestorage.com') || prod.image_url.includes('pub-') || (!prod.image_url.startsWith('http') && prod.image_url.includes('/')));
        const initialImgTrending = isR2Trending ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' : (prod.image_url || 'https://via.placeholder.com/300');

        div.innerHTML = `
            <div class="t-card-cover">
                <img src="${initialImgTrending}" id="trending-img-${prod.id}" alt="${prod.name}" onclick="window.location.href='${seoLink}'" class="skeleton-img-transition">
                
                <button class="t-play-btn" title="Reproducir">
                    <i class="bi bi-play-fill"></i>
                </button>

                <div class="t-overlay-badge" title="Reproducciones Reales" onclick="window.location.href='${seoLink}'">
                    <i class="bi bi-music-note-beamed"></i> ${plays}
                </div>
            </div>
            <div class="t-card-info">
                <h4 title="${prod.name}" onclick="window.location.href='${seoLink}'">${prod.name}</h4>
                <div class="t-card-author" style="font-size:0.85rem; color:#888;">
                    ${(() => {
                const createSpan = (name, data, extraClass = '') => {
                    const safe = JSON.stringify(data).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                    return `<span class="artist-hover-trigger ${extraClass}" data-artist="${safe}" title="${name}" onmouseenter="window.showArtistCard(event, this)" onmouseleave="window.hideArtistCard(event, this)">${name}</span>`;
                };

                // Producer
                let html = createSpan(user.nickname, {
                    id: user.id,
                    nickname: user.nickname,
                    avatar_url: user.avatar_url,
                    is_verified: user.is_verified || user.is_producer,
                    stats: { followers: user.followers_count || 0 }
                }, 'producer-link-thin');

                const collabs = (prod.collaborators || [])
                    .filter(c => {
                        const hasName = (c.nickname || c.name) && (c.nickname || c.name).trim().length > 0;
                        const isAccepted = c.status === 'accepted';
                        return hasName && isAccepted;
                    });
                if (collabs.length > 0) {
                    html += `<span style="color:#666; margin-right:2px;">, </span>`;
                    const visible = collabs.slice(0, 2);
                    html += visible.map(c => {
                        const cName = c.nickname || c.name;
                        const pre = collabStats[cName] || {};
                        return createSpan(cName, {
                            id: pre.id || '',
                            nickname: cName,
                            avatar_url: pre.avatar_url || c.avatar_url,
                            is_verified: (pre.is_verified !== undefined) ? pre.is_verified : (c.is_verified || false),
                            stats: { followers: pre.followers !== undefined ? pre.followers : 0 }
                        }, 'collaborator-link-thin');
                    }).join('<span style="color:#666; margin-right:2px;">, </span>');

                    if (collabs.length > 2) html += '<span style="color:#666;">...</span>';
                }
                return html;
            })()}
                </div>
                <div class="t-meta-row">
                    <span>${prod.product_type || 'Beat'}</span>
                    <span style="font-size:0.4rem;">●</span>
                    <span>${prod.bpm ? prod.bpm + ' BPM' : 'New'}</span>
                </div>
            </div>
        `;

        // Direct event listener for the play button to prevent navigation
        const playBtn = div.querySelector('.t-play-btn');
        if (playBtn) {
            playBtn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                if (window.StickyPlayer) {
                    const trackData = { ...prod, artist_users: user };
                    window.StickyPlayer.play(trackData);
                }
            };
        }

        // Authorize trending image if authUrl exists
        const authUrl = authorizedUrls[idx];
        if (prod.image_url) {
            const img = div.querySelector('img');
            if (img) {
                if (authUrl) {
                    img.onload = () => { img.style.opacity = 1; };
                    img.src = authUrl;
                    if (img.complete) img.onload();
                } else {
                    img.style.opacity = 1;
                }
            }
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
        return window.getAuthorizedUrl(prod.image_url);
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
        if (isOwner) {
            list.innerHTML = `
                <div class="empty-state-cta">
                    <div class="empty-icon"><i class="bi bi-cloud-arrow-up-fill"></i></div>
                    <h3>Sube tu primer producto</h3>
                    <p>Comparte tus beats, kits o sonidos con el mundo. Solo tú puedes ver esto.</p>
                    <button class="btn-upload-first" onclick="window.location.href='/cuenta/subir-kit.html'">Subir ahora</button>
                </div>`;
        } else {
            list.innerHTML = '<div class="empty-state">No se encontraron productos con estos filtros.</div>';
        }
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
        const audioUrl = prod.mp3_url || prod.audio_url || prod.download_url_mp3 || prod.demo_file || prod.tagged_file || prod.preview_url || prod.cloud_url || (prod.track_data ? prod.track_data.audio_url : '') || '';

        const isR2List = prod.image_url && (prod.image_url.includes('r2.cloudflarestorage.com') || prod.image_url.includes('pub-') || (!prod.image_url.startsWith('http') && prod.image_url.includes('/')));
        const initialImgList = isR2List ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' : (prod.image_url || 'https://via.placeholder.com/100');

        row.innerHTML = `
            <div class="list-cover" style="cursor: pointer;" onclick="window.location.href = '${seoLink}'">
                <img src="${initialImgList}" id="list-img-${prod.id}" alt="cover" class="skeleton-img-transition">
            </div>
            <div class="list-col-info" style="cursor: pointer;" onclick="event.stopPropagation(); window.location.href = '${seoLink}'">
                <span class="list-track-title">${prod.name}</span>
                <span class="list-author-sub">
                    ${(() => {
                const createArtistSpan = (name, data, extraClass = '') => {
                    const safeData = JSON.stringify(data).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                    return `<span class="artist-hover-trigger ${extraClass}" data-artist="${safeData}" onmouseenter="window.showArtistCard(event, this)" onmouseleave="window.hideArtistCard(event, this)">${name}</span>`;
                };
                let html = createArtistSpan(user.nickname, { id: user.id, nickname: user.nickname, avatar_url: user.avatar_url, is_verified: user.is_verified || user.is_producer, stats: { products: user.products_count || 0, followers: user.followers_count || 0 } }, 'producer-link-thin');
                const collabs = (prod.collaborators || []).filter(c => (c.nickname || c.name) && c.status === 'accepted');
                if (collabs.length > 0) {
                    html += `<span style="color:#666; margin-right:2px;">, </span>`;
                    html += collabs.slice(0, 2).map(c => {
                        const cName = c.nickname || c.name;
                        const pre = collabStats[cName] || {};
                        return createArtistSpan(cName, { id: pre.id || '', nickname: cName, avatar_url: pre.avatar_url || c.avatar_url, is_verified: (pre.is_verified !== undefined) ? pre.is_verified : (c.is_verified || false), stats: { products: pre.products !== undefined ? pre.products : 0, followers: pre.followers !== undefined ? pre.followers : 0 } }, 'collaborator-link-thin');
                    }).join(`<span style="color:#666; margin-right:2px;">, </span>`);
                    if (collabs.length > 2) html += `, ...`;
                }
                return html;
            })()}
                </span>
            </div>
            <div class="list-col-player">
                <button class="btn-list-play" id="btn-play-${waveformId}"><i class="bi bi-play-fill"></i></button>
                <div class="list-waveform-container list-waveform skeleton-waveform" id="${waveformId}" style="height:28px; flex:1; position:relative;"></div>
            </div>
            <div class="list-col-tags">
                <span id="duration-${waveformId}" style="font-size:0.75rem; color:#666; font-weight:700; margin-right:8px; min-width:30px;">--:--</span>
                <span class="badge-outline badge-type">${prod.product_type || 'BEAT'}</span>
            </div>
            <div class="list-col-price">
                 <button class="btn-list-price" onclick="event.stopPropagation(); window.location.href = '${seoLink}'">
                    ${prod.is_free ? 'FREE' : '$' + (prod.price_basic || '—')}
                 </button>
            </div>
            <div class="list-col-actions" style="width:100%; justify-content:flex-end;">
                ${(() => {
                const isLiked = window.FavoritesManager ? window.FavoritesManager.isLiked(prod.id) : false;
                return `<button class="btn-list-icon" title="Like" style="${isLiked ? 'color:#ef4444;' : ''}"><i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i></button>`;
            })()}
                <button class="btn-list-icon" title="Download"><i class="bi bi-download"></i></button>
                <button class="btn-list-icon" title="Más"><i class="bi bi-three-dots"></i></button>
            </div>
        `;

        rowsMetadata.push({ row, prod, waveformId, audioUrl, authUrl: authorizedUrls[index] });
        fragment.appendChild(row);
    });

    // 3. Swap
    if (window.profileRevealSignal) await window.profileRevealSignal;

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
            if (img) {
                if (authUrl) {
                    img.onload = () => { img.style.opacity = 1; };
                    img.src = authUrl;
                    if (img.complete) img.onload();
                } else {
                    img.style.opacity = 1;
                }
            }
        }

        // Initialize WaveSurfer
        if (audioUrl && window.WaveSurfer) {
            try {
                const finalAudioUrl = await window.getAuthorizedUrl(audioUrl);
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
                    backend: 'WebAudio'
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
                            const trackData = { ...prod, artist_users: user };
                            if (window.StickyPlayer.getCurrentTrackId() === prod.id) {
                                window.StickyPlayer.togglePlay();
                            } else {
                                window.StickyPlayer.play(trackData);
                            }
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
    const searchInput = document.getElementById('profileSearch');
    if (searchInput) {
        searchInput.oninput = (e) => {
            currentSearch = e.target.value.toLowerCase();
            applyFilters();
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
}


function applyFilters() {
    const list = document.getElementById('profileProductsList');
    if (!list) return;

    // Filter Logic
    const filtered = productsCache.filter(p => {
        // Text Search
        const matchText = p.name.toLowerCase().includes(currentSearch);

        // Category Filter
        let matchCat = true;
        if (currentFilter !== 'all') {
            const pType = (p.product_type || '').toLowerCase();
            const filter = currentFilter.toLowerCase();

            // Loose matching
            if (filter === 'beat' || filter === 'beats') matchCat = pType.includes('beat');
            else if (filter === 'drum kit' || filter === 'drumkit') matchCat = pType.includes('drum') || pType.includes('kit');
            else if (filter === 'loop' || filter === 'loops') matchCat = pType.includes('loop') || pType.includes('sample');
            else matchCat = pType === filter;
        }
        return matchText && matchCat;
    });

    // 3. Delegated Actions (Like, Download, etc) - Moved to DOMContentLoaded/Init 

    // Get user data from DOM (fallback if not in cache)
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
                            "¡Guarda tus favoritos!",
                            "Inicia sesión para guardar estos sonidos en tu colección personal."
                        );
                    } else {
                        window.location.href = '/pages/login.html';
                    }
                    return;
                }

                const row = btn.closest('.list-row');
                if (row && window.FavoritesManager) {
                    const prodId = row.dataset.id;
                    window.FavoritesManager.toggleLike(prodId, btn);
                }
            }
        });
    }

    // 2. Favorites Subscription (Sync UI state)
    if (window.FavoritesManager) {
        window.FavoritesManager.subscribe((likedIds) => {
            document.querySelectorAll('.list-row[data-id]').forEach(row => {
                const prodId = row.dataset.id;
                const isLiked = likedIds.has(String(prodId));
                const btn = row.querySelector('.btn-list-icon[title="Like"]');
                if (btn) {
                    btn.innerHTML = isLiked ? '<i class="bi bi-heart-fill"></i>' : '<i class="bi bi-heart"></i>';
                    btn.style.color = isLiked ? '#ef4444' : '';
                }
            });
        });
    }
});
