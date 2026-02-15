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
    SCOPES: 'https://www.googleapis.com/auth/youtube.readonly',
    DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest']
};

let tokenClient;
let gapiInited = false;
let gisInited = false;
let nextPageToken = '';

// ========================================
// GLOBAL CONFIG
// ========================================
const targetUrl = '/cuenta/Upload/Beats.html'; // Or 'beats.html' depending on structure, usually relative is safer if in same dir, but here we are in /script/ so absolute path from root is better. 
// Assuming beats.html is at /cuenta/Upload/Beats.html based on typical structure.
// Wait, listing showed `cuenta/Upload/Beats.html`. So `/cuenta/Upload/Beats.html` is correct.

// ========================================
// 1. INITIALIZATION
// ========================================

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        discoveryDocs: YT_CONFIG.DISCOVERY_DOCS,
    });
    gapiInited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: YT_CONFIG.CLIENT_ID,
        scope: YT_CONFIG.SCOPES,
        callback: '', // defined at request time
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        const btn = document.getElementById('btn-import-yt');
        if (btn) btn.disabled = false;
    }
}

// ========================================
// 2. AUTHENTICATION & FETCHING
// ========================================

async function handleImportClick() {
    // Check if we have a token
    const token = gapi.client.getToken();
    if (token === null) {
        // Request token
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                throw (resp);
            }
            await listUserVideos();
        };
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        await listUserVideos();
    }
}

// ðŸ”¥ WINDOW EXPORTS FOR EXTERNAL CALLS
window.handleImportClick = handleImportClick;
window.listUserVideos = listUserVideos;

// ðŸ”¥ HUB NAVIGATION HELPERS
function resetToHub() {
    const hub = document.getElementById('yt-hub-selection');
    const main = document.getElementById('yt-main-form');

    if (hub) hub.style.display = 'grid';
    if (main) main.style.display = 'none';

    // Clear form
    const title = document.querySelector('input[name="title"]');
    const desc = document.querySelector('textarea[name="description"]');

    if (title) title.value = '';
    if (desc) desc.value = '';
}

// SHOW FORM AFTER SELECTION
function showForm() {
    const hub = document.getElementById('yt-hub-selection');
    const main = document.getElementById('yt-main-form');

    if (hub) hub.style.display = 'none';
    if (main) main.style.display = 'block';

    // ðŸ”¥ Beats.html Specific: Close the modal after selection because we populate the main form directly
    // If we are in Beats.html (no yt-main-form), we likely want to close `yt-importer-modal`
    if (!main) {
        document.getElementById('yt-importer-modal').style.display = 'none';
    }
}

let isFetching = false; // Global flag to prevent race conditions

async function listUserVideos(pageToken = '') {
    if (isFetching) return; // Prevent duplicate calls
    isFetching = true;

    showImporterModal(); // Only show modal when we are DEFINITELY listing videos
    const listContainer = document.getElementById('yt-video-list');

    // Infinite Scroll Setup (Singleton)
    if (!listContainer.hasAttribute('data-scroll-init')) {
        listContainer.setAttribute('data-scroll-init', 'true');
        listContainer.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = listContainer;
            // Load more when user is 600px from bottom (Intelligent Pre-loading)
            if (scrollTop + clientHeight >= scrollHeight - 600) {
                if (nextPageToken && !isFetching) {
                    listUserVideos(nextPageToken);
                }
            }
        });
    }

    if (!pageToken) {
        // Initial Load: Show Skeletons
        listContainer.innerHTML = '';
        renderSkeleton(listContainer, 8);
    } else {
        // Appending: Render skeletons to indicate loading
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

        // Atomic DOM Update to prevent Scroll Jumps
        const skeletons = listContainer.querySelectorAll('.skeleton-card');

        if (videos && videos.length > 0) {
            const fragment = document.createDocumentFragment();
            videos.forEach(video => {
                if (video && video.snippet) {
                    const card = createVideoCard(video);
                    fragment.appendChild(card);
                }
            });

            // Remove skeletons AND Append new items in same cycle
            skeletons.forEach(s => s.remove());
            listContainer.appendChild(fragment);

        } else {
            // No videos found in this batch
            skeletons.forEach(s => s.remove());
            if (!pageToken) listContainer.innerHTML = '<div class="yt-empty">No se encontraron videos en tu canal.</div>';
        }
    } catch (err) {
        console.error("YouTube API Error:", err);
        // Remove Skeletons on error
        const skeletons = listContainer.querySelectorAll('.skeleton-card');
        skeletons.forEach(s => s.remove());

        // Only show error if list is empty
        if (listContainer.children.length === 0)
            listContainer.innerHTML = '<div class="yt-error">Error al conectar con YouTube. Verifica los permisos.</div>';
    } finally {
        isFetching = false;
    }
}

function renderSkeleton(container, count) {
    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.className = 'yt-video-card skeleton-card'; // Reuse yt-video-card class for layout
        div.style.pointerEvents = 'none';
        div.innerHTML = `
            <div class="skeleton-img" style="width: 100%; aspect-ratio: 16/9;"></div>
            <div class="yt-video-info">
                <div class="skeleton-text" style="width: 80%; height: 14px; margin-bottom: 8px;"></div>
                <div class="skeleton-text" style="width: 50%; height: 12px;"></div>
            </div>
        `;
        container.appendChild(div);
    }
}

// ========================================
// 3. UI GENERATION (MODAL & CARDS)
// ========================================

function createVideoCard(video) {
    if (!video || !video.snippet) return document.createElement('div'); // Safety fallback

    const snippet = video.snippet;
    const videoId = video.id ? video.id.videoId : '';
    const title = snippet.title || 'Sin Título';
    const thumb = snippet.thumbnails?.medium?.url || '';
    // Format date: "15 oct 2023"
    const date = new Date(snippet.publishedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

    const div = document.createElement('div');
    div.className = 'yt-video-card';
    div.innerHTML = `
        <img src="${thumb}" alt="${title}">
        <div class="yt-video-info">
            <h4 title="${title}">${title}</h4>
            <div style="font-size: 0.75rem; color: #888; margin-top: auto;">${date}</div>
        </div>
    `;
    div.onclick = () => selectVideo(videoId, title, snippet.description || '', snippet.thumbnails);
    return div;
}

function showImporterModal() {
    const modal = document.getElementById('yt-importer-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Reset scroll position
        const list = document.getElementById('yt-video-list');
        if (list) list.scrollTop = 0;
    }
}

function closeImporterModal() {
    const modal = document.getElementById('yt-importer-modal');
    if (modal) modal.style.display = 'none';
}

// ========================================
// 4. DATA EXTRACTION & FORM POPULATION
// ========================================

async function selectVideo(videoId, title, description, thumbnails) {
    console.log("Selected Video:", videoId, title);

    // ðŸ”¥ SHOW FORM IMMEDIATELY
    showForm();

    // ðŸ”¥ HANDLE THUMBNAIL
    // Try to get maxres, then hq, then medium
    let thumbUrl = '';
    if (thumbnails.maxres) thumbUrl = thumbnails.maxres.url;
    else if (thumbnails.high) thumbUrl = thumbnails.high.url;
    else if (thumbnails.medium) thumbUrl = thumbnails.medium.url;

    // ... rest of selectVideo


    const thumbImg = document.getElementById('yt-imported-thumb');
    const beatCoverPreview = document.getElementById('coverPreview');

    if (thumbImg) {
        thumbImg.style.display = 'block';
        thumbImg.src = thumbUrl;
        thumbImg.crossOrigin = "Anonymous";

        // Logic for youtube.html (old)
        const container = document.getElementById('yt-thumb-preview-container');
        if (container) {
            container.classList.add('has-file');
            const placeholder = container.querySelector('.yt-thumb-placeholder');
            if (placeholder) placeholder.style.display = 'none';
        }
    }

    // ðŸ”¥ Logic for Beats.html (Unified)
    if (beatCoverPreview) {
        beatCoverPreview.src = thumbUrl;
        beatCoverPreview.style.display = 'block';

        const dropZone = document.getElementById('coverDropZone');
        if (dropZone) dropZone.classList.add('has-image');

        // ðŸ”¥ FETCH BLOB FOR BEATS.HTML FORM DATA
        if (typeof formData !== 'undefined') {
            try {
                // Use a proxy or fetch with CORS anonymous
                // YouTube images usually allow CORS if crossOrigin is set on Img, but for fetch() we need correct headers.
                // Assuming standard fetch works for googleusercontent
                const response = await fetch(thumbUrl, { mode: 'cors' });
                const blob = await response.blob();
                formData.coverBlob = blob;
                if (typeof filesUploaded !== 'undefined') filesUploaded.cover = true;

                // Show Remove Button
                const removeBtn = document.getElementById('removeCoverBtn');
                if (removeBtn) removeBtn.style.display = 'block';

            } catch (e) {
                console.warn("Could not fetch cover blob:", e);
                // If fetch fails, we might rely on the URL being passed to backend? 
                // For now, Beats.html logic relies on blob for new uploads. 
                // We might need to flag that it's a URL upload if blob fails.
            }
        }
    }

    // 1. Extract Tags (Requires another API call for keywords)
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

    // 2. INTELLIGENT METADATA DETECTION
    const detection = detectMetadata(title, description);
    const cleanTitle = title.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim();

    // Handle Tags (Cloud UI) - these elements are needed for populateForm
    const tagCloud = document.getElementById('yt-tags-cloud');
    const hiddenTagsInput = document.getElementById('final-tags-input');

    // Conflict Resolution: Check if we have multiple valid unique candidates
    if (detection.uniqueBpms.length > 1 || detection.uniqueKeys.length > 1) {
        showConflictModal(detection.uniqueBpms, detection.uniqueKeys, (selectedBpm, selectedKey) => {
            // Continue with detected conflict resolution
            populateForm(cleanTitle, description, selectedBpm, selectedKey, tags, hiddenTagsInput, tagCloud);
        });
        // We stop here, populateForm calls the rest (Modal handles selection)
    } else {
        // Auto-select best candidates
        const bestBpm = detection.uniqueBpms.length > 0 ? detection.uniqueBpms[0] : '';
        const bestKey = detection.uniqueKeys.length > 0 ? detection.uniqueKeys[0] : '';
        populateForm(cleanTitle, description, bestBpm, bestKey, tags, hiddenTagsInput, tagCloud);
    }

    // UPDATE "WATCH ON YOUTUBE" LINK
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
    // For Key, Beats.html uses a hidden select #keyInput or the custom dropdown logic
    const keyInput = document.querySelector('input[name="key"]') || document.getElementById('keyInput');

    if (titleInput) {
        titleInput.value = cleanTitle;
        // updateTitleCount might not be defined or scoped correctly.
        // Best practice: Dispatch 'input' event to trigger Beats.html's own listeners.
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (descInput) {
        descInput.value = description;
        descInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (bpmInput) bpmInput.value = bpm;
    if (keyInput) keyInput.value = key;

    // Handle Tags (Same as before)
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
                        // Deselecting
                        selectedTags = selectedTags.filter(t => t !== tag);
                        chip.classList.remove('selected');
                        if (warning) warning.style.display = 'none';
                    } else {
                        // Selecting
                        if (selectedTags.length >= 3) {
                            if (warning) {
                                warning.style.display = 'block';
                                warning.classList.add('fade-in'); // Reuse fade-in animation
                            }
                            return; // Stop selection
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

        // ðŸ”¥ Beats.html Tag System Support
        if (typeof window.clearTags === 'function' && typeof window.addTag === 'function') {
            window.clearTags();
            const tagList = tags.split(',').map(t => t.trim()).filter(t => t);
            // Select up to 3 tags
            tagList.slice(0, 3).forEach(tag => window.addTag(tag));
        }
    }

}

// ========================================
// 4. METADATA DETECTION (ENHANCED)
// ========================================

/**
 * Ensures all standard Musical Keys (Sharps & Flats) exist in the selection dropdown.
 * If not, it injects them properly so the user can select them.
 */
function ensureAllKeys() {
    const hiddenSelect = document.getElementById('keyInput');
    const customList = document.getElementById('keyOptionsList');
    if (!hiddenSelect) return;

    // Standard Chromatic Keys (Major & Minor) - 12x2 = 24 base + enharmonics
    const allKeys = [
        // Major
        'C Major', 'C# Major', 'Db Major', 'D Major', 'D# Major', 'Eb Major', 'E Major', 'F Major', 'F# Major', 'Gb Major', 'G Major', 'G# Major', 'Ab Major', 'A Major', 'A# Major', 'Bb Major', 'B Major',
        // Minor
        'C Minor', 'C# Minor', 'Db Minor', 'D Minor', 'D# Minor', 'Eb Minor', 'E Minor', 'F Minor', 'F# Minor', 'Gb Minor', 'G Minor', 'G# Minor', 'Ab Minor', 'A Minor', 'A# Minor', 'Bb Minor', 'B Minor'
    ];

    const currentOptions = Array.from(hiddenSelect.options).map(o => o.value);
    let addedCount = 0;

    allKeys.forEach(key => {
        if (!currentOptions.includes(key)) {
            // 1. Add to hidden select
            const opt = document.createElement('option');
            opt.value = key;
            opt.text = key;
            hiddenSelect.appendChild(opt);

            // 2. Add to Custom UI List (if exists)
            if (customList) {
                const div = document.createElement('div');
                div.className = 'custom-option';
                div.textContent = key;
                div.style.cssText = 'padding: 10px 14px; cursor: pointer; color: #ccc; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s; font-size: 14px;';
                div.onclick = () => {
                    if (window.selectCustomKey) window.selectCustomKey(key);
                };
                // Hover effect logic is tricky to inline, but CSS might handle it or we leave plain. 
                // Matches style from Beats.html initCustomKeySelect
                div.onmouseenter = () => { div.style.background = 'rgba(255,255,255,0.05)'; div.style.color = '#fff'; };
                div.onmouseleave = () => { div.style.background = 'transparent'; div.style.color = '#ccc'; };

                customList.appendChild(div);
            }
            addedCount++;
        }
    });

    if (addedCount > 0) {
        console.log(`✅ Added ${addedCount} missing keys (Flats/Sharps) to dropdown.`);
    }
}

function detectBPM(text) {
    const numericBPM = [];

    // 1. "120 BPM" or "120bpm"
    const explicitRegex = /\b(\d{2,3})\s?BPM\b/gi;
    let match;
    while ((match = explicitRegex.exec(text)) !== null) {
        const val = parseInt(match[1]);
        if (val >= 60 && val <= 250) numericBPM.push(val);
    }

    // 2. "120" if context is suspicious (e.g. at end of title?) - skipped for safety to avoid false positives
    // But user asked for it if fails: "solo buscar numeros"

    // Return first robust match
    if (numericBPM.length > 0) return numericBPM[0];

    // Fallback: Look for lone numbers 70-180
    const fallbackRegex = /\b(7[0-9]|8[0-9]|9[0-9]|1[0-7][0-9])\b/g;
    while ((match = fallbackRegex.exec(text)) !== null) {
        // Only if not part of a date like 2024 (handled by \b & range)
        return parseInt(match[1]);
    }
    return null;
}

function detectKey(text) {
    // Regex for:
    // Root: A-G
    // Accidental: #, b, sharp, flat (optional)
    // Scale: maj, min, m, M, major, minor, mayor, menor
    // Spacing: optional

    // Note: We need to handle "Abminor" (no space)

    const root = "[A-G]";
    const acc = "(?:#|b|flat|sharp)?";
    const scale = "(?:maj|major|mayor|M|min|minor|menor|m)";

    // We strictly look for Root+Acc+Scale to avoid "A" (word) matches.
    // Example: "A# Minor", "Abminor", "C major"
    const regex = new RegExp(`\\b(${root})(${acc})\\s?(${scale})\\b`, 'gi');

    const match = regex.exec(text);
    if (!match) return null;

    let [full, r, a, s] = match;

    // Normalize Root
    r = r.toUpperCase();

    // Normalize Accidental
    a = a ? a.toLowerCase() : '';
    if (a === 'flat') a = 'b';
    if (a === 'sharp') a = '#';

    // Normalize Scale
    s = s.toLowerCase();
    let type = 'Major'; // Default
    if (['min', 'minor', 'menor', 'm'].includes(s)) {
        type = 'Minor';
    }

    // Construct final key string matching Dropdown format (e.g. "C# Major")
    // Note: We preserve 'b' (Flat) to satisfy user preference for flats.
    // EnsureAllKeys() will make sure "Ab Minor" exists.

    return `${r}${a} ${type}`;
}

function detectMetadata(title, description) {
    try {
        console.log('🔍 Detecting Metadata for:', title);

        // 1. Ensure Keys Exist
        ensureAllKeys();

        const searchText = `${title} ${description}`;

        // 2. Detect BPM
        const detectedBPM = detectBPM(searchText);
        if (detectedBPM) {
            console.log('🎯 Detected BPM:', detectedBPM);
            const bpmInput = document.getElementById('bpmInput'); // Beats.html ID
            if (bpmInput) {
                bpmInput.value = detectedBPM;
                bpmInput.classList.add('filled');
            }
            // Also Support legacy ID or other inputs if needed
            const legacyBpm = document.getElementById('import-bpm');
            if (legacyBpm) legacyBpm.value = detectedBPM;
        }

        // 3. Detect Key
        const detectedKey = detectKey(searchText);
        if (detectedKey) {
            console.log('🎯 Detected Key:', detectedKey);

            // Use the global helper from Beats.html if available
            if (typeof window.selectCustomKey === 'function') {
                window.selectCustomKey(detectedKey);
            } else {
                // Fallback direct set
                const keyInput = document.getElementById('keyInput');
                if (keyInput) keyInput.value = detectedKey;

                const keyDisplay = document.getElementById('keyDisplay');
                if (keyDisplay) {
                    keyDisplay.textContent = detectedKey;
                    keyDisplay.style.color = '#fff';
                }
            }
        }

        // 4. Auto-Tagging (Matches Task Plan)
        // If we have tags in title/description that aren't YouTube tags? 
        // Logic handled in handleImportClick -> addTag

        return {
            uniqueBpms: detectedBPM ? [detectedBPM] : [],
            uniqueKeys: detectedKey ? [detectedKey] : []
        };

    } catch (e) {
        console.error('⚠️ Metadata detection logic error:', e);
        return { uniqueBpms: [], uniqueKeys: [] };
    }
}

function showConflictModal(bpms, keys, onConfirm) {
    // Determine what we need to ask
    let bpmHtml = '';
    if (bpms.length > 1) {
        bpmHtml = `<div style="margin-bottom:16px;">
            <label style="display:block; color:#ccc; margin-bottom:8px;">Selecciona BPM Correcto:</label>
            <div style="display:flex; gap:8px;">
                ${bpms.map((b, i) => `<button class="conflict-btn ${i === 0 ? 'selected' : ''}" onclick="selectConflict(this, 'bpm', '${b}')">${b}</button>`).join('')}
            </div>
            <input type="hidden" id="conflict-bpm-val" value="${bpms[0]}">
        </div>`;
    } else {
        bpmHtml = `<input type="hidden" id="conflict-bpm-val" value="${bpms[0] || ''}">`;
    }

    let keyHtml = '';
    if (keys.length > 1) {
        keyHtml = `<div style="margin-bottom:16px;">
            <label style="display:block; color:#ccc; margin-bottom:8px;">Selecciona Key Correcta:</label>
            <div style="display:flex; gap:8px;">
                ${keys.map((k, i) => `<button class="conflict-btn ${i === 0 ? 'selected' : ''}" onclick="selectConflict(this, 'key', '${k}')">${k}</button>`).join('')}
            </div>
            <input type="hidden" id="conflict-key-val" value="${keys[0]}">
        </div>`;
    } else {
        keyHtml = `<input type="hidden" id="conflict-key-val" value="${keys[0] || ''}">`;
    }

    const modal = document.createElement('div');
    modal.id = 'conflict-modal';
    modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); backdrop-filter:blur(5px); z-index:9999; display:flex; justify-content:center; align-items:center;`;
    modal.innerHTML = `
        <div style="background:#1a1a1a; padding:24px; border-radius:12px; border:1px solid #333; width:300px; box-shadow:0 10px 40px rgba(0,0,0,0.5);">
            <h3 style="margin:0 0 16px 0; font-size:1.1rem; color:#fff;">⚠️ Confirmar Datos</h3>
            <p style="color:#888; font-size:0.9rem; margin-bottom:20px;">Hemos detectado múltiples opciones. Por favor confirma:</p>
            ${bpmHtml}
            ${keyHtml}
            <div style="text-align:right; margin-top:20px;">
                <button id="btn-conflict-confirm" style="background:#8b5cf6; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">Confirmar</button>
            </div>
        </div>
        <style>
            .conflict-btn { background:#333; color:#fff; border:1px solid #444; padding:6px 12px; border-radius:4px; cursor:pointer; }
            .conflict-btn.selected { background:#8b5cf6; border-color:#8b5cf6; }
        </style>
    `;

    document.body.appendChild(modal);

    // selection logic
    window.selectConflict = (btn, type, val) => {
        // remove selected from siblings
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

// Helper to update hidden input
function updateHiddenTags(tagsArray, input) {
    input.value = tagsArray.join(', ');
}

// Helper for description count
function updateDescCount(textarea) {
    const len = textarea.value.length;
    const counter = document.getElementById('desc-count');
    const warning = document.getElementById('desc-warning');
    const max = 3000;

    if (counter) {
        counter.textContent = `${len}/${max}`;
        if (len > max) {
            counter.classList.add('limit-exceeded');
            if (warning) warning.style.display = 'block';
        } else {
            counter.classList.remove('limit-exceeded');
            if (warning) warning.style.display = 'none';
        }
    }
}

// Helper for title count
function updateTitleCount(input) {
    const len = input.value.length;
    const counter = document.getElementById('title-count');
    const max = 60;

    if (counter) {
        counter.textContent = `${len}/${max}`;
        if (len > max) {
            counter.classList.add('limit-exceeded');
        } else {
            counter.classList.remove('limit-exceeded');
        }
    }
}

window.updateDescCount = updateDescCount;
window.updateTitleCount = updateTitleCount;

// ========================================
// 5. REDIRECTION TO UPLOAD
// ========================================

function redirectToUpload() {
    const title = document.querySelector('input[name="title"]')?.value || '';
    const description = document.querySelector('textarea[name="description"]')?.value || '';
    // Support both old visible input and new hidden input
    const tags = document.getElementById('final-tags-input')?.value || document.querySelector('input[name="tags"]')?.value || '';
    const bpm = document.querySelector('input[name="bpm"]')?.value || '';
    const key = document.querySelector('input[name="key"]')?.value || '';
    const type = document.getElementById('yt-product-type')?.value || 'beat';

    if (!title) {
        if (window.showToast) window.showToast('Por favor importa o escribe un título primero.', 'error');
        else alert('Falta el título.');
        return;
    }

    const params = new URLSearchParams();
    if (title) params.set('title', title);
    if (description) params.set('desc', description);
    if (tags) params.set('tags', tags);
    if (bpm) params.set('bpm', bpm);
    if (key) {
        params.set('key', key);
        params.set('note', key);
    }
    params.set('from', 'youtube');

    window.location.href = `${targetUrl}?${params.toString()}`;
}


// ========================================
// 7. CROPPER LOGIC (Simplified from Beats.html)
// ========================================
// ðŸ”¥ Namespaced variables to prevent collision with Beats.html globals
let ytCropImage, ytCropBox, ytCropContainer;
let ytImageScale = 1, ytImageX = 0, ytImageY = 0;
let ytIsDragging = false, ytDragStartX = 0, ytDragStartY = 0;
let ytBaseScale = 1;
let currentCropBlob = null; // Stores the final cropped image
let activeCropMode = 'square'; // 'square' (Thumbnail) or 'wide' (Video BG)

let selectedAudioFile = null;
let selectedImageFile = null;

document.addEventListener('DOMContentLoaded', () => {
    // Attempt to find elements - checking both IDs to be safe or reusing specific YT IDs if we changed them
    // But since Beats.html uses id="cropImage", we select that.
    // The conflict was in the *variable name* in global scope, not the DOM ID.
    ytCropImage = document.getElementById('cropImage');
    ytCropBox = document.getElementById('cropBox');
    ytCropContainer = document.getElementById('cropContainer');

    // Initialize cropper events if elements exist
    if (ytCropContainer) {
        ytCropContainer.addEventListener('mousedown', startDrag);
        // Map wheel to zoom safely
        ytCropContainer.addEventListener('wheel', handleZoom, { passive: false });
    }

    // Zoom Slider
    const zoomRange = document.getElementById('zoomRange');
    if (zoomRange) {
        zoomRange.addEventListener('input', (e) => {
            const zoomValue = parseFloat(e.target.value); // 1 to 3
            // Convert slider 1..3 to actual scale
            setZoom(zoomValue * ytBaseScale);
        });
    }

    // Save button
    const saveBtn = document.getElementById('saveCropBtn');
    if (saveBtn) saveBtn.onclick = saveCrop;
});

// --- NEW UPLOAD FLOW FUNCTIONS ---

function showUploadForm() {
    document.getElementById('yt-hub-selection').style.display = 'none';
    document.getElementById('yt-upload-form').style.display = 'block';
}

function handleAudioSelect(input) {
    if (input.files && input.files[0]) {
        selectedAudioFile = input.files[0];
        const zone = document.getElementById('audio-dropzone');
        const filename = document.getElementById('audio-filename');

        zone.classList.add('has-file');
        filename.innerText = selectedAudioFile.name;

        // Auto-fill title if empty
        const titleInput = document.getElementById('upload-title');
        if (titleInput && !titleInput.value) {
            titleInput.value = selectedAudioFile.name.replace(/\.[^/.]+$/, ""); // Remove extension
            titleInput.dispatchEvent(new Event('input', { bubbles: true })); // ðŸ”¥ TRIGGER COUNTER UPDATE
        }
        // No descInput in original context, so no dispatch for it here.
    }
}

function handleImageSelect(input) {
    if (input.files && input.files[0]) {
        selectedImageFile = input.files[0];
        // Open Crop Modal in WIDE mode
        openCropModalForUpload(selectedImageFile);
    }
}

function openCropModalForUpload(file) {
    const modal = document.getElementById('cropModal');
    modal.classList.add('active');
    activeCropMode = 'square'; // Force Square for Beats (Standard)

    const reader = new FileReader();
    reader.onload = (e) => {
        ytCropImage.src = e.target.result;
        // Wait for image to load naturally
        ytCropImage.onload = () => initializeCrop();
    };
    reader.readAsDataURL(file);
}

// ---------------------------------

function openCropModalForThumb() {
    const rawThumb = document.getElementById('yt-imported-thumb');
    if (!rawThumb || !rawThumb.src) {
        if (window.showToast) window.showToast('No hay imagen para recortar', 'error');
        return;
    }

    const modal = document.getElementById('cropModal');
    modal.classList.add('active');
    activeCropMode = 'square'; // Force 1:1

    // Load image into cropper
    // FIX CORS: Set attribute and append timestamp to avoid cached non-CORS response
    ytCropImage.crossOrigin = 'Anonymous';
    if (rawThumb.src.startsWith('blob:')) {
        ytCropImage.src = rawThumb.src;
    } else {
        ytCropImage.src = rawThumb.src + (rawThumb.src.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
    }

    ytCropImage.onload = () => {
        initializeCrop();
    };
}

function closeCropModal() {
    document.getElementById('cropModal').classList.remove('active');
}

// CROPPER LOGIC (Improved)

let ytMinScale = 1;
let ytMaxScale = 3;

function initializeCrop() {
    ytCropImage.style.transform = 'none'; // Reset to read natural dims

    const containerW = ytCropContainer.offsetWidth; // 600
    const containerH = ytCropContainer.offsetHeight; // 400
    const imgW = ytCropImage.naturalWidth;
    const imgH = ytCropImage.naturalHeight;

    // Fixed Crop Box (Square 300x300 for example, or based on height)
    // Use 320x320 centered
    const boxSize = 320;

    // Center Crop Box
    const boxX = (containerW - boxSize) / 2;
    const boxY = (containerH - boxSize) / 2;

    ytCropBox.style.width = boxSize + 'px';
    ytCropBox.style.height = boxSize + 'px';
    ytCropBox.style.left = boxX + 'px';
    ytCropBox.style.top = boxY + 'px';
    ytCropBox.style.borderRadius = '0';

    // Min Scale: Image must cover the box area
    // Scale = BoxDim / ImageDim
    // We need max of (BoxW/ImgW, BoxH/ImgH) to ensure coverage
    ytBaseScale = Math.max(boxSize / imgW, boxSize / imgH);

    // Set Limits
    ytMinScale = ytBaseScale;
    ytMaxScale = ytBaseScale * 4; // allow 4x zoom

    // Initial State: Centered at Min Scale
    ytImageScale = ytMinScale;

    // imageX so image center aligns with box center
    // Image Center = (imgW * scale) / 2
    // Box Center = boxX + boxSize/2 (relative to container)
    // We want image left edge (imageX) such that center aligns

    // Easier: Center image in CropBox
    // CropBox Center X = boxX + boxSize/2
    // Image Center X = imageX + (imgW*scale)/2
    // eqn: boxX + boxSize/2 = imageX + (imgW*scale)/2
    // imageX = boxX + boxSize/2 - (imgW*scale)/2

    ytImageX = (boxX + boxSize / 2) - (imgW * ytImageScale) / 2;
    ytImageY = (boxY + boxSize / 2) - (imgH * ytImageScale) / 2;

    // Reset Slider
    const zoomRange = document.getElementById('zoomRange');
    if (zoomRange) {
        zoomRange.min = 1;
        zoomRange.max = 4; // 1x to 4x relative to base
        zoomRange.step = 0.1;
        zoomRange.value = 1;
    }

    updateImageTransform();
}

function updateImageTransform() {
    ytCropImage.style.transform = `translate(${ytImageX}px, ${ytImageY}px) scale(${ytImageScale})`;
}

// Set Zoom with Constraints
function setZoom(newScale) {
    // 1. Clamp Scale
    let clamped = Math.max(ytMinScale, Math.min(newScale, ytMaxScale));

    // 2. Adjust X/Y to Zoom towards Center (optional but better)
    // Simple approach: just scale, but keep center relative to viewport?
    // Let's just update scale for now, and re-clamp position if needed.
    // Ideally zoom into center of CropBox.

    // Center of CropBox relative to Image TopLeft (current)
    // cx = (boxCenter - imageX) / oldScale
    // newImageX = boxCenter - cx * newScale

    // Let's use simpler logic: maintain center point
    const containerW = ytCropContainer.offsetWidth; // 600
    const containerH = ytCropContainer.offsetHeight; // 400
    const boxSize = 320;
    const boxX = (containerW - boxSize) / 2;
    const boxY = (containerH - boxSize) / 2;
    const centerX = boxX + boxSize / 2;
    const centerY = boxY + boxSize / 2;

    const oldScale = ytImageScale;
    const newS = clamped;

    const dx = (centerX - ytImageX) / oldScale;
    const dy = (centerY - ytImageY) / oldScale;

    ytImageX = centerX - dx * newS;
    ytImageY = centerY - dy * newS;
    ytImageScale = newS;

    checkBounds();
    updateImageTransform();
}

function checkBounds() {
    const containerW = ytCropContainer.offsetWidth;
    const containerH = ytCropContainer.offsetHeight;
    const boxSize = 320;
    const boxX = (containerW - boxSize) / 2;
    const boxY = (containerH - boxSize) / 2;

    const imgW = ytCropImage.naturalWidth * ytImageScale;
    const imgH = ytCropImage.naturalHeight * ytImageScale;

    // Boundary Validation
    // The image must cover the box area fully.
    // So imageLeft <= boxLeft AND imageRight >= boxRight
    // ytImageX <= boxX
    // ytImageX + imgW >= boxX + boxSize

    if (ytImageX > boxX) ytImageX = boxX;
    if (ytImageX + imgW < boxX + boxSize) ytImageX = (boxX + boxSize) - imgW;

    if (ytImageY > boxY) ytImageY = boxY;
    if (ytImageY + imgH < boxY + boxSize) ytImageY = (boxY + boxSize) - imgH;
}

// DRAG EVENTS
function startDrag(e) {
    e.preventDefault();
    ytIsDragging = true;
    ytDragStartX = e.clientX - ytImageX;
    ytDragStartY = e.clientY - ytImageY;

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
}

function onDrag(e) {
    if (!ytIsDragging) return;
    e.preventDefault();
    ytImageX = e.clientX - ytDragStartX;
    ytImageY = e.clientY - ytDragStartY;

    checkBounds();
    updateImageTransform();
}

function stopDrag() {
    ytIsDragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
}

function handleZoom(e) {
    e.preventDefault();
    const delta = Math.sign(e.deltaY) * -0.2; // Speed
    const newScale = ytImageScale + delta;
    setZoom(newScale);

    // Update slider
    const zoomRange = document.getElementById('zoomRange');
    if (zoomRange) {
        zoomRange.value = newScale / ytBaseScale;
    }
}

function saveCrop() {
    // 1. Create Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const outputSize = 1080;
    canvas.width = outputSize;
    canvas.height = outputSize;

    // 2. Draw Image portion
    // We need source coordinates.
    // cropBox relative to Image TopLeft = (Box - Image) / scale

    const containerW = ytCropContainer.offsetWidth; // 600
    const containerH = ytCropContainer.offsetHeight; // 400
    const boxSize = 320;
    const boxX = (containerW - boxSize) / 2;
    const boxY = (containerH - boxSize) / 2;

    const sourceX = (boxX - ytImageX) / ytImageScale;
    const sourceY = (boxY - ytImageY) / ytImageScale;
    const sourceSize = boxSize / ytImageScale;

    ctx.drawImage(ytCropImage, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);

    // 3. Export
    canvas.toBlob(async (blob) => {
        currentCropBlob = blob;

        // Update Preview
        const previewUrl = URL.createObjectURL(blob);

        // Determine Target
        if (activeCropMode === 'square') {
            // New Upload logic or legacy logic?
            // "New Upload" logic in this file?
            const preview = document.getElementById('cover-preview-img');
            const placeholder = document.getElementById('cover-placeholder');
            const dropzone = document.getElementById('cover-dropzone');

            if (preview && placeholder && dropzone) {
                preview.src = previewUrl;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
                dropzone.classList.add('has-file');
            }

            // Also update legacy/Beats.html if present
            const beatCover = document.getElementById('coverPreview');
            const beatDrop = document.getElementById('coverDropZone');
            if (beatCover) {
                beatCover.src = previewUrl;
                beatCover.style.display = 'block';
                // Hide placeholder inside Beats.html
                const beatPlaceholder = document.getElementById('coverPlaceholder');
                if (beatPlaceholder) beatPlaceholder.style.display = 'none';
            }
            // Set global file blobs if we represent form data here?
            // In Beats.html we rely on global `formData`
            if (typeof formData !== 'undefined') {
                formData.coverBlob = blob;
            }
        }

        // Handle UI Updates based on where we came from
        const ytUploadForm = document.getElementById('yt-upload-form');

        // CASE A: UPLOAD FLOW (Generate TunesToTube Style Video Frame for YouTube.html)
        if (ytUploadForm && ytUploadForm.style.display === 'block') {
            // 2. GENERATE 16:9 VIDEO FRAME
            const videoCanvas = document.createElement('canvas');
            const vCtx = videoCanvas.getContext('2d');
            videoCanvas.width = 1920;
            videoCanvas.height = 1080;

            // A. Draw Blurred Background
            vCtx.filter = 'blur(40px) brightness(40%)';
            vCtx.drawImage(canvas, 0, 0, 1920, 1080); // Use 'canvas' here
            vCtx.filter = 'none'; // Reset filter

            // B. Draw Sharp Centered Art
            const artSize = 850;
            const artX = (1920 - artSize) / 2;
            const artY = (1080 - artSize) / 2;

            // Shadow for depth
            vCtx.shadowColor = "rgba(0, 0, 0, 0.5)";
            vCtx.shadowBlur = 50;
            vCtx.shadowOffsetX = 0;
            vCtx.shadowOffsetY = 20;

            vCtx.drawImage(canvas, artX, artY, artSize, artSize); // Use 'canvas' here

            // Export Video Frame Blob
            const videoFrameBlob = await new Promise(resolve => videoCanvas.toBlob(resolve, 'image/jpeg', 0.9));

            // Update Preview Image
            const prevBg = document.getElementById('yt-preview-bg');
            if (prevBg) {
                prevBg.src = URL.createObjectURL(videoFrameBlob);
                prevBg.style.opacity = '1';
            }

            // Update Dropzone State
            const coverZone = document.getElementById('coverDropZone');
            const coverPreview = document.getElementById('cropImagePreview');

            if (coverZone && coverPreview) {
                coverPreview.src = URL.createObjectURL(currentCropBlob);
                coverZone.classList.add('has-file');
            } else {
                const zone = document.getElementById('image-dropzone');
                if (zone) {
                    zone.classList.add('has-file');
                    zone.querySelector('h3').innerText = "Portada Recortada";
                    zone.querySelector('p').innerText = "Listo para generación de video";
                }
            }

        }
        // CASE B: IMPORT FLOW (Just Square Thumb)
        else {
            const preview = document.getElementById('yt-imported-thumb');
            if (preview) {
                preview.src = URL.createObjectURL(currentCropBlob);
                preview.style.display = 'block';
            }
            // if (window.showToast) window.showToast('Portada recortada guardada', 'success'); // REMOVED PER USER REQUEST
        }

        // Upload to Drafts (Background)
        // if (typeof uploadFileToDrafts === 'function') {
        //     uploadFileToDrafts(currentCropBlob, 'cover');
        // }
        // ðŸ”¥ AUTO-UPLOAD DISABLED. Staged in formData above.

        closeCropModal();

    }, 'image/jpeg', 0.95);
}

// PSYCHOLOGICAL PROGRESS BAR LOGIC
let progressInterval;

// ========================================
// 8. IMPORT FLOW FILE HANDLING (New)
// ========================================
let importFiles = { mp3: null, wav: null, stems: null };

function handleImportFileSelect(input, type) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        importFiles[type] = file;

        // UI Update
        const slot = document.getElementById(`import-slot-${type}`);
        if (slot) {
            slot.classList.add('has-file');

            // Update Icon
            const iconDiv = slot.querySelector('.slot-icon');
            if (iconDiv) iconDiv.innerHTML = '<i class="bi bi-check-lg"></i>';

            // Update Text
            const h4 = slot.querySelector('.slot-info h4');
            if (h4) h4.innerText = file.name;

            const p = slot.querySelector('.slot-info p');
            if (p) p.innerText = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

            // Update Badge
            const badge = slot.querySelector('.status-badge');
            if (badge) {
                badge.className = 'status-badge success';
                badge.innerText = 'Listo'; // Staged
            }

            // Update Button
            const btn = slot.querySelector('.btn-mini-upload');
            if (btn) {
                btn.innerHTML = 'Cambiar <i class="bi bi-arrow-repeat"></i>';
            }
        }
    }
}

// Ensure global access
window.handleImportFileSelect = handleImportFileSelect;

// UPDATE processAndUpload GUEST LOGIC for IMPORTER
// ... inside processAndUpload() ...
// We need to verify if we are in Importer Mode and capture these flags.

// (The full processAndUpload replacement is needed to integrate this cleanly)
// Re-inserting the previous processAndUpload logic but with the new import checks added.

// ========================================
// 9. VIDEO PREVIEW SIMULATION (Audio + Visual)
// ========================================
let audioPreview = new Audio();
let isPreviewPlaying = false;

// Global handler for Audio Selection (Manual)
window.handleAudioSelect = function (input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        window.selectedAudioFile = file; // Persist for upload

        // Update UI
        const zone = document.getElementById('audio-dropzone');
        const nameDisplay = document.getElementById('audio-filename');
        if (zone) zone.classList.add('has-file');
        if (nameDisplay) nameDisplay.innerText = file.name;

        // Set Preview Source
        const objectUrl = URL.createObjectURL(file);
        audioPreview.src = objectUrl;

        // Reset Play State
        audioPreview.pause();
        isPreviewPlaying = false;
        updatePreviewIcon(false);

        if (window.showToast) window.showToast('Audio cargado para previsualización', 'success');

        // ðŸ”¥ STAGE FOR UPLOAD (Beats.html)
        if (typeof formData !== 'undefined') {
            formData.files.mp3_tagged = file;
        }

        // Upload to Drafts - DISABLED
        // uploadFileToDrafts(file, 'mp3');
    }
}

// Handler for Play Button
window.togglePreviewPlay = function () {
    if (!audioPreview.src || audioPreview.src === '') {
        if (window.showToast) window.showToast('Sube un audio primero para escuchar la previa', 'error');
        return;
    }

    if (isPreviewPlaying) {
        audioPreview.pause();
        isPreviewPlaying = false;
        updatePreviewIcon(false);
    } else {
        audioPreview.play().then(() => {
            isPreviewPlaying = true;
            updatePreviewIcon(true);
        }).catch(err => {
            console.error("Play error:", err);
        });
    }
}

function updatePreviewIcon(isPlaying) {
    const icon = document.querySelector('.yt-play-overlay i');
    if (icon) {
        icon.className = isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
    }
}

// Auto-reset on end
audioPreview.addEventListener('ended', () => {
    isPreviewPlaying = false;
    updatePreviewIcon(false);
});

// ========================================
// 10. DRAFT UPLOAD LOGIC
// ========================================
let uploadedDraftPaths = {
    cover: null,
    mp3_tagged: null,
    wav_untagged: null,
    stems: null
};

// 🔥 REMOVED AUTO-UPLOAD FUNCTIONALITY PER USER REQUEST
// Files are now only staged in formData and uploaded on "Save" or "Publish".
async function uploadFileToDrafts(file, type) {
    console.log("🔥 Auto-upload disabled. File staged for manual save:", type);
    return null;
}

function updateSlotStatus(type, status) {
    const slot = document.getElementById(`import-slot-${type}`);
    if (!slot) return;
    const badge = slot.querySelector('.status-badge');
    if (!badge) return;

    if (status === 'uploading') {
        badge.className = 'status-badge warning';
        badge.innerText = 'Subiendo...';
    } else if (status === 'success') {
        badge.className = 'status-badge success';
        badge.innerText = 'Listo';
    } else if (status === 'error') {
        badge.className = 'status-badge error';
        badge.innerText = 'Error';
    }
}

// Hook into Importer MP3 Select too
// (Redefine to include upload)
const originalImportHandler = window.handleImportFileSelect; // Keep original reference
window.handleImportFileSelect = function (input, type) {
    // 1. Original Logic (UI Updates)
    if (originalImportHandler) originalImportHandler(input, type);

    if (input.files && input.files[0]) {
        const file = input.files[0];

        // 2. Preview Logic
        if (type === 'mp3') {
            const objectUrl = URL.createObjectURL(file);
            audioPreview.src = objectUrl;
            audioPreview.pause();
            isPreviewPlaying = false;
            updatePreviewIcon(false);
        }

        // 3. Stage for Upload (Sync with Beats.html formData)
        if (typeof formData !== 'undefined') {
            if (type === 'mp3') formData.files.mp3_tagged = file;
            else if (type === 'wav') formData.files.wav_untagged = file;
            else if (type === 'stems') formData.files.stems = file;
        }

        // uploadFileToDrafts(file, type); // 🔥 DISABLED
    }
}

/* ========================================
   11. PROCESS & UPLOAD (FINAL STEP)
   ======================================== */
async function processAndUpload() {
    // Determine Mode
    const isManual = document.getElementById('yt-upload-form').style.display === 'block';

    // Gather Data
    const title = isManual ? document.getElementById('upload-title').value : document.getElementById('import-title').value;
    const description = isManual ? document.getElementById('upload-desc').value : document.getElementById('import-desc').value;
    const bpm = isManual ? document.querySelector('input[name="bpm"]')?.value : document.getElementById('import-bpm').value;
    const key = isManual ? document.querySelector('input[name="key"]')?.value : document.getElementById('import-key').value;
    const tags = document.getElementById('final-tags-input')?.value || '';

    // Validation
    if (!title) {
        if (window.showToast) window.showToast('Falta el título', 'error');
        return;
    }

    // Auth Check
    const token = window.AuthUtils ? window.AuthUtils.getAccessToken() : null;
    const user = window.AuthUtils ? window.AuthUtils.getCurrentUser() : null;

    // GUEST LOGIC (Preserved)
    if (!token || !user) {
        const pendingData = {
            mode: isManual ? 'manual' : 'importer',
            title: title,
            description: description,
            bpm: bpm,
            key: key,
            tags: tags,
            timestamp: Date.now()
        };
        localStorage.setItem('pendingUpload', JSON.stringify(pendingData));

        // SHOW GLOBAL MODAL
        if (window.showGuestModal) {
            window.showGuestModal(
                "Guarda tu Progreso",
                "Para continuar y vincular este contenido a tu perfil, necesitas iniciar sesión o registrarte."
            );
        } else {
            // Fallback
            if (confirm("🚀 ¡Estás a un paso!\n\nPara vincular este contenido a tu perfil, necesitas una cuenta gratis.\n\nTe llevaremos a Registro.")) {
                window.location.href = '/pages/register.html';
            }
        }
        return;
    }

    // LOGGED IN LOGIC: Create Draft & Redirect
    try {
        // Show Overlay
        const overlay = document.getElementById('publishOverlay');
        if (overlay) overlay.style.display = 'flex';

        // Prepare File Data for DB
        // We use 'uploadedDraftPaths' which has keys: cover, mp3_tagged, etc.
        // If Manual, we might assume uploadedDraftPaths was populated by handleAudioSelect
        // But what if user selected file BEFORE login? (Not possible as we check auth in uploadFileToDrafts)
        // If logged in, files should show "Subido" (Success)

        // Wait, manual audio input triggers 'mp3' upload?
        // Yes, I verified handleAudioSelect calls uploadFileToDrafts(..., 'mp3')

        const draftData = {
            user_id: user.id,
            title: title,
            description: description,
            bpm: bpm || null,
            key: key || null,
            tags: tags ? tags.split(',').map(t => t.trim()) : [],
            files_data: uploadedDraftPaths, // The JSON object with paths
            // Legacy columns (optional but good for compatibility)
            cover_url: uploadedDraftPaths.cover,
            mp3_url: uploadedDraftPaths.mp3_tagged,
            wav_url: uploadedDraftPaths.wav_untagged,
            stems_url: uploadedDraftPaths.stems,
            source: 'youtube_importer',
            created_at: new Date().toISOString()
        };

        const { data, error } = await window.supabaseClient
            .from('beat_drafts')
            .insert(draftData)
            .select('id')
            .single();

        if (error) throw error;

        // Success: Wait briefly then redirect to My Kits
        setTimeout(() => {
            window.location.href = '/cuenta/mis-kits.html';
        }, 1500);

    } catch (err) {
        console.error('Draft Creation Error:', err);
        const overlay = document.getElementById('publishOverlay');
        if (overlay) overlay.style.display = 'none'; // Hide on error
        if (window.showToast) window.showToast('Error al crear borrador: ' + err.message, 'error');
    }
}


// 7. GUEST RESTORE LOGIC
window.addEventListener('load', () => {
    // Check for pending upload data
    const pendingJson = localStorage.getItem('pendingUpload');
    if (pendingJson) {
        // Check if user is now logged in
        // A slight delay to ensure AuthUtils has init (it runs immediately but async check might take a tick)
        setTimeout(() => {
            const token = window.AuthUtils ? window.AuthUtils.getAccessToken() : null;
            if (token) {
                try {
                    const data = JSON.parse(pendingJson);

                    // Restore Fields
                    if (document.getElementById('upload-title')) document.getElementById('upload-title').value = data.title || '';
                    if (document.getElementById('upload-desc')) document.getElementById('upload-desc').value = data.description || '';
                    if (document.getElementById('upload-schedule-time')) document.getElementById('upload-schedule-time').value = data.scheduleTime || '';

                    // Restore Import Fields if they exist
                    if (document.getElementById('import-bpm')) document.getElementById('import-bpm').value = data.bpm || '';
                    if (document.getElementById('import-key')) document.getElementById('import-key').value = data.key || '';
                    if (document.getElementById('final-tags-input')) document.getElementById('final-tags-input').value = data.tags || '';

                    // Notify
                    if (window.showToast) window.showToast('✅ Datos de subida restaurados. Por favor, selecciona tus archivos nuevamente.', 'success'); // Files cant be restored

                    // Clear storage so it doesn't persist forever
                    localStorage.removeItem('pendingUpload');

                    // If we are in the main view, maybe we should switch to upload form automatically?
                    // But usually user land here. If they land on 'youtube.html' directly, we are good.
                    // If they land on dashboard, they need to navigate here. 
                    // Ideally, we redirect them HERE after login if this flag exists, but that's complex logic outside this file.
                    // For now, if they are ON this page, it restores.

                    // Auto-show upload form if data existed (assuming manual upload was the context)
                    if (data.title && showUploadForm) {
                        showUploadForm();
                    }

                } catch (e) {
                    console.error("Error restoring pending upload", e);
                }
            }
        }, 1000); // Wait 1s for Auth init
    }
});

// ========================================
// 6. GLOBAL EXPOSURE
// ========================================
window.handleImportClick = handleImportClick;
window.closeImporterModal = closeImporterModal;
window.redirectToUpload = redirectToUpload;
window.selectVideo = selectVideo;
window.resetToHub = resetToHub;
window.openCropModalForThumb = openCropModalForThumb;
window.closeCropModal = closeCropModal;
window.zoomCrop = window.zoomCrop;
window.showUploadForm = showUploadForm;
window.handleAudioSelect = handleAudioSelect;
window.handleImageSelect = handleImageSelect;
window.processAndUpload = processAndUpload;

// Auto-load GSI and GAPI
const gapiScript = document.createElement('script');
gapiScript.src = "https://apis.google.com/js/api.js";
gapiScript.onload = gapiLoaded;
document.head.appendChild(gapiScript);

const gsiScript = document.createElement('script');
gsiScript.src = "https://accounts.google.com/gsi/client";
gsiScript.onload = gisLoaded;
document.head.appendChild(gsiScript);

// ========================================
// 6. REDIRECT LOGIC
// ========================================

// Consolidated duplicate removed

