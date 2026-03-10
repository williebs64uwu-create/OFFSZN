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

async function initFeed() {
    const requestsContainer = document.getElementById('requests-container');
    if (!requestsContainer) return;

    // Try to get current user ID for the "isOwnRequest" check
    if (!window.currentUserId && window.supabaseClient) {
        try {
            const { data } = await window.supabaseClient.auth.getSession();
            if (data?.session?.user) {
                window.currentUserId = data.session.user.id;
            }
        } catch (e) { }
    }

    try {
        const token = AuthUtils.getAccessToken();
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/custom-requests/public', {
            headers: headers
        });

        if (!response.ok) {
            throw new Error('Error al cargar solicitudes');
        }

        const { requests } = await response.json();
        window.allRequests = requests || [];
        renderRequests(requests);

    } catch (error) {
        console.error('Feed error:', error);
        requestsContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
                <i class="bi bi-exclamation-triangle" style="font-size: 2rem; display: block; margin-bottom: 10px;"></i>
                <p>No se pudieron cargar las solicitudes en este momento.</p>
            </div>
        `;
    }
}

function renderRequests(requests) {
    const requestsContainer = document.getElementById('requests-container');
    requestsContainer.innerHTML = '';

    if (!requests || requests.length === 0) {
        requestsContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #555;">
                <h3 style="color: #fff; margin-bottom: 10px;">Tablón Vacío</h3>
                <p>No hay solicitudes pendientes en este momento. ¡Vuelve más tarde!</p>
            </div>
        `;
        return;
    }

    requests.forEach(request => {
        const card = createRequestCard(request);
        requestsContainer.appendChild(card);
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

function createRequestCard(request) {
    const card = document.createElement('div');
    card.className = 'request-card';

    const buyerName = request.buyer?.nickname || request.buyer?.display_name || request.buyer?.username || 'Usuario';
    const defaultAvatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(buyerName) + '&background=random';
    const buyerAvatar = request.buyer?.avatar_url || defaultAvatarUrl;
    const budget = request.budget ? `$${request.budget}` : 'A convenir';
    // Relative date
    const now = new Date();
    const created = new Date(request.created_at);
    const diffMs = now - created;
    const diffDays = Math.floor(diffMs / 86400000);
    let relDate;
    if (diffDays === 0) relDate = 'Hoy';
    else if (diffDays === 1) relDate = 'Ayer';
    else if (diffDays < 7) relDate = `Hace ${diffDays}d`;
    else relDate = created.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

    const roleLabel = request.request_type === 'preset' ? 'Preset' : request.request_type === 'servicio' ? 'Servicio' : 'Beat';

    const previewContainerId = `wavesurfer-${request.id}`;
    const previewHtml = request.preview_url ? `
        <div class="maqueta-preview-box" style="margin-top: 15px; border-color: #333;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-size: 0.7rem; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Maqueta Previa</span>
                <button class="btn-play-maqueta-mini" data-url="${request.preview_url}" data-id="${request.id}">
                    <i class="bi bi-play-fill"></i>
                </button>
            </div>
            <div id="${previewContainerId}" class="maqueta-wavesurfer"></div>
        </div>
    ` : '';

    const currentUserId = window.currentUserId || localStorage.getItem('userId');
    const isOwnRequest = currentUserId === request.buyer_id;

    card.innerHTML = `
        <div class="request-header">
            <div class="buyer-info">
                <img src="${buyerAvatar}" alt="${buyerName}" class="buyer-avatar" style="border-color: #333;">
                <span class="buyer-name">${buyerName}</span>
                <span class="buyer-role">${roleLabel}</span>
                <span class="buyer-date">· ${relDate}</span>
            </div>
            <div class="budget-tag" style="background: #111; color: #fff; border: 1px solid #333;">${budget}</div>
        </div>
        
        <p class="request-description" style="margin-top: 15px; font-size: 0.9rem; color: #ccc;">${request.description}</p>
        
        ${previewHtml}

        <div class="request-footer" style="margin-top: 25px; display: flex; gap: 10px;">
            <button class="btn-view-details" style="flex: 1;">Ver detalles</button>
            <button class="btn-take-job" data-id="${request.id}" style="flex: 1;" ${isOwnRequest ? 'disabled' : ''}>
                ${isOwnRequest ? 'Tu solicitud' : 'Tomar Trabajo'}
            </button>
        </div>

        <style>
            .ref-link { color: #fff; text-decoration: none; font-size: 0.8rem; background: rgba(255, 255, 255, 0.05); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1); }
            .ref-link:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }
            .btn-view-details { background: rgba(255,255,255,0.05); border: 1px solid #333; color: #fff; padding: 10px; border-radius: 12px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: 0.2s; }
            .btn-view-details:hover { background: rgba(255,255,255,0.1); border-color: #555; }
            .btn-take-job { background: #fff; border: 1px solid #fff; color: #000; padding: 10px; border-radius: 12px; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: 0.2s; }
            .btn-take-job:hover:not(:disabled) { background: #000; color: #fff; }
            .btn-take-job:disabled { opacity: 0.3; cursor: not-allowed; background: #222; border-color: #222; color: #555; }
            .maqueta-preview-box { background: rgba(255,255,255,0.02); border: 1px solid #222; border-radius: 12px; padding: 12px; }
            .maqueta-wavesurfer { height: 40px; margin-top: 5px; }
            .btn-play-maqueta-mini { background: #fff; border: none; color: #000; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1rem; transition: 0.2s; }
            .btn-play-maqueta-mini:hover { transform: scale(1.1); background: #eee; }
        </style>
    `;

    // Interaction Listeners
    card.querySelector('.btn-view-details').onclick = () => showRequestDetails(request);

    if (!isOwnRequest) {
        card.querySelector('.btn-take-job').onclick = (e) => handleClaimRequest(request.id, e.target);
    }

    if (request.preview_url) {
        // Use setTimeout to ensure container exists in DOM
        setTimeout(() => {
            initWaveSurfer(card.querySelector('.btn-play-maqueta-mini'), previewContainerId, request);
        }, 0);
    }

    return card;
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
            const url = await AuthUtils.getAuthorizedUrl(request.preview_url);
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
