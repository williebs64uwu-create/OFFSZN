/* ============================= */
/* DRUMKIT UPLOAD - JAVASCRIPT */
/* Archivo: drumkit-upload-script.js */
/* ============================= */

'use strict';

/* ============================= */
/* CONFIGURACIÓN Y CONSTANTES */
/* ============================= */

const CONFIG = {
    STORAGE_KEY: 'offszn_drumkit_draft',
    AUTO_SAVE_INTERVAL: 30000, // 30 segundos
    DEBOUNCE_DELAY: 300,
    SEARCH_MIN_CHARS: 3,
    MAX_FILE_SIZES: {
        artwork: 5 * 1024 * 1024, // 5MB
        kit: 500 * 1024 * 1024, // 500MB
        preview: 50 * 1024 * 1024 // 50MB
    },
    ALLOWED_TYPES: {
        artwork: ['image/jpeg', 'image/png', 'image/webp'],
        kit: ['application/zip', 'application/x-rar-compressed', 'application/x-zip-compressed', 'application/x-rar'],
        preview: ['audio/mpeg', 'audio/wav', 'audio/x-wav']
    },
    ALLOWED_EXTENSIONS: {
        artwork: ['jpg', 'jpeg', 'png', 'webp'],
        kit: ['zip', 'rar'],
        preview: ['mp3', 'wav']
    },
    LIMITS: {
        title: 100,
        description: 1000,
        tags: 3,
        tagLength: 30,
        genres: 3,
        moods: 5,
        instruments: 10,
        formats: 10
    }
};

const DATA = {
    GENRES: ['Trap', 'Hip Hop', 'R&B', 'Pop', 'Rock', 'Electronic', 'Lo-Fi', 'Drill', 'Afrobeats', 'Reggaeton', 'Jazz', 'Soul', 'House', 'Techno', 'Ambient', 'Dancehall', 'UK Drill', 'Latin', 'Country', 'Indie'],
    MOODS: ['Agresivo', 'Triste', 'Feliz', 'Romántico', 'Relajado', 'Motivador', 'Misterioso', 'Épico', 'Melancólico', 'Enérgico', 'Oscuro', 'Vibrante', 'Nostálgico', 'Inspirador', 'Intenso'],
    INSTRUMENTS: ['Kick', 'Snare', 'Hi-Hat', 'Clap', 'Tom', 'Cymbal', 'Percusión', 'Shaker', 'Conga', 'Bongo', 'Cowbell', 'Crash', 'Ride', 'Splash', 'China', '808', 'Rim', 'Tambourine'],
    FORMATS: ['WAV', 'MP3', 'AIFF', 'FLAC', 'OGG', 'DRUM', 'KONTAKT', 'SERATO', 'MASCHINE', 'SPARK', 'ADDICTIVE DRUMS', 'EZDRUMMER', 'SUPERIOR DRUMMER', 'STUDIO ONE', 'ABLETON', 'FL STUDIO', 'LOGIC PRO', 'CUBASE', 'PRO TOOLS']
};

/* ============================= */
/* ESTADO GLOBAL */
/* ============================= */

const state = {
    files: {
        artwork: null,
        kit: null,
        preview: null
    },
    selected: {
        genres: [],
        moods: [],
        instruments: [],
        formats: [],
        tags: []
    },
    collaborators: [],
    activeLicenses: ['non-exclusive'],
    isDirty: false,
    autoSaveTimer: null,
    searchTimeout: null
};

/* ============================= */
/* UTILIDADES */
/* ============================= */

const Utils = {
    // Formatear tamaño de archivo
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Obtener extensión de archivo
    getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
    },

    // Sanitizar nombre de archivo
    sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9._-]/gi, '_').substring(0, 255);
    },

    // Validar email
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    // Debounce
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Generar ID único
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Escapar HTML
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
};

/* ============================= */
/* TOAST NOTIFICATIONS */
/* ============================= */

const Toast = {
    show(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) {
            console.error('Toast container not found');
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        }[type] || 'fa-info-circle';

        toast.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${Utils.escapeHtml(message)}</span>
        `;

        container.appendChild(toast);

        // Auto remove después de 4 segundos
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }
};

/* ============================= */
/* MODAL */
/* ============================= */

const Modal = {
    show(title, message, onConfirm) {
        const overlay = document.getElementById('modalOverlay');
        const modalTitle = document.getElementById('modalTitle');
        const modalDescription = document.getElementById('modalDescription');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');
        const closeBtn = overlay.querySelector('.modal-close');

        if (!overlay || !modalTitle || !modalDescription) {
            console.error('Modal elements not found');
            return;
        }

        modalTitle.textContent = title;
        modalDescription.textContent = message;
        overlay.style.display = 'flex';

        // Event listeners
        const hide = () => {
            overlay.style.display = 'none';
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            closeBtn.onclick = null;
        };

        confirmBtn.onclick = () => {
            if (onConfirm) onConfirm();
            hide();
        };

        cancelBtn.onclick = hide;
        closeBtn.onclick = hide;

        // Click fuera del modal
        overlay.onclick = (e) => {
            if (e.target === overlay) hide();
        };

        // ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                hide();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }
};

/* ============================= */
/* LOADING */
/* ============================= */

const Loading = {
    show() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'flex';
    },

    hide() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'none';
    }
};

/* ============================= */
/* VALIDACIÓN */
/* ============================= */

const Validator = {
    // Validar archivo
    validateFile(file, type) {
        if (!file) {
            return { valid: false, error: 'No se seleccionó ningún archivo' };
        }

        const ext = Utils.getFileExtension(file.name);
        const allowedExts = CONFIG.ALLOWED_EXTENSIONS[type];
        const allowedTypes = CONFIG.ALLOWED_TYPES[type];
        const maxSize = CONFIG.MAX_FILE_SIZES[type];

        // Validar extensión
        if (!allowedExts.includes(ext)) {
            return {
                valid: false,
                error: `Extensión no permitida. Use: ${allowedExts.join(', ').toUpperCase()}`
            };
        }

        // Validar tipo MIME
        if (!allowedTypes.includes(file.type)) {
            return {
                valid: false,
                error: `Tipo de archivo no válido. Use: ${allowedExts.join(' o ').toUpperCase()}`
            };
        }

        // Validar tamaño
        if (file.size > maxSize) {
            return {
                valid: false,
                error: `El archivo excede el tamaño máximo de ${Utils.formatFileSize(maxSize)}`
            };
        }

        return { valid: true };
    },

    // Validar título
    validateTitle(title) {
        if (!title || title.trim().length === 0) {
            return { valid: false, error: 'El título es requerido' };
        }
        if (title.length > CONFIG.LIMITS.title) {
            return { valid: false, error: `El título no puede exceder ${CONFIG.LIMITS.title} caracteres` };
        }
        return { valid: true };
    },

    // Validar descripción
    validateDescription(desc) {
        if (desc.length > CONFIG.LIMITS.description) {
            return { valid: false, error: `La descripción no puede exceder ${CONFIG.LIMITS.description} caracteres` };
        }
        return { valid: true };
    },

    // Validar fecha
    validateReleaseDate(dateString) {
        if (!dateString) {
            return { valid: false, error: 'La fecha de lanzamiento es requerida' };
        }

        const selectedDate = new Date(dateString);
        const now = new Date();
        
        // Ajustar para comparar solo fecha sin horas
        now.setSeconds(0, 0);
        selectedDate.setSeconds(0, 0);

        if (selectedDate < now) {
            return { valid: false, error: 'La fecha de lanzamiento debe ser hoy o posterior' };
        }

        return { valid: true };
    },

    // Validar géneros
    validateGenres() {
        if (state.selected.genres.length === 0) {
            return { valid: false, error: 'Selecciona al menos un género' };
        }
        return { valid: true };
    },

    // Validar precio
    validatePrice(price, licenseName) {
        const priceNum = parseFloat(price);
        
        if (isNaN(priceNum) || priceNum < 0) {
            return { valid: false, error: 'El precio debe ser un número válido' };
        }

        // Licencias pagas no pueden ser $0
        if (licenseName !== 'free-archive' && priceNum === 0) {
            return { valid: false, error: 'Las licencias de pago deben tener un precio mayor a $0' };
        }

        if (priceNum > 10000) {
            return { valid: false, error: 'El precio no puede exceder $10,000' };
        }

        return { valid: true };
    },

    // Validar descuento
    validateDiscount(discountType, license, value, prices) {
        if (discountType === 'none') return { valid: true };

        if (!license) {
            return { valid: false, error: 'Selecciona una licencia para aplicar el descuento' };
        }

        const discountValue = parseFloat(value);
        if (isNaN(discountValue) || discountValue <= 0) {
            return { valid: false, error: 'El valor del descuento debe ser mayor a 0' };
        }

        const licensePrice = parseFloat(prices[license] || 0);

        if (discountType === 'percentage') {
            if (discountValue > 100) {
                return { valid: false, error: 'El descuento no puede ser mayor al 100%' };
            }
            if (discountValue === 100) {
                Toast.show('Un descuento del 100% es gratis. Considera marcar "Ofrecer gratis"', 'warning');
            }
        } else if (discountType === 'fixed') {
            if (discountValue >= licensePrice) {
                return {
                    valid: false,
                    error: `El descuento ($${discountValue.toFixed(2)}) no puede ser mayor o igual al precio ($${licensePrice.toFixed(2)})`
                };
            }
        }

        return { valid: true };
    },

    // Validar colaboradores
    validateCollaborators() {
        const total = state.collaborators.reduce((sum, c) => sum + c.percentage, 0);
        
        if (total > 100) {
            return { valid: false, error: `El total de regalías (${total}%) supera el 100%` };
        }

        return { valid: true };
    },

    // Validar términos
    validateTerms() {
        const terms = document.getElementById('termsCheckbox');
        const copyright = document.getElementById('copyrightCheckbox');
        const contentPolicy = document.getElementById('contentPolicyCheckbox');

        if (!terms || !copyright || !contentPolicy) {
            return { valid: false, error: 'Error al validar términos' };
        }

        if (!terms.checked || !copyright.checked || !contentPolicy.checked) {
            return { valid: false, error: 'Debes aceptar todos los términos y condiciones' };
        }

        return { valid: true };
    }
};

/* ============================= */
/* MANEJO DE ARCHIVOS */
/* ============================= */

const FileHandler = {
    // Inicializar
    init() {
        this.initArtwork();
        this.initKitFile();
        this.initPreviewFile();
    },

    // Artwork
    initArtwork() {
        const input = document.getElementById('artworkInput');
        const preview = document.getElementById('artworkPreview');
        const removeBtn = document.getElementById('removeArtworkBtn');

        if (!input || !preview) return;

        // Click en preview abre input
        preview.addEventListener('click', () => input.click());
        preview.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                input.click();
            }
        });

        // Cambio de archivo
        input.addEventListener('change', (e) => this.handleArtworkChange(e));

        // Botón remover
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeArtwork();
            });
        }

        // Drag & Drop
        preview.addEventListener('dragover', (e) => {
            e.preventDefault();
            preview.style.borderColor = 'var(--color-primary)';
        });

        preview.addEventListener('dragleave', () => {
            preview.style.borderColor = '';
        });

        preview.addEventListener('drop', (e) => {
            e.preventDefault();
            preview.style.borderColor = '';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                input.files = files;
                this.handleArtworkChange({ target: input });
            }
        });
    },

    handleArtworkChange(e) {
        const file = e.target.files[0];
        if (!file) return;

        const validation = Validator.validateFile(file, 'artwork');
        if (!validation.valid) {
            Toast.show(validation.error, 'error');
            e.target.value = '';
            return;
        }

        state.files.artwork = file;

        // Preview
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.getElementById('artworkImg');
            const placeholder = document.getElementById('artworkPlaceholder');
            const container = document.getElementById('artworkPreview');
            const removeBtn = document.getElementById('removeArtworkBtn');

            if (img && placeholder && container && removeBtn) {
                img.src = event.target.result;
                img.style.display = 'block';
                placeholder.style.display = 'none';
                container.classList.add('has-image');
                removeBtn.style.display = 'flex';
            }
        };
        reader.readAsDataURL(file);

        this.markDirty();
        Toast.show('Portada agregada correctamente', 'success');
    },

    removeArtwork() {
        const input = document.getElementById('artworkInput');
        const img = document.getElementById('artworkImg');
        const placeholder = document.getElementById('artworkPlaceholder');
        const container = document.getElementById('artworkPreview');
        const removeBtn = document.getElementById('removeArtworkBtn');

        state.files.artwork = null;

        if (input) input.value = '';
        if (img) {
            img.style.display = 'none';
            img.src = '';
        }
        if (placeholder) placeholder.style.display = 'flex';
        if (container) container.classList.remove('has-image');
        if (removeBtn) removeBtn.style.display = 'none';

        this.markDirty();
    },

    // Kit File
    initKitFile() {
        const input = document.getElementById('kitInput');
        const card = input?.closest('.file-upload-card');
        const content = card?.querySelector('.file-card-content');

        if (!input || !content) return;

        content.addEventListener('click', () => {
            if (!state.files.kit) input.click();
        });

        content.addEventListener('keypress', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !state.files.kit) {
                e.preventDefault();
                input.click();
            }
        });

        input.addEventListener('change', (e) => this.handleKitChange(e));
    },

    handleKitChange(e) {
        const file = e.target.files[0];
        if (!file) return;

        const validation = Validator.validateFile(file, 'kit');
        if (!validation.valid) {
            Toast.show(validation.error, 'error');
            e.target.value = '';
            return;
        }

        state.files.kit = file;

        // Actualizar UI
        const card = e.target.closest('.file-upload-card');
        const content = card?.querySelector('.file-card-content');
        const info = document.getElementById('kitFileInfo');
        const fileName = document.getElementById('kitFileName');
        const fileSize = document.getElementById('kitFileSize');

        if (content && info && fileName && fileSize) {
            content.classList.add('has-file');
            info.style.display = 'block';
            fileName.textContent = file.name;
            fileSize.textContent = Utils.formatFileSize(file.size);

            // Botón remover
            const removeBtn = info.querySelector('.remove-file-btn');
            if (removeBtn) {
                removeBtn.onclick = () => this.removeFile('kit');
            }
        }

        // Limpiar error si existía
        const errorMsg = document.getElementById('filesError');
        if (errorMsg) {
            errorMsg.classList.remove('show');
            errorMsg.textContent = '';
        }

        this.markDirty();
        Toast.show('Archivo principal agregado', 'success');
    },

    // Preview Audio
    initPreviewFile() {
        const input = document.getElementById('previewInput');
        const card = input?.closest('.file-upload-card');
        const content = card?.querySelector('.file-card-content');

        if (!input || !content) return;

        content.addEventListener('click', () => {
            if (!state.files.preview) input.click();
        });

        content.addEventListener('keypress', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !state.files.preview) {
                e.preventDefault();
                input.click();
            }
        });

        input.addEventListener('change', (e) => this.handlePreviewChange(e));
    },

    handlePreviewChange(e) {
        const file = e.target.files[0];
        if (!file) return;

        const validation = Validator.validateFile(file, 'preview');
        if (!validation.valid) {
            Toast.show(validation.error, 'error');
            e.target.value = '';
            return;
        }

        state.files.preview = file;

        // Actualizar UI
        const card = e.target.closest('.file-upload-card');
        const content = card?.querySelector('.file-card-content');
        const info = document.getElementById('previewFileInfo');
        const fileName = document.getElementById('previewFileName');
        const fileSize = document.getElementById('previewFileSize');
        const audio = document.getElementById('previewAudio');

        if (content && info && fileName && fileSize && audio) {
            content.classList.add('has-file');
            info.style.display = 'block';
            fileName.textContent = file.name;
            fileSize.textContent = Utils.formatFileSize(file.size);

            // Audio preview
            const reader = new FileReader();
            reader.onload = (event) => {
                audio.src = event.target.result;
                audio.style.display = 'block';
            };
            reader.readAsDataURL(file);

            // Botón remover
            const removeBtn = info.querySelector('.remove-file-btn');
            if (removeBtn) {
                removeBtn.onclick = () => this.removeFile('preview');
            }
        }

        this.markDirty();
        Toast.show('Audio de previsualización agregado', 'success');
    },

    removeFile(type) {
        const input = document.getElementById(type === 'kit' ? 'kitInput' : 'previewInput');
        const card = input?.closest('.file-upload-card');
        const content = card?.querySelector('.file-card-content');
        const info = document.getElementById(type === 'kit' ? 'kitFileInfo' : 'previewFileInfo');

        state.files[type] = null;

        if (input) input.value = '';
        if (content) content.classList.remove('has-file');
        if (info) info.style.display = 'none';

        // Limpiar audio si es preview
        if (type === 'preview') {
            const audio = document.getElementById('previewAudio');
            if (audio) {
                audio.pause();
                audio.src = '';
                audio.style.display = 'none';
            }
        }

        this.markDirty();
        Toast.show('Archivo eliminado', 'info');
    },

    markDirty() {
        state.isDirty = true;
        this.resetAutoSave();
    },

    resetAutoSave() {
        if (state.autoSaveTimer) {
            clearTimeout(state.autoSaveTimer);
        }
        state.autoSaveTimer = setTimeout(() => {
            DraftManager.autoSave();
        }, CONFIG.AUTO_SAVE_INTERVAL);
    }
};

/* ============================= */
/* MULTI SELECT */
/* ============================= */

const MultiSelect = {
    init() {
        this.initSelect('genres', DATA.GENRES, CONFIG.LIMITS.genres);
        this.initSelect('moods', DATA.MOODS, CONFIG.LIMITS.moods);
        this.initSelect('instruments', DATA.INSTRUMENTS, CONFIG.LIMITS.instruments);
        this.initSelect('formats', DATA.FORMATS, CONFIG.LIMITS.formats);
    },

    initSelect(id, options, maxItems) {
        const container = document.getElementById(`${id}Select`);
        if (!container) return;

        const display = container.querySelector('.multi-select-display');
        const dropdown = container.querySelector('.multi-select-dropdown');
        const search = container.querySelector('.multi-select-search');
        const optionsContainer = container.querySelector('.multi-select-options');

        if (!display || !dropdown || !optionsContainer) return;

        // Render options
        this.renderOptions(id, options, optionsContainer);

        // Toggle dropdown
        display.addEventListener('click', () => this.toggleDropdown(id));
        display.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleDropdown(id);
            }
        });

        // Search
        if (search) {
            search.addEventListener('input', (e) => {
                this.filterOptions(id, e.target.value);
            });
            search.addEventListener('click', (e) => e.stopPropagation());
        }
    },

    renderOptions(id, options, container) {
        container.innerHTML = options.map(option => `
            <div class="select-option" data-value="${Utils.escapeHtml(option)}" role="option">
                ${Utils.escapeHtml(option)}
            </div>
        `).join('');

        // Event listeners
        container.querySelectorAll('.select-option').forEach(opt => {
            opt.addEventListener('click', () => {
                this.toggleOption(id, opt.dataset.value);
            });
        });
    },

    toggleDropdown(id) {
        const container = document.getElementById(`${id}Select`);
        if (!container) return;

        const display = container.querySelector('.multi-select-display');
        const dropdown = container.querySelector('.multi-select-dropdown');

        if (!display || !dropdown) return;

        const isOpen = dropdown.style.display === 'block';

        // Cerrar todos los dropdowns
        this.closeAllDropdowns();

        if (!isOpen) {
            dropdown.style.display = 'block';
            display.classList.add('active');
            
            // Focus en search si existe
            const search = container.querySelector('.multi-select-search');
            if (search) setTimeout(() => search.focus(), 100);
        }
    },

    closeAllDropdowns() {
        document.querySelectorAll('.multi-select-dropdown').forEach(dd => {
            dd.style.display = 'none';
        });
        document.querySelectorAll('.multi-select-display').forEach(disp => {
            disp.classList.remove('active');
        });
    },

    toggleOption(id, value) {
        const key = id === 'formats' ? 'formats' : id === 'moods' ? 'moods' : id === 'instruments' ? 'instruments' : 'genres';
        const array = state.selected[key];
        const limits = {
            genres: CONFIG.LIMITS.genres,
            moods: CONFIG.LIMITS.moods,
            instruments: CONFIG.LIMITS.instruments,
            formats: CONFIG.LIMITS.formats
        };
        const maxItems = limits[key];

        const index = array.indexOf(value);

        if (index > -1) {
            // Remover
            array.splice(index, 1);
        } else {
            // Agregar si no excede límite
            if (array.length >= maxItems) {
                Toast.show(`Máximo ${maxItems} ${key} permitidos`, 'warning');
                return;
            }
            array.push(value);
        }

        this.updateDisplay(id, key);
        this.updateOptionsState(id, key);
        FileHandler.markDirty();

        // Limpiar error si es genres
        if (id === 'genres' && array.length > 0) {
            const errorMsg = document.getElementById('genresError');
            if (errorMsg) {
                errorMsg.classList.remove('show');
                errorMsg.textContent = '';
            }
        }
    },

    updateDisplay(id, key) {
        const container = document.getElementById(`${id}Select`);
        if (!container) return;

        const display = container.querySelector('.multi-select-display');
        if (!display) return;

        const array = state.selected[key];

        if (array.length === 0) {
            const placeholders = {
                genres: 'Selecciona hasta 3 géneros',
                moods: 'Selecciona hasta 5 moods',
                instruments: 'Selecciona instrumentos',
                formats: 'Selecciona formatos'
            };
            display.innerHTML = `<span class="multi-select-placeholder">${placeholders[key]}</span>`;
        } else {
            display.innerHTML = array.map(item => `
                <span class="select-tag">
                    ${Utils.escapeHtml(item)}
                    <span class="tag-remove" data-value="${Utils.escapeHtml(item)}">
                        <i class="fas fa-times"></i>
                    </span>
                </span>
            `).join('');

            // Event listeners para remover
            display.querySelectorAll('.tag-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleOption(id, btn.dataset.value);
                });
            });
        }
    },

    updateOptionsState(id, key) {
        const container = document.getElementById(`${id}Select`);
        if (!container) return;

        const array = state.selected[key];
        const options = container.querySelectorAll('.select-option');

        options.forEach(opt => {
            if (array.includes(opt.dataset.value)) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
    },

    filterOptions(id, query) {
        const container = document.getElementById(`${id}Select`);
        if (!container) return;

        const options = container.querySelectorAll('.select-option');
        const lowerQuery = query.toLowerCase();

        options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            opt.style.display = text.includes(lowerQuery) ? 'block' : 'none';
        });
    }
};

/* ============================= */
/* TAGS INPUT */
/* ============================= */

const TagsInput = {
    init() {
        const input = document.getElementById('tagsInput');
        if (!input) return;

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const value = input.value.trim();
                if (value) {
                    this.addTag(value);
                    input.value = '';
                }
            } else if (e.key === 'Backspace' && input.value === '') {
                // Remover último tag si input está vacío
                if (state.selected.tags.length > 0) {
                    this.removeTag(state.selected.tags.length - 1);
                }
            }
        });

        input.addEventListener('blur', () => {
            const value = input.value.trim();
            if (value) {
                this.addTag(value);
                input.value = '';
            }
        });
    },

    addTag(tagText) {
        const tag = tagText.toLowerCase().substring(0, CONFIG.LIMITS.tagLength);

        // Validaciones
        if (!tag) return;

        if (state.selected.tags.includes(tag)) {
            Toast.show('Este tag ya fue agregado', 'warning');
            return;
        }

        if (state.selected.tags.length >= CONFIG.LIMITS.tags) {
            Toast.show(`Máximo ${CONFIG.LIMITS.tags} tags permitidos`, 'warning');
            return;
        }

        // Validar caracteres
        if (!/^[a-z0-9áéíóúñ\s-]+$/i.test(tag)) {
            Toast.show('Los tags solo pueden contener letras, números, espacios y guiones', 'error');
            return;
        }

        state.selected.tags.push(tag);
        this.render();
        FileHandler.markDirty();
    },

    removeTag(index) {
        if (index >= 0 && index < state.selected.tags.length) {
            state.selected.tags.splice(index, 1);
            this.render();
            FileHandler.markDirty();
        }
    },

    render() {
        const container = document.getElementById('tagsContainer');
        const input = document.getElementById('tagsInput');
        if (!container || !input) return;

        // Limpiar contenedor
        container.innerHTML = '';

        // Renderizar tags
        state.selected.tags.forEach((tag, index) => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tag-item';
            tagEl.innerHTML = `
                ${Utils.escapeHtml(tag)}
                <span class="tag-item-remove" data-index="${index}">
                    <i class="fas fa-times"></i>
                </span>
            `;
            container.appendChild(tagEl);

            // Event listener para remover
            const removeBtn = tagEl.querySelector('.tag-item-remove');
            removeBtn.addEventListener('click', () => {
                this.removeTag(parseInt(removeBtn.dataset.index));
            });
        });

        // Re-agregar input
        container.appendChild(input);
    }
};

/* ============================= */
/* LICENCIAS */
/* ============================= */

const LicenseManager = {
    init() {
        // Licencia No Exclusiva
        const nonExclusiveCheckbox = document.getElementById('licenseNonExclusive');
        if (nonExclusiveCheckbox) {
            nonExclusiveCheckbox.addEventListener('change', (e) => {
                this.toggleLicense('non-exclusive', e.target.checked);
            });
        }

        // Licencia Exclusiva
        const exclusiveCheckbox = document.getElementById('licenseExclusive');
        if (exclusiveCheckbox) {
            exclusiveCheckbox.addEventListener('change', (e) => {
                this.toggleLicense('exclusive', e.target.checked);
            });
        }

        // Precios
        ['priceNonExclusive', 'priceExclusive'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('blur', (e) => this.validatePrice(e.target));
                input.addEventListener('input', () => FileHandler.markDirty());
            }
        });

        // Checkbox gratis
        const freeCheckbox = document.getElementById('freeCheckbox');
        if (freeCheckbox) {
            freeCheckbox.addEventListener('change', (e) => {
                this.toggleFreeMode(e.target.checked);
            });
        }
    },

    toggleLicense(license, active) {
        const item = document.querySelector(`.license-item[data-license="${license}"]`);
        if (!item) return;

        const isFree = document.getElementById('freeCheckbox')?.checked || false;

        if (active) {
            state.activeLicenses.push(license);
            item.classList.add('active');
        } else {
            // No permitir desactivar todas las licencias si no está en modo gratis
            if (state.activeLicenses.length === 1 && !isFree) {
                Toast.show('Debes tener al menos una licencia activa o marcar como gratis', 'error');
                const checkbox = item.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.checked = true;
                return;
            }

            const index = state.activeLicenses.indexOf(license);
            if (index > -1) {
                state.activeLicenses.splice(index, 1);
            }
            item.classList.remove('active');
        }

        // Ocultar alerta si hay licencias activas o es gratis
        const alert = document.getElementById('licenseAlert');
        if (alert && (state.activeLicenses.length > 0 || isFree)) {
            alert.style.display = 'none';
        }

        FileHandler.markDirty();
    },

    toggleFreeMode(isFree) {
        const section = document.getElementById('licensesSection');
        if (!section) return;

        if (isFree) {
            section.style.opacity = '0.5';
            section.style.pointerEvents = 'none';
            
            // Ocultar alerta
            const alert = document.getElementById('licenseAlert');
            if (alert) alert.style.display = 'none';

            // Resetear descuentos
            const discountNone = document.querySelector('input[name="discountType"][value="none"]');
            if (discountNone) {
                discountNone.checked = true;
                DiscountManager.toggleConfig('none');
            }
        } else {
            section.style.opacity = '1';
            section.style.pointerEvents = 'auto';

            // Asegurar al menos una licencia activa
            if (state.activeLicenses.length === 0) {
                state.activeLicenses.push('non-exclusive');
                const checkbox = document.getElementById('licenseNonExclusive');
                const item = document.querySelector('.license-item[data-license="non-exclusive"]');
                if (checkbox) checkbox.checked = true;
                if (item) item.classList.add('active');
            }
        }

        FileHandler.markDirty();
    },

    validatePrice(input) {
        let value = parseFloat(input.value);
        
        if (isNaN(value) || value < 0) {
            value = 0;
        } else if (value > 10000) {
            value = 10000;
            Toast.show('El precio máximo es $10,000', 'warning');
        }

        input.value = value.toFixed(2);
        FileHandler.markDirty();
    },

    getPrices() {
        return {
            'non-exclusive': parseFloat(document.getElementById('priceNonExclusive')?.value || 0),
            'exclusive': parseFloat(document.getElementById('priceExclusive')?.value || 0)
        };
    }
};

/* ============================= */
/* DESCUENTOS */
/* ============================= */

const DiscountManager = {
    init() {
        const radios = document.querySelectorAll('input[name="discountType"]');
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.toggleConfig(e.target.value);
            });
        });

        // Validación en tiempo real
        const valueInput = document.getElementById('discountValue');
        if (valueInput) {
            valueInput.addEventListener('input', Utils.debounce(() => {
                this.validateDiscount();
            }, CONFIG.DEBOUNCE_DELAY));
        }
    },

    toggleConfig(type) {
        const config = document.getElementById('discountConfig');
        const valueInput = document.getElementById('discountValue');
        const isFree = document.getElementById('freeCheckbox')?.checked || false;

        if (!config) return;

        if (type === 'none' || isFree) {
            config.style.display = 'none';
        } else {
            config.style.display = 'block';
            
            if (valueInput) {
                valueInput.placeholder = type === 'percentage' ? '0-100' : '$0.00';
            }
        }

        FileHandler.markDirty();
    },

    validateDiscount() {
        const type = document.querySelector('input[name="discountType"]:checked')?.value;
        if (type === 'none') return true;

        const license = document.getElementById('discountLicense')?.value;
        const value = document.getElementById('discountValue')?.value;
        const errorDiv = document.getElementById('discountError');

        if (!errorDiv) return true;

        const prices = LicenseManager.getPrices();
        const validation = Validator.validateDiscount(type, license, value, prices);

        if (!validation.valid) {
            errorDiv.textContent = validation.error;
            errorDiv.classList.add('show');
            return false;
        }

        errorDiv.classList.remove('show');
        errorDiv.textContent = '';
        return true;
    }
};

/* ============================= */
/* COLABORADORES */
/* ============================= */

const CollaboratorManager = {
    init() {
        const searchInput = document.getElementById('collabSearch');
        if (!searchInput) return;

        searchInput.addEventListener('input', Utils.debounce((e) => {
            this.search(e.target.value);
        }, CONFIG.DEBOUNCE_DELAY));

        // Cerrar dropdown al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-wrapper')) {
                this.closeDropdown();
            }
        });
    },

    async search(query) {
        const dropdown = document.getElementById('collabDropdown');
        const loading = dropdown?.querySelector('.autocomplete-loading');
        const results = dropdown?.querySelector('.autocomplete-results');
        const empty = dropdown?.querySelector('.autocomplete-empty');

        if (!dropdown || !loading || !results || !empty) return;

        // Limpiar timeout anterior
        if (state.searchTimeout) {
            clearTimeout(state.searchTimeout);
        }

        if (query.length < CONFIG.SEARCH_MIN_CHARS) {
            dropdown.style.display = 'none';
            return;
        }

        // Mostrar loading
        dropdown.style.display = 'block';
        loading.style.display = 'flex';
        results.style.display = 'none';
        empty.style.display = 'none';

        // Simular búsqueda (en producción sería una llamada API)
        state.searchTimeout = setTimeout(() => {
            const mockResults = this.getMockResults(query);

            loading.style.display = 'none';

            if (mockResults.length === 0) {
                empty.style.display = 'flex';
            } else {
                results.style.display = 'block';
                this.renderResults(mockResults, results);
            }
        }, 500);
    },

    getMockResults(query) {
        // Datos mock (en producción vendría de API)
        const mockUsers = [
            { id: 1, name: 'Juan Pérez', email: 'juan@offszn.com', username: 'juanbeats' },
            { id: 2, name: 'María García', email: 'maria@offszn.com', username: 'mariaproducer' },
            { id: 3, name: 'Carlos López', email: 'carlos@offszn.com', username: 'carlosmusic' },
            { id: 4, name: 'Ana Martínez', email: 'ana@offszn.com', username: 'anabeats' },
            { id: 5, name: 'Pedro Sánchez', email: 'pedro@offszn.com', username: 'pedroprod' }
        ];

        const lowerQuery = query.toLowerCase();
        return mockUsers.filter(user => 
            user.name.toLowerCase().includes(lowerQuery) ||
            user.email.toLowerCase().includes(lowerQuery) ||
            user.username.toLowerCase().includes(lowerQuery)
        );
    },

    renderResults(results, container) {
        container.innerHTML = results.map(user => {
            const initial = user.name.charAt(0).toUpperCase();
            return `
                <div class="autocomplete-item" data-user='${JSON.stringify(user)}'>
                    <div class="autocomplete-avatar">${initial}</div>
                    <div class="autocomplete-info">
                        <div class="autocomplete-name">${Utils.escapeHtml(user.name)}</div>
                        <div class="autocomplete-email">@${Utils.escapeHtml(user.username)}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Event listeners
        container.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const user = JSON.parse(item.dataset.user);
                this.addCollaborator(user);
            });
        });
    },

    addCollaborator(user) {
        // Verificar si ya está agregado
        if (state.collaborators.some(c => c.id === user.id)) {
            Toast.show('Este colaborador ya fue agregado', 'warning');
            return;
        }

        // Calcular porcentaje sugerido
        const totalUsed = state.collaborators.reduce((sum, c) => sum + c.percentage, 0);
        const remaining = 100 - totalUsed;
        const suggestedPercentage = Math.min(remaining, 50);

        if (suggestedPercentage <= 0) {
            Toast.show('Ya no hay porcentaje disponible para más colaboradores', 'error');
            return;
        }

        const collaborator = {
            id: user.id,
            name: user.name,
            username: user.username,
            percentage: suggestedPercentage
        };

        state.collaborators.push(collaborator);
        this.render();
        this.closeDropdown();

        // Limpiar búsqueda
        const searchInput = document.getElementById('collabSearch');
        if (searchInput) searchInput.value = '';

        FileHandler.markDirty();
        Toast.show(`${user.name} agregado como colaborador`, 'success');
    },

    removeCollaborator(id) {
        const index = state.collaborators.findIndex(c => c.id === id);
        if (index > -1) {
            const name = state.collaborators[index].name;
            state.collaborators.splice(index, 1);
            this.render();
            FileHandler.markDirty();
            Toast.show(`${name} eliminado`, 'info');
        }
    },

    updatePercentage(id, value) {
        const collab = state.collaborators.find(c => c.id === id);
        if (!collab) return;

        let percentage = parseInt(value);
        if (isNaN(percentage)) percentage = 0;
        if (percentage < 1) percentage = 1;
        if (percentage > 99) percentage = 99;

        collab.percentage = percentage;
        this.updateDisplay();
        FileHandler.markDirty();
    },

    render() {
        const list = document.getElementById('collabList');
        if (!list) return;

        if (state.collaborators.length === 0) {
            list.innerHTML = '';
            this.updateDisplay();
            return;
        }

        list.innerHTML = state.collaborators.map(collab => {
            const initial = collab.name.charAt(0).toUpperCase();
            return `
                <div class="collab-item" data-id="${collab.id}">
                    <div class="collab-avatar">${initial}</div>
                    <div class="collab-info">
                        <div class="collab-name">${Utils.escapeHtml(collab.name)}</div>
                        <div class="collab-role">@${Utils.escapeHtml(collab.username)}</div>
                    </div>
                    <div class="collab-percentage">
                        <input type="number" 
                               class="percentage-input" 
                               value="${collab.percentage}"
                               min="1"
                               max="99"
                               data-id="${collab.id}">
                        <span>%</span>
                    </div>
                    <button type="button" class="remove-collab-btn" data-id="${collab.id}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');

        // Event listeners
        list.querySelectorAll('.percentage-input').forEach(input => {
            input.addEventListener('change', (e) => {
                this.updatePercentage(parseInt(e.target.dataset.id), e.target.value);
            });
        });

        list.querySelectorAll('.remove-collab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeCollaborator(parseInt(btn.dataset.id));
            });
        });

        this.updateDisplay();
    },

    updateDisplay() {
        const display = document.getElementById('percentageDisplay');
        if (!display) return;

        const total = state.collaborators.reduce((sum, c) => sum + c.percentage, 0);
        const remaining = 100 - total;

        const label = display.querySelector('.percentage-label');
        const value = display.querySelector('.percentage-value');

        if (label && value) {
            if (remaining < 0) {
                display.classList.add('error');
                label.textContent = 'Error - Total excede:';
                value.textContent = `${total}%`;
            } else {
                display.classList.remove('error');
                label.textContent = 'Tu porcentaje de regalías:';
                value.textContent = `${remaining}%`;
            }
        }
    },

    closeDropdown() {
        const dropdown = document.getElementById('collabDropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
};

/* ============================= */
/* DRAFT MANAGER */
/* ============================= */

const DraftManager = {
    save() {
        try {
            const data = this.collectFormData();
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
            Toast.show('Borrador guardado correctamente', 'success');
            state.isDirty = false;
            
            setTimeout(() => {
                window.location.href = '../borradores.html';
            }, 1500);
        } catch (error) {
            console.error('Error saving draft:', error);
            Toast.show('Error al guardar el borrador', 'error');
        }
    },

    autoSave() {
        if (!state.isDirty) return;

        try {
            const data = this.collectFormData();
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
            console.log('Auto-save completed');
            state.isDirty = false;
        } catch (error) {
            console.error('Error auto-saving:', error);
        }
    },

    load() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (!saved) return;

            const data = JSON.parse(saved);
            
            // Cargar campos básicos
            if (data.title) {
                const titleInput = document.getElementById('titleInput');
                if (titleInput) titleInput.value = data.title;
            }

            if (data.description) {
                const descInput = document.getElementById('descInput');
                if (descInput) {
                    descInput.value = data.description;
                    FormHandlers.updateCharCount();
                }
            }

            if (data.type) {
                const typeSelect = document.getElementById('typeSelect');
                if (typeSelect) typeSelect.value = data.type;
            }

            if (data.releaseDate) {
                const dateInput = document.getElementById('releaseDateInput');
                if (dateInput) dateInput.value = data.releaseDate;
            }

            if (data.visibility) {
                const radio = document.querySelector(`input[name="visibility"][value="${data.visibility}"]`);
                if (radio) radio.checked = true;
            }

            if (data.sampleCount) {
                const sampleInput = document.getElementById('sampleCountInput');
                if (sampleInput) sampleInput.value = data.sampleCount;
            }

            // Cargar selecciones
            if (data.genres) {
                state.selected.genres = data.genres;
                MultiSelect.updateDisplay('genres', 'genres');
                MultiSelect.updateOptionsState('genres', 'genres');
            }

            if (data.moods) {
                state.selected.moods = data.moods;
                MultiSelect.updateDisplay('moods', 'moods');
                MultiSelect.updateOptionsState('moods', 'moods');
            }

            if (data.instruments) {
                state.selected.instruments = data.instruments;
                MultiSelect.updateDisplay('instruments', 'instruments');
                MultiSelect.updateOptionsState('instruments', 'instruments');
            }

            if (data.formats) {
                state.selected.formats = data.formats;
                MultiSelect.updateDisplay('formats', 'formats');
                MultiSelect.updateOptionsState('formats', 'formats');
            }

            if (data.tags) {
                state.selected.tags = data.tags;
                TagsInput.render();
            }

            // Cargar checkboxes
            if (data.hasSamples) {
                const checkbox = document.getElementById('hasSamplesCheckbox');
                if (checkbox) checkbox.checked = true;
            }

            if (data.bulkDiscount !== undefined) {
                const checkbox = document.getElementById('bulkDiscountCheckbox');
                if (checkbox) checkbox.checked = data.bulkDiscount;
            }

            // Cargar modo gratis
            if (data.isFree) {
                const checkbox = document.getElementById('freeCheckbox');
                if (checkbox) {
                    checkbox.checked = true;
                    LicenseManager.toggleFreeMode(true);
                }
            }

            // Cargar licencias
            if (data.activeLicenses) {
                state.activeLicenses = data.activeLicenses;
                
                // Actualizar UI de licencias
                const nonExCheckbox = document.getElementById('licenseNonExclusive');
                const exCheckbox = document.getElementById('licenseExclusive');
                
                if (nonExCheckbox) {
                    nonExCheckbox.checked = state.activeLicenses.includes('non-exclusive');
                    const item = document.querySelector('.license-item[data-license="non-exclusive"]');
                    if (item) item.classList.toggle('active', nonExCheckbox.checked);
                }
                
                if (exCheckbox) {
                    exCheckbox.checked = state.activeLicenses.includes('exclusive');
                    const item = document.querySelector('.license-item[data-license="exclusive"]');
                    if (item) item.classList.toggle('active', exCheckbox.checked);
                }
            }

            // Cargar precios
            if (data.prices) {
                if (data.prices['non-exclusive']) {
                    const input = document.getElementById('priceNonExclusive');
                    if (input) input.value = data.prices['non-exclusive'].toFixed(2);
                }
                if (data.prices['exclusive']) {
                    const input = document.getElementById('priceExclusive');
                    if (input) input.value = data.prices['exclusive'].toFixed(2);
                }
            }

            // Cargar descuento
            if (data.discount && data.discount.type !== 'none') {
                const radio = document.querySelector(`input[name="discountType"][value="${data.discount.type}"]`);
                if (radio) {
                    radio.checked = true;
                    DiscountManager.toggleConfig(data.discount.type);
                }

                if (data.discount.license) {
                    const select = document.getElementById('discountLicense');
                    if (select) select.value = data.discount.license;
                }

                if (data.discount.value) {
                    const input = document.getElementById('discountValue');
                    if (input) input.value = data.discount.value;
                }

                if (data.discount.expiry) {
                    const input = document.getElementById('discountExpiry');
                    if (input) input.value = data.discount.expiry;
                }
            }

            // Cargar colaboradores
            if (data.collaborators && data.collaborators.length > 0) {
                state.collaborators = data.collaborators;
                CollaboratorManager.render();
            }

            console.log('Draft loaded successfully');
            Toast.show('Borrador cargado', 'info');
        } catch (error) {
            console.error('Error loading draft:', error);
            Toast.show('Error al cargar el borrador', 'error');
        }
    },

    collectFormData() {
        const isFree = document.getElementById('freeCheckbox')?.checked || false;

        const data = {
            timestamp: new Date().toISOString(),
            title: document.getElementById('titleInput')?.value.trim() || '',
            description: document.getElementById('descInput')?.value.trim() || '',
            type: document.getElementById('typeSelect')?.value || 'drumkit',
            releaseDate: document.getElementById('releaseDateInput')?.value || '',
            visibility: document.querySelector('input[name="visibility"]:checked')?.value || 'public',
            sampleCount: document.getElementById('sampleCountInput')?.value || '',
            genres: [...state.selected.genres],
            moods: [...state.selected.moods],
            instruments: [...state.selected.instruments],
            formats: [...state.selected.formats],
            tags: [...state.selected.tags],
            hasSamples: document.getElementById('hasSamplesCheckbox')?.checked || false,
            isFree: isFree,
            activeLicenses: [...state.activeLicenses],
            prices: {},
            discount: null,
            bulkDiscount: document.getElementById('bulkDiscountCheckbox')?.checked || false,
            collaborators: state.collaborators.map(c => ({...c}))
        };

        // Precios
        if (!isFree) {
            data.prices['non-exclusive'] = parseFloat(document.getElementById('priceNonExclusive')?.value || 0);
            data.prices['exclusive'] = parseFloat(document.getElementById('priceExclusive')?.value || 0);
        }

        // Descuento
        const discountType = document.querySelector('input[name="discountType"]:checked')?.value;
        if (discountType && discountType !== 'none' && !isFree) {
            data.discount = {
                type: discountType,
                license: document.getElementById('discountLicense')?.value || '',
                value: parseFloat(document.getElementById('discountValue')?.value || 0),
                expiry: document.getElementById('discountExpiry')?.value || null
            };
        }

        return data;
    },

    clear() {
        try {
            localStorage.removeItem(CONFIG.STORAGE_KEY);
            console.log('Draft cleared');
        } catch (error) {
            console.error('Error clearing draft:', error);
        }
    }
};

/* ============================= */
/* FORM HANDLERS */
/* ============================= */

const FormHandlers = {
    init() {
        // Título
        const titleInput = document.getElementById('titleInput');
        if (titleInput) {
            titleInput.addEventListener('input', () => {
                FileHandler.markDirty();
                this.clearError('titleError');
            });
        }

        // Descripción
        const descInput = document.getElementById('descInput');
        if (descInput) {
            descInput.addEventListener('input', () => {
                this.updateCharCount();
                FileHandler.markDirty();
            });
        }

        // Fecha
        const dateInput = document.getElementById('releaseDateInput');
        if (dateInput) {
            dateInput.addEventListener('change', () => {
                FileHandler.markDirty();
                this.clearError('dateError');
            });
        }

        // Sample count
        const sampleInput = document.getElementById('sampleCountInput');
        if (sampleInput) {
            sampleInput.addEventListener('input', () => {
                FileHandler.markDirty();
            });
        }

        // Submit
        const form = document.getElementById('uploadForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit();
            });
        }

        // Save draft button
        const saveDraftBtn = document.getElementById('saveDraftBtn');
        if (saveDraftBtn) {
            saveDraftBtn.addEventListener('click', () => {
                DraftManager.save();
            });
        }

        // Inicializar fecha mínima
        this.initDateTime();
    },

    initDateTime() {
        const input = document.getElementById('releaseDateInput');
        if (!input) return;

        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        const minDateTime = now.toISOString().slice(0, 16);
        
        input.min = minDateTime;
        if (!input.value) {
            input.value = minDateTime;
        }
    },

    updateCharCount() {
        const descInput = document.getElementById('descInput');
        const charCount = document.getElementById('charCount');
        
        if (descInput && charCount) {
            charCount.textContent = descInput.value.length;
        }
    },

    clearError(errorId) {
        const errorDiv = document.getElementById(errorId);
        if (errorDiv) {
            errorDiv.classList.remove('show');
            errorDiv.textContent = '';
        }

        // Limpiar clase error del input asociado
        const inputId = errorId.replace('Error', 'Input');
        const input = document.getElementById(inputId);
        if (input) {
            input.classList.remove('error');
        }
    },

    showError(errorId, message) {
        const errorDiv = document.getElementById(errorId);
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.add('show');
        }

        // Agregar clase error al input asociado
        const inputId = errorId.replace('Error', 'Input');
        const input = document.getElementById(inputId);
        if (input) {
            input.classList.add('error');
        }
    },

    async handleSubmit() {
        // Limpiar errores previos
        document.querySelectorAll('.error-message').forEach(e => {
            e.classList.remove('show');
            e.textContent = '';
        });
        document.querySelectorAll('.error').forEach(e => {
            e.classList.remove('error');
        });

        let isValid = true;
        let firstError = null;

        // Validar título
        const titleInput = document.getElementById('titleInput');
        if (titleInput) {
            const validation = Validator.validateTitle(titleInput.value);
            if (!validation.valid) {
                this.showError('titleError', validation.error);
                if (!firstError) firstError = titleInput;
                isValid = false;
            }
        }

        // Validar descripción
        const descInput = document.getElementById('descInput');
        if (descInput) {
            const validation = Validator.validateDescription(descInput.value);
            if (!validation.valid) {
                Toast.show(validation.error, 'error');
                isValid = false;
            }
        }

        // Validar archivo principal
        if (!state.files.kit) {
            this.showError('filesError', 'Debes subir el archivo principal del kit');
            isValid = false;
        }

        // Validar géneros
        const genresValidation = Validator.validateGenres();
        if (!genresValidation.valid) {
            this.showError('genresError', genresValidation.error);
            isValid = false;
        }

        // Validar fecha
        const dateInput = document.getElementById('releaseDateInput');
        if (dateInput) {
            const validation = Validator.validateReleaseDate(dateInput.value);
            if (!validation.valid) {
                this.showError('dateError', validation.error);
                if (!firstError) firstError = dateInput;
                isValid = false;
            }
        }

        // Validar licencias
        const isFree = document.getElementById('freeCheckbox')?.checked || false;
        if (!isFree && state.activeLicenses.length === 0) {
            const alert = document.getElementById('licenseAlert');
            if (alert) alert.style.display = 'flex';
            Toast.show('Activa al menos una licencia o marca como gratis', 'error');
            isValid = false;
        }

        // Validar precios de licencias activas
        if (!isFree) {
            const prices = LicenseManager.getPrices();
            state.activeLicenses.forEach(license => {
                const validation = Validator.validatePrice(prices[license], license);
                if (!validation.valid) {
                    Toast.show(`Error en licencia ${license}: ${validation.error}`, 'error');
                    isValid = false;
                }
            });
        }

        // Validar descuento
        if (!DiscountManager.validateDiscount()) {
            isValid = false;
        }

        // Validar colaboradores
        const collabValidation = Validator.validateCollaborators();
        if (!collabValidation.valid) {
            Toast.show(collabValidation.error, 'error');
            isValid = false;
        }

        // Validar términos
        const termsValidation = Validator.validateTerms();
        if (!termsValidation.valid) {
            this.showError('termsError', termsValidation.error);
            isValid = false;
        }

        if (!isValid) {
            Toast.show('Por favor corrige los errores antes de continuar', 'error');
            
            // Scroll al primer error
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => firstError.focus(), 500);
            } else {
                const firstErrorDiv = document.querySelector('.error-message.show');
                if (firstErrorDiv) {
                    firstErrorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            return;
        }

        // Confirmar publicación
        Modal.show(
            'Confirmar Publicación',
            '¿Estás seguro de que deseas publicar este drum kit? Una vez publicado, será visible según la configuración de visibilidad que elegiste.',
            () => this.submitForm()
        );
    },

    async submitForm() {
        try {
            Loading.show();

            // Simular upload con progress
            const progressEl = document.getElementById('uploadProgress');
            const progressFill = document.getElementById('progressFill');
            const progressPercent = document.getElementById('progressPercent');
            const progressMessage = document.getElementById('progressMessage');

            if (progressEl) progressEl.style.display = 'block';

            // Simular progreso de subida
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 10;
                if (progress > 95) progress = 95;

                if (progressFill) progressFill.style.width = `${progress}%`;
                if (progressPercent) progressPercent.textContent = `${Math.round(progress)}%`;

                if (progress < 30) {
                    if (progressMessage) progressMessage.textContent = 'Subiendo portada...';
                } else if (progress < 60) {
                    if (progressMessage) progressMessage.textContent = 'Subiendo archivo principal...';
                } else if (progress < 90) {
                    if (progressMessage) progressMessage.textContent = 'Procesando archivos...';
                } else {
                    if (progressMessage) progressMessage.textContent = 'Finalizando...';
                }
            }, 200);

            // Recopilar datos
            const formData = DraftManager.collectFormData();

            // Agregar archivos al formData (en producción sería FormData real)
            formData.files = {
                artwork: state.files.artwork ? {
                    name: state.files.artwork.name,
                    size: state.files.artwork.size,
                    type: state.files.artwork.type
                } : null,
                kit: state.files.kit ? {
                    name: state.files.kit.name,
                    size: state.files.kit.size,
                    type: state.files.kit.type
                } : null,
                preview: state.files.preview ? {
                    name: state.files.preview.name,
                    size: state.files.preview.size,
                    type: state.files.preview.type
                } : null
            };

            // Simular llamada API (2-4 segundos)
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

            // Completar progreso
            clearInterval(progressInterval);
            if (progressFill) progressFill.style.width = '100%';
            if (progressPercent) progressPercent.textContent = '100%';
            if (progressMessage) progressMessage.textContent = '¡Completado!';

            // Éxito
            console.log('📦 Drum Kit publicado:', formData);

            // Limpiar borrador
            DraftManager.clear();

            // Mostrar éxito
            Loading.hide();
            Toast.show('¡Drum Kit publicado exitosamente!', 'success');

            // Redirigir después de 2 segundos
            setTimeout(() => {
                window.location.href = '../mis-kits.html';
            }, 2000);

        } catch (error) {
            console.error('Error al publicar:', error);
            Loading.hide();
            Toast.show('Error al publicar el drum kit. Por favor intenta nuevamente.', 'error');
        }
    }
};

/* ============================= */
/* NAVEGACIÓN */
/* ============================= */

const Navigation = {
    init() {
        // Cerrar dropdowns al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.navbar-dropdown')) {
                document.querySelectorAll('.navbar-dropdown .dropdown-menu').forEach(menu => {
                    menu.style.opacity = '0';
                    menu.style.visibility = 'hidden';
                });
            }

            if (!e.target.closest('.user-dropdown')) {
                document.querySelectorAll('.user-dropdown-menu').forEach(menu => {
                    menu.style.opacity = '0';
                    menu.style.visibility = 'hidden';
                });
            }

            if (!e.target.closest('.multi-select')) {
                MultiSelect.closeAllDropdowns();
            }
        });

        // ESC para cerrar modales y dropdowns
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                MultiSelect.closeAllDropdowns();
                CollaboratorManager.closeDropdown();
                
                const modalOverlay = document.getElementById('modalOverlay');
                if (modalOverlay && modalOverlay.style.display === 'flex') {
                    modalOverlay.style.display = 'none';
                }
            }
        });

        // Prevenir salida sin guardar
        window.addEventListener('beforeunload', (e) => {
            if (state.isDirty) {
                const message = 'Tienes cambios sin guardar. ¿Estás seguro de que deseas salir?';
                e.preventDefault();
                e.returnValue = message;
                return message;
            }
        });

        // Hamburger menu (mobile)
        const hamburger = document.querySelector('.navbar-hamburger');
        const navbarCenter = document.querySelector('.navbar-center');
        
        if (hamburger && navbarCenter) {
            hamburger.addEventListener('click', () => {
                navbarCenter.classList.toggle('mobile-active');
                hamburger.classList.toggle('active');
            });
        }
    }
};

/* ============================= */
/* ACCESSIBILITY */
/* ============================= */

const Accessibility = {
    init() {
        // Mejorar navegación por teclado
        this.enhanceKeyboardNavigation();
        
        // Anunciar cambios importantes
        this.setupAriaLive();
    },

    enhanceKeyboardNavigation() {
        // Tab navigation para custom elements
        const customElements = document.querySelectorAll('[role="button"], [role="listbox"]');
        
        customElements.forEach(el => {
            if (!el.hasAttribute('tabindex')) {
                el.setAttribute('tabindex', '0');
            }
        });

        // Enter/Space para activar elementos
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const target = e.target;
                
                if (target.matches('[role="button"]:not(button)')) {
                    e.preventDefault();
                    target.click();
                }
            }
        });
    },

    setupAriaLive() {
        // El toast container ya tiene aria-live="polite"
        // Los error messages ya tienen role="alert"
    }
};

/* ============================= */
/* INICIALIZACIÓN */
/* ============================= */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎵 OFFSZN Drum Kit Upload - Initializing...');

    try {
        // Inicializar componentes
        FileHandler.init();
        MultiSelect.init();
        TagsInput.init();
        LicenseManager.init();
        DiscountManager.init();
        CollaboratorManager.init();
        FormHandlers.init();
        Navigation.init();
        Accessibility.init();

        // Cargar borrador si existe
        DraftManager.load();

        console.log('✅ Initialization complete');
    } catch (error) {
        console.error('❌ Initialization error:', error);
        Toast.show('Error al inicializar la página. Por favor recarga.', 'error');
    }
});

/* ============================= */
/* ERROR HANDLING GLOBAL */
/* ============================= */

window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    Toast.show('Ha ocurrido un error inesperado', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    Toast.show('Error en operación asíncrona', 'error');
});

/* ============================= */
/* EXPORT (para testing) */
/* ============================= */

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        Utils,
        Validator,
        Toast,
        Modal,
        Loading,
        FileHandler,
        MultiSelect,
        TagsInput,
        LicenseManager,
        DiscountManager,
        CollaboratorManager,
        DraftManager,
        FormHandlers
    };
}
