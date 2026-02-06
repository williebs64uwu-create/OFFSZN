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

// ðŸ”¥ HUB NAVIGATION HELPERS
function resetToHub() {
    document.getElementById('yt-hub-selection').style.display = 'grid';
    document.getElementById('yt-main-form').style.display = 'none';

    // Clear form
    document.getElementById('yt-product-type').value = 'beat';
    document.querySelector('input[name="title"]').value = '';
    document.querySelector('textarea[name="description"]').value = '';
}

// SHOW FORM AFTER SELECTION
function showForm() {
    document.getElementById('yt-hub-selection').style.display = 'none';
    document.getElementById('yt-main-form').style.display = 'block';
}

let isFetching = false; // Global flag to prevent race conditions

async function listUserVideos(pageToken = '') {
    if (isFetching) return; // Prevent duplicate calls
    isFetching = true;

    showImporterModal();
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
    div.onclick = () => selectVideo(videoId, title, snippet.description, snippet.thumbnails);
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
    if (thumbImg) {
        thumbImg.style.display = 'block';
        thumbImg.src = thumbUrl;
        // ENABLE CORS FOR CANVAS
        thumbImg.crossOrigin = "Anonymous";

        // Hide placeholder elements safely
        const container = document.getElementById('yt-thumb-preview-container');
        if (container) {
            const placeholder = container.querySelector('.yt-thumb-placeholder');
            const overlay = document.querySelector('.yt-edit-thumb-btn')?.parentElement; // The overlay is the parent of the button

            if (placeholder) placeholder.style.display = 'none';
            // In the new layout, the button is absolute positioned, so we just ensure it's visible if needed, 
            // but the container having 'has-file' class might be enough or we show the button directly.
            // The HTML structure shows the button is always there but maybe hidden?
            // Actually, in the new HTML:
            // <div class="yt-thumb-placeholder" style="display:none;">...</div>
            // <button ... class="yt-edit-thumb-btn"> ... </button>
            // The button is effectively the overlay action.

            // Let's just ensure the button is visible or the container state is correct.
            container.classList.add('has-file');
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
    const titleInput = document.querySelector('input[name="title"]');
    const descInput = document.querySelector('textarea[name="description"]');
    const bpmInput = document.querySelector('input[name="bpm"]');
    const keyInput = document.querySelector('input[name="key"]');

    if (titleInput) {
        titleInput.value = cleanTitle;
        updateTitleCount(titleInput);
    }
    if (descInput) {
        descInput.value = description;
        updateDescCount(descInput);
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
                    if (selectedTags.includes(tag)) {
                        selectedTags = selectedTags.filter(t => t !== tag);
                        chip.classList.remove('selected');
                    } else {
                        selectedTags.push(tag);
                        chip.classList.add('selected');
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
    }

    if (window.showToast) window.showToast('¡Datos importados con éxito!', 'success');
    closeImporterModal();
}

function detectMetadata(title, description) {
    // 1. Clean Title
    const cleanTitle = title.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim();
    const searchText = `${title} ${description}`;

    let foundBpms = [];
    let foundKeys = [];

    // HELPER: Add unique valid BPM
    const addBpm = (val) => {
        if (val >= 50 && val <= 250) foundBpms.push(val);
    };

    // STRATEGY 1: Contextual Search (Key - BPM or BPM - Key)
    // Looking for patterns like "F# minor - 120" or "120 - F# minor"
    // Separators: " - ", " ", "/", "|"
    const notePart = "(?:[A-G][#b]?\\s*(?:maj|major|min|minor|m))";
    const bpmPart = "(\\d{2,3})";

    // Regex 1: "Key - 120"
    const keyThenBpm = new RegExp(`${notePart}[\\s\\-\\u2013\\u2014|/]+${bpmPart}(?!\\d)`, 'gi');
    let match;
    while ((match = keyThenBpm.exec(searchText)) !== null) {
        addBpm(parseInt(match[1], 10));
    }

    // Regex 2: "120 - Key"
    const bpmThenKey = new RegExp(`(?:^|\\s)${bpmPart}[\\s\\-\\u2013\\u2014|/]+${notePart}`, 'gi');
    while ((match = bpmThenKey.exec(searchText)) !== null) {
        addBpm(parseInt(match[1], 10));
    }

    // STRATEGY 2: Explicit Label "120 BPM"
    const labeledBpmRegex = /(\d{2,3})\s*BPM/gi;
    while ((match = labeledBpmRegex.exec(searchText)) !== null) {
        addBpm(parseInt(match[1], 10));
    }

    // STRATEGY 3: Naked Numbers (Fallback)
    // If we haven't found any high-confidence BPMs yet, OR if the user wants us to be permissive:
    // User request: "si ya falla todas... solo buscar numeros"
    if (foundBpms.length === 0) {
        // Find all standalone 2-3 digit numbers
        const nakedRegex = /\b(\d{2,3})\b/g;
        while ((match = nakedRegex.exec(searchText)) !== null) {
            addBpm(parseInt(match[1], 10));
        }
    }

    // Process Keys (Same strict logic)
    const noteFragment = "([A-G])(#|b)?";
    const scaleFragment = "\\s*(maj|major|min|minor|m)";
    const keyRegex = new RegExp(`\\b${noteFragment}${scaleFragment}\\b`, 'gi');

    while ((match = keyRegex.exec(searchText)) !== null) {
        let note = match[1].toUpperCase();
        let acc = match[2] || '';
        let type = match[3].toLowerCase();

        if (type === 'm' || type === 'min') type = 'minor';
        if (type === 'maj') type = 'major';

        foundKeys.push(`${note}${acc} ${type}`);
    }

    // Deduplicate
    const uniqueBpms = [...new Set(foundBpms)];
    const uniqueKeys = [...new Set(foundKeys)];

    return { uniqueBpms, uniqueKeys };
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
let cropImage, cropBox, cropContainer;
let imageScale = 1, imageX = 0, imageY = 0;
let isDragging = false, dragStartX = 0, dragStartY = 0;
let baseScale = 1;
let currentCropBlob = null; // Stores the final cropped image
let activeCropMode = 'square'; // 'square' (Thumbnail) or 'wide' (Video BG)

let selectedAudioFile = null;
let selectedImageFile = null;

document.addEventListener('DOMContentLoaded', () => {
    cropImage = document.getElementById('cropImage');
    cropBox = document.getElementById('cropBox');
    cropContainer = document.getElementById('cropContainer');

    // Initialize cropper events if elements exist
    if (cropContainer) {
        cropContainer.addEventListener('mousedown', startDrag);
        // Map wheel to zoom safely
        cropContainer.addEventListener('wheel', handleZoom, { passive: false });
    }

    // Zoom Slider
    const zoomRange = document.getElementById('zoomRange');
    if (zoomRange) {
        zoomRange.addEventListener('input', (e) => {
            const zoomValue = parseFloat(e.target.value); // 1 to 3
            // Convert slider 1..3 to actual scale
            setZoom(zoomValue * baseScale);
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
        }
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
        cropImage.src = e.target.result;
        // Wait for image to load naturally
        cropImage.onload = () => initializeCrop();
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
    cropImage.crossOrigin = 'Anonymous';
    if (rawThumb.src.startsWith('blob:')) {
        cropImage.src = rawThumb.src;
    } else {
        cropImage.src = rawThumb.src + (rawThumb.src.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
    }

    cropImage.onload = () => {
        initializeCrop();
    };
}

function closeCropModal() {
    document.getElementById('cropModal').classList.remove('active');
}

// CROPPER LOGIC (Improved)

let minScale = 1;
let maxScale = 3;

function initializeCrop() {
    cropImage.style.transform = 'none'; // Reset to read natural dims

    const containerW = cropContainer.offsetWidth; // 600
    const containerH = cropContainer.offsetHeight; // 400
    const imgW = cropImage.naturalWidth;
    const imgH = cropImage.naturalHeight;

    // Fixed Crop Box (Square 300x300 for example, or based on height)
    // Use 320x320 centered
    const boxSize = 320;

    // Center Crop Box
    const boxX = (containerW - boxSize) / 2;
    const boxY = (containerH - boxSize) / 2;

    cropBox.style.width = boxSize + 'px';
    cropBox.style.height = boxSize + 'px';
    cropBox.style.left = boxX + 'px';
    cropBox.style.top = boxY + 'px';
    cropBox.style.borderRadius = '0';

    // Min Scale: Image must cover the box area
    // Scale = BoxDim / ImageDim
    // We need max of (BoxW/ImgW, BoxH/ImgH) to ensure coverage
    baseScale = Math.max(boxSize / imgW, boxSize / imgH);

    // Set Limits
    minScale = baseScale;
    maxScale = baseScale * 4; // allow 4x zoom

    // Initial State: Centered at Min Scale
    imageScale = minScale;

    // imageX so image center aligns with box center
    // Image Center = (imgW * scale) / 2
    // Box Center = boxX + boxSize/2 (relative to container)
    // We want image left edge (imageX) such that center aligns

    // Easier: Center image in CropBox
    // CropBox Center X = boxX + boxSize/2
    // Image Center X = imageX + (imgW*scale)/2
    // eqn: boxX + boxSize/2 = imageX + (imgW*scale)/2
    // imageX = boxX + boxSize/2 - (imgW*scale)/2

    imageX = (boxX + boxSize / 2) - (imgW * imageScale) / 2;
    imageY = (boxY + boxSize / 2) - (imgH * imageScale) / 2;

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
    cropImage.style.transform = `translate(${imageX}px, ${imageY}px) scale(${imageScale})`;
}

// Set Zoom with Constraints
function setZoom(newScale) {
    // 1. Clamp Scale
    if (newScale < minScale) newScale = minScale;
    if (newScale > maxScale) newScale = maxScale;

    // 2. Adjust Position to Keep Centered (Zoom towards center of crop box)
    // Simple approach: When zooming, we keep the center point of the current view fixed? 
    // Or just re-constrain.

    const oldScale = imageScale;
    imageScale = newScale;

    // Re-Constrain Position (Keep image covering crop box)
    constrainImagePosition();
    updateImageTransform();
}

function handleZoom(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;

    // Calculate new relative zoom factor for slider
    // Current Factor = imageScale / baseScale
    let currentFactor = imageScale / baseScale;
    let newFactor = currentFactor + delta;

    // Update Slider
    const zoomRange = document.getElementById('zoomRange');
    if (zoomRange) {
        zoomRange.value = newFactor;
        // Trigger input event to update everything
        zoomRange.dispatchEvent(new Event('input'));
    }
}

function startDrag(e) {
    isDragging = true;
    dragStartX = e.clientX - imageX;
    dragStartY = e.clientY - imageY;
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
}

function onDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    imageX = e.clientX - dragStartX;
    imageY = e.clientY - dragStartY;

    constrainImagePosition();
    updateImageTransform();
}

function constrainImagePosition() {
    const boxRect = cropBox.getBoundingClientRect();
    const containerRect = cropContainer.getBoundingClientRect(); // 0,0 relative to itself

    // Crop Box Position relative to container
    const boxL = parseFloat(cropBox.style.left);
    const boxT = parseFloat(cropBox.style.top);
    const boxR = boxL + parseFloat(cropBox.style.width);
    const boxB = boxT + parseFloat(cropBox.style.height);

    const imgW = cropImage.naturalWidth * imageScale;
    const imgH = cropImage.naturalHeight * imageScale;

    // Constraints:
    // Image Left (imageX) must be <= Box Left (boxL) -> otherwise gap on left
    // Image Right (imageX + imgW) must be >= Box Right (boxR) -> otherwise gap on right

    if (imageX > boxL) imageX = boxL;
    if (imageX + imgW < boxR) imageX = boxR - imgW;

    if (imageY > boxT) imageY = boxT;
    if (imageY + imgH < boxB) imageY = boxB - imgH;
}

function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
}

// Legacy zoom support (optional, can be removed if specific handlers work)
window.zoomCrop = function (delta) {
    // No-op or map to new logic if needed
};



async function saveCrop() {
    // 1. GENERATE SQUARE CROP (For Use as Cover Art)
    const squareCanvas = document.createElement('canvas');
    const squareCtx = squareCanvas.getContext('2d');
    squareCanvas.width = 1080;
    squareCanvas.height = 1080;

    // Get Image Data for Crop
    const boxRect = cropBox.getBoundingClientRect();
    const containerRect = cropContainer.getBoundingClientRect();
    const cropLeft = cropBox.offsetLeft;
    const cropTop = cropBox.offsetTop;
    const relX = cropLeft - imageX;
    const relY = cropTop - imageY;
    const boxW = parseFloat(cropBox.style.width);
    const boxH = parseFloat(cropBox.style.height);
    const sourceX = relX / imageScale;
    const sourceY = relY / imageScale;
    const sourceW = boxW / imageScale;
    const sourceH = boxH / imageScale;

    // Draw Final Square
    squareCtx.drawImage(cropImage, sourceX, sourceY, sourceW, sourceH, 0, 0, 1080, 1080);

    // Save Square Blob
    currentCropBlob = await new Promise(resolve => squareCanvas.toBlob(resolve, 'image/jpeg', 0.95));

    // Handle UI Updates based on where we came from

    // CASE A: UPLOAD FLOW (Generate TunesToTube Style Video Frame)
    if (document.getElementById('yt-upload-form').style.display === 'block') {
        // 2. GENERATE 16:9 VIDEO FRAME
        const videoCanvas = document.createElement('canvas');
        const vCtx = videoCanvas.getContext('2d');
        videoCanvas.width = 1920;
        videoCanvas.height = 1080;

        // A. Draw Blurred Background
        // We stretch the square image to cover 16:9 and blur it
        vCtx.filter = 'blur(40px) brightness(40%)';
        // We draw the square canvas into the video canvas, scaled to cover.
        // To cover 1920x1080 with 1080x1080 source, we scale width by 1920/1080 = 1.77
        // Or just stretch it. For abstract background, stretching is fine/common.
        vCtx.drawImage(squareCanvas, 0, 0, 1920, 1080);
        vCtx.filter = 'none'; // Reset filter

        // B. Draw Sharp Centered Art
        // Target size: Let's say 850x850 pixels in the center (approx 80% height)
        const artSize = 850;
        const artX = (1920 - artSize) / 2;
        const artY = (1080 - artSize) / 2;

        // Shadow for depth
        vCtx.shadowColor = "rgba(0, 0, 0, 0.5)";
        vCtx.shadowBlur = 50;
        vCtx.shadowOffsetX = 0;
        vCtx.shadowOffsetY = 20;

        vCtx.drawImage(squareCanvas, artX, artY, artSize, artSize);

        // Export Video Frame Blob
        const videoFrameBlob = await new Promise(resolve => videoCanvas.toBlob(resolve, 'image/jpeg', 0.9));

        // Update Preview Image
        const prevBg = document.getElementById('yt-preview-bg');
        if (prevBg) {
            prevBg.src = URL.createObjectURL(videoFrameBlob);
            prevBg.style.opacity = '1'; // Remove opacity to show full image
        }

        // Update Dropzone State (New Rules)
        const coverZone = document.getElementById('coverDropZone');
        const coverPreview = document.getElementById('cropImagePreview');

        if (coverZone && coverPreview) {
            coverPreview.src = URL.createObjectURL(currentCropBlob);
            coverZone.classList.add('has-file');
        } else {
            // Fallback for safety
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
        if (window.showToast) window.showToast('Portada recortada guardada', 'success');
    }

    // Upload to Drafts (Background)
    uploadFileToDrafts(currentCropBlob, 'cover');

    // Close
    closeCropModal();
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
                badge.innerText = 'Listo';
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

        // Upload to Drafts
        uploadFileToDrafts(file, 'mp3');
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

async function uploadFileToDrafts(file, type) {
    const user = window.AuthUtils ? window.AuthUtils.getCurrentUser() : null;
    if (!user) return null; // Guest: Local only

    // Verify Size
    const mb = 1024 * 1024;
    let max = 50 * mb; // Default MP3/WAV/STEMS (Unified to 50 as per request)
    if (type === 'cover') max = 10 * mb;

    if (file.size > max) {
        if (window.showToast) window.showToast(`El archivo excede el límite de ${(max / mb).toFixed(0)}MB`, 'error');
        if (type !== 'cover') updateSlotStatus(type, 'error');
        return null;
    }

    let folder = '';
    if (type === 'mp3') folder = 'mp3_tagged';
    else if (type === 'wav') folder = 'wav_untagged';
    else if (type === 'stems') folder = 'stems';
    else if (type === 'cover') folder = 'covers';
    else return null;

    // Sanitize
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${user.id}/${folder}/${Date.now()}_${cleanName}`;

    // UI Update (Slots)
    if (type !== 'cover') updateSlotStatus(type, 'uploading');

    try {
        const { data, error } = await window.supabaseClient.storage
            .from('beat-drafts')
            .upload(path, file, { cacheControl: '3600', upsert: false });

        if (error) throw error;

        // Store Path
        if (type === 'mp3') uploadedDraftPaths.mp3_tagged = data.path;
        else if (type === 'wav') uploadedDraftPaths.wav_untagged = data.path;
        else if (type === 'stems') uploadedDraftPaths.stems = data.path;
        else if (type === 'cover') uploadedDraftPaths.cover = data.path;

        if (type !== 'cover') updateSlotStatus(type, 'success');
        if (window.showToast) window.showToast(`${type.toUpperCase()} guardado en borrador`, 'success');
        return data.path;

    } catch (err) {
        console.error('Upload Error:', err);
        if (type !== 'cover') updateSlotStatus(type, 'error');
        if (window.showToast) window.showToast('Error al subir archivo', 'error');
        return null;
    }
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

        // 3. Upload Logic
        uploadFileToDrafts(file, type);
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

