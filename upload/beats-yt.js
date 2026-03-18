// --- Global Constants ---
const MAX_SIZES = {
    PORTADA: 20 * 1024 * 1024, // 20 MB
    MP3: 50 * 1024 * 1024,     // 50 MB
    WAV: 60 * 1024 * 1024,     // 60 MB
    STEMS: 50 * 1024 * 1024    // 50 MB
};

// --- Toast Utility (Fallback) ---
window.showToast = window.showToast || ((message, type = 'success') => {
    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: message,
            duration: 3000,
            gravity: "top",
            position: "right",
            style: {
                background: type === 'success' ? "#222" : "#991b1b",
                color: "#fff",
                borderRadius: "8px",
                border: "1px solid #333"
            }
        }).showToast();
    } else {
        console.log(`[TOAST] ${type.toUpperCase()}: ${message}`);
        // Simple fallback alert if Toastify is missing
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `position:fixed; top:20px; right:20px; padding:12px 24px; background:${type === 'success' ? '#222' : '#991b1b'}; color:#fff; border-radius:8px; z-index:10000; border:1px solid #333; font-family:sans-serif;`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
});

// --- Local State (Exposed globally for synchronization) ---
window.uploaderState = {
    cover: null,
    mp3_tagged: null,
    wav_untagged: null,
    stems: null,
    stemsLink: null,
    currentStep: 1,
    loop: false,
    tags: [],
    collaborators: [],
    currentUser: null,
    isYouTubeUpload: true // 🔥 Default TRUE for beats-yt.html
};
let uploaderState = window.uploaderState;

// --- Slug Generation ---
function generatePublicSlug(title) {
    if (!title) return "";
    return title
        .toLowerCase()
        .trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/\+/g, '-') // Replace + with -
        .replace(/_/g, '-') // Replace _ with -
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Spaces to hyphens
        .replace(/-+/g, '-') // Multiple hyphens to single
        .replace(/^-+|-+$/g, '') // Trim hyphens from ends
        .substring(0, 60); // Max 60 characters
}

// --- Licensing Logic ---
const DEFAULT_LICENSES = {
    offszn_basic: { name: 'Basic', price: 20.00, enabled: true, features: ['MP3 Tagged'], id: 'offszn_basic' },
    offszn_premium: { name: 'Premium', price: 50.00, enabled: true, features: ['MP3 Tagged', 'WAV Untagged'], id: 'offszn_premium' },
    offszn_unlimited: { name: 'Unlimited', price: 100.00, enabled: true, features: ['MP3 Tagged', 'WAV Untagged', 'Stems'], id: 'offszn_unlimited' },
    offszn_exclusive: { name: 'Exclusive', price: 300.00, enabled: true, features: ['MP3 Tagged', 'WAV Untagged', 'Stems'], id: 'offszn_exclusive' }
};

let licensesState = {};

async function initLicenses() {
    console.log('?? [LICENSES] Initializing with "Last Used" logic...');

    // Default fallback
    let settings = JSON.parse(JSON.stringify(DEFAULT_LICENSES));

    try {
        if (window.supabaseClient) {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session?.user?.id) {
                const { data, error } = await window.supabaseClient
                    .from('users')
                    .select('license_settings')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (data && data.license_settings) {
                    console.log('✅ [LICENSES] Settings found in Supabase.');
                    // Merge Supabase settings with defaults, handling legacy non-prefixed keys
                    Object.keys(data.license_settings).forEach(id => {
                        const targetId = id.startsWith('offszn_') ? id : `offszn_${id}`;
                        if (settings[targetId]) {
                            settings[targetId].price = data.license_settings[id].price;
                            settings[targetId].enabled = data.license_settings[id].enabled;
                        }
                    });
                }
            }
        }
    } catch (err) {
        console.error('❌ [LICENSES] Error fetching last used settings:', err);
    }

    // 🔥 Enforce $1000 cap on load
    Object.keys(settings).forEach(id => {
        if (settings[id].price > 1000) {
            console.warn(`?? [LICENSES] Capping price for ${id} from ${settings[id].price} to 1000`);
            settings[id].price = 1000;
        }
    });

    licensesState = settings;
    renderLicenses();
}

/**
 * Persists the current license configuration to Supabase.
 * Call this after a successful publish.
 */
window.saveLastUsedLicenses = async () => {
    try {
        if (!window.supabaseClient) return;
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session?.user?.id) return;

        console.log('💾 [LICENSES] Saving last used settings...');
        const { error } = await window.supabaseClient
            .from('users')
            .update({ license_settings: licensesState })
            .eq('id', session.user.id);

        if (error) throw error;
        console.log('✅ [LICENSES] Settings saved.');
    } catch (err) {
        console.error('❌ [LICENSES] Error saving last used settings:', err);
    }
};

window.renderLicenses = () => {
    const container = document.getElementById('licensesContainer');
    if (!container) return;

    container.innerHTML = '';

    Object.keys(licensesState).forEach(id => {
        const license = licensesState[id];
        const card = document.createElement('div');
        card.id = `offszn_licencia_${id}`;
        card.className = `license-card ${license.enabled ? 'active' : ''}`;

        const hasMP3 = !!uploaderState.mp3_tagged;
        const hasWAV = !!uploaderState.wav_untagged;
        const hasStems = !!uploaderState.stems || !!uploaderState.stemsLink;

        let missingFiles = [];
        let requiredDisplay = '';

        if (id === 'offszn_basic') {
            requiredDisplay = '(MP3 TAGGED)';
            if (!hasMP3) missingFiles.push('MP3');
        }
        if (id === 'offszn_premium') {
            requiredDisplay = '(MP3 + WAV)';
            if (!hasMP3 || !hasWAV) missingFiles.push('Archivos');
        }
        if (id === 'offszn_unlimited' || id === 'offszn_exclusive') {
            requiredDisplay = '(STEMS)';
            if (!hasMP3 || !hasWAV || !hasStems) missingFiles.push('STEMS');
        }

        const isComplete = missingFiles.length === 0;
        let statusText = ``;

        if (isComplete) {
            statusText = `Archivo: Cargado ${requiredDisplay}`;
        } else {
            if (id === 'offszn_basic') {
                statusText = 'Falta: Mp3';
            } else if (id === 'offszn_premium') {
                if (!hasMP3) statusText = 'Falta: Mp3';
                else if (!hasWAV) statusText = 'Falta: Wav';
            } else if (id === 'offszn_unlimited' || id === 'offszn_exclusive') {
                if (!hasMP3) statusText = 'Falta: Mp3';
                else if (!hasWAV) statusText = 'Falta: Wav';
                else if (!hasStems) statusText = 'Falta: Stems';
            }
        }

        card.innerHTML = `
            <div class="license-main-row">
                <div class="license-left-group">
                    <label class="toggle-switch">
                        <input type="checkbox" 
                            id="enabled_${id}" 
                            name="enabled_${id}"
                            ${license.enabled ? 'checked' : ''} 
                            onchange="window.toggleLicense('${id}')">
                        <span class="slider"></span>
                    </label>
                    <span class="offszn_nombre">${license.name === 'Basic' ? 'MP3 Lease' : (license.name === 'Premium' ? 'WAV Lease' : (license.name === 'Unlimited' ? 'Trackout (Stems)' : 'Ilimitado'))}</span>
                </div>
                <div class="license-right-group">
                    <div class="price-box" style="${license.enabled ? '' : 'visibility: hidden;'}">
                        <span class="currency">$</span>
                        <input type="number" 
                            id="price_${id}"
                            name="price_${id}"
                            class="license-price-input" 
                            value="${Number(license.price || 0).toFixed(2)}" 
                            oninput="if(this.value.includes('.') && this.value.split('.')[1].length > 2) this.value = this.value.slice(0, -1)"
                            onchange="window.updateLicensePrice('${id}', this.value)">
                    </div>
                </div>
            </div>
            <div class="license-status-row ${isComplete ? 'status-success' : 'status-error'}">
                <span>${statusText}</span>
            </div>
        `;
        container.appendChild(card);
    });

    renderFreeDownloadToggle(container);
};

function renderFreeDownloadToggle(container) {
    const isFreeEnabled = window.uploaderState.free_download || false;
    const mp3Uploaded = !!uploaderState.mp3_tagged;

    const freeCard = document.createElement('div');
    freeCard.className = `license-card free-download-card ${isFreeEnabled ? 'active' : ''}`;
    freeCard.innerHTML = `
        <div class="license-main-row">
            <div class="license-left-group">
                <label class="toggle-switch">
                    <input type="checkbox" 
                        id="free_download_toggle" 
                        name="free_download_toggle"
                        ${isFreeEnabled ? 'checked' : ''} 
                        onchange="window.toggleFreeDownload()">
                    <span class="slider"></span>
                </label>
                <span class="offszn_nombre">Descarga Gratis</span>
            </div>
        </div>
        <div class="free-download-description">
            Los usuarios podrán descargar el archivo MP3 con Tag gratis a cambio de seguirte en OFFSZN.
        </div>
        <div class="license-status-row ${mp3Uploaded ? 'status-success' : 'status-error'}">
             <span>Estado del archivo: ${mp3Uploaded ? '<span class="check-icon">✓</span> Listo' : 'Faltante'}</span>
        </div>
    `;
    container.appendChild(freeCard);
}

window.toggleLicense = (id) => {
    if (licensesState[id]) {
        // Count currently enabled licenses
        const enabledCount = Object.values(licensesState).filter(l => l.enabled).length;

        // If trying to disable and it's the only one left, do nothing
        if (licensesState[id].enabled && enabledCount <= 1) {
            return;
        }

        licensesState[id].enabled = !licensesState[id].enabled;
        window.renderLicenses();
    }
};

window.updateLicensePrice = (id, price) => {
    if (licensesState[id]) {
        let p = parseFloat(price);
        if (isNaN(p)) p = 0;
        // Strict truncation to 2 decimals (no rounding)
        p = Math.floor(p * 100) / 100;
        if (p > 1000) p = 1000;
        licensesState[id].price = p;
        window.renderLicenses(); 
    }
};

window.toggleFreeDownload = () => {
    window.uploaderState.free_download = !window.uploaderState.free_download;
    window.renderLicenses();
};

const TOTAL_STEPS = 4;

/**
 * Utility to show toast notifications
 */
function notify(message, type = 'info') {
    if (typeof window.showEliteToast === 'function') {
        window.showEliteToast(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

// --- Cover Handling (Cropper.js) ---
let cropper = null;

function initCoverHandlers() {
    const coverDropZone = document.getElementById('coverDropZone');
    const coverInput = document.getElementById('coverInput');
    const saveCropBtn = document.getElementById('saveCropBtn');

    if (!coverDropZone || !coverInput) return;

    coverDropZone.addEventListener('click', () => {
        coverInput.click();
        document.getElementById('offszn_error_cover').style.display = 'none';
    });
    coverInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleCoverSelection(file);
    });

    coverDropZone.addEventListener('dragover', (e) => { e.preventDefault(); coverDropZone.classList.add('dragover'); });
    coverDropZone.addEventListener('dragleave', () => coverDropZone.classList.remove('dragover'));
    coverDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        coverDropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleCoverSelection(file);
    });

    if (saveCropBtn) saveCropBtn.addEventListener('click', saveCroppedImage);
}

function handleCoverSelection(file) {
    if (!file.type.startsWith('image/')) { notify('Imagen inválida.', 'error'); return; }
    if (file.size > MAX_SIZES.PORTADA) { notify('Límite 20MB superado.', 'error'); return; }

    const reader = new FileReader();
    reader.onload = (e) => openCropModal(e.target.result);
    reader.readAsDataURL(file);
}

function openCropModal(imageSrc) {
    const modal = document.getElementById('cropModal');
    const cropImage = document.getElementById('cropImage');
    if (!modal || !cropImage) return;

    cropImage.src = imageSrc;
    modal.classList.add('active'); if (cropper) cropper.destroy();

    // viewMode 1: Restringe el cuadro de recorte para que nunca salga de la imagen.
    // Combinado con dragMode: 'move' y cuadro fijo, logramos que el usuario mueva la 
    // imagen detrás del cuadro sin dejar nunca huecos negros.
    cropper = new Cropper(cropImage, {
        aspectRatio: 1,
        viewMode: 1,            // El cuadro de recorte no puede salir de la imagen
        dragMode: 'move',       // Mover la imagen, no el cuadro
        autoCropArea: 1,        // Ocupar el máximo posible al inicio
        restore: false,
        guides: false,
        center: true,
        highlight: false,
        background: false,      // Sin fondo de cuadritos
        modal: true,            // Oscurece lo que queda fuera
        cropBoxMovable: false,  // Cuadro fijo en el centro
        cropBoxResizable: false,// No se puede cambiar el tamaño del cuadro
        toggleDragModeOnDblclick: false,
        ready() {
            // Aseguramos que el cuadro de recorte esté centrado y sea el máximo posible
            this.cropper.setCropBoxData({
                left: 0,
                top: 0,
                width: 10000, // Cropper lo ajustará al máximo de la imagen
                height: 10000
            });
        }
    });
}

function closeCropModal() {
    const modal = document.getElementById('cropModal');
    if (modal) modal.classList.remove('active');

    if (cropper) {
        cropper.destroy();
        cropper = null;
    }

    // RESET TOTAL DEL INPUT: Siempre lo limpiamos al cerrar.
    // Esto es CLAVE para que el navegador detecte un nuevo cambio incluso con el mismo archivo.
    const coverInput = document.getElementById('coverInput');
    if (coverInput) coverInput.value = '';

    // Si cerramos sin haber guardado exitosamente (uploaderState.cover sigue siendo null),
    // limpiamos las previsualizaciones pendientes de este intento fallido.
    if (!uploaderState.cover) {
        uploaderState.cover = null; // Resetear el estado de la portada
        const coverDropZone = document.getElementById('coverDropZone');
        if (coverDropZone) {
            coverDropZone.classList.remove('has-image');
            const preview = document.getElementById('coverPreview');
            if (preview) {
                preview.src = '';
                preview.style.display = 'none';
            }
        }
        const cardPreview = document.getElementById('previewCardCover');
        if (cardPreview) cardPreview.innerHTML = '';
    }
}
window.closeCropModal = closeCropModal;

function saveCroppedImage() {
    if (!cropper) return;

    // Generamos el canvas con el tamaño final deseado
    const canvas = cropper.getCroppedCanvas({
        width: 1080,
        height: 1080,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
    });

    canvas.toBlob((blob) => {
        if (!blob) return;

        const croppedFile = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
        uploaderState.cover = croppedFile;

        const imageUrl = URL.createObjectURL(croppedFile);
        const preview = document.getElementById('coverPreview');
        if (preview) {
            preview.src = imageUrl;
            preview.style.display = 'block';
        }

        const coverDropZone = document.getElementById('coverDropZone');
        if (coverDropZone) {
            coverDropZone.classList.add('has-image');
        }

        const cardPreview = document.getElementById('previewCardCover');
        if (cardPreview) {
            cardPreview.innerHTML = `<img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;">`;
        }

        closeCropModal();

        // Hide error message
        const err = document.getElementById('offszn_error_cover');
        if (err) err.style.display = 'none';

        notify('Portada guardada.', 'success');
    }, 'image/jpeg', 0.9);
}

const fileTimeouts = {};

function setupFileSlot(prefix, stateKey, maxSize, successText, extension) {
    const zone = document.getElementById(`${prefix}DropZone`);
    const input = document.getElementById(`${prefix}Input`);
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) processFile(file, zone, stateKey, maxSize, successText, extension, prefix);
    });

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.style.borderColor = '#8b5cf6'; });
    zone.addEventListener('dragleave', () => zone.style.borderColor = (zone.classList.contains('success') ? '#22c55e' : ''));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.style.borderColor = '';
        const file = e.dataTransfer.files[0];
        if (file) processFile(file, zone, stateKey, maxSize, successText, extension, prefix);
    });
}

function processFile(file, zone, stateKey, maxSize, successText, extension, prefix) {
    // Limpiar errores previos si existen
    if (fileTimeouts[prefix]) {
        clearTimeout(fileTimeouts[prefix]);
        delete fileTimeouts[prefix];
    }
    const previewContainer = document.getElementById(`${prefix}PreviewContainer`);
    if (previewContainer) previewContainer.innerHTML = '';
    zone.style.borderColor = '';

    if (extension) {
        const extArray = extension.split(/,\s*/);
        const validExt = extArray.some(ext => file.name.toLowerCase().endsWith(ext));
        if (!validExt) {
            notify(`Selecciona un archivo ${extArray.join(' o ').toUpperCase()}.`, 'error');
            return;
        }
    }

    if (file.size > maxSize) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const limitMB = maxSize / (1024 * 1024);

        // Estado de Error Visual
        zone.style.borderColor = '#ef4444';
        if (previewContainer) {
            previewContainer.innerHTML = `
                <div class="file-error-msg" style="color: #ef4444; font-size: 13px; display: flex; align-items: center; gap: 6px; margin-top: 8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                    </svg>
                    <span>El archivo pesa ${fileSizeMB}MB (Máx. ${limitMB}MB)</span>
                </div>
            `;
        }

        fileTimeouts[prefix] = setTimeout(() => {
            zone.style.borderColor = zone.classList.contains('success') ? '#22c55e' : '';
            if (previewContainer) previewContainer.innerHTML = '';
            delete fileTimeouts[prefix];
        }, 3000);

        notify(`Límite ${limitMB}MB superado.`, 'error');
        return;
    }

    uploaderState[stateKey] = file;

    // UI Update - Éxito
    zone.style.borderColor = '#22c55e';
    zone.classList.add('success', 'has-file');

    const cta = zone.querySelector('.upload-cta-btn span');
    if (cta) cta.textContent = successText;

    const successIcon = zone.querySelector('.success-state');
    if (successIcon) successIcon.style.display = 'flex';
    // El usuario quiere mantener el icono de subida incluso cuando cambia el texto

    if (stateKey === 'mp3_tagged') {
        if (window.loadWaveform) window.loadWaveform(file);
        const err = document.getElementById('offszn_error_mp3');
        if (err) err.style.display = 'none';
    }

    // 🔥 RE-RENDER LICENSES IF THEY EXIST
    if (typeof window.renderLicenses === 'function') {
        window.renderLicenses();
    }

    notify('Archivo cargado.', 'success');
}

// --- Step Navigation ---

function updateStepUI() {
    document.querySelectorAll('.step').forEach(el => {
        const s = parseInt(el.getAttribute('data-step'));
        el.classList.toggle('active', s === uploaderState.currentStep);
        el.classList.toggle('completed', s < uploaderState.currentStep);
    });

    document.querySelectorAll('.form-step').forEach(el => el.classList.toggle('active', el.id === `step${uploaderState.currentStep}`));

    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.style.display = uploaderState.currentStep === TOTAL_STEPS ? 'none' : 'block';
        nextBtn.textContent = 'Siguiente';
    }

    const publishWrapper = document.getElementById('publishWrapper');
    if (publishWrapper) publishWrapper.style.display = uploaderState.currentStep === TOTAL_STEPS ? 'inline-block' : 'none';

    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) prevBtn.style.visibility = uploaderState.currentStep > 1 ? 'visible' : 'hidden';

    // 🔥 RE-RENDER LICENSES ON EVERY STEP CHANGE
    if (typeof window.renderLicenses === 'function') {
        window.renderLicenses();
    }
}

// --- Player Logic ---

let wavesurfer = null;

function initPlayer() {
    if (!window.WaveSurfer) return;

    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#4b4b4b',
        progressColor: '#ffffff',
        cursorColor: '#ffffff',
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        height: 50,
        normalize: true,
        responsive: true
    });

    wavesurfer.on('play', () => updatePlayBtn(true));
    wavesurfer.on('pause', () => updatePlayBtn(false));
    wavesurfer.on('finish', () => {
        if (uploaderState.loop) {
            wavesurfer.play();
        } else {
            updatePlayBtn(false);
        }
    });
    wavesurfer.on('audioprocess', updateTime);
    wavesurfer.on('seek', updateTime);

    const volSlider = document.getElementById('volumeSlider');
    if (volSlider) {
        volSlider.addEventListener('input', (e) => {
            const v = e.target.value / 100;
            updateVolumeSliderBackground(volSlider, e.target.value);
            wavesurfer.setVolume(v);
            updateVolumeIcon(v);
        });
        // Initial set
        updateVolumeSliderBackground(volSlider, volSlider.value);
    }

    // Connect Play Button
    document.getElementById('playPauseBtn')?.addEventListener('click', () => window.togglePlay());
}

function updateVolumeSliderBackground(slider, val) {
    if (!slider) return;
    // val is 0-100. We want a white fill from bottom to val, and grey from val up.
    // CSS gradient 'to top' means 0% is bottom, 100% is top.
    slider.style.background = `linear-gradient(to top, #ffffff ${val}%, #333336 ${val}%)`;
}

// --- Validation Helpers ---

function clearInlineErrors() {
    document.querySelectorAll('.error-message').forEach(el => el.remove());
    document.querySelectorAll('.input-field.error, .upload-zone.error').forEach(el => el.classList.remove('error'));
}

function showInlineError(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.add('error');

    let container = el.closest('.form-group') || el.parentElement;
    let errorDiv = container.querySelector('.error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.color = '#ef4444';
        errorDiv.style.fontSize = '12px';
        errorDiv.style.marginTop = '4px';
        errorDiv.style.display = 'flex';
        errorDiv.style.alignItems = 'center';
        errorDiv.style.gap = '4px';
        container.appendChild(errorDiv);
    }
    errorDiv.innerHTML = `<i class="bi bi-info-circle"></i> ${message}`;
}

function validateReleaseDate() {
    const input = document.getElementById('dateInput');
    if (!input || !input.value) return false;
    return true; // Per user request: bypass past date check
}

function validateStep(step) {
    clearInlineErrors();
    let isValid = true;

    if (step === 1) {
        if (!uploaderState.mp3_tagged) {
            showInlineError('mp3TaggedDropZone', 'Debes subir el MP3 Tagged (Preview)');
            isValid = false;
        }
        if (!uploaderState.cover) {
            showInlineError('coverDropZone', 'Debes subir una portada (1080x1080px)');
            isValid = false;
        }
        if (!document.getElementById('titleInput').value.trim()) {
            showInlineError('titleInput', 'El título es obligatorio');
            isValid = false;
        }
        if (!validateReleaseDate()) {
            showInlineError('dateInput', 'La fecha de lanzamiento es obligatoria');
            isValid = false;
        }
    }

    if (step === 2) {
        const enabledLics = Object.values(licensesState).filter(l => l.enabled);
        if (enabledLics.length === 0) {
            showToast('Debes habilitar al menos una licencia', 'error');
            isValid = false;
        }
        if (uploaderState.tags.length === 0) {
            showInlineError('tagInput', 'Debes agregar al menos 1 tag');
            isValid = false;
        }
        // BPM is now optional per user request
        // const bpmVal = parseInt(document.getElementById('bpmInput')?.value);
        // if (!bpmVal || bpmVal < 1) {
        //     showInlineError('bpmInput', 'Debes especificar el BPM');
        //     isValid = false;
        // }
    }

    if (!isValid) {
        const firstErr = document.querySelector('.error-message');
        if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return isValid;
}

function updateVolumeIcon(v) {
    const icon = document.getElementById('volumeIcon');
    if (!icon) return;
    if (v === 0) {
        icon.innerHTML = '<path d="M11 5 6 9 2 9v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/>';
    } else if (v < 0.5) {
        icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
    } else {
        icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
    }
}

window.toggleMute = () => {
    if (!wavesurfer) return;
    const isMuted = wavesurfer.getMuted();
    wavesurfer.setMuted(!isMuted);
    const slider = document.getElementById('volumeSlider');
    if (slider) {
        const newVal = !isMuted ? 0 : (wavesurfer.getVolume() * 100);
        slider.value = newVal;
        updateVolumeSliderBackground(slider, newVal);
    }
    updateVolumeIcon(!isMuted ? 0 : wavesurfer.getVolume());
};

window.toggleLoop = () => {
    uploaderState.loop = !uploaderState.loop;
    const btn = document.getElementById('loopBtn');
    if (btn) btn.classList.toggle('active', uploaderState.loop);
    // WaveSurfer v7+ handles loop via play on finish if desired, or here:
    if (wavesurfer) {
        // We'll handle it via code logic or plugin
    }
};

// Re-implementing loop logic on finish
// wavesurfer.on('finish', () => { if(uploaderState.loop) wavesurfer.play(); }); 
// (Done above in finish handler)

function updatePlayBtn(isPlaying) {
    const btn = document.getElementById('playPauseBtn');
    if (!btn) return;
    btn.innerHTML = isPlaying
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
}

function updateTime() {
    const timeEl = document.getElementById('playerTime');
    if (!timeEl || !wavesurfer) return;
    const fmt = (s) => Math.floor(s / 60) + ':' + Math.floor(s % 60).toString().padStart(2, '0');
    timeEl.textContent = `${fmt(wavesurfer.getCurrentTime())} / ${fmt(wavesurfer.getDuration())}`;
}

window.togglePlay = () => wavesurfer?.playPause();
window.loadWaveform = (file) => {
    const btn = document.getElementById('playPauseBtn');
    if (btn) btn.disabled = false;
    document.getElementById('waveform').style.display = 'block';
    document.getElementById('playerPlaceholder').style.display = 'none';
    wavesurfer.load(URL.createObjectURL(file));
};

window.removeFile = (type) => {
    let prefix = '';
    let stateKey = '';
    let defaultText = 'Subir Archivo';

    if (type === 'mp3_tagged') { prefix = 'mp3Tagged'; stateKey = 'mp3_tagged'; }
    if (type === 'wav_untagged') { prefix = 'wavUntagged'; stateKey = 'wav_untagged'; }
    if (type === 'stems') { prefix = 'stems'; stateKey = 'stems'; }

    uploaderState[stateKey] = null;
    if (type === 'stems') uploaderState.stemsLink = null;

    const zone = document.getElementById(`${prefix}DropZone`);
    if (zone) {
        zone.style.borderColor = '';
        zone.classList.remove('success', 'has-file');
        const cta = zone.querySelector('.upload-cta-btn span');
        if (cta) cta.textContent = defaultText;

        const successIcon = zone.querySelector('.success-state');
        const defaultIcon = zone.querySelector('.icon-box');
        if (successIcon) successIcon.style.display = 'none';
        if (defaultIcon) defaultIcon.style.display = 'flex';
    }

    if (type === 'mp3_tagged' && wavesurfer) {
        wavesurfer.stop();
        document.getElementById('waveform').style.display = 'none';
        document.getElementById('playerPlaceholder').style.display = 'block';
        document.getElementById('playPauseBtn').disabled = true;
    }

    // 🔥 RE-RENDER LICENSES ON REMOVAL
    if (typeof window.renderLicenses === 'function') {
        window.renderLicenses();
    }

    notify('Archivo eliminado.', 'info');
};

// --- Stems Link Modal ---

window.openStemsLinkModal = () => {
    const modal = document.getElementById('stemsLinkModal');
    if (modal) modal.classList.add('active');
};

window.closeStemsLinkModal = () => {
    const modal = document.getElementById('stemsLinkModal');
    if (modal) modal.classList.remove('active');
    const input = document.getElementById('stemsLinkInput');
    const errorEl = document.getElementById('stemsLinkError');
    if (input) input.value = '';
    if (errorEl) errorEl.style.display = 'none';
};

window.saveStemsLink = () => {
    const input = document.getElementById('stemsLinkInput');
    const errorEl = document.getElementById('stemsLinkError');
    const link = input?.value.trim() || '';

    if (!link) {
        if (errorEl) {
            errorEl.textContent = 'Por favor, ingresa un link.';
            errorEl.style.display = 'block';
        }
        return;
    }

    // Basic validation for common providers and URL structure
    const providers = ['drive.google.com', 'mega.nz', 'dropbox.com', 'mediafire.com', 'wetransfer.com'];
    const hasProvider = providers.some(p => link.toLowerCase().includes(p));
    const isUrl = link.startsWith('http://') || link.startsWith('https://');

    if (!isUrl || !hasProvider) {
        if (errorEl) {
            errorEl.textContent = 'Ingresa un link válido (ej: https://drive.google.com/...)';
            errorEl.style.display = 'block';
        }
        return;
    }

    uploaderState.stemsLink = link;
    uploaderState.stems = null; // Clear file if link is provided

    // UI Update feedback on Stems zone
    const zone = document.getElementById('stemsDropZone');
    if (zone) {
        zone.style.borderColor = '#22c55e';
        zone.classList.add('success', 'has-file');
        const cta = zone.querySelector('.upload-cta-btn span');
        if (cta) cta.textContent = 'Link guardado';

        const successIcon = zone.querySelector('.success-state');
        if (successIcon) successIcon.style.display = 'flex';
        // El usuario quiere mantener el icono de subida/archivo uniforme
    }

    window.closeStemsLinkModal();

    // 🔥 RE-RENDER LICENSES
    if (typeof window.renderLicenses === 'function') {
        window.renderLicenses();
    }

    notify('Link de STEMS guardado correctamente.', 'success');
};

// --- Main Init ---

document.addEventListener('DOMContentLoaded', async () => {
    // 🔥 Start overlay as early as possible if editing
    const editIdParam = new URLSearchParams(window.location.search).get('edit');
    if (editIdParam) {
        if (typeof window.showEditOverlay === 'function') {
            window.showEditOverlay();
        } else {
            // Fallback if not yet defined (though it should be)
            const overlay = document.getElementById('publishOverlay');
            const title = document.getElementById('publishOverlayTitle');
            const text = document.getElementById('publishOverlayText');
            if (overlay) {
                overlay.style.display = 'flex';
                if (title) title.innerText = 'Cargando producto...';
                if (text) text.innerText = 'Preparando edición';
            }
        }
    }

    initPlayer();
    initCoverHandlers();
    setupFileSlot('mp3Tagged', 'mp3_tagged', MAX_SIZES.MP3, 'Cambiar MP3', '.mp3');
    setupFileSlot('wavUntagged', 'wav_untagged', MAX_SIZES.WAV, 'Cambiar WAV', '.wav');
    setupFileSlot('stems', 'stems', MAX_SIZES.STEMS, 'Cambiar Stems', '.zip, .rar');

    initCharCounters();
    initVisibilityDropdown();
    initKeyDropdown();
    initDateTime();
    await initLicenses();
    initTagsInput();

    // --- Edit Mode Initialization ---
    await checkForEditMode();

    // --- Helper function for step navigation ---
    function tryGoToStep(targetStep) {
        // Enforce validation to go past Step 1
        if (targetStep > 1) {
            const title = document.getElementById('titleInput')?.value.trim();
            const hasCover = !!uploaderState.cover;
            const hasMP3 = !!uploaderState.mp3_tagged;

            if (!title || !hasCover || !hasMP3) {
                if (!title) {
                    document.getElementById('offszn_error_title').style.display = 'flex';
                }
                if (!hasCover) {
                    document.getElementById('offszn_error_cover').style.display = 'flex';
                }
                if (!hasMP3) {
                    document.getElementById('offszn_error_mp3').style.display = 'flex';
                }
                notify('Completa los campos obligatorios del Paso 1', 'error');
                // Force step 1 if they tried to skip
                if (uploaderState.currentStep !== 1) {
                    uploaderState.currentStep = 1;
                    updateStepUI();
                }
                return;
            }
        }

        uploaderState.currentStep = targetStep;
        updateStepUI();
    }

    // --- Next Button Trigger ---
    document.getElementById('nextBtn')?.addEventListener('click', () => {
        if (uploaderState.currentStep < TOTAL_STEPS) {
            tryGoToStep(uploaderState.currentStep + 1);
        }
    });

    // Hide errors when user starts fixing them
    document.getElementById('titleInput')?.addEventListener('input', () => {
        const err = document.getElementById('offszn_error_title');
        if (err) err.style.display = 'none';
    });

    document.getElementById('mp3TaggedDropZone')?.addEventListener('click', () => {
        const err = document.getElementById('offszn_error_mp3');
        if (err) err.style.display = 'none';
    });

    // Also hide cover error when interacting
    document.getElementById('coverDropZone')?.addEventListener('click', () => {
        const err = document.getElementById('offszn_error_cover');
        if (err) err.style.display = 'none';
    });

    document.getElementById('prevBtn')?.addEventListener('click', () => {
        if (uploaderState.currentStep > 1) {
            uploaderState.currentStep--;
            updateStepUI();
        }
    });

    document.querySelectorAll('.step').forEach(el => {
        el.addEventListener('click', () => {
            const s = parseInt(el.getAttribute('data-step'));
            if (s && s !== uploaderState.currentStep) {
                // Determine if we are trying to go forward past step 1
                if (s > uploaderState.currentStep) {
                    tryGoToStep(s);
                } else {
                    // Going backwards is always allowed
                    uploaderState.currentStep = s;
                    updateStepUI();
                }
            }
        });
    });

    updateStepUI();
});

// --- Edit Mode Logic ---

async function checkForEditMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    if (!editId) return;

    function showEditOverlay() {
        const overlay = document.getElementById('publishOverlay');
        const title = document.getElementById('publishOverlayTitle');
        const text = document.getElementById('publishOverlayText');
        const bar = document.getElementById('publishProgressBar');
        if (overlay) {
            if (title) title.innerText = 'CARGANDO PRODUCTO...';
            if (text) text.innerText = 'Preparando entorno de edición';
            if (bar) bar.style.width = '100%';
            overlay.style.display = 'flex';
        }
    }

    function hideEditOverlay() {
        const overlay = document.getElementById('publishOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    showEditOverlay();

    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) {
            notify('Debes iniciar sesión para editar', 'error');
            return;
        }

        // Fetch product
        // Fetch product with a guaranteed 1-second overlay
        const minOverlayDuration = new Promise(resolve => setTimeout(resolve, 1000));

        const { data: product, error } = await window.supabaseClient
            .from('products')
            .select('*')
            .eq('id', editId)
            .single();

        await minOverlayDuration;

        if (error || !product) {
            notify('Producto no encontrado o no tienes permiso', 'error');
            return;
        }

        if (product.producer_id !== userId) {
            notify('No tienes permiso para editar este producto', 'error');
            setTimeout(() => window.location.href = '/cuenta/mis-kits.html', 2000);
            return;
        }

        console.log("📝 [Edit Mode] Loaded product:", product);
        uploaderState.editId = editId;

        // Change Publish Button Text
        const publishBtn = document.getElementById('publishNow');
        if (publishBtn) {
            publishBtn.innerHTML = 'Guardar Cambios';
            // Also update the final step confirmation button
            const step4Btn = document.querySelector('.step-content[data-step="4"] .btn-primary');
            if (step4Btn && step4Btn.id !== 'publishNow') step4Btn.innerHTML = 'Guardar Cambios';
        }

        // Update Title in UI 
        const titleEl = document.querySelector('.upload-header h1');
        if (titleEl) {
            titleEl.innerHTML = `Editar Producto <span style="color:var(--accent-purple); font-size: 0.8em; margin-left:10px;">(Modo Edición)</span>`;
        }

        // Pre-fill State
        uploaderState.title = product.name || product.title || '';
        document.getElementById('titleInput').value = uploaderState.title;

        if (product.description) {
            document.getElementById('descInput').value = product.description;
        }

        // Dropdowns
        if (product.bpm) {
            document.getElementById('bpmInput').value = product.bpm;
        }

        if (product.key) {
            document.getElementById('keyInput').value = product.key;
            // visually update custom select
            const keyDisp = document.getElementById('keyDisplay');
            if (keyDisp) keyDisp.innerHTML = `<span>${product.key}</span>`;
        }

        if (product.visibility) {
            document.getElementById('visibilityInput').value = product.visibility;
            const visDisp = document.getElementById('visibilityDisplay');
            if (visDisp) {
                const map = {
                    'public': '<i class="bi bi-globe" style="margin-right:8px; color:var(--accent-purple);"></i> Público',
                    'private': '<i class="bi bi-lock" style="margin-right:8px;"></i> Solo tú',
                    'unlisted': '<i class="bi bi-link" style="margin-right:8px;"></i> Oculto (Link)'
                };
                visDisp.innerHTML = map[product.visibility] || map['public'];
            }
        }

        // Custom Date
        if (product.release_date) {
            const dateInput = document.getElementById('dateInput') || document.getElementById('customReleaseDate');
            if (dateInput) {
                dateInput.value = product.release_date.split('T')[0];
            }
        }

        if (product.tags && Array.isArray(product.tags)) {
            uploaderState.tags = product.tags;
            renderTags();
        }

        // Licenses and Free Download
        // Wait for next render tick if licenses are populated async
        setTimeout(() => {
            if (product.is_free) {
                const fd = document.getElementById('freeDownloadToggle');
                if (fd) { fd.checked = true; fd.dispatchEvent(new Event('change')); }
            }

            if (product.price_basic && uploaderState.licensesState?.basic) {
                uploaderState.licensesState.basic.enabled = true;
                uploaderState.licensesState.basic.price = product.price_basic;
            }
            if (product.price_premium && uploaderState.licensesState?.premium) {
                uploaderState.licensesState.premium.enabled = true;
                uploaderState.licensesState.premium.price = product.price_premium;
            }
            if (product.price_trackout && uploaderState.licensesState?.trackout) {
                uploaderState.licensesState.trackout.enabled = true;
                uploaderState.licensesState.trackout.price = product.price_trackout;
            }
            if (product.price_unlimited && uploaderState.licensesState?.unlimited) {
                uploaderState.licensesState.unlimited.enabled = true;
                uploaderState.licensesState.unlimited.price = product.price_unlimited;
            }
            if (product.price_exclusive && uploaderState.licensesState?.exclusive) {
                uploaderState.licensesState.exclusive.enabled = true;
                uploaderState.licensesState.exclusive.price = product.price_exclusive;
                uploaderState.licensesState.exclusive.isOffer = false; // Based on whatever product logic
            }

            if (typeof window.renderLicenses === 'function') {
                window.renderLicenses();
            }
        }, 500);

        // Files: Pre-fill and Authorize URLs for display
        let rawCover = product.cover_url || product.image_url || product.image_uri || product.cover_uri;
        let rawMp3 = product.file_url || product.download_uri_mp3 || product.mp3_url || product.mp3_uri || product.audio_url;
        let rawWav = product.wav_url || product.download_uri_wav || product.wav_uri;
        let rawStems = product.stems_url || product.download_uri_stems || product.stems_uri;

        // Sign R2 URLs so they render in the browser (private buckets)
        if (typeof window.getAuthorizedUrl === 'function') {
            const [signedCover, signedMp3, signedWav, signedStems] = await Promise.all([
                window.getAuthorizedUrl(rawCover),
                window.getAuthorizedUrl(rawMp3),
                window.getAuthorizedUrl(rawWav),
                window.getAuthorizedUrl(rawStems)
            ]);
            uploaderState.old_cover_url = signedCover;
            uploaderState.old_mp3_url = signedMp3;
            uploaderState.old_wav_url = signedWav;
            uploaderState.old_stems_url = signedStems;

            // Preserve RAW URLs for cleanup (signed URLs have query params)
            // 🔥 Don't overwrite if it already exists (e.g. YouTube importer might have set it)
            if (!uploaderState.old_raw_cover) uploaderState.old_raw_cover = rawCover;
            if (!uploaderState.old_raw_mp3) uploaderState.old_raw_mp3 = rawMp3;
            if (!uploaderState.old_raw_wav) uploaderState.old_raw_wav = rawWav;
            if (!uploaderState.old_raw_stems) uploaderState.old_raw_stems = rawStems;
        } else {
            uploaderState.old_cover_url = rawCover;
            uploaderState.old_mp3_url = rawMp3;
            uploaderState.old_wav_url = rawWav;
            uploaderState.old_stems_url = rawStems;
        }

        uploaderState.old_stems_link = product.stems_link;

        if (uploaderState.old_cover_url) {
            uploaderState.cover = "EXISTING";
            const coverPreview = document.getElementById('coverPreview');
            const coverPlaceholder = document.getElementById('coverPlaceholder');
            const coverZone = document.getElementById('coverDropZone');

            if (coverPreview) {
                coverPreview.removeAttribute('crossorigin');

                coverPreview.onerror = () => {
                    console.warn("Cover image failed to load, trying background fallback...");
                    coverPreview.style.display = 'none';
                    if (coverZone) {
                        coverZone.style.backgroundImage = `url("${uploaderState.old_cover_url}")`;
                        coverZone.style.backgroundSize = 'cover';
                        coverZone.style.backgroundPosition = 'center';
                        coverZone.style.backgroundRepeat = 'no-repeat';
                    }
                };

                coverPreview.src = uploaderState.old_cover_url;
                coverPreview.style.display = 'block';
                if (coverPlaceholder) coverPlaceholder.style.display = 'none';
                if (coverZone) {
                    coverZone.classList.add('has-image'); // 🔥 Match CSS class for overlay
                    coverZone.style.backgroundImage = 'none';
                }
            }
        }

        if (uploaderState.old_mp3_url) {
            uploaderState.mp3_tagged = "EXISTING";
            updateZoneUI('mp3TaggedDropZone', 'MP3', '(Con Tag)', 'bi-check-circle-fill', '#10B981', 'MP3');

            // 🔥 Load waveform for existing product
            if (wavesurfer && typeof wavesurfer.load === 'function') {
                console.log("Loading existing MP3 into preview player...");
                wavesurfer.load(uploaderState.old_mp3_url);

                // Switch UI from placeholder to waveform
                const placeholder = document.getElementById('playerPlaceholder');
                const waveformContainer = document.getElementById('waveform');
                if (placeholder) placeholder.style.display = 'none';
                if (waveformContainer) waveformContainer.style.display = 'block';
            }
        }

        if (uploaderState.old_wav_url) {
            uploaderState.wav_untagged = "EXISTING";
            updateZoneUI('wavUntaggedDropZone', 'WAV Subido Previamente', '(Sin Tag)', 'bi-check-circle-fill', '#10B981', 'WAV');
        }

        if (uploaderState.old_stems_url || uploaderState.old_stems_link) {
            uploaderState.stems = "EXISTING";
            const msg = uploaderState.old_stems_link ? 'Link Subido Previamente' : 'ZIP Subido Previamente';
            updateZoneUI('stemsDropZone', msg, 'Stems', 'bi-check-circle-fill', '#10B981', 'Stems');
        }

        // Trigger character counters visually
        if (typeof initCharCounters === 'function') {
            document.getElementById('titleInput').dispatchEvent(new Event('input'));
            document.getElementById('descInput').dispatchEvent(new Event('input'));
        }

        // Update step 4 preview immediately
        if (typeof window.renderPreview === 'function') {
            window.renderPreview();
        }

    } catch (err) {
        console.error("Error setting edit mode:", err);
        notify('Error al cargar datos para edición', 'error');
    } finally {
        hideEditOverlay();
    }
}

// Helper to update zone UI for existing files
function updateZoneUI(zoneId, titleText, subtitleText, iconClass, color, fileType = '') {
    const zone = document.getElementById(zoneId);
    if (!zone) return;

    const icon = zone.querySelector('.slot-icon i') || zone.querySelector('.slot-icon svg') || zone.querySelector('i');
    const textContainer = zone.querySelector('div[style*="flex: 1"]') || zone.querySelector('.flex-grow-1');
    const ctaBtn = zone.querySelector('.upload-cta-btn span') || zone.querySelector('button span');

    let title = zone.querySelector('.fw-bold') || (textContainer ? textContainer.querySelector('div:first-child') : null);
    let subtitle = zone.querySelector('p') || (textContainer ? textContainer.querySelectorAll('div')[1] : null);

    zone.classList.add('has-file');
    zone.style.borderColor = color;
    zone.style.background = `rgba(16, 185, 129, 0.05)`;

    if (icon) {
        // User wants icon "normal" (not green) even if uploaded
        // icon.style.color = color; // REMOVED as per user request
    }
    if (title) {
        title.textContent = titleText;
        title.style.color = '#fff';
    }
    if (subtitle) {
        subtitle.textContent = subtitleText;
        subtitle.style.color = '#aaa'; // Keep it subtle grey
    }
    if (ctaBtn && fileType) {
        ctaBtn.textContent = `Cambiar ${fileType}`;
    }
}

// --- Char Counters ---

function initCharCounters() {
    const titleIn = document.getElementById('titleInput');
    const titleCount = document.getElementById('titleCount');
    const descIn = document.getElementById('descInput');
    const descCount = document.getElementById('descCount');

    const updateCount = (input, counter) => {
        if (input && counter) counter.textContent = input.value.length;
    };

    if (titleIn) {
        titleIn.addEventListener('input', () => updateCount(titleIn, titleCount));
        updateCount(titleIn, titleCount);
    }

    if (descIn) {
        descIn.addEventListener('input', () => {
            // Normalizar line-breaks: máximo 1 línea vacía entre párrafos (max 2 \n seguidos)
            const normalized = descIn.value.replace(/\n{3,}/g, '\n\n');
            if (descIn.value !== normalized) {
                const start = descIn.selectionStart;
                const end = descIn.selectionEnd;
                descIn.value = normalized;
                descIn.setSelectionRange(start, end);
            }
            updateCount(descIn, descCount);
        });
        updateCount(descIn, descCount);
    }
}

// --- Visibility Dropdown ---

function initVisibilityDropdown() {
    const trigger = document.getElementById('visibilityCustomTrigger');
    const list = document.getElementById('visibilityOptionsList');
    const chevron = document.getElementById('visibilityChevron');
    const display = document.getElementById('visibilityDisplay');
    const hiddenSelect = document.getElementById('visibilityInput');

    if (!trigger || !list || !hiddenSelect) return;

    // Poblar opciones desde el select invisible
    list.innerHTML = Array.from(hiddenSelect.options).map(opt => `
        <div class="dropdown-item ${opt.selected ? 'selected' : ''}" data-value="${opt.value}">
            ${getIconForVisibility(opt.value)}
            <span>${opt.text}</span>
        </div>
    `).join('');

    function getIconForVisibility(val) {
        if (val === 'public') return '<svg style="width:16px;height:16px;opacity:0.6" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
        if (val === 'private') return '<svg style="width:16px;height:16px;opacity:0.6" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
        return '<svg style="width:16px;height:16px;opacity:0.6" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
    }

    window.toggleVisibilityDropdown = (e) => {
        if (e) e.stopPropagation();
        const isVisible = list.style.display === 'block';
        list.style.display = isVisible ? 'none' : 'block';
        if (chevron) chevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
    };

    list.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const val = item.getAttribute('data-value');
            const text = item.querySelector('span').textContent;

            hiddenSelect.value = val;
            if (display) display.textContent = text;

            list.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');

            list.style.display = 'none';
            if (chevron) chevron.style.transform = 'rotate(0deg)';
            console.log('Visibility selection:', val);
        });

        item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.05)';
        item.onmouseleave = () => item.style.background = 'transparent';
    });

    document.addEventListener('click', () => {
        list.style.display = 'none';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    });
}

// --- Key Dropdown ---

function initKeyDropdown() {
    const trigger = document.getElementById('keyCustomTrigger');
    const list = document.getElementById('keyOptionsList');
    const chevron = document.getElementById('keyChevron');
    const display = document.getElementById('keyDisplay');
    const hiddenSelect = document.getElementById('keyInput');

    if (!trigger || !list || !hiddenSelect) return;

    // Poblar opciones desde el select invisible
    list.innerHTML = Array.from(hiddenSelect.options).map(opt => `
        <div class="dropdown-item ${opt.selected ? 'selected' : ''}" data-value="${opt.value}">
            <span>${opt.text}</span>
        </div>
    `).join('');

    window.toggleKeyDropdown = (e) => {
        if (e) e.stopPropagation();
        const isVisible = list.style.display === 'block';
        list.style.display = isVisible ? 'none' : 'block';
        if (chevron) chevron.style.transform = isVisible ? 'rotate(180deg)' : 'rotate(0deg)';
    };

    list.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const val = item.getAttribute('data-value');
            const text = item.querySelector('span').textContent.trim();

            hiddenSelect.value = val;
            if (display) display.textContent = text;

            list.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');

            list.style.display = 'none';
            if (chevron) chevron.style.transform = 'rotate(0deg)';

            if (window.renderPreview) window.renderPreview();
        });

        item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.05)';
        item.onmouseleave = () => item.style.background = 'transparent';
    });

    document.addEventListener('click', () => {
        list.style.display = 'none';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    });
}

// --- Date Init ---

function initDateTime() {
    const dateInput = document.getElementById('dateInput');
    if (!dateInput) return;

    // Fixed: informative metadata (today's date), non-editable.
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    dateInput.value = `${year}-${month}-${day}`;
    dateInput.readOnly = true;
}

// --- Tag Logic ---

function initTagsInput() {
    const tagIn = document.getElementById('tagInput');
    if (!tagIn) return;

    tagIn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = tagIn.value.trim();
            if (val) addTag(val);
        }
    });

    tagIn.addEventListener('blur', () => {
        const val = tagIn.value.trim();
        if (val) addTag(val);
    });

    tagIn.addEventListener('input', () => {
        if (tagIn.value.length > 30) {
            tagIn.value = tagIn.value.substring(0, 30);
        }
    });
}

window.addTag = (tag) => {
    if (uploaderState.tags.length >= 3) return;

    // Max 30 chars
    const cleanTag = tag.substring(0, 30).trim();
    if (!cleanTag) return;

    // Duplicates check
    if (uploaderState.tags.some(t => t.toLowerCase() === cleanTag.toLowerCase())) {
        const input = document.getElementById('tagInput');
        if (input) input.value = '';
        return;
    }

    uploaderState.tags.push(cleanTag);
    renderTags();
    window.renderPreview();
    const input = document.getElementById('tagInput');
    if (input) input.value = '';
};

window.removeTag = (tag) => {
    uploaderState.tags = uploaderState.tags.filter(t => t !== tag);
    renderTags();
    window.renderPreview();
};

window.clearTags = () => {
    uploaderState.tags = [];
    renderTags();
    window.renderPreview();
};

function renderTags() {
    const container = document.getElementById('tagsContainer');
    const tagIn = document.getElementById('tagInput');
    if (!container || !tagIn) return;

    // Keep the input, but clear the chips
    const chips = container.querySelectorAll('.tag-chip');
    chips.forEach(c => c.remove());

    uploaderState.tags.forEach(tag => {
        const chip = document.createElement('div');
        chip.className = 'tag-chip';
        chip.innerHTML = `${tag} <span onclick="window.removeTag('${tag}')">×</span>`;
        container.insertBefore(chip, tagIn);
    });

    // Check limits
    if (uploaderState.tags.length >= 3) {
        tagIn.disabled = true;
        tagIn.placeholder = 'Límite alcanzado';
        tagIn.style.cursor = 'not-allowed';
    } else {
        tagIn.disabled = false;
        tagIn.placeholder = 'Escribe un tag...';
        tagIn.style.cursor = 'text';
    }
}

// Porting support functions for Auto Tag
const STOP_WORDS = ['de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'fue', 'este', 'ha', 'sido', 'porque', 'muy', 'sin', 'sobre', 'ser', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'estados', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'fueron', 'ese', 'eso', 'había', 'ante', 'unos', 'ella', 'entre', 'poco'];

const MEGA_TAG_POOL = ['Trap', 'Drill', 'Rage', 'Hyperpop', 'RnB', 'Afrobeats', 'Dancehall', 'Reggaeton', 'Boom Bap', 'Lo-Fi', 'Phonk', 'Dark Trap', 'EDM', 'House', 'Deep House', 'Techno', 'Dubstep', 'Pop', 'Latin Trap', 'Jersey Club', 'Footwork', 'Trance', 'Cloud Rap', 'Alternative', 'Synthwave', 'DnB', 'Future Bass', 'Ambient', 'Cinematic', 'Hardstyle', 'Dark', 'Emotional', 'Melodic', 'Aggressive', 'Chill', 'Atmospheric', 'Spacey', 'Bouncy', 'Sad', 'Mystery', 'Energetic', 'Smooth', 'Vintage', 'Retro', 'Futuristic', 'Epic', 'Uplifting', 'Minimal', 'Dreamy', 'Gritty', 'Warm', 'Cold', 'Organic', 'Digital', 'Punchy', 'Clean', 'Dirty', 'Distorted', 'Drake', 'Travis Scott', 'Future', 'Metro Boomin', 'Kanye West', 'Lil Uzi Vert', 'Playboi Carti', 'Yeat', 'Ken Carson', 'Destroy Lonely', 'Baby Keem', 'The Weeknd', 'Bryson Tiller', 'Bad Bunny', 'Feid', 'Jhayco', 'Anuel AA', 'Myke Towers', 'Peso Pluma', 'Natanael Cano', 'Rosalía', 'Billie Eilish', 'SZA', 'Doja Cat', 'Skrillex', 'Kaytranada', 'Fred again..', 'Lil Durk', 'Pop Smoke', 'Ice Spice', 'Don Toliver', 'Juice WRLD', 'XXXTentacion', 'Cordae', 'J. Cole', 'Kendrick Lamar', 'Rauw Alejandro', 'Mora', 'Quevedo', '808s', 'Kicks', 'Snares', 'Hi-hats', 'Open hats', 'Cymbals', 'Percs', 'Fills', 'Loops', 'Vox samples', 'FX', 'Risers', 'Impacts', 'Sweeps', 'One shots', 'Melody loops', 'Chord stabs', 'Drum loops', 'Basslines', 'Breaks', 'Transitions', 'Ambient textures', 'Guitar loops', 'Piano loops', 'Synth loops', 'Brass hits', 'Strings', 'Pads', 'Arps', 'High quality', 'Analog', 'Digital', 'Clean', 'Dark', 'Hard hitting', 'Crisp', 'Warm', 'Glitchy', 'Processed', 'Raw', 'Mastered', 'Unmastered', 'Distorted', 'Layered', 'Dry', 'Wet', 'Stereo', 'Mono', 'Punchy', 'Vintage', 'Modern', 'Saturated', 'Looped', 'Chopped', 'Beatmaking', 'Vocal processing', 'Trap beats', 'Drill beats', 'Emotional beats', 'Club tracks', 'Industry beats', 'Type beats', 'Film scoring', 'Game Audio', 'Live performance', 'Remixes', 'Sound design', 'TikTok edits', 'Reels content', 'YouTube beats', 'Background music', 'Freestyles', 'Cyphers', 'Hard Trap', 'Detroit style', 'NY Drill', 'UK Drill', 'Club vibes', 'Emotional trap', 'Dark rage', 'PluggnB', 'West Coast', 'Miami bass', 'Phonk cowbell', 'Memphis style', 'Latin trap club', 'Afro chill', 'Afro fusion', 'Jersey bounce', 'Rage glitch', 'Ambient score', 'Cyberpunk', 'Ethereal', 'Slow + Reverb', 'FL Studio', 'Ableton Live', 'Logic Pro', 'Pro Tools', 'Studio One', 'Cubase', 'Reason', 'Bitwig', 'Reaper'];

async function generateTagsSmart(title, description) {
    let candidates = new Set();
    const words = (title + ' ' + description).toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.includes(w));

    words.forEach(w => candidates.add(w));

    const pool = [...MEGA_TAG_POOL].sort(() => Math.random() - 0.5);
    pool.slice(0, 10).forEach(tag => candidates.add(tag.toLowerCase()));

    return Array.from(candidates);
}

window.quickAutoFillTags = async function () {
    const title = document.getElementById('titleInput')?.value.trim();
    const desc = document.getElementById('descInput')?.value.trim();
    const suggestionContainer = document.getElementById('tagsSuggestions');

    if (!title) {
        notify('Escribe un título primero', 'error');
        return;
    }

    if (uploaderState.tags.length >= 3) {
        notify('Límite de 3 tags alcanzado', 'info');
        return;
    }

    const suggestions = await generateTagsSmart(title, desc);
    const available = suggestions.filter(s => !uploaderState.tags.includes(s));

    if (available.length === 0) {
        notify('No hay más sugerencias', 'info');
        return;
    }

    if (suggestionContainer) {
        suggestionContainer.innerHTML = '<small style="color: #666; width: 100%; margin-bottom: 4px;">Sugerencias:</small>';
        suggestionContainer.style.display = 'flex';

        available.slice(0, 3).forEach(tag => {
            const span = document.createElement('span');
            span.className = 'tag-suggestion';
            span.textContent = tag;
            span.onclick = () => {
                if (uploaderState.tags.length < 3) {
                    addTag(tag);
                    span.remove();
                    if (uploaderState.tags.length >= 3) suggestionContainer.style.display = 'none';
                }
            };
            suggestionContainer.appendChild(span);
        });
    }
};

// --- Publish Interceptor Hook ---
// Intercepts the global handlePublish function to save license settings before publishing.
// --- Publish Override ---
// We completely override window.handlePublish to fix the broken legacy logic for NEW beats.
// This version handles: 
// 1. Capturing ALL Step 1 (Title, Cover, MP3, WAV, Stems, Visibility, Date, Desc)
// 2. Capturing ALL Step 2 (BPM, Key, Tags, Licenses, Free Download)
// 3. Database: INSERT for new beats, UPDATE for editing.
// 4. Integration: YouTube Upload + License Settings persistence.

// --- R2 Storage Logic ---
async function uploadToR2(file, folder = 'uploads', onProgress = null) {
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('No hay sesión activa para subir a R2');

        // 1. Get Signed URL from Backend (Forcing v2/Account 2)
        const response = await fetch('/api/r2/upload-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                fileName: file.name,
                fileType: file.type || 'application/octet-stream',
                folder: folder,
                fileSize: file.size,
                version: 'v2' // 🔥 ALWAYS use Account 2
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al obtener URL de R2');
        }

        const { uploadUrl, key, publicUrl } = await response.json();

        // 2. Direct Upload using XMLHttpRequest for progress tracking
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', uploadUrl);
            xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

            if (onProgress && xhr.upload) {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        onProgress(percentComplete);
                    }
                };
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    console.log(`✅ [R2] Archivo subido con éxito: ${key}`);
                    resolve({ key, publicUrl });
                } else {
                    reject(new Error(`La subida directa a R2 falló con status ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('Error de red al subir a R2'));
            xhr.send(file);
        });
    } catch (error) {
        console.error('❌ Error en uploadToR2:', error);
        throw error;
    }
}

window.handlePublish = async function () {
    console.log('🚀 [PUBLISH] Initiating new handlePublish override...');

    // 1. Double Submission Prevention
    if (window.isPublishing) return;
    window.isPublishing = true;

    const btn = document.getElementById('publishNow');
    const originalText = btn ? btn.innerHTML : 'Publicar Ahora';
    if(btn) btn.setAttribute('data-original-text', originalText);

    // 2. Auth Check
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const userId = session?.user?.id;

    if (!userId) {
        console.error('🛑 Blocked Publish: userId is null.');
        showToast('Error: No se detectó sesión de usuario. Recarga la página.', 'error');
        window.isPublishing = false;
        return;
    }

    const overlay = document.getElementById('publishOverlay');
    const overlayTitle = document.getElementById('publishOverlayTitle');
    const overlayText = document.getElementById('publishOverlayText');
    const progressBar = document.getElementById('publishProgressBar');

    try {
        // Reset progress bar
        if (progressBar) progressBar.style.width = '0%';

        // 3. YouTube Pre-Interception (Custom Flow for beats-yt.html)
        const isEditing = !!uploaderState.editId;
        
        if (uploaderState.isYouTubeUpload && !isEditing) {
            console.log('🎥 [YT] Starting specialized YouTube flow...');
            
            try {
                // 3a. Auth First (Before Overlay)
                if (!window.YouTubeUploader) {
                    throw new Error('YouTubeUploader no cargado. Revisa la consola.');
                }
                
                console.log('🎥 [YT] Requesting auth before starting rendering...');
                const token = await window.YouTubeUploader.requestAuth();
                // If it resolves, we have a token (or it was already cached)
                console.log('✅ [YT] Auth obtained, proceeding to render.');

                if (overlay) {
                    if (overlayTitle) overlayTitle.innerText = 'GENERANDO VIDEO...';
                    if (overlayText) overlayText.innerText = 'Preparando video en 720p para YouTube';
                    overlay.style.display = 'flex';
                    if (progressBar) progressBar.style.width = '10%';
                }

                // 3b. Prepare Blobs
                const coverBlob = uploaderState.cover;
                const audioBlob = uploaderState.mp3_tagged;

                if (!coverBlob || !audioBlob) {
                    throw new Error('Faltan archivos para generar el video (Portada/MP3)');
                }

                // 3c. Render Video (Server-side)
                if (overlayText) overlayText.innerText = 'Renderizando en el servidor (3-5 seg)...';
                // Use the token for render API too if needed (optional if Supabase handles it, but good for context)
                const session = await window.supabaseClient.auth.getSession();
                const supabaseToken = session.data.session?.access_token;
                
                const formData = new FormData();
                formData.append('cover', coverBlob, 'cover.jpg');
                formData.append('audio', audioBlob, 'audio.mp3');

                const response = await fetch('/api/youtube/render-video', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${supabaseToken}` },
                    body: formData
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || `Error de render: ${response.status}`);
                }

                const videoArrayBuffer = await response.arrayBuffer();
                const renderedVideoBlob = new Blob([videoArrayBuffer], { type: 'video/mp4' });
                
                if (progressBar) progressBar.style.width = '30%';

                // 3d. YouTube Upload
                const beatTitle = document.getElementById('titleInput').value || 'Sin Título';
                const publicSlug = generatePublicSlug(beatTitle);
                const beatKey = document.querySelector('#keyInput')?.value || 'N/A';
                const beatBpm = document.getElementById('bpmInput')?.value || 'N/A';
                const userDesc = document.getElementById('descInput').value || '';
                const tagList = uploaderState.tags.map(t => `#${t.replace(/\s+/g, '')}`).join(' ');

                const ytMetadata = {
                    title: beatTitle,
                    description: `🛒 Comprar/Descargar: https://offszn.lat/beat/${publicSlug}\nKey: ${beatKey}\nBPM: ${beatBpm}\n\n${userDesc}\n\n${tagList}`,
                    tags: uploaderState.tags
                };

                window.YouTubeUploader.setRenderedVideo(renderedVideoBlob);

                if (overlayText) overlayText.innerText = 'Subiendo a YouTube: 0%';
                
                // handleUpload will now use the token we already got (cached in v2)
                const videoId = await window.YouTubeUploader.handleUpload(ytMetadata);
                console.log('✅ [YT] Upload Success:', videoId);
                uploaderState.youtube_video_id = videoId; // Store for final DB save
                showToast('Video subido a YouTube correctamente 📹', 'success');
                
                if (progressBar) progressBar.style.width = '50%';
            } catch (ytErr) {
                console.error('❌ [YT] specialized flow fail:', ytErr);
                window.isPublishing = false; // 🔥 IMPORTANT: Reset state so user can retry
                
                // Get error text for checking
                const errText = (ytErr.message || ytErr.error || '').toLowerCase();

                // Check if it's a cancel
                const isCancel = errText.includes('access_denied') || 
                                 errText.includes('denied') || 
                                 errText.includes('superseded') || 
                                 errText.includes('timeout') ||
                                 errText.includes('popup_closed_by_user');
                
                if (isCancel) {
                    console.warn('⚠️ [YT] Auth cancelled or timed out. Stopping flow.');
                    if (overlay) overlay.style.display = 'none';
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = btn.getAttribute('data-original-text') || 'Publicar Ahora';
                    }
                    return; // EXIT handlePublish immediately so user can retry
                }

                // If it's a real error, we hide overlay and show toast
                if (overlay) overlay.style.display = 'none';
                showToast('Error en YouTube: ' + (ytErr.message || 'Error desconocido'), 'error');
                
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = btn.getAttribute('data-original-text') || 'Publicar Ahora';
                }
                return; // EXIT handlePublish
            }
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = 'Procesando...';
        }

        // 4. General Validations
        if (!validateStep(1) || !validateStep(2)) {
            showToast('Completa todos los campos obligatorios', 'error');
            window.isPublishing = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
            return;
        }

        // --- Royalty Split Validation ---
        const totalPerc = window.calculateCurrentOwnerPercent() + uploaderState.collaborators.reduce((acc, c) => acc + (c.percent || 0), 0);
        if (Math.round(totalPerc) !== 100) {
            showToast('La suma de regalías debe ser exactamente 100%', 'error');
            window.isPublishing = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
            return;
        }

        // Show Overlay
        if (overlay) {
            if (overlayTitle) overlayTitle.innerText = 'SUBIENDO PRODUCTO...';
            if (overlayText) overlayText.innerText = 'por favor no cierres esta pestaña';
            overlay.style.display = 'flex';
        }

        // 5. File Uploads to R2
        const urlPath = window.location.pathname.toLowerCase();
        let productType = 'beat'; // Default
        if (urlPath.includes('drum-kits')) productType = 'drumkit';
        else if (urlPath.includes('loop-kits')) productType = 'loopkit';
        else if (urlPath.includes('presets')) productType = 'preset';

        let image_url = window.originalProductData?.image_url || null;
        let audio_url = window.originalProductData?.audio_url || null;
        let mp3_url = window.originalProductData?.mp3_url || null;
        let wav_url = window.originalProductData?.wav_url || null;
        let stems_url = window.originalProductData?.stems_url || null;

        // Progress Tracking State
        const filesToUpload = [];
        if (uploaderState.cover && uploaderState.cover !== "EXISTING") filesToUpload.push({ file: uploaderState.cover, folder: 'products/covers', type: 'cover' });
        if (uploaderState.mp3_tagged && uploaderState.mp3_tagged !== "EXISTING") filesToUpload.push({ file: uploaderState.mp3_tagged, folder: 'beats/mp3', type: 'mp3' });
        if (uploaderState.wav_untagged && uploaderState.wav_untagged !== "EXISTING") filesToUpload.push({ file: uploaderState.wav_untagged, folder: 'secure-products/beats/wav', type: 'wav' });
        if (uploaderState.stems && uploaderState.stems !== "EXISTING") filesToUpload.push({ file: uploaderState.stems, folder: 'secure-products/beats/stems', type: 'stems' });

        const totalFiles = filesToUpload.length;
        let filesProcessed = 0;

        for (const item of filesToUpload) {
            const currentFileIndex = filesProcessed;
            const progressHandler = (p) => {
                const individualContribution = 100 / totalFiles;
                const baseProgress = currentFileIndex * individualContribution;
                const currentFileProgress = (p / 100) * individualContribution;
                const totalProgress = baseProgress + currentFileProgress;
                if (progressBar) progressBar.style.width = `${totalProgress}%`;

                let fileDesc = 'Archivo';
                if (item.type === 'cover') fileDesc = 'Portada';
                if (item.type === 'mp3') fileDesc = 'Audio MP3';
                if (item.type === 'wav') fileDesc = 'Audio WAV';
                if (item.type === 'stems') fileDesc = 'Stems ZIP';

                if (overlayText) overlayText.innerText = `Subiendo ${fileDesc}: ${Math.round(p)}%`;
            };

            const res = await uploadToR2(item.file, item.folder, progressHandler);

            if (item.type === 'cover') image_url = res.publicUrl;
            if (item.type === 'mp3') {
                // 🔥 FIX: Use publicUrl from backend or construct v2 URL, NEVER hardcode old v1 account
                audio_url = res.publicUrl;
                mp3_url = audio_url;
            }
            if (item.type === 'wav') wav_url = res.key;
            if (item.type === 'stems') stems_url = res.key;

            filesProcessed++;
        }

        // If in Edit Mode, we need to preserve existing URLs if they weren't changed
        if (uploaderState.editId) {
            if (uploaderState.cover === "EXISTING") image_url = uploaderState.old_cover_url;
            if (uploaderState.mp3_tagged === "EXISTING") {
                audio_url = uploaderState.old_mp3_url;
                mp3_url = uploaderState.old_mp3_url;
            }
            if (uploaderState.wav_untagged === "EXISTING") wav_url = uploaderState.old_wav_url;
            if (uploaderState.stems === "EXISTING") stems_url = uploaderState.old_stems_url;
        }

        if (progressBar) progressBar.style.width = '100%';
        if (overlayText) overlayText.innerText = '¡Archivos subidos! Guardando datos...';

        // 6. Build Final Data Object
        const finalData = {
            producer_id: userId,
            name: document.getElementById('titleInput').value,
            public_slug: generatePublicSlug(document.getElementById('titleInput').value),
            description: document.getElementById('descInput').value || '',
            release_date: document.getElementById('dateInput').value || null,
            visibility: document.getElementById('visibilityInput').value || 'public',
            bpm: parseInt(document.getElementById('bpmInput')?.value) || null,
            key: document.getElementById('keyInput')?.value || 'Sin tonalidad',
            tags: uploaderState.tags,
            image_url,
            audio_url,
            mp3_url,
            wav_url,
            stems_url,
            // stems_link: uploaderState.stemsLink || null, // stems_link is not in the schema, we'll rely on license_settings jsonb for this if needed
            r2_version: 'v2',
            price_basic: licensesState.offszn_basic.enabled ? licensesState.offszn_basic.price : null,
            price_premium: licensesState.offszn_premium.enabled ? licensesState.offszn_premium.price : null,
            price_stems: licensesState.offszn_unlimited.enabled ? licensesState.offszn_unlimited.price : null,
            price_exclusive: licensesState.offszn_exclusive.enabled ? licensesState.offszn_exclusive.price : null,
            is_free: uploaderState.free_download || false,
            product_type: productType, // Ensure visibility in filters
            status: 'approved', // Ensure visibility on Profile & Explore
            licenses: licensesState, // Save the full state for future reference
            collaborators: uploaderState.collaborators.map(c => ({
                id: c.id,
                name: c.name,
                role: c.role,
                percent: c.percent,
                is_guest: c.is_guest
            })),
            youtube_id: uploaderState.youtube_video_id || null,
            youtube_url: uploaderState.youtube_video_id ? `https://www.youtube.com/watch?v=${uploaderState.youtube_video_id}` : null
        };

        // 7. DB Operation (INSERT vs UPDATE)
        let product_id = uploaderState.editId || window.currentEditId;

        // 7.b Perform Database Write
        if (!product_id) {
            console.log('✨ [PUBLISH] INSERTING new product...');
            const { data, error } = await supabaseClient.from('products').insert([finalData]).select('id').single();
            if (error) throw error;
            product_id = data.id;
        } else {
            console.log('📝 [PUBLISH] UPDATING existing product:', product_id);
            const { error } = await supabaseClient.from('products').update(finalData).eq('id', product_id);
            if (error) throw error;
        }

        // 7.c Post-Success Cleanup (ONLY after DB update succeeds)
        if (uploaderState.editId) {
            const filesToDelete = [];
            // If new cover, delete old
            if (uploaderState.cover && uploaderState.cover !== "EXISTING" && uploaderState.old_raw_cover) {
                filesToDelete.push(uploaderState.old_raw_cover);
            }
            // If new mp3, delete old
            if (uploaderState.mp3_tagged && uploaderState.mp3_tagged !== "EXISTING" && uploaderState.old_raw_mp3) {
                filesToDelete.push(uploaderState.old_raw_mp3);
            }
            // If new wav, delete old
            if (uploaderState.wav_untagged && uploaderState.wav_untagged !== "EXISTING" && uploaderState.old_raw_wav) {
                filesToDelete.push(uploaderState.old_raw_wav);
            }
            // If new stems or new link, and there was an old raw stem path
            if ((uploaderState.stems !== "EXISTING" || uploaderState.stemsLink) && uploaderState.old_raw_stems) {
                filesToDelete.push(uploaderState.old_raw_stems);
            }

            if (filesToDelete.length > 0) {
                console.log('🧹 [Cleanup] Queuing R2 cleanup for:', filesToDelete);
                // We fire and forget or await? Better await to be sure, but failure won't stop the success UI
                AuthUtils.deleteFromR2(filesToDelete).catch(ce => console.warn("Cleanup error:", ce));
            }
        }

        // 8. Collaborator Invitations Logic
        if (product_id && uploaderState.collaborators.length > 0) {
            console.log('✉️ [PUBLISH] Creating collaborator invitations...');
            const invitations = uploaderState.collaborators.map(c => ({
                product_id: product_id,
                inviter_id: userId,
                collaborator_id: c.is_guest ? null : c.id,
                guest_name: c.is_guest ? c.name : null,
                role: c.role,
                royalty_percent: c.percent,
                status: 'pending'
            }));

            const { error: collabError } = await supabaseClient.from('collab_invitations').upsert(invitations, {
                onConflict: 'product_id, collaborator_id' // Basic conflict handling if editing
            });

            if (collabError) {
                console.warn('⚠️ Collab invitations error:', collabError);
            }
        }

        // 9. Persistence
        await window.saveLastUsedLicenses(); // Save license settings to user profile

        isDirty = false;
        showToast('¡Beat publicado con éxito!', 'success');

        setTimeout(() => {
            window.location.href = '/cuenta/mis-kits.html';
        }, 1500);

    } catch (err) {
        console.error('❌ [PUBLISH] Error:', err);
        showToast('Error al publicar: ' + err.message, 'error');
        if (overlay) overlay.style.display = 'none';
        window.isPublishing = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};

// --- Collaborators Logic (Step 3) ---

let collabSearchTimeout = null;
let availableUsers = [];
let currentSearchQuery = '';

window.initCollaborators = async () => {
    const input = document.getElementById('collabSearch');
    if (!input) return;

    // Fetch current user info for "Tú" row
    try {
        if (window.supabaseClient) {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session?.user?.id) {
                const { data, error } = await window.supabaseClient
                    .from('users')
                    .select('id, nickname, avatar_url, first_name, last_name')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (data) {
                    uploaderState.currentUser = data;
                    renderCollabs(); // Initial render for "Tú"
                }
            }
        }
    } catch (err) {
        console.error('❌ [COLLABS] Error fetching current user:', err);
    }

    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        currentSearchQuery = query;
        clearTimeout(collabSearchTimeout);

        if (query.length < 1) {
            hideCollabDropdown();
            return;
        }

        collabSearchTimeout = setTimeout(() => searchUsers(query), 300);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.collab-search-container')) {
            hideCollabDropdown();
        }
    });
};

async function searchUsers(query) {
    try {
        if (!window.supabaseClient) return;
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const currentUserId = session?.user?.id;

        const { data, error } = await window.supabaseClient
            .from('users')
            .select('id, nickname, avatar_url')
            .ilike('nickname', `%${query}%`)
            .neq('id', currentUserId)
            .limit(5);

        if (error) throw error;
        availableUsers = data || [];
        renderCollabDropdown();
    } catch (err) {
        console.error('❌ [COLLABS] Search error:', err);
    }
}

function renderCollabDropdown() {
    const dropdown = document.getElementById('collabDropdown');
    if (!dropdown) return;

    let html = '';

    if (availableUsers.length > 0) {
        html = availableUsers.map(user => `
            <div class="off-collab-item" onclick="selectCollaborator('${user.id}')">
                <img src="${user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nickname || 'U')}&background=333&color=fff`}" 
                     class="off-collab-avatar" 
                     onerror="this.src='https://ui-avatars.com/api/?name=U&background=333&color=fff'">
                <span class="off-collab-name">${user.nickname}</span>
            </div>
        `).join('');
    }

    const alreadyExists = availableUsers.some(u => u.nickname.toLowerCase() === currentSearchQuery.toLowerCase());
    if (currentSearchQuery.length >= 2 && !alreadyExists) {
        html += `
            <div class="off-collab-item" onclick="selectCollaborator('GUEST:${currentSearchQuery}')">
                <div class="off-collab-avatar" style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);color:#8b5cf6;">
                    <span>👤</span>
                </div>
                <div style="display:flex;flex-direction:column;flex:1;">
                    <span class="off-collab-name">Invitar "${currentSearchQuery}"</span>
                    <span style="font-size:11px;color:#666;">Usuario no encontrado</span>
                </div>
                <i class="fas fa-plus" style="color:#8b5cf6;font-size:12px;"></i>
            </div>
        `;
    }

    if (!html) {
        dropdown.innerHTML = '<div class="off-collab-no-results">No se encontraron usuarios</div>';
    } else {
        dropdown.innerHTML = html;
    }

    // Update IDs for safety if needed, but keeping collabDropdown for now as it's the target
    dropdown.className = 'off-collab-dropdown';
    dropdown.style.display = 'block';
}

function hideCollabDropdown() {
    const dropdown = document.getElementById('collabDropdown');
    if (dropdown) dropdown.style.display = 'none';
}

window.selectCollaborator = (userId) => {
    if (uploaderState.collaborators.length >= 4) {
        showToast('Máximo 5 colaboradores (tú + 4)', 'error');
        return;
    }

    if (userId.startsWith('GUEST:')) {
        const guestName = userId.replace('GUEST:', '');
        if (uploaderState.collaborators.some(c => c.name === guestName)) {
            showToast('Este colaborador ya fue agregado', 'error');
            return;
        }

        uploaderState.collaborators.push({
            id: `guest_${Date.now()}`,
            name: guestName,
            avatar_url: null,
            role: 'Productor',
            percent: 0,
            is_guest: true,
            invite_link: `https://offszn.lat/pages/register?invite=${encodeURIComponent(guestName.trim().toLowerCase().replace(/\s+/g, '-'))}`
        });
    } else {
        const user = availableUsers.find(u => u.id === userId);
        if (!user) return;

        if (uploaderState.collaborators.some(c => c.id === userId)) {
            showToast('Este usuario ya fue agregado', 'error');
            return;
        }

        uploaderState.collaborators.push({
            id: user.id,
            name: user.nickname,
            avatar_url: user.avatar_url,
            role: 'Productor',
            percent: 0,
            is_guest: false
        });
    }

    document.getElementById('collabSearch').value = '';
    hideCollabDropdown();
    renderCollabs();
};

window.renderCollabs = () => {
    const list = document.getElementById('collabList');
    if (!list) return;

    const owner = uploaderState.currentUser || { nickname: 'Tú', avatar_url: null };

    // MATCH IMAGE 3 LAYOUT
    let html = `
        <div class="off-collab-row owner">
            <div class="off-collab-user-info">
                <img src="${owner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(owner.nickname || 'U')}&background=333&color=fff`}" 
                     class="off-collab-avatar" 
                     onerror="this.src='https://ui-avatars.com/api/?name=U&background=333&color=fff'">
                <span class="off-collab-name">${owner.nickname} (Propietario)</span>
            </div>
            <div class="off-collab-mid-role">Rol Principal</div>
            <div class="off-collab-controls">
                <div class="off-collab-percent-wrapper">
                    <input type="number" id="mainUserPercent" value="100" 
                           oninput="updateMainUserPercent(this.value)"
                           onkeydown="if(['e', 'E', '+', '-', '.'].includes(event.key)) event.preventDefault();"
                           min="0" max="100">
                    <span>%</span>
                </div>
                <div style="width:36px;"></div> <!-- Spacer matching SVG delete btn width -->
            </div>
        </div>
    `;

    html += uploaderState.collaborators.map((c, i) => `
        <div style="margin-bottom:12px;">
            <div class="off-collab-row">
                <div class="off-collab-user-info">
                    <img src="${c.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || 'U')}&background=333&color=fff`}" 
                         class="off-collab-avatar" 
                         onerror="this.src='https://ui-avatars.com/api/?name=U&background=333&color=fff'">
                    <span class="off-collab-name">${c.name}</span>
                </div>
                <div class="off-collab-controls">
                    <div class="off-collab-role-custom">
                        <div class="off-collab-role-trigger" onclick="toggleCollabRoleDropdown(${i}, event)">
                            <span id="roleDisplay_${i}">${c.role}</span>
                            <i id="roleChevron_${i}">
                                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/></svg>
                            </i>
                        </div>
                        <div class="off-collab-role-list" id="roleList_${i}">
                            <div class="off-collab-role-item ${c.role === 'Productor' ? 'selected' : ''}" onclick="selectCollabRole(${i}, 'Productor')">Productor</div>
                            <div class="off-collab-role-item ${c.role === 'Ingeniero' ? 'selected' : ''}" onclick="selectCollabRole(${i}, 'Ingeniero')">Ingeniero</div>
                            <div class="off-collab-role-item ${c.role === 'Artista' ? 'selected' : ''}" onclick="selectCollabRole(${i}, 'Artista')">Artista</div>
                        </div>
                    </div>
                    <div class="off-collab-percent-wrapper">
                        <input type="number" value="${c.percent}" 
                               oninput="updateCollabPercent(${i}, this.value)" 
                               onkeydown="if(['e', 'E', '+', '-', '.'].includes(event.key)) event.preventDefault();"
                               min="0" max="100"
                               tabindex="${i + 2}">
                        <span>%</span>
                    </div>
                    <button type="button" class="off-collab-delete" onclick="removeCollab(${i})" title="Eliminar">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                    </button>
                </div>
            </div>
            ${c.is_guest ? `
                <div class="off-collab-invite-box">
                    <p>Comparte este link para que se una a OFFSZN:</p>
                    <div class="off-collab-invite-row">
                        <input type="text" value="${c.invite_link}" readonly onclick="this.select()">
                        <button type="button" onclick="copyInviteLink('${c.invite_link}', this)">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>
                        </button>
                    </div>
                </div>
            ` : ''}
        </div>
    `).join('');

    list.innerHTML = html;
    list.className = 'off-collab-list';
    updateMainUserPercentUI(); // Use the UI-only update for first load
};

window.removeCollab = (index) => {
    uploaderState.collaborators.splice(index, 1);
    syncCollabInputs(); // Re-sync inputs after removal
    renderCollabs(); // Re-render to update UI
};

window.updateCollab = (index, field, value) => {
    uploaderState.collaborators[index][field] = value;
};

window.toggleCollabRoleDropdown = (index, e) => {
    if (e) e.stopPropagation();
    // Close others
    document.querySelectorAll('.off-collab-role-list').forEach((list, i) => {
        if (i !== index) list.style.display = 'none';
        const chev = document.getElementById(`roleChevron_${i}`);
        if (chev && i !== index) chev.style.transform = 'rotate(0deg)';
    });

    const list = document.getElementById(`roleList_${index}`);
    const chevron = document.getElementById(`roleChevron_${index}`);
    if (!list) return;

    const isVisible = list.style.display === 'block';
    list.style.display = isVisible ? 'none' : 'block';
    if (chevron) chevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
};

window.selectCollabRole = (index, role) => {
    uploaderState.collaborators[index].role = role;

    // UI Update without full re-render
    const display = document.getElementById(`roleDisplay_${index}`);
    if (display) display.textContent = role;

    const list = document.getElementById(`roleList_${index}`);
    if (list) {
        list.style.display = 'none';
        list.querySelectorAll('.off-collab-role-item').forEach(item => {
            item.classList.toggle('selected', item.textContent === role);
        });
    }

    const chevron = document.getElementById(`roleChevron_${index}`);
    if (chevron) chevron.style.transform = 'rotate(0deg)';
};

// SMART REBALANCE: Mantiene la suma en 100% ajustando otros campos automáticamente
window.calculateCurrentOwnerPercent = () => {
    const collabsSum = uploaderState.collaborators.reduce((acc, c) => acc + (c.percent || 0), 0);
    return Math.max(0, 100 - collabsSum);
};

window.syncCollabInputs = () => {
    const inputs = document.querySelectorAll('.off-collab-percent-wrapper input');
    // El primer input es el dueño, los demás son colaboradores (index + 1)
    uploaderState.collaborators.forEach((c, i) => {
        const input = inputs[i + 1];
        if (input) input.value = c.percent;
    });
};

window.updateMainUserPercentUI = () => {
    const input = document.getElementById('mainUserPercent');
    if (input) {
        const remaining = window.calculateCurrentOwnerPercent();
        input.value = remaining;
    }
};

window.updateCollabPercent = (index, value) => {
    let newVal = parseInt(value.toString().replace(/[^\d]/g, '')) || 0;
    if (newVal > 100) newVal = 100;

    const collab = uploaderState.collaborators[index];
    const oldVal = collab.percent || 0;
    let diff = newVal - oldVal;

    if (diff > 0) {
        // Aumentando: quitar al dueño primero
        let ownerP = window.calculateCurrentOwnerPercent();
        let takeFromOwner = Math.min(diff, ownerP);
        diff -= takeFromOwner;

        // Si falta, quitar a otros
        if (diff > 0) {
            for (let i = 0; i < uploaderState.collaborators.length; i++) {
                if (i === index) continue;
                let c = uploaderState.collaborators[i];
                let take = Math.min(diff, c.percent || 0);
                c.percent = (c.percent || 0) - take;
                diff -= take;
                if (diff <= 0) break;
            }
        }
        collab.percent = newVal - diff; // Por si sum > 100 literal
    } else {
        // Disminuyendo: el dueño absorbe
        collab.percent = newVal;
    }

    window.syncCollabInputs();
    window.updateMainUserPercentUI();
};

window.updateMainUserPercent = (value) => {
    let newVal = parseInt(value.toString().replace(/[^\d]/g, '')) || 0;
    if (newVal > 100) newVal = 100;

    let currentOwner = window.calculateCurrentOwnerPercent();
    let diff = newVal - currentOwner;

    if (diff > 0) {
        // Dueño quiere más: quitar a colaboradores
        for (let i = 0; i < uploaderState.collaborators.length; i++) {
            let c = uploaderState.collaborators[i];
            let take = Math.min(diff, c.percent || 0);
            c.percent = (c.percent || 0) - take;
            diff -= take;
            if (diff <= 0) break;
        }
    }
    // Si diff < 0 (dueño quiere menos), los colaboradores NO se auto-asignan puntos, 
    // simplemente el dueño bajará a newVal y la diferencia queda "disponible" (dueño sube).
    // Espera, el calculateCurrentOwnerPercent siempre calcula 100 - sum. 
    // Si queremos que el dueño sea 20 y antes era 50, sum de collabs debe subir a 80? No.
    // Solo permitimos que el dueño "empuje" a los demás.

    window.syncCollabInputs();
    window.updateMainUserPercentUI();
};

window.copyInviteLink = (link, btn) => {
    const fallbackCopy = (text) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showToast('Link de invitación copiado', 'success');
        } catch (err) {
            showToast('Error al copiar link', 'error');
        }
        document.body.removeChild(textArea);
    };

    if (!navigator.clipboard || !navigator.clipboard.writeText) {
        fallbackCopy(link);
    } else {
        navigator.clipboard.writeText(link).then(() => {
            showToast('Link de invitación copiado', 'success');
        }).catch(() => {
            fallbackCopy(link);
        });
    }

    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.42-6.446z"/></svg>`;
    setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
};

/**
 * Loads and displays any active global promotion for the producer.
 */
async function loadActivePromotion() {
    try {
        const textEl = document.getElementById('activePromoText');
        if (!textEl) return;

        if (!window.supabaseClient) {
            textEl.textContent = '💡 No tienes promociones activas';
            return;
        }

        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session?.user?.id) {
            textEl.textContent = '💡 No tienes promociones activas';
            return;
        }

        const { data, error } = await window.supabaseClient
            .from('promociones_offszn_seguro')
            .select('*')
            .eq('producer_id', session.user.id)
            .maybeSingle();

        if (error || !data || !data.active) {
            textEl.textContent = '💡 No tienes promociones activas';
            return;
        }

        const buy = data.buy_quantity || 0;
        const get = data.get_quantity || 0;

        if (buy === 0 && get === 0) {
            textEl.textContent = '💡 No tienes promociones activas';
        } else {
            textEl.innerHTML = ` Promociones activas: <strong style="color: #fff;">${buy + get}×${buy}</strong>`;
        }

    } catch (err) {
        console.error('[PROMO] Error:', err);
        const textEl = document.getElementById('activePromoText');
        if (textEl) textEl.textContent = '💡 No tienes promociones activas';
    }
}

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    initCollaborators();
    loadActivePromotion();

    // Global click-outside to close all custom dropdowns
    document.addEventListener('click', () => {
        // Roles
        document.querySelectorAll('.off-collab-role-list').forEach(list => list.style.display = 'none');
        document.querySelectorAll('.off-collab-role-trigger i').forEach(chev => chev.style.transform = 'rotate(0deg)');

        // Collab search dropdown
        hideCollabDropdown();

        // Publish dropdown
        const publishList = document.getElementById('publishDropdownContent');
        if (publishList) publishList.style.display = 'none';
    });

    // Real-time Preview Listeners
    document.getElementById('titleInput')?.addEventListener('input', () => window.renderPreview());
    document.getElementById('bpmInput')?.addEventListener('input', () => window.renderPreview());
    // Key is updated via click on custom dropdown items, should call renderPreview there too.

    // Initial render
    window.renderPreview();
});

window.togglePublishDropdown = (e) => {
    if (e) e.stopPropagation();
    const list = document.getElementById('publishDropdownContent');
    if (!list) return;

    const isVisible = list.style.display === 'block';
    list.style.display = isVisible ? 'none' : 'block';
};

window.renderPreview = () => {
    console.log('--- Rendering Preview Step 4 ---');
    const u = uploaderState.currentUser;
    const userName = u ? (u.nickname || u.display_name || u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Productor') : 'Productor';

    // Preview Card Elements
    const cardTitle = document.getElementById('previewCardTitle');
    const cardProducer = document.getElementById('previewCardProducer');
    const cardTags = document.getElementById('previewCardTags');
    const cardCover = document.getElementById('previewCardCover');

    // Values from state if possible, otherwise DOM (as failback)
    const currentTitle = uploaderState.title || document.getElementById('titleInput')?.value || 'Sin título';
    const currentBpm = uploaderState.bpm || document.getElementById('bpmInput')?.value || '--';
    const currentKey = uploaderState.key || document.getElementById('keyDisplay')?.textContent || 'Sin tonalidad';

    if (cardTitle) cardTitle.textContent = currentTitle;
    if (cardProducer) cardProducer.textContent = userName;

    if (cardTags) {
        cardTags.innerHTML = uploaderState.tags.map(t => `<span class="card-tag">#${t}</span>`).join('');
    }

    // Cover Preview
    if (cardCover && uploaderState.cover) {
        let url = null;
        if (uploaderState.cover instanceof Blob) {
            try {
                url = URL.createObjectURL(uploaderState.cover);
            } catch (e) {
                console.error("Error creating object URL for cover:", e);
            }
        } else if (typeof uploaderState.cover === 'string') {
            url = (uploaderState.cover === 'EXISTING') ? uploaderState.old_cover_url : uploaderState.cover;
        }

        if (url) {
            cardCover.style.backgroundImage = `url(${url})`;
            cardCover.style.backgroundSize = 'cover';
            cardCover.style.backgroundPosition = 'center';
            cardCover.innerHTML = ''; // Remove "Sin portada"
        }
    }

    // Verification Panel
    const verifyDetails = document.getElementById('verifyDetails');
    if (verifyDetails) {
        verifyDetails.innerHTML = `
            <div class="verify-item"><span>BPM:</span> <strong>${currentBpm}</strong></div>
            <div class="verify-item"><span>Key (Tonalidad):</span> <strong>${currentKey}</strong></div>
        `;
    }

    // Files Verification
    const verifyFiles = document.getElementById('verifyFiles');
    if (verifyFiles && uploaderState) {
        let filesHtml = '';
        if (uploaderState.mp3_tagged) filesHtml += `<div class="verify-file-row"><i class="bi bi-check-circle-fill"></i> MP3 (Tagged)</div>`;
        if (uploaderState.wav_untagged) filesHtml += `<div class="verify-file-row"><i class="bi bi-check-circle-fill"></i> WAV (Untagged)</div>`;
        if (uploaderState.stems || uploaderState.stemsLink) filesHtml += `<div class="verify-file-row"><i class="bi bi-check-circle-fill"></i> STEMS</div>`;

        verifyFiles.innerHTML = filesHtml || '<div style="color: #666; font-size: 13px;">Ningún archivo seleccionado</div>';
    }

    // Collabs Verification
    const verifyCollabs = document.getElementById('verifyCollabs');
    const collabSection = document.getElementById('verifyCollabSection');
    if (verifyCollabs && uploaderState.collaborators.length > 0) {
        if (collabSection) collabSection.style.display = 'block';
        verifyCollabs.innerHTML = uploaderState.collaborators.map(c => `
            <div class="verify-item">
                <span>${c.name}</span>
                <strong>${c.percent}%</strong>
            </div>
        `).join('');
    } else if (collabSection) {
        collabSection.style.display = 'none';
    }

    // 🔥 YouTube Integration Preview
    const ytSection = document.getElementById('verifyYoutubeSection');
    const ytStatus = document.getElementById('verifyYoutubeStatus');
    if (ytSection && ytStatus) {
        if (!uploaderState.editId) {
            ytSection.style.display = 'block';
            ytStatus.innerHTML = uploaderState.isYouTubeUpload 
                ? `<span style="color:#8b5cf6;"><i class="bi bi-youtube"></i> Habilitado (720p + 320k)</span>`
                : `<span style="color:#666;">Deshabilitado</span>`;
        } else {
            ytSection.style.display = 'none'; // Skip for edit mode
        }
    }
};
