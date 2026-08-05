(function () {
    const YT_SYNC_VERSION = '1.0.2';
    const CLIENT_ID = '804444303530-bl8gtp4sdjkcnrkjl1295vns59tqp4tc.apps.googleusercontent.com';
    const SCOPES = 'https://www.googleapis.com/auth/youtube.upload';
    
    // Selectors
    const statusTag = document.getElementById('ytSyncStatus');
    const carousel = document.getElementById('ytCarouselContainer');
    const unlinkedMsg = document.getElementById('ytUnlinkedMessage');
    const modal = document.getElementById('ytAllVideosModal');
    const modalGrid = document.getElementById('ytModalGrid');
    const btnLoadMore = document.getElementById('btnLoadMoreYt');
    const btnCloseModal = document.getElementById('btnCloseYtModal');

    let gapiInited = false;
    let gisInited = false;
    let tokenClient;
    let nextPageToken = null;

    // --- 1. GAPI/GIS BOOTSTRAP ---
    window.gapiLoaded = function() {
        console.log("📹 Dash-Sync: GAPI Loaded");
        gapi.load('client', async () => {
            await gapi.client.init({});
            await gapi.client.load('youtube', 'v3');
            gapiInited = true;
            checkReadyState();
        });
    };

    window.gisLoaded = function() {
        console.log("📹 Dash-Sync: GIS Loaded");
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // defined at request time
        });
        gisInited = true;
        checkReadyState();
    };

    window.gapiloaded = window.gapiLoaded;
    window.gisloaded = window.gisLoaded;

    function checkReadyState() {
        if (gapiInited && gisInited) {
            if (window._pendingUserId) {
                initYoutubeDashboard(window._pendingUserId);
                window._pendingUserId = null;
            }
        }
    }

    async function initYoutubeDashboard(userId) {
        if (!carousel) return;
        if (!gapiInited || !gisInited) {
            window._pendingUserId = userId;
            return;
        }

        try {
            updateStatus('Sincronizando...', 'info');

            const { data, error } = await window.supabaseClient
                .from('users')
                .select('socials')
                .eq('id', userId)
                .single();

            if (error || !data?.socials?.youtube) {
                showUnlinked();
                return;
            }

            const token = gapi.client.getToken();
            if (!token) {
                renderSyncGate();
                updateStatus('Ver todos', 'blocked');
                return;
            }

            updateStatus('Ver todos', 'active');
            loadVideos();

        } catch (err) {
            console.error('YT Sync Error:', err);
            renderError('Error de conexión');
        }
    }

    async function loadVideos() {
        try {
            const response = await gapi.client.youtube.search.list({
                part: 'snippet',
                forMine: true,
                type: 'video',
                maxResults: 10,
                order: 'date'
            });

            const items = response.result.items;
            if (!items || items.length === 0) {
                carousel.innerHTML = '<div style="color:#666; font-size:12px; padding:20px; text-align:center;">No se encontraron videos recientes.</div>';
                return;
            }

            renderCarousel(items);
            updateArrowStates();

        } catch (err) {
            console.error('YT Load Error:', err);
            if (err.status === 401) {
                renderSyncGate();
            } else {
                renderError('Error al cargar videos');
            }
        }
    }

    function renderCarousel(items) {
        carousel.innerHTML = '';
        items.forEach(item => {
            const videoId = item.id.videoId;
            const snippet = item.snippet;
            const thumb = snippet.thumbnails.high ? snippet.thumbnails.high.url : snippet.thumbnails.medium.url;

            const div = document.createElement('div');
            div.className = 'yt-video-item';
            div.innerHTML = `
                <img src="${thumb}" alt="${snippet.title}">
                <div class="yt-video-overlay">
                    <i class="bi bi-plus-circle"></i>
                    <span class="import-text">Importar datos <br>& Subir a OFFSZN</span>
                </div>
            `;
            div.onclick = () => {
                window.open(`/upload/beats.html?auto_import=${videoId}`, '_blank');
            };
            carousel.appendChild(div);
        });
    }

    // --- MODAL: ALL VIDEOS ---
    async function fetchAllVideos(isNext = false) {
        try {
            btnLoadMore.disabled = true;
            btnLoadMore.textContent = 'Cargando...';
            
            const params = {
                part: 'snippet',
                forMine: true,
                type: 'video',
                maxResults: 12,
                order: 'date'
            };
            if (isNext && nextPageToken) params.pageToken = nextPageToken;

            const response = await gapi.client.youtube.search.list(params);
            const items = response.result.items;
            nextPageToken = response.result.nextPageToken;

            if (!isNext) modalGrid.innerHTML = '';

            items.forEach(item => {
                const videoId = item.id.videoId;
                const snippet = item.snippet;
                const thumb = snippet.thumbnails.high ? snippet.thumbnails.high.url : snippet.thumbnails.medium.url;

                const card = document.createElement('div');
                card.className = 'yt-video-item';
                card.style.flex = 'unset'; // Override carousel flex
                card.innerHTML = `
                    <img src="${thumb}" alt="${snippet.title}">
                    <div class="yt-video-overlay" style="opacity: 0; transition: opacity 0.3s;">
                        <i class="bi bi-plus-circle"></i>
                        <span class="import-text">Importar y Subir</span>
                    </div>
                `;
                card.onmouseenter = () => card.querySelector('.yt-video-overlay').style.opacity = '1';
                card.onmouseleave = () => card.querySelector('.yt-video-overlay').style.opacity = '0';
                card.onclick = () => window.open(`/upload/beats.html?auto_import=${videoId}`, '_blank');
                modalGrid.appendChild(card);
            });

            btnLoadMore.style.display = nextPageToken ? 'block' : 'none';
            btnLoadMore.disabled = false;
            btnLoadMore.textContent = 'Cargar más videos';

        } catch (err) {
            console.error('Modal Load Error:', err);
            btnLoadMore.textContent = 'Error al cargar';
        }
    }

    function openAllVideosModal() {
        if (!modal) return;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        if (modalGrid.children.length === 0) fetchAllVideos();
    }

    function closeAllVideosModal() {
        if (!modal) return;
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    // --- CAROUSEL NAVIGATION ---
    function updateArrowStates() {
        const btnPrev = document.getElementById('ytPrev');
        const btnNext = document.getElementById('ytNext');
        if (!carousel || !btnPrev || !btnNext) return;

        const { scrollLeft, scrollWidth, clientWidth } = carousel;
        btnPrev.disabled = scrollLeft <= 5;
        btnNext.disabled = scrollLeft + clientWidth >= scrollWidth - 5;
    }

    function initCarouselNav() {
        const btnPrev = document.getElementById('ytPrev');
        const btnNext = document.getElementById('ytNext');
        if (!carousel || !btnPrev || !btnNext) return;

        carousel.addEventListener('scroll', updateArrowStates);

        btnPrev.addEventListener('click', () => {
            const width = carousel.offsetWidth;
            carousel.scrollBy({ left: -(width / 2), behavior: 'smooth' });
        });

        btnNext.addEventListener('click', () => {
            const width = carousel.offsetWidth;
            carousel.scrollBy({ left: (width / 2), behavior: 'smooth' });
        });
    }

    // --- HELPERS ---
    function renderSyncGate() {
        carousel.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; gap: 12px; text-align: center; padding: 20px;">
                <p style="font-size: 13px; color: #fff; margin: 0; font-weight: 500;">Conecta tu cuenta para importar + sincronizar canal</p>
                <button id="btnSyncDash" style="background: #fff; border: none; color: #000; font-size: 12px; font-weight: 700; padding: 10px 24px; border-radius: 100px; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                    Sincronizar Canal
                </button>
            </div>
        `;

        document.getElementById('btnSyncDash')?.addEventListener('click', () => {
            updateStatus('Autenticando...', 'info');
            tokenClient.callback = async (resp) => {
                if (resp.access_token) {
                    sessionStorage.setItem('yt_access_token', resp.access_token);
                    updateStatus('Ver todos', 'active');
                    loadVideos();
                } else {
                    updateStatus('Ver todos', 'blocked');
                }
            };
            tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    }

    function showUnlinked() {
        if (carousel) carousel.style.display = 'none';
        if (unlinkedMsg) {
            unlinkedMsg.style.display = 'flex';
            unlinkedMsg.style.width = '100%';
        }
        updateStatus('Ver todos', 'blocked');
    }

    function updateStatus(text, state) {
        if (!statusTag) return;
        statusTag.childNodes[0].textContent = text + ' ';
        
        if (state === 'active') {
            statusTag.classList.add('active');
            statusTag.onclick = openAllVideosModal;
        } else {
            statusTag.classList.remove('active');
            statusTag.onclick = null;
        }
    }

    function renderError(msg) {
        if (!carousel) return;
        carousel.innerHTML = `<div style="color:#888; font-size:11px; padding:10px; text-align:center;">${msg}</div>`;
    }

    // Event Listeners
    if (btnCloseModal) btnCloseModal.onclick = closeAllVideosModal;
    if (btnLoadMore) btnLoadMore.onclick = () => fetchAllVideos(true);
    window.onclick = (event) => { if (event.target == modal) closeAllVideosModal(); };

    // Init
    document.addEventListener('DOMContentLoaded', initCarouselNav);
    if (document.readyState !== 'loading') initCarouselNav();

    window.initYoutubeDashboard = initYoutubeDashboard;

})();
