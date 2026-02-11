/**
 * AvatarManager - Shared component for OFFSZN
 * Handles avatar cropping, previewing, and uploading to Cloudinary.
 * Pro users can upload GIF avatars (up to 20MB).
 */

window.AvatarManager = {
    cropper: null,
    currentBlob: null,
    originalFile: null,     // Stores the original file (used for GIF upload path)
    isCurrentFileGif: false, // Tracks if current file in cropper is a GIF
    onSuccess: null,
    isProUser: false,

    /**
     * Initialize the manager and inject necessary HTML/CSS if not present
     */
    init: async function () {
        // Check Pro plan status
        try {
            if (window.supabaseClient) {
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                if (session) {
                    const { data: profile } = await window.supabaseClient
                        .from('profiles')
                        .select('plan')
                        .eq('id', session.user.id)
                        .maybeSingle();
                    this.isProUser = profile?.plan === 'pro';
                }
            }
        } catch (e) {
            console.warn('AvatarManager: Could not check plan status');
        }

        if (document.getElementById('offsznAvatarModal')) {
            // Update GIF section visibility
            const gifSection = document.getElementById('avatarGifSection');
            if (gifSection && this.isProUser) {
                gifSection.style.display = 'block';
            }
            return;
        }

        const modalHtml = `
            <div id="offsznAvatarModal" class="avatar-modal-overlay" style="display: none;">
                <div class="avatar-modal-content">
                    <div class="avatar-modal-header">
                        <h3>Editar Avatar</h3>
                        <button class="avatar-close-btn" onclick="AvatarManager.close()">&times;</button>
                    </div>
                    
                    <div class="avatar-modal-body">
                        <div class="avatar-crop-container">
                            <img id="avatarCropImg" src="" alt="Cropper">
                        </div>
                    </div>

                    <div class="avatar-modal-controls" style="display: flex; flex-direction: column; gap: 16px; align-items: center; padding: 20px 24px;">
                        <!-- Edit Controls (Hidden until upload, appears ABOVE) -->
                        <div id="avatarEditControls" style="display: none; gap: 12px; align-items: center; justify-content: center; width: 100%; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                            <div class="control-group">
                                <button onclick="AvatarManager.rotate(-90)" class="ctrl-btn" title="Rotar Izquierda">
                                    <i class="bi bi-arrow-counterclockwise"></i>
                                </button>
                                <button onclick="AvatarManager.rotate(90)" class="ctrl-btn" title="Rotar Derecha">
                                    <i class="bi bi-arrow-clockwise"></i>
                                </button>
                            </div>
                            <div class="control-group">
                                <button onclick="AvatarManager.zoom(0.1)" class="ctrl-btn" title="Acercar">
                                    <i class="bi bi-zoom-in"></i>
                                </button>
                                <button onclick="AvatarManager.zoom(-0.1)" class="ctrl-btn" title="Alejar">
                                    <i class="bi bi-zoom-out"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Initial Selection Buttons (STAYS IN POSITION) -->
                        <div id="avatarUploadButtons" style="display: flex; gap: 12px; width: 100%; justify-content: center; flex-wrap: nowrap;">
                            <button class="ctrl-btn btn-change-source" onclick="AvatarManager.triggerFileInput()" style="flex: 1; min-width: 140px; height: 44px; border-radius: 10px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1);">
                                <i class="bi bi-image"></i> Subir Imagen
                            </button>
                            
                            <div class="avatar-gif-section" id="avatarGifSection" style="display:none; flex: 1; min-width: 140px;">
                                <button class="ctrl-btn btn-gif-upload" onclick="AvatarManager.triggerGifInput()" style="background:#7c3aed11; border:1px solid #7c3aed44; color:#a78bfa; width:100%; height:44px; padding:0 10px; border-radius:10px; font-size:13px; cursor:pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    <i class="bi bi-filetype-gif"></i> Subir GIF <span style="background:#7c3aed;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;">PRO</span>
                                </button>
                                <input type="file" id="avatarGifInput" style="display:none;" accept=".gif" onchange="AvatarManager.handleGifSelect(event)">
                            </div>
                        </div>
                    </div>

                    <div class="avatar-modal-footer">
                        <button class="avatar-btn-cancel" onclick="AvatarManager.close()">Cancelar</button>
                        <button id="avatarSaveBtn" class="avatar-btn-save" onclick="AvatarManager.save()" style="display: none;">Guardar Avatar</button>
                    </div>
                </div>
                <!-- Hidden input for file selection (Strict: JPG, PNG, JFIF) -->
                <input type="file" id="avatarHiddenInput" style="display: none;" accept=".jpg, .jpeg, .png, .jfif" onchange="AvatarManager.handleFileSelect(event)">
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show GIF section for Pro users
        if (this.isProUser) {
            const gifSection = document.getElementById('avatarGifSection');
            if (gifSection) gifSection.style.display = 'block';
        }
    },

    /**
     * Open the modal with a specific image URL (current or local)
     */
    open: async function (imageUrl, callback) {
        await this.init();
        this.onSuccess = callback;

        const modal = document.getElementById('offsznAvatarModal');
        const img = document.getElementById('avatarCropImg');

        if (!modal) {
            console.error("AvatarManager: Modal not found. Initializing again...");
            await this.init();
        }

        const activeModal = document.getElementById('offsznAvatarModal');
        if (activeModal) activeModal.style.display = 'flex';

        // Visibility Reset
        const uploadButtons = document.getElementById('avatarUploadButtons');
        const editControls = document.getElementById('avatarEditControls');
        const saveBtn = document.getElementById('avatarSaveBtn');

        if (uploadButtons) uploadButtons.style.display = 'flex';
        if (editControls) editControls.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'none';

        // 🔥 UPLOAD ONLY MODE
        // Mostramos el modal listo para recibir un archivo nuevo.
        img.style.display = imageUrl ? 'block' : 'none';
        img.style.opacity = '1'; // Removed opacity for clear view
        img.src = imageUrl || ''; // Mostramos la actual pero "bloqueada"
        img.style.width = 'auto'; // Reset dims
        img.style.height = 'auto';
        this.originalFile = null;

        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }

        // El cropper SOLO se iniciará cuando el usuario elija un archivo nuevo
        // en 'handleFileSelect' o 'handleGifSelect'.
    },

    handleFileSelect: function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/jfif'];

        // GIF check: This button is ONLY for regular images
        if (isGif) {
            this.showToast('Usa el botón GIF para subir animaciones.', true);
            e.target.value = '';
            return;
        }

        const isJfif = file.name.toLowerCase().endsWith('.jfif');
        if (!validTypes.includes(file.type) && !isJfif) {
            this.showToast('Solo se aceptan JPG, PNG o JFIF.', true);
            e.target.value = '';
            return;
        }

        // Size check (30MB)
        if (file.size > 30 * 1024 * 1024) {
            this.showToast(`El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)}MB (máx. 30MB)`, true);
            e.target.value = '';
            return;
        }

        // Store original file + type
        this.originalFile = file;
        this.isCurrentFileGif = isGif;

        // Load into cropper
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.getElementById('avatarCropImg');
            img.style.opacity = '1';
            img.style.display = 'block';

            if (this.cropper) {
                this.cropper.replace(event.target.result);
            } else {
                img.src = event.target.result;
                this.cropper = new Cropper(img, {
                    aspectRatio: 1,
                    initialAspectRatio: 1,
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 0.8,
                    restore: false,
                    guides: false,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                    background: false,
                    checkOrientation: true,
                    ready: () => {
                        img.style.opacity = '1';
                    }
                });
            }

            // Switch to Edit Mode
            const uploadButtons = document.getElementById('avatarUploadButtons');
            const editControls = document.getElementById('avatarEditControls');
            const saveBtn = document.getElementById('avatarSaveBtn');

            if (uploadButtons) uploadButtons.style.display = 'flex';
            if (editControls) editControls.style.display = 'flex';
            if (saveBtn) saveBtn.style.display = 'block';

            e.target.value = '';
        };
        reader.readAsDataURL(file);
    },

    triggerFileInput: function () {
        const input = document.getElementById('avatarHiddenInput');
        if (input) {
            input.value = ""; // Clear to allow same-file selection
            input.click();
        }
    },

    // 🔥 GIF AVATAR (Pro Only)
    triggerGifInput: function () {
        const input = document.getElementById('avatarGifInput');
        if (input) {
            input.value = '';
            input.click();
        }
    },

    handleGifSelect: async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'image/gif' && !file.name.toLowerCase().endsWith('.gif')) {
            this.showToast('Solo se permiten archivos GIF en este botón.', true);
            e.target.value = '';
            return;
        }

        if (file.size > 30 * 1024 * 1024) {
            const fileMB = (file.size / (1024 * 1024)).toFixed(1);
            this.showToast(`El GIF pesa ${fileMB}MB (máx. 30MB)`, true);
            return;
        }

        // 🔥 Load GIF into cropper (same as regular images)
        this.originalFile = file;
        this.isCurrentFileGif = true;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.getElementById('avatarCropImg');
            img.style.opacity = '1';
            img.style.display = 'block';

            if (this.cropper) {
                this.cropper.replace(event.target.result);
            } else {
                img.src = event.target.result;
                this.cropper = new Cropper(img, {
                    aspectRatio: 1,
                    initialAspectRatio: 1,
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 0.8,
                    restore: false,
                    guides: false,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                    background: false,
                    checkOrientation: true,
                    ready: () => {
                        img.style.opacity = '1';
                    }
                });
            }

            // Switch to Edit Mode
            const uploadButtons = document.getElementById('avatarUploadButtons');
            const editControls = document.getElementById('avatarEditControls');
            const saveBtn = document.getElementById('avatarSaveBtn');

            if (uploadButtons) uploadButtons.style.display = 'flex';
            if (editControls) editControls.style.display = 'flex';
            if (saveBtn) saveBtn.style.display = 'block';

            e.target.value = '';
        };
        reader.readAsDataURL(file);
    },

    rotate: function (deg) {
        if (this.cropper) this.cropper.rotate(deg);
    },

    zoom: function (ratio) {
        if (this.cropper) this.cropper.zoom(ratio);
    },

    close: function () {
        const modal = document.getElementById('offsznAvatarModal');
        if (modal) modal.style.display = 'none';
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
        this.originalFile = null;
        this.isCurrentFileGif = false;
    },

    save: async function () {
        // 🔥 VALIDACIÓN ESTRICTA: Siempre debe haber un archivo nuevo
        if (!this.originalFile) {
            this.showToast('Por favor, selecciona una imagen nueva para subir.', true);
            return;
        }

        if (!this.cropper) return;

        // Grab state BEFORE close() clears it
        const file = this.originalFile;
        const isGif = this.isCurrentFileGif;
        const cropData = this.cropper.getData(true); // rounded pixel values

        // 🔥 PIXEL-PERFECT PATH: Round everything to integers
        const crop = {
            x: Math.round(Math.max(0, cropData.x)),
            y: Math.round(Math.max(0, cropData.y)),
            width: Math.round(cropData.width),
            height: Math.round(cropData.height)
        };

        console.log('📦 Pixel-Perfect Crop Data:', crop, 'isGif:', isGif);

        this.close();
        const reader = new FileReader();
        reader.onload = async (event) => {
            if (this.onSuccess) {
                const resp = await fetch(event.target.result);
                const blob = await resp.blob();
                this.onSuccess(blob);
            } else {
                await this.uploadToCloudinary(event.target.result, isGif, file.size, crop);
            }
        };
        reader.readAsDataURL(file);
    },

    // Core Cloudinary upload method
    uploadToCloudinary: async function (base64Image, isGif = false, fileSize = 0, crop = null) {
        if (!window.supabaseClient) {
            this.showToast('Error: Supabase no inicializado.', true);
            return;
        }

        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) {
            this.showToast('Sesión expirada. Recarga la página.', true);
            return;
        }

        try {
            this.showToast(base64Image ? 'Subiendo avatar...' : 'Actualizando recorte...');

            const body = {
                image: base64Image, // May be null for re-crop
                isGif: isGif,
                fileSize: fileSize,
                crop: crop
            };

            const response = await fetch('/api/cloudinary/avatar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.upgrade) {
                    this.showToast('Los avatars GIF son exclusivos del Plan Pro', true);
                    return;
                }
                throw new Error(data.error || 'Error al subir avatar');
            }

            if (data.success && data.url) {
                localStorage.setItem('avatar_update_success', 'true');
                window.location.reload();
            } else {
                this.showToast('Error al subir el avatar.', true);
            }

        } catch (err) {
            console.error('Upload error:', err);
            this.showToast(err.message || 'Error al subir el avatar.', true);
        }
    },

    /**
     * Elite Toast Notification (Based on cupones.html design)
     */
    showToast: function (message, isError = false) {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);

            if (!document.getElementById('toastStyles')) {
                const style = document.createElement('style');
                style.id = 'toastStyles';
                style.textContent = `
                    .toast-container {
                        position: fixed;
                        bottom: 30px;
                        right: 30px;
                        z-index: 9999;
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                        align-items: flex-end;
                        pointer-events: none;
                    }
                    .elite-toast {
                        background: #0F0F0F;
                        border: 1px solid #333;
                        color: #fff;
                        padding: 12px 20px;
                        border-radius: 12px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        font-size: 14px;
                        font-weight: 500;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                        min-width: 250px;
                        justify-content: center;
                        opacity: 0;
                        animation: toastSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                        pointer-events: auto;
                    }
                    .elite-toast.success { border-color: rgba(16, 185, 129, 0.2); }
                    .elite-toast.success i { color: #10B981; }
                    .elite-toast.error { border-color: rgba(239, 68, 68, 0.2); }
                    .elite-toast.error i { color: #EF4444; }
                    @keyframes toastSlideUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `;
                document.head.appendChild(style);
            }
        }

        const toast = document.createElement('div');
        toast.className = `elite-toast ${isError ? 'error' : 'success'}`;
        const icon = isError ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill';
        toast.innerHTML = `<i class="bi ${icon}"></i> <span>${message}</span>`;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s, transform 0.3s';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    /**
     * Handle broken images by falling back to a letter placeholder
     */
    handleError: function (img, nickname) {
        if (!img) return;
        const initial = (nickname || 'U').charAt(0).toUpperCase();

        const parent = img.parentElement;
        if (parent) {
            parent.innerHTML = `<span>${initial}</span>`;
            // Re-apply common placeholder styles if needed
            parent.classList.add('user-avatar-placeholder');
        }
    },

    /**
     * If the avatar is external (e.g. Google), download and re-upload to Cloudinary.
     * This ensures the avatar is preserved permanently.
     */
    maybeInternalize: async function (session) {
        if (!session || !session.user || !window.supabaseClient) return;

        try {
            const { data: profile } = await window.supabaseClient
                .from('users')
                .select('avatar_url, nickname')
                .eq('id', session.user.id)
                .single();

            if (!profile || !profile.avatar_url) return;

            const url = profile.avatar_url;

            // Already on our storage (Supabase bucket OR Cloudinary) — skip
            if (url.includes('supabase.co') || url.includes('cloudinary.com')) return;

            // External URL (e.g. Google) — internalize to Cloudinary
            if (url.startsWith('http') || url.startsWith('https')) {
                console.log("🛠️ AvatarManager: Internalizing external avatar to Cloudinary...", url);

                const response = await fetch(url);
                const blob = await response.blob();

                if (blob) {
                    // Convert to base64 and upload via Cloudinary API
                    const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.readAsDataURL(blob);
                    });

                    const avatarRes = await fetch('/api/cloudinary/avatar', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({
                            image: base64,
                            isGif: false,
                            fileSize: blob.size
                        })
                    });

                    const data = await avatarRes.json();
                    if (avatarRes.ok && data.success) {
                        console.log("✅ AvatarManager: Avatar internalized to Cloudinary successfully.");
                        localStorage.setItem('offszn_cached_avatar', data.url);
                    }
                }
            }
        } catch (err) {
            console.warn("AvatarManager: Failed to internalize avatar", err);
        }
    }
};

// Auto-check for success flags after reload
(function () {
    const successFlag = localStorage.getItem('avatar_update_success');
    if (successFlag === 'true') {
        // Short delay to ensure DOM is ready and animations are smooth
        setTimeout(() => {
            if (window.AvatarManager && window.AvatarManager.showToast) {
                window.AvatarManager.showToast("Avatar actualizado");
                localStorage.removeItem('avatar_update_success');
            }
        }, 300);
    }
})();
