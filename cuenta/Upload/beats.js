const SUPABASE_URL = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";

// 'supabase' es el objeto global de la CDN. Llamamos a 'supabase.createClient'
// y lo guardamos en 'supabaseClient' para evitar conflictos.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. CONFIGURACIÓN DE LA API (Backend) ---
let API_URL = '';
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    API_URL = 'http://localhost:3000/api';
} else {
    API_URL = 'https://offszn-academy.onrender.com/api';
}

// ===== ESTADO GLOBAL =====
const STORAGE_KEY = 'offszn_beat_draft';

const state = {
    files: { artwork: null, mp3: null, wav: null, stems: null },
    tags: [],
    genres: [],
    moods: [],
    instruments: [],
    collaborators: [],
    activeLicenses: ['basic', 'premium', 'stems', 'exclusive']
};

// ===== DATOS =====
const KEYS = [
    'C minor', 'C# minor', 'D minor', 'D# minor', 'E minor', 'F minor',
    'F# minor', 'G minor', 'G# minor', 'A minor', 'A# minor', 'B minor',
    'C major', 'C# major', 'D major', 'D# major', 'E major', 'F major',
    'F# major', 'G major', 'G# major', 'A major', 'A# major', 'B major'
];

const GENRES = ['Trap', 'Hip Hop', 'R&B', 'Pop', 'Rock', 'Electronic', 'Lo-Fi', 'Drill', 'Afrobeats', 'Reggaeton', 'Jazz', 'Soul', 'House', 'Techno', 'Ambient', 'Dancehall', 'UK Drill', 'Latin', 'Country', 'Indie'];
const MOODS = ['Agresivo', 'Triste', 'Feliz', 'Romántico', 'Relajado', 'Motivador', 'Misterioso', 'Épico', 'Melancólico', 'Enérgico', 'Oscuro', 'Vibrante', 'Nostálgico', 'Inspirador', 'Intenso'];
const INSTRUMENTS = ['Piano', 'Bajo', 'Batería', 'Sintetizador', 'Guitarra', 'Violín', 'Flauta', 'Coro', 'Pad', 'FX', 'Brass', 'Strings', '808', 'Hi-Hat', 'Saxofón', 'Trompeta', 'Vocales'];

const FILE_LIMITS = {
    artwork: { size: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'], ext: ['jpg', 'jpeg', 'png', 'webp'] },
    mp3: { size: 50 * 1024 * 1024, types: ['audio/mpeg'], ext: ['mp3'] },
    wav: { size: 100 * 1024 * 1024, types: ['audio/wav', 'audio/x-wav'], ext: ['wav'] },
    stems: { size: 200 * 1024 * 1024, types: ['application/zip', 'application/x-rar-compressed', 'application/x-zip-compressed'], ext: ['zip', 'rar'] }
};

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    initDateTime();
    initFileHandlers();
    initKeyAutocomplete();
    initMultiSelects();
    initTagsInput();
    initPriceValidation();
    loadDraft();

    document.getElementById('descInput').addEventListener('input', updateCharCount);
    document.getElementById('titleInput').addEventListener('input', autoParseTitle);
    document.getElementById('uploadForm').addEventListener('submit', handleSubmit);

    document.addEventListener('click', closeAllDropdowns);

    setInterval(() => {
        if (document.getElementById('titleInput').value.trim()) {
            saveDraftAuto();
        }
    }, 30000);

    document.querySelectorAll('.form-input, .form-select').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
            }
        });
    });
});

function initDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const minDateTime = now.toISOString().slice(0, 16);
    document.getElementById('releaseDateInput').min = minDateTime;
    document.getElementById('releaseDateInput').value = minDateTime;
}

function updateCharCount(e) {
    document.getElementById('charCount').textContent = e.target.value.length;
}

// ===== MANEJO DE ARCHIVOS =====
function initFileHandlers() {
    ['artwork', 'mp3', 'wav', 'stems'].forEach(type => {
        const input = document.getElementById(type + 'Input');
        if (input) {
            input.addEventListener('change', (e) => handleFileUpload(type, e));
            input.addEventListener('click', (e) => e.stopPropagation());
        }
    });
}

function handleFileUpload(type, event) {
    const file = event.target.files[0];
    if (!file) return;

    const limits = FILE_LIMITS[type];
    const ext = file.name.split('.').pop().toLowerCase();

    // Validar extensión
    if (!limits.ext.includes(ext)) {
        const allowed = limits.ext.map(e => e.toUpperCase()).join(', ');
        showToast(`Error: El archivo debe ser ${allowed}`, 'error');
        event.target.value = '';
        return;
    }

    // Validar tipo MIME
    if (!limits.types.includes(file.type)) {
        const allowed = limits.ext.map(e => e.toUpperCase()).join(' o ');
        showToast(`Error: Debes subir un archivo ${allowed}`, 'error');
        event.target.value = '';
        return;
    }

    // Validar tamaño
    if (file.size > limits.size) {
        const maxMB = Math.floor(limits.size / (1024 * 1024));
        showToast(`Error: El archivo no puede superar los ${maxMB}MB`, 'error');
        event.target.value = '';
        return;
    }

    // Guardar archivo
    state.files[type] = file;

    if (type === 'artwork') {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('artworkImg').src = e.target.result;
            document.getElementById('artworkImg').style.display = 'block';
            document.getElementById('artworkPlaceholder').style.display = 'none';
            document.getElementById('artworkContainer').classList.add('has-image');
        };
        reader.readAsDataURL(file);
    } else {
        const card = document.getElementById(type + 'Card');
        const info = document.getElementById(type + 'Info');
        card.classList.add('has-file');
        info.innerHTML = `
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${(file.size / (1024 * 1024)).toFixed(2)} MB</div>
                    </div>
                `;
    }

    saveDraftAuto();
}

function removeArtwork(event) {
    event.stopPropagation();
    state.files.artwork = null;
    document.getElementById('artworkImg').style.display = 'none';
    document.getElementById('artworkImg').src = '';
    document.getElementById('artworkPlaceholder').style.display = 'flex';
    document.getElementById('artworkContainer').classList.remove('has-image');
    document.getElementById('artworkInput').value = '';
    saveDraftAuto();
}

// ===== AUTO-PARSE TÍTULO =====
function autoParseTitle(e) {
    const title = e.target.value;

    // BPM
    const bpmMatch = title.match(/(\d{2,3})\s*(?:bpm)?/i);
    if (bpmMatch) {
        const bpm = parseInt(bpmMatch[1]);
        if (bpm >= 40 && bpm <= 500) {
            document.getElementById('bpmInput').value = bpm;
        }
    }

    // KEY
    const lowerTitle = title.toLowerCase();
    for (const key of KEYS) {
        if (lowerTitle.includes(key.toLowerCase())) {
            document.getElementById('keyInput').value = key;
            break;
        }
    }

    // Tags (@usuario)
    const userTags = title.match(/@(\w+)/g);
    if (userTags) {
        userTags.forEach(tag => {
            if (!state.tags.includes(tag) && state.tags.length < 3) {
                state.tags.push(tag);
            }
        });
        updateTagsDisplay();
    }
}

// ===== KEY AUTOCOMPLETE =====
function initKeyAutocomplete() {
    const input = document.getElementById('keyInput');
    const dropdown = document.getElementById('keyDropdown');

    input.addEventListener('input', (e) => {
        const value = e.target.value.toLowerCase();
        if (!value) {
            dropdown.classList.remove('show');
            return;
        }

        const filtered = KEYS.filter(key => key.toLowerCase().includes(value));
        if (filtered.length) {
            dropdown.innerHTML = filtered.map(key =>
                `<div class="autocomplete-item" onclick="selectKey('${key}')">${key}</div>`
            ).join('');
            dropdown.classList.add('show');
        } else {
            dropdown.classList.remove('show');
        }
    });

    input.addEventListener('click', (e) => e.stopPropagation());
}

function selectKey(key) {
    document.getElementById('keyInput').value = key;
    document.getElementById('keyDropdown').classList.remove('show');
    saveDraftAuto();
}

// ===== MULTI SELECT =====
function initMultiSelects() {
    renderOptions('genres', GENRES);
    renderOptions('mood', MOODS);
    renderOptions('instruments', INSTRUMENTS);

    ['genres', 'mood', 'instruments'].forEach(type => {
        const search = document.getElementById(type + 'Search');
        if (search) {
            search.addEventListener('input', (e) => filterOptions(type, e.target.value));
            search.addEventListener('click', (e) => e.stopPropagation());
        }
    });
}

function renderOptions(type, options) {
    const container = document.getElementById(type + 'Options');
    container.innerHTML = options.map(opt =>
        `<div class="select-option" onclick="toggleOption('${type}', '${opt}')">${opt}</div>`
    ).join('');
}

function toggleSelect(type) {
    const dropdown = document.getElementById(type + 'Dropdown');
    const display = document.getElementById(type + 'Display');

    // Cerrar otros
    ['genres', 'mood', 'instruments'].forEach(t => {
        if (t !== type) {
            document.getElementById(t + 'Dropdown')?.classList.remove('show');
            document.getElementById(t + 'Display')?.classList.remove('active');
        }
    });

    dropdown.classList.toggle('show');
    display.classList.toggle('active');
}

function toggleOption(type, value) {
    const limits = { genres: 3, mood: 5, instruments: 10 };
    const array = state[type];
    const idx = array.indexOf(value);

    if (idx > -1) {
        array.splice(idx, 1);
    } else if (array.length < limits[type]) {
        array.push(value);
    } else {
        showToast(`Máximo ${limits[type]} permitidos`, 'error');
        return;
    }

    updateSelectDisplay(type);
    saveDraftAuto();
}

function updateSelectDisplay(type) {
    const display = document.getElementById(type + 'Display');
    const array = state[type];
    const placeholders = {
        genres: 'Selecciona o busca géneros',
        mood: 'Selecciona o busca mood',
        instruments: 'Selecciona o busca instrumentos'
    };

    if (array.length) {
        const tags = array.map(item => `
                    <span class="select-tag">
                        ${item}
                        <span class="tag-remove" onclick="removeOption('${type}', '${item}', event)">
                            <i class="fas fa-times"></i>
                        </span>
                    </span>
                `).join('');
        display.innerHTML = tags;
    } else {
        display.innerHTML = `<span class="select-placeholder">${placeholders[type]}</span>`;
    }

    // Actualizar opciones
    document.querySelectorAll(`#${type}Options .select-option`).forEach(opt => {
        opt.classList.toggle('selected', array.includes(opt.textContent));
    });
}

function removeOption(type, value, event) {
    event.stopPropagation();
    const idx = state[type].indexOf(value);
    if (idx > -1) state[type].splice(idx, 1);
    updateSelectDisplay(type);
    saveDraftAuto();
}

function filterOptions(type, query) {
    const options = document.querySelectorAll(`#${type}Options .select-option`);
    options.forEach(opt => {
        const match = opt.textContent.toLowerCase().includes(query.toLowerCase());
        opt.style.display = match ? 'block' : 'none';
    });
}

// ===== TAGS INPUT =====
function initTagsInput() {
    const input = document.getElementById('tagsInput');
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(input.value.trim());
            input.value = '';
        }
    });
    input.addEventListener('blur', () => {
        if (input.value.trim()) addTag(input.value.trim());
        input.value = '';
        input.style.display = 'none';
    });
    input.addEventListener('click', (e) => e.stopPropagation());
}

function toggleTagsInput() {
    const input = document.getElementById('tagsInput');
    input.style.display = 'block';
    input.focus();
}

function addTag(tag) {
    if (!tag || state.tags.includes(tag.toLowerCase())) return;
    if (state.tags.length >= 3) {
        showToast('Máximo 3 tags permitidos', 'error');
        return;
    }
    state.tags.push(tag.toLowerCase());
    updateTagsDisplay();
    saveDraftAuto();
}

function updateTagsDisplay() {
    const display = document.getElementById('tagsDisplay');
    if (state.tags.length) {
        const tags = state.tags.map((tag, i) => `
                    <span class="select-tag">
                        ${tag}
                        <span class="tag-remove" onclick="removeTag(${i}, event)">
                            <i class="fas fa-times"></i>
                        </span>
                    </span>
                `).join('');
        display.innerHTML = tags;
    } else {
        display.innerHTML = '<span class="select-placeholder">Escribe y presiona Enter</span>';
    }
}

function removeTag(index, event) {
    event.stopPropagation();
    state.tags.splice(index, 1);
    updateTagsDisplay();
    saveDraftAuto();
}

// ===== LICENCIAS =====
function toggleLicense(license) {
    const item = document.querySelector(`.license-item[data-license="${license}"]`);
    const idx = state.activeLicenses.indexOf(license);
    const isFree = document.getElementById('freeCheckbox').checked;

    if (idx > -1) {
        if (state.activeLicenses.length === 1 && !isFree) {
            showToast('Debes tener al menos una licencia activa o marcar como gratis', 'error');
            return;
        }
        state.activeLicenses.splice(idx, 1);
        item.classList.remove('active');
    } else {
        state.activeLicenses.push(license);
        item.classList.add('active');
    }

    document.getElementById('licenseAlert').style.display = 'none';
    saveDraftAuto();
}

function toggleFreeMode() {
    const isFree = document.getElementById('freeCheckbox').checked;
    const section = document.getElementById('licensesSection');

    if (isFree) {
        section.style.opacity = '0.5';
        section.style.pointerEvents = 'none';
        document.querySelector('input[name="discountType"][value="none"]').checked = true;
        toggleDiscountConfig();
    } else {
        section.style.opacity = '1';
        section.style.pointerEvents = 'auto';
        if (state.activeLicenses.length === 0) {
            state.activeLicenses.push('basic');
            document.querySelector('.license-item[data-license="basic"]').classList.add('active');
        }
    }
    saveDraftAuto();
}

function initPriceValidation() {
    ['basic', 'premium', 'stemsLicense', 'exclusive'].forEach(type => {
        const input = document.getElementById(type + 'Price');
        if (input) {
            input.addEventListener('blur', (e) => validatePrice(e.target));
            input.addEventListener('input', saveDraftAuto);
        }
    });
}

function validatePrice(input) {
    let value = parseFloat(input.value);
    if (isNaN(value) || value < 1) {
        input.value = '1.00';
    } else if (value > 10000) {
        input.value = '10000.00';
        showToast('El precio máximo es $10,000', 'error');
    } else {
        input.value = value.toFixed(2);
    }
}

// ===== DESCUENTOS =====
function toggleDiscountConfig() {
    const type = document.querySelector('input[name="discountType"]:checked').value;
    const config = document.getElementById('discountConfig');
    const isFree = document.getElementById('freeCheckbox').checked;

    if (type === 'none' || isFree) {
        config.style.display = 'none';
    } else {
        config.style.display = 'block';
        document.getElementById('discountValue').placeholder = type === 'percentage' ? '0-100' : '$0.00';
    }
    saveDraftAuto();
}

function validateDiscount() {
    const type = document.querySelector('input[name="discountType"]:checked').value;
    if (type === 'none') return true;

    const license = document.getElementById('discountLicenseSelect').value;
    const value = parseFloat(document.getElementById('discountValue').value);
    const errorDiv = document.getElementById('discountError');

    if (!license) {
        errorDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Selecciona una licencia';
        errorDiv.classList.add('show');
        return false;
    }

    if (!value || value <= 0) {
        errorDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Ingresa un valor válido';
        errorDiv.classList.add('show');
        return false;
    }

    const priceInputId = license === 'stems' ? 'stemsLicensePrice' : license + 'Price';
    const price = parseFloat(document.getElementById(priceInputId).value);

    if (type === 'percentage') {
        if (value > 100) {
            errorDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> El porcentaje no puede ser mayor a 100%';
            errorDiv.classList.add('show');
            return false;
        }
        if (value === 100) {
            showToast('Un descuento del 100% es gratis. Considera activar "Ofrecer gratis"', 'error');
        }
    } else if (type === 'fixed') {
        if (value >= price) {
            errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> El descuento no puede ser mayor o igual al precio (${price.toFixed(2)})`;
            errorDiv.classList.add('show');
            return false;
        }
    }

    errorDiv.classList.remove('show');
    return true;
}

// ===== COLABORADORES =====
function updatePercentageDisplay() {
    const total = state.collaborators.reduce((sum, c) => sum + c.percentage, 0);
    const remaining = 100 - total;
    const display = document.getElementById('percentageDisplay');

    if (remaining < 0) {
        display.className = 'percentage-remaining error';
        display.innerHTML = `<strong>Error:</strong> El total supera el 100% (${total}%)`;
    } else {
        display.className = 'percentage-remaining';
        display.innerHTML = `Tu porcentaje: <strong>${remaining}%</strong>`;
    }
}

function addCollaborator(name, percentage = 50) {
    const initial = name.charAt(0).toUpperCase();
    const collab = { name, percentage };
    state.collaborators.push(collab);

    const collabList = document.getElementById('collabList');
    const div = document.createElement('div');
    div.className = 'collab-item';
    div.innerHTML = `
                <div class="collab-avatar">${initial}</div>
                <div class="collab-info">
                    <div class="collab-name">${name}</div>
                    <div class="collab-role">Colaborador</div>
                </div>
                <div class="collab-percentage">
                    <input type="number" class="percentage-input" value="${percentage}" min="1" max="99" 
                           onchange="updateCollabPercentage(${state.collaborators.length - 1}, this.value)">
                    <span>%</span>
                </div>
                <button type="button" class="remove-collab" onclick="removeCollaborator(${state.collaborators.length - 1})">
                    <i class="fas fa-times"></i>
                </button>
            `;
    collabList.appendChild(div);
    updatePercentageDisplay();
    saveDraftAuto();
}

function updateCollabPercentage(index, value) {
    value = parseInt(value);
    if (value < 1) value = 1;
    if (value > 99) value = 99;
    state.collaborators[index].percentage = value;
    updatePercentageDisplay();
    saveDraftAuto();
}

function removeCollaborator(index) {
    state.collaborators.splice(index, 1);
    document.getElementById('collabList').children[index].remove();
    updatePercentageDisplay();
    saveDraftAuto();
}

// ===== VALIDACIÓN =====
function validateForm() {
    let isValid = true;

    // Limpiar errores
    document.querySelectorAll('.error-msg').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('.form-input, .form-select, .file-upload-card').forEach(e => e.classList.remove('error')); // Añadido file-upload-card

    // Título
    if (!document.getElementById('titleInput').value.trim()) {
        document.getElementById('titleError').classList.add('show');
        document.getElementById('titleInput').classList.add('error');
        isValid = false;
    }

    const isFree = document.getElementById('freeCheckbox').checked;

    // MP3 (¡CORREGIDO! - Solo requerido si NO es gratis)
    if (!state.files.mp3 && !isFree) {
        document.getElementById('filesError').classList.add('show');
        document.getElementById('mp3Card').classList.add('error'); // Resaltar la tarjeta
        isValid = false;
    }
    // (Opcional: si gratis requiere MP3 para el preview, quita '&& !isFree')

    // BPM
    const bpmInput = document.getElementById('bpmInput');
    if (bpmInput.value) { // Solo validar si no está vacío
        const bpm = parseInt(bpmInput.value);
        if (bpm && (bpm < 40 || bpm > 500)) {
            document.getElementById('bpmError').classList.add('show');
            bpmInput.classList.add('error');
            isValid = false;
        }
    }

    // Géneros
    if (state.genres.length === 0) {
        document.getElementById('genresError').classList.add('show');
        isValid = false;
    }

    // Licencias
    if (!isFree && state.activeLicenses.length === 0) {
        document.getElementById('licenseAlert').style.display = 'flex';
        isValid = false;
    }

    // Fecha (¡CORREGIDO! - Comparamos solo hasta el minuto)
    const releaseDate = new Date(document.getElementById('releaseDateInput').value);
    const now = new Date();
    now.setSeconds(0, 0); // Ignorar segundos para la comparación

    if (releaseDate < now) {
        document.getElementById('dateError').classList.add('show');
        document.getElementById('releaseDateInput').classList.add('error');
        isValid = false;
    }

    // Descuentos
    if (!validateDiscount()) {
        isValid = false;
    }

    // Colaboradores
    const total = state.collaborators.reduce((sum, c) => sum + c.percentage, 0);
    if (total > 100) {
        showToast('El porcentaje de colaboradores no puede superar el 100%', 'error');
        isValid = false;
    }

    if (!isValid) {
        showToast('Por favor completa todos los campos requeridos', 'error');
        const firstError = document.querySelector('.error-msg.show, .form-input.error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    return isValid;
}



// ===== ENVÍO =====
async function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;

    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publicando...';

    try {
        const formData = collectFormData();
        const token = localStorage.getItem('authToken');
        const userId = localStorage.getItem('userId');

        if (!userId) {
            throw new Error('No se pudo identificar al usuario. Por favor, inicia sesión de nuevo.');
        }

        let artwork_url = null;
        if (state.files.artwork) {
            showToast('Subiendo portada...');
            const filePath = `${userId}/art/${Date.now()}_${state.files.artwork.name}`;
            const { data, error } = await supabaseClient.storage
                .from('product_images')
                .upload(filePath, state.files.artwork);
            if (error) throw new Error('Error subiendo portada: ' + error.message);
            artwork_url = supabaseClient.storage.from('product_images').getPublicUrl(data.path).data.publicUrl;
        }

        let mp3_url = null;
        if (state.files.mp3) {
            showToast('Subiendo MP3...');
            const mp3Path = `${userId}/files/${Date.now()}_${state.files.mp3.name}`;
            const { data: mp3Data, error: mp3Error } = await supabaseClient.storage
                .from('product_files')
                .upload(mp3Path, state.files.mp3);
            if (mp3Error) throw new Error('Error subiendo MP3: ' + mp3Error.message);
            mp3_url = supabaseClient.storage.from('product_files').getPublicUrl(mp3Data.path).data.publicUrl;
        }

        let wav_url = null;
        if (state.files.wav) {
            showToast('Subiendo WAV...');
            const wavPath = `${userId}/files/${Date.now()}_${state.files.wav.name}`;
            const { data: wavData, error: wavError } = await supabaseClient.storage.from('product_files').upload(wavPath, state.files.wav);
            if (wavError) throw new Error('Error subiendo WAV: ' + wavError.message);
            wav_url = supabaseClient.storage.from('product_files').getPublicUrl(wavData.path).data.publicUrl;
        }

        let stems_url = null;
        if (state.files.stems) {
            showToast('Subiendo Stems...');
            const stemsPath = `${userId}/files/${Date.now()}_${state.files.stems.name}`;
            const { data: stemsData, error: stemsError } = await supabaseClient.storage.from('product_files').upload(stemsPath, state.files.stems);
            if (stemsError) throw new Error('Error subiendo Stems: ' + stemsError.message);
            stems_url = supabaseClient.storage.from('product_files').getPublicUrl(stemsData.path).data.publicUrl;
        }

        const finalPayload = {
            ...formData,
            artwork_url,
            mp3_url,
            wav_url,
            stems_url,
            product_type: 'beat'
        };

        showToast('Registrando producto...');
        const response = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(finalPayload)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error del servidor');

        showToast('¡Beat publicado exitosamente!', 'success');
        localStorage.removeItem(STORAGE_KEY);
        setTimeout(() => {
            window.location.href = '/cuenta/mis-kits.html';
        }, 2000);

    } catch (error) {
        console.error('Error al publicar:', error);
        showToast(error.message, 'error');
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Publicar Beat';
    }
}

function saveDraft() {
    const formData = collectFormData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    console.log('💾 Borrador guardado');
    showToast('Borrador guardado correctamente', 'success');

    setTimeout(() => {
        window.location.href = '/cuenta/borradores.html';
    }, 1500);
}

function saveDraftAuto() {
    const formData = collectFormData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    console.log('Draft auto-saved');
}

function loadDraft() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
        const data = JSON.parse(saved);

        if (data.title) document.getElementById('titleInput').value = data.title;
        if (data.description) {
            document.getElementById('descInput').value = data.description;
            updateCharCount({ target: { value: data.description } });
        }
        if (data.key) document.getElementById('keyInput').value = data.key;
        if (data.bpm) document.getElementById('bpmInput').value = data.bpm;
        if (data.tags) {
            state.tags = data.tags;
            updateTagsDisplay();
        }
        if (data.genres) {
            state.genres = data.genres;
            updateSelectDisplay('genres');
        }
        if (data.moods) {
            state.moods = data.moods;
            updateSelectDisplay('mood');
        }
        if (data.instruments) {
            state.instruments = data.instruments;
            updateSelectDisplay('instruments');
        }

        console.log('📄 Borrador cargado');
    } catch (e) {
        console.error('Error al cargar borrador:', e);
    }
}

function collectFormData() {
    const data = {
        title: document.getElementById('titleInput').value.trim(),
        description: document.getElementById('descInput').value.trim(),
        key: document.getElementById('keyInput').value,
        bpm: document.getElementById('bpmInput').value,
        tags: state.tags,
        genres: state.genres,
        moods: state.moods,
        instruments: state.instruments,
        hasSamples: document.getElementById('hasSamples').checked,
        isFree: document.getElementById('freeCheckbox').checked,
        licenses: {},
        discount: null,
        visibility: document.getElementById('visibilitySelect').value,
        releaseDate: document.getElementById('releaseDateInput').value,
        bulkDiscount: document.getElementById('bulkDiscount').checked,
        collaborators: state.collaborators,
        activeLicenses: state.activeLicenses
    };

    if (!data.isFree) {
        state.activeLicenses.forEach(license => {
            const priceInputId = license === 'stems' ? 'stemsLicensePrice' : license + 'Price';
            data.licenses[license] = parseFloat(document.getElementById(priceInputId).value);
        });
    }

    const discountType = document.querySelector('input[name="discountType"]:checked').value;
    if (discountType !== 'none' && !data.isFree) {
        data.discount = {
            type: discountType,
            license: document.getElementById('discountLicenseSelect').value,
            value: parseFloat(document.getElementById('discountValue').value),
            expiry: document.getElementById('discountExpiry').value || null
        };
    }

    return data;
}

// ===== UTILIDADES =====
function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
                <span>${message}</span>
            `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function closeAllDropdowns(e) {
    if (!e.target.closest('.multi-select') && !e.target.closest('.autocomplete-wrapper')) {
        document.querySelectorAll('.select-dropdown').forEach(d => d.classList.remove('show'));
        document.querySelectorAll('.select-display').forEach(d => d.classList.remove('active'));
        document.querySelectorAll('.autocomplete-dropdown').forEach(d => d.classList.remove('show'));
    }
    if (!e.target.closest('.user-dropdown')) {
        document.querySelector('.user-dropdown')?.classList.remove('active');
    }
}

function toggleUserDropdown() {
    document.querySelector('.user-dropdown')?.classList.toggle('active');
}

// ===== AUTO-GUARDAR =====
setInterval(() => {
    if (document.getElementById('titleInput').value.trim()) {
        saveDraftAuto();
    }
}, 30000); // Cada 30 segundos

// Evitar envío con Enter en inputs
document.querySelectorAll('.form-input, .form-select').forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    });
});