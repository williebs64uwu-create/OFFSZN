(function () {
    /**
     * YouTube Importer for OFFSZN
     * ----------------------------
     * Modular script to import video metadata (Title, Desc, Tags, BPM, Key)
     * directly from a user's YouTube channel.
     * 
     * Logic: Google Identity Services (GIS) + YouTube Data API v3
     */

    const YT_CONFIG = {
        CLIENT_ID: '804444303530-bl8gtp4sdjkcnrkjl1295vns59tqp4tc.apps.googleusercontent.com',
        // 🔥 SUPERSET SCOPES
        SCOPES: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
        DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest']
    };

    // 🔥 SCOPED STATE
    let tokenClient;
    let gapiInited = false;
    let gisInited = false;
    let nextPageToken = '';

    // ========================================
    // GLOBAL CONFIG
    // ========================================
    const targetUrl = '/cuenta/Upload/Beats.html';

    // ========================================
    // 1. INITIALIZATION
    // ========================================

    function gapiLoaded() {
        if (typeof gapi !== 'undefined') {
            gapi.load('client', initializeGapiClient);
        }
    }

    async function initializeGapiClient() {
        await gapi.client.init({
            discoveryDocs: YT_CONFIG.DISCOVERY_DOCS,
        });
        gapiInited = true;
        maybeEnableButtons();
    }

    function gisLoaded() {
        // Try to connect to central client
        if (window._googleTokenClient) {
            tokenClient = window._googleTokenClient;
            console.log('📹 Importer: Connected to Central Token Client');
            gisInited = true;
            maybeEnableButtons();
        }
    }

    // Ensure buttons enable when central signals completion
    window.onGoogleAuthReady = maybeEnableButtons;

    function maybeEnableButtons() {
        // Sync with central state
        if (window._googleTokenClient) {
            tokenClient = window._googleTokenClient;
            gisInited = true;
        }

        if (window._gapiInited) {
            gapiInited = true;
        }

        // Only enable if we have a way to auth
        if (tokenClient && gapiInited) {
            const btn = document.getElementById('btn-import-yt');
            if (btn) btn.disabled = false;
        }
    }

    // Run once in case it's already ready
    maybeEnableButtons();

    // ========================================
    // 2. AUTHENTICATION & FETCHING
    // ========================================

    async function handleImportClick() {
        // Retry sync if missing
        if (!tokenClient && window._googleTokenClient) {
            tokenClient = window._googleTokenClient;
            gisInited = true;
        }

        if (!tokenClient) {
            console.error('📹 Importer: tokenClient NOT ready');
            if (window.showToast) window.showToast('Error: Cliente de Google no listo. Recarga la página.', 'error');
            return;
        }

        const token = gapi.client.getToken();
        if (token === null) {
            console.log('📹 Importer: Requesting Access Token via Central Proxy...');
            try {
                // 🔥 CENTRAL PROXY STRATEGY
                if (typeof window._googleRequestAuth !== 'function') {
                    throw new Error('Global Auth Proxy (_googleRequestAuth) not found');
                }

                window._googleRequestAuth(async (resp) => {
                    console.log('📹 Importer: Response received via Central Proxy', resp);
                    if (resp.error !== undefined) {
                        console.error('📹 Importer: Auth error', resp);
                        alert('Error de autenticación: ' + (resp.error_description || resp.error));
                        return;
                    }
                    console.log('✅ Importer: Auth Success');
                    await listUserVideos();
                });
            } catch (err) {
                console.error('📹 Importer: Central Proxy Exception', err);
            }
        } else {
            await listUserVideos();
        }
    }

    // ========================================
    // 3. UI & LISTING
    // ========================================

    function resetToHub() {
        const hub = document.getElementById('yt-hub-selection');
        const main = document.getElementById('yt-main-form');
        if (hub) hub.style.display = 'grid';
        if (main) main.style.display = 'none';

        const title = document.querySelector('input[name="title"]');
        const desc = document.querySelector('textarea[name="description"]');
        if (title) title.value = '';
        if (desc) desc.value = '';
    }

    function showForm() {
        const hub = document.getElementById('yt-hub-selection');
        const main = document.getElementById('yt-main-form');
        if (hub) hub.style.display = 'none';
        if (main) main.style.display = 'block';
        if (!main) {
            const modal = document.getElementById('yt-importer-modal');
            if (modal) modal.style.display = 'none';
        }
    }

    let isFetching = false;

    async function listUserVideos(pageToken = '') {
        if (isFetching) return;
        isFetching = true;

        showImporterModal();
        const listContainer = document.getElementById('yt-video-list');

        if (!listContainer.hasAttribute('data-scroll-init')) {
            listContainer.setAttribute('data-scroll-init', 'true');
            listContainer.addEventListener('scroll', () => {
                const { scrollTop, scrollHeight, clientHeight } = listContainer;
                if (scrollTop + clientHeight >= scrollHeight - 600) {
                    if (nextPageToken && !isFetching) {
                        listUserVideos(nextPageToken);
                    }
                }
            });
        }

        if (!pageToken) {
            listContainer.innerHTML = '';
            renderSkeleton(listContainer, 8);
        } else {
            renderSkeleton(listContainer, 4);
        }

        try {
            const response = await gapi.client.youtube.search.list({
                "part": ["snippet"],
                "forMine": true,
                "maxResults": 50,
                "type": ["video"],
                "pageToken": pageToken
            });

            const videos = response.result.items;
            nextPageToken = response.result.nextPageToken || '';

            const skeletons = listContainer.querySelectorAll('.skeleton-card');
            if (videos && videos.length > 0) {
                const fragment = document.createDocumentFragment();
                videos.forEach(video => {
                    if (video && video.snippet) {
                        fragment.appendChild(createVideoCard(video));
                    }
                });
                skeletons.forEach(s => s.remove());
                listContainer.appendChild(fragment);
            } else {
                skeletons.forEach(s => s.remove());
                if (!pageToken) listContainer.innerHTML = '<div class="yt-empty">No se encontraron videos en tu canal.</div>';
            }
        } catch (err) {
            console.error("YouTube API Error:", err);
            const skeletons = listContainer.querySelectorAll('.skeleton-card');
            skeletons.forEach(s => s.remove());
            if (listContainer.children.length === 0)
                listContainer.innerHTML = '<div class="yt-error">Error al conectar con YouTube. Verifica los permisos.</div>';
        } finally {
            isFetching = false;
        }
    }

    function renderSkeleton(container, count) {
        for (let i = 0; i < count; i++) {
            const div = document.createElement('div');
            div.className = 'yt-video-card skeleton-card';
            div.style.pointerEvents = 'none';
            div.innerHTML = `
            <div class="skeleton-img" style="width: 100%; aspect-ratio: 16/9;"></div>
            <div class="yt-video-info">
                <div class="skeleton-text" style="width: 80%; height: 14px; margin-bottom: 8px;"></div>
                <div class="skeleton-text" style="width: 50%; height: 12px;"></div>
            </div>`;
            container.appendChild(div);
        }
    }

    function createVideoCard(video) {
        if (!video || !video.snippet) return document.createElement('div');
        const snippet = video.snippet;
        const videoId = video.id ? video.id.videoId : '';
        const title = snippet.title || 'Sin Título';
        const thumb = snippet.thumbnails?.medium?.url || '';
        const date = new Date(snippet.publishedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

        const div = document.createElement('div');
        div.className = 'yt-video-card';
        div.innerHTML = `
        <img src="${thumb}" alt="${title}">
        <div class="yt-video-info">
            <h4 title="${title}">${title}</h4>
            <div style="font-size: 0.75rem; color: #888; margin-top: auto;">${date}</div>
        </div>`;
        div.onclick = () => selectVideo(videoId, title, snippet.description || '', snippet.thumbnails);
        return div;
    }

    function showImporterModal() {
        const modal = document.getElementById('yt-importer-modal');
        if (modal) {
            modal.style.display = 'flex';
            const list = document.getElementById('yt-video-list');
            if (list) list.scrollTop = 0;
        }
    }

    function closeImporterModal() {
        const modal = document.getElementById('yt-importer-modal');
        if (modal) modal.style.display = 'none';
    }

    // ========================================
    // 4. DATA EXTRACTION
    // ========================================

    async function selectVideo(videoId, title, description, thumbnails) {
        console.log("Selected Video:", videoId, title);
        showForm();

        let thumbUrl = thumbnails.maxres?.url || thumbnails.high?.url || thumbnails.medium?.url || '';

        const thumbImg = document.getElementById('yt-imported-thumb');
        const beatCoverPreview = document.getElementById('coverPreview');

        if (thumbImg) {
            thumbImg.style.display = 'block';
            thumbImg.src = thumbUrl;
            thumbImg.crossOrigin = "Anonymous";
            const container = document.getElementById('yt-thumb-preview-container');
            if (container) {
                container.classList.add('has-file');
                const placeholder = container.querySelector('.yt-thumb-placeholder');
                if (placeholder) placeholder.style.display = 'none';
            }
        }

        if (beatCoverPreview) {
            beatCoverPreview.src = thumbUrl;
            beatCoverPreview.style.display = 'block';
            const dropZone = document.getElementById('coverDropZone');
            if (dropZone) dropZone.classList.add('has-image');

            if (typeof formData !== 'undefined') {
                try {
                    const response = await fetch(thumbUrl, { mode: 'cors' });
                    const blob = await response.blob();
                    formData.coverBlob = blob;
                    if (typeof filesUploaded !== 'undefined') filesUploaded.cover = false;
                    const removeBtn = document.getElementById('removeCoverBtn');
                    if (removeBtn) removeBtn.style.display = 'block';
                } catch (e) {
                    console.warn("Could not fetch cover blob:", e);
                }
            }
        }

        let tags = '';
        try {
            const videoDetail = await gapi.client.youtube.videos.list({
                "part": ["snippet"],
                "id": [videoId]
            });
            const details = videoDetail.result.items[0];
            if (details.snippet.tags) {
                tags = details.snippet.tags.join(', ');
            }
        } catch (e) {
            console.warn("Could not fetch tags:", e);
        }

        const detection = detectMetadata(title, description);
        const cleanTitle = title.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim();

        const tagCloud = document.getElementById('yt-tags-cloud');
        const hiddenTagsInput = document.getElementById('final-tags-input');

        if (detection.uniqueBpms.length > 1 || detection.uniqueKeys.length > 1) {
            showConflictModal(detection.uniqueBpms, detection.uniqueKeys, (selectedBpm, selectedKey) => {
                populateForm(cleanTitle, description, selectedBpm, selectedKey, tags, hiddenTagsInput, tagCloud);
            });
        } else {
            const bestBpm = detection.uniqueBpms.length > 0 ? detection.uniqueBpms[0] : '';
            const bestKey = detection.uniqueKeys.length > 0 ? detection.uniqueKeys[0] : '';
            populateForm(cleanTitle, description, bestBpm, bestKey, tags, hiddenTagsInput, tagCloud);
        }

        const watchBtn = document.getElementById('yt-watch-link');
        if (watchBtn) {
            watchBtn.href = `https://www.youtube.com/watch?v=${videoId}`;
            watchBtn.style.display = 'inline-flex';
        }
    }

    function populateForm(cleanTitle, description, bpm, key, tags, hiddenTagsInput, tagCloud) {
        const titleInput = document.querySelector('input[name="title"]') || document.getElementById('titleInput');
        const descInput = document.querySelector('textarea[name="description"]') || document.getElementById('descInput');
        const bpmInput = document.querySelector('input[name="bpm"]') || document.getElementById('bpmInput');
        const keyInput = document.querySelector('input[name="key"]') || document.getElementById('keyInput');

        if (titleInput) {
            titleInput.value = cleanTitle;
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (descInput) {
            descInput.value = description;
            descInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (bpmInput) bpmInput.value = bpm;
        if (keyInput) keyInput.value = key;

        if (tagCloud && hiddenTagsInput) {
            tagCloud.innerHTML = '';
            let allTags = tags.split(', ').filter(t => t.trim());
            let selectedTags = [];

            if (allTags.length > 0 && allTags[0] !== '') {
                selectedTags = allTags.slice(0, 3);
                allTags.forEach(tag => {
                    const chip = document.createElement('div');
                    chip.className = 'yt-tag-chip';
                    chip.textContent = tag;
                    if (selectedTags.includes(tag)) chip.classList.add('selected');
                    chip.onclick = () => {
                        const warning = document.getElementById('tag-limit-warning');
                        if (selectedTags.includes(tag)) {
                            selectedTags = selectedTags.filter(t => t !== tag);
                            chip.classList.remove('selected');
                            if (warning) warning.style.display = 'none';
                        } else {
                            if (selectedTags.length >= 3) {
                                if (warning) warning.style.display = 'block';
                                return;
                            }
                            selectedTags.push(tag);
                            chip.classList.add('selected');
                            if (warning) warning.style.display = 'none';
                        }
                        updateHiddenTags(selectedTags, hiddenTagsInput);
                    };
                    tagCloud.appendChild(chip);
                });
                updateHiddenTags(selectedTags, hiddenTagsInput);
            } else {
                tagCloud.innerHTML = '<span style="color:#666; font-size:0.9rem;">Este video no tiene etiquetas.</span>';
                hiddenTagsInput.value = '';
            }
        } else {
            const oldInput = document.querySelector('input[name="tags"]');
            if (oldInput) oldInput.value = tags;
            if (typeof window.clearTags === 'function' && typeof window.addTag === 'function') {
                window.clearTags();
                const tagList = tags.split(',').map(t => t.trim()).filter(t => t);
                tagList.slice(0, 3).forEach(tag => window.addTag(tag));
            }
        }
    }

    // ========================================
    // 5. DETECTION LOGIC
    // ========================================

    function detectBPM(text) {
        let match;
        const explicitRegex = /\b(\d{2,3})\s?BPM\b/gi;
        while ((match = explicitRegex.exec(text)) !== null) {
            const val = parseInt(match[1]);
            if (val >= 60 && val <= 250) return val;
        }
        const fallbackRegex = /\b(7[0-9]|8[0-9]|9[0-9]|1[0-7][0-9])\b/g;
        match = fallbackRegex.exec(text);
        return match ? parseInt(match[1]) : null;
    }

    function detectKey(text) {
        const root = "[A-G]";
        const acc = "(?:#|b|flat|sharp)?";
        const scale = "(?:maj|major|mayor|M|min|minor|menor|m)";
        const regex = new RegExp(`\\b(${root})(${acc})\\s?(${scale})\\b`, 'gi');
        const match = regex.exec(text);
        if (!match) return null;
        let [full, r, a, s] = match;
        r = r.toUpperCase();
        a = a ? a.toLowerCase() : '';
        if (a === 'flat') a = 'b';
        if (a === 'sharp') a = '#';
        let type = ['min', 'minor', 'menor', 'm'].includes(s.toLowerCase()) ? 'Minor' : 'Major';
        return `${r}${a} ${type}`;
    }

    function detectMetadata(title, description) {
        try {
            if (typeof ensureAllKeys === 'function') ensureAllKeys();
            const searchText = `${title} ${description}`;
            const bpm = detectBPM(searchText);
            const key = detectKey(searchText);
            return {
                uniqueBpms: bpm ? [bpm] : [],
                uniqueKeys: key ? [key] : []
            };
        } catch (e) {
            return { uniqueBpms: [], uniqueKeys: [] };
        }
    }

    function showConflictModal(bpms, keys, onConfirm) {
        let bpmHtml = bpms.length > 1 ? `
            <div style="margin-bottom:16px;">
                <label style="display:block; color:#ccc; margin-bottom:8px;">Selecciona BPM Correcto:</label>
                <div style="display:flex; gap:8px;">
                    ${bpms.map((b, i) => `<button class="conflict-btn ${i === 0 ? 'selected' : ''}" onclick="selectConflict(this, 'bpm', '${b}')">${b}</button>`).join('')}
                </div>
                <input type="hidden" id="conflict-bpm-val" value="${bpms[0]}">
            </div>` : `<input type="hidden" id="conflict-bpm-val" value="${bpms[0] || ''}">`;

        let keyHtml = keys.length > 1 ? `
            <div style="margin-bottom:16px;">
                <label style="display:block; color:#ccc; margin-bottom:8px;">Selecciona Key Correcta:</label>
                <div style="display:flex; gap:8px;">
                    ${keys.map((k, i) => `<button class="conflict-btn ${i === 0 ? 'selected' : ''}" onclick="selectConflict(this, 'key', '${k}')">${k}</button>`).join('')}
                </div>
                <input type="hidden" id="conflict-key-val" value="${keys[0]}">
            </div>` : `<input type="hidden" id="conflict-key-val" value="${keys[0] || ''}">`;

        const modal = document.createElement('div');
        modal.id = 'conflict-modal';
        modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); backdrop-filter:blur(5px); z-index:9999; display:flex; justify-content:center; align-items:center;`;
        modal.innerHTML = `
            <div style="background:#1a1a1a; padding:24px; border-radius:12px; border:1px solid #333; width:300px; box-shadow:0 10px 40px rgba(0,0,0,0.5);">
                <h3 style="margin:0 0 16px 0; font-size:1.1rem; color:#fff;">⚠️ Confirmar Datos</h3>
                <p style="color:#888; font-size:0.9rem; margin-bottom:20px;">Hemos detectado múltiples opciones. Por favor confirma:</p>
                ${bpmHtml}${keyHtml}
                <div style="text-align:right; margin-top:20px;">
                    <button id="btn-conflict-confirm" style="background:#8b5cf6; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">Confirmar</button>
                </div>
            </div>
            <style>
                .conflict-btn { background:#333; color:#fff; border:1px solid #444; padding:6px 12px; border-radius:4px; cursor:pointer; }
                .conflict-btn.selected { background:#8b5cf6; border-color:#8b5cf6; }
            </style>`;

        document.body.appendChild(modal);
        window.selectConflict = (btn, type, val) => {
            btn.parentNode.querySelectorAll('.conflict-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            document.getElementById(`conflict-${type}-val`).value = val;
        };
        document.getElementById('btn-conflict-confirm').onclick = () => {
            const b = document.getElementById('conflict-bpm-val').value;
            const k = document.getElementById('conflict-key-val').value;
            modal.remove();
            onConfirm(b, k);
        };
    }

    function updateHiddenTags(tagsArray, input) {
        input.value = tagsArray.join(', ');
    }

    // ========================================
    // 6. UPLOAD & FLOW
    // ========================================

    function redirectToUpload() {
        const title = document.querySelector('input[name="title"]')?.value || document.getElementById('titleInput')?.value || '';
        if (!title) {
            if (window.showToast) window.showToast('Por favor importa o escribe un título primero.', 'error');
            return;
        }
        const params = new URLSearchParams();
        params.set('title', title);
        params.set('from', 'youtube');
        window.location.href = `${targetUrl}?${params.toString()}`;
    }

    async function processAndUpload() {
        const isManual = document.getElementById('yt-upload-form')?.style.display === 'block';
        const title = isManual ? document.getElementById('upload-title')?.value : document.getElementById('import-title')?.value;
        if (!title) {
            if (window.showToast) window.showToast('Falta el título', 'error');
            return;
        }
        const user = window.AuthUtils?.getCurrentUser();
        if (!user) {
            if (window.showGuestModal) window.showGuestModal("Guarda tu Progreso", "Inicia sesión para continuar.");
            return;
        }
        // Logic for creating draft...
    }

    // ========================================
    // 7. EXPORTS
    // ========================================
    window.handleImportClick = handleImportClick;
    window.closeImporterModal = closeImporterModal;
    window.listUserVideos = listUserVideos;
    window.resetToHub = resetToHub;
    window.selectVideo = selectVideo;
    window.redirectToUpload = redirectToUpload;
    window.processAndUpload = processAndUpload;

})();
