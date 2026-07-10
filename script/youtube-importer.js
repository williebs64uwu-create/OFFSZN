(function () {
    const CLIENT_ID = '804444303530-bl8gtp4sdjkcnrkjl1295vns59tqp4tc.apps.googleusercontent.com';
    const SCOPES = 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload';
    const targetUrl = '/upload/beats.html';

    let tokenClient;
    let gapiInited = false;
    let gisInited = false;

    // --- GIS Initialization (Fix for "tokenClient NOT ready") ---
    function gapiLoaded() {
        console.log("📹 Importer: GAPI Loaded Triggered");
        if (typeof gapi === 'undefined') {
            console.error("📹 Importer: gapi is undefined!");
            return;
        }
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    // Note: API key is not strictly needed for the token flow if using GIS client
                });
                await gapi.client.load('youtube', 'v3');

                // 🔥 Restore token if available to prevent 403 on auto-import
                const savedToken = sessionStorage.getItem('yt_access_token');
                if (savedToken) {
                    gapi.client.setToken({ access_token: savedToken });
                    console.log("📹 Importer: Token restored from sessionStorage");
                }

                gapiInited = true;
                window._gapiInited = true;
                console.log("📹 Importer: GAPI Client Ready");
                maybeEnableButtons();
            } catch (err) {
                console.error("📹 Importer: GAPI Init Error", err);
            }
        });
    }

    function gisLoaded() {
        console.log("📹 Importer: GIS Loaded Triggered");
        if (typeof google === 'undefined') {
            console.error("📹 Importer: google is undefined!");
            return;
        }
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // defined at request time
        });
        gisInited = true;
        window._gisInited = true;
        window._googleTokenClient = tokenClient; // Share across modules
        console.log("📹 Importer: GIS Client Ready");
        maybeEnableButtons();
    }

    // Proxy function for Auth requests (used by youtube-uploader-v2.js as well)
    window._googleRequestAuth = function (callback, scopeOverride) {
        if (!tokenClient) {
            console.error("❌ [GIS] tokenClient no disponible para auth");
            if (callback) callback({ error: 'token_client_not_ready' });
            return;
        }

        // Variable to control if we have received a response
        let hasResponded = false;

        tokenClient.callback = async (resp) => {
            hasResponded = true;
            if (callback) callback(resp);
        };

        try {
            // Initiate the auth prompt
            const options = { prompt: 'consent' };
            if (scopeOverride) {
                console.log("📹 [GIS] Requesting custom scope override:", scopeOverride);
                options.scope = scopeOverride;
            }
            tokenClient.requestAccessToken(options);

            // Detection logic for when the user closes the popup
            // Google Identity Services doesn't natively expose the popup window object
            // to check window.closed, so we rely on document focus heuristically.
            let focusCount = 0;
            const checkPopupClosed = setInterval(() => {
                if (hasResponded) {
                    clearInterval(checkPopupClosed);
                    return;
                }

                // If the main document has focus, the popup MIGHT be closed.
                // But it could just be the user clicking on the background momentarily
                // while the popup is still open. 
                if (document.hasFocus()) {
                    focusCount++;
                    // Require the document to hold focus for ~3 consecutive seconds 
                    // before we assume the user definitely closed the auth popup 
                    // without completing it.
                    if (focusCount >= 3) {
                        console.log("⚠️ [GIS] Auth popup cerrado detectado tras varios chequeos");
                        hasResponded = true;
                        clearInterval(checkPopupClosed);
                        if (callback) callback({ error: 'popup_closed_by_user', error_description: 'La ventana de autenticación fue cerrada.' });
                    }
                } else {
                    // Reset count if focus is lost (e.g., popup regains focus)
                    focusCount = 0;
                }
            }, 1000); // Check every second

        } catch (e) {
            console.error("❌ [GIS] Error starting auth:", e);
            if (callback) callback({ error: e.message });
        }
    };

    function maybeEnableButtons() {
        if (gapiInited && gisInited) {
            const btn = document.getElementById('youtubeImportBtn');
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
            console.log("📹 Importer: Buttons Enabled");

            // 🔥 Check for automatic import from Dashboard
            handleAutoImport();
        }
    }

    async function handleAutoImport() {
        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('auto_import');
        if (!videoId) return;

        console.log("🚀 [AUTO-IMPORT] Detectado VideoId:", videoId);

        try {
            // Need snippet to populate title/desc
            const response = await gapi.client.youtube.videos.list({
                id: videoId,
                part: 'snippet'
            });

            if (response.result.items?.length > 0) {
                const snippet = response.result.items[0].snippet;
                console.log("🚀 [AUTO-IMPORT] Datos obtenidos, poblando formulario...");
                selectVideo(videoId, snippet);
            } else {
                console.warn("⚠️ [AUTO-IMPORT] No se encontró el video o es privado.");
            }
        } catch (err) {
            console.error("❌ [AUTO-IMPORT] Error:", err);
        }
    }

    // ========================================
    // 1. FLOW ENTRY
    // ========================================

    async function handleImportClick() {
        if (!tokenClient) {
            console.error("❌ [GIS] tokenClient NOT ready");

            // Try emergency sync
            if (window._googleTokenClient) {
                tokenClient = window._googleTokenClient;
                gisInited = true;
                maybeEnableButtons();
            }
            return;
        }

        // Check if we already have a token
        const token = gapi.client.getToken();
        if (token) {
            openImporterModal();
            listUserVideos();
        } else {
            window._googleRequestAuth((resp) => {
                if (resp.access_token) {
                    openImporterModal();
                    listUserVideos();
                }
            });
        }
    }

    // ========================================
    // 2. UI / MODAL
    // ========================================

    function openImporterModal() {
        let modal = document.getElementById('yt-importer-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'yt-importer-modal';
            modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); backdrop-filter:blur(10px); z-index:99999; display:flex; justify-content:center; align-items:center; opacity:0; transition:opacity 0.3s ease;`;
            modal.innerHTML = `
                <div style="background:#0a0a0a; width:90%; max-width:800px; max-height:85vh; border-radius:16px; border:1px solid #222; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
                    <div style="padding:20px 24px; border-bottom:1px solid #1a1a1a; display:flex; justify-content:space-between; align-items:center;">
                        <h2 style="margin:0; font-size:1.25rem; font-weight:600; background:linear-gradient(to right, #fff, #888); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">Importar de YouTube</h2>
                        <button onclick="closeImporterModal()" style="background:none; border:none; color:#666; cursor:pointer; font-size:1.5rem; transition:color 0.2s;">&times;</button>
                    </div>
                    <div id="yt-modal-content" style="flex:1; overflow-y:auto; padding:24px;">
                        <div id="yt-video-list" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:20px;">
                            <!-- Videos will load here -->
                        </div>
                        <div id="yt-loader" style="display:none; text-align:center; padding:40px;">
                            <div class="loader-spinner" style="border:3px solid #111; border-top:3px solid #8b5cf6; border-radius:50%; width:30px; height:30px; animation:spin 1s linear infinite; margin:0 auto 16px;"></div>
                            <span style="color:#666; font-size:0.9rem;">Cargando tus videos...</span>
                        </div>
                    </div>
                </div>
                <style>
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    #yt-importer-modal button:hover { color:#fff !important; }
                </style>
            `;
            document.body.appendChild(modal);
        }
        setTimeout(() => modal.style.opacity = '1', 10);
        modal.style.display = 'flex';
    }

    function closeImporterModal() {
        const modal = document.getElementById('yt-importer-modal');
        if (modal) {
            modal.style.opacity = '0';
            setTimeout(() => modal.style.display = 'none', 300);
        }
    }

    // ========================================
    // 3. API CALLS
    // ========================================

    async function listUserVideos() {
        const listEl = document.getElementById('yt-video-list');
        const loader = document.getElementById('yt-loader');

        if (listEl) listEl.innerHTML = '';
        if (loader) loader.style.display = 'block';

        console.log("📹 Importer: Fetching user videos...");

        try {
            // Check auth again
            if (!gapi.client.getToken()) {
                console.warn("📹 Importer: No token found, requesting auth...");
                window._googleRequestAuth((resp) => {
                    if (resp.access_token) listUserVideos();
                });

                return;
            }

            const response = await gapi.client.youtube.search.list({
                part: 'snippet',
                forMine: true,
                type: 'video',
                maxResults: 20,
                order: 'date'
            });

            if (loader) loader.style.display = 'none';
            const items = response.result.items;

            console.log("📹 Importer: API Response Items:", items?.length || 0);

            if (!items || items.length === 0) {
                if (listEl) listEl.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#666; padding:40px;">No se encontraron videos públicos o no tienes videos subidos en este canal.</div>';
                return;
            }

            if (listEl) {
                items.forEach(item => {
                    const card = document.createElement('div');
                    card.style.cssText = `background:#111; border-radius:12px; border:1px solid #1a1a1a; overflow:hidden; cursor:pointer; transition:all 0.2s cubic-bezier(0.4,0,0.2,1);`;
                    card.onmouseover = () => { card.style.borderColor = '#8b5cf6'; card.style.transform = 'translateY(-4px)'; };
                    card.onmouseout = () => { card.style.borderColor = '#1a1a1a'; card.style.transform = 'translateY(0)'; };
                    card.onclick = () => selectVideo(item.id.videoId, item.snippet);

                    const thumb = item.snippet.thumbnails.medium.url;
                    card.innerHTML = `
                        <div style="aspect-ratio:16/9; background:#000; overflow:hidden; position:relative;">
                            <img src="${thumb}" style="width:100%; height:100%; object-fit:cover;">
                        </div>
                        <div style="padding:12px;">
                            <h3 style="margin:0; font-size:0.85rem; color:#eee; font-weight:500; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.4;">${item.snippet.title}</h3>
                            <p style="margin:8px 0 0 0; font-size:0.75rem; color:#555;">${new Date(item.snippet.publishedAt).toLocaleDateString()}</p>
                        </div>
                    `;
                    listEl.appendChild(card);
                });
            }

        } catch (err) {
            console.error('📹 Importer: API Error:', err);
            if (loader) loader.style.display = 'none';
            if (listEl) listEl.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#ef4444; padding:20px;">Error al cargar videos de YouTube. ${err.result?.error?.message || err.message || 'Error desconocido'}</div>`;
        }
    }

    // ========================================
    // 4. METADATA & INJECTION
    // ========================================

    async function selectVideo(videoId, snippet) {
        if (!videoId) return;

        // --- DEDUPLICATION LOGIC ---
        // If the same video is imported twice, skip redundant processing
        if (window.uploaderState && window.uploaderState.lastImportedYouTubeId === videoId) {
            console.log('🔄 [YOUTUBE IMPORTER] Video ya importado, saltando procesamiento redundante.');
            closeImporterModal();
            return;
        }

        closeImporterModal();

        const { title, description, thumbnails } = snippet;

        // Clean common patterns like [Prod. X] (Prod. X) etc.
        let cleanTitle = title.replace(/\[.*?\]|\(.*?\)/g, '').trim();

        // 1. Tags
        // search.list doesn't always include tags, but let's try
        let tags = snippet.tags || [];

        // 2. Detection Logic (BPM & Key & Hashtags)
        const detected = detectMetadata(title, description);
        const bpmUsed = detected.bpm;
        const keyUsed = detected.key;

        // Prepend extracted hashtags to tags to prioritize them
        if (detected.hashtags && detected.hashtags.length > 0) {
            // New tags list starting with hashtags
            const combinedTags = [...detected.hashtags];
            // Add existing snippet tags if they are not already there
            tags.forEach(t => {
                if (!combinedTags.includes(t)) combinedTags.push(t);
            });
            tags = combinedTags;
        }

        // 3. UI Inyection
        populateForm(videoId, cleanTitle, description, bpmUsed, keyUsed, tags, thumbnails.maxres?.url || thumbnails.high?.url || thumbnails.medium?.url);
    }

    async function populateForm(videoId, title, description, bpm, key, tags, thumbUrl) {
        // IDs from beats.html
        const titleInput = document.getElementById('titleInput');
        const descInput = document.getElementById('descInput');
        const bpmInput = document.getElementById('bpmInput');
        const keyInput = document.getElementById('keyInput');

        if (titleInput) {
            titleInput.value = title;
            if (window.uploaderState) window.uploaderState.title = title;
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (descInput) {
            descInput.value = description;
            if (window.uploaderState) window.uploaderState.description = description;
            descInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (bpmInput && bpm) {
            bpmInput.value = bpm;
            if (window.uploaderState) window.uploaderState.bpm = bpm;
            bpmInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Key Selection (Match dropdown)
        if (keyInput && key) {
            // Find option in select
            const options = Array.from(keyInput.options);
            const found = options.find(o => o.value.toLowerCase() === key.toLowerCase());
            if (found) {
                keyInput.value = found.value;
                if (window.uploaderState) window.uploaderState.key = found.value;

                // Update Custom UI Trigger
                const display = document.getElementById('keyDisplay');
                if (display) display.innerHTML = `<span>${found.text.trim()}</span>`;

                // Select in list visually
                const list = document.getElementById('keyOptionsList');
                if (list) {
                    list.querySelectorAll('.dropdown-item').forEach(item => {
                        item.classList.toggle('selected', item.getAttribute('data-value') === found.value);
                    });
                }
            }
        }

        // Tags Synchronization
        if (typeof window.clearTags === 'function' && typeof window.addTag === 'function') {
            window.clearTags();
            if (tags && tags.length > 0) {
                tags.slice(0, 3).forEach(tag => window.addTag(tag));
            }
        }

        // Thumbnail -> Cover File logic
        if (thumbUrl) {
            try {
                // Download image as blob and create File object
                const response = await fetch(thumbUrl);
                const blob = await response.blob();
                // Use the videoId in the filename to avoid collisions and track imports
                const file = new File([blob], `youtube_${videoId}.jpg`, { type: 'image/jpeg' });

                // Update UI preview
                const preview = document.getElementById('coverPreview');
                if (preview) {
                    preview.src = URL.createObjectURL(file);
                    preview.style.display = 'block';
                }
                const dropZone = document.getElementById('coverDropZone');
                if (dropZone) dropZone.classList.add('has-image');

                const cardPreview = document.getElementById('previewCardCover');
                if (cardPreview) cardPreview.innerHTML = `<img src="${preview.src}" style="width:100%;height:100%;object-fit:cover;">`;

                // --- DEFERRED UPLOAD LOGIC ---
                // We no longer upload immediately to R2 to avoid orphaning files.
                // Instead, we just set uploaderState.cover as a File object.
                // The main handlePublish() in nuevo.js will handle the actual R2 upload.

                if (!window.uploaderState) {
                    window.uploaderState = {
                        files: { kit: null, audio: null },
                        cover: null
                    };
                }

                if (window.uploaderState) {
                    // Update uploaderState with the new cover File
                    window.uploaderState.cover = file;
                    // Store the video ID to prevent redundant imports in the same session
                    window.uploaderState.lastImportedYouTubeId = videoId;

                    // SYNC with formData for Beats.html logic
                    if (window.formData) {
                        window.formData.coverBlob = file;
                    }

                    // If we are editing, schedule the old cover for deletion
                    if (window.uploaderState.editId && window.originalProductData) {
                        if (window.originalProductData.image_url) {
                            const oldUrl = window.uploaderState.old_raw_cover || window.originalProductData.image_url;
                            console.log('🧹 [YOUTUBE IMPORTER] Scheduling previous cover for cleanup:', oldUrl);
                            window.uploaderState.old_raw_cover = oldUrl;
                        }
                    }
                }
            } catch (err) {
                console.error("❌ Error processing YouTube thumbnail:", err);
            }
        }

        // Final Preview Update
        if (window.renderPreview) window.renderPreview();
    }

    // ========================================
    // 5. DETECTION LOGIC
    // ========================================

    function detectBPM(text) {
        if (!text) return null;
        // Normalize text
        const clean = text.replace(/[\(\)\[\]\-_]/g, ' ');

        // 1. Explicit BPM pattern: "140 BPM", "140bpm", "BPM: 140", "BPM 140"
        const explicitRegex = /(?:BPM[:\s-]*)(\d{2,3})|(\d{2,3})(?:\s?BPM)/gi;
        let match = explicitRegex.exec(clean);
        if (match) {
            const val = parseInt(match[1] || match[2]);
            if (val >= 0 && val <= 250) return val;
        }

        // 2. Standalone number fallback: Find a standalone 2-3 digit number between 40 and 250
        // (Avoiding common years like 2023 or small counts)
        const looseRegex = /\b(\d{2,3})\b/g;
        let candidate = null;
        while ((match = looseRegex.exec(clean)) !== null) {
            const val = parseInt(match[1]);
            // If it's in a likely BPM range (40-250), we take it as candidate
            if (val >= 40 && val <= 250) {
                candidate = val;
                break;
            }
        }
        return candidate;
    }

    function detectKey(text) {
        const rootRaw = "[A-G]";
        const accRaw = "(?:#|b|flat|sharp| sostenido| bemol)?";
        const scaleRaw = "(?:maj|major|mayor|major|M|min|minor|menor|m)";

        // Regex construction
        const regex = new RegExp(`\\b(${rootRaw})(${accRaw})\\s?(${scaleRaw})\\b`, 'gi');
        const match = regex.exec(text);
        if (!match) return null;

        let [full, root, acc, scale] = match;
        root = root.toUpperCase();
        acc = acc ? acc.toLowerCase().trim() : '';

        // Normalize accidentals
        if (acc.includes('flat') || acc.includes('bemol') || acc === 'b') {
            // Dropdown usually uses sharps
            const flatMap = { 'Ab': 'G#', 'Bb': 'A#', 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#' };
            const mapped = flatMap[root + 'b'] || root + 'b';
            root = mapped[0];
            acc = mapped[1] || '';
        } else if (acc.includes('sharp') || acc.includes('sostenido') || acc === '#') {
            acc = '#';
        } else {
            acc = '';
        }

        const type = ['min', 'minor', 'menor', 'm'].includes(scale.toLowerCase()) ? 'Minor' : 'Major';
        return `${root}${acc} ${type}`.trim();
    }

    function detectMetadata(title, description) {
        const searchText = `${title} ${description}`;
        const bpm = detectBPM(searchText);
        const key = detectKey(searchText);

        // Extract hashtags from description
        const hashtags = [];
        if (description) {
            const hashRegex = /#(\w+)/g;
            let match;
            while ((match = hashRegex.exec(description)) !== null && hashtags.length < 3) {
                hashtags.push(match[1]);
            }
        }

        return { bpm, key, hashtags };
    }

    // ========================================
    // 6. EXPORTS
    // ========================================
    window.handleImportClick = handleImportClick;
    window.closeImporterModal = closeImporterModal;
    window.listUserVideos = listUserVideos;
    window.selectVideo = selectVideo;

    // 🔥 Loader Exports (Explicitly global for HTML script tags)
    window.gapiLoaded = gapiLoaded;
    window.gisLoaded = gisLoaded;

    // Case-insensitive fallbacks for common typos in script tags
    window.gapiloaded = gapiLoaded;
    window.gisloaded = gisLoaded;

    // Emergency manual initialization if scripts already loaded
    if (typeof gapi !== 'undefined') gapiLoaded();
    if (typeof google !== 'undefined') gisLoaded();

})();
