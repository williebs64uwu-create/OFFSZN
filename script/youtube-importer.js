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
            // Load more when user is 100px from bottom and has next token
            if (scrollTop + clientHeight >= scrollHeight - 100) {
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
        // Appending: Render skeletons at the end
        // But since we append real cards later, we can just append skeletons now
        // Give them an ID to remove them easily specific to this batch?
        // Actually, just append, and when we get results, we remove ALL skeletons.
        // But if we have mixed content, we only want to remove the new skeletons.
        // Simplification: Append a specific skeleton container? 
        // For now, let's just append skeletons.
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

        // Clear skeletons
        const skeletons = listContainer.querySelectorAll('.skeleton-card');
        skeletons.forEach(s => s.remove());

        const videos = response.result.items;
        nextPageToken = response.result.nextPageToken || '';

        if (videos && videos.length > 0) {
            videos.forEach(video => {
                if (video && video.snippet) { // Safety Check
                    const card = createVideoCard(video);
                    listContainer.appendChild(card);
                }
            });
            // No Button - Scroll handles it
        } else {
            if (!pageToken) listContainer.innerHTML = '<div class="yt-empty">No se encontraron videos en tu canal.</div>';
        }
    } catch (err) {
        console.error("YouTube API Error:", err);
        // Only show error if list is empty
        if (listContainer.children.length === 0)
            listContainer.innerHTML = '<div class="yt-error">Error al conectar con YouTube. Verifica los permisos.</div>';
    } finally {
        isFetching = false; // Reset flag properly
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

        // Hide placeholder elements
        document.querySelector('.yt-thumb-placeholder').style.display = 'none';
        document.querySelector('.yt-thumb-overlay').style.display = 'flex'; // Enable overlay
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

    // 2. Clean Title & Extract BPM/Key (Search in Title AND Description)
    const cleanTitle = title.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim();
    const searchText = `${title} ${description}`; // Combine for broader search

    // Regex for BPM: strict integer, look for '140bpm', '140 bpm', or '[140]'
    // Avoid decimals or fancy formats. Only integers.
    // Matches: 140bpm, 140 BPM, [140]
    const bpmMatch = searchText.match(/\b(\d{2,3})\s*(?:BPM|bpm)\b/) || searchText.match(/\[(\d{2,3})\]/);
    let bpm = '';
    if (bpmMatch) {
        bpm = parseInt(bpmMatch[1], 10); // Ensure integer
        if (isNaN(bpm)) bpm = '';
    }

    // Regex for Key: [Cm], [Eb Major], [Am], or 'Key: Cm' in desc
    // Common keys: C, D, E, F, G, A, B with # or b, and min/maj/m/major/minor
    const keyRegex = /(?:Key:|Tone:|Nota:)?\s*\[?([A-G][#b]?\s*(?:maj|major|min|minor|m)?)\]?/i;
    // We try to match explicit keys first to avoid random letters
    const keyMatch = searchText.match(keyRegex);

    // Validate if it looks like a key (e.g. length < 10)
    let key = '';
    if (keyMatch) {
        const potentialKey = keyMatch[1].trim();
        // Simple validation: strictly limited length and chars
        if (potentialKey.length < 10) {
            key = potentialKey;
        }
    }

    // 3. Populate Form (Title, BPM, Key)
    const titleInput = document.querySelector('input[name="title"]');
    const descInput = document.querySelector('textarea[name="description"]');
    const bpmInput = document.querySelector('input[name="bpm"]');
    const keyInput = document.querySelector('input[name="key"]');

    if (titleInput) titleInput.value = cleanTitle;
    if (descInput) {
        descInput.value = description;
        updateDescCount(descInput); // Update counter
    }
    if (bpmInput) bpmInput.value = bpm;
    if (keyInput) keyInput.value = key;

    // 4. Handle Tags (Cloud UI)
    const tagCloud = document.getElementById('yt-tags-cloud');
    const hiddenTagsInput = document.getElementById('final-tags-input');

    if (tagCloud && hiddenTagsInput) {
        tagCloud.innerHTML = ''; // Clear prev
        let allTags = tags.split(', ').filter(t => t.trim());
        let selectedTags = [];

        if (allTags.length > 0 && allTags[0] !== '') {
            // Pre-select up to 3
            selectedTags = allTags.slice(0, 3);

            allTags.forEach(tag => {
                const chip = document.createElement('div');
                chip.className = 'yt-tag-chip';
                chip.textContent = tag;

                // Check if pre-selected
                if (selectedTags.includes(tag)) {
                    chip.classList.add('selected');
                }

                // Toggle logic
                chip.onclick = () => {
                    if (selectedTags.includes(tag)) {
                        // Deselect
                        selectedTags = selectedTags.filter(t => t !== tag);
                        chip.classList.remove('selected');
                    } else {
                        // Select
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
        // Fallback for old input if UI not updated
        const oldInput = document.querySelector('input[name="tags"]');
        if (oldInput) oldInput.value = tags;
    }

    // Toast/Feedback
    if (window.showToast) {
        window.showToast('¡Datos importados con éxito!', 'success');
    } else {
        alert('Datos importados: ' + cleanTitle);
    }

    closeImporterModal();
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
window.updateDescCount = updateDescCount;

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
    cropImage.src = rawThumb.src + (rawThumb.src.includes('?') ? '&' : '?') + 't=' + new Date().getTime();

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
        // Update Video Preview Background logic

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

        // Update Dropzone State
        const zone = document.getElementById('image-dropzone');
        if (zone) {
            zone.classList.add('has-file');
            zone.querySelector('h3').innerText = "Portada Recortada";
            zone.querySelector('p').innerText = "Listo para generación de video";
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

    // Close
    closeCropModal();
}

async function processAndUpload() {
    const title = document.getElementById('upload-title').value;
    if (!selectedAudioFile || !currentCropBlob) {
        if (window.showToast) window.showToast('Falta audio o imagen', 'error');
        return;
    }

    if (window.showToast) window.showToast('⏳ Generando video (Simulado)...', 'info');

    // SIMULATION
    setTimeout(() => {
        if (window.showToast) window.showToast('✅ Video listo para YouTube!', 'success');
        // Here we would call the YouTube Upload API with the video blob
    }, 2000);
}

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

