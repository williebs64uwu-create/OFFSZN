// AuthUtils is loaded globally via <script> in feed.html
const AuthUtils = window.AuthUtils;

document.addEventListener('DOMContentLoaded', () => {
    initFeed();
    initModal();
});

function initModal() {
    if (document.getElementById('details-modal')) return;
    const modalHtml = `
        <div id="details-modal" class="feed-modal">
            <div class="feed-modal-content">
                <span class="close-modal">&times;</span>
                <div id="modal-body"></div>
            </div>
        </div>
        <style>
            .feed-modal {
                display: none;
                position: fixed;
                z-index: 2000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.9);
                backdrop-filter: blur(5px);
            }
            .feed-modal-content {
                background-color: #0a0a0a;
                margin: 5% auto;
                padding: 30px;
                border: 1px solid #333;
                width: 90%;
                max-width: 700px;
                border-radius: 20px;
                position: relative;
                max-height: 85vh;
                overflow-y: auto;
            }
            .close-modal {
                position: absolute;
                right: 20px;
                top: 15px;
                color: #888;
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
            }
            .close-modal:hover { color: #fff; }
            .modal-section { margin-bottom: 25px; }
            .modal-label { color: #555; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; display: block; }
            .modal-value { font-size: 1rem; color: #fff; line-height: 1.6; }
            .embed-container { margin-top: 15px; border-radius: 12px; overflow: hidden; background: #111; }
        </style>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('details-modal');
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.onclick = () => modal.style.display = "none";
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = "none";
    }
}

window.FeedState = { likes: new Set(), follows: new Set(), welcomes: new Set() };

async function loadUserFeedState() {
    const user = AuthUtils.getCurrentUser();
    if (!user || !user.id) return;

    try {
        const [likesRes, followsRes, welcomesRes] = await Promise.all([
            window.supabaseClient.from('likes').select('target_id').eq('user_id', user.id).limit(1000),
            window.supabaseClient.from('followers').select('user_id').eq('follower_id', user.id).limit(1000),
            window.supabaseClient.from('notifications').select('user_id').eq('actor_id', user.id).eq('type', 'welcome').limit(1000)
        ]);

        if (likesRes.data) likesRes.data.forEach(l => window.FeedState.likes.add(String(l.target_id)));
        if (followsRes.data) followsRes.data.forEach(f => window.FeedState.follows.add(String(f.user_id)));
        if (welcomesRes.data) welcomesRes.data.forEach(w => window.FeedState.welcomes.add(String(w.user_id)));
    } catch (e) {
        console.error("Error loading feed states", e);
    }
}

async function initFeed() {
    const requestsContainer = document.getElementById('requests-container');
    if (!requestsContainer) return;

    // Loading State
    requestsContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #555;">
            <div class="simple-loader"></div>
            <p style="margin-top: 15px; font-size: 0.85rem;">Cargando interacciones...</p>
        </div>
    `;

    try {
        if (!window.supabaseClient && window.AuthUtils) {
            window.AuthUtils.initSupabase();
        }

        // --- PARALLEL LOAD ---
        // Fire both, but only await the activities for instant UI
        const statePromise = loadUserFeedState();
        const activitiesPromise = window.supabaseClient
            .from('community_activities')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(60);

        const [activitiesRes] = await Promise.all([activitiesPromise]);
        const activities = activitiesRes.data;
        const error = activitiesRes.error;

        if (error) throw error;

        window.allActivities = activities || [];
        renderFeed(activities);

        // --- BACKGROUND HYDRATION ---
        // Once likes/follows are loaded, quietly update the UI buttons
        statePromise.then(() => {
            document.querySelectorAll('.activity-card').forEach(card => {
                const activityId = card.getAttribute('data-activity-id');
                const activity = window.allActivities.find(a => String(a.id) === activityId);
                if (!activity) return;

                const targetId = String(activity.target_id || activity.id);
                const actorId = String(activity.actor_id);

                // Update Like Button
                const likeBtn = card.querySelector('.action-btn[title="Like"]');
                if (likeBtn && window.FeedState.likes.has(targetId)) {
                    likeBtn.classList.add('active');
                    const icon = likeBtn.querySelector('i');
                    if (icon) {
                        icon.classList.remove('bi-heart');
                        icon.classList.add('bi-heart-fill');
                    }
                }

                // Update Follow Button
                const followBtn = card.querySelector('.btn-follow-small');
                if (followBtn && window.FeedState.follows.has(actorId)) {
                    followBtn.classList.add('active');
                    followBtn.innerText = 'Siguiendo';
                }

                // Update Welcome Button
                const waveBtn = card.querySelector('.action-btn-wave');
                if (waveBtn && window.FeedState.welcomes.has(actorId)) {
                    waveBtn.classList.add('active');
                    waveBtn.innerHTML = '<i class="bi bi-hand-wave-fill"></i> ¡Saludado!';
                }
            });
        });

        if (error) throw error;

        window.allActivities = activities || [];
        renderFeed(activities);

        // Auto-open modal if linked
        const urlParams = new URLSearchParams(window.location.search);
        const autoId = urlParams.get('id') || urlParams.get('reqId');
        if (autoId) {
            const match = window.allActivities.find(a => String(a.id) === String(autoId) || String(a.target_id) === String(autoId));
            if (match) {
                setTimeout(() => showActivityDetails(match), 300);
            }
        }
    } catch (error) {
        console.error('Feed error:', error);
        requestsContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
                <i class="bi bi-exclamation-triangle" style="font-size: 2rem; display: block; margin-bottom: 10px;"></i>
                <p>No se pudieron cargar las interacciones en este momento.</p>
            </div>
        `;
    }
}

function renderFeed(activities) {
    const container = document.getElementById('requests-container');
    container.innerHTML = '';

    if (!activities || activities.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 80px 20px; color: #555;">
                <div style="background: rgba(255,255,255,0.03); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                    <i class="bi bi-chat-dots" style="font-size: 2rem; color: #333;"></i>
                </div>
                <h3 style="color: #fff; margin-bottom: 10px; font-size: 1.2rem;">Sin novedades por aquí</h3>
                <p style="max-width: 300px; margin: 0 auto; font-size: 0.9rem;">Sigue a otros productores para ver sus actualizaciones.</p>
            </div>
        `;
        return;
    }

    activities.forEach(activity => {
        const card = createActivityCard(activity);
        container.appendChild(card);
    });
}

function shortenLink(url) {
    if (!url) return '';
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('spotify.com')) return 'Spotify';
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) return 'YouTube';

        let text = urlObj.pathname.substring(1);
        if (text.length > 20) text = text.substring(0, 17) + '...';
        return text || urlObj.hostname;
    } catch (e) {
        return url.length > 20 ? url.substring(0, 17) + '...' : url;
    }
}

function getEmbedHtml(url) {
    if (!url) return null;

    // YouTube
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const ytMatch = url.match(ytRegex);
    if (ytMatch) {
        return `<iframe width="100%" height="200" src="https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&modestbranding=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border-radius: 12px; background: #000;"></iframe>`;
    }

    // Spotify
    const spotRegex = /spotify\.com\/(?:intl-[a-zA-Z]+\/)?(track|album|playlist|artist)\/([a-zA-Z0-9]+)/i;
    const spotMatch = url.match(spotRegex);
    if (spotMatch) {
        return `<iframe src="https://open.spotify.com/embed/${spotMatch[1]}/${spotMatch[2]}" width="100%" height="80" frameborder="0" allowtransparency="true" allow="encrypted-media" style="border-radius: 12px; background: #000;"></iframe>`;
    }

    return null;
}

function createActivityCard(activity) {
    const card = document.createElement('div');
    card.className = `activity-card ${activity.type}`;
    card.setAttribute('data-activity-id', String(activity.id));
    
    const actorName = activity.actor_nickname || 'Usuario';
    const actorAvatar = activity.actor_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(actorName)}&background=0a0a0a&color=fff`;
    const timeAgo = formatTimeAgo(new Date(activity.created_at));
    const activeUser = window.AuthUtils?.getCurrentUser();
    const isSelf = activeUser?.id === activity.actor_id;

    let contentHtml = '';
    const metadata = activity.metadata || {};

    switch(activity.type) {
        case 'product_published':
            contentHtml = `
                <div class="product-sub-card">
                    <div style="position: relative; display: flex;">
                        <img src="${metadata.image_url || '/images/default-cover.jpg'}" class="sub-card-art" loading="lazy">
                        <button class="btn-play-activity" data-id="${activity.target_id}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px; border-radius: 50%; background: rgba(0,0,0,0.6); color: #fff; border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; cursor: pointer;">
                            <i class="bi bi-play-fill" style="font-size: 1.4rem;"></i>
                        </button>
                    </div>
                    <div class="sub-card-info">
                        <span class="sub-card-title">${metadata.name || 'Sin título'}</span>
                        <span class="sub-card-artist">By ${actorName}</span>
                        <span class="sub-card-tag">${metadata.tags?.[0] || 'BEAT'}</span>
                        <div class="sub-card-waveform">
                            ${Array.from({ length: 40 }).map(() => `<div class="wf-bar" style="height: ${Math.floor(Math.random() * 80 + 20)}%"></div>`).join('')}
                        </div>
                    </div>
                    <div class="sub-card-buy">
                        <button class="btn-buy-feed">
                            ${metadata.price && metadata.price > 0 ? `$${metadata.price}` : 'FREE'} <i class="bi bi-cart3"></i>
                        </button>
                        <span style="font-size: 0.65rem; color: #444; font-weight: 700;"> <i class="bi bi-play"></i> 0</span>
                    </div>
                </div>
            `;
            break;

        case 'product_liked':
            contentHtml = `
                <p class="activity-text" style="padding: 10px 0;">le ha dado me gusta a <strong>${metadata.target_name || 'un beat'}</strong></p>
            `;
            break;

        case 'new_follower':
            const targetProfileLinkFollow = window.createProfileLink({ id: activity.target_id, nickname: metadata.target_nickname });
            contentHtml = `
                <p class="activity-text" style="padding: 10px 0;">ha comenzado a seguir a <strong onclick="window.location.href='${targetProfileLinkFollow}'" style="cursor:pointer; color:#fff;">${metadata.target_nickname || 'un productor'}</strong></p>
            `;
            break;

        case 'user_welcomed':
            const targetProfileLinkWelcome = window.createProfileLink({ id: activity.target_id, nickname: metadata.target_nickname });
            contentHtml = `
                <div class="welcome-mini-card" style="padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 12px; margin-top: 5px;">
                    <img src="${metadata.target_avatar || actorAvatar}" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.1); cursor: pointer;" onclick="window.location.href='${targetProfileLinkWelcome}'">
                    <p class="activity-text" style="margin: 0;">le ha dado la bienvenida a <strong onclick="window.location.href='${targetProfileLinkWelcome}'" style="cursor:pointer; color:#fff;">${metadata.target_nickname || 'un nuevo miembro'}</strong> ✨</p>
                </div>
            `;
            break;

        case 'custom_request':
            contentHtml = `
                <div class="activity-text" style="padding: 10px 0;">
                    necesita ayuda: <span style="color: #fff; font-style: italic;">"${metadata.description}"</span>
                    <div style="margin-top: 10px; font-size: 0.8rem; color: #777;">Presupuesto: <strong style="color: #fff;">${metadata.budget ? `$${metadata.budget}` : 'A convenir'}</strong></div>
                </div>
                <button class="btn-buy-feed btn-view-activity" style="width: 100%; justify-content: center; margin-top: 10px; background: #fff; color: #000; text-transform: uppercase;">Ver detalles</button>
            `;
            break;

        case 'user_joined':
            const bioText = activity.metadata?.bio ? `<p class="welcome-bio">"${activity.metadata.bio}"</p>` : '';
            const socialsObj = activity.metadata?.socials || {};
            
            let socialsHtml = '';
            const knownSocials = {
                instagram: { icon: 'bi-instagram', color: '#fff' },
                twitter: { icon: 'bi-twitter-x', color: '#fff' },
                youtube: { icon: 'bi-youtube', color: '#fff' },
                spotify: { icon: 'bi-spotify', color: '#fff' },
                tiktok: { icon: 'bi-tiktok', color: '#fff' },
                soundcloud: { icon: 'bi-cloud-fill', color: '#fff' },
                website: { icon: 'bi-globe', color: '#fff' }
            };
            
            Object.keys(socialsObj).forEach(key => {
                const url = socialsObj[key];
                if(url && knownSocials[key]) {
                    socialsHtml += `<a href="${url}" target="_blank" class="welcome-social-icon" title="${key}"><i class="bi ${knownSocials[key].icon}"></i></a>`;
                }
            });

            const socialSection = socialsHtml ? `<div class="welcome-socials">${socialsHtml}</div>` : '';

            contentHtml = `
                <div class="welcome-sub-card">
                    <div class="welcome-banner">NUEVO MIEMBRO</div>
                    <div class="welcome-content">
                        <div class="welcome-avatar-wrapper" style="cursor: pointer;" onclick="window.location.href=window.createProfileLink({id: '${activity.actor_id}', nickname: '${activity.actor_nickname || ''}'})">
                            <img data-r2-version="${activity.actor_r2_version || 'v2'}"
                                 data-r2-src="${actorAvatar}"
                                 src="${actorAvatar}"
                                 alt="Avatar" class="welcome-avatar">
                        </div>
                        <div class="welcome-info">
                            <h3 class="welcome-nickname" style="cursor: pointer;" onclick="window.location.href=window.createProfileLink({id: '${activity.actor_id}', nickname: '${activity.actor_nickname || ''}'})">${actorName}</h3>
                            <span class="welcome-tag">Productor</span>
                            ${socialSection}
                        </div>
                        <div class="welcome-actions" style="margin-left: auto;">
                            ${isSelf ? '' : (window.FeedState?.welcomes?.has(String(activity.actor_id)) 
                                ? `<button class="btn-welcome-wave action-btn-wave active">¡Saludado! <i class="bi bi-check-all"></i></button>` 
                                : `<button class="btn-welcome-wave action-btn-wave">DAR LA BIENVENIDA <i class="bi bi-arrow-right-short"></i></button>`)}
                        </div>
                    </div>
                    ${bioText}
                </div>
            `;
            break;

        default:
            contentHtml = `<p class="activity-text">${activity.type}</p>`;
            break;
    }

    card.innerHTML = `
        <div class="activity-inner">
            <div class="activity-header">
                <img src="${actorAvatar}" class="actor-avatar" loading="lazy" style="cursor: pointer;" onclick="window.location.href=window.createProfileLink({id: '${activity.actor_id}', nickname: '${activity.actor_nickname || ''}'})">
                <div class="actor-details">
                    <span class="actor-nickname" style="cursor: pointer;" onclick="window.location.href=window.createProfileLink({id: '${activity.actor_id}', nickname: '${activity.actor_nickname || ''}'})">${actorName}</span>
                    ${isSelf ? '' : (window.FeedState?.follows?.has(String(activity.actor_id)) 
                        ? `<button class="btn-follow-small active">Siguiendo</button>` 
                        : `<button class="btn-follow-small">+ Follow</button>`)}
                </div>
                <span class="activity-time">${timeAgo}</span>
            </div>
            
            <div class="activity-body">
                ${contentHtml}
            </div>

            <div class="activity-actions">
                <button class="action-btn ${window.FeedState?.likes?.has(String(activity.target_id || activity.id)) ? 'active' : ''}" title="Like">
                    <i class="bi ${window.FeedState?.likes?.has(String(activity.target_id || activity.id)) ? 'bi-heart-fill' : 'bi-heart'}"></i>
                </button>
                <button class="action-btn comment-btn" title="Comment"><i class="bi bi-chat"></i></button>
                <button class="action-btn" title="Share"><i class="bi bi-send"></i></button>
            </div>
        </div>
    `;

    // Listeners
    if (activity.type === 'product_published') {
        const playBtn = card.querySelector('.btn-play-activity');
        playBtn.onclick = () => playProduct(activity);
    }

    if (activity.type === 'custom_request') {
        card.querySelector('.btn-view-activity').onclick = () => showActivityDetails(activity);
    }

    // Helper: Auth Guard Wrapper
    const authGuard = (callback) => {
        if (!AuthUtils.getAccessToken()) {
            if (window.showGuestModal) {
                window.showGuestModal("Únete a OFFSZN", "Para interactuar con la comunidad y apoyar a tus productores favoritos, necesitas iniciar sesión.");
            } else {
                window.location.href = "/pages/login.html";
            }
            return;
        }
        callback();
    };

    // "Coming soon" for comments
    card.querySelector('.comment-btn').onclick = () => {
        authGuard(() => alert('Comentarios: Próximamente'));
    };

    // Simple Like toggle with Auth Guard
    const likeBtn = card.querySelector('.action-btn[title="Like"]');
    likeBtn.onclick = () => {
        authGuard(async () => {
            const isCurrentlyLiked = window.FeedState.likes.has(String(activity.target_id || activity.id));
            const user = AuthUtils.getCurrentUser();
            const targetId = String(activity.target_id || activity.id);

            const icon = likeBtn.querySelector('i');
            likeBtn.disabled = true;

            if (isCurrentlyLiked) {
                window.FeedState.likes.delete(targetId);
                likeBtn.classList.remove('active');
                icon.classList.remove('bi-heart-fill');
                icon.classList.add('bi-heart');
                await window.supabaseClient.from('likes').delete().match({ user_id: user.id, target_id: targetId });
            } else {
                window.FeedState.likes.add(targetId);
                likeBtn.classList.add('active');
                icon.classList.remove('bi-heart');
                icon.classList.add('bi-heart-fill');
                await window.supabaseClient.from('likes').insert({
                    user_id: user.id, 
                    target_id: targetId, 
                    target_type: activity.type === 'product_published' ? 'product' : 'activity'
                });
            }
            likeBtn.disabled = false;
        });
    };

    // Follow button with Auth Guard
    const followBtn = card.querySelector('.btn-follow-small');
    if (followBtn) {
        followBtn.onclick = (e) => {
            e.stopPropagation();
            authGuard(async () => {
                if (window.FeedState.follows.has(String(activity.actor_id))) return;
                
                const user = AuthUtils.getCurrentUser();
                if(user.id === activity.actor_id) {
                    if(window.showToast) window.showToast('No puedes seguirte a ti mismo', 'error');
                    return;
                }

                followBtn.classList.add('active');
                followBtn.innerText = 'Siguiendo';
                window.FeedState.follows.add(String(activity.actor_id));
                
                await window.supabaseClient.from('followers').insert({
                    follower_id: user.id,
                    user_id: activity.actor_id
                });
            });
        };
    }

    // Welcome Wave Button with Auth Guard
    const waveBtn = card.querySelector('.action-btn-wave');
    if (waveBtn) {
        waveBtn.onclick = (e) => {
            e.stopPropagation();
            authGuard(async () => {
                if(window.FeedState.welcomes.has(String(activity.actor_id))) return;
                
                const user = AuthUtils.getCurrentUser();
                if(user.id === activity.actor_id) return;

                waveBtn.classList.add('active', 'disabled');
                waveBtn.innerHTML = '¡Saludado! <i class="bi bi-check-all"></i>';
                window.FeedState.welcomes.add(String(activity.actor_id));

                // 1. Send private notification
                await window.supabaseClient.from('notifications').insert({
                    user_id: activity.actor_id,
                    actor_id: user.id,
                    type: 'welcome',
                    title: '¡Nueva Bienvenida!',
                    message: 'Alguien de la comunidad te ha dado la bienvenida.',
                    read: false,
                    link: window.createProfileLink({ id: user.id, nickname: user.user_metadata?.nickname })
                });

                // 2. Log public activity in the feed
                await window.supabaseClient.from('activity_feed').insert({
                    actor_id: user.id,
                    type: 'user_welcomed',
                    target_id: activity.actor_id,
                    metadata: {
                        target_nickname: activity.actor_nickname,
                        target_avatar: activity.actor_avatar
                    }
                });

                if(window.showToast) window.showToast('Bienvenida enviada bro', 'success');
            });
        };
    }

    return card;
}

function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    if (days > 0) return `hace ${days}d`;
    if (hours > 0) return `hace ${hours}h`;
    if (minutes > 0) return `hace ${minutes}m`;
    return 'ahora';
}

async function playProduct(activity) {
    if (!window.StickyPlayer) return;
    
    // Structure compatible with StickyPlayer
    const trackData = {
        id: activity.target_id,
        name: activity.metadata.name,
        artist: activity.actor_nickname,
        image_url: activity.metadata.image_url,
        preview_url: activity.metadata.audio_url,
        metadata: activity.metadata
    };
    
    window.StickyPlayer.play(trackData);
}

function showActivityDetails(activity) {
    // Reuse existing modal logic but adapted
    const modal = document.getElementById('details-modal');
    const body = document.getElementById('modal-body');

    if (activity.type === 'custom_request') {
        // Map back to what showRequestDetails expects if needed, or just rewrite
        const request = {
            id: activity.target_id,
            buyer_id: activity.actor_id,
            buyer: {
                nickname: activity.actor_nickname,
                avatar_url: activity.actor_avatar
            },
            description: activity.metadata.description,
            budget: activity.metadata.budget,
            bpm: activity.metadata.bpm,
            key: activity.metadata.key
        };
        showRequestDetails(request);
    }
}

const activePlayers = new Map();

async function initWaveSurfer(playBtn, containerId, request) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Render a realistic CSS fake waveform placeholder instantly
    const numBars = window.innerWidth < 400 ? 50 : 70;
    container.innerHTML = `<div class="css-waveform-placeholder" style="display:flex; align-items:center; justify-content:space-between; height:40px; opacity:0.3; overflow:hidden;">
        ${Array.from({ length: numBars }).map((_, i) => `<div style="width:2px; height:${Math.max(4, Math.sin(i * 0.5) * 15 + Math.random() * 20 + 5)}px; background:#fff; border-radius:2px;"></div>`).join('')}
    </div>`;

    let ws = null;
    let isLoaded = false;

    // Background load the real waveform
    setTimeout(async () => {
        try {
            const version = request.r2_version || request.preview_version || request.storage_version || 'v2';
            const url = await AuthUtils.getAuthorizedUrl(request.preview_url, version);
            container.innerHTML = ''; // Clear placeholder
            ws = WaveSurfer.create({
                container: container,
                waveColor: '#333',
                progressColor: '#fff',
                cursorColor: 'transparent',
                barWidth: 2,
                barGap: 3,
                barRadius: 2,
                height: 40,
                normalize: true,
                interact: false // Local interaction disabled because it sends to StickyPlayer
            });
            await ws.load(url);
            isLoaded = true;
        } catch (err) {
            console.error("Error background loading waveform:", err);
            container.innerHTML = '<span style="color:#555;font-size:0.75rem;">Error cargando preview</span>';
        }
    }, 50);

    playBtn.onclick = async (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log('[Feed] Maqueta play clicked, preview_url:', request.preview_url);

        if (!window.StickyPlayer) {
            console.error('[Feed] StickyPlayer not available');
            return;
        }

        try {
            const trackData = {
                id: `request-${request.id}`,
                name: `Maqueta — ${request.buyer?.nickname || 'Usuario'}`,
                artist: `Solicitud de ${request.buyer?.nickname || 'Usuario'}`,
                artist_users: { id: request.buyer_id, nickname: request.buyer?.nickname },
                image_url: request.buyer?.avatar_url,
                preview_url: request.preview_url,
                r2_version: request.r2_version || request.preview_version || request.storage_version || 'v2',
                preview_version: request.r2_version || request.preview_version || request.storage_version || 'v2',
                is_custom_request: true,
                request_data: request
            };
            console.log('[Feed] Calling StickyPlayer.play with:', trackData.name);
            window.StickyPlayer.play(trackData);
        } catch (err) {
            console.error('[Feed] Error playing maqueta:', err);
        }
    };
}

window.showRequestDetails = showRequestDetails;

function showRequestDetails(request) {
    const modal = document.getElementById('details-modal');
    const body = document.getElementById('modal-body');

    const buyerName = request.buyer?.nickname || request.buyer?.display_name || 'Usuario';
    const defaultAvatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(buyerName) + '&background=random';
    const embed1 = getEmbedHtml(request.reference_link_1);
    const embed2 = getEmbedHtml(request.reference_link_2);

    body.innerHTML = `
        <div class="modal-section" style="display: flex; align-items: center; gap: 15px; border-bottom: 1px solid #222; padding-bottom: 20px;">
            <img src="${request.buyer?.avatar_url || defaultAvatarUrl}" style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid #333;">
            <div>
                <h2 style="margin: 0; font-size: 1.4rem; color: #fff;">${buyerName}</h2>
                <span style="color: #888; font-size: 0.85rem; font-weight: 600;">Presupuesto: <span style="color: #fff;">${request.budget ? `$${request.budget}` : 'A convenir'}</span></span>
            </div>
        </div>

        <div class="modal-section">
            <span class="modal-label" style="color: #555;">Descripción del Proyecto</span>
            <div class="modal-value" style="color: #ccc;">${request.description}</div>
        </div>

        <div class="modal-section" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
                <span class="modal-label" style="color: #555;">BPM</span>
                <div class="modal-value">${request.bpm || 'No especificado'}</div>
            </div>
            <div>
                <span class="modal-label" style="color: #555;">Escala / Key</span>
                <div class="modal-value">${request.key || 'No especificado'}</div>
            </div>
        </div>

        ${(request.reference_link_1 || request.reference_link_2) ? `
        <div class="modal-section">
            <span class="modal-label" style="color: #555;">Referencias Musicales</span>
            <div style="display: flex; flex-direction: column; gap: 15px;">
                ${embed1 ? `<div class="embed-container" style="border: 1px solid #222;">${embed1}</div>` : (request.reference_link_1 ? `<a href="${request.reference_link_1}" target="_blank" class="ref-link" style="text-align: center;">Spotify</a>` : '')}
                ${embed2 ? `<div class="embed-container" style="border: 1px solid #222;">${embed2}</div>` : (request.reference_link_2 ? `<a href="${request.reference_link_2}" target="_blank" class="ref-link" style="text-align: center;">YouTube</a>` : '')}
            </div>
        </div>
        ` : ''}

        <div style="margin-top: 30px; display: flex; gap: 15px;">
            <button class="btn-take-job w-100" id="modal-take-job" style="padding: 15px; font-size: 1rem; border: 1px solid #fff; background: #fff; color: #000; border-radius: 15px; font-weight: 800; text-transform: uppercase;">
                TOMAR TRABAJO
            </button>
        </div>
    `;

    const currentUserId = window.currentUserId || localStorage.getItem('userId');
    const takeBtn = body.querySelector('#modal-take-job');

    if (currentUserId === request.buyer_id) {
        takeBtn.disabled = true;
        takeBtn.innerText = "ES TU SOLICITUD";
        takeBtn.style.background = "#222";
        takeBtn.style.color = "#555";
        takeBtn.style.borderColor = "#222";
    } else {
        takeBtn.onclick = () => {
            modal.style.display = "none";
            const cardBtn = document.querySelector(`.btn-take-job[data-id="${request.id}"]`);
            handleClaimRequest(request.id, cardBtn || takeBtn);
        };
    }

    modal.style.display = "block";
}

window.handleClaimRequest = handleClaimRequest;

async function handleClaimRequest(requestId, btn) {
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
        const token = AuthUtils.getAccessToken();
        if (!token) {
            window.location.href = `/pages/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }

        const response = await fetch(`/api/custom-requests/${requestId}/claim`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            alert('✅ ¡Has tomado el trabajo! Se ha notificado al cliente. Puedes ver los detalles en tu Dashboard.');
            btn.textContent = 'RECLAMADO';
            btn.style.background = '#222';
            btn.style.color = '#fff';
            btn.style.borderColor = '#222';
        } else {
            alert(`❌ Error: ${data.error || 'No se pudo reclamar el trabajo'}`);
            btn.disabled = false;
            btn.textContent = originalText;
        }

    } catch (error) {
        console.error('Claim error:', error);
        alert('❌ Error al procesar la solicitud.');
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// ===== FILTER SYSTEM =====
let activeGenre = 'all';

window.toggleFilterDropdown = function (id) {
    const dd = document.getElementById(`dd-${id}`);
    const btn = document.getElementById(`filter-${id}`);
    if (!dd) return;

    // Close all other dropdowns
    document.querySelectorAll('.filter-dropdown.show').forEach(el => {
        if (el.id !== `dd-${id}`) {
            el.classList.remove('show');
            el.closest('.filter-cat-btn')?.classList.remove('open');
        }
    });

    dd.classList.toggle('show');
    btn?.classList.toggle('open');

    // Stop propagation to prevent immediate close
    event.stopPropagation();
};

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
    if (!e.target.closest('.filter-cat-btn')) {
        document.querySelectorAll('.filter-dropdown.show').forEach(el => {
            el.classList.remove('show');
            el.closest('.filter-cat-btn')?.classList.remove('open');
        });
    }
});

window.selectGenre = function (el) {
    document.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    activeGenre = el.dataset.genre;
    applyFilters();
};

window.updatePriceLabels = function () {
    const min = document.getElementById('price-min');
    const max = document.getElementById('price-max');
    if (min && max) {
        document.getElementById('price-min-label').textContent = `$${min.value}`;
        document.getElementById('price-max-label').textContent = `$${max.value}`;
    }
};

window.setFeedView = function (view) {
    const grid = document.getElementById('requests-container');
    const gridBtn = document.getElementById('view-grid');
    const listBtn = document.getElementById('view-list');
    if (!grid) return;

    if (view === 'list') {
        grid.classList.add('list-view');
        gridBtn?.classList.remove('active');
        listBtn?.classList.add('active');
    } else {
        grid.classList.remove('list-view');
        gridBtn?.classList.add('active');
        listBtn?.classList.remove('active');
    }
};

window.scrollGenres = function (amount) {
    const pills = document.getElementById('genre-pills');
    if (pills) pills.scrollBy({ left: amount, behavior: 'smooth' });
};

window.applyFilters = function () {
    const allReqs = window.allRequests || [];
    if (!allReqs.length) return;

    // Get checked checkboxes
    const getChecked = (ddId) => {
        const dd = document.getElementById(ddId);
        if (!dd) return [];
        return Array.from(dd.querySelectorAll('input:checked')).map(i => i.value);
    };

    const beatsFilters = getChecked('dd-beats');
    const presetsFilters = getChecked('dd-presets');
    const serviciosFilters = getChecked('dd-servicios');

    // Price range
    const priceMin = parseInt(document.getElementById('price-min')?.value || '10');
    const priceMax = parseInt(document.getElementById('price-max')?.value || '1000');

    const filtered = allReqs.filter(req => {
        const desc = (req.description || '').toLowerCase();
        const type = (req.request_type || '').toLowerCase();
        const genre = (req.genre || '').toLowerCase();
        const budget = req.budget || 0;

        // Genre filter
        if (activeGenre !== 'all') {
            const searchTerms = [desc, type, genre].join(' ');
            if (!searchTerms.includes(activeGenre.toLowerCase())) return false;
        }

        // Category checkbox filters (keyword matching in description/type)
        if (beatsFilters.length > 0) {
            const matchText = [desc, type].join(' ');
            const hasMatch = beatsFilters.some(f => matchText.includes(f));
            if (!hasMatch) return false;
        }

        if (presetsFilters.length > 0) {
            const matchText = [desc, type].join(' ');
            const hasMatch = presetsFilters.some(f => matchText.includes(f.replace('_', ' ')));
            if (!hasMatch) return false;
        }

        if (serviciosFilters.length > 0) {
            const matchText = [desc, type].join(' ');
            const hasMatch = serviciosFilters.some(f => matchText.includes(f.replace('_', ' ')));
            if (!hasMatch) return false;
        }

        // Price range filter
        if (budget > 0 && (budget < priceMin || budget > priceMax)) return false;

        return true;
    });

    renderRequests(filtered);
};
