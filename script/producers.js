/**
 * PRODUCERS PAGE LOGIC - OFFSZN - REFINED v2
 * Handles fetching, filtering, and rendering of producers with advanced filters and pagination.
 */

document.addEventListener('DOMContentLoaded', () => {
    initProducersPage();
});

let currentFilters = {
    sort: 'trending',
    search: '',
    role: '',
    page: 1,
    limit: 50 // Match user request for 50 skeleton cards
};

let paginationData = {
    totalPages: 1,
    totalCount: 0
};

let abortController = null; // To cancel stale requests during "rapidismo" clicking

let topProducersList = []; // Official Top 1-10 from leaderboard

// Exclusion List: Test accounts and specific users to move to the end
const EXCLUDED_PRODUCERS = [
    'd8eafb25-0a6d-48fd-8a7f-3e79a328dfb8', // user2pr25
    '38c4925a-5a0b-4905-a1a3-8f7ecc939394', // testeo2
    '4afe9d29-1b86-4af4-83fa-a78e87448555', // testeo3
    'ff68a2fd-49cb-41e6-b207-492ac683eea6', // testeo5
    '0382a813-85c7-46c3-8d2c-61a5692adffd'  // WillieInspired (Admin)
];

// Long-press support variables
let adjustInterval = null;
let adjustTimeout = null;

// Wizard State & Global Functions
let currentStep = 1;
let maquetaUrl = null;
let maquetaVersion = null;
let selectedMaquetaFile = null;

function adjustValue(id, delta) {
    const input = document.getElementById(id);
    if (!input) return;
    let val = parseInt(input.value) || 0;

    // Limits
    let max = 1000000;

    if (id === 'solicitarBpm') {
        max = 250;
        val = Math.max(0, Math.min(max, val + delta));
    } else if (id === 'solicitarBudget') {
        max = 1000;
        val = Math.max(0, Math.min(max, val + delta));
    } else {
        val = Math.max(0, val + delta);
    }

    input.value = val;
    // Trigger input event to update any dependencies
    input.dispatchEvent(new Event('input'));
}

window.startAdjust = function (id, delta) {
    // Initial click
    adjustValue(id, delta);

    // Clear any existing
    stopAdjust();

    // Wait a bit before starting continuous adjustment
    adjustTimeout = setTimeout(() => {
        adjustInterval = setInterval(() => {
            adjustValue(id, delta);
        }, 80); // Speed of increment/decrement
    }, 400); // Wait 400ms before repeat
};

window.stopAdjust = function () {
    if (adjustTimeout) clearTimeout(adjustTimeout);
    if (adjustInterval) clearInterval(adjustInterval);
    adjustTimeout = null;
    adjustInterval = null;
};

window.adjustValue = adjustValue;

function resetWizard() {
    const solicitarForm = document.getElementById('solicitarForm');
    const step1 = document.getElementById('solicitarStep1');
    const step2 = document.getElementById('solicitarStep2');
    const charCountDisplay = document.getElementById('charCount');
    const fileNameSpan = document.getElementById('maquetaFileName');
    const progressBar = document.getElementById('maquetaProgressBar');
    const progressContainer = document.getElementById('maquetaUploadProgress');
    const maquetaContainer = document.getElementById('maquetaUploadContainer');
    const step3 = document.getElementById('solicitarStep3');

    currentStep = 1;
    // updateWizardUI(); 
    maquetaUrl = null;
    maquetaVersion = null;
    selectedMaquetaFile = null;

    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
    if (step3) step3.style.display = 'none';

    // Reset form fields
    if (solicitarForm) solicitarForm.reset();

    // Explicitly reset selects if needed
    const noteSelect = document.getElementById('solicitarKeyNote');
    const scaleSelect = document.getElementById('solicitarKeyScale');
    if (noteSelect) noteSelect.value = 'C';
    if (scaleSelect) scaleSelect.value = 'Menor';

    // Reset inputs to 0
    const bpmInput = document.getElementById('solicitarBpm');
    const budgetInput = document.getElementById('solicitarBudget');
    if (bpmInput) bpmInput.value = '0';
    if (budgetInput) budgetInput.value = '0';

    // Reset upload UI
    if (fileNameSpan) {
        fileNameSpan.innerHTML = 'Haz click o arrastra tu idea<br><span style="font-size: 0.85rem; color: #666; font-weight: 500;">MP3, 50 segundos máximo (máx. 10MB)</span>';
        fileNameSpan.style.color = '#666';
    }
    const maquetaError = document.getElementById('maquetaGeneralError');
    if (maquetaError) maquetaError.style.display = 'none';
    if (progressBar) progressBar.style.width = '0%';
    if (progressContainer) progressContainer.style.display = 'none';
    if (maquetaContainer) {
        maquetaContainer.classList.remove('upload-success');
        maquetaContainer.style.borderColor = '#222';
    }

    // Reset counter
    if (charCountDisplay) {
        charCountDisplay.textContent = '0/300';
        charCountDisplay.style.color = '#444';
    }

    // Hide error messages
    document.querySelectorAll('#solicitarModal .error-text').forEach(el => el.style.display = 'none');
}

function normalizeKey(val) {
    if (!val) return '';
    let k = val.trim();
    if (k.length === 0) return '';
    k = k.charAt(0).toUpperCase() + k.slice(1);
    k = k.replace(/\s+/g, ' ');
    return k;
}

function showError(id, message) {
    const errorEl = document.getElementById(id);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}

function clearErrors() {
    document.querySelectorAll('#solicitarModal .error-text').forEach(el => el.style.display = 'none');
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function isReferenceLink(url) {
    if (!url) return true; // Optional field
    if (!isValidUrl(url)) return false;
    const lower = url.toLowerCase();
    return lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('spotify.com');
}

function updateWizardUI() {
    const step1 = document.getElementById('solicitarStep1');
    const step2 = document.getElementById('solicitarStep2');

    if (!step1 || !step2) return;

    if (currentStep === 1) {
        step1.style.display = 'block';
        step2.style.display = 'none';
    } else if (currentStep === 2) {
        step1.style.display = 'none';
        step2.style.display = 'block';
    }
}

async function initProducersPage() {
    setupCategoryListeners();
    setupAdvancedFilterListeners();
    setupSearchListeners();
    setupModalListeners();
    setupGlobalHandlers();
    await fetchAndRenderProducers();
}

function setupGlobalHandlers() {
    // Clean handler for avatar errors to avoid SyntaxError in inline HTML
    window.handleProducerAvatarError = function (img, nickname) {
        const container = img.parentElement;
        if (container) {
            let firstChar = nickname.trim().charAt(0).toUpperCase();
            if (!/[A-Z]/.test(firstChar)) firstChar = 'U';
            container.innerHTML = `<div class="avatar-placeholder">${firstChar}</div>`;
        }
    };
}

async function fetchTopProducers() {
    try {
        const response = await fetch('/api/leaderboard');
        if (response.ok) {
            topProducersList = await response.json();
        }
    } catch (error) {
        console.error("Error fetching top producers:", error);
    }
}

function setupCategoryListeners() {
    const categoryTags = document.querySelectorAll('.category-tag');
    categoryTags.forEach(tag => {
        tag.addEventListener('click', async () => {
            categoryTags.forEach(t => t.classList.remove('active'));
            tag.classList.add('active');

            currentFilters.sort = tag.dataset.filter;
            currentFilters.page = 1;
            await fetchAndRenderProducers();
        });
    });
}

function setupAdvancedFilterListeners() {
    const rolesChecklist = document.getElementById('rolesChecklist');
    const checklistItems = rolesChecklist ? rolesChecklist.querySelectorAll('.checklist-item') : null;

    if (checklistItems) {
        checklistItems.forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (!checkbox) return;

            checkbox.addEventListener('change', () => {
                showSkeletons(50, false);
                handleFilterChange();
            });
        });
    }
}

async function handleFilterChange() {
    const selectedRoles = Array.from(document.querySelectorAll('.checklist-item input:checked'))
        .map(cb => cb.value);

    currentFilters.role = selectedRoles.length > 0 ? selectedRoles.join(',') : '';
    currentFilters.page = 1;

    // Update Selected visual state
    document.querySelectorAll('.checklist-item').forEach(item => {
        const cb = item.querySelector('input');
        item.classList.toggle('selected', cb.checked);
    });

    await fetchAndRenderProducers();
}



function setupSearchListeners() {
    const searchInput = document.getElementById('producerSearchInput');
    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            showSkeletons(50, false);
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                currentFilters.search = e.target.value.trim();
                currentFilters.page = 1;
                await fetchAndRenderProducers();
            }, 500);
        });
    }
}

function setupModalListeners() {
    const modal = document.getElementById('solicitarModal');
    const closeBtn = document.getElementById('closeSolicitarModal');
    const solicitarForm = document.getElementById('solicitarForm');
    const submitBtn = document.getElementById('btnSubmitSolicitud');
    const charCountDisplay = document.getElementById('charCount');
    const descriptionTextarea = document.getElementById('solicitarDescription');

    // Initialize Custom Dropdowns
    const noteSelect = document.getElementById('solicitarKeyNote');
    const scaleSelect = document.getElementById('solicitarKeyScale');

    if (noteSelect) {
        initCustomDropdown(
            'solicitarKeyNote',
            'solicitarKeyNoteTrigger',
            'solicitarKeyNoteDisplay',
            'solicitarKeyNoteOptions'
        );
    }
    if (scaleSelect) {
        initCustomDropdown(
            'solicitarKeyScale',
            'solicitarKeyScaleTrigger',
            'solicitarKeyScaleDisplay',
            'solicitarKeyScaleOptions'
        );
    }

    // Wizard Steps & Nav
    const step1 = document.getElementById('solicitarStep1');
    const step2 = document.getElementById('solicitarStep2');
    const btnNext = document.getElementById('btnNextStep');
    const btnPrev = document.getElementById('btnPrevStep');
    const btnCloseSteps = document.querySelectorAll('.btnStepClose');

    if (closeBtn) closeBtn.onclick = () => {
        modal.style.display = 'none';
        resetWizard();
    };

    btnCloseSteps.forEach(btn => {
        btn.onclick = () => {
            modal.style.display = 'none';
            resetWizard();
        };
    });
    // Real-time Validation for BPM and Budget
    const bpmInput = document.getElementById('solicitarBpm');
    const budgetInput = document.getElementById('solicitarBudget');

    if (bpmInput) {
        bpmInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            e.target.value = val;
        });
        bpmInput.addEventListener('blur', (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val)) e.target.value = 0;
            if (val > 250) e.target.value = 250;
        });
    }

    if (budgetInput) {
        budgetInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            e.target.value = val;
        });
        budgetInput.addEventListener('blur', (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val)) e.target.value = 0;
            if (val > 1000) e.target.value = 1000;
        });
    }

    if (btnNext) {
        btnNext.onclick = () => {
            if (currentStep === 1) {
                clearErrors();
                let hasError = false;

                const budget = parseInt(budgetInput.value);
                const bpm = parseInt(bpmInput.value);

                if (isNaN(budget) || budget < 10 || budget > 1000) {
                    showError('solicitarBudgetError', 'El presupuesto debe estar entre $10 y $1000 USD.');
                    hasError = true;
                }

                if (isNaN(bpm) || bpm < 40 || bpm > 250) {
                    showError('solicitarBpmError', 'El BPM debe estar entre 40 y 250.');
                    hasError = true;
                }

                if (hasError) return;

                // Si llegamos aquí, el paso 1 es válido
                currentStep = 2;
                updateWizardUI();
            }
        };
    }

    if (btnPrev) {
        btnPrev.onclick = () => {
            currentStep = 1;
            updateWizardUI();
        };
    }

    // Character Counter
    if (descriptionTextarea && charCountDisplay) {
        descriptionTextarea.addEventListener('input', () => {
            const length = descriptionTextarea.value.length;
            charCountDisplay.textContent = `${length}/300`;
            if (length >= 300) {
                charCountDisplay.style.color = '#ef4444';
            } else {
                charCountDisplay.style.color = '#444';
            }
        });
    }

    // File Upload (Maqueta)
    const fileInput = document.getElementById('solicitarMaquetaFile');
    const maquetaContainer = document.getElementById('maquetaUploadContainer');
    const maquetaName = document.getElementById('maquetaFileName');
    const progressContainer = document.getElementById('maquetaUploadProgress');
    const progressBar = document.getElementById('maquetaProgressBar');

    // Drag & Drop Support
    if (maquetaContainer) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            maquetaContainer.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        maquetaContainer.addEventListener('dragover', () => {
            maquetaContainer.style.borderColor = '#8b5cf6';
            maquetaContainer.style.background = 'rgba(139, 92, 246, 0.05)';
        });

        ['dragleave', 'drop'].forEach(eventName => {
            maquetaContainer.addEventListener(eventName, () => {
                const isSuccess = maquetaContainer.classList.contains('upload-success');
                maquetaContainer.style.borderColor = isSuccess ? '#22c55e' : '#222';
                maquetaContainer.style.background = '#080808';
            });
        });

        maquetaContainer.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                handleMaquetaFileSelection(files[0]);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                handleMaquetaFileSelection(e.target.files[0]);
            }
        });
    }

    function showMaquetaUIError(msg) {
        const errorEl = document.getElementById('maquetaGeneralError');
        const fileNameEl = document.getElementById('maquetaFileName');
        if (errorEl) {
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
        }
        if (fileNameEl) {
            fileNameEl.style.color = '#ef4444';
        }
    }

    async function handleMaquetaFileSelection(file) {
        const maquetaContainer = document.getElementById('maquetaUploadContainer');
        const maquetaName = document.getElementById('maquetaFileName');
        const errorEl = document.getElementById('maquetaGeneralError');
        const fileInput = document.getElementById('solicitarMaquetaFile');

        if (!file) return;

        // Reset state
        if (errorEl) errorEl.style.display = 'none';
        maquetaName.style.color = '#666';
        maquetaContainer.classList.remove('upload-success');
        maquetaContainer.style.borderColor = '#222';
        selectedMaquetaFile = null;
        maquetaUrl = null;

        // Simple validation
        if (!file.type.includes('audio/mpeg') && !file.name.toLowerCase().endsWith('.mp3')) {
            showMaquetaUIError('Por favor sube un archivo MP3 válido.');
            if (fileInput) fileInput.value = '';
            return;
        }

        const MAX_SIZE = 10 * 1024 * 1024; // 10MB 
        if (file.size > MAX_SIZE) {
            showMaquetaUIError('El archivo es demasiado grande (máximo 10MB).');
            if (fileInput) fileInput.value = '';
            return;
        }

        // Check duration (50 seconds max)
        const audio = new Audio();
        const objectUrl = URL.createObjectURL(file);

        audio.onloadedmetadata = function () {
            URL.revokeObjectURL(objectUrl);
            if (audio.duration > 50.5) { // Slight margin
                showMaquetaUIError('El preview debe durar máximo 50 segundos.');
                if (fileInput) fileInput.value = '';
                return;
            }

            // STAGE FILE FOR DEFERRED UPLOAD
            selectedMaquetaFile = file;
            maquetaName.innerHTML = `Archivo Seleccionado:<br><span style="font-size: 0.85rem;">${file.name}</span>`;
            maquetaName.style.color = '#22c55e';
            if (maquetaContainer) {
                maquetaContainer.classList.add('upload-success');
                maquetaContainer.style.borderColor = '#22c55e';
            }
        };

        audio.onerror = function () {
            URL.revokeObjectURL(objectUrl);
            showMaquetaUIError('No se pudo leer el archivo de audio. Verifica que sea un MP3 válido.');
            if (fileInput) fileInput.value = '';
        };

        audio.src = objectUrl;
    }

    async function uploadMaqueta(file) {
        const maquetaName = document.getElementById('maquetaFileName');
        const progressContainer = document.getElementById('maquetaUploadProgress');
        const progressBar = document.getElementById('maquetaProgressBar');
        const maquetaContainer = document.getElementById('maquetaUploadContainer');

        if (!maquetaContainer || !maquetaName) return null;

        maquetaName.textContent = `Subiendo: ${file.name}...`;
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';

        try {
            const token = AuthUtils.getAccessToken();
            // 1. Get signed URL from backend
            const response = await fetch('/api/r2/upload-url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: file.type || 'audio/mpeg',
                    folder: 'temp-previews',
                    fileSize: file.size,
                    version: 'v2'
                })
            });

            if (!response.ok) throw new Error('Error al obtener URL de subida');
            const { uploadUrl, key, r2_version, publicUrl } = await response.json();

            // 2. Upload to R2 directly with progress
            const xhr = new XMLHttpRequest();
            await new Promise((resolve, reject) => {
                xhr.open('PUT', uploadUrl, true);
                xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg');

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percent = (event.loaded / event.total) * 100;
                        progressBar.style.width = `${percent}%`;
                    }
                };

                xhr.onload = () => {
                    if (xhr.status === 200 || xhr.status === 201) resolve();
                    else reject(new Error('Error subiendo a R2'));
                };
                xhr.onerror = () => reject(new Error('Error de red'));
                xhr.send(file);
            });

            maquetaUrl = key; // Keep using key for custom requests (they use backend signing)
            maquetaVersion = r2_version; // We should probably store the version too
            maquetaName.textContent = `Archivo Listo: ${file.name}`;
            return { key, r2_version, publicUrl };
        } catch (err) {
            console.error("Upload error:", err);
            throw err;
        }
    }

    if (solicitarForm) {
        solicitarForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const producerId = document.getElementById('solicitarProducerId').value;
            const description = descriptionTextarea.value.trim();
            const budget = document.getElementById('solicitarBudget').value;
            const bpm = document.getElementById('solicitarBpm')?.value;
            const note = document.getElementById('solicitarKeyNote')?.value || '';
            const scale = document.getElementById('solicitarKeyScale')?.value || '';
            const key = note && scale ? `${note} ${scale}` : (note || scale || '');
            const referenceLink1 = document.getElementById('solicitarReferenceLink1')?.value.trim();
            const referenceLink2 = document.getElementById('solicitarReferenceLink2')?.value.trim();

            const token = AuthUtils.getAccessToken();

            if (!description || !producerId || !token) return;

            // Step 2 Validation
            clearErrors();
            let hasError = false;

            if (description.length < 10) {
                alert("Por favor, describe mejor lo que buscas (mínimo 10 caracteres).");
                hasError = true;
            }

            if (referenceLink1 && !isReferenceLink(referenceLink1)) {
                showError('solicitarReferenceLink1Error', 'Ingresa un enlace válido de YouTube o Spotify.');
                hasError = true;
            }

            if (referenceLink2 && !isReferenceLink(referenceLink2)) {
                showError('solicitarReferenceLink2Error', 'Ingresa un enlace válido de YouTube o Spotify.');
                hasError = true;
            }

            if (hasError) return;

            const originalBtnText = submitBtn.innerHTML;

            try {
                // UPLOAD PHASE (Only if not already uploaded or if changed)
                if (selectedMaquetaFile && !maquetaUrl) {
                    submitBtn.innerHTML = '<i class="bi bi-cloud-arrow-up-fill spin"></i> Subiendo idea...';
                    await uploadMaqueta(selectedMaquetaFile);
                }

                submitBtn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Enviando...';
                submitBtn.disabled = true;

                const response = await fetch('/api/custom-requests', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        producerId,
                        description,
                        budget,
                        bpm,
                        key: key,
                        referenceLink1,
                        referenceLink2,
                        previewUrl: maquetaUrl,
                        r2_version: maquetaVersion,
                        preview_version: maquetaVersion
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    if (data.limitReached) {
                        const errorContainer = document.getElementById('maquetaGeneralError');
                        if (errorContainer) {
                            errorContainer.innerHTML = `<span style="color: #ef4444; font-size: 0.85rem; background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 8px; display: block; margin-top: 15px;">
                                <i class="bi bi-exclamation-circle-fill"></i> Ya enviaste tu solicitud diaria y en 24 horas estarás pudiendo enviar otra bro. <br>
                                <a href="/cuenta/planes" style="color: #fff; text-decoration: underline; font-weight: 700;">¡Pásate a PRO para ilimitadas!</a>
                            </span>`;
                        } else {
                            alert(`Ya enviaste tu solicitud diaria y en 24 horas estarás pudiendo enviar otra bro.`);
                        }
                    } else {
                        throw new Error(data.error || 'Error al enviar la solicitud');
                    }
                } else {
                    // Success logic - Show Step 3
                    const producerName = document.getElementById('solicitarProducerDisplay')?.textContent || 'el productor';
                    const successNameSpan = document.getElementById('successProducerName');
                    if (successNameSpan) successNameSpan.textContent = producerName;

                    const step1 = document.getElementById('solicitarStep1');
                    const step2 = document.getElementById('solicitarStep2');
                    const step3 = document.getElementById('solicitarStep3');

                    if (step1) step1.style.display = 'none';
                    if (step2) step2.style.display = 'none';
                    if (step3) {
                        step3.style.display = 'block';
                        // Add Ver Solicitud listener
                        const btnVerSolicitud = document.getElementById('btnVerSolicitud');
                        if (btnVerSolicitud) {
                            btnVerSolicitud.onclick = () => {
                                window.location.href = '/comunidad/feed';
                            };
                        }
                    }

                    solicitarForm.reset();
                    // Don't fully reset wizard here to keep Step 3 visible
                    if (charCountDisplay) charCountDisplay.textContent = '0/300';
                    maquetaUrl = null;
                    maquetaVersion = null;
                    selectedMaquetaFile = null;
                }
            } catch (error) {
                console.error('Error submitting request:', error);
                alert('❌ Error: ' + error.message);
            } finally {
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }
}

function showSkeletons(count = 50, forceClear = true) {
    const grid = document.getElementById('producers-grid');
    if (!grid) return;

    // IF we aren't forcing a clear and skeletons already exist, just return
    // This prevents the shimmer animation from "restarting" and flickering
    if (!forceClear && grid.querySelector('.skeleton-card')) {
        return;
    }

    grid.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'producer-card skeleton-card';
        skeleton.innerHTML = `
            <div class="card-avatar-container">
                <div class="card-avatar-wrapper">
                    <div class="skeleton-avatar"></div>
                </div>
                <div class="skeleton-line skeleton-name"></div>
                <div class="skeleton-line skeleton-role"></div>
                <div class="skeleton-line skeleton-meta"></div>
            </div>
            <div class="card-actions-grid">
                <div class="skeleton-btn"></div>
                <div class="skeleton-btn"></div>
            </div>
        `;
        grid.appendChild(skeleton);
    }
}

async function fetchAndRenderProducers() {
    const grid = document.getElementById('producers-grid');
    if (!grid) return;

    // Show skeletons immediately before top producers fetch (non-flicker mode)
    showSkeletons(50, false);

    // Load top producers once per session if not loaded
    if (topProducersList.length === 0) {
        await fetchTopProducers();
    }

    // Cancel previous request if any
    if (abortController) {
        abortController.abort();
    }
    abortController = new AbortController();

    try {
        const queryParams = new URLSearchParams({
            sort: currentFilters.sort,
            search: currentFilters.search,
            role: currentFilters.role,
            page: currentFilters.page,
            limit: currentFilters.limit
        });

        const response = await fetch(`/api/producers?${queryParams.toString()}`, {
            signal: abortController.signal
        });
        if (!response.ok) throw new Error('Error fetching creators');

        const data = await response.json();

        paginationData.totalPages = data.totalPages || 1;
        paginationData.totalCount = data.total || 0;

        renderProducers(data.producers);
        renderPagination();

    } catch (error) {
        if (error.name === 'AbortError') return; // Expected when cancelling rapid clicks
        console.error('Fetch error:', error);
        grid.innerHTML = '<div class="error-msg" style="grid-column: 1/-1; text-align: center; padding: 100px; color: #666;">Could not load creators. Please try again later.</div>';
    }
}

function renderProducers(producers) {
    const grid = document.getElementById('producers-grid');
    if (!producers || producers.length === 0) {
        grid.innerHTML = '<div class="empty-msg" style="grid-column: 1/-1; text-align: center; padding: 100px; color: #444;">No creators found.</div>';
        return;
    }

    // Advanced filtering & sorting rules:
    let filteredProducers = [...producers];

    // Inject Top 10 to ensure they are present on page 1 of default views bridging pagination limits
    if ((currentFilters.sort === 'trending' || currentFilters.sort === 'popular') &&
        currentFilters.page === 1 &&
        !currentFilters.search &&
        !currentFilters.role) {

        topProducersList.forEach(topProducer => {
            if (!filteredProducers.find(p => p.id === topProducer.id)) {
                filteredProducers.push(topProducer);
            }
        });
    }

    // NEW: Avoid duplicates on subsequent pages
    // If we are on page > 1, filter out any Top 10 producers 
    // because they were already shown/injected on Page 1.
    if ((currentFilters.sort === 'trending' || currentFilters.sort === 'popular') &&
        currentFilters.page > 1 &&
        !currentFilters.search &&
        !currentFilters.role) {
        
        filteredProducers = filteredProducers.filter(p => !topProducersList.some(top => top.id === p.id));
    }

    // Recientes Rule: Chronological order (Handled by backend optimized query)
    // We removed the .filter(p => p.avatar_url || p.profile_cover) to allow all newest users to show up.

    const sortedProducers = filteredProducers.sort((a, b) => {
        const aExcluded = EXCLUDED_PRODUCERS.includes(a.id);
        const bExcluded = EXCLUDED_PRODUCERS.includes(b.id);

        // Excluded rule: if one is excluded and the other isn't, non-excluded wins
        if (aExcluded && !bExcluded) return 1;
        if (!aExcluded && bExcluded) return -1;
        if (aExcluded && bExcluded) return 0; // Both excluded, don't care about their specific order

        // If we are in Trending or Popular, we MUST respect the Top 10 rank first
        if (currentFilters.sort === 'trending' || currentFilters.sort === 'popular') {
            const aTopInfo = topProducersList.find(t => t.id === a.id);
            const bTopInfo = topProducersList.find(t => t.id === b.id);

            const aRank = aTopInfo ? aTopInfo.rank : 999;
            const bRank = bTopInfo ? bTopInfo.rank : 999;

            if (aRank !== bRank) {
                return aRank - bRank; // Ascending: 1, 2, 3... 999
            }
        }

        // Image rule (for non-excluded, non-ranked ties)
        // EXCEPTION: Disable image-first for A-Z and Recent sorts
        if (currentFilters.sort !== 'a-z' && currentFilters.sort !== 'recent') {
            const aHasImage = a.avatar_url || a.profile_cover;
            const bHasImage = b.avatar_url || b.profile_cover;

            if (aHasImage && !bHasImage) return -1;
            if (!aHasImage && bHasImage) return 1;
        }

        // Final Tie-breaker/Primary sort for A-Z
        if (currentFilters.sort === 'a-z') {
            return (a.nickname || '').localeCompare(b.nickname || '');
        }

        return 0;
    });

    grid.innerHTML = '';

    sortedProducers.forEach((producer, index) => {
        // Calculate rank calculation again strictly for visual badge 
        const topInfo = topProducersList.find(t => t.id === producer.id);
        let rank = topInfo ? topInfo.rank : null;

        // Restriction: Excluded producers can NEVER be in the top
        if (EXCLUDED_PRODUCERS.includes(producer.id)) rank = null;

        // Visibility: Show TOP 1-10 ranks in ANY tab if the rank is valid
        const showRank = rank !== null;

        const card = createProducerCard(producer, showRank ? rank : null);
        grid.appendChild(card);

        gsap.from(card, {
            opacity: 0,
            y: 20,
            duration: 0.5,
            delay: index * 0.03,
            ease: "power2.out"
        });
    });
}

function createProducerCard(producer, rank) {
    const col = document.createElement('div');
    col.className = 'producer-card';

    const nickname = producer.nickname || 'Unknown';
    const hasAvatar = !!producer.avatar_url;

    let avatarHtml;
    // We use a clean function to avoid quote nesting issues in onerror
    const escapedNickname = nickname.replace(/'/g, "\\'");

    if (hasAvatar) {
        let avatarUrl = producer.avatar_url;
        const storageVer = producer.storage_version || producer.r2_version || 'v1';
        
        avatarUrl = window.AuthUtils?.getFormattedSupabaseUrl ? window.AuthUtils.getFormattedSupabaseUrl(avatarUrl) : avatarUrl;

        avatarHtml = `<img crossorigin="anonymous" src="${avatarUrl}" alt="${nickname}" class="card-avatar" onerror="window.handleProducerAvatarError(this, '${escapedNickname}')">`;
    } else {
        avatarHtml = getInitialsHtml(nickname);
    }

    // Rank logic: Only TOP 1 to TOP 10 if rank is provided
    const rankHtml = rank ? `<div class="verified-star"><i class="bi bi-star-fill"></i> TOP ${rank}</div>` : '';

    // Format Role
    let rawRole = (producer.role || 'Productor').split(',')[0].trim(); // Take primary role if multiple
    if (rawRole.toLowerCase() === 'mezcla/master') rawRole = 'Ingeniero';
    if (rawRole.toLowerCase() === 'fan y consumidor') rawRole = 'Oyente';

    // Fallbacks to standard formatting
    const displayRole = rawRole.toUpperCase();

    // Check if viewing own card
    let currentUserId = null;
    const token = window.AuthUtils ? window.AuthUtils.getAccessToken() : null;
    if (token) {
        try {
            currentUserId = JSON.parse(atob(token.split('.')[1])).sub;
        } catch (e) {}
    }
    if (!currentUserId) currentUserId = localStorage.getItem('userId');
    
    const isOwnCard = currentUserId === producer.id;

    const solicitarHtml = isOwnCard
        ? `<button class="btn-card-action btn-solicitar" disabled style="opacity:0.3; cursor:not-allowed;">solicitar</button>`
        : `<button class="btn-card-action btn-solicitar">solicitar</button>`;

    const enviarHtml = isOwnCard
        ? `<button class="btn-card-action btn-enviar" disabled style="opacity:0.3; cursor:not-allowed;">enviar</button>`
        : `<button class="btn-card-action btn-enviar" onclick="window.location.href='/@${nickname}'">enviar</button>`;

    col.innerHTML = `
        <div class="card-avatar-container">
            <div class="card-avatar-wrapper" onclick="window.location.href='/@${nickname}'">
                ${avatarHtml}
                ${rankHtml}
            </div>
            <span class="card-name-centered" onclick="window.location.href='/@${nickname}'">${nickname}</span>
            <div class="card-role-centered" style="font-size: 0.7rem; color: #888; font-weight: 700; letter-spacing: 1px; margin-top: 2px;">${displayRole}</div>
            <div class="card-meta-centered">
                <i class="bi bi-folder"></i>
                <span>${producer.products_count || 0}</span>
            </div>
        </div>
        <div class="card-actions-grid">
            ${solicitarHtml}
            ${enviarHtml}
        </div>
    `;

    const solicitarBtn = col.querySelector('.btn-solicitar');
    if (solicitarBtn && !isOwnCard) {
        solicitarBtn.addEventListener('click', () => {
        const token = AuthUtils.getAccessToken();
        if (!token) {
            window.location.href = '/pages/login.html?redirect=/comunidad/productores';
            return;
        }

        const modal = document.getElementById('solicitarModal');
        if (modal) {
            // First, reset everything
            resetWizard();

            // Set new producer info
            document.getElementById('solicitarProducerId').value = producer.id;
            document.getElementById('solicitarProducerName').value = nickname;
            document.getElementById('solicitarProducerDisplay').textContent = nickname;

            modal.style.display = 'flex';
        }
    });
    }

    return col;
}

function getInitialsHtml(name) {
    let firstChar = name.trim().charAt(0).toUpperCase();
    // Check if character is "weird" (not a letter)
    if (!/[A-Z]/.test(firstChar)) {
        firstChar = 'U';
    }
    return `<div class="avatar-placeholder">${firstChar}</div>`;
}

function renderPagination() {
    const container = document.getElementById('pro-pagination');
    if (!container) return;

    if (paginationData.totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `
        <button class="page-btn ${currentFilters.page === 1 ? 'disabled' : ''}" data-page="${currentFilters.page - 1}">
            <i class="bi bi-chevron-left"></i>
        </button>
    `;

    for (let i = 1; i <= paginationData.totalPages; i++) {
        // Show only a few pages around current if too many
        if (paginationData.totalPages > 7) {
            if (i === 1 || i === paginationData.totalPages || (i >= currentFilters.page - 2 && i <= currentFilters.page + 2)) {
                html += `<button class="page-btn ${currentFilters.page === i ? 'active' : ''}" data-page="${i}">${i}</button>`;
            } else if (i === 2 || i === paginationData.totalPages - 1) {
                html += `<span style="color: #444;">...</span>`;
            } else {
                continue;
            }
        } else {
            html += `<button class="page-btn ${currentFilters.page === i ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
    }

    html += `
        <button class="page-btn ${currentFilters.page === paginationData.totalPages ? 'disabled' : ''}" data-page="${currentFilters.page + 1}">
            <i class="bi bi-chevron-right"></i>
        </button>
    `;

    container.innerHTML = html;

    // Add listeners
    container.querySelectorAll('.page-btn:not(.disabled)').forEach(btn => {
        btn.onclick = async () => {
            currentFilters.page = parseInt(btn.dataset.page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            await fetchAndRenderProducers();
        };
    });
}

/**
 * CUSTOM DROPDOWN LOGIC
 */
window.toggleCustomDropdown = function (event, optionsId) {
    if (event) event.stopPropagation();
    const optionsList = document.getElementById(optionsId);
    if (!optionsList) return;

    const isVisible = optionsList.style.display === 'block';

    // Close others
    document.querySelectorAll('.custom-dropdown-options').forEach(el => {
        el.style.display = 'none';
        const trigger = el.parentElement.querySelector('.custom-dropdown-trigger');
        const chevron = trigger ? trigger.querySelector('.select-chevron') : null;
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    });

    if (!isVisible) {
        optionsList.style.display = 'block';
        const trigger = optionsList.parentElement.querySelector('.custom-dropdown-trigger');
        const chevron = trigger ? trigger.querySelector('.select-chevron') : null;
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    }
};

function initCustomDropdown(selectId, triggerId, displayId, optionsId) {
    const select = document.getElementById(selectId);
    const trigger = document.getElementById(triggerId);
    const display = document.getElementById(displayId);
    const optionsList = document.getElementById(optionsId);

    if (!select || !trigger || !display || !optionsList) return;

    // Clear existing
    optionsList.innerHTML = '';

    // Populate from native select
    Array.from(select.options).forEach(opt => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        if (opt.selected) {
            item.classList.add('selected');
            display.textContent = opt.textContent;
        }
        item.textContent = opt.textContent;
        item.dataset.value = opt.value;

        item.onclick = (e) => {
            e.stopPropagation();
            // Update native select
            select.value = opt.value;
            // Trigger change event if needed
            select.dispatchEvent(new Event('change'));
            
            // Update UI
            display.textContent = opt.textContent;
            optionsList.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');

            // Close
            window.toggleCustomDropdown(null, optionsId);
        };

        optionsList.appendChild(item);
    });
}

// Global click to close dropdowns
document.addEventListener('click', () => {
    document.querySelectorAll('.custom-dropdown-options').forEach(el => {
        if (el.style.display === 'block') {
            el.style.display = 'none';
            const trigger = el.parentElement.querySelector('.custom-dropdown-trigger');
            const chevron = trigger ? trigger.querySelector('.select-chevron') : null;
            if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
    });
});
