// upload-beat.js - Sistema completo de subida de beats con autenticación

document.addEventListener('DOMContentLoaded', async () => {
    
    // ==================== CONFIGURACIÓN ====================
    const token = localStorage.getItem('authToken');
    const STORAGE_KEY = 'offszn_beat_draft';
    const CACHE_KEY = 'offszn_user_cache';
    
    let API_URL = '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_URL = 'http://localhost:3000/api';
    } else {
        API_URL = 'https://offszn-academy.onrender.com/api';
    }

    // ==================== VERIFICAR AUTENTICACIÓN ====================
    if (!token) {
        console.error("❌ No hay token, redirigiendo al login");
        alert('Debes iniciar sesión para subir beats');
        window.location.replace('/pages/login.html');
        return;
    }

    // ==================== ESTADO GLOBAL ====================
    const state = {
        files: { artwork: null, mp3: null, wav: null, stems: null },
        tags: [],
        genres: [],
        moods: [],
        instruments: [],
        collaborators: [],
        activeLicenses: ['basic', 'premium', 'stems', 'exclusive']
    };

    // ==================== DATOS ====================
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

    // ==================== CARGAR USUARIO ====================
    async function loadUserData() {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const cachedData = JSON.parse(cached);
                updateUserUI(cachedData);
            }

            const response = await fetch(`${API_URL}/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem(CACHE_KEY);
                    alert('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
                    window.location.replace('/pages/login.html');
                    return;
                }
                throw new Error('Error al cargar datos del usuario');
            }

            const userData = await response.json();
            console.log('✅ Usuario cargado:', userData);
            
            localStorage.setItem(CACHE_KEY, JSON.stringify(userData));
            updateUserUI(userData);

        } catch (error) {
            console.error('❌ Error cargando usuario:', error);
            alert('Error al cargar tus datos. Por favor recarga la página.');
        }
    }

    function updateUserUI(userData) {
        const dropdownName = document.querySelector('.user-dropdown-name');
        const dropdownEmail = document.querySelector('.user-dropdown-email');
        const dropdownAvatar = document.querySelector('.user-dropdown-avatar');

        if (dropdownName) {
            dropdownName.textContent = userData.nickname || userData.first_name || 'Usuario';
        }
        if (dropdownEmail) {
            dropdownEmail.textContent = userData.email || 'usuario@offszn.com';
        }
        if (dropdownAvatar) {
            const initial = (userData.first_name || userData.nickname || 'U').charAt(0).toUpperCase();
            dropdownAvatar.textContent = initial;
        }
    }

    // ==================== FECHA Y HORA ====================
    function initDateTime() {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        const minDateTime = now.toISOString().slice(0, 16);
        const input = document.getElementById('releaseDateInput');
        if (input) {
            input.min = minDateTime;
            input.value = minDateTime;
        }
    }

    // ==================== CONTADOR DE CARACTERES ====================
    function updateCharCount(e) {
        const count = document.getElementById('charCount');
        if (count) count.textContent = e.target.value.length;
    }

    // ==================== ARCHIVOS ====================
    function initFileHandlers() {
        ['artwork', 'mp3', 'wav', 'stems'].forEach(type => {
            const input = document.getElementById(type + 'Input');
            if (input) {
                input.addEventListener('change', (e) => handleFileUpload(type, e));
            }
        });
    }

    function handleFileUpload(type, event) {
        const file = event.target.files[0];
        if (!file) return;

        const limits = FILE_LIMITS[type];
        const ext = file.name.split('.').pop().toLowerCase();
        
        if (!limits.ext.includes(ext)) {
            const allowed = limits.ext.map(e => e.toUpperCase()).join(', ');
            showToast(`El archivo debe ser ${allowed}`, 'error');
            event.target.value = '';
            return;
        }

        if (file.size > limits.size) {
            const maxMB = Math.floor(limits.size / (1024 * 1024));
            showToast(`El archivo no puede superar ${maxMB}MB`, 'error');
            event.target.value = '';
            return;
        }

        state.files[type] = file;

        if (type === 'artwork') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.getElementById('artworkImg');
                const placeholder = document.getElementById('artworkPlaceholder');
                const container = document.getElementById('artworkContainer');
                
                if (img && placeholder && container) {
                    img.src = e.target.result;
                    img.style.display = 'block';
                    placeholder.style.display = 'none';
                    container.classList.add('has-image');
                }
            };
            reader.readAsDataURL(file);
        } else {
            const card = document.getElementById(type + 'Card');
            const info = document.getElementById(type + 'Info');
            if (card && info) {
                card.classList.add('has-file');
                info.innerHTML = `
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${(file.size / (1024 * 1024)).toFixed(2)} MB</div>
                    </div>
                `;
            }
        }
        
        showToast('Archivo cargado correctamente', 'success');
        autosave();
    }

    window.removeArtwork = function(event) {
        event.stopPropagation();
        state.files.artwork = null;
        
        const img = document.getElementById('artworkImg');
        const placeholder = document.getElementById('artworkPlaceholder');
        const container = document.getElementById('artworkContainer');
        const input = document.getElementById('artworkInput');
        
        if (img) {
            img.style.display = 'none';
            img.src = '';
        }
        if (placeholder) placeholder.style.display = 'flex';
        if (container) container.classList.remove('has-image');
        if (input) input.value = '';
        
        showToast('Portada eliminada', 'success');
        autosave();
    };

    // ==================== AUTO-PARSE TÍTULO ====================
    function autoParseTitle(e) {
        const title = e.target.value;
        
        // BPM
        const bpmMatch = title.match(/(\d{2,3})\s*(?:bpm)?/i);
        if (bpmMatch) {
            const bpm = parseInt(bpmMatch[1]);
            if (bpm >= 40 && bpm <= 500) {
                const bpmInput = document.getElementById('bpmInput');
                if (bpmInput) bpmInput.value = bpm;
            }
        }

        // KEY
        const lowerTitle = title.toLowerCase();
        for (const key of KEYS) {
            if (lowerTitle.includes(key.toLowerCase())) {
                const keyInput = document.getElementById('keyInput');
                if (keyInput) keyInput.value = key;
                break;
            }
        }

        // TAGS de usuarios (@usuario)
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

    // ==================== KEY AUTOCOMPLETE ====================
    function initKeyAutocomplete() {
        const input = document.getElementById('keyInput');
        const dropdown = document.getElementById('keyDropdown');
        
        if (!input || !dropdown) return;

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
    }

    window.selectKey = function(key) {
        const input = document.getElementById('keyInput');
        const dropdown = document.getElementById('keyDropdown');
        if (input) input.value = key;
        if (dropdown) dropdown.classList.remove('show');
        autosave();
    };

    // ==================== TAGS INPUT ====================
    function initTagsInput() {
        const display = document.getElementById('tagsDisplay');
        if (!display) return;
        
        display.addEventListener('click', (e) => {
            if (e.target.closest('.tag-remove')) return;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-input';
            input.placeholder = 'Escribe un tag y presiona Enter';
            input.style.flex = '1';
            input.style.minWidth = '200px';
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const tag = input.value.trim();
                    if (tag) {
                        addTag(tag);
                    }
                    input.remove();
                    updateTagsDisplay();
                }
            });
            
            input.addEventListener('blur', () => {
                const tag = input.value.trim();
                if (tag) {
                    addTag(tag);
                }
                input.remove();
                updateTagsDisplay();
            });
            
            display.appendChild(input);
            input.focus();
        });
    }

    function addTag(tag) {
        if (!tag || state.tags.includes(tag.toLowerCase())) return;
        if (state.tags.length >= 3) {
            showToast('Máximo 3 tags permitidos', 'error');
            return;
        }
        state.tags.push(tag.toLowerCase());
        updateTagsDisplay();
        autosave();
    }

    function updateTagsDisplay() {
        const display = document.getElementById('tagsDisplay');
        if (!display) return;
        
        display.innerHTML = '';
        
        state.tags.forEach((tag, i) => {
            const tagEl = document.createElement('span');
            tagEl.className = 'select-tag';
            tagEl.innerHTML = `
                ${tag}
                <span class="tag-remove" onclick="removeTag(${i}, event)">
                    <i class="fas fa-times"></i>
                </span>
            `;
            display.appendChild(tagEl);
        });
        
        if (state.tags.length === 0) {
            const placeholder = document.createElement('span');
            placeholder.className = 'select-placeholder';
            placeholder.textContent = 'Haz clic para agregar tags';
            display.appendChild(placeholder);
        }
    }

    window.removeTag = function(index, event) {
        event.stopPropagation();
        state.tags.splice(index, 1);
        updateTagsDisplay();
        autosave();
    };

    // ==================== MULTI SELECT ====================
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
        if (!container) return;
        
        container.innerHTML = options.map(opt => 
            `<div class="select-option" onclick="toggleOption('${type}', '${opt}')">${opt}</div>`
        ).join('');
    }

    window.toggleSelect = function(type) {
        const dropdown = document.getElementById(type + 'Dropdown');
        const display = document.getElementById(type + 'Display');
        
        ['genres', 'mood', 'instruments'].forEach(t => {
            if (t !== type) {
                const dd = document.getElementById(t + 'Dropdown');
                const ds = document.getElementById(t + 'Display');
                if (dd) dd.classList.remove('show');
                if (ds) ds.classList.remove('active');
            }
        });

        if (dropdown) dropdown.classList.toggle('show');
        if (display) display.classList.toggle('active');
    };

    window.toggleOption = function(type, value) {
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
        autosave();
    };

    function updateSelectDisplay(type) {
        const display = document.getElementById(type + 'Display');
        const array = state[type];
        const placeholders = {
            genres: 'Selecciona géneros',
            mood: 'Selecciona mood',
            instruments: 'Selecciona instrumentos'
        };

        if (!display) return;
        
        display.innerHTML = '';

        if (array.length) {
            array.forEach(item => {
                const tagEl = document.createElement('span');
                tagEl.className = 'select-tag';
                tagEl.innerHTML = `
                    ${item}
                    <span class="tag-remove" onclick="removeOption('${type}', '${item}', event)">
                        <i class="fas fa-times"></i>
                    </span>
                `;
                display.appendChild(tagEl);
            });
        } else {
            const placeholder = document.createElement('span');
            placeholder.className = 'select-placeholder';
            placeholder.textContent = placeholders[type];
            display.appendChild(placeholder);
        }

        const options = document.querySelectorAll(`#${type}Options .select-option`);
        options.forEach(opt => {
            opt.classList.toggle('selected', array.includes(opt.textContent));
        });
    }

    window.removeOption = function(type, value, event) {
        event.stopPropagation();
        const idx = state[type].indexOf(value);
        if (idx > -1) state[type].splice(idx, 1);
        updateSelectDisplay(type);
        autosave();
    };

    function filterOptions(type, query) {
        const options = document.querySelectorAll(`#${type}Options .select-option`);
        options.forEach(opt => {
            const match = opt.textContent.toLowerCase().includes(query.toLowerCase());
            opt.style.display = match ? 'block' : 'none';
        });
    }

    // ==================== LICENCIAS ====================
    window.toggleLicense = function(license) {
        const item = document.querySelector(`.license-item[data-license="${license}"]`);
        if (!item) return;
        
        const idx = state.activeLicenses.indexOf(license);
        const isFree = document.getElementById('freeCheckbox')?.checked;

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

        const alert = document.getElementById('licenseAlert');
        if (alert) alert.style.display = 'none';
        autosave();
    };

    window.toggleFreeMode = function() {
        const checkbox = document.getElementById('freeCheckbox');
        const section = document.getElementById('licensesSection');
        
        if (!checkbox || !section) return;
        
        const isFree = checkbox.checked;
        
        if (isFree) {
            section.style.opacity = '0.5';
            section.style.pointerEvents = 'none';
            
            const discountRadio = document.querySelector('input[name="discountType"][value="none"]');
            if (discountRadio) discountRadio.checked = true;
            toggleDiscountConfig();
        } else {
            section.style.opacity = '1';
            section.style.pointerEvents = 'auto';
            
            if (state.activeLicenses.length === 0) {
                state.activeLicenses.push('basic');
                const basicItem = document.querySelector('.license-item[data-license="basic"]');
                if (basicItem) basicItem.classList.add('active');
            }
        }
        autosave();
    };

    // ==================== PRECIOS ====================
    function initPriceValidation() {
        ['basic', 'premium', 'stemsLicense', 'exclusive'].forEach(type => {
            const input = document.getElementById(type + 'Price');
            if (input) {
                input.addEventListener('blur', (e) => validatePrice(e.target));
                input.addEventListener('input', autosave);
            }
        });
    }

    function validatePrice(input) {
        let value = parseFloat(input.value);
        if (isNaN(value) || value < 1) {
            input.value = '1.00';
            showToast('El precio mínimo es $1.00', 'error');
        } else if (value > 10000) {
            input.value = '10000.00';
            showToast('El precio máximo es $10,000', 'error');
        } else {
            input.value = value.toFixed(2);
        }
    }

    // ==================== DESCUENTOS ====================
    window.toggleDiscountConfig = function() {
        const typeRadio = document.querySelector('input[name="discountType"]:checked');
        const config = document.getElementById('discountConfig');
        const checkbox = document.getElementById('freeCheckbox');
        
        if (!typeRadio || !config) return;
        
        const type = typeRadio.value;
        const isFree = checkbox?.checked;

        if (type === 'none' || isFree) {
            config.style.display = 'none';
            const errorDiv = document.getElementById('discountError');
            if (errorDiv) errorDiv.classList.remove('show');
        } else {
            config.style.display = 'block';
            const valueInput = document.getElementById('discountValue');
            if (valueInput) {
                valueInput.placeholder = type === 'percentage' ? '0-100' : '$0.00';
                valueInput.max = type === 'percentage' ? '100' : '';
            }
        }
        autosave();
    };

    // ==================== VALIDACIÓN ====================
    function validateForm() {
        let isValid = true;
        
        document.querySelectorAll('.error-msg').forEach(e => e.classList.remove('show'));
        document.querySelectorAll('.form-input, .form-select').forEach(e => e.classList.remove('error'));

        // Título
        const titleInput = document.getElementById('titleInput');
        if (!titleInput?.value.trim()) {
            const error = document.getElementById('titleError');
            if (error) error.classList.add('show');
            if (titleInput) titleInput.classList.add('error');
            isValid = false;
        }

        // MP3
        if (!state.files.mp3) {
            const error = document.getElementById('filesError');
            if (error) error.classList.add('show');
            isValid = false;
        }

        // BPM
        const bpmInput = document.getElementById('bpmInput');
        const bpm = parseInt(bpmInput?.value || '');
        if (bpm && (bpm < 40 || bpm > 500)) {
            const error = document.getElementById('bpmError');
            if (error) error.classList.add('show');
            if (bpmInput) bpmInput.classList.add('error');
            isValid = false;
        }

        // Géneros
        if (state.genres.length === 0) {
            const error = document.getElementById('genresError');
            if (error) error.classList.add('show');
            isValid = false;
        }

        // Licencias
        const checkbox = document.getElementById('freeCheckbox');
        const isFree = checkbox?.checked;
        if (!isFree && state.activeLicenses.length === 0) {
            const alert = document.getElementById('licenseAlert');
            if (alert) alert.style.display = 'flex';
            isValid = false;
        }

        // Fecha
        const dateInput = document.getElementById('releaseDateInput');
        const releaseDate = new Date(dateInput?.value || '');
        const now = new Date();
        if (releaseDate < now) {
            const error = document.getElementById('dateError');
            if (error) error.classList.add('show');
            if (dateInput) dateInput.classList.add('error');
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

    // ==================== SUBMIT ====================
    async function handleSubmit(e) {
        e.preventDefault();
        if (!validateForm()) return;

        const formData = collectFormData();
        console.log('📦 Publicando beat:', formData);
        
        showToast('¡Beat publicado exitosamente!', 'success');
        localStorage.removeItem(STORAGE_KEY);
        
        setTimeout(() => {
            window.location.href = '/cuenta/mis-kits.html';
        }, 2000);
    }

    // ==================== BORRADOR ====================
    window.saveDraft = function() {
        const formData = collectFormData();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
        console.log('💾 Borrador guardado');
        showToast('Borrador guardado correctamente', 'success');
        
        setTimeout(() => {
            window.location.href = '/cuenta/borradores.html';
        }, 1500);
    };

    function autosave() {
        const titleInput = document.getElementById('titleInput');
        if (titleInput?.value.trim()) {
            const formData = collectFormData();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
        }
    }

    function loadDraft() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;

        try {
            const data = JSON.parse(saved);
            
            const titleInput = document.getElementById('titleInput');
            const descInput = document.getElementById('descInput');
            const keyInput = document.getElementById('keyInput');
            const bpmInput = document.getElementById('bpmInput');
            
            if (data.title && titleInput) titleInput.value = data.title;
            if (data.description && descInput) {
                descInput.value = data.description;
                updateCharCount({ target: { value: data.description } });
            }
            if (data.key && keyInput) keyInput.value = data.key;
            if (data.bpm && bpmInput) bpmInput.value = data.bpm;
            
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
        const titleInput = document.getElementById('titleInput');
        const descInput = document.getElementById('descInput');
        const keyInput = document.getElementById('keyInput');
        const bpmInput = document.getElementById('bpmInput');
        const samplesCheckbox = document.getElementById('hasSamples');
        const freeCheckbox = document.getElementById('freeCheckbox');
        const visibilitySelect = document.getElementById('visibilitySelect');
        const dateInput = document.getElementById('releaseDateInput');
        const bulkCheckbox = document.getElementById('bulkDiscount');
        
        const data = {
            title: titleInput?.value.trim() || '',
            description: descInput?.value.trim() || '',
            key: keyInput?.value || '',
            bpm: bpmInput?.value || '',
            tags: state.tags,
            genres: state.genres,
            moods: state.moods,
            instruments: state.instruments,
            hasSamples: samplesCheckbox?.checked || false,
            isFree: freeCheckbox?.checked || false,
            licenses: {},
            discount: null,
            visibility: visibilitySelect?.value || 'public',
            releaseDate: dateInput?.value || '',
            bulkDiscount: bulkCheckbox?.checked || false,
            collaborators: state.collaborators,
            activeLicenses: state.activeLicenses
        };

        if (!data.isFree) {
            state.activeLicenses.forEach(license => {
                const priceInputId = license === 'stems' ? 'stemsLicensePrice' : license + 'Price';
                const priceInput = document.getElementById(priceInputId);
                if (priceInput) {
                    data.licenses[license] = parseFloat(priceInput.value);
                }
            });
        }

        const discountType = document.querySelector('input[name="discountType"]:checked')?.value;
        if (discountType !== 'none' && !data.isFree) {
            const licenseSelect = document.getElementById('discountLicenseSelect');
            const valueInput = document.getElementById('discountValue');
            const expiryInput = document.getElementById('discountExpiry');
            
            data.discount = {
                type: discountType,
                license: licenseSelect?.value || '',
                value: parseFloat(valueInput?.value || '0'),
                expiry: expiryInput?.value || null
            };
        }

        return data;
    }

    // ==================== TOAST ====================
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
            toast.remove();
        }, 4000);
    }

    // ==================== CERRAR DROPDOWNS ====================
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

    // ==================== USER DROPDOWN ====================
    window.toggleUserDropdown = function() {
        const dropdown = document.querySelector('.user-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('active');
        }
    };

    // ==================== LOGOUT ====================
    const logoutBtn = document.querySelector('.user-dropdown-item.logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            localStorage.removeItem(CACHE_KEY);
            localStorage.removeItem(STORAGE_KEY);
            alert('¡Has cerrado sesión!');
            window.location.replace('/pages/login.html');
        });
    }

    // ==================== COLABORADORES ====================
    window.addCollaborator = function(name, percentage = 50) {
        if (state.collaborators.length >= 5) {
            showToast('Máximo 5 colaboradores', 'error');
            return;
        }

        const initial = name.charAt(0).toUpperCase();
        const collab = { name, percentage };
        state.collaborators.push(collab);
        
        const collabList = document.getElementById('collabList');
        if (!collabList) return;
        
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
        autosave();
    };

    window.updateCollabPercentage = function(index, value) {
        value = parseInt(value);
        if (isNaN(value) || value < 1) value = 1;
        if (value > 99) value = 99;
        
        state.collaborators[index].percentage = value;
        updatePercentageDisplay();
        autosave();
    };

    window.removeCollaborator = function(index) {
        state.collaborators.splice(index, 1);
        const collabList = document.getElementById('collabList');
        if (collabList && collabList.children[index]) {
            collabList.children[index].remove();
        }
        updatePercentageDisplay();
        autosave();
    };

    function updatePercentageDisplay() {
        const total = state.collaborators.reduce((sum, c) => sum + c.percentage, 0);
        const remaining = 100 - total;
        const display = document.getElementById('percentageDisplay');
        
        if (!display) return;
        
        if (remaining < 0) {
            display.className = 'percentage-remaining error';
            display.innerHTML = `<strong>Error:</strong> El total supera el 100% (${total}%)`;
        } else if (remaining === 0 && state.collaborators.length > 0) {
            display.className = 'percentage-remaining error';
            display.innerHTML = `<strong>Error:</strong> Debes tener al menos 1% para ti`;
        } else {
            display.className = 'percentage-remaining';
            display.innerHTML = `Tu porcentaje: <strong>${remaining}%</strong>`;
        }
    }

    // ==================== VALIDACIÓN DE DESCUENTOS ====================
    function initDiscountValidation() {
        const valueInput = document.getElementById('discountValue');
        const licenseSelect = document.getElementById('discountLicenseSelect');
        
        if (valueInput) valueInput.addEventListener('input', validateDiscount);
        if (licenseSelect) licenseSelect.addEventListener('change', validateDiscount);
    }

    function validateDiscount() {
        const typeRadio = document.querySelector('input[name="discountType"]:checked');
        if (!typeRadio || typeRadio.value === 'none') return true;

        const type = typeRadio.value;
        const licenseSelect = document.getElementById('discountLicenseSelect');
        const valueInput = document.getElementById('discountValue');
        const errorDiv = document.getElementById('discountError');
        
        if (!licenseSelect || !valueInput || !errorDiv) return false;

        const license = licenseSelect.value;
        const value = parseFloat(valueInput.value);

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
        const priceInput = document.getElementById(priceInputId);
        const price = parseFloat(priceInput?.value || '0');

        if (type === 'percentage') {
            if (value > 100) {
                errorDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> El porcentaje no puede ser mayor a 100%';
                errorDiv.classList.add('show');
                valueInput.value = '100';
                return false;
            }
            if (value === 100) {
                showToast('Un descuento del 100% equivale a gratis', 'error');
            }
        } else if (type === 'fixed') {
            if (value >= price) {
                errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> El descuento no puede ser mayor o igual al precio`;
                errorDiv.classList.add('show');
                return false;
            }
        }

        errorDiv.classList.remove('show');
        return true;
    }

    // ==================== PREVENIR ENTER EN INPUTS ====================
    document.querySelectorAll('.form-input, .form-select').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
            }
        });
    });

    // ==================== INICIALIZACIÓN ====================
    async function init() {
        console.log('🚀 Iniciando sistema de subida de beats...');
        
        // Cargar usuario
        await loadUserData();
        
        // Inicializar componentes
        initDateTime();
        initFileHandlers();
        initKeyAutocomplete();
        initMultiSelects();
        initTagsInput();
        initPriceValidation();
        initDiscountValidation();
        
        // Cargar borrador si existe
        loadDraft();
        
        // Event listeners
        const descInput = document.getElementById('descInput');
        if (descInput) descInput.addEventListener('input', updateCharCount);
        
        const titleInput = document.getElementById('titleInput');
        if (titleInput) titleInput.addEventListener('input', autoParseTitle);
        
        const uploadForm = document.getElementById('uploadForm');
        if (uploadForm) uploadForm.addEventListener('submit', handleSubmit);
        
        document.addEventListener('click', closeAllDropdowns);
        
        // Autoguardado cada 30 segundos
        setInterval(autosave, 30000);
        
        // Inicializar radios de descuento
        const discountRadios = document.querySelectorAll('input[name="discountType"]');
        discountRadios.forEach(radio => {
            radio.addEventListener('change', toggleDiscountConfig);
        });
        
        // Inicializar checkbox de gratis
        const freeCheckbox = document.getElementById('freeCheckbox');
        if (freeCheckbox) {
            freeCheckbox.addEventListener('change', toggleFreeMode);
        }
        
        console.log('✅ Sistema inicializado correctamente');
    }

    // Ejecutar inicialización
    await init();
});
