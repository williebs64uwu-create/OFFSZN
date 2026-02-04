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

async function listUserVideos(pageToken = '') {
    showImporterModal();
    const listContainer = document.getElementById('yt-video-list');

    if (!pageToken) {
        listContainer.innerHTML = '<div class="yt-loading">Cargando tus videos...</div>';
    }

    try {
        const response = await gapi.client.youtube.search.list({
            "part": ["snippet"],
            "forMine": true,
            "maxResults": 12,
            "type": ["video"],
            "pageToken": pageToken
        });

        const videos = response.result.items;
        nextPageToken = response.result.nextPageToken || '';

        if (!pageToken) listContainer.innerHTML = '';

        // Remove "Load More" button if it exists to re-add it at the end
        const oldLoadMore = document.getElementById('yt-load-more');
        if (oldLoadMore) oldLoadMore.remove();

        if (videos && videos.length > 0) {
            videos.forEach(video => {
                const card = createVideoCard(video);
                listContainer.appendChild(card);
            });

            if (nextPageToken) {
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.id = 'yt-load-more';
                loadMoreBtn.className = 'yt-btn-secondary';
                loadMoreBtn.textContent = 'Cargar más';
                loadMoreBtn.onclick = () => listUserVideos(nextPageToken);
                listContainer.appendChild(loadMoreBtn);
            }
        } else {
            listContainer.innerHTML = '<div class="yt-empty">No se encontraron videos en tu canal.</div>';
        }
    } catch (err) {
        console.error("YouTube API Error:", err);
        listContainer.innerHTML = '<div class="yt-error">Error al conectar con YouTube. Verifica los permisos.</div>';
    }
}

// ========================================
// 3. UI GENERATION (MODAL & CARDS)
// ========================================

function createVideoCard(video) {
    const snippet = video.snippet;
    const videoId = video.id.videoId;
    const title = snippet.title;
    const thumb = snippet.thumbnails.medium.url;

    const div = document.createElement('div');
    div.className = 'yt-video-card';
    div.innerHTML = `
        <img src="${thumb}" alt="${title}">
        <div class="yt-video-info">
            <h4 title="${title}">${title}</h4>
        </div>
    `;
    div.onclick = () => selectVideo(videoId, title, snippet.description, snippet.thumbnails);
    return div;
}

function showImporterModal() {
    const modal = document.getElementById('yt-importer-modal');
    if (modal) modal.style.display = 'flex';
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
    const max = 800;

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
let CROP_SIZE = 300;
let baseScale = 1;
let currentCropBlob = null; // Stores the final cropped image

document.addEventListener('DOMContentLoaded', () => {
    cropImage = document.getElementById('cropImage');
    cropBox = document.getElementById('cropBox');
    cropContainer = document.getElementById('cropContainer');

    // Initialize cropper events if elements exist
    if (cropContainer) {
        cropContainer.addEventListener('mousedown', startDrag);
        cropContainer.addEventListener('wheel', handleZoom, { passive: false });
    }

    // Save button
    const saveBtn = document.getElementById('saveCropBtn');
    if (saveBtn) saveBtn.onclick = saveCrop;
});

function openCropModalForThumb() {
    const rawThumb = document.getElementById('yt-imported-thumb');
    if (!rawThumb || !rawThumb.src) {
        if (window.showToast) window.showToast('No hay imagen para recortar', 'error');
        return;
    }

    const modal = document.getElementById('cropModal');
    modal.classList.add('active');

    // Load image into cropper
    cropImage.src = rawThumb.src;
    // Important: Reset state
    imageScale = 1; imageX = 0; imageY = 0;

    cropImage.onload = () => {
        initializeCrop();
    };
}

function closeCropModal() {
    document.getElementById('cropModal').classList.remove('active');
}

function initializeCrop() {
    const containerW = cropContainer.offsetWidth;
    const containerH = cropContainer.offsetHeight;
    const imgW = cropImage.naturalWidth;
    const imgH = cropImage.naturalHeight;

    // Calculate crop box size (ensure it fits)
    CROP_SIZE = Math.min(containerW, containerH) * 0.8;
    const boxX = (containerW - CROP_SIZE) / 2;
    const boxY = (containerH - CROP_SIZE) / 2;

    cropBox.style.width = CROP_SIZE + 'px';
    cropBox.style.height = CROP_SIZE + 'px';
    cropBox.style.left = boxX + 'px';
    cropBox.style.top = boxY + 'px';

    // Calculate initial scale to cover the box
    baseScale = Math.max(CROP_SIZE / imgW, CROP_SIZE / imgH);
    imageScale = baseScale;

    // Center image
    imageX = (containerW / 2) - (imgW * imageScale) / 2;
    imageY = (containerH / 2) - (imgH * imageScale) / 2;

    updateImageTransform();
}

function updateImageTransform() {
    cropImage.style.transform = `translate(${imageX}px, ${imageY}px) scale(${imageScale})`;
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
    // Optional: Add constrain logic here
    updateImageTransform();
}

function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
}

function handleZoom(e) {
    e.preventDefault();
    zoomCrop(e.deltaY > 0 ? -0.1 : 0.1);
}

window.zoomCrop = function (delta) {
    if (delta === 0) {
        // From slider
        const slider = document.getElementById('zoomRange');
        if (slider) imageScale = baseScale * parseFloat(slider.value);
    } else {
        imageScale += (baseScale * delta);
    }

    // Min/Max limits
    if (imageScale < baseScale) imageScale = baseScale;
    if (imageScale > baseScale * 4) imageScale = baseScale * 4;

    // Sync slider if exists
    const slider = document.getElementById('zoomRange');
    if (slider) slider.value = imageScale / baseScale;

    updateImageTransform();
};

async function saveCrop() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1080;
    canvas.height = 1080;

    // Calculate source rectangle
    // We need to map the crop box (relative to container) to the image (relative to image origin)
    // 1. Box position relative to image
    const boxRect = cropBox.getBoundingClientRect();
    const containerRect = cropContainer.getBoundingClientRect();

    // This is tricky without strict constraints, let's try a simpler approach typical for these croppers:
    // We draw the relevant part of the image into the canvas.

    // Let's rely on the visual correlation:
    // cropBox top-left relative to container: cropBox.offsetLeft, cropBox.offsetTop
    // image top-left relative to container: imageX, imageY

    const cropLeft = cropBox.offsetLeft;
    const cropTop = cropBox.offsetTop;

    const relX = cropLeft - imageX;
    const relY = cropTop - imageY;

    const sourceX = relX / imageScale;
    const sourceY = relY / imageScale;
    const sourceSize = CROP_SIZE / imageScale;

    // Draw
    ctx.drawImage(cropImage, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 1080, 1080);

    // Export Blob
    currentCropBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));

    // Update Preview
    const preview = document.getElementById('yt-imported-thumb');
    preview.src = URL.createObjectURL(currentCropBlob);

    // Close
    closeCropModal();
    if (window.showToast) window.showToast('Portada recortada guardada', 'success');
}



// ========================================
// 6. GLOBAL EXPOSURE
// ========================================
window.handleImportClick = handleImportClick;
window.closeImporterModal = closeImporterModal;
window.handleImportClick = handleImportClick;
window.closeImporterModal = closeImporterModal;
window.redirectToUpload = redirectToUpload;
window.selectVideo = selectVideo;
window.resetToHub = resetToHub;
window.openCropModalForThumb = openCropModalForThumb;
window.closeCropModal = closeCropModal;
window.zoomCrop = window.zoomCrop; // Expose zoom helper

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

