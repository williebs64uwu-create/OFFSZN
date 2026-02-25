// script/bio.js
// Handles dynamic fetching and DOM populating for /b/:username

window.activeWavesurfers = window.activeWavesurfers || [];
window.currentlyPlaying = window.currentlyPlaying || null;

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
        const loggedUser = window.getUserId ? window.getUserId() : null;
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
        document.getElementById('bioRolePipe').style.display = 'inline-block';
        document.getElementById('bioRoleText').innerText = user.role;
    } else {
        document.getElementById('bioRolePipe').style.display = 'none';
        document.getElementById('bioRoleText').innerText = '';
    }

    if (user.bio) {
        document.getElementById('bioText').innerText = user.bio;
        document.getElementById('bioText').style.display = 'block';
    } else {
        document.getElementById('bioText').style.display = 'none';
    }

    // Avatar Logic (Support R2 Placeholder or direct URL)
    const isR2 = user.avatar_url && (user.avatar_url.includes('r2.cloudflarestorage.com') || user.avatar_url.includes('pub-'));
    const avatarImg = document.getElementById('bioAvatar');

    if (user.avatar_url && !isR2) {
        avatarImg.src = user.avatar_url;
    } else if (isR2 && window.getAuthorizedUrl) {
        window.getAuthorizedUrl(user.avatar_url).then(url => {
            avatarImg.src = url;
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

    // We only create small icons for certain networks usually, but the user wants them all.
    // Let's clear arrays first.
    smallContainer.innerHTML = '';
    largeContainer.innerHTML = '';

    // Ordered iteration based on common preferences
    const orderedKeys = ['whatsapp', 'youtube', 'spotify', 'tiktok', 'instagram', 'discord', 'website', 'twitter', 'facebook', 'linkedin'];

    orderedKeys.forEach(k => {
        const val = socialsObj[k];
        if (!val) return;

        const iconDef = icons[k];
        if (!iconDef) return;

        // Build URL
        let href = val;
        if (!val.startsWith('http')) {
            if (k === 'instagram') href = `https://instagram.com/${val}`;
            else if (k === 'tiktok') href = `https://tiktok.com/@${val}`;
            else if (k === 'twitter') href = `https://twitter.com/${val}`;
            else if (k === 'youtube') href = `https://youtube.com/@${val}`;
            else if (k === 'whatsapp') {
                // Clean number
                const cleanNum = val.replace(/\\D/g, '');
                href = `https://wa.me/${cleanNum}`;
            }
        }

        // Add to Small Icons (EVERY icon goes here now to match the user screenshot)
        hasSmallLinks = true;
        const smallA = document.createElement('a');
        smallA.href = href;
        smallA.target = '_blank';
        smallA.className = 'hover:text-gray-300 transition-transform hover:scale-110';
        smallA.innerHTML = `<i class="bi ${iconDef.class} text-xl md:text-2xl"></i>`;
        smallContainer.appendChild(smallA);

        // Add to Large Pills if applicable
        if (iconDef.isLarge) {
            hasLargeLinks = true;
            const linkLabel = iconDef.label || k.toUpperCase();

            // Large Link Styling matching Tienda de Beats
            const largeStr = `
                <a href="${href}" target="_blank"
                    class="group relative flex items-center w-full p-4 bg-black border border-white rounded-[16px] hover:bg-zinc-900 transition-all duration-300 transform hover:-translate-y-1">
                    <div class="flex items-center absolute left-4">
                        <i class="bi ${iconDef.class} text-xl md:text-2xl text-white"></i>
                    </div>
                    <div class="flex-1 flex justify-center text-center">
                        <span class="font-bold text-sm md:text-md tracking-wide group-hover:text-white transition-colors">${linkLabel}</span>
                    </div>
                </a>
            `;
            largeContainer.insertAdjacentHTML('beforeend', largeStr);
        }
    });

    if (hasLargeLinks) {
        document.getElementById('titleRedes').style.display = 'block';
    }
    if (!hasSmallLinks) {
        smallContainer.style.display = 'none';
    }
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
            const isR2Image = p.image_url && (p.image_url.includes('r2.cloudflarestorage.com') || p.image_url.includes('pub-'));
            let finalImageUrl = p.image_url || '/images/portada-default.png';

            if (isR2Image && window.getAuthorizedUrl) {
                try {
                    finalImageUrl = await window.getAuthorizedUrl(p.image_url);
                } catch (e) { console.error("Error resolving product image", e); }
            }
            return { ...p, finalImageUrl };
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
                            class="shadow-2xl rounded-md transform group-hover:scale-105 transition-transform duration-500 w-full h-full object-cover border border-white/5"
                            style="box-shadow: -5px 5px 15px rgba(0,0,0,0.5);"
                            crossorigin="anonymous">
                        
                        <!-- Mini Play Button Overlay (Optional UI touch) -->
                        <button onclick="playBioPreview('${p.id}', '${p.audio_url || p.mp3_url || ''}', this, '${(p.name || '').replace(/'/g, "\\'").replace(/"/g, "&quot;")}', '${p.finalImageUrl}')" 
                                class="absolute flex items-center justify-center w-10 h-10 bg-black/60 rounded-full text-white backdrop-blur-sm hover:scale-110 hover:bg-white hover:text-black transition-all border border-white/20">
                            <i class="bi bi-play-fill text-xl ml-1"></i>
                        </button>
                    </div>

                    <!-- Right Content -->
                    <div class="flex-1 p-4 flex flex-col justify-center">
                        <div class="flex items-start justify-between mb-1">
                            <div>
                                <h3 class="font-bold text-md leading-tight text-white mb-0.5">${p.name || ''}</h3>
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
window.playBioPreview = async function (id, url, btnContent, title, cover) {
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
        if ((url.includes('r2.cloudflarestorage.com') || url.includes('pub-')) && window.getAuthorizedUrl) {
            finalUrl = await window.getAuthorizedUrl(url);
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
