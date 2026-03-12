// --- Global Constants ---
const MAX_SIZES = {
    PORTADA: 20 * 1024 * 1024, // 20 MB
    MP3: 50 * 1024 * 1024,     // 50 MB
    WAV: 60 * 1024 * 1024,     // 60 MB
    STEMS: 50 * 1024 * 1024    // 50 MB
};

// --- Local State (Exposed globally for synchronization) ---
window.uploaderState = {
    cover: null,
    mp3_tagged: null,
    wav_untagged: null,
    stems: null,
    stemsLink: null,
    currentStep: 1,
    loop: false
};
let uploaderState = window.uploaderState;

// --- Licensing Logic ---
const DEFAULT_LICENSES = {
    basic: { name: 'Basic', price: 20.00, enabled: true, features: ['MP3 Tagged'], id: 'basic' },
    premium: { name: 'Premium', price: 50.00, enabled: true, features: ['MP3 Tagged', 'WAV Untagged'], id: 'premium' },
    unlimited: { name: 'Unlimited', price: 100.00, enabled: true, features: ['MP3 Tagged', 'WAV Untagged', 'Stems'], id: 'unlimited' },
    exclusive: { name: 'Exclusive', price: 300.00, enabled: true, features: ['MP3 Tagged', 'WAV Untagged', 'Stems'], id: 'exclusive' }
};

let licensesState = {};

function initLicenses() {
    licensesState = JSON.parse(JSON.stringify(DEFAULT_LICENSES));
    renderLicenses();
}

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
        
        if (id === 'basic') {
            requiredDisplay = '(MP3 TAGGED)';
            if (!hasMP3) missingFiles.push('MP3');
        }
        if (id === 'premium') {
            requiredDisplay = '(MP3 + WAV)';
            if (!hasMP3 || !hasWAV) missingFiles.push('Archivos');
        }
        if (id === 'unlimited' || id === 'exclusive') {
            requiredDisplay = '(STEMS)';
            if (!hasMP3 || !hasWAV || !hasStems) missingFiles.push('STEMS');
        }

        const isComplete = missingFiles.length === 0;
        const statusText = isComplete 
            ? `Archivo: Cargado ${requiredDisplay}` 
            : `Archivo: Faltante ${requiredDisplay}`;

        card.innerHTML = `
            <div class="license-main-row">
                <div class="license-left-group">
                    <label class="toggle-switch">
                        <input type="checkbox" ${license.enabled ? 'checked' : ''} onchange="window.toggleLicense('${id}')">
                        <span class="slider"></span>
                    </label>
                    <span class="offszn_nombre">${license.name === 'Basic' ? 'MP3 Lease' : (license.name === 'Premium' ? 'WAV Lease' : (license.name === 'Unlimited' ? 'Trackout (Stems)' : 'Ilimitado'))}</span>
                </div>
                <div class="license-right-group">
                    <div class="price-box" style="${license.enabled ? '' : 'visibility: hidden;'}">
                        <span class="currency">$</span>
                        <input type="number" 
                            class="license-price-input" 
                            value="${license.price}" 
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
                    <input type="checkbox" ${isFreeEnabled ? 'checked' : ''} onchange="window.toggleFreeDownload()">
                    <span class="slider"></span>
                </label>
                <span class="offszn_nombre">Descarga Gratis</span>
            </div>
        </div>
        <div class="free-download-description">
            Los usuarios podrán descargar el archivo <strong>MP3 con Tag</strong> gratuitamente a cambio de seguirte o dejar su email (uso promocional).
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
        licensesState[id].price = parseFloat(price);
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
    modal.classList.add('active');    if (cropper) cropper.destroy();
    
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

    if (extension && !file.name.toLowerCase().endsWith(extension)) {
        notify(`Selecciona un archivo ${extension.toUpperCase()}.`, 'error');
        return;
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

document.addEventListener('DOMContentLoaded', () => {
    initPlayer();
    initCoverHandlers();
    setupFileSlot('mp3Tagged', 'mp3_tagged', MAX_SIZES.MP3, 'Cambiar MP3', '.mp3');
    setupFileSlot('wavUntagged', 'wav_untagged', MAX_SIZES.WAV, 'Cambiar WAV', '.wav');
    setupFileSlot('stems', 'stems', MAX_SIZES.STEMS, 'Cambiar Stems', '.zip');

    initCharCounters();
    initVisibilityDropdown();
    initKeyDropdown();
    initDateTime();
    initLicenses();

    // --- Next Button Trigger ---
    document.getElementById('nextBtn')?.addEventListener('click', () => {
        if (uploaderState.currentStep === 1) {
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
                return;
            }
        }

        if (uploaderState.currentStep < TOTAL_STEPS) {
            uploaderState.currentStep++;
            updateStepUI();
        }
    });

    // Hide errors when user starts fixing them
    document.getElementById('titleInput')?.addEventListener('input', () => {
        document.getElementById('offszn_error_title').style.display = 'none';
    });

    document.getElementById('mp3TaggedDropZone')?.addEventListener('click', () => {
        document.getElementById('offszn_error_mp3').style.display = 'none';
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
            if (s) { uploaderState.currentStep = s; updateStepUI(); }
        });
    });

    updateStepUI();
});

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
