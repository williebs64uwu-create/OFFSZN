// script/bio.js
// Handles dynamic fetching and DOM populating for /b/:username

window.activeWavesurfers = window.activeWavesurfers || [];
window.currentlyPlaying = window.currentlyPlaying || null;

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function initBioLink() {
    // 1. Get Username from URL
    const path = window.location.pathname;
    let username = null;

    const atMatch = path.match(/\/b\/@(.+)/);
    const regularMatch = path.match(/\/b\/(.+)/);

    if (atMatch) {
        username = atMatch[1];
    } else if (regularMatch) {
        username = regularMatch[1];
    }

    if (!username) {
        document.getElementById('bioNameText').innerText = "Enlace Inválido";
        triggerBioAnimation();
        return;
    }

    loadBioData(username);
}

// Module scripts are deferred, DOM is likely already ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBioLink);
} else {
    initBioLink();
}

// Global State for Biolink Features
let isEditMode = false;
let bioOwnerId = null;
let currentProfileData = null;
let finalAvatarUrlStr = '';

async function loadBioData(username) {
    try {
        // Fetch User Data from Public Endpoint
        const response = await fetch(`/api/users/${username}`);
        if (!response.ok) throw new Error('Usuario no encontrado');

        const user = await response.json();
        bioOwnerId = user.id;
        currentProfileData = user;

        renderBioHeader(user);
        renderSocials(user);

        // Fetch and Render Recent Products
        await loadRecentProducts(user);

        // Ownership Check: Enable Edit Mode if viewer is the owner
        let loggedUser = null;
        const token = window.AuthUtils ? window.AuthUtils.getAccessToken() : null;
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                loggedUser = payload.sub;
            } catch (e) { }
        }

        if (!loggedUser) {
            const { data: sessionData } = await window.supabaseClient.auth.getSession();
            loggedUser = sessionData?.session?.user?.id;
        }

        if (loggedUser && loggedUser === bioOwnerId) {
            const btnEdit = document.getElementById('btnEditMode');
            if (btnEdit) btnEdit.style.display = 'flex';
        }

        initializeBioFeatures();

        // Trigger animation after loading
        triggerBioAnimation();

    } catch (e) {
        console.error("Error loading bio:", e);
        document.getElementById('bioNameText').innerText = "Perfil no encontrado";
        triggerBioAnimation();
    }
}

function triggerBioAnimation() {
    const container = document.getElementById('bioMainContainer');
    const glow = document.getElementById('bioGlow');
    if (container) {
        container.classList.add('is-ready');
        if (glow) {
            // Reveal glow with a slight delay or immediately depending on preference
            // We'll set a standard opacity here that matches the banner logic
            setTimeout(() => {
                glow.style.opacity = glow.style.opacity || '0.4';
            }, 500);
        }
    }
}
function renderBioHeader(user) {
    // Basic Info
    document.getElementById('bioNameText').innerText = user.nickname || "User";

    // Store link setup
    const btnTienda = document.getElementById('btnTiendaBeats');
    btnTienda.href = `/@${user.nickname}`;
    btnTienda.style.display = 'flex'; // Reveal Priority Link

    if (user.role) {
        document.getElementById('bioRoleText').style.display = 'inline-block';
        document.getElementById('bioRoleText').innerText = user.role;
    } else {
        document.getElementById('bioRoleText').style.display = 'none';
        document.getElementById('bioRoleText').innerText = '';
    }

    if (user.bio) {
        document.getElementById('bioText').innerText = user.bio;
        document.getElementById('bioText').style.display = 'block';
    } else {
        document.getElementById('bioText').style.display = 'none';
    }

    // Avatar Logic (Support R2 Placeholder or direct URL)
    const isR2 = window.AuthUtils && window.AuthUtils.isR2Url(user.avatar_url);
    const avatarImg = document.getElementById('bioAvatar');

    if (user.avatar_url && !isR2) {
        avatarImg.src = user.avatar_url;
    } else if (isR2 && window.getAuthorizedUrl) {
        // Prevent 404 flash with placeholder
        avatarImg.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        avatarImg.dataset.r2Src = user.avatar_url;
        avatarImg.dataset.r2Version = user.r2_version || 'v1';

        window.getAuthorizedUrl(user.avatar_url, user.r2_version || 'v1').then(url => {
            if (url) avatarImg.src = url;
            avatarImg.parentElement.classList.remove('bg-zinc-900');
        }).catch(() => {
            // fallback
            avatarImg.src = `https://ui-avatars.com/api/?name=${user.nickname}&background=random&size=256`;
        });
    } else {
        avatarImg.src = `https://ui-avatars.com/api/?name=${user.nickname}&background=random&size=256`;
    }

    // Verified Badge
    if (user.is_verified || user.is_producer) {
        document.getElementById('bioVerified').style.display = 'inline-block';
    }

    // Custom Banner Color integration
    if (user.banner_url) {
        const val = user.banner_url;
        const glow = document.getElementById('bioGlow');

        if (val.includes(':')) {
            const [type, color] = val.split(':');

            // Adjust glow based on brand color
            if (type === 'solid') {
                glow.style.background = color;
                glow.style.opacity = '0.3';
                // Adjust box shadow of Avatar wrapper
                avatarImg.parentElement.style.boxShadow = `0 0 40px -10px ${color}`;
            } else if (type === 'gradient') {
                const gradientVal = val.substring(val.indexOf(':') + 1);
                glow.style.background = gradientVal;
                glow.style.opacity = '0.2';
            }
        }
    } else {
        // Default glow if no banner
        document.getElementById('bioGlow').style.opacity = '0.4';
    }
}

function renderSocials(user) {
    if (!user.socials) return;

    let socialsObj = {};
    try {
        socialsObj = typeof user.socials === 'string' ? JSON.parse(user.socials) : user.socials;
    } catch (e) {
        console.error("Error parsing socials", e);
        return;
    }

    // DEBUG — remove once order issue confirmed fixed
    console.log('%c[BioLink Debug]', 'color: #3b82f6; font-weight: bold;');
    console.log('socials JSONB keys:', Object.keys(socialsObj));
    console.log('socials_order from DB:', user.socials_order);
    console.log('Full socials object:', socialsObj);

    const icons = {
        instagram: { class: 'bi-instagram', isLarge: true },
        tiktok: { class: 'bi-tiktok', isLarge: true },
        youtube: { class: 'bi-youtube', isLarge: true, label: "YouTube" },
        twitter: { class: 'bi-twitter-x', isLarge: false },
        linkedin: { class: 'bi-linkedin', isLarge: false },
        facebook: { class: 'bi-facebook', isLarge: false },
        spotify: { class: 'bi-spotify', isLarge: true, label: "Spotify" },
        discord: { class: 'bi-discord', isLarge: true, label: "Discord" },
        website: { class: 'bi-globe', isLarge: true, label: "Sitio Web" },
        whatsapp: { class: 'bi-whatsapp', isLarge: true, label: "WhatsApp" }
    };

    const smallContainer = document.getElementById('bioSocialIcons');
    const largeContainer = document.getElementById('bioSocialLinks');
    let hasLargeLinks = false;
    let hasSmallLinks = false;

    // Clear containers first
    smallContainer.innerHTML = '';
    largeContainer.innerHTML = '';

    // Build ordered keys: user's saved order first, then any defaults not in the saved order
    const defaultOrderedKeys = ['whatsapp', 'youtube', 'spotify', 'tiktok', 'instagram', 'discord', 'website', 'twitter', 'facebook', 'linkedin'];

    let customOrderedKeys = [];
    try {
        if (user.socials_order) {
            customOrderedKeys = typeof user.socials_order === 'string' ? JSON.parse(user.socials_order) : user.socials_order;
        }
    } catch (e) { }

    // Keys that exist in user-defined order go first, then append any others not in that order
    const allKnownKeys = Object.keys(socialsObj);
    const seenKeys = new Set(customOrderedKeys);
    const remainingKeys = allKnownKeys.filter(k => !seenKeys.has(k));
    // Ensure default fallback order for the remaining keys
    const orderedRemaining = defaultOrderedKeys.filter(k => remainingKeys.includes(k));
    const finalOrderedKeys = [...customOrderedKeys, ...orderedRemaining];

    // Helper to build href from val
    function buildHref(k, val) {
        if (val.startsWith('http')) return val;
        if (k === 'instagram') return `https://instagram.com/${val}`;
        if (k === 'tiktok') return `https://tiktok.com/@${val}`;
        if (k === 'twitter') return `https://twitter.com/${val}`;
        if (k === 'youtube') return `https://youtube.com/@${val}`;
        if (k === 'whatsapp') {
            const cleanNum = val.replace(/\D/g, '');
            return `https://wa.me/${cleanNum}`;
        }
        return val;
    }

    // Render in strict order
    finalOrderedKeys.forEach(k => {
        const val = socialsObj[k];
        if (!val) return;

        const iconDef = icons[k];
        if (!iconDef) return;

        const href = buildHref(k, val);

        // Small icon row (all socials)
        hasSmallLinks = true;
        const smallA = document.createElement('a');
        smallA.href = href;
        smallA.target = '_blank';
        smallA.className = 'hover:text-gray-300 transition-transform hover:scale-110';
        smallA.innerHTML = `<i class="bi ${iconDef.class} text-xl md:text-2xl"></i>`;
        smallContainer.appendChild(smallA);

        // Large pill links
        if (iconDef.isLarge) {
            hasLargeLinks = true;
            const linkLabel = iconDef.label || k.toUpperCase();
            const largeA = document.createElement('a');
            largeA.href = href;
            largeA.target = '_blank';
            largeA.dataset.network = k;
            largeA.className = 'group relative flex items-center w-full p-4 bg-black border border-white rounded-[16px] transition-all duration-300 transform bio-sortable-link';
            largeA.innerHTML = `
                <div class="flex items-center absolute left-4">
                    <i class="bi ${iconDef.class} text-xl md:text-2xl text-white"></i>
                </div>
                <div class="flex-1 flex justify-center text-center">
                    <span class="font-bold text-sm md:text-md tracking-wide pointer-events-none">${linkLabel}</span>
                </div>
                <div class="drag-handle absolute right-4 text-gray-500 hover:text-white cursor-grab active:cursor-grabbing hidden" style="pointer-events: auto;">
                    <i class="bi bi-grip-vertical text-xl"></i>
                </div>
            `;
            largeContainer.appendChild(largeA);
        }
    });

    if (hasLargeLinks) {
        document.getElementById('titleRedes').style.display = 'block';
    }
    if (!hasSmallLinks) {
        smallContainer.style.display = 'none';
    }
}

function initializeBioFeatures() {
    // --- SHARE MODAL LOGIC ---
    const btnShare = document.getElementById('btnShareBio');
    const shareModal = document.getElementById('bioShareModal');
    const btnCloseShare = document.getElementById('btnCloseShare');
    const inputShare = document.getElementById('shareModalInput');
    const btnCopyShare = document.getElementById('btnCopyShareLink');

    if (btnShare && shareModal) {
        btnShare.onclick = () => {
            // Populate Modal Data
            if (currentProfileData) {
                document.getElementById('shareModalName').innerText = currentProfileData.nickname || 'User';
                document.getElementById('shareModalUsername').innerText = `@${currentProfileData.handle || currentProfileData.nickname || 'user'}`;

                const avatarImg = document.getElementById('shareModalAvatar');
                const mainAvatar = document.getElementById('bioAvatar');
                avatarImg.src = mainAvatar ? mainAvatar.src : '/images/portada-default.png';

                const shareUrl = window.location.href;
                inputShare.value = shareUrl;

                // Setup native share buttons
                const text = `Mira el perfil de música de ${currentProfileData.nickname} en OFFSZN 🔥`;
                document.getElementById('btnShareWA').onclick = () => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + " " + shareUrl)}`);
                document.getElementById('btnShareX').onclick = () => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`);
                document.getElementById('btnShareFB').onclick = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`);
            }

            shareModal.classList.remove('opacity-0', 'pointer-events-none');
            shareModal.querySelector('div').classList.remove('scale-95');
        };

        const closeModal = () => {
            shareModal.classList.add('opacity-0', 'pointer-events-none');
            shareModal.querySelector('div').classList.add('scale-95');
        };

        btnCloseShare.onclick = closeModal;
        shareModal.onclick = (e) => {
            if (e.target === shareModal) closeModal();
        };

        btnCopyShare.onclick = () => {
            inputShare.select();
            document.execCommand('copy');
            const icon = btnCopyShare.querySelector('i');
            icon.className = 'bi bi-check-lg text-green-500';
            setTimeout(() => {
                icon.className = 'bi bi-copy text-sm group-hover:text-white transition-colors duration-200';
            }, 2000);
        };
    }

    // --- EDIT MODE LOGIC ---
    const btnEdit = document.getElementById('btnEditMode');

    if (btnEdit) {
        btnEdit.onclick = () => {
            isEditMode = !isEditMode;
            const linkBlocks = document.querySelectorAll('.bio-sortable-link');

            if (isEditMode) {
                btnEdit.classList.remove('text-gray-400', 'bg-zinc-900/50');
                btnEdit.classList.add('text-white', 'bg-blue-600', 'border-blue-500');
                btnEdit.innerHTML = '<i class="bi bi-pencil-fill text-[10px]"></i> Modo Edición';

                // Show edit tutorial modal only once
                if (localStorage.getItem('offszn_bio_edit_tutorial_shown') !== 'true') {
                    const tutorialModal = document.getElementById('editModeTutorialModal');
                    const video = document.getElementById('editTutorialVideo');
                    const btnClose = document.getElementById('btnCloseEditTutorial');
                    const btnUnderstand = document.getElementById('btnUnderstandEdit');

                    if (tutorialModal && video && btnClose && btnUnderstand) {
                        tutorialModal.classList.remove('opacity-0', 'pointer-events-none');
                        tutorialModal.querySelector('div').classList.remove('scale-95');
                        video.play().catch(() => { }); // ignore autoplay policy errors

                        const closeTutorial = () => {
                            tutorialModal.classList.add('opacity-0', 'pointer-events-none');
                            tutorialModal.querySelector('div').classList.add('scale-95');
                            video.pause();
                            localStorage.setItem('offszn_bio_edit_tutorial_shown', 'true');
                        };

                        btnClose.onclick = closeTutorial;
                        btnUnderstand.onclick = closeTutorial;
                        tutorialModal.onclick = (e) => {
                            if (e.target === tutorialModal) closeTutorial();
                        };
                    }
                }

                // Prevent navigation + show handles
                linkBlocks.forEach(link => {
                    link.dataset.href = link.href;
                    link.removeAttribute('href');
                    const handle = link.querySelector('.drag-handle');
                    if (handle) handle.classList.remove('hidden');
                });

                // Init custom real-time drag
                initCustomDragSort(document.getElementById('bioSocialLinks'), async () => {
                    await saveNewLinksOrder();
                    // Show auto-save checkmark
                    const prev = btnEdit.innerHTML;
                    btnEdit.innerHTML = '<i class="bi bi-check-lg text-[10px]"></i> Guardado';
                    btnEdit.classList.add('bg-green-600');
                    btnEdit.classList.remove('bg-blue-600');
                    setTimeout(() => {
                        btnEdit.innerHTML = prev;
                        btnEdit.classList.remove('bg-green-600');
                        btnEdit.classList.add('bg-blue-600');
                    }, 1500);
                });

            } else {
                btnEdit.classList.add('text-gray-400', 'bg-zinc-900/50');
                btnEdit.classList.remove('text-white', 'bg-blue-600', 'border-blue-500');
                btnEdit.innerHTML = '<i class="bi bi-pencil-fill text-[10px]"></i> Modo Edición';

                linkBlocks.forEach(link => {
                    link.href = link.dataset.href;
                    const handle = link.querySelector('.drag-handle');
                    if (handle) handle.classList.add('hidden');
                });

                destroyCustomDragSort(document.getElementById('bioSocialLinks'));
            }
        };
    }
}

async function saveNewLinksOrder() {
    if (!bioOwnerId || !currentProfileData) return;

    const container = document.getElementById('bioSocialLinks');
    if (!container) return;

    // Ordered iteration based on DOM sequence
    const orderedElements = container.querySelectorAll('.bio-sortable-link');
    const newOrderedKeys = Array.from(orderedElements).map(el => el.dataset.network).filter(Boolean);

    try {
        const { error } = await window.supabaseClient
            .from('users')
            .update({ socials_order: newOrderedKeys })
            .eq('id', bioOwnerId);

        if (error) throw error;

        // Update local state
        currentProfileData.socials_order = newOrderedKeys;
    } catch (error) {
        console.error("Error saving new link order:", error);
        alert("Hubo un error al guardar el orden. Intenta nuevamente.");
    }
}

// ── Custom Drag-and-Drop ─────────────────────────────────────────────────────
// Real-time reflow: visual clone follows cursor, real element collapses and  
// re-inserts in the new position immediately — no ghost placeholder gap.
// ─────────────────────────────────────────────────────────────────────────────

let _dragListeners = null; // store so we can remove them

function destroyCustomDragSort(container) {
    if (!container || !_dragListeners) return;
    container.removeEventListener('mousedown', _dragListeners.onDown);
    container.removeEventListener('touchstart', _dragListeners.onDown);
    _dragListeners = null;
}

function initCustomDragSort(container, onDropCallback) {
    if (!container) return;
    destroyCustomDragSort(container); // clean up previous instance

    function onDown(e) {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;
        e.preventDefault();

        const el = handle.closest('.bio-sortable-link');
        if (!el) return;

        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = el.getBoundingClientRect();
        const offsetY = clientY - rect.top;
        const elH = rect.height;
        const gap = parseFloat(getComputedStyle(container).gap) || 0;

        // 1. Create floating clone (GPU-accelerated, no scale)
        const clone = el.cloneNode(true);
        clone.style.cssText = `
            position: fixed; left: ${rect.left}px; top: ${rect.top}px;
            width: ${rect.width}px; height: ${elH}px;
            z-index: 9999; pointer-events: none; border-radius: 16px;
            border: 1.5px solid #3b82f6;
            box-shadow: 0 8px 24px rgba(0,0,0,0.6); background: #111;
            will-change: top;
        `;
        document.body.appendChild(clone);

        // 2. Create spacer
        const spacer = document.createElement('div');
        spacer.style.cssText = `
            height: ${elH}px; border-radius: 16px;
            border: 1.5px dashed rgba(59,130,246,0.4);
            background: rgba(59,130,246,0.05);
            pointer-events: none;
        `;

        // 3. Remove original, insert spacer
        const elIndex = Array.from(container.children).indexOf(el);
        el.remove();
        if (elIndex < container.children.length) {
            container.insertBefore(spacer, container.children[elIndex]);
        } else {
            container.appendChild(spacer);
        }

        function getVisibleItems() {
            return Array.from(container.children).filter(c => c !== spacer);
        }

        let lastNewIdx = -1;

        function onMove(ev) {
            ev.preventDefault();
            const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;

            // Instant clone tracking
            const cRect = container.getBoundingClientRect();
            const top = Math.max(Math.min(cy - offsetY, cRect.bottom - elH), cRect.top);
            clone.style.top = top + 'px';

            // Swap detection
            const spacerTop = spacer.getBoundingClientRect().top;
            const movingUp = top < spacerTop;
            const items = getVisibleItems();
            let newIdx = items.length;

            if (movingUp) {
                for (let i = 0; i < items.length; i++) {
                    const r = items[i].getBoundingClientRect();
                    if (top < r.top + r.height * 0.4) { newIdx = i; break; }
                }
            } else {
                const bot = top + elH;
                for (let i = 0; i < items.length; i++) {
                    const r = items[i].getBoundingClientRect();
                    if (bot < r.top + r.height * 0.6) { newIdx = i; break; }
                }
            }

            if (newIdx === lastNewIdx) return;
            lastNewIdx = newIdx;

            // Instant DOM swap — no animation, no transitions, zero overhead
            spacer.remove();
            if (newIdx >= items.length) container.appendChild(spacer);
            else container.insertBefore(spacer, items[newIdx]);
        }

        function onUp() {
            clone.remove();

            // Insert real element where spacer is
            container.insertBefore(el, spacer);
            spacer.remove();

            // Clear styles
            Array.from(container.children).forEach(c => {
                c.style.transition = '';
                c.style.transform = '';
            });

            if (onDropCallback) onDropCallback();

            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchend', onUp);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
    }

    container.addEventListener('mousedown', onDown);
    container.addEventListener('touchstart', onDown, { passive: false });
    _dragListeners = { onDown };
}
async function loadRecentProducts(user) {
    try {
        const { data, error } = await window.supabaseClient
            .from('products')
            .select('*')
            .eq('producer_id', user.id)
            .eq('visibility', 'public')
            .order('created_at', { ascending: false })
            .limit(3);

        if (error) throw error;
        if (!data || data.length === 0) return;

        const container = document.getElementById('bioProductsList');
        const section = document.getElementById('bioRecentProducts');
        container.innerHTML = ''; // Clear earlier placeholders

        // Prepare promises for image resolution if needed
        const resolvedProducts = await Promise.all(data.map(async p => {
            const isR2Image = window.AuthUtils && window.AuthUtils.isR2Url(p.image_url);
            let finalImageUrl = p.image_url || '/images/portada-default.png';

            // 🔥 Standard: If R2, prepare placeholder and data-r2-src
            // Note: We still pre-authorize here for faster rendering if available, 
            // but the template will use data-r2-src as safety for r2-loader.js
            if (isR2Image && window.getAuthorizedUrl) {
                try {
                    // Use placeholder initially to avoid 404
                    finalImageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
                    // We don't await here to avoid blocking render, r2-loader or the .then() below will update it
                    window.getAuthorizedUrl(p.image_url, p.r2_version || 'v1').then(signed => {
                        if (signed) {
                            const imgEl = document.getElementById(`prod-img-${p.id}`);
                            if (imgEl) imgEl.src = signed;
                        }
                    });
                } catch (e) { console.error("Error resolving product image", e); }
            }
            return { ...p, finalImageUrl, isR2Image };
        }));

        resolvedProducts.forEach(p => {
            const isDrumKit = p.type === 'drum kit' || p.type === 'loop kit' || p.type === 'preset' || p.type === 'voz' || p.type === 'sample' || p.type === 'kit';

            // Correct mapping for price based on user feedback:
            // if a beat has a free download (is_free), it still has a price.
            // ONLY say GRATIS if price_basic is exactly 0 or empty.
            const priceVal = parseFloat(p.price_basic) || 0;
            const displayPrice = (priceVal > 0) ? `$${priceVal} US$` : 'GRATIS';

            // NEW: Meta info (BPM / Key) for Beats (Only if they exist)
            const isBeat = p.type === 'beat';
            const metaInfo = isBeat && (p.bpm || p.key) ? `
                <div class="flex items-center gap-2 mt-1">
                    ${p.bpm ? `<span class="text-[10px] text-zinc-500 font-bold bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded uppercase">${p.bpm} BPM</span>` : ''}
                    ${p.key ? `<span class="text-[10px] text-zinc-500 font-bold bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded uppercase">${p.key}</span>` : ''}
                </div>
            ` : '';

            // Slug-based routing: Use public_slug if available, otherwise ID
            const productUrl = `/p/${p.public_slug || p.id}`;

            const cardStr = `
                <div class="relative w-full bg-[#0a0a0a] rounded-xl overflow-hidden border border-zinc-800 flex flex-col md:flex-row shadow-2xl group hover:border-zinc-500 transition-colors duration-300">
                    <!-- Cover -->
                    <div class="w-full md:w-[120px] aspect-square bg-zinc-900 relative flex-shrink-0 p-3 flex items-center justify-center">
                        <img src="${p.finalImageUrl}" 
                             id="prod-img-${p.id}"
                             data-r2-src="${p.isR2Image ? p.image_url : ''}"
                             data-r2-version="${p.r2_version || 'v1'}"
                             class="shadow-2xl rounded-md transform group-hover:scale-105 transition-transform duration-500 w-full h-full object-cover border border-white/5"
                             style="box-shadow: -5px 5px 15px rgba(0,0,0,0.5);"
                             crossorigin="anonymous">
                        
                        <!-- Mini Play Button Overlay (Optional UI touch) -->
                        <button onclick="playBioPreview('${p.id}', '${p.audio_url || p.mp3_url || ''}', this, '${(p.name || '').replace(/'/g, "\\'").replace(/"/g, "&quot;")}', '${p.finalImageUrl}', '${p.r2_version || 'v1'}')" 
                                class="absolute flex items-center justify-center w-10 h-10 bg-black/60 rounded-full text-white backdrop-blur-sm hover:scale-110 hover:bg-white hover:text-black transition-all border border-white/20">
                            <i class="bi bi-play-fill text-xl ml-1"></i>
                        </button>
                    </div>

                    <!-- Right Content -->
                    <div class="flex-1 p-4 flex flex-col justify-center">
                        <div class="flex items-start justify-between mb-1">
                            <div>
                                <h3 class="font-bold text-md leading-tight text-white mb-0.5">${escapeHTML(p.name || '')}</h3>
                                <p class="text-[10px] text-gray-400 font-medium uppercase tracking-wider">${p.product_type || p.type || ''}</p>
                                ${metaInfo}
                            </div>
                        </div>

                        <div class="flex items-center justify-between mt-auto pt-3 border-t border-zinc-800">
                            <span class="text-sm md:text-md font-bold text-white">${displayPrice}</span>

                            <a href="${productUrl}"
                                class="bg-white hover:bg-gray-200 text-black text-[11px] md:text-xs font-bold px-5 py-2 rounded-full transition-all duration-300 uppercase tracking-wider text-center">
                                LO QUIERO!
                            </a>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', cardStr);
        });

        section.style.display = 'flex'; // Reveal section

    } catch (e) {
        console.error("Error loading bio products:", e);
    }
}

// Global Play Function strictly for Bio Preview that links to Sticky Player
window.playBioPreview = async function (id, url, btnContent, title, cover, r2_version = 'v1') {
    if (!url || url === 'undefined') {
        alert("Este producto no tiene vista previa de audio.");
        return;
    }

    // Include sticky player dynamically if not present
    if (!window.StickyPlayer) {
        const script = document.createElement('script');
        script.src = '/script/sticky-player.js';
        document.body.appendChild(script);

        await new Promise(r => script.onload = r);
    }

    // Initialize if not already initialized
    if (window.StickyPlayer && window.StickyPlayer.init) {
        window.StickyPlayer.init();
    }

    // Trigger Sticky Player Global Script
    if (window.StickyPlayer && window.StickyPlayer.play) {
        // Resolve URL (for R2)
        let finalUrl = url;
        if (window.AuthUtils && window.AuthUtils.isR2Url(url) && window.getAuthorizedUrl) {
            finalUrl = await window.getAuthorizedUrl(url, r2_version);
        }

        // Resolve Author Name
        const author = document.getElementById('bioNameText').innerText;

        window.StickyPlayer.play({
            id: id,
            name: title,
            audio_url: finalUrl,
            image_url: cover,
            producer_nickname: author
        });
    } else {
        console.warn("Sticky player script not loaded or play function missing.");
    }
};
