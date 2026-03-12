

function showMainUploadForm() {
    // Hub removed — form is always visible now
    const mc = document.getElementById('main-upload-container');
    if (mc) mc.style.display = 'block';
    const qa = document.querySelector('.quick-actions');
    if (qa) qa.style.display = 'block';
}

// ========================================
// CONFIGURACIÓN INICIAL
// ========================================
// Use the global client initialized by auth-utils.js
const supabaseClient = window.supabaseClient;

if (!supabaseClient) {
    console.error("Critical: Global Supabase not found. Ensure auth-utils.js is loaded.");
    throw new Error("Critical: Global Supabase not found. Ensure auth-utils.js is loaded.");
}


let API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : 'https://offszn.lat/api';

// ðŸŽ¯ SISTEMA DE TAGS INTELIGENTE (sin IA externa)
// Tag system initialized
// ?? ANALIZAR AUDIO (BPM, duración, energía)
let audioAnalysisWorker = null;

async function analyzeAudio(audioFile) {
    return new Promise(async (resolve) => {
        try {
            // 1. Get Total Duration quickly using a temporary Audio element
            const tempAudio = document.createElement('audio');
            tempAudio.src = URL.createObjectURL(audioFile);
            const totalDuration = await new Promise((res) => {
                tempAudio.onloadedmetadata = () => res(Math.floor(tempAudio.duration));
                tempAudio.onerror = () => res(0);
            });
            URL.revokeObjectURL(tempAudio.src);

            // 2. Decode only a 60-second segment (from middle if possible)
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Slice the file to ~2MB (roughly 60s of 256kbps audio)
            // We take it from the middle (roughly) to get a representative part
            const startByte = audioFile.size > 5000000 ? 2000000 : 0;
            const endByte = startByte + 3000000; // ~3MB chunk
            const blobSlice = audioFile.slice(startByte, endByte);
            const arrayBuffer = await blobSlice.arrayBuffer();

            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const channelData = audioBuffer.getChannelData(0);

            // 3. OFF-LOAD BPM & KEY DETECTION TO WORKER
            if (!audioAnalysisWorker) {
                audioAnalysisWorker = new Worker('/script/audio-analysis-worker.js');
            }

            // Use a one-time listener for this specific call
            const results = await new Promise((resWorker) => {
                const handler = (e) => {
                    audioAnalysisWorker.removeEventListener('message', handler);
                    resWorker(e.data);
                };
                audioAnalysisWorker.addEventListener('message', handler);
                audioAnalysisWorker.postMessage({
                    channelData: channelData,
                    sampleRate: audioBuffer.sampleRate
                }, [channelData.buffer]); // Transferable for zero-copy
            });

            // 4. Calculate Energy / Mood (Lightweight, can stay here or move to worker)
            let sum = 0;
            for (let i = 0; i < channelData.length; i++) sum += Math.abs(channelData[i]);
            const avgEnergy = sum / channelData.length;

            let mood = 'chill';
            if (avgEnergy > 0.15) mood = 'hard';
            else if (avgEnergy > 0.08) mood = 'melodic';
            else if (avgEnergy > 0.04) mood = 'ambient';

            resolve({
                duration: totalDuration || Math.floor(audioBuffer.duration),
                bpm: results.bpm || 0,
                key: results.key || null,
                energy: avgEnergy,
                mood
            });

        } catch (error) {
            console.error('?? Audio analysis failed:', error);
            resolve({ duration: 0, bpm: 0, key: null, energy: 0, mood: 'unknown' });
        }
    });
}


// ðŸ”„ FALLBACK: Keyword matching inteligente & REPERTORIO MASIVO
async function generateTagsSmart(title, description, audioParams) {
    console.log('ðŸ¤– Generando tags fallback...');
    const stopWords = ['de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'fue', 'este', 'ha', 'sido', 'porque', 'muy', 'sin', 'sobre', 'ser', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'estados', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'fueron', 'ese', 'eso', 'había', 'ante', 'unos', 'ella', 'entre', 'poco'];

    let candidates = new Set();

    // 1. Estrategia por Audio (BPM y Mood)
    if (audioParams) {
        if (audioParams.bpm > 140) candidates.add('trap');
        if (audioParams.bpm > 120 && audioParams.bpm < 130) candidates.add('house');
        if (audioParams.bpm > 80 && audioParams.bpm < 100) candidates.add('classic hiphop');
        if (audioParams.bpm < 80) candidates.add('lofi');
        if (audioParams.mood) candidates.add(audioParams.mood);
    }

    // 2. Estrategia por Palabras Clave del Título
    const words = (title + ' ' + description).toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.includes(w));

    words.forEach(w => candidates.add(w));

    // 3. Estrategia: REPERTORIO MASIVO (User provided)
    const megaTagPool = [
        // Genres
        'Trap', 'Drill', 'Rage', 'Hyperpop', 'RnB', 'Afrobeats', 'Dancehall', 'Reggaeton', 'Boom Bap', 'Lo-Fi', 'Phonk', 'Dark Trap', 'EDM', 'House', 'Deep House', 'Techno', 'Dubstep', 'Pop', 'Latin Trap', 'Jersey Club', 'Footwork', 'Trance', 'Cloud Rap', 'Alternative', 'Synthwave', 'DnB', 'Future Bass', 'Ambient', 'Cinematic', 'Hardstyle',
        // Moods
        'Dark', 'Emotional', 'Melodic', 'Aggressive', 'Chill', 'Atmospheric', 'Spacey', 'Bouncy', 'Sad', 'Mystery', 'Energetic', 'Smooth', 'Vintage', 'Retro', 'Futuristic', 'Epic', 'Uplifting', 'Minimal', 'Dreamy', 'Gritty', 'Warm', 'Cold', 'Organic', 'Digital', 'Punchy', 'Clean', 'Dirty', 'Distorted',
        // Artists
        'Drake', 'Travis Scott', 'Future', 'Metro Boomin', 'Kanye West', 'Lil Uzi Vert', 'Playboi Carti', 'Yeat', 'Ken Carson', 'Destroy Lonely', 'Baby Keem', 'The Weeknd', 'Bryson Tiller', 'Bad Bunny', 'Feid', 'Jhayco', 'Anuel AA', 'Myke Towers', 'Peso Pluma', 'Natanael Cano', 'Rosalía', 'Billie Eilish', 'SZA', 'Doja Cat', 'Skrillex', 'Kaytranada', 'Fred again..', 'Lil Durk', 'Pop Smoke', 'Ice Spice', 'Don Toliver', 'Juice WRLD', 'XXXTentacion', 'Cordae', 'J. Cole', 'Kendrick Lamar', 'Rauw Alejandro', 'Mora', 'Quevedo',
        // Sound Types
        '808s', 'Kicks', 'Snares', 'Hi-hats', 'Open hats', 'Cymbals', 'Percs', 'Fills', 'Loops', 'Vox samples', 'FX', 'Risers', 'Impacts', 'Sweeps', 'One shots', 'Melody loops', 'Chord stabs', 'Drum loops', 'Basslines', 'Breaks', 'Transitions', 'Ambient textures', 'Guitar loops', 'Piano loops', 'Synth loops', 'Brass hits', 'Strings', 'Pads', 'Arps',
        // Quality/Descriptors
        'High quality', 'Analog', 'Digital', 'Clean', 'Dark', 'Hard hitting', 'Crisp', 'Warm', 'Glitchy', 'Processed', 'Raw', 'Mastered', 'Unmastered', 'Distorted', 'Layered', 'Dry', 'Wet', 'Stereo', 'Mono', 'Punchy', 'Vintage', 'Modern', 'Saturated', 'Looped', 'Chopped',
        // Usage
        'Beatmaking', 'Vocal processing', 'Trap beats', 'Drill beats', 'Emotional beats', 'Club tracks', 'Industry beats', 'Type beats', 'Film scoring', 'Game Audio', 'Live performance', 'Remixes', 'Sound design', 'TikTok edits', 'Reels content', 'YouTube beats', 'Background music', 'Freestyles', 'Cyphers',
        // Subgenres/Styles
        'Hard Trap', 'Detroit style', 'NY Drill', 'UK Drill', 'Club vibes', 'Emotional trap', 'Dark rage', 'PluggnB', 'West Coast', 'Miami bass', 'Phonk cowbell', 'Memphis style', 'Latin trap club', 'Afro chill', 'Afro fusion', 'Jersey bounce', 'Rage glitch', 'Ambient score', 'Cyberpunk', 'Ethereal', 'Slow + Reverb',
        // DAWs
        'FL Studio', 'Ableton Live', 'Logic Pro', 'Pro Tools', 'Studio One', 'Cubase', 'Reason', 'Bitwig', 'Reaper'
    ];

    // Normalizar a minúsculas para evitar duplicados visuales
    const normalizedPool = megaTagPool.map(t => t.toLowerCase());

    // Mezclar pool aleatoriamente
    normalizedPool.sort(() => Math.random() - 0.5);

    // Agregar al set de candidatos
    normalizedPool.forEach(tag => candidates.add(tag));

    // Convertir a array
    let finalTags = Array.from(candidates);

    // ðŸ”¥ MEZCLAR EL RESULTADO FINAL PARA QUE LAS KEYWORDS NO SIEMPRE SALGAN PRIMERO
    finalTags.sort(() => Math.random() - 0.5);

    // Devolver una cantidad generosa
    return finalTags.slice(0, 60);
}

let currentStep = 1;
const totalSteps = 4;
let completedSteps = [];
let currentDraftId = null;
let userId = null;
let wavesurfer;

const formData = {
    // Sync with global uploaderState
    get files() {
        return {
            mp3_tagged: window.uploaderState?.mp3_tagged,
            wav_untagged: window.uploaderState?.wav_untagged,
            stems: window.uploaderState?.stems,
            kit: null // Legacy
        };
    },
    get coverBlob() { return window.uploaderState?.cover; }
};

// ========================================
// TOAST SYSTEM (Debounced)
// ========================================
let lastToastMsg = '';
let lastToastTime = 0;

window.showToast = function (message, type = 'success') {
    const now = Date.now();
    if (message === lastToastMsg && (now - lastToastTime) < 2000) {
        return;
    }
    lastToastMsg = message;
    lastToastTime = now;

    const existing = document.querySelectorAll('.elite-toast');
    existing.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `elite-toast ${type}`;

    const shortMap = {
        'Ya tienes el máximo de 3 tags. Elimina uno para usar Auto Tag.': 'Máximo 3 tags alcanzado',
        'Debes subir el MP3 Tagged (Preview)': 'Falta MP3 Tagged',
        'Debes subir una portada (1080x1080px)': 'Falta Portada',
        'La fecha de lanzamiento es obligatoria': 'Falta Fecha',
        'No hay más sugerencias disponibles': 'Sin más sugerencias'
    };

    const finalMsg = shortMap[message] || message;

    toast.innerHTML = `
                <i class="${type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle'}"></i>
                <span>${finalMsg}</span>
            `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// ðŸ”¥ AUDIO SWITCHER GLOBALS
let audioBlobs = { mp3: null, wav: null };
let currentAudioType = 'mp3'; // 'mp3' or 'wav'

let filesUploaded = {
    cover: false,
    kit: false,
    audio: false
};

// ðŸ”¥ NUEVO: Prevenir uploads duplicados
let uploadsInProgress = {
    cover: false,
    kit: false,
    audio: false
};

let tags = [];
let collaborators = [];
let isDirty = false;
let isSaving = false;
let autosaveTimeout = null;

// ðŸ”¥ NUEVO: Cache de handlers para evitar duplicados
let fileHandlersInitialized = false;

// ========================================
// INICIALIZACIÓN
// ========================================
// ========================================
// INICIALIZACIÓN
// ========================================
async function initAll() {
    const urlParams = new URLSearchParams(window.location.search);
    const editingProductId = urlParams.get('edit');
    const draftId = urlParams.get('draft');

    // Show loading overlay only for actual data loading
    if (editingProductId || draftId) {
        showLoading('Cargando producto...', 'Por favor espera un momento.');
    }

    try {
        if (!editingProductId) {
            // Limpiar todo si es nuevo
            currentDraftId = null;
            formData.files = { mp3_tagged: null, wav_untagged: null, stems: null };
            formData.coverBlob = null;
            filesUploaded = { cover: false, mp3_tagged: false, wav_untagged: false, stems: false };
            tags = [];
            collaborators = [];
            isDirty = false;

            const visibilityInput = document.getElementById('visibilityInput');
            if (visibilityInput) {
                visibilityInput.disabled = false;
                visibilityInput.classList.remove('skeleton');
            }
        }

        await checkAuth();
        await loadUserProfile();
        initLicenses();
        initDateTime();
        initWaveSurfer();
        initFileHandlers();
        initTagsInput();
        initExitModal();

        if (editingProductId) {
            await loadProductForEdit(editingProductId);
        } else if (draftId) {
            await loadDraft(draftId);
        } else {
            // Carga automática del último borrador si no se especifica ID
            await loadDraft();
        }

        initCustomKeySelect();

    } catch (error) {
        console.error('Initialization error:', error);
    } finally {
        hideLoading();
    }

    // ========================================
    // 🔥 KEY LOGIC: BPM & CUSTOM SELECT UI
    // ========================================

    // 1. Init Custom Select Options (Auto-fill from hidden select)
    function initCustomKeySelect() {
        const hiddenSelect = document.getElementById('keyInput');
        const customList = document.getElementById('keyOptionsList');
        if (!hiddenSelect || !customList) return;

        customList.innerHTML = Array.from(hiddenSelect.options).map(opt => `
                    <div class="custom-option" 
                        onclick="window.selectCustomKey('${opt.value}')" 
                        style="padding: 10px 14px; cursor: pointer; color: #ccc; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s; font-size: 14px;">
                        ${opt.text}
                    </div>
                `).join('');

        // Hover styles
        customList.querySelectorAll('.custom-option').forEach(el => {
            el.onmouseenter = () => { el.style.background = 'rgba(255,255,255,0.05)'; el.style.color = '#fff'; };
            el.onmouseleave = () => { el.style.background = 'transparent'; el.style.color = '#ccc'; };
        });
    }

    // 2. Toggle Dropdown
    window.toggleKeyDropdown = function (e) {
        if (e) e.stopPropagation();
        const list = document.getElementById('keyOptionsList');
        const chevron = document.getElementById('keyChevron');
        if (!list) return;

        const isVisible = list.style.display === 'block';
        list.style.display = isVisible ? 'none' : 'block';
        if (chevron) chevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';

        const publishDropdown = document.getElementById('publishDropdown');
        if (publishDropdown && isVisible) publishDropdown.style.display = 'none';
    }

    // 3. Select Item
    window.selectCustomKey = function (value) {
        const hiddenSelect = document.getElementById('keyInput');
        const display = document.getElementById('keyDisplay');
        const list = document.getElementById('keyOptionsList');
        const chevron = document.getElementById('keyChevron');

        if (hiddenSelect) {
            hiddenSelect.value = value;
            hiddenSelect.dispatchEvent(new Event('change'));
        }

        if (display) {
            display.textContent = value || 'Sin tonalidad';
            display.style.color = value ? '#fff' : '#ccc';
        }

        const trigger = document.getElementById('keyCustomTrigger');
        if (trigger) {
            trigger.style.borderColor = '';
            trigger.classList.remove('error');
        }
        if (typeof clearInlineError === 'function') {
            clearInlineError('keyCustomTrigger');
        }

        if (list) list.style.display = 'none';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }

    // 4. Update UI Helper (for drafts)
    window.updateKeyDisplayFromInput = function () {
        const hiddenSelect = document.getElementById('keyInput');
        const display = document.getElementById('keyDisplay');
        if (hiddenSelect && display) {
            display.textContent = hiddenSelect.value || 'Sin tonalidad';
            display.style.color = hiddenSelect.value ? '#fff' : '#ccc';
        }
    }

    // 5. Close on Click Outside
    document.addEventListener('click', e => {
        if (!e.target.closest('.select-wrapper')) {
            const list = document.getElementById('keyOptionsList');
            const chevron = document.getElementById('keyChevron');
            if (list) list.style.display = 'none';
            if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
    });

    // ========================================
    // ðŸ”¥ YOUTUBE IMPORT HANDLING
    // ========================================
    const urlParamsYT = new URLSearchParams(window.location.search);
    if (urlParamsYT.get('from') === 'youtube') {
        const title = urlParamsYT.get('title');
        const desc = urlParamsYT.get('desc');
        const tagsParam = urlParamsYT.get('tags');
        const bpm = urlParamsYT.get('bpm');
        const key = urlParamsYT.get('key');

        if (title) {
            const titleIn = document.getElementById('titleInput');
            titleIn.value = title;
            document.getElementById('titleCount').innerText = title.length;
            titleIn.classList.add('filled'); // Visual helper
        }
        if (desc) {
            const descIn = document.getElementById('descInput');
            descIn.value = desc;
            document.getElementById('descCount').innerText = desc.length;
        }
        if (bpm && document.getElementById('bpmInput')) {
            document.getElementById('bpmInput').value = bpm;
        }
        if (key && typeof window.selectCustomKey === 'function') {
            window.selectCustomKey(key);
        }

        if (tagsParam) {
            // Navigate to tags step to ensure UI exists if needed (usually tags container is always there)
            const tagsList = tagsParam.split(',').filter(t => t.trim());
            // Wait a bit to ensure addTag is ready
            setTimeout(() => {
                tagsList.forEach(tag => {
                    if (typeof window.addTag === 'function') window.addTag(tag.trim());
                    else if (typeof addTag === 'function') addTag(tag.trim());
                });
            }, 500);
        }
        isDirty = true;
        window.history.replaceState({}, document.title, window.location.pathname); // Clean URL
    }

    // ========================================
    // 🔥 AUTO-ACTIVATE YOUTUBE MODE IF yt=true
    // ========================================
    if (urlParamsYT.get('yt') === 'true') {
        console.log('📹 [INIT] yt=true detected — enabling YouTube Upload Mode');
        if (typeof enableYouTubeUploadMode === 'function') {
            enableYouTubeUploadMode();
        }
    }

    // Event listeners básicos
    document.getElementById('titleInput').addEventListener('input', e => {
        document.getElementById('titleCount').textContent = e.target.value.length;
        isDirty = true;
        // autoFillTags(); // ðŸ”¥ ELIMINADO: Usuario pidió que no sea automático
        clearTimeout(autosaveTimeout);
        // autosaveTimeout = setTimeout(() => saveDraftAuto(), 2000); // ðŸ”¥ AUTOSAVE DISABLED
    });

    document.getElementById('descInput').addEventListener('input', e => {
        document.getElementById('descCount').textContent = e.target.value.length;
        isDirty = true;
        clearTimeout(autosaveTimeout);
        // autosaveTimeout = setTimeout(() => saveDraftAuto(), 2000); // ðŸ”¥ AUTOSAVE DISABLED
    });



    // 6. Metadata Auto-Parse
    const KEYS = [
        'C Major', 'C Minor', 'C# Major', 'C# Minor', 'D Major', 'D Minor', 'D# Major', 'D# Minor',
        'E Major', 'E Minor', 'F Major', 'F Minor', 'F# Major', 'F# Minor', 'G Major', 'G Minor',
        'G# Major', 'G# Minor', 'A Major', 'A Minor', 'A# Major', 'A# Minor', 'B Major', 'B Minor'
    ];

    async function autoParseMetadata(title) {
        // BPM
        const bpmMatch = title.match(/\b(\d{2,3})\s?(bpm)?\b/i);
        if (bpmMatch) {
            const bpm = bpmMatch[1];
            const bpmInput = document.getElementById('bpmInput');
            if (!bpmInput.value) {
                bpmInput.value = bpm;
                bpmInput.style.borderColor = '#00ff88';
                setTimeout(() => bpmInput.style.borderColor = '', 1000);
            }
        }

        // Key
        const hiddenSelect = document.getElementById('keyInput');
        for (const key of KEYS) {
            if (title.toLowerCase().includes(key.toLowerCase())) {
                if (hiddenSelect && !hiddenSelect.value) {
                    selectCustomKey(key);
                    // Highlight
                    const trigger = document.getElementById('keyCustomTrigger');
                    if (trigger) {
                        trigger.style.borderColor = '#00ff88';
                        setTimeout(() => trigger.style.borderColor = '', 1000);
                    }
                }
                break;
            }
        }
    }

    // Clean up
    window.selectKey = null;



    // Navegación entre steps
    document.querySelectorAll('.step').forEach(step => {
        step.addEventListener('click', () => {
            const targetStep = parseInt(step.dataset.step);
            if (targetStep === currentStep) return;

            if (targetStep < currentStep) {
                currentStep = targetStep;
                updateStepUI();
                if (currentStep === 4) {
                    // 4. Render Preview (YouTube Mode)
                    if (window.renderPreviewUI) {
                        window.renderPreviewUI('youtube-preview-container', {
                            title: title,
                            desc: desc,
                            tags: tags,
                            coverUrl: coverUrl,
                            coverBlob: files.cover, // We need the blob for rendering
                            audioBlob: files.mp3_tagged || files.wav_untagged, // Prefer MP3 for speed?

                            // ?? CALLBACK: When YouTube Upload is Success
                            onSuccess: async (youtubeId) => {
                                console.log('?? YouTube Success! ID:', youtubeId);

                                // 1. Set YouTube URL in FormData/State
                                const youtubeUrl = `https://youtu.be/${youtubeId}`;
                                document.getElementById('youtubeUrlInput').value = youtubeUrl;

                                // 2. Trigger OFFSZN Save (Reuse existing logic)
                                // We force "isYouTubeUpload" to false temporarily if needed, 
                                // or we just call the update function directly.

                                // But handleUpdateProduct expects an event usually, let's mock it or adapt it.
                                // Better: Update the internal state and call handleUpdateProduct

                                // We need to ensure we don't loop. 
                                // If we are here, we are in "YouTube Mode".
                                // We want to save the product with the new YouTube URL.

                                // Let's manually trigger the update logic
                                try {
                                    showLoading('GUARDANDO EN OFFSZN...');
                                    await handleUpdateProduct(null, {
                                        forceYouTubeUrl: youtubeUrl,
                                        skipYouTubeCheck: true
                                    });
                                    // handleUpdateProduct handles the redirect and success message
                                } catch (e) {
                                    console.error('Error saving to OFFSZN after YouTube:', e);
                                    alert('Video subido a YouTube, pero error guardando en OFFSZN: ' + e.message);
                                    hideLoading();
                                }
                            }
                        });
                    }
                    updateCompletionProgress();
                }
                return;
            }

            let canProceed = true;
            for (let i = currentStep; i < targetStep; i++) {
                if (!validateStep(i)) {
                    canProceed = false;
                    // validation already shows inline errors
                    break;
                }
            }

            if (canProceed) {
                currentStep = targetStep;
                updateStepUI();
                for (let i = 1; i < targetStep; i++) {
                    if (!completedSteps.includes(i)) {
                        completedSteps.push(i);
                    }
                }
                if (currentStep === 4) {
                    setTimeout(() => {
                        renderPreview();
                        updateCompletionProgress();
                    }, 100);
                }
            }
        });
    });

    // Botones de navegación
    document.getElementById('nextBtn').addEventListener('click', handleNext);
    document.getElementById('prevBtn').addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            updateStepUI();
        }
    });

    const publishNowBtn = document.getElementById('publishNow');
    if (publishNowBtn) {
        publishNowBtn.addEventListener('click', () => {
            document.querySelector('.dropdown-content').style.display = 'none';
            handlePublish();
        });
    }

    /*
    document.getElementById('saveDraft').addEventListener('click', async function () {
        const btn = this;
        const originalText = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = 'Guardando...';
        try {
            await saveDraftAuto();
            btn.innerHTML = 'Â¡Guardado!';
            btn.style.color = '#22c55e'; // Green
            isDirty = false;

            showToast('Borrador guardado correctamente', 'success');

            // ðŸ”¥ REDIRECCIÓN A MIS-KITS (Solicitud del usuario)
            setTimeout(() => {
                window.location.href = '/cuenta/mis-kits.html';
            }, 1000);

        } catch (error) {
            btn.innerHTML = 'Error';
            btn.style.color = '#ef4444'; // Red
            console.error('Error al guardar:', error);
            showToast('Error al guardar borrador', 'error');
        } finally {
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalText;
                btn.style.color = ''; // Reset color
            }, 2000);
        }
    });
    */



    document.addEventListener('click', e => {
        // Cerrar dropdown de publicar si se hace clic fuera
        if (!e.target.closest('#publishBtn')) {
            const publishDropdown = document.getElementById('publishDropdownContent');
            const arrow = document.querySelector('#publishBtn svg');
            if (publishDropdown) {
                publishDropdown.style.display = 'none';
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            }
        }
    });

    // Inicializar spinners
    setTimeout(() => {
        document.querySelectorAll('.spin-btn:not(.collab-spin)').forEach(btn => {
            const isUp = btn.classList.contains('up');
            const control = btn.closest('.number-control');
            if (!control) return;

            const input = control.querySelector('.input-field');
            if (!input) return;

            const delta = isUp ? 1 : -1;

            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startSpinner(input.id, delta);
            });

            btn.addEventListener('mouseup', stopSpinner);
            btn.addEventListener('mouseleave', stopSpinner);

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                startSpinner(input.id, delta);
            });
            btn.addEventListener('touchend', stopSpinner);
            btn.addEventListener('touchcancel', stopSpinner);
        });
    }, 100);

    // ðŸ”¥ COLABORADORES Y NOTIFICACIONES (ORDEN CORRECTO)


    initCollaborators(); // ✅ AHORA SÍ FUNCIONA PORQUE EL DOM YA EXISTE
} // ← Close initAll()

// ========================================
// FUNCIONES AUXILIARES (solo las esenciales)
// ========================================
async function checkAuth() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        // Redirect instantly without delay
        window.location.href = '/pages/login.html';
        return;
    }
    userId = user.id;
}

async function loadUserProfile() {
    try {
        // 1. Fetch User Info
        const { data, error } = await supabaseClient
            .from('users')
            .select('nickname, is_admin, avatar_url')
            .eq('id', userId)
            .single();

        if (!error && data) {
            window.currentUserNickname = data.nickname; // ðŸ”¥ STORE FOR SLUG
            const avatar = document.getElementById('mainUserAvatar');
            if (avatar) {
                avatar.src = data.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.nickname || 'User')}&background=333&color=fff`;
            }
        }

        // 2. Fetch License Settings (Sync with Admin Dashboard)
        // 2. Fetch License Settings (Sync with Admin Dashboard)
        const { data: profileData, error: profileError } = await supabaseClient
            .from('profiles')
            .select('license_settings, upload_defaults_preference')
            .eq('id', userId)
            .maybeSingle();

        if (profileData) {
            if (profileData.license_settings) {
                window.userLicenseSettings = profileData.license_settings;
            }
            // ðŸ”¥ STORE UPLOAD PREFERENCE
            window.uploadDefaultsPreference = profileData.upload_defaults_preference || 'last_used';
            console.log('âœ… Upload Preference:', window.uploadDefaultsPreference);
        }

    } catch (e) {
        console.warn('âš ï¸ Error cargando perfil:', e);
    }
}

function initDateTime() {
    // ðŸ”¥ Force current date (User's timezone)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    // Set current date (no time)
    document.getElementById('dateInput').value = `${year}-${month}-${day}`;

    document.getElementById('dateInput').addEventListener('change', () => {
        validateReleaseDate();
        isDirty = true;
        // saveDraftAuto(); // ðŸ”¥ AUTOSAVE DISABLED
    });

    document.getElementById('visibilityInput').addEventListener('change', () => {
        isDirty = true;
        // saveDraftAuto(); // ðŸ”¥ AUTOSAVE DISABLED
    });
}

function validateReleaseDate() {
    const dateInput = document.getElementById('dateInput');
    const dateError = document.getElementById('dateError');

    if (!dateInput.value) return false;

    // ðŸ”¥ FIX: Parse date parts manually to ensure local time midnight
    // "2025-12-18" -> [2025, 12, 18]
    const parts = dateInput.value.split('-');
    const selected = new Date(parts[0], parts[1] - 1, parts[2]); // Year, Month(0-11), Day

    // Normalize "now" to midnight today
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // ðŸ”¥ PROGRAMACIÓN DE FECHA: Validar SOLO si el usuario intenta cambiar la fecha
    // Si ya existe una fecha válida y no la está cambiando, NO validar contra el presente
    const isEditingExistingDate = dateInput.dataset.originalDate && dateInput.value === dateInput.dataset.originalDate;

    if (isEditingExistingDate) {
        // âœ… La fecha ya fue guardada antes - NO validar contra presente
        if (dateError) dateError.style.display = 'none';
        dateInput.classList.remove('error');
        return true;
    }

    // âœ… Comparar timestamps (ambos están a las 00:00:00)
    if (selected.getTime() < now.getTime()) {
        if (dateError) {
            dateError.innerText = "La fecha de lanzamiento no puede ser en el pasado";
            dateError.style.display = 'block';
        }
        dateInput.classList.add('error');
        return false;
    } else {
        if (dateError) dateError.style.display = 'none';
        dateInput.classList.remove('error');
        return true;
    }
}

function initExitModal() {
    // Confirmation modal removed as per user request.
    document.getElementById('uploadForm')?.addEventListener('change', () => isDirty = true);
    document.getElementById('uploadForm')?.addEventListener('input', () => isDirty = true);
}

function initAutosaveInterval() {
    setInterval(() => {
        if (isDirty && document.getElementById('titleInput').value.trim()) {
            saveDraftAuto();
            isDirty = false;
        }
    }, 30000);
}

function initWaveSurfer() {
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: 'rgba(255, 255, 255, 0.4)',
        progressColor: '#8b5cf6',
        cursorColor: '#fff',
        cursorWidth: 2,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 40,
        normalize: true,
        backend: 'WebAudio',
        partialRender: true,
        responsive: true,
        hideScrollbar: true
    });

    wavesurfer.on('play', () => {
        document.getElementById('playPauseBtn').classList.add('playing');
    });

    wavesurfer.on('pause', () => {
        document.getElementById('playPauseBtn').classList.remove('playing');
    });

    wavesurfer.on('finish', () => {
        document.getElementById('playPauseBtn').innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    });

    document.getElementById('playPauseBtn').addEventListener('click', () => {
        wavesurfer.playPause();
        document.getElementById('playPauseBtn').innerHTML = wavesurfer.isPlaying()
            ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    });

    wavesurfer.on('audioprocess', updatePlayerTime);
    wavesurfer.on('seek', updatePlayerTime);
}

function updatePlayerTime() {
    if (!wavesurfer) return;

    const current = wavesurfer.getCurrentTime();
    const duration = wavesurfer.getDuration();

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / (60) || 0);
        const secs = Math.floor(seconds % 60 || 0);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const timeEl = document.getElementById('playerTime');
    if (timeEl) {
        timeEl.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    }
}

// --- NEW: Load Beat for Edit function ---
let isProductLoading = false;
async function loadProductForEdit(productId) {
    if (isProductLoading) return;
    try {
        isProductLoading = true;
        showLoading('Cargando Beat...');

        // 1. Cargar datos del beat desde la tabla 'products'
        const { data: product, error } = await supabaseClient
            .from('products')
            .select('*')
            .eq('id', productId)
            .eq('producer_id', userId)
            .single();

        if (error) throw new Error(error.message);
        if (!product) throw new Error('Beat no encontrado');

        window.originalProductData = product;

        // 2. Set Basic Info
        const titleInput = document.getElementById('titleInput');
        if (titleInput) {
            titleInput.value = product.name || '';
            const titleCount = document.getElementById('titleCount');
            if (titleCount) titleCount.textContent = (product.name || '').length;
        }

        const descInput = document.getElementById('descInput');
        if (descInput) {
            descInput.value = product.description || '';
            const descCount = document.getElementById('descCount');
            if (descCount) descCount.textContent = (product.description || '').length;
        }

        // 🔥 FIX: Set date AND store original so validateReleaseDate doesn't block past dates
        const dateInput = document.getElementById('dateInput');
        if (product.release_date && dateInput) {
            const originalDate = product.release_date.split('T')[0];
            dateInput.value = originalDate;
            dateInput.dataset.originalDate = originalDate; // ← Bypass past-date validation
        }

        const visibilityInput = document.getElementById('visibilityInput');
        if (product.visibility && visibilityInput) {
            visibilityInput.value = product.visibility;
            if (window.selectCustomVisibility) window.selectCustomVisibility(product.visibility);
        }

        const bpmInput = document.getElementById('bpmInput');
        if (product.bpm && bpmInput) {
            bpmInput.value = product.bpm;
        }

        const keyInput = document.getElementById('keyInput');
        if (product.key && keyInput) {
            // 🔥 FIX: Because keyInput is a <select>, assigning a value not in its options fails silently.
            // We must ensure the option exists before setting the value.
            let optionExists = Array.from(keyInput.options).some(opt => opt.value === product.key);
            if (!optionExists) {
                const newOption = document.createElement('option');
                newOption.value = product.key;
                newOption.text = product.key;
                keyInput.appendChild(newOption);
                if (typeof initCustomKeySelect === 'function') initCustomKeySelect(); // Re-render custom dropdown
            }
            keyInput.value = product.key;
            if (window.selectCustomKey) window.selectCustomKey(product.key);
        }

        // 3. Load Files (Previews)
        const productVersion = product.r2_version || 'v1';

        if (product.image_url) {
            const signedUrl = await getAuthorizedUrl(product.image_url, productVersion);
            if (signedUrl) {
                const preview = document.getElementById('coverPreview');
                if (preview) {
                    preview.src = signedUrl;
                    preview.style.display = 'block';
                    document.getElementById('coverDropZone').classList.add('has-image');
                    filesUploaded.cover = true;
                }
            }
        }

        // Helper function to update the drop zone UI to the "success" state
        const setDropZoneSuccess = (dropZoneId, fileName) => {
            const dropZone = document.getElementById(dropZoneId);
            if (!dropZone) return;

            dropZone.classList.add('success');
            dropZone.classList.add('has-file');

            const span = dropZone.querySelector('.upload-cta-btn span');
            if (span) {
                span.textContent = decodeURIComponent(fileName);
                span.style.maxWidth = '180px';
                span.style.overflow = 'hidden';
                span.style.textOverflow = 'ellipsis';
                span.style.whiteSpace = 'nowrap';
                span.style.display = 'inline-block';
                span.style.verticalAlign = 'middle';
            }
        };

        // 🔥 MP3 Preview (check both audio_url and mp3_url)
        const mp3Url = product.audio_url || product.mp3_url;
        if (mp3Url) {
            const fileName = mp3Url.split('/').pop();
            setDropZoneSuccess('mp3TaggedDropZone', fileName);
            filesUploaded.mp3_tagged = true;

            // Load waveform
            if (wavesurfer) {
                try {
                    const finalUrl = await getAuthorizedUrl(mp3Url, productVersion);
                    if (finalUrl) wavesurfer.load(finalUrl);
                    const playBtn = document.getElementById('playPauseBtn');
                    if (playBtn) playBtn.disabled = false;
                    const waveformEl = document.getElementById('waveform');
                    if (waveformEl) waveformEl.style.display = 'block';
                    const placeholder = document.getElementById('playerPlaceholder');
                    if (placeholder) placeholder.style.display = 'none';
                } catch (waveErr) {
                    console.warn('Error loading wavesurfer audio:', waveErr);
                }
            }
        }

        // 🔥 WAV Preview
        if (product.wav_url) {
            const fileName = product.wav_url.split('/').pop();
            setDropZoneSuccess('wavUntaggedDropZone', fileName);
            filesUploaded.wav_untagged = true;
        }

        // 🔥 STEMS Preview
        if (product.stems_url) {
            const fileName = product.stems_url.split('/').pop();
            setDropZoneSuccess('stemsDropZone', fileName);
            filesUploaded.stems = true;
        }

        // 4. Licenses (null-safe)
        const priceBasic = document.getElementById('priceBasic');
        const pricePremium = document.getElementById('pricePremium');
        const priceUnlimited = document.getElementById('priceUnlimited');
        const priceExclusive = document.getElementById('priceExclusive');
        if (product.price_basic && priceBasic) priceBasic.value = product.price_basic;
        if (product.price_premium && pricePremium) pricePremium.value = product.price_premium;
        if (product.price_unlimited && priceUnlimited) priceUnlimited.value = product.price_unlimited;
        if (product.price_exclusive && priceExclusive) priceExclusive.value = product.price_exclusive;

        // 5. Tags & Collabs
        if (product.tags) {
            tags = product.tags;
            renderTags();
        }

        if (product.collaborators) {
            collaborators = product.collaborators;
            renderCollabs();
        }

        // Update UI state
        window.currentEditId = product.id;
        const publishBtn = document.getElementById('publishNow');
        if (publishBtn) {
            publishBtn.innerHTML = 'Guardar Cambios';
            publishBtn.onclick = handleUpdateProduct;
        }

    } catch (error) {
        console.error('Error loading product for edit:', error);
    } finally {
        isProductLoading = false;
        hideLoading();
    }
}

// ========================================
// MANEJO DE ARCHIVOS
// ========================================
// ========================================
// MANEJO DE ARCHIVOS
// ========================================
function initFileHandlers() {
    setupFileUpload('coverDropZone', 'coverInput', 'cover');
    setupFileUpload('mp3TaggedDropZone', 'mp3TaggedInput', 'mp3_tagged');
    setupFileUpload('wavUntaggedDropZone', 'wavUntaggedInput', 'wav_untagged');
    setupFileUpload('stemsDropZone', 'stemsInput', 'stems');
}
function setupFileUpload(dropZoneId, inputId, type) {
    const dropZone = document.getElementById(dropZoneId);
    const input = document.getElementById(inputId);

    dropZone.addEventListener('click', () => input.click());
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFile(e.dataTransfer.files[0], type, dropZone);
    });
    input.addEventListener('change', e => {
        handleFile(e.target.files[0], type, dropZone);
        setTimeout(() => e.target.value = '', 100);
    });
}
async function handleFile(file, type, dropZone) {
    if (!file) {
        console.warn('âš ï¸ No se recibió archivo');
        return;
    }

    // Identificar el botón de acción dentro de la zona
    const ctaBtn = dropZone.querySelector('.upload-cta-btn span');
    if (ctaBtn) ctaBtn.innerText = "Cargando...";

    // ðŸ”¥ Prevenir uploads duplicados
    if (uploadsInProgress[type]) {
        console.warn(`âš ï¸ Ya hay un upload de ${type} en progreso`);
        return;
    }

    uploadsInProgress[type] = true;
    dropZone.classList.add('uploading');

    // Helper to show inline error
    const showInlineError = (msg) => {
        dropZone.classList.add('error');

        // Remove existing error if any
        const existing = dropZone.parentNode.querySelector('.upload-error-msg');
        if (existing) existing.remove();

        // Create new error
        const errorDiv = document.createElement('div');
        errorDiv.className = 'upload-error-msg';
        errorDiv.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>${msg}</span>
                `;

        // Insert after dropzone
        dropZone.parentNode.insertBefore(errorDiv, dropZone.nextSibling);

        // Auto-clear after 4s
        setTimeout(() => {
            dropZone.classList.remove('error');
            if (errorDiv.parentNode) errorDiv.remove();
        }, 4000);
    };

    try {
        // ðŸ”¥ Limpiar errores previos del dropzone
        dropZone.classList.remove('error');
        if (typeof clearInlineError === 'function') clearInlineError(dropZone.id); // ðŸ”¥ Real-Time Validation Clearing

        const existingError = dropZone.parentNode.querySelector('.upload-error-msg');
        if (existingError) existingError.remove();
        const legacyError = dropZone.parentNode.querySelector('.error-message'); // Cleanup old legacy
        if (legacyError) legacyError.remove();

        // Validaciones por tipo
        const VALID_TYPES = {
            cover: { ext: ['jpg', 'jpeg', 'png', 'webp'], mime: 'image/' },
            mp3_tagged: { ext: ['mp3'], mime: 'audio/mpeg' },
            wav_untagged: { ext: ['wav'], mime: 'audio/wav' },
            stems: { ext: ['zip', 'rar'], mime: null }
        };

        const MAX_SIZES = {
            cover: 10 * 1024 * 1024,      // 10MB
            mp3_tagged: 50 * 1024 * 1024, // 50MB
            wav_untagged: 60 * 1024 * 1024,// 60MB (Límite DB)
            stems: 50 * 1024 * 1024       // 50MB (Límite DB)
        };

        // Validar extensión
        const fileName = file.name.toLowerCase();
        const isValidExt = VALID_TYPES[type].ext.some(ext => fileName.endsWith('.' + ext));

        if (!isValidExt) {
            showInlineError(`Formato no Válido. Usa: .${VALID_TYPES[type].ext.join(', .')}`);
            console.error(`âŒ Error: Archivo inVálido.`);
            dropZone.classList.remove('uploading'); // ðŸ”¥ ENSURE CLEANUP
            delete uploadsInProgress[type]; // ðŸ”¥ RELEASE LOCK
            if (ctaBtn) ctaBtn.innerText = formData.files[type] ? "Cambiar Archivo" : "Subir Archivo";
            return;
        }

        if (type === 'cover' && !file.type.startsWith('image/')) {
            showInlineError('El archivo no es una imagen válida.');
            dropZone.classList.remove('uploading'); // ðŸ”¥ ENSURE CLEANUP
            delete uploadsInProgress[type]; // ðŸ”¥ RELEASE LOCK
            if (ctaBtn) ctaBtn.innerText = formData.files[type] ? "Cambiar Archivo" : "Subir Archivo";
            return;
        }

        if (file.size > MAX_SIZES[type]) {
            const maxMB = Math.round(MAX_SIZES[type] / 1024 / 1024);
            const fileMB = (file.size / 1024 / 1024).toFixed(1);
            showInlineError(`El archivo pesa ${fileMB}MB (Máx. ${maxMB}MB)`);
            dropZone.classList.remove('uploading'); // ðŸ”¥ ENSURE CLEANUP
            delete uploadsInProgress[type]; // ðŸ”¥ RELEASE LOCK
            if (ctaBtn) ctaBtn.innerText = formData.files[type] ? "Cambiar Archivo" : "Subir Archivo";
            return;
        }

        // ðŸ”¥ Cover: abrir modal de crop
        if (type === 'cover') {
            openCropModal(file);
            if (ctaBtn) ctaBtn.innerText = "Cambiar Portada";
            return;
        }

        // ðŸ”¥ CRÍTICO: Borrar archivo anterior SOLO al guardar (saveDraftAuto)
        // No borramos aquí para permitir "Salir sin guardar" seguro.

        // Guardar archivo en memoria
        formData.files[type] = file;
        filesUploaded[type] = false; // âœ… Marcar como NO subido aún

        // ðŸ”¥ VISUAL FEEDBACK: Green success border
        dropZone.classList.add('success');
        dropZone.classList.add('has-file');

        // ðŸ”¥ SHOW SUCCESS STATE: DISABLED
        // const successState = dropZone.querySelector('.success-state');
        // if (successState) successState.style.display = 'flex';

        isDirty = true;

        // Si es MP3 Tagged, cargar en el player
        if (type === 'mp3_tagged') {
            const blobUrl = URL.createObjectURL(file);
            audioBlobs.mp3 = blobUrl;

            // Auto-load MP3
            currentAudioType = 'mp3';
            if (wavesurfer) {
                wavesurfer.load(blobUrl);
                document.getElementById('playPauseBtn').disabled = false;
                document.getElementById('waveform').style.display = 'block';
                document.getElementById('playerPlaceholder').style.display = 'none';
            }

            // ?? Fallback: Si no hay BPM o Key (falló detección de texto), analizar audio
            const bpmIn = document.getElementById('bpmInput');
            const keyIn = document.getElementById('keyInput');

            if ((bpmIn && !bpmIn.value) || (keyIn && !keyIn.value)) {
                analyzeAudio(file).then(data => {
                    // BPM Fallback
                    if (bpmIn && !bpmIn.value && data.bpm) {
                        bpmIn.value = data.bpm;
                        bpmIn.style.borderColor = '#00ff88';
                        setTimeout(() => bpmIn.style.borderColor = '', 1000);
                    }

                    // Key Fallback (Essentia)
                    if (keyIn && !keyIn.value && data.key) {
                        // Ensure standard format via existing helper if needed, 
                        // but Essentia output is normalized in analyzeAudio now ("C Major")
                        if (typeof window.selectCustomKey === 'function') {
                            window.selectCustomKey(data.key);
                            // Visual Feedback
                            const trigger = document.getElementById('keyCustomTrigger');
                            if (trigger) {
                                trigger.style.borderColor = '#00ff88';
                                setTimeout(() => trigger.style.borderColor = '', 1000);
                            }
                        }
                    }
                });
            }
        }

        if (type === 'wav_untagged') {
            const blobUrl = URL.createObjectURL(file);
            audioBlobs.wav = blobUrl;

            // Auto-load WAV (Last uploaded wins)
            currentAudioType = 'wav';
            if (wavesurfer) {
                wavesurfer.load(blobUrl);
                document.getElementById('playPauseBtn').disabled = false;
                document.getElementById('waveform').style.display = 'block';
                document.getElementById('playerPlaceholder').style.display = 'none';
            }
        }

        // await saveDraftAuto(); // ?? DISABLED AUTO-SAVE

        // ?? Al terminar con éxito:
        if (ctaBtn) {
            // ?? CAMBIO: Solo mostrar 'Reemplazar Archivo' sin nombre
            ctaBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Reemplazar Archivo`;
        }

        // ðŸ”¥ CLEANUP LEGACY PREVIEW CONTAINERS
        // Ensure no double UI (Preview Box + Green Button)
        if (type === 'mp3_tagged') {
            const c = document.getElementById('mp3PreviewContainer');
            if (c) c.innerHTML = '';
        } else if (type === 'wav_untagged') {
            const c = document.getElementById('wavPreviewContainer');
            if (c) c.innerHTML = '';
        } else if (type === 'stems') {
            const c = document.getElementById('stemsPreviewContainer');
            if (c) c.innerHTML = '';
        }

    } catch (error) {
        showInlineError('Ocurrió un error al procesar el archivo.');
        console.error(error);
        if (ctaBtn) ctaBtn.innerText = "Subir Archivo";
    } finally {
        // ?? Liberar upload después de 2 segundos
        setTimeout(() => {
            uploadsInProgress[type] = false;
            dropZone.classList.remove('uploading');
        }, 2000);
    }
}
// ðŸ”¥ CAMBIO 1: Eliminar archivo del Storage cuando se reemplaza
window.removeFile = async (type) => {
    // Logic simplified for Beat Drafts (Jsonb structure)
    // Logic simplified: Just clear local state. Cleanup happens on Save.
    // if (filesUploaded[type] && currentDraftId) { ... } // REMOVED FOR SAFETY

    // Limpiar del estado local
    formData.files[type] = null;

    // ðŸ”¥ REMOVE VISUAL FEEDBACK
    const dropZoneMap = {
        'mp3_tagged': 'mp3TaggedDropZone',
        'wav_untagged': 'wavUntaggedDropZone',
        'stems': 'stemsDropZone'
    };
    if (dropZoneMap[type]) {
        const dz = document.getElementById(dropZoneMap[type]);
        if (dz) {
            dz.classList.remove('has-file');
            dz.classList.remove('success'); // Ensure success class is gone

            // ðŸ”¥ HIDE SUCCESS STATE
            const successState = dz.querySelector('.success-state');
            if (successState) successState.style.display = 'none';

            // Reset Button Text
            const btnSpan = dz.querySelector('.upload-cta-btn span');
            if (btnSpan) btnSpan.innerHTML = 'Subir Archivo';


        }

        // Clear Input
        const inputId = dropZoneMap[type].replace('DropZone', 'Input');
        const input = document.getElementById(inputId);
        if (input) input.value = '';

        filesUploaded[type] = false;

        // Special handling for MP3 Tagged (Waveform)
        if (type === 'mp3_tagged') {
            audioBlobs.mp3 = null;
            if (currentAudioType === 'mp3') {
                wavesurfer.empty();
                document.getElementById('waveform').style.display = 'none';
                document.getElementById('playerPlaceholder').style.display = 'block';
                document.getElementById('playPauseBtn').disabled = true;
            }
        }
    }



    // saveDraftAuto(); // ?? DISABLED AUTO-SAVE
    updateCompletionProgress(); // ?? AGREGAR ESTA LÍNEA

};
// ========================================
// NUEVA FUNCIÓN: Borrar Cover
// ========================================
window.removeCover = async () => {
    // Eliminar del Storage si existe
    // Eliminar del Storage SOLO al guardar.
    // if (currentDraftId && filesUploaded.cover) { ... } // REMOVED FOR SAFETY

    // Limpiar estado local
    formData.coverBlob = null;
    filesUploaded.cover = false;

    // Limpiar UI
    const preview = document.getElementById('coverPreview');
    const dropZone = document.getElementById('coverDropZone');
    const removeBtn = document.getElementById('removeCoverBtn');

    if (preview) {
        preview.style.display = 'none';
        preview.src = '';
    }

    if (dropZone) {
        dropZone.classList.remove('has-image');
    }

    if (removeBtn) {
        removeBtn.style.display = 'none';
    }

    document.getElementById('coverInput').value = '';
    // saveDraftAuto(); // ?? DISABLED AUTO-SAVE
};
// ========================================
// CROP MODAL
// ========================================
const cropModal = document.getElementById('cropModal');
const cropImage = document.getElementById('cropImage');
const cropBox = document.getElementById('cropBox');
const cropContainer = document.getElementById('cropContainer');
let imageScale, baseScale, imageX, imageY, isDragging, dragStartX, dragStartY, boxX, boxY, CROP_SIZE;

function openCropModal(file) {
    const dropZone = document.getElementById('coverDropZone');
    if (dropZone) dropZone.classList.add('uploading');

    const reader = new FileReader();
    reader.onload = e => {
        cropImage.src = e.target.result;
        cropImage.onload = () => {
            cropModal.classList.add('active');
            initializeCrop();
            window.zoomCrop = function (delta) {
                imageScale = Math.max(baseScale, Math.min(baseScale * 3, imageScale + (baseScale * delta)));
                constrainImagePosition();
                updateImageTransform();
            };
        };
    };
    reader.readAsDataURL(file);
}

window.closeCropModal = function () {
    cropModal.classList.remove('active');
    const dropZone = document.getElementById('coverDropZone');
    const removeBtn = document.getElementById('removeCoverBtn');

    if (!formData.coverBlob) {
        if (dropZone) dropZone.classList.remove('uploading', 'has-image');
        const preview = document.getElementById('coverPreview');
        if (preview) {
            preview.style.display = 'none';
            preview.src = '';
        }
        if (removeBtn) removeBtn.style.display = 'none';
    } else {
        if (dropZone) {
            dropZone.classList.remove('uploading');
            dropZone.classList.add('has-image');
        }
        if (removeBtn) removeBtn.style.display = 'block';
    }
};

function initializeCrop() {
    const containerW = cropContainer.offsetWidth;
    const containerH = cropContainer.offsetHeight;
    const imgW = cropImage.naturalWidth;
    const imgH = cropImage.naturalHeight;

    CROP_SIZE = Math.min(containerW, containerH) * 0.7;
    boxX = (containerW - CROP_SIZE) / 2;
    boxY = (containerH - CROP_SIZE) / 2;

    cropBox.style.width = CROP_SIZE + 'px';
    cropBox.style.height = CROP_SIZE + 'px';
    cropBox.style.left = boxX + 'px';
    cropBox.style.top = boxY + 'px';

    baseScale = Math.max(CROP_SIZE / imgW, CROP_SIZE / imgH);
    imageScale = baseScale;
    imageX = (boxX + CROP_SIZE / 2) - (imgW * imageScale) / 2;
    imageY = (boxY + CROP_SIZE / 2) - (imgH * imageScale) / 2;

    updateImageTransform();

    cropContainer.addEventListener('wheel', e => {
        e.preventDefault();
        imageScale = Math.max(baseScale, Math.min(baseScale * 3, imageScale + (baseScale * (e.deltaY > 0 ? -0.1 : 0.1))));
        constrainImagePosition();
        updateImageTransform();
    }, { passive: false });

    cropContainer.addEventListener('mousedown', startDrag);
}

function updateImageTransform() {
    cropImage.style.transform = `translate(${imageX}px, ${imageY}px) scale(${imageScale})`;
}

function startDrag(e) {
    e.preventDefault();
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

function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
}

function constrainImagePosition() {
    const imgW = cropImage.naturalWidth * imageScale;
    const imgH = cropImage.naturalHeight * imageScale;
    if (imageX > boxX) imageX = boxX;
    if (imageX + imgW < boxX + CROP_SIZE) imageX = boxX + CROP_SIZE - imgW;
    if (imageY > boxY) imageY = boxY;
    if (imageY + imgH < boxY + CROP_SIZE) imageY = boxY + CROP_SIZE - imgH;
}

document.getElementById('saveCropBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveCropBtn');
    try {
        btn.innerText = 'Procesando...';
        btn.disabled = true;

        /* ðŸ”¥ REMOVED: Do not delete old cover during local crop. Let Manual Save handle it.
        if (currentDraftId && filesUploaded.cover) {
            try {
                const { data: draft } = await supabaseClient
                    .from('beat_drafts')
                    .select('files_data')
                    .eq('id', currentDraftId)
                    .single();

                if (draft?.files_data?.cover) {
                    await supabaseClient.storage
                        .from('beat-drafts')
                        .remove([draft.files_data.cover]);
                    console.log('??? Cover anterior eliminado');
                }
            } catch (e) {
                console.warn('?? Error eliminando cover anterior:', e);
            }
        } 
        */

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1080;
        canvas.height = 1080;

        const relX = boxX - imageX;
        const relY = boxY - imageY;
        const sourceX = relX / imageScale;
        const sourceY = relY / imageScale;
        const sourceSize = CROP_SIZE / imageScale;

        ctx.drawImage(cropImage, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 1080, 1080);

        formData.coverBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
        filesUploaded.cover = false;

        const preview = document.getElementById('coverPreview');
        preview.src = URL.createObjectURL(formData.coverBlob);
        preview.style.display = 'block';
        document.getElementById('coverDropZone').classList.add('has-image');

        // ? MOSTRAR BOTÓN DE BORRAR
        const removeBtn = document.getElementById('removeCoverBtn');
        if (removeBtn) removeBtn.style.display = 'block';

        closeCropModal();

        // initAutosaveInterval(); // ðŸ”¥ DISABLED AUTO-SAVE
        // await loadDraft(); // ðŸ”¥ REMOVED: Do not reload draft state, it overwrites local changes!

        // ========================================
        // ðŸ”¥ YOUTUBE IMPORT HANDLING
        // ========================================
        const urlParamsYT = new URLSearchParams(window.location.search);
        if (urlParamsYT.get('from') === 'youtube') {
            const title = urlParamsYT.get('title');
            const desc = urlParamsYT.get('desc');
            const tagsParam = urlParamsYT.get('tags');
            const bpm = urlParamsYT.get('bpm');
            const key = urlParamsYT.get('key'); // or 'note'

            if (title) {
                const titleIn = document.getElementById('titleInput');
                if (titleIn) {
                    titleIn.value = title;
                    const counter = document.getElementById('titleCount');
                    if (counter) counter.innerText = title.length;
                    titleIn.classList.add('filled');
                }
            }
            if (desc) {
                const descIn = document.getElementById('descInput');
                if (descIn) {
                    descIn.value = desc;
                    const counter = document.getElementById('descCount');
                    if (counter) counter.innerText = desc.length;
                }
            }
            if (bpm) {
                const bpmIn = document.getElementById('bpmInput'); // Ensure ID exists or match input[name]
                if (bpmIn) bpmIn.value = bpm;
            }
            if (key) {
                // Beats usually have a Key selector or text input.
                // Assuming standard input for now, adjust if it's a select.
                const keyIn = document.getElementById('keyInput');
                if (keyIn) keyIn.value = key;
            }

            if (tagsParam) {
                const tagsList = tagsParam.split(',').filter(t => t.trim());
                setTimeout(() => {
                    tagsList.forEach(tag => {
                        if (typeof window.addTag === 'function') window.addTag(tag.trim());
                        else if (typeof addTag === 'function') addTag(tag.trim());
                    });
                }, 500);
            }
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Event listeners
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    } finally {
        btn.innerText = 'Guardar';
        btn.disabled = false;
    }
});
// ========================================
// TAGS
// ========================================
// ?? FIX: Logic for AI Tags Button
let currentSuggestionIndex = 0;
let cachedSuggestions = [];
let lastAnalyzedTitle = '';

window.quickAutoFillTags = async function () {
    // ?? NAVIGATE TO STEP 2 (Required for Tags to be visible)
    if (currentStep !== 2) {
        if (typeof window.goToStep === 'function') {
            window.goToStep(2);
        } else if (typeof updateStepUI === 'function') {
            currentStep = 2;
            updateStepUI();
        }
        await new Promise(r => setTimeout(r, 200));
    }

    // Esta función ahora solo es llamada manualmente por el botón
    const title = document.getElementById('titleInput').value.toLowerCase().trim();
    const description = document.getElementById('descInput').value.toLowerCase().trim();
    const container = document.getElementById('tagsSuggestions');
    const btn = document.querySelector('.quick-btn[title="Tags IA"]'); // Selector por tooltip

    if (!title || title.length < 3) {
        showToast('Escribe un título primero', 'error');
        return;
    }

    // ?? CHECK MAX TAGS BEFORE STARTING
    if (tags.length >= 3) {
        showToast('Ya tienes el máximo de 3 tags. Elimina uno para usar Auto Tag.', 'info');
        return;
    }

    if (!container) return;

    // ?? INVALIDAR CACHÉ SI CAMBIA EL TÍTULO
    if (title !== lastAnalyzedTitle) {
        cachedSuggestions = [];
        currentSuggestionIndex = 0;
        lastAnalyzedTitle = title;
    }

    // Animación de carga en el botón
    if (btn) {
        btn.style.opacity = '0.6';
        btn.disabled = true;
    }

    try {
        // ?? RETRASO ELIMINADO PARA FEEDBACK INSTANTÁNEO
        // await new Promise(resolve => setTimeout(resolve, 500));

        // 1. Generar sugerencias
        if (cachedSuggestions.length === 0) {
            // ?? SKIP HEAVY AUDIO ANALYSIS FOR SPEED
            // if (formData.files.mp3_tagged) {
            //    try {
            //        audioAnalysis = await analyzeAudio(formData.files.mp3_tagged);
            //    } catch (e) { console.log('Audio analysis skip'); }
            // }
            // Just use text-based generation for instant results
            cachedSuggestions = await generateTagsSmart(title, description, null);
        }

        // 2. Filtrar
        const availableSuggestions = cachedSuggestions.filter(tag => !tags.includes(tag));

        if (availableSuggestions.length === 0) {
            showToast('No hay más sugerencias disponibles', 'info');
            container.style.display = 'none';
        } else {
            container.style.display = 'flex';
            container.style.opacity = '0';
            container.style.transition = 'opacity 0.2s';

            setTimeout(() => {
                container.innerHTML = '';
                const label = document.createElement('div');
                label.style.cssText = 'font-size: 11px; color: #666; width: 100%; margin-bottom: 4px;';
                label.textContent = 'Sugerencias (Click para agregar):';
                container.appendChild(label);

                const batch = [];
                for (let i = 0; i < 3; i++) {
                    if (availableSuggestions.length > 0) {
                        const index = (currentSuggestionIndex + i) % availableSuggestions.length;
                        batch.push(availableSuggestions[index]);
                    }
                }

                batch.forEach(tag => {
                    const chip = document.createElement('div');
                    chip.className = 'tag-suggestion';
                    chip.textContent = tag;
                    chip.onclick = () => {
                        // ðŸ”¥ CHECK MAX TAGS ON CLICK
                        if (tags.length >= 3) {
                            showToast('Máximo 3 tags permitidos', 'error');
                            container.style.display = 'none'; // Hide if full
                            return;
                        }
                        addTag(tag);
                        chip.remove();

                        // ðŸ”¥ AUTO HIDE IF FULL AFTER ADDING
                        if (tags.length >= 3) {
                            container.style.display = 'none';
                        }
                    };
                    container.appendChild(chip);
                });

                container.style.opacity = '1';
                // Scroll to tags
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);

            // Update index
            currentSuggestionIndex = (currentSuggestionIndex + 3) % cachedSuggestions.length;
        }
    } catch (e) {
        console.error(e);
        showToast('Error generando tags', 'error');
    } finally {
        if (btn) {
            btn.style.opacity = '1';
            btn.disabled = false;
        }
    }
};
// ðŸ”¥ ALIAS para compatibilidad
window.autoFillTags = window.quickAutoFillTags;

function initTagsInput() {
    const input = document.getElementById('tagInput');

    // ðŸ”¥ NUEVO: Limitar caracteres MIENTRAS ESCRIBE
    input.addEventListener('input', e => {
        if (e.target.value.length > 30) {
            e.target.value = e.target.value.substring(0, 30);
        }
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = input.value.trim();
            if (value) {
                addTag(value);
            }
        }
    });

    // ðŸ”¥ NUEVO: Agregar tag al hacer click fuera
    input.addEventListener('blur', () => {
        const value = input.value.trim();
        if (value && tags.length < 3) {
            addTag(value);
        }
    });

    // Deshabilitar input cuando hay 3 tags
    input.addEventListener('focus', e => {
        if (tags.length >= 3) {
            e.preventDefault();
            input.blur();
        }
    });
}
window.addTag = addTag;

window.clearTags = function () {
    tags = [];
    isDirty = true;
    renderTags();
};

function addTag(tag) {
    if (!tag) return;

    // Validar máximo 3 tags
    if (tags.length >= 3) {
        return;
    }

    // Cortar a 30 caracteres
    tag = tag.substring(0, 30);

    // Validar duplicado (Silencioso)
    if (tags.some(t => t.toLowerCase() === tag.toLowerCase())) {
        document.getElementById('tagInput').value = ''; // Limpiar el input si es duplicado
        return;
    }

    // ðŸ”¥ NUEVO: Restaurar posición si estamos editando
    const input = document.getElementById('tagInput');
    const editingIndex = input.dataset.editingIndex;

    if (editingIndex !== undefined) {
        // Insertar en la posición original
        const index = parseInt(editingIndex);
        tags.splice(index, 0, tag);
        delete input.dataset.editingIndex;
    } else {
        // Agregar al final
        tags.push(tag);
    }

    isDirty = true;
    renderTags();
    // saveDraftAuto(); // ðŸ”¥ DISABLED AUTO-SAVE

    // ðŸ”¥ CLEAR ERROR: Si había error de validación, quitarlo al agregar un tag
    const tInput = document.getElementById('tagInput');
    if (tInput) {
        tInput.value = ''; // ðŸ”¥ CLEAR INPUT HERE SO IT WORKS EVERY TIME
        tInput.classList.remove('error');
        const container = tInput.closest('.form-group');
        if (container) {
            const errorMsg = container.querySelector('.error-message');
            if (errorMsg) errorMsg.remove();
        }
    }
}
function renderTags() {
    const container = document.getElementById('tagsContainer');
    const input = document.getElementById('tagInput');

    // Remover tags anteriores
    Array.from(container.children).forEach(child => {
        if (child !== input) container.removeChild(child);
    });

    // Renderizar tags
    tags.forEach(tag => {
        const chip = document.createElement('div');
        chip.className = 'tag-chip';
        chip.style.cursor = 'pointer';
        chip.innerHTML = `
                <span onclick="editTag('${tag}')" style="flex: 1;">${tag}</span>
                <span class="tag-remove" onclick="removeTag('${tag}')" title="Eliminar etiqueta" style="display: flex; align-items: center; justify-content: center;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </span>
            `;
        container.insertBefore(chip, input);
    });

    // Deshabilitar/habilitar input según cantidad de tags
    if (tags.length >= 3) {
        input.disabled = true;
        input.placeholder = '';
        input.style.cursor = 'not-allowed';
    } else {
        input.disabled = false;
        input.placeholder = 'Escribe un tag...';
        input.style.cursor = 'text';
    }
}

// ========================================
// REMOVER TAGS (FUERA DE renderTags)
// ========================================
window.removeTag = (tagToRemove) => {
    tags = tags.filter(t => t !== tagToRemove);
    isDirty = true;
    renderTags();
    // saveDraftAuto(); // ðŸ”¥ DISABLED AUTO-SAVE
};

// ========================================
// EDITAR TAGS (FUERA DE renderTags)
// ========================================
window.editTag = (oldTag) => {
    // Encontrar el índice del tag
    const tagIndex = tags.indexOf(oldTag);
    if (tagIndex === -1) return;

    // Remover el tag PERO guardar su posición
    tags.splice(tagIndex, 1);

    // Renderizar ANTES de poner el valor en el input
    renderTags();

    // Poner el tag en el input
    const input = document.getElementById('tagInput');
    input.value = oldTag;

    // Guardar el índice para restaurar posición
    input.dataset.editingIndex = tagIndex;

    // Focus y seleccionar después de renderizar
    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);
};
// ========================================
// PRECIOS Y SPINNERS
// ========================================
// ========================================
// LICENCIAS (NUEVO SISTEMA)
// ========================================
const DEFAULT_LICENSES = [
    { id: 'basic', name: 'MP3 Lease', defaultPrice: 20.00, requiredFile: 'mp3_tagged' },
    { id: 'premium', name: 'WAV Lease', defaultPrice: 50.00, requiredFile: 'wav_untagged' },
    { id: 'trackout', name: 'Trackout (Stems)', defaultPrice: 100.00, requiredFile: 'stems' },
    { id: 'unlimited', name: 'Ilimitado', defaultPrice: 300.00, requiredFile: 'stems' }
];

let licensesState = {};

// ðŸ”¥ STATE FOR VISIBILITY TRACKING
let originalVisibility = 'private'; // Default for new uploads/drafts

window.freeDownloadEnabled = false;

// --- NUEVO SISTEMA DE INICIALIZACIÓN DE LICENCIAS ---
function initLicenses() {
    // Si no hay estado previo (es un beat nuevo), creamos el objeto base
    // Si no hay estado previo (es un beat nuevo), creamos el objeto base
    DEFAULT_LICENSES.forEach(lic => {
        if (!licensesState[lic.id]) {
            // ðŸ”¥ MAPPING: Map old profile keys to new system keys
            const keyMap = {
                'mp3': 'basic',
                'wav': 'premium',
                'stems': 'trackout',
                'unlimited': 'unlimited'
            };
            const profileKey = Object.keys(keyMap).find(key => keyMap[key] === lic.id) || lic.id;

            // CHECK PREFERENCE: 'last_used' vs 'admin_defaults'
            // For 'last_used', we would need to have fetched the last beat. 
            // Since that requires an async call and this is synchronous, we might need a separate init strategy or 
            // just stick to Admin Defaults for now as requested by user ("admin defaults... is what it should be").

            // ðŸ”¥ LOGIC:
            // 1. Try to use Admin Defaults (with legacy key support)
            // 2. Fallback to System Defaults

            // NOTE: 'last_used' implementation would go here if we pre-fetched it. 
            // For now, we fix the KEY ISSUE which is the main bug.

            let saved = null;
            if (window.userLicenseSettings) {
                // Try direct key (new system) OR legacy key (old system)
                saved = window.userLicenseSettings[lic.id] || window.userLicenseSettings[profileKey];
            }

            if (saved) {
                licensesState[lic.id] = {
                    enabled: saved.enabled,
                    price: parseFloat(saved.price)
                };
            } else {
                // 2. Prioridad 2: Valores de fábrica del sistema
                licensesState[lic.id] = {
                    enabled: true, // Siempre activo por defecto
                    price: lic.defaultPrice
                };
            }
        }
    });

    // ========================================


    // ðŸ”¥ ASYNC FULL OVERRIDE FOR 'LAST_USED' PREFERENCE
    if (window.uploadDefaultsPreference === 'last_used') {
        applyLastUsedSettings();
    }

    // Forzar Descarga Gratis activa por defecto
    if (window.freeDownloadEnabled === undefined) {
        window.freeDownloadEnabled = true;
    }

    renderLicenses();
}

// ========================================
// ðŸ”¥ APPLY LAST USED SETTINGS (ASYNC)
// ========================================
async function applyLastUsedSettings() {
    try {
        // 1. Fetch the most recent beat
        // Note: verify table name 'products' and column 'type'
        const { data, error } = await supabaseClient
            .from('products')
            .select('licenses')
            .eq('producer_id', userId)
            .eq('product_type', 'beat')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(); // Use maybeSingle to avoid 406 on empty result

        if (error) throw error;

        if (data && data.licenses) {
            console.log('ðŸ”¥ Applying Last Used Licenses:', data.licenses);

            // Merge into licensesState
            Object.keys(licensesState).forEach(key => {
                // The saved licenses JSON structure might match our keys or legacy keys (mp3, wav...)
                // We check direct match first
                let saved = data.licenses[key];

                // If not found, check legacy map reverse
                if (!saved) {
                    const keyMap = { 'basic': 'mp3', 'premium': 'wav', 'trackout': 'stems', 'unlimited': 'unlimited' };
                    const legacyKey = keyMap[key];
                    if (legacyKey) saved = data.licenses[legacyKey];
                }

                if (saved) {
                    licensesState[key] = {
                        enabled: !!saved.enabled,
                        price: parseFloat(saved.price) || licensesState[key].price
                    };
                }
            });

            // Re-render UI
            renderLicenses();
            // showToast('ðŸ”¥ Precios ajustados al último beat', 'success');
        }

    } catch (e) {
        console.warn('âš ï¸  Error applying last used settings:', e);
    }
}

function renderLicenses() {
    const container = document.getElementById('licensesContainer');
    if (!container) return;
    container.innerHTML = '';

    const totalEnabled = Object.values(licensesState).filter(l => l.enabled).length;

    DEFAULT_LICENSES.forEach(lic => {
        const state = licensesState[lic.id];
        if (!state) return;

        // Sync file status from global uploaderState or already uploaded (filesUploaded)
        const hasFile = !!(window.uploaderState && window.uploaderState[lic.requiredFile]) || !!(filesUploaded && filesUploaded[lic.requiredFile]);
        const isEnabled = state.enabled;

        const card = document.createElement('div');
        card.className = `license-card ${isEnabled ? 'active' : ''}`;

        card.innerHTML = `
            <div class="license-header">
                <div class="license-title-group">
                    <label class="toggle-switch">
                        <input type="checkbox" onchange="toggleLicense('${lic.id}')" ${isEnabled ? 'checked' : ''} ${isEnabled && totalEnabled === 1 ? 'disabled' : ''} style="display:none;">
                        <div class="toggle-track"><div class="toggle-thumb"></div></div>
                    </label>
                    <span class="license-name">${lic.name}</span>
                </div>
                
                <div class="price-input-wrapper">
                    <span class="price-currency">$</span>
                    <input type="number" 
                        class="license-price-input" 
                        id="license-price-${lic.id}" 
                        value="${state.price === 1000 ? '1000' : state.price.toFixed(2)}" 
                        min="0" max="1000" step="0.01"
                        oninput="if(this.value >= 1000) this.value = 1000; if(this.value < 0) this.value = 0;"
                        onchange="updateLicensePrice('${lic.id}', this.value)"
                        onblur="this.value = parseFloat(this.value || 0).toFixed(2)">
                </div>
            </div>

            <div class="license-status-footer">
                <div class="status-indicator ${hasFile ? 'status-success' : 'status-error'}">
                    <div class="status-dot" style="background: currentColor;"></div>
                    <span>Archivo: ${hasFile ? 'Cargado' : 'Faltante'}</span>
                </div>
                <span style="font-size: 11px; opacity: 0.5;">(${lic.requiredFile.replace('_', ' ').toUpperCase()})</span>
            </div>
        `;
        container.appendChild(card);
    });

    renderFreeDownloadToggle(container);
}

function renderFreeDownloadToggle(container) {
    const isFreeEnabled = window.freeDownloadEnabled || false;
    const mp3TaggedUploaded = !!(window.uploaderState && window.uploaderState['mp3_tagged']) || !!(filesUploaded && filesUploaded['mp3_tagged']);

    if (DEFAULT_LICENSES.length > 0) {
        const divider = document.createElement('div');
        divider.style.cssText = 'margin: 24px 0 16px 0; border-top: 1px solid rgba(255,255,255,0.05);';
        container.appendChild(divider);
    }

    const freeCard = document.createElement('div');
    freeCard.className = `license-card free-download ${isFreeEnabled ? 'active' : ''}`;

    freeCard.innerHTML = `
        <div class="license-header" style="margin-bottom: ${isFreeEnabled ? '10px' : '0'}">
            <div class="license-title-group">
                <label class="toggle-switch">
                    <input type="checkbox" onchange="toggleFreeDownload()" ${isFreeEnabled ? 'checked' : ''} style="display:none;">
                    <div class="toggle-track">
                        <div class="toggle-thumb"></div>
                    </div>
                </label>
                <div style="display: flex; flex-direction: column;">
                    <span class="license-name" style="color: ${isFreeEnabled ? '#fff' : '#666'}">Descarga Gratis</span>
                    ${!isFreeEnabled ? '<span style="font-size: 11px; color: #555;">(Uso promocional)</span>' : ''}
                </div>
            </div>
        </div>

        ${isFreeEnabled ? `
        <div class="free-download-content" style="padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05);">
            <p class="free-download-info">
                Los usuarios podrán descargar el <strong>MP3 con Tag</strong> gratuitamente a cambio de seguirte o dejar su email.
            </p>
            <div class="license-status-footer" style="margin-top: 10px; border: none; padding: 0;">
                <div class="status-indicator ${mp3TaggedUploaded ? 'status-success' : 'status-error'}">
                    <div class="status-dot" style="background: currentColor;"></div>
                    <span>MP3 con Tag: ${mp3TaggedUploaded ? 'Listo' : 'Faltante'}</span>
                </div>
            </div>
        </div>
        ` : ''}
    `;
    container.appendChild(freeCard);
}

window.toggleLicense = (id) => {
    if (!licensesState[id]) initLicenses(); // Safety init

    // ðŸ”¥ VALIDACIÓN: No permitir desactivar la última licencia activa
    if (licensesState[id].enabled) {
        const activeCount = Object.values(licensesState).filter(l => l.enabled).length;
        if (activeCount <= 1) {
            // showToast('Debes mantener al menos una licencia activa', 'error'); // Eliminado por solicitud
            renderLicenses(); // Re-render visual toggle back
            return;
        }
    }

    licensesState[id].enabled = !licensesState[id].enabled;
    renderLicenses();
    // saveDraftAuto(); // ðŸ”¥ DISABLED AUTO-SAVE
};

window.updateLicensePrice = (id, price) => {
    if (!licensesState[id]) initLicenses();
    licensesState[id].price = parseFloat(price) || 0;
    // saveDraftAuto(); // ðŸ”¥ DISABLED AUTO-SAVE
};

window.toggleFreeDownload = () => {
    window.freeDownloadEnabled = !window.freeDownloadEnabled;
    renderLicenses();
    // saveDraftAuto(); // ðŸ”¥ DISABLED AUTO-SAVE
};





// ========================================
// COLABORADORES CON AUTOCOMPLETADO (CORREGIDO)
// ========================================
function initCollaborators() {
    const collabSearch = document.getElementById('collabSearch');
    if (!collabSearch) {
        console.warn('âš ï¸ #collabSearch no existe aún');
        return;
    }



    collabSearch.addEventListener('input', e => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            const dropdown = document.getElementById('collabDropdown');
            if (dropdown) dropdown.style.display = 'none';
            return;
        }

        searchTimeout = setTimeout(() => {
            searchUsers(query);
        }, 300);
    });

    // Cerrar dropdown al hacer click fuera
    document.addEventListener('click', e => {
        if (!e.target.closest('#collabSearch') && !e.target.closest('#collabDropdown')) {
            const dropdown = document.getElementById('collabDropdown');
            if (dropdown) dropdown.style.display = 'none';
        }
    });
}

let searchTimeout = null;
let availableUsers = []; // Cache de usuarios

async function searchUsers(query) {
    if (!query || query.length < 2) {
        document.getElementById('collabDropdown').style.display = 'none';
        return;
    }

    // âœ… VALIDAR userId
    if (!userId) {
        showToast('Usuario no autenticado', 'error');
        return;
    }

    try {
        console.log('ðŸ” Buscando:', query);

        const { data: users, error } = await supabaseClient
            .from('users')
            .select('id, nickname, is_admin, avatar_url')
            .neq('id', userId)
            .ilike('nickname', `%${query}%`)
            .limit(5);

        if (error) {
            console.error('âŒ Error query:', error);
            document.getElementById('collabDropdown').style.display = 'none';
            showToast('Error buscando usuarios', 'error'); // âœ… AGREGAR
            return;
        }

        console.log('âœ… Resultados:', users);

        availableUsers = (users || []).map(u => ({
            id: u.id,
            name: u.nickname || 'Usuario sin nombre',
            // Asegurar URL válida sin caracteres raros
            avatar_url: u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nickname || 'U')}&background=333&color=fff`
        }));

        renderCollabDropdown();
    } catch (e) {
        console.error('âŒ Error en searchUsers:', e);
        showToast('Error en búsqueda: ' + e.message, 'error');
    }
}
// Renderizar dropdown de colaboradores
function renderCollabDropdown() {
    const dropdown = document.getElementById('collabDropdown');

    // ðŸ”¥ FILTRAR usuarios que ya están agregados
    const filteredUsers = availableUsers.filter(user =>
        !collaborators.some(c => c.id === user.id)
    );

    if (filteredUsers.length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px; color: #666; text-align: center;">No se encontraron usuarios</div>';
        dropdown.style.display = 'block';
        return;
    }

    dropdown.innerHTML = filteredUsers.map(user => {
        return `
            <div class="collab-option" onclick="selectCollaborator('${user.id}')">
                <img src="${user.avatar_url}" 
                    class="collab-option-avatar" 
                    onerror="this.src='https://ui-avatars.com/api/?name=U&background=333&color=fff'">
                <div class="collab-option-info">
                    <div class="collab-option-name">${user.name}</div>
                </div>
            </div>
        `;
    }).join('');

    dropdown.style.display = 'block';
}
// Seleccionar colaborador del dropdown
window.selectCollaborator = async (selectedId) => {
    const user = availableUsers.find(u => u.id === selectedId);
    if (!user) return;

    if (collaborators.length >= 4) {
        showToast("Máximo 5 colaboradores (tú + 4)", 'error');
        return;
    }

    collaborators.push({
        id: user.id,
        name: user.name,
        avatar_url: user.avatar_url,
        role: 'Productor',
        percent: 0,
        description: ''
    });

    isDirty = true;
    renderCollabs();
    document.getElementById('collabSearch').value = '';
    document.getElementById('collabDropdown').style.display = 'none';
    // saveDraftAuto(); // ðŸ”¥ DISABLED AUTO-SAVE
};

// ELIMINAR la función addCollaborator antigua y reemplazar por:
function addCollaborator(name) {
    // Esta función ya no se usa, se usa selectCollaborator
}

// Renderizar colaboradores con avatares
function renderCollabs() {
    const list = document.getElementById('collabList');
    while (list.children.length > 1) list.removeChild(list.lastChild);

    collaborators.forEach((c, i) => {
        const row = document.createElement('div');
        row.className = 'collab-row';
        row.innerHTML = `
                <div class="user-info">
                    <img src="${c.avatar_url || '/default-avatar.png'}" 
                        class="user-avatar" 
                        style="object-fit: cover;"
                    onerror="this.src='https://ui-avatars.com/api/?name=U&background=333&color=fff'"
                    <span>${c.name}</span>
                </div>
                <select class="input-field collab-role-select" onchange="updateCollab(${i}, 'role', this.value)">
                    <option value="Productor" ${c.role === 'Productor' ? 'selected' : ''}>Productor</option>
                    <option value="Ingeniero" ${c.role === 'Ingeniero' ? 'selected' : ''}>Ingeniero</option>
                    <option value="Artista" ${c.role === 'Artista' ? 'selected' : ''}>Artista</option>
                </select>

    <div class="number-control" style="max-width: 120px;">
        <input type="text" class="input-field" id="collabPercent${i}" 
            value="${c.percent}" 
            inputmode="numeric"
            pattern="[0-9]*"
            oninput="updateCollabPercent(${i}, this.value)"
            style="max-width: 80px;">
        <div class="spinners">
            <button class="spin-btn up collab-spin" type="button" data-index="${i}" data-delta="1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
            </button>
            <button class="spin-btn down collab-spin" type="button" data-index="${i}" data-delta="-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
        </div>
    </div>
    
    <button type="button" class="collab-delete-btn" onclick="removeCollab(${i})" title="Eliminar colaborador">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
        </svg>
    </button>
`;
        list.appendChild(row);
    });
    // ðŸ”¥ INICIALIZAR SPINNERS DE COLABORADORES
    // ðŸ”¥ ANTES de agregar nuevos listeners, limpiar los anteriores
    setTimeout(() => {
        document.querySelectorAll('.collab-spin').forEach(btn => {
            // ðŸ”¥ CLONAR para eliminar listeners anteriores
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            const index = parseInt(newBtn.dataset.index);
            const delta = parseInt(newBtn.dataset.delta);

            newBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startCollabSpinner(index, delta);
            });

            newBtn.addEventListener('mouseup', stopCollabSpinner);
            newBtn.addEventListener('mouseleave', stopCollabSpinner);
        });
    }, 50);
    // Mostrar/ocultar botón de notificar
    const notifyBtn = document.getElementById('notifyCollabsBtn');
    if (notifyBtn) {
        notifyBtn.style.display = collaborators.length > 0 ? 'block' : 'none';
    }

    updateMainUserPercent();
}
function updateMainUserPercent() {
    const total = collaborators.reduce((sum, c) => sum + c.percent, 0);
    const main = 100 - total;
    const mainInput = document.getElementById('mainUserPercent');
    const errorDiv = document.getElementById('collabError');

    if (!mainInput || !errorDiv) return;

    mainInput.value = main;

    // Limpiar estilos anteriores
    mainInput.style.color = '';
    errorDiv.style.display = 'none';
    errorDiv.innerText = '';

    // VALIDACIÓN 1: Suma excede 100%
    if (main < 0) {
        errorDiv.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            El porcentaje total no puede exceder 100%
        `;
        errorDiv.style.display = 'flex';
        errorDiv.style.alignItems = 'center';
        errorDiv.style.color = '#ef4444';
        mainInput.style.color = 'var(--error-color)';
        return;
    }

    // VALIDACIÓN 2: Propietario menos de 10% (SIEMPRE APLICA SI HAY COLABORADORES)
    if (main < 10 && collaborators.length > 0) {
        errorDiv.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Tú (propietario) debes tener mínimo 10% de regalías
        `;
        errorDiv.style.display = 'flex';
        errorDiv.style.alignItems = 'center';
        errorDiv.style.color = '#eab308';
        mainInput.style.color = '#eab308';
        return;
    }

    // TODO CORRECTO
    mainInput.style.color = '#00ff88';
}
// ========================================
// REMOVER COLABORADOR
// ========================================
window.removeCollab = (index) => {
    collaborators.splice(index, 1);
    isDirty = true;
    renderCollabs();
    // saveDraftAuto(); // ðŸ”¥ DISABLED AUTO-SAVE
};

// ========================================
// ACTUALIZAR ROL DE COLABORADOR
// ========================================
window.updateCollab = (index, field, value) => {
    if (field === 'role') {
        collaborators[index].role = value;
    }
    isDirty = true;
    // saveDraftAuto(); // ðŸ”¥ DISABLED AUTO-SAVE
};
// ðŸ”¥ NUEVA FUNCIÓN: Actualizar porcentaje de colaborador
// ðŸ”¥ FUNCIÓN MEJORADA: Actualizar porcentaje de colaborador
window.updateCollabPercent = (index, value) => {
    // Permitir solo números y guion para validar correctamente
    let cleanValue = value.toString().replace(/[^0-9-]/g, '');

    // Evitar múltiples guiones
    if ((cleanValue.match(/-/g) || []).length > 1) {
        cleanValue = cleanValue.replace(/-/g, '');
    }

    let percent = parseInt(cleanValue);

    // Si es NaN (vacío o inVálido), tratar como 0 temporalmente pero no sobrescribir si está escribiendo
    if (isNaN(percent)) percent = 0;

    // ðŸ”¥ LÍMITE INFERIOR: No permitir negativos
    if (percent < 0) percent = 0;

    // ðŸ”¥ CALCULAR MÃXIMO PERMITIDO
    const totalWithoutCurrent = collaborators
        .filter((_, i) => i !== index)
        .reduce((sum, c) => sum + c.percent, 0);

    // El propietario SIEMPRE debe tener mínimo 10%
    const maxAllowed = Math.max(0, 90 - totalWithoutCurrent);

    // ðŸ”¥ LÍMITE SUPERIOR: No exceder el máximo permitido
    if (percent > maxAllowed) {
        percent = maxAllowed;
    }

    // Actualizar colaborador
    collaborators[index].percent = percent;

    // Actualizar input visual
    const input = document.getElementById(`collabPercent${index}`);
    if (input) {
        input.value = percent;
        // Si el valor era negativo y se corrigió, forzar actualización visual
        if (value.includes('-')) input.value = percent;
    }

    updateMainUserPercent();
    isDirty = true;
    // saveDraftAuto(); // ðŸ”¥ DISABLED AUTO-SAVE
};
// ðŸ”¥ FUNCIÓN MEJORADA: Ajustar porcentaje con spinners
// ðŸ”¥ FUNCIÓN MEJORADA: Ajustar porcentaje con spinners
window.adjustCollabPercent = (index, delta) => {
    // Asegurar que trabajamos con números
    let currentPercent = parseInt(collaborators[index].percent);
    if (isNaN(currentPercent)) currentPercent = 0;

    let newPercent = currentPercent + delta;

    // ðŸ”¥ CALCULAR LÍMITES DINÃMICOS
    const totalWithoutCurrent = collaborators
        .filter((_, i) => i !== index)
        .reduce((sum, c) => sum + (parseInt(c.percent) || 0), 0);

    const maxAllowed = Math.max(0, 90 - totalWithoutCurrent);

    // ðŸ”¥ APLICAR LÍMITES ESTRICTOS
    if (newPercent < 0) newPercent = 0;
    if (newPercent > maxAllowed) newPercent = maxAllowed;

    // Actualizar usando la función principal con el valor seguro
    updateCollabPercent(index, newPercent.toString());
};


// ========================================
// DESCARGAR PRODUCTO (KIT)
// ========================================
window.downloadProduct = async function () {
    if (!formData.files.mp3_tagged) {
        // Shake button if possible, otherwise just log
        const btn = document.querySelector('.card-download-btn');
        if (btn) {
            btn.style.animation = 'shake 0.4s ease-in-out';
            setTimeout(() => btn.style.animation = '', 400);
        }
        return;
    }

    try {
        const url = URL.createObjectURL(formData.files.mp3_tagged);
        const a = document.createElement('a');
        a.href = url;
        a.download = formData.files.mp3_tagged.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (e) {
        showToast('Error al descargar', 'error');
    }
};

// ========================================
// VISTA PREVIA (STEP 4)
// ========================================
function renderPreview() {
    // ?? YOUTUBE INTEGRATION LOGIC
    if (window.isYouTubeUpload && window.YouTubeUploader) {
        const stdLayout = document.querySelector('#step4 .preview-layout');
        if (stdLayout) stdLayout.style.display = 'none';

        let ytContainer = document.getElementById('step4-yt-container');
        if (!ytContainer) {
            ytContainer = document.createElement('div');
            ytContainer.id = 'step4-yt-container';
            const step4 = document.getElementById('step4');
            // Insert before the closing form tag or inside step4
            // step4 contains h3 and prevent-layout. Append to step4 is fine.
            step4.appendChild(ytContainer);
        }
        ytContainer.style.display = 'block';

        // Prepare Data for YouTube Renderer
        const data = {
            title: document.getElementById('titleInput').value || 'Sin Título',
            desc: document.getElementById('descInput').value || '',
            coverBlob: formData.coverBlob, // The actual blob for processing
            coverUrl: document.getElementById('coverPreview')?.src, // For display
            audioBlob: formData.files.mp3_tagged || formData.files.wav_untagged,
            tags: tags // Global tags array
        };

        window.YouTubeUploader.renderPreviewUI(ytContainer.id, data);
        return; // ? STOP executing standard preview logic
    } else {
        // Restore standard layout
        const stdLayout = document.querySelector('#step4 .preview-layout');
        if (stdLayout) stdLayout.style.display = ''; // Revert to CSS default (flex/block)
        const ytContainer = document.getElementById('step4-yt-container');
        if (ytContainer) ytContainer.style.display = 'none';
    }

    const filesItems = []; // ? Declarar al inicio

    // Cover y título
    // Cover y título
    const cardCover = document.getElementById('previewCardCover');
    const previewImg = document.getElementById('coverPreview');
    // ðŸ”¥ FIX: Check for coverBlob OR existing uploaded cover
    if (formData.coverBlob) {
        cardCover.innerHTML = `<img src="${URL.createObjectURL(formData.coverBlob)}" alt="Cover">`;
    } else if (filesUploaded.cover && previewImg && previewImg.src && previewImg.src !== window.location.href) {
        cardCover.innerHTML = `<img src="${previewImg.src}" alt="Cover">`;
    } else {
        cardCover.innerHTML = '<span style="color: #666;">Sin portada</span>';
    }

    document.getElementById('previewCardTitle').innerText = document.getElementById('titleInput').value || 'Sin título';
    // ðŸ”¥ NUEVO: Mostrar nombre del productor
    const producerNameEl = document.getElementById('previewCardProducer');
    if (producerNameEl) {
        // ?? FIX: Use the variable already loaded in loadUserProfile()
        if (window.currentUserNickname) {
            producerNameEl.innerText = `por ${window.currentUserNickname}`;
        } else {
            // Fallback to fetch if not loaded yet (safety)
            supabaseClient
                .from('users')
                .select('nickname')
                .eq('id', userId)
                .single()
                .then(({ data }) => {
                    if (data && data.nickname) {
                        window.currentUserNickname = data.nickname;
                        producerNameEl.innerText = `por ${data.nickname}`;
                    }
                });
        }
    }
    document.getElementById('previewCardTags').innerHTML = tags.map(tag => `<div class="card-tag">#${tag}</div>`).join('');

    // ðŸ”¥ REEMPLAZAR TODA LA SECCIÓN DE PRECIOS (línea ~2440):
    // CALCULAR PRECIO DISPLAY
    let priceDisplay = 'Gratis';
    const enabledLicenses = Object.values(licensesState).filter(l => l.enabled);

    if (enabledLicenses.length > 0) {
        // Encontrar el precio más bajo
        const minPrice = Math.min(...enabledLicenses.map(l => l.price));
        priceDisplay = `$${minPrice}`;
    }

    // ðŸ”¥ CREAR EL CONTENEDOR DE PRECIO + BOTÓN
    const cardPriceContainer = document.querySelector('.card-content');
    const existingPriceRow = cardPriceContainer.querySelector('.card-price-row');

    if (existingPriceRow) {
        existingPriceRow.remove();
    }

    const priceRowHTML = `
        <div class="card-price-row" style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px;">
            <div class="card-price" id="previewCardPrice">
                ${priceDisplay}
            </div>
    <button class="card-download-btn" type="button" onclick="downloadProduct()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            </button>
        </div>
    `;

    cardPriceContainer.insertAdjacentHTML('beforeend', priceRowHTML);
    // ðŸ”¥ SECCIÓN DE ARCHIVOS CON ICONOS SVG
    const fileTypes = [
        {
            key: 'coverBlob',
            label: 'Portada',
            // ðŸ”¥ FIX: Show actual image if available
            icon: (function () {
                const preview = document.getElementById('coverPreview');
                const hasImg = (formData.coverBlob || filesUploaded.cover) && preview && preview.src && preview.src !== window.location.href;
                if (hasImg) {
                    return `<img src="${preview.src}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;">`;
                }
                return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
            })(),
            fileName: formData.coverBlob ? 'cover.jpg' : null
        },
        {
            key: 'mp3_tagged',
            label: 'MP3 con Tag (Vista Previa)',
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>',
            fileName: formData.files.mp3_tagged ? formData.files.mp3_tagged.name : null
        },
        {
            key: 'wav_untagged',
            label: 'WAV sin Tag',
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 16 21 8 20 8"></polyline><line x1="16" y1="21" x2="8" y2="21"></line><line x1="12" y1="21" x2="12" y2="3"></line></svg>',
            fileName: formData.files.wav_untagged ? formData.files.wav_untagged.name : null
        },
        {
            key: 'stems',
            label: 'Archivo de Stems (.zip)',
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
            fileName: formData.files.stems ? formData.files.stems.name : null
        }
    ];

    fileTypes.forEach(({ key, label, icon }) => {
        // ?? FIX: Check both formData (new) and filesUploaded (existing)
        const hasFile = key === 'coverBlob'
            ? (formData.coverBlob || filesUploaded.cover)
            : (formData.files[key] || filesUploaded[key]);

        if (hasFile) {
            filesItems.push(`
        <div class="verification-item file-item-ok" onclick="goToStep(1)" 
            style="cursor: pointer; background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; border-radius: 8px; padding: 12px; transition: all 0.2s;">
                        <div class="verification-item-icon">${icon}</div>
                        <div class="verification-item-text">${label} 
                            <span style="color: #22c55e; font-size: 12px; font-weight: 600;"> |  Subido - Clic para cambiar</span>
                        </div>
                    </div>
                `);
        } else {
            filesItems.push(`
        <div class="verification-item-missing file-item-missing" onclick="goToStep(1)" 
            style="cursor: pointer; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 8px; padding: 12px; transition: all 0.2s;">
                        <div class="verification-item-icon">${icon}</div>
                        <div class="verification-item-text">${label} 
                            <span style="color: #ef4444; font-size: 12px; font-weight: 600;">? Falta subir - Clic para ir</span>
                            <span style="margin-left: 8px; color: #ef4444;">?</span>
                        </div>
                    </div>
                `);
        }
    });

    document.getElementById('verifyFiles').innerHTML = filesItems.join('');

    // ðŸ”¥ DETALLES con iconos
    // DETALLES con iconos

    // ðŸ”¥ DETALLES con iconos
    const releaseDate = document.getElementById('dateInput').value;
    // ðŸ”¥ FIX: Manual Date Parse to avoid UTC shift
    let formattedDate = 'No especificada';
    if (releaseDate) {
        const parts = releaseDate.split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        const dateObj = new Date(year, month, day);
        formattedDate = dateObj.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    const visibility = document.getElementById('visibilityInput').value;
    const visibilityLabel = {
        'private': 'Privado',
        'public': 'Público',
        'unlisted': 'No listado'
    }[visibility] || visibility;



    document.getElementById('verifyDetails').innerHTML = `
    <div class="verification-item">
        <div class="verification-item-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
        </div>
        <div class="verification-item-text">Precio</div>
        <div class="verification-item-value" style="color: #00ff88;">${priceDisplay}</div>
    </div>
    
    <div class="verification-item">
        <div class="verification-item-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
        </div>
        <div class="verification-item-text">BPM</div>
        <div class="verification-item-value" style="color: #ddd;">${document.getElementById('bpmInput').value || '--'}</div>
    </div>

    <div class="verification-item">
        <div class="verification-item-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
            </svg>
        </div>
        <div class="verification-item-text">Key (Nota)</div>
        <div class="verification-item-value" style="color: #ddd;">${document.getElementById('keyDisplay') ? document.getElementById('keyDisplay').textContent.trim() : (document.getElementById('keyInput').value || '--')}</div>
    </div>

    <div class="verification-item">
        <div class="verification-item-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
        </div>
        <div class="verification-item-text">Lanzamiento</div>
        <div class="verification-item-value" style="font-size: 13px; color: #ddd;">${formattedDate}</div>
    </div>
    
    <div class="verification-item">
        <div class="verification-item-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        </div>
        <div class="verification-item-text">Visibilidad</div>
        <div class="verification-item-value" style="color: #ddd;">${visibilityLabel}</div>
    </div>
`;
    // ðŸ”¥ COLABORADORES: Siempre mostrar propietario
    const main = 100 - collaborators.reduce((sum, c) => sum + c.percent, 0);
    const producerName = window.currentUserNickname || 'Cargando...';
    let collabHTML = `
        <div class="verification-item">
            <div class="verification-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            </div>
            <div class="verification-item-text"><strong>${producerName}</strong></div>
            <div class="verification-item-value" style="color: #00ff88;">${main}%</div>
        </div>
    `;

    if (collaborators.length > 0) {
        collabHTML += collaborators.map(c => `
            <div class="verification-item" style="align-items: center;">
                <div class="verification-item-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                </div>
                <div class="verification-item-text">${c.name}</div>
                <div class="verification-item-value" style="color: #ddd;">${c.percent}%</div>
            </div>
        `).join('');
    }

    document.getElementById('verifyCollabs').innerHTML = collabHTML;
    document.getElementById('verifyCollabSection').style.display = 'block';
}
// ========================================
// NAVEGACIÓN ENTRE STEPS
// ========================================
function updateStepUI() {


    // ðŸ”¥ BARRA DE PROGRESO: Solo hasta el círculo activo
    // Paso 1: 0% (sin barra)
    // Paso 2: 33.33% (hasta el centro del círculo 2)
    // Paso 3: 66.66% (hasta el centro del círculo 3)
    // Paso 4: 100% (hasta el centro del círculo 4)
    // ðŸ”¥ NUEVO CÃLCULO: La barra llega HASTA el círculo activo (no más allá)
    // ðŸ”¥ CALCULAR POSICIÓN EXACTA DE CADA CÍRCULO
    // ðŸ”¥ BARRA DE PROGRESO: Llega COMPLETA hasta el círculo activo
    // ðŸ”¥ BARRA DE PROGRESO: Posiciones EXACTAS de cada círculo
    const progressBar = document.getElementById('stepsProgress');
    const stepsContainer = document.querySelector('.steps-container');

    if (stepsContainer && progressBar) {
        const circles = document.querySelectorAll('.step');

        if (currentStep === 1) {
            // Paso 1: Barra hasta el CENTRO del círculo 1
            const circle1 = circles[0];
            const circle1Center = circle1.offsetLeft + (circle1.offsetWidth / 2);
            progressBar.style.width = `${circle1Center - 20}px`; // -20 por el left inicial
        } else if (currentStep === 2) {
            // Paso 2: Barra hasta el CENTRO del círculo 2
            const circle2 = circles[1];
            const circle2Center = circle2.offsetLeft + (circle2.offsetWidth / 2);
            progressBar.style.width = `${circle2Center - 20}px`;
        } else if (currentStep === 3) {
            // Paso 3: Barra hasta el CENTRO del círculo 3
            const circle3 = circles[2];
            const circle3Center = circle3.offsetLeft + (circle3.offsetWidth / 2);
            progressBar.style.width = `${circle3Center - 20}px`;
        } else if (currentStep === 4) {
            // Paso 4: Barra COMPLETA hasta el final
            progressBar.style.width = `calc(100% - 40px)`; // ðŸ”¥ Llega hasta el borde derecho
        }
    }

    // ðŸ”¥ ACTUALIZAR CÍRCULOS
    document.querySelectorAll('.step').forEach(s => {
        const num = parseInt(s.dataset.step);

        // ðŸ”¥ LIMPIAR CLASES ANTERIORES
        s.classList.remove('active', 'completed');

        if (num === currentStep) {
            // ðŸ”¥ CÍRCULO ACTIVO: Borde morado, sin relleno
            s.classList.add('active');
        } else if (num < currentStep) {
            // ðŸ”¥ CÍRCULOS COMPLETADOS: Fondo morado, número blanco
            s.classList.add('completed');
        }
        // ðŸ”¥ Los círculos futuros quedan grises por defecto (no necesitan clase)
    });
    // Mostrar/ocultar form-steps
    document.querySelectorAll('.form-step').forEach(f => f.classList.remove('active'));
    const activeStep = document.getElementById(`step${currentStep}`);
    if (activeStep) {
        activeStep.classList.add('active');

    } else {
        console.error('âŒ No se encontró #step' + currentStep);
    }

    // Botón "Anterior"
    document.getElementById('prevBtn').style.visibility = currentStep === 1 ? 'hidden' : 'visible';

    // Botón "Siguiente" / "Publicar"
    const nextBtn = document.getElementById('nextBtn');
    const publishWrapper = document.getElementById('publishWrapper');

    if (currentStep === 4) {
        if (nextBtn) nextBtn.style.display = 'none';
        if (publishWrapper) publishWrapper.style.display = 'inline-block';
    } else {
        if (nextBtn) nextBtn.style.display = 'block';
        if (publishWrapper) publishWrapper.style.display = 'none';
    }


}
// ðŸ”¥ NUEVA FUNCIÓN: Toggle Publish Dropdown
window.togglePublishDropdown = function (e) {
    e.stopPropagation();
    const dropdown = document.getElementById('publishDropdownContent');
    const arrow = document.querySelector('#publishBtn svg');

    if (dropdown) {
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';

        // Rotate arrow if present
        if (arrow) {
            arrow.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    }

    // Close other dropdowns
    const keyList = document.getElementById('keyOptionsList');
    if (keyList) keyList.style.display = 'none';
}

// Close dropdown when clicking outside
window.addEventListener('click', () => {
    const dropdown = document.getElementById('publishDropdownContent');
    const arrow = document.querySelector('#publishBtn svg');
    if (dropdown) {
        dropdown.style.display = 'none';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
});

// ðŸ”¥ NUEVA FUNCIÓN: Ir a un step específico desde la preview
window.goToStep = function (stepNumber) {
    if (stepNumber < 1 || stepNumber > totalSteps) return;
    currentStep = stepNumber;
    updateStepUI();

    // ðŸ”¥ UPDATE: Init licenses if entering Step 2
    if (currentStep === 2) {
        setTimeout(() => initLicenses(), 50);
    }
};
function handleNext() {
    // Validar el paso actual
    if (!validateStep(currentStep)) {

        return;
    }

    // Marcar paso como completado
    if (!completedSteps.includes(currentStep)) {
        completedSteps.push(currentStep);
    }



    // ðŸ”¥ Auto-generar tags al llegar al Step 2
    // if (currentStep === 1 && tags.length === 0) {
    //     setTimeout(() => {
    //         // Solo generar sugerencias visuales, NO aplicar automáticamente
    //         autoFillTags();
    //     }, 300);
    // }

    // Si vamos al step 4, renderizar preview
    if (currentStep + 1 === 4) {
        setTimeout(() => {
            renderPreview();
            updateCompletionProgress();
        }, 100);
    }

    // Guardar draft
    // saveDraftAuto(); // ðŸ”¥ DISABLED REQUESTED BY USER

    // Avanzar al siguiente paso
    currentStep++;


    updateStepUI();

    // ðŸ”¥ UPDATE: Init licenses if entering Step 2
    if (currentStep === 2) {
        setTimeout(() => initLicenses(), 50);
    }

    // ðŸ”¥ FORZAR actualización de la barra DESPUÃ‰S de updateStepUI
    setTimeout(() => {
        const progressBar = document.getElementById('stepsProgress');
        const circles = document.querySelectorAll('.step');

        if (!progressBar || !circles.length) return;

        if (currentStep === 1) {
            const circle1 = circles[0];
            const circle1Center = circle1.offsetLeft + (circle1.offsetWidth / 2);
            progressBar.style.width = `${circle1Center - 20}px`;
        } else if (currentStep === 2) {
            const circle2 = circles[1];
            const circle2Center = circle2.offsetLeft + (circle2.offsetWidth / 2);
            progressBar.style.width = `${circle2Center - 20}px`;
        } else if (currentStep === 3) {
            const circle3 = circles[2];
            const circle3Center = circle3.offsetLeft + (circle3.offsetWidth / 2);
            progressBar.style.width = `${circle3Center - 20}px`;
        } else if (currentStep === 4) {
            progressBar.style.width = `calc(100% - 40px)`;
        }
    }, 100); // â† Aumentado a 100ms para dar tiempo al DOM
}
// ========================================
// COMPLETION PROGRESS TRACKER
// ========================================
function updateCompletionProgress() {
    // Esta función ya no hace nada - el badge fue removido
    console.log('🔥 Progress tracker deshabilitado');
}

// ========================================
// SPINNERS DE COLABORADORES
// ========================================
let collabSpinnerInterval = null;
let collabSpinnerTimeout = null;

window.startCollabSpinner = function (index, delta) {
    adjustCollabPercent(index, delta);
    collabSpinnerTimeout = setTimeout(() => {
        collabSpinnerInterval = setInterval(() => {
            adjustCollabPercent(index, delta);
        }, 80);
    }, 400);
}

window.stopCollabSpinner = function () {
    if (collabSpinnerTimeout) clearTimeout(collabSpinnerTimeout);
    if (collabSpinnerInterval) clearInterval(collabSpinnerInterval);
    collabSpinnerTimeout = null;
    collabSpinnerInterval = null;
}

// 🔥 FIX: Validar fecha permitiendo "Hoy" sin hora
function validateReleaseDate() {
    const input = document.getElementById('dateInput');
    if (!input || !input.value) return false;

    // ðŸ”¥ BYPASS: El usuario solicitó quitar la validación de fecha pasada.
    // "en bypass siempre nos va a dejar pasar, sea pasado o no"
    return true;
}

// ðŸ”´ FUNCIÓN MEJORADA: validateStep con Inline Validation
// ðŸ´ FUNCIÓN MEJORADA: validateStep con Inline Validation
function validateStep(step) {
    clearInlineErrors(); // Limpiar errores previos
    let isValid = true;
    let errors = [];

    if (step === 1) {
        // 1. MP3 Tagged (Required for Preview)
        if (!formData.files.mp3_tagged && !filesUploaded.mp3_tagged) {
            showInlineError('mp3TaggedDropZone', 'Debes subir el MP3 Tagged (Preview)');
            errors.push('Falta MP3 Tagged');
            isValid = false;
        }

        // 2. Cover (Required)
        if (!formData.coverBlob && !filesUploaded.cover) {
            showInlineError('coverDropZone', 'Debes subir una portada (1080x1080px)');
            errors.push('Falta Portada');
            isValid = false;
        }

        // 3. Title (Required)
        const titleInput = document.getElementById('titleInput');
        if (!titleInput.value.trim()) {
            showInlineError('titleInput', 'El título es obligatorio');
            errors.push('Falta Título');
            isValid = false;
        }

        // 4. Visibility (Required)
        const visInput = document.getElementById('visibilityInput');
        if (!visInput.value) {
            showInlineError('visibilityInput', 'Selecciona la visibilidad');
            errors.push('Falta Visibilidad');
            isValid = false;
        }

        // 5. Release Date
        const hasDate = document.getElementById('dateInput').value !== '';
        const dateValid = validateReleaseDate();
        if (!hasDate || !dateValid) {
            // validateReleaseDate ya muestra sus propios errores si es inválida, 
            // pero aquí aseguramos que si está vacío también marque error.
            if (!hasDate) showInlineError('dateInput', 'La fecha de lanzamiento es obligatoria');
            errors.push('Fecha de lanzamiento inválida o faltante');
            isValid = false;
        }
    }

    if (step === 2) {
        // ðŸ”¥ Validar Licencias (Mínimo 1 activa)
        const enabledLicenses = Object.values(licensesState).filter(l => l.enabled);
        if (enabledLicenses.length === 0) {
            showToast('Debes habilitar al menos una licencia', 'error');
            errors.push('Falta habilitar licencia');
            isValid = false;
        }

        // Validar precios de licencias activas
        const invalidPrice = enabledLicenses.some(l => l.price < 0 || isNaN(l.price));
        if (invalidPrice) {
            showToast('Revisa los precios de las licencias', 'error');
            errors.push('Precio inVálido');
            isValid = false;
        }

        // ðŸ”¥ Validar Tags (Mínimo 1)
        if (tags.length === 0) {
            showInlineError('tagInput', 'Debes agregar al menos 1 tag');
            errors.push('Faltan los tags');
            isValid = false;
        }

        // ðŸ”¥ Validar BPM (Min 1)
        const bpmInput = document.getElementById('bpmInput');
        if (!bpmInput.value || parseInt(bpmInput.value) < 1) {
            showInlineError('bpmInput', 'Debes especificar el BPM');
            errors.push('BPM inVálido');
            isValid = false;
        }

        // ðŸ”¥ Validar Key (Select)
        const keyInput = document.getElementById('keyInput');
        if (!keyInput.value || keyInput.value === '') {
            // Show error on the custom trigger since the select is hidden
            const trigger = document.getElementById('keyCustomTrigger');
            if (trigger) {
                trigger.style.borderColor = '#ef4444';
                // Remove error style on click
                trigger.onclick = (e) => {
                    trigger.style.borderColor = '';
                    toggleKeyDropdown(e);
                };
            }
            // Also show standard inline error if possible, but custom trigger handling is better
            showInlineError('keyCustomTrigger', 'Debes seleccionar una tonalidad (Key)');
            errors.push('Falta el Key');
            isValid = false;
        }
    }

    if (step === 3) {
        const totalCollabPercent = collaborators.reduce((sum, c) => sum + c.percent, 0);
        const mainUserPercent = 100 - totalCollabPercent;

        // VALIDACIÓN 1: Suma total no puede exceder 100%
        if (mainUserPercent < 0) {
            showToast('El porcentaje total excede 100%', 'error');
            return false;
        }

        // VALIDACIÓN 2: Si hay colaboradores, propietario debe tener mínimo 10%
        if (collaborators.length > 0 && mainUserPercent < 10) {
            showToast('Debes conservar mínimo 10% de regalías', 'error');
            return false;
        }
    }

    if (!isValid) {
        // Scroll al primer error
        const firstError = document.querySelector('.error-message, .input-field.error, .upload-zone.error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return false;
    }

    return true;
}

// ========================================
// INLINE VALIDATION HELPERS
// ========================================
function showInlineError(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) return;

    // 1. Agregar clase de error al elemento (input, dropzone, etc)
    element.classList.add('error');

    // ðŸ”¥ FIX: Determinar contenedor correcto para el mensaje
    // Si el padre es .number-control (flex) O es tagInput, el error debe ir afuera (en el abuelo/form-group)
    let targetContainer = element.parentNode;

    if (element.parentNode.classList.contains('number-control') ||
        element.id === 'tagInput' ||
        element.classList.contains('tags-input') ||
        element.parentNode.classList.contains('tags-container') ||
        element.parentNode.classList.contains('select-wrapper') ||
        element.parentNode.classList.contains('input-with-icon')) {
        // Intentar ir al .form-group más cercano, sino subir dos niveles
        targetContainer = element.closest('.form-group') || element.parentNode.parentNode;
    }

    // 2. Crear mensaje de error si no existe EN EL CONTENEDOR CORRECTO
    let errorDiv = targetContainer.querySelector('.error-message');

    // Si no existe, crearlo
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        targetContainer.appendChild(errorDiv);
    }

    // Usar innerHTML para permitir saltos de línea y formateo
    errorDiv.innerHTML = message;
    errorDiv.style.display = 'block'; // Changed from flex to block for better multi-line handling
}

function clearInlineError(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.classList.remove('error');

    let targetContainer = element.parentNode;
    if (element.parentNode.classList.contains('number-control') ||
        element.id === 'tagInput' ||
        element.classList.contains('tags-input') ||
        element.parentNode.classList.contains('tags-container') ||
        element.parentNode.classList.contains('select-wrapper') ||
        element.parentNode.classList.contains('input-with-icon')) {
        targetContainer = element.closest('.form-group') || element.parentNode.parentNode;
    }

    const errorDiv = targetContainer.querySelector('.error-message');
    if (errorDiv) errorDiv.remove();
}

function clearInlineErrors() {
    // 1. Quitar clases de error
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

    // 2. Remover mensajes de error
    document.querySelectorAll('.error-message').forEach(el => el.remove());
}

// ========================================
// LOADING OVERLAY
// ========================================
// Consolidating loading logic to use a unified overlay
function showLoading(title = 'CARGANDO...', message = 'Por favor espera...') {
    const overlay = document.getElementById('publishOverlay') || document.getElementById('loadingOverlay');
    if (overlay) {
        const titleEl = overlay.querySelector('h3');
        const msgEl = overlay.querySelector('p');
        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;
        overlay.style.display = 'flex';
        overlay.classList.remove('hidden');
    }
}

function hideLoading() {
    const overlay = document.getElementById('publishOverlay') || document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    }
}

// ========================================
// UNIQUE LINK GENERATION
// ========================================
function generatePreviewToken() {
    // Generate secure random token for preview links
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

function generatePublicSlug(title) {
    // Generate clean URL-safe slug from title
    // ðŸ”¥ IMPROVED LOGIC: Handle separators like + and _ better
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

// Copy unique link to clipboard
function copyUniqueLink() {
    const linkInput = document.getElementById('uniqueLinkInput');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // For mobile

    navigator.clipboard.writeText(linkInput.value).then(() => {
        showToast('Link copiado', 'success');
    }).catch(() => {
        // Fallback for older browsers
        document.execCommand('copy');
        showToast('Link copiado', 'success');
    });
}

// ========================================
// TAGS GENERATION FALLBACK
// ========================================
async function generateTagsFallback(title, description, audioAnalysis) {
    // Simular "pensamiento" de IA
    await new Promise(resolve => setTimeout(resolve, 800));

    const keywords = [];
    const text = (title + ' ' + description).toLowerCase();

    // 1. Análisis de Texto Básico
    const genreKeywords = {
        'trap': ['trap', 'dark', 'hard', '808', 'metro', 'future'],
        'drill': ['drill', 'uk drill', 'ny drill', 'slide', 'gliding'],
        'lofi': ['lofi', 'chill', 'relax', 'study', 'jazz'],
        'rnb': ['rnb', 'soul', 'smooth', 'love', 'emotional'],
        'reggaeton': ['reggaeton', 'latino', 'perreo', 'dembow'],
        'hiphop': ['hiphop', 'boombap', 'oldschool', 'classic'],
        'rage': ['rage', 'yeat', 'synth', 'playboi', 'energetic']
    };

    for (const [genre, tags] of Object.entries(genreKeywords)) {
        if (text.includes(genre)) {
            keywords.push(...tags);
        }
    }

    // 2. Análisis de Audio (Simulado si no hay real)
    if (audioAnalysis) {
        if (audioAnalysis.bpm > 130) keywords.push('fast', 'energetic', 'club');
        if (audioAnalysis.bpm < 100) keywords.push('slow', 'mellow', 'vibe');
    }

    // 3. Defaults universales si no encontramos nada
    if (keywords.length === 0) {
        keywords.push('drumkit', 'samplepack', 'loops', 'oneshots', 'producer', 'sounds');
    }

    // Garantizar al menos 6 tags únicos
    const uniqueTags = [...new Set(keywords)];
    while (uniqueTags.length < 6) {
        const defaults = ['trap', 'hiphop', 'loop', 'sound', 'kit', 'drums', 'wav'];
        const random = defaults[Math.floor(Math.random() * defaults.length)];
        if (!uniqueTags.includes(random)) uniqueTags.push(random);
    }

    return uniqueTags;
}
// ========================================
// CARGAR BORRADOR (VERSIÓN MEJORADA)
// ========================================
// ========================================
// CARGAR BORRADOR (VERSIÓN BEATS)
// ========================================
let isRestoringDraft = false; // ðŸ”¥ PREVENT DOUBLE CALLS

async function loadDraft() {
    if (isRestoringDraft) return;
    isRestoringDraft = true;

    try {
        // Fetch first, only show loading if we actually have something to load
        const { data, error } = await supabaseClient
            .from('beat_drafts')
            .select('*')
            .eq('user_id', userId)
            .order('last_saved', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Error cargando borrador:', error);
            return;
        }

        if (!data) {
            localStorage.removeItem('offszn_has_draft');
            if (window.initLicenses) initLicenses(); // Default init
            return;
        }

        // Parse files_data
        const filesData = data.files_data || {};

        // Check if draft has meaningful content
        const hasContent = data.title || data.description ||
            filesData.cover || filesData.kit || filesData.audio ||
            (data.licenses && Object.keys(data.licenses || {}).length > 0);

        if (!hasContent) {
            localStorage.removeItem('offszn_has_draft');
            if (window.initLicenses) initLicenses();
            return;
        }

        // If we reach here, we have a valid draft. Show loading.
        showLoading('RESTAURANDO BORRADOR...', 'Recuperando tus archivos...');

        localStorage.setItem('offszn_has_draft', 'true');

        // Restore Text Fields
        if (data.title) {
            const titleInput = document.getElementById('titleInput');
            if (titleInput) {
                titleInput.value = data.title;
                document.getElementById('titleCount').textContent = data.title.length;
            }
        }
        if (data.description) {
            const descInput = document.getElementById('descriptionInput') || document.getElementById('descInput');
            if (descInput) {
                descInput.value = data.description;
                const descCount = document.getElementById('descCount');
                if (descCount) descCount.textContent = data.description.length;
            }
        }

        // Restore BPM & KEY
        if (data.bpm) {
            const bpmInput = document.getElementById('bpmInput');
            if (bpmInput) bpmInput.value = data.bpm;
        }
        if (data.key_scale !== undefined && data.key_scale !== null) {
            const keyInput = document.getElementById('keyInput');
            const keyDisplay = document.getElementById('keyDisplay');
            if (keyInput) {
                keyInput.value = data.key_scale;
            }
            if (keyDisplay) {
                keyDisplay.textContent = data.key_scale || 'Sin tonalidad';
                keyDisplay.style.color = data.key_scale ? '#fff' : '#ccc';
            }
        }

        // Restore Date
        const dateInput = document.getElementById('dateInput');
        if (dateInput) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            dateInput.value = `${year}-${month}-${day}`;
        }

        // Restore Visibility
        const visibilityInput = document.getElementById('visibilityInput');
        if (visibilityInput && data.visibility) {
            visibilityInput.value = data.visibility;
            visibilityInput.disabled = false;
            visibilityInput.classList.remove('skeleton');
        }

        // Restore Collaborators
        if (data.collaborators && Array.isArray(data.collaborators)) {
            collaborators = data.collaborators;
            renderCollabs();
        }

        // Restore Navigation
        if (data.current_step) currentStep = data.current_step;
        if (data.completed_steps) completedSteps = data.completed_steps;
        updateStepUI();

        // Restore Tags
        if (data.tags && Array.isArray(data.tags)) {
            tags = [...new Set(data.tags)];
            renderTags();
        }

        // Restore Licenses
        if (data.licenses) {
            licensesState = data.licenses;
            // ðŸ”¥ Ensure DEFAULT_LICENSES are merged
            DEFAULT_LICENSES.forEach(lic => {
                if (!licensesState[lic.id]) {
                    licensesState[lic.id] = { enabled: false, price: lic.defaultPrice };
                }
            });

            // ðŸ”¥ IMPORTANT: Also check for "audio_url" legacy to enable basic license if missed
            if (!licensesState.mp3?.enabled && (data.audio_url || data.mp3_url)) {
                licensesState.mp3 = { enabled: true, price: licensesState.mp3?.price || 20 };
            }

            window.freeDownloadEnabled = !!data.free_download;
            // Note: renderLicenses called later after files are restored
        } else {
            initLicenses();
        }

        // Restore Discount
        if (data.discount_amount) {
            const offerInput = document.getElementById('offerInput');
            if (offerInput) offerInput.value = data.discount_amount;
        }
        if (data.discount_type) {
            const radio = document.querySelector(`input[name="offerType"][value="${data.discount_type}"]`);
            if (radio) radio.checked = true;
        }

        // ========================================
        // RESTORE FILES (Using files_data)
        // ========================================
        const fileTypes = [
            { key: 'cover', inputId: 'coverInput', dropZoneId: 'coverDropZone', previewContainerId: 'coverPreview', isImage: true },
            { key: 'mp3_tagged', inputId: 'mp3TaggedInput', dropZoneId: 'mp3TaggedDropZone', previewContainerId: 'mp3TaggedPreviewContainer', isImage: false },
            { key: 'wav_untagged', inputId: 'wavUntaggedInput', dropZoneId: 'wavUntaggedDropZone', previewContainerId: 'wavUntaggedPreviewContainer', isImage: false },
            { key: 'stems', inputId: 'stemsInput', dropZoneId: 'stemsDropZone', previewContainerId: 'stemsPreviewContainer', isImage: false }
        ];

        // Reset blobs
        audioBlobs = { mp3: null, wav: null };

        for (const fileType of fileTypes) {
            const url = filesData[fileType.key];
            if (url) {
                try {
                    const { data: signedUrlData } = await supabaseClient.storage
                        .from('beat-drafts')
                        .createSignedUrl(url, 3600);

                    if (signedUrlData?.signedUrl) {
                        const response = await fetch(signedUrlData.signedUrl);
                        if (response.ok) {
                            const blob = await response.blob();
                            const blobUrl = URL.createObjectURL(blob);

                            if (fileType.key === 'cover') {
                                formData.coverBlob = blob;
                                const preview = document.getElementById('coverPreview');
                                const dropZone = document.getElementById('coverDropZone');
                                if (preview && dropZone) {
                                    preview.src = blobUrl;
                                    preview.style.display = 'block';
                                    dropZone.classList.add('has-image');
                                    filesUploaded.cover = true;

                                    const removeBtn = document.getElementById('removeCoverBtn');
                                    if (removeBtn) removeBtn.style.display = 'block';
                                }
                            } else {
                                // Kit or Audio
                                let displayName = url.split('/').pop().replace(/^\d+_[a-f0-9-]+_/, '');
                                formData.files[fileType.key] = new File([blob], displayName, { type: blob.type });
                                filesUploaded[fileType.key] = true;

                                // Populate audioBlobs
                                if (fileType.key === 'mp3_tagged') audioBlobs.mp3 = blobUrl;
                                if (fileType.key === 'wav_untagged') audioBlobs.wav = blobUrl;

                                // ðŸ”¥ Restore visual state (Add class & Check icon)
                                const dz = document.getElementById(fileType.dropZoneId);
                                if (dz) {
                                    dz.classList.add('has-file');
                                    dz.classList.add('success'); // Ensure green border

                                    // ðŸ”¥ HIDE SUCCESS STATE (No checkmark/X)
                                    // const successState = dz.querySelector('.success-state');
                                    // if (successState) successState.style.display = 'flex';

                                    // ðŸ”¥ SET BUTTON TEXT
                                    const ctaBtn = dz.querySelector('.upload-cta-btn span');
                                    if (ctaBtn) {
                                        ctaBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Reemplazar Archivo`;
                                    }

                                    // Optional: Update text inside dropzone if needed
                                    const formatBadge = dz.querySelector('.format-badge');
                                    if (formatBadge) formatBadge.style.borderColor = '#00ff88';
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`Error restoring ${fileType.key}:`, e);
                }
            }
        }

        // Init Player & Switcher after loading all files
        if (audioBlobs.mp3 || audioBlobs.wav) {
            const initialType = audioBlobs.mp3 ? 'mp3' : 'wav';
            currentAudioType = initialType;

            if (wavesurfer) {
                wavesurfer.load(audioBlobs[initialType]);
                document.getElementById('waveform').style.display = 'block';
                document.getElementById('playerPlaceholder').style.display = 'none';
                document.getElementById('playPauseBtn').disabled = false;
            }


        }

        // Final Render (Licenses need filesUploaded state)
        if (data.licenses) {
            renderLicenses();
        }



        // ðŸ”¥ WAIT FOR AUDIO WAVEFORM (Ensuring overlay stays until ready)
        setTimeout(async () => {
            try {
                if (wavesurfer && (audioBlobs.mp3 || audioBlobs.wav)) {
                    // Wait for ready event with timeout
                    const audioPromise = new Promise(resolve => wavesurfer.once('ready', resolve));
                    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
                    await Promise.race([audioPromise, timeoutPromise]);
                }
            } finally {
                hideLoading();
                isRestoringDraft = false; // Reset flag
            }
        }, 100);

    } catch (e) {
        console.error('âŒ Error restoring draft:', e);
        hideLoading();
        isRestoringDraft = false;
    }
    // ðŸ”¥ REMOVED global finally { hideLoading() } to let the timeout handle it
}
// ========================================
// NOTIFICAR COLABORADORES
// ========================================
async function notifyCollaborators() {
    if (collaborators.length === 0) {
        showToast('No hay colaboradores para notificar', 'error');
        return;
    }

    const btn = document.getElementById('notifyCollabsBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
                    <svg style="width:18px;height:18px;animation:spin 1s linear infinite" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                    </svg>
                    Enviando...
                `;

    try {
        const productTitle = document.getElementById('titleInput').value || 'Nuevo Drumkit';

        // ðŸ”¥ USAR LA TABLA 'notifications' EN LUGAR DE 'messages'
        for (const collab of collaborators) {
            const { error } = await supabaseClient
                .from('notifications')
                .insert({
                    user_id: collab.id,
                    type: 'collaboration_invite',
                    title: 'ðŸŽµ Nueva Colaboración',
                    message: `Has sido agregado como ${collab.role} en "${productTitle}" con ${collab.percent}% de regalías.`,
                    data: {
                        product_id: currentDraftId,
                        producer_id: userId,
                        role: collab.role,
                        percentage: collab.percent
                    },
                    read: false,
                    created_at: new Date().toISOString()
                });

            if (error) {
                console.error('Error insertando notificación:', error);
                throw error;
            }
        }

        showToast('Colaboradores notificados', 'success');
    } catch (error) {
        console.error('âŒ Error completo:', error);

        // ðŸ”¥ MOSTRAR ERROR ESPECÍFICO
        if (error.message.includes('relation') || error.message.includes('does not exist')) {
            showToast('âš ï¸ Tabla de notificaciones no existe. Creándola...', 'error');
            console.log('ðŸ”§ Necesitas crear la tabla "notifications" en Supabase');
        } else {
            showToast('Error: ' + error.message, 'error');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// 🔥 RENAMED: Manual Save only
async function saveDraftManual() {
    if (isSaving || window.isPublishing) return;

    // ðŸ”¥ Check for actual content
    const title = document.getElementById('titleInput')?.value.trim();
    const hasFiles = formData.files.kit || formData.files.audio || formData.coverBlob;
    const hasTags = tags.length > 0;
    const hasCollabs = collaborators.length > 0;

    if (!title && !hasFiles && !hasTags && !hasCollabs) {
        return;
    }

    // ðŸ”¥ EXIT IF IN EDIT MODE
    if (window.currentEditId) {
        return;
    }

    try {
        isSaving = true;

        const titleInput = document.getElementById('titleInput');
        const descInput = document.getElementById('descInput');
        const dateInput = document.getElementById('dateInput');
        const visibilityInput = document.getElementById('visibilityInput');

        // Beat Specific Inputs
        const bpmInput = document.getElementById('bpmInput');
        const keyInput = document.getElementById('keyInput');

        // Price specific - ADAPTING TO NEW MULTI-LICENSE or keeping simple logic for now?
        // The previous step indicated "integrating multi-license", but the HTML still reflects singular inputs in some places.
        // Assuming we use the JSONB licenses structure, but for now capturing the visible inputs.
        const priceInput = document.getElementById('priceInput');
        const freeToggle = document.getElementById('freeToggle');
        const offerInput = document.getElementById('offerInput');
        const offerTypeRadio = document.querySelector('input[name="offerType"]:checked');

        // Retrieve existing files_data logic
        // If we have currentDraftId, we should fetch existing files_data to not overwrite with nulls if we are not uploading new files
        let existingFilesData = {};
        if (currentDraftId) {
            const { data } = await supabaseClient
                .from('beat_drafts')
                .select('files_data')
                .eq('id', currentDraftId)
                .maybeSingle();
            if (data) existingFilesData = data.files_data || {};
        }

        const draftData = {
            user_id: userId,
            title: titleInput?.value || null,
            description: descInput?.value || null,
            release_date: dateInput?.value || null,
            visibility: visibilityInput?.value || 'private',
            tags: tags.length > 0 ? tags : null,

            // BEAT SPECIFIC
            bpm: bpmInput ? parseInt(bpmInput.value) || null : null,
            key_scale: keyInput?.value || null,

            // Pricing (Legacy logic mapping to simple fields or new licenses structure? 
            // Let's use the simple fields map for now as placeholders if licenses UI isn't fully built yet,
            // OR map them to a basic license structure)
            // price: priceInput ? parseInt(priceInput.value) || null : null, 
            // Note: beat_drafts table has 'licenses' JSONB, not simple 'price'.
            // We will map the simple input to a 'Basic' license in JSONB.

            licenses: licensesState,
            free_download: window.freeDownloadEnabled,

            discount_amount: document.getElementById('offerInput')?.value || null,
            discount_type: document.querySelector('input[name="offerType"]:checked')?.value || null,

            collaborators: collaborators.length > 0 ? collaborators : null,
            current_step: currentStep,
            completed_steps: completedSteps,
            last_saved: new Date().toISOString(),

            files_data: existingFilesData // Will update below
        };

        // Helper for upload
        // console.log("Manual Save Triggered"); // Debug removed
        const bucket = 'beat-drafts';

        // 1. Cover
        if (formData.coverBlob && !filesUploaded.cover) {
            // ðŸ”¥ CLEANUP: If replacing an existing file, delete the old one first
            if (existingFilesData.cover) {
                console.log('ðŸ§¹ [DRAFT-CLEANUP] Reemplazando cover antiguo...');
                await deleteFileFromStorage(existingFilesData.cover, bucket);
            }

            const coverFile = new File([formData.coverBlob], 'cover.jpg', { type: 'image/jpeg' });
            const key = await uploadToR2(coverFile, 'drafts/covers');
            draftData.files_data.cover = `https://offszn-storage.41d0f49121d02c88f71fdb4da54a791d.r2.cloudflarestorage.com/${key}`;
            console.log('✅ [R2] Cover uploaded:', draftData.files_data.cover);
            filesUploaded.cover = true;
        }

        // 2. MP3 Tagged
        if (formData.files.mp3_tagged && !filesUploaded.mp3_tagged) {
            // ðŸ”¥ CLEANUP
            if (existingFilesData.mp3_tagged) {
                console.log('ðŸ§¹ [DRAFT-CLEANUP] Reemplazando MP3 antiguo...');
                await deleteFileFromStorage(existingFilesData.mp3_tagged, bucket);
            }
            console.log('?? Subiendo MP3 de borrador a R2...');
            const key = await uploadToR2(formData.files.mp3_tagged, 'drafts/mp3');
            draftData.files_data.mp3_tagged = `https://offszn-storage.41d0f49121d02c88f71fdb4da54a791d.r2.cloudflarestorage.com/${key}`;
            console.log('✅ [R2] MP3 uploaded:', draftData.files_data.mp3_tagged);
            filesUploaded.mp3_tagged = true;
        }

        // 3. WAV Untagged
        if (formData.files.wav_untagged && !filesUploaded.wav_untagged) {
            // ðŸ”¥ CLEANUP
            if (existingFilesData.wav_untagged) {
                console.log('ðŸ§¹ [DRAFT-CLEANUP] Reemplazando WAV antiguo...');
                await deleteFileFromStorage(existingFilesData.wav_untagged, bucket);
            }
            console.log('?? Subiendo WAV de borrador a R2...');
            const key = await uploadToR2(formData.files.wav_untagged, 'drafts/wav');
            draftData.files_data.wav_untagged = key; // Preserve key for private files
            console.log('✅ [R2 Secure] WAV uploaded (Key):', key);
            filesUploaded.wav_untagged = true;
        }

        // 4. Stems
        if (formData.files.stems && !filesUploaded.stems) {
            // ðŸ”¥ CLEANUP
            if (existingFilesData.stems) {
                console.log('ðŸ§¹ [DRAFT-CLEANUP] Reemplazando Stems antiguos...');
                await deleteFileFromStorage(existingFilesData.stems, bucket);
            }
            console.log('?? Subiendo Stems de borrador a R2...');
            const key = await uploadToR2(formData.files.stems, 'drafts/stems');
            draftData.files_data.stems = key; // Preserve key
            console.log('✅ [R2 Secure] Stems uploaded (Key):', key);
            filesUploaded.stems = true;
        }

        // ========================================
        // 5. ðŸ”¥ EXPLICIT REMOVALS (If removed in UI)
        // ========================================
        // If existing data has file, but UI says No File (and not just "not re-uploaded"), it means user deleted it.
        // Logic: 
        // - filesUploaded.cover == false means "Dirty or Empty"
        // - formData.coverBlob == null means "Empty"
        // - existingFilesData.cover == 'path' means "Was there before"
        // => DELETE IT.

        if (!filesUploaded.cover && !formData.coverBlob && existingFilesData.cover) {
            await deleteFileFromStorage(existingFilesData.cover, bucket);
            draftData.files_data.cover = null;
        }
        if (!filesUploaded.mp3_tagged && !formData.files.mp3_tagged && existingFilesData.mp3_tagged) {
            await deleteFileFromStorage(existingFilesData.mp3_tagged, bucket);
            draftData.files_data.mp3_tagged = null;
        }
        if (!filesUploaded.wav_untagged && !formData.files.wav_untagged && existingFilesData.wav_untagged) {
            await deleteFileFromStorage(existingFilesData.wav_untagged, bucket);
            draftData.files_data.wav_untagged = null;
        }
        if (!filesUploaded.stems && !formData.files.stems && existingFilesData.stems) {
            await deleteFileFromStorage(existingFilesData.stems, bucket);
            draftData.files_data.stems = null;
        }




        // UPSERT in DB
        console.log('ðŸ’¾ Saving Draft Payload:', draftData);

        if (currentDraftId) {
            const { data, error } = await supabaseClient
                .from('beat_drafts')
                .update(draftData)
                .eq('id', currentDraftId)
                .select(); // ðŸ”¥ Return updated row to verify

            if (error) throw error;

            if (!data || data.length === 0) {
                console.error('âŒ Draft Update returned 0 rows. ID mismatch?', currentDraftId);
                throw new Error('No se pudo actualizar el borrador (Row not found)');
            }
            console.log('âœ… Draft Update Success:', data);

        } else {
            const { data, error } = await supabaseClient
                .from('beat_drafts')
                .insert(draftData)
                .select()
                .single();
            if (error) throw error;
            currentDraftId = data.id;
        }

        localStorage.setItem('offszn_has_draft', 'true');

    } catch (e) {
        if (!e.message?.includes('duplicate')) {
            console.error('Error saving draft:', e);
            throw e; // ðŸ”¥ RETHROW TO NOTIFY USER
        }
    } finally {
        isSaving = false;
    }
}
// ========================================
// SANITIZAR NOMBRES DE ARCHIVOS
// ========================================
function sanitizeFileName(fileName) {
    const lastDotIndex = fileName.lastIndexOf('.');

    // ðŸ”¥ Permitir archivos sin extensión
    const name = lastDotIndex !== -1 && lastDotIndex !== 0
        ? fileName.substring(0, lastDotIndex)
        : fileName;
    const ext = lastDotIndex !== -1 && lastDotIndex !== 0
        ? fileName.substring(lastDotIndex)
        : '';

    // Limpiar nombre
    const cleanName = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .replace(/[^\w\s-]/g, '') // Solo letras, números, espacios, guiones
        .replace(/\s+/g, '_') // Espacios â†’ underscores
        .replace(/-+/g, '-') // Múltiples guiones â†’ uno solo
        .replace(/_+/g, '_') // Múltiples underscores â†’ uno solo
        .substring(0, 100); // Máximo 100 caracteres

    // Si después de limpiar queda vacío, usar timestamp
    if (!cleanName || cleanName.length === 0) {
        return `file_${Date.now()}${ext}`;
    }

    return cleanName + ext;
}
// ========================================
// ?? CLOUDFLARE R2 UPLOAD HELPER
// ========================================
async function uploadToR2(file, folder = 'uploads') {
    try {
        // 1. Obtener URL firmada del backend
        const session = await supabaseClient.auth.getSession();
        const token = session.data.session?.access_token;

        if (!token) throw new Error('No hay sesión activa para subir a R2');

        console.log('ðŸš€ [Client] Subiendo a R2. Token presente:', !!token, 'Token length:', token ? token.length : 0);

        const response = await fetch('/api/r2/upload-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                fileName: file.name,
                fileType: file.type || 'application/octet-stream', // ?? Fallback for unknown types (e.g. .zip on Windows)
                folder: folder,
                fileSize: file.size
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al obtener URL de R2');
        }

        const { uploadUrl, key, r2_version, publicUrl } = await response.json();

        console.log(`? [R2 Debug] Uploading ${file.name}`);
        console.log(`? [R2 Debug] File Type (Browser): "${file.type}"`);
        console.log(`? [R2 Debug] Headers Sent:`, { 'Content-Type': file.type || 'application/octet-stream' });
        console.log(`? [R2 Debug] Upload URL (Truncated):`, uploadUrl.substring(0, 50) + '...');

        // 2. Subir directamente a R2
        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type || 'application/octet-stream' // ðŸ”¥ FIX: Match signed content type
            }
        });

        if (!uploadRes.ok) throw new Error('La subida directa a R2 falló');

        console.log(`? [R2] Archivo subido con éxito: ${key}`);
        return { key, r2_version, publicUrl }; // Retornamos objeto completo
    } catch (error) {
        console.error('Error en uploadToR2:', error);
        throw error;
    }
}
window.uploadToR2 = uploadToR2; // ðŸ”¥ EXPOSE GLOBALLY

/**
 * ?? Obtiene una URL autorizada (Firmada) si es un Key de R2, 
 * o devuelve la URL tal cual si ya es un Link de Supabase.
 */
async function getAuthorizedUrl(pathOrUrl, version = 'v1') {
    if (!pathOrUrl) return null;

    // ðŸ”¥ FIX: Si es una URL de R2 (cloudflarestorage), necesitamos firmarla sí o sí.
    // Si es Supabase (http...) y público, lo dejamos pasar.
    // Si es un KEY (no http), lo firmamos.
    const isR2Url = pathOrUrl.includes('r2.cloudflarestorage.com') ||
        pathOrUrl.includes('pub-') ||
        (pathOrUrl.startsWith('http') === false); // Es un Key

    if (!isR2Url && pathOrUrl.startsWith('http')) return pathOrUrl; // Es Supabase o externo público

    // Si es R2 URL completa, extraemos el KEY
    let key = pathOrUrl;
    if (pathOrUrl.startsWith('http')) {
        // ?? FIX: No usar new URL().pathname porque corta en '#' o '?'
        // Buscamos la base del bucket de R2
        const r2Base = '.r2.cloudflarestorage.com/';
        if (pathOrUrl.includes(r2Base)) {
            key = pathOrUrl.split(r2Base)[1];
        } else {
            // Fallback para otros dominios (ej. pub-...)
            try {
                const urlObj = new URL(pathOrUrl);
                key = urlObj.pathname.substring(1);
            } catch (e) { }
        }
    }

    try {
        const session = await supabaseClient.auth.getSession();
        const token = session.data.session?.access_token;

        // 🔥 FIX: Pass version to the server so it uses the correct R2 bucket
        const response = await fetch('/api/r2/download-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ key, version })
        });

        if (!response.ok) {
            // 🔥 FALLBACK: If v1 failed, try v2 and vice versa
            const fallbackVersion = version === 'v1' ? 'v2' : 'v1';
            console.warn(`[getAuthorizedUrl] ${version} failed for key "${key}", trying ${fallbackVersion}...`);
            const fallbackResponse = await fetch('/api/r2/download-url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ key, version: fallbackVersion })
            });
            if (!fallbackResponse.ok) return null;
            const fallbackData = await fallbackResponse.json();
            return fallbackData.downloadUrl;
        }

        const { downloadUrl } = await response.json();
        return downloadUrl;
    } catch (error) {
        console.error('Error getting authorized URL:', error);
        return null;
    }
}

async function handleUpdateProduct() {
    if (window.isPublishing) return;
    window.isPublishing = true;

    const btn = document.getElementById('publishNow');
    const originalText = btn ? btn.innerHTML : 'Guardar Cambios';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Guardando...';
    }

    try {
        showLoading('GUARDANDO CAMBIOS...', 'Actualizando archivos y metadatos...');

        let updates = {
            name: document.getElementById('titleInput').value,
            description: (document.getElementById('descInput') || document.getElementById('descriptionInput'))?.value || '',
            release_date: document.getElementById('dateInput').value,
            visibility: document.getElementById('visibilityInput').value,
            bpm: document.getElementById('bpmInput')?.value || null,
            key: document.getElementById('keyInput')?.value || null,
            price_basic: document.getElementById('price-basic')?.value || null,
            price_premium: document.getElementById('price-premium')?.value || null,
            price_stems: document.getElementById('price-trackout')?.value || null,
            price_exclusive: document.getElementById('price-unlimited')?.value || null,
            tags: tags,
            collaborators: collaborators
        };

        // 🔥 HANDLE R2 VERSIONING FOR UPDATES
        // If the product was v1, and we upload NEW files, we'll mark it as v2
        let final_r2_version = window.originalProductData?.r2_version || 'v1';

        // Upload files if they were changed
        if (formData.coverBlob) {
            const coverFile = new File([formData.coverBlob], 'cover.jpg', { type: 'image/jpeg' });
            const uploadResult = await uploadToR2(coverFile, 'products/covers');
            updates.image_url = uploadResult.publicUrl;
            final_r2_version = 'v2'; // New uploads go to v2
        }

        if (formData.files.mp3_tagged) {
            const key = await uploadToR2(formData.files.mp3_tagged, 'beats/mp3');
            updates.audio_url = `https://offszn-storage.41d0f49121d02c88f71fdb4da54a791d.r2.cloudflarestorage.com/${key}`;
            updates.mp3_url = updates.audio_url;
            final_r2_version = 'v2';
        }

        if (formData.files.wav_untagged) {
            const key = await uploadToR2(formData.files.wav_untagged, 'secure-products/beats/wav');
            updates.wav_url = key;
            final_r2_version = 'v2';
        }

        if (formData.files.stems) {
            const key = await uploadToR2(formData.files.stems, 'secure-products/beats/stems');
            updates.stems_url = key;
            final_r2_version = 'v2';
        }

        // Apply the version update if any file was uploaded
        updates.r2_version = final_r2_version;

        const { error: updateError } = await supabaseClient
            .from('products')
            .update(updates)
            .eq('id', window.currentEditId);

        if (updateError) throw updateError;

        // Sync collaborators logic (simplified or reuse if possible)
        // ... (Original collab sync logic if needed) ...

        showToast('Cambios guardados correctamente', 'success');
        isDirty = false;
        setTimeout(() => {
            window.location.href = '/cuenta/mis-kits.html';
        }, 1500);

    } catch (error) {
        console.error('Error updating product:', error);
        showToast('Error al guardar cambios: ' + error.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    } finally {
        window.isPublishing = false;
        hideLoading();
    }
}

async function handlePublish() {
    let r2_version_val = 'v1';
    console.log('🚀 [PUBLISH] Starting Publish Flow...');

    // 🔥 GUARD: Prevent Publish if No User ID (Fixes producer_id: null bug)
    if (!userId) {
        console.error('🛑 Blocked Publish: userId is null. Attempting re-fetch...');
        await checkAuth(); // Try to recover
        if (!userId) {
            showToast('Error Crítico: No se detectó la sesión de usuario. Por favor recarga la página.', 'error');
            return;
        }
    }

    // 🔥 WAIT FOR PENDING SAVES (Fixes Race Condition with Blur/AutoSave)
    if (typeof isSaving !== 'undefined' && isSaving) {
        console.warn('⏳ [PUBLISH] Waiting for pending save to complete...');
        let retries = 0;
        while (isSaving && retries < 50) { // Max 5s wait
            await new Promise(r => setTimeout(r, 100));
            retries++;
        }
        console.log('✅ [PUBLISH] Save finished. Proceeding...');
    }

    // 🔥 PREVENIR DOBLE SUBMISSION
    if (window.isPublishing) return;
    window.isPublishing = true;

    // 🔥 YOUTUBE UPLOAD INTERCEPTION
    if (window.isYouTubeUpload && window.YouTubeUploader) {
        const btn = document.getElementById('publishNow');
        const originalText = btn ? btn.innerHTML : 'Publicar Ahora';
        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = 'Subiendo a YouTube...';
            }

            // 1. Upload to YouTube
            // 🔥 DYNAMIC DESCRIPTION TEMPLATE
            const beatTitle = document.getElementById('titleInput').value || 'Sin Título';
            let slugBase = beatTitle;
            if (window.currentUserNickname) {
                slugBase = `${window.currentUserNickname}-${slugBase}`;
            }
            const beatSlug = typeof generatePublicSlug === 'function'
                ? generatePublicSlug(slugBase)
                : slugBase.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '').replace(/-+/g, '-');
            const beatLink = `https://offszn.lat/beat/${beatSlug}`;
            const beatKey = document.querySelector('#keyInput')?.value || 'N/A';
            const beatBpm = document.getElementById('bpmInput')?.value || 'N/A';
            const userDesc = document.getElementById('descInput').value || '';
            const tagList = tags.map(t => `#${t.replace(/\s+/g, '')}`).join(' ');

            const finalDescription = `🛒Comprar/Descargar: ${beatLink}\nKey: ${beatKey}\nBPM: ${beatBpm}\n\n${userDesc}\n\n${tagList}`;

            const ytMetadata = {
                title: beatTitle,
                description: finalDescription,
                tags: tags
            };

            console.log('📹 [PUBLISH] Uploading to YouTube...', ytMetadata);

            // This throws if video is not generated yet or auth fails
            await window.YouTubeUploader.handleUpload(ytMetadata);

            showToast('Video subido a YouTube correctamente 📹', 'success');

            // 2. Continue to normal OFFSZN upload
            if (btn) btn.innerHTML = 'Subiendo a OFFSZN...';

        } catch (error) {
            console.error('YouTube Upload Error:', error);
            showToast(error.message || 'Error al subir a YouTube', 'error');
            window.isPublishing = false;

            const overlay = document.getElementById('publishOverlay');
            if (overlay) {
                const title = document.getElementById('publishOverlayTitle');
                const text = document.getElementById('publishOverlayText');
                if (title) title.innerText = 'ERROR EN YOUTUBE';
                if (text) text.innerHTML = `<span style="color:#ef4444;">${error.message || 'Error desconocido'}</span>`;

                // Show retry button
                const retryBtn = document.getElementById('publishRetryBtn');
                if (retryBtn) retryBtn.style.display = 'block';
            }

            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
            return; // Stop execution
        }
    }

    const btn = document.getElementById('publishNow');
    const originalBtnText = btn ? btn.innerHTML : 'Publicar Ahora';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Procesando...';
    }

    let shouldHideOverlay = true; // Default to hiding unless success redirect

    // 🔥 COOLDOWN: Prevenir spam (30 segundos)
    const lastPublish = localStorage.getItem('lastPublishTime');
    if (lastPublish) {
        const diff = Date.now() - parseInt(lastPublish);
        const COOLDOWN_TIME = 30 * 1000; // 30 segundos

        if (diff < COOLDOWN_TIME) {
            const remaining = Math.ceil((COOLDOWN_TIME - diff) / 1000);
            console.warn(`⏳ [PUBLISH] Cooldown active. Wait ${remaining}s`);
            showToast(`Espera ${remaining}s para publicar otro kit`, 'info'); // Changed to info/secondary

            window.isPublishing = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnText;
            }
            return;
        }
    }

    // 🔥 Force current date on publish
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    document.getElementById('dateInput').value = `${year}-${month}-${day}`;

    // Validar todos los steps
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
        console.warn('⚠️ [PUBLISH] Validation failed.');
        showToast('Completa todos los campos correctamente', 'error');
        return;
    }

    // VALIDAR PRECIO Y LICENCIAS
    const enabledLicenses = Object.values(licensesState).filter(l => l.enabled);
    if (enabledLicenses.length === 0) {
        showToast('Debes habilitar al menos una licencia', 'error');
        currentStep = 2; // Go to licenses
        updateStepUI();
        return;
    }

    // Validar archivos requeridos para licencias activas
    for (const l of enabledLicenses) {
        // 🔥 FIX: Safety check for requiredFile (Check both uploaded AND new files)
        if (l.requiredFile && l.requiredFile.includes('wav') && !filesUploaded.wav_untagged && !formData.files.wav_untagged) {
            showToast('Licencia WAV activa: Falta subir el archivo WAV Untagged', 'error');
            window.isPublishing = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnText;
            }
            return;
        }
        if (l.requiredFile && l.requiredFile.includes('zip') && !filesUploaded.stems && !formData.files.stems) {
            showToast('Licencia Stems activa: Falta subir el archivo de Stems', 'error');
            window.isPublishing = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnText;
            }
            return;
        }
    }

    // 🔥 NUEVA VALIDACIÓN: Verificar que archivos estén subidos o en proceso
    if (!filesUploaded.mp3_tagged && !formData.files.mp3_tagged) {
        showToast('Falta subir el MP3 Tagged (Preview)', 'error');
        window.isPublishing = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnText;
        }
        return;
    }


    // Text update if validation passed
    if (btn) btn.innerHTML = 'Publicando...';

    // 🔥 SHOW OVERLAY
    const overlay = document.getElementById('publishOverlay');
    if (overlay) {
        const title = document.getElementById('publishOverlayTitle');
        if (title) title.innerText = 'PUBLICANDO ARCHIVO...';
        overlay.style.display = 'flex';
    }

    try {
        // 🔧 FUNCIÓN PARA SANITIZAR NOMBRES DE ARCHIVOS
        function sanitizeFileName(fileName) {
            // Obtener extensión
            const lastDotIndex = fileName.lastIndexOf('.');
            const name = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
            const ext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';

            // Limpiar nombre: solo letras, números, guiones y guiones bajos
            const cleanName = name
                .normalize('NFD') // Normalizar caracteres especiales
                .replace(/[\u0300-\u036f]/g, '') // Remover acentos
                .replace(/[^\w\s-]/g, '') // Remover caracteres especiales
                .replace(/\s+/g, '_') // Espacios → guiones bajos
                .replace(/-+/g, '-') // Múltiples guiones → uno solo
                .replace(/_+/g, '_') // Múltiples underscores → uno solo
                .substring(0, 100); // Máximo 100 caracteres

            return cleanName + ext;
        }

        let image_url = null;
        let r2_version = 'v1'; // Default

        if (formData.coverBlob) {
            console.log('📂 [PUBLISH-UPLOAD] Subiendo Cover a R2 (products/covers)...');
            const coverFile = new File([formData.coverBlob], 'cover.jpg', { type: 'image/jpeg' });
            const uploadResult = await uploadToR2(coverFile, 'products/covers');
            image_url = uploadResult.publicUrl;
        }

        // 2. Upload NEW Files to R2 if exist

        // MP3 Tagged
        if (formData.files.mp3_tagged) {
            console.log(`?? [EDIT] Subiendo nuevo MP3 Tagged a R2...`);

            // ?? CLEANUP OLD MP3
            if (window.originalProductData && (window.originalProductData.mp3_url || window.originalProductData.audio_url)) {
                console.log('?? [CLEANUP] Eliminando MP3 anterior...');
                const oldUrl = window.originalProductData.mp3_url || window.originalProductData.audio_url;
                await deleteFileFromStorage(oldUrl, 'beats');
            }

            const key = await uploadToR2(formData.files.mp3_tagged, 'beats/mp3');
            updates.mp3_url = `https://offszn-storage.41d0f49121d02c88f71fdb4da54a791d.r2.cloudflarestorage.com/${key}`;
            updates.audio_url = updates.mp3_url;
        }

        // WAV Untagged
        if (formData.files.wav_untagged) {
            console.log(`?? [EDIT] Subiendo nuevo WAV a R2 (Secure)...`);

            // ?? CLEANUP OLD WAV
            if (window.originalProductData && window.originalProductData.wav_url) {
                console.log('?? [CLEANUP] Eliminando WAV anterior...');
                await deleteFileFromStorage(window.originalProductData.wav_url, 'secure-beats');
            }

            const key = await uploadToR2(formData.files.wav_untagged, 'secure-products/beats/wav');
            updates.wav_url = key; // Store Key
        }

        // Stems
        if (formData.files.stems) {
            console.log(`?? [EDIT] Subiendo nuevos Stems a R2 (Secure)...`);

            // ?? CLEANUP OLD STEMS
            if (window.originalProductData && window.originalProductData.stems_url) {
                console.log('?? [CLEANUP] Eliminando Stems anteriores...');
                await deleteFileFromStorage(window.originalProductData.stems_url, 'secure-beats');
            }

            const key = await uploadToR2(formData.files.stems, 'secure-products/beats/stems');
            updates.stems_url = key; // Store Key
        }

        // 4. Update Database
        const { error: updateError } = await supabaseClient
            .from('products')
            .update(updates)
            .eq('id', window.currentEditId);

        if (updateError) throw updateError;

        // ?? LOGICA COLABORADORES (SYNC: ADD & REMOVE)
        try {
            const originalCollabs = window.originalProductData?.collaborators || [];

            // 1. Detectar Nuevos (Logic Refined: Check DB to avoid duplicates)
            const potentialNewCollabs = collaborators.filter(c => !originalCollabs.some(oc => oc.id === c.id));

            if (potentialNewCollabs.length > 0) {
                console.log('?? Verificando duplicados para:', potentialNewCollabs);

                const newCollabsToInvite = [];

                for (const col of potentialNewCollabs) {
                    // Double check against DB to ensure we don't spam
                    const { data: existing } = await supabaseClient
                        .from('collab_invitations')
                        .select('id')
                        .eq('product_id', window.currentEditId)
                        .eq('collaborator_id', col.id)
                        .maybeSingle();

                    if (!existing) {
                        newCollabsToInvite.push(col);
                    }
                }

                if (newCollabsToInvite.length > 0) {
                    console.log('?? Invitando REALMENTE a:', newCollabsToInvite);

                    // Invitations
                    const invitations = newCollabsToInvite.map(c => ({
                        product_id: window.currentEditId,
                        inviter_id: userId,
                        collaborator_id: c.id,
                        role: c.role || 'Productor',
                        royalty_percent: parseInt(c.percent) || 0,
                        status: 'pending'
                    }));

                    await supabaseClient.from('collab_invitations').insert(invitations);

                    // Notifications
                    const notifications = newCollabsToInvite.map(c => ({
                        user_id: c.id,
                        type: 'collab_invitation',
                        title: '¡Nueva Invitación de Colaboración!',
                        message: `Has sido invitado a colaborar en "${document.getElementById('titleInput').value}".`,
                        data: { product_id: window.currentEditId, author_id: userId }
                    }));

                    await supabaseClient.from('notifications').insert(notifications);
                }
            }

            // 2. Detectar Eliminados (Removed from list)
            const removedCollabs = originalCollabs.filter(oc => !collaborators.some(c => c.id === oc.id));
            if (removedCollabs.length > 0) {
                const removedIds = removedCollabs.map(c => c.id);
                console.log('??? Eliminando colaboradores de la BD:', removedIds);

                // Delete invitations (Hard Delete)
                await supabaseClient
                    .from('collab_invitations')
                    .delete()
                    .eq('product_id', window.currentEditId)
                    .in('collaborator_id', removedIds);
            }

        } catch (e) { console.warn('Error sync colaboradores:', e); }

        // 4.5 ?? CLEANUP DRAFT (Prevent Ghost Drafts)
        if (currentDraftId) {
            await supabaseClient
                .from('beat_drafts')
                .delete()
                .eq('id', currentDraftId);
        }

        // ? Success: Redirect immediately (Overlay remains visible until unload)
        isDirty = false; // ?? Prevent "Unsaved Changes" Warning
        window.location.href = '/cuenta/mis-kits.html';

    } catch (error) {
        console.error('Error updating:', error);

        // ? Error: Hide overlay and show message
        const overlay = document.getElementById('publishOverlay');
        if (overlay) overlay.style.display = 'none';

        showToast('Error al actualizar: ' + error.message, 'error');
    } finally {
        window.isPublishing = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}
// 🔥 CUSTOM VISIBILITY SELECT LOGIC
function initCustomVisibilitySelect() {
    const hiddenSelect = document.getElementById('visibilityInput');
    const customList = document.getElementById('visibilityOptionsList');
    if (!hiddenSelect || !customList) return;

    customList.innerHTML = Array.from(hiddenSelect.options).map(opt => `
                <div class="custom-option" 
                    onclick="window.selectCustomVisibility('${opt.value}')" 
                    style="padding: 10px 14px; cursor: pointer; color: #ccc; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s; font-size: 14px;">
                    ${opt.text}
                </div>
            `).join('');

    // Hover styles
    customList.querySelectorAll('.custom-option').forEach(el => {
        el.onmouseenter = () => { el.style.background = 'rgba(255,255,255,0.05)'; el.style.color = '#fff'; };
        el.onmouseleave = () => { el.style.background = 'transparent'; el.style.color = '#ccc'; };
    });

    // Set initial state
    const initialValue = hiddenSelect.value || 'public';
    window.selectCustomVisibility(initialValue);
}

window.toggleVisibilityDropdown = function (e) {
    if (e) e.stopPropagation();
    const list = document.getElementById('visibilityOptionsList');
    const chevron = document.getElementById('visibilityChevron');
    if (!list) return;

    const isVisible = list.style.display === 'block';
    list.style.display = isVisible ? 'none' : 'block';
    if (chevron) {
        chevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
        chevron.style.color = isVisible ? '#666' : 'var(--primary-color)';
    }

    // Close other dropdowns if any
    const publishDropdown = document.getElementById('publishDropdownContent');
    if (publishDropdown) publishDropdown.style.display = 'none';
};

window.selectCustomVisibility = function (value) {
    const hiddenSelect = document.getElementById('visibilityInput');
    const display = document.getElementById('visibilityDisplay');
    const list = document.getElementById('visibilityOptionsList');
    const chevron = document.getElementById('visibilityChevron');

    if (hiddenSelect) {
        hiddenSelect.value = value;
        hiddenSelect.dispatchEvent(new Event('change'));
    }

    if (display) {
        const option = hiddenSelect.querySelector(`option[value="${value}"]`);
        display.textContent = option ? option.textContent : value;
        display.style.color = '#fff';
    }

    if (list) list.style.display = 'none';
    if (chevron) {
        chevron.style.transform = 'rotate(0deg)';
        chevron.style.color = '#666';
    }
};

// Close dropdown on click outside
document.addEventListener('click', () => {
    const list = document.getElementById('visibilityOptionsList');
    const chevron = document.getElementById('visibilityChevron');
    if (list && list.style.display === 'block') {
        list.style.display = 'none';
        if (chevron) {
            chevron.style.transform = 'rotate(0deg)';
            chevron.style.color = '#666';
        }
    }
});

// ?? ROBUST DATE VALIDATION
function validateReleaseDate() {
    const dateInput = document.getElementById('dateInput');
    const dateError = document.getElementById('dateError'); // Assuming strict error id

    if (!dateInput || !dateInput.value) return false;

    // 1. Get Selected Date String (already YYYY-MM-DD)
    const selectedDateStr = dateInput.value;

    // 2. Get Local "Today" String
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // Check if editing existing date
    // Note: In Beats.html we might not have set dataset.originalDate, 
    // but we can rely on standard validation. If it's the SAME value as loaded, it should be valid.
    // But simplify: Today OR Future is valid. Past is invalid (Unless Editing).

    // ðŸ”¥ EDIT MODE EXCEPTION
    if (window.currentEditId) {
        if (dateError) dateError.style.display = 'none';
        dateInput.classList.remove('error');
        return true;
    }

    if (selectedDateStr < todayStr) {
        if (dateError) {
            dateError.innerText = "La fecha de lanzamiento no puede ser en el pasado";
            dateError.style.display = 'block';
        }
        dateInput.classList.add('error');
        return false;
    } else {
        if (dateError) dateError.style.display = 'none';
        dateInput.classList.remove('error');
        return true;
    }
}

// ðŸ”¥ LOADING HELPERS
function showLoading(msg = 'CARGANDO...') {
    const overlay = document.getElementById('publishOverlay');
    if (overlay) {
        const title = document.getElementById('publishOverlayTitle');
        if (title) title.innerText = msg;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('publishOverlay');
    if (overlay) overlay.style.display = 'none';
}

// ========================================
// ðŸ”¥ QUICK SAVE (HEADER BUTTON)
// ========================================
window.quickSave = async function () {
    try {
        if (typeof saveDraftManual === 'function') {
            await saveDraftManual();
        } else {
            console.error("saveDraftManual function missing");
            throw new Error("Save function missing");
        }

        isDirty = false;
        // showToast('Borrador guardado correctamente', 'success'); // ðŸ”¥ REMOVED TOAST PER USER REQUEST

        setTimeout(() => {
            window.location.href = '/cuenta/mis-kits.html';
        }, 1000);

    } catch (error) {
        console.error('Error saving draft:', error);
        showToast('Error al guardar borrador', 'error');
        hideLoading();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initAll();
    initCustomVisibilitySelect();
});

// ========================================
// RETRY PUBLISH HELPERS
// ========================================
window.retryPublish = function () {
    const retryBtn = document.getElementById('publishRetryBtn');
    if (retryBtn) retryBtn.style.display = 'none';

    // Reset progress bar
    const bar = document.getElementById('publishProgressBar');
    if (bar) bar.style.width = '0%';

    // Clear text
    const text = document.getElementById('publishOverlayText');
    if (text) text.innerText = 'Reintentando publicación...';

    // Allow publishing again
    window.isPublishing = false;

    // Trigger handlePublish
    if (typeof handlePublish === 'function') {
        handlePublish();
    }
}

// ?? YOUTUBE UPLOAD MODE LOGIC
// ========================================
window.isYouTubeUpload = false;

function enableYouTubeUploadMode() {
    window.isYouTubeUpload = true;
    console.log('📹 YouTube Upload Mode ENABLED');

    // 🛑 GUARD: Prevent starting if no user
    if (!userId) {
        showToast('Error: No se ha detectado el usuario. Recarga la página.', 'error');
        console.error('🛑 Blocked YouTube Upload: userId is null');
        return;
    }

    // Show toast
    showToast('Modo YouTube Activado', 'info');

    // Initialize Uploader (Loads GAPI if needed)
    if (window.YouTubeUploader) {
        window.YouTubeUploader.init();
    }

    // Show Form
    showMainUploadForm();
}

// 🔥 GOOGLE AUTH HELPERS (Used by YouTubeUploader v2)
function gisLoaded() {
    console.log('✅ GIS Loaded');
    const CLIENT_ID = '804444303530-bl8gtp4sdjkcnrkjl1295vns59tqp4tc.apps.googleusercontent.com';
    const SCOPES = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';

    window._googleTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
            // This is a proxy, actual logic is handled per-request in YouTubeUploader.requestAuth
            if (window._googleAuthCallback) window._googleAuthCallback(resp);
        },
        error_callback: (err) => {
            console.error('🛑 GIS Error:', err);
            // Silently reset state if user cancels popup or denies access
            if (err.type === 'popup_closed' || err.type === 'access_denied') {
                window.isPublishing = false;
                const btn = document.getElementById('publishNow');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = btn.dataset.originalText || 'Publicar Ahora';
                }
                hideLoading();
            }
        }
    });
    window._gisInited = true;
}

function gapiLoaded() {
    gapi.load('client', async () => {
        await gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest']
        });
        window._gapiInited = true;
        console.log('✅ GAPI Loaded');
    });
}

window._googleRequestAuth = function (callback) {
    window._googleAuthCallback = callback;
    if (window._googleTokenClient) {
        window._googleTokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        showToast('Google API no está lista. Por favor espera o recarga.', 'error');
    }
};


