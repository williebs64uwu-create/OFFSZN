/**
 * AvatarManager - Shared component for OFFSZN
 * Handles avatar cropping, previewing, and uploading to Supabase.
 */

window.AvatarManager = {
    cropper: null,
    currentBlob: null,
    onSuccess: null,

    /**
     * Initialize the manager and inject necessary HTML/CSS if not present
     */
    init: function () {
        if (document.getElementById('cropModal')) return;

        const modalHtml = `
            <div id="cropModal" class="avatar-modal-overlay" style="display: none;">
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

                    <div class="avatar-modal-controls">
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
                        <button class="ctrl-btn btn-change-source" onclick="AvatarManager.triggerFileInput()" title="Cambiar Imagen">
                            <i class="bi bi-image"></i> Elegir Archivo
                        </button>
                    </div>

                    <div class="pro-upsell-lite">
                        <i class="bi bi-info-circle"></i>
                        <span>Solo se permiten formatos <b>PNG y JPG</b></span>
                    </div>

                    <div class="avatar-modal-footer">
                        <button class="avatar-btn-cancel" onclick="AvatarManager.close()">Cancelar</button>
                        <button class="avatar-btn-save" onclick="AvatarManager.save()">Guardar Avatar</button>
                    </div>
                </div>
                <!-- Hidden input for file selection -->
                <input type="file" id="avatarHiddenInput" style="display: none;" accept="image/png, image/jpeg" onchange="AvatarManager.handleFileSelect(event)">
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    /**
     * Open the modal with a specific image URL (current or local)
     */
    open: function (imageUrl, callback) {
        this.init();
        this.onSuccess = callback;

        const modal = document.getElementById('cropModal');
        const img = document.getElementById('avatarCropImg');

        modal.style.display = 'flex';
        // Subtler transition: Hide until cropper is ready
        img.style.opacity = '0';
        img.src = imageUrl || '';

        if (this.cropper) {
            this.cropper.destroy();
        }

        // Initialize Cropper logic
        img.onload = () => {
            if (!img.src || img.src.includes('undefined')) return;

            // If already exists, just show it (or it might have been replaced)
            if (this.cropper) {
                img.style.opacity = '1';
                return;
            }

            this.cropper = new Cropper(img, {
                aspectRatio: 1,
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
                ready: () => {
                    img.style.opacity = '1'; // Show when ready
                }
            });
        };
    },

    handleFileSelect: function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            const msg = "Formato no soportado. Por favor sube solo PNG o JPG.";
            this.showToast(msg, true);
            e.target.value = ""; // Clear input
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.getElementById('avatarCropImg');

            if (this.cropper) {
                // IMPORTANT: replace() already handles updating the underlying img src
                // and refreshing the UI. We avoid setting img.src directly to prevent 
                // re-triggering the img.onload behavior.
                this.cropper.replace(event.target.result);
            } else {
                img.src = event.target.result;
            }
            // Reset input so choosing the SAME file again triggers onchange
            e.target.value = "";
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

    rotate: function (deg) {
        if (this.cropper) this.cropper.rotate(deg);
    },

    zoom: function (ratio) {
        if (this.cropper) this.cropper.zoom(ratio);
    },

    close: function () {
        const modal = document.getElementById('cropModal');
        if (modal) modal.style.display = 'none';
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
    },

    save: async function () {
        if (!this.cropper) return;

        const canvas = this.cropper.getCroppedCanvas({
            width: 400,
            height: 400,
            imageSmoothingQuality: 'high'
        });

        if (!canvas) {
            console.error("AvatarManager: Failed to get cropped canvas.");
            this.showToast("Error al procesar imagen", true);
            return;
        }

        canvas.toBlob(async (blob) => {
            if (!blob) {
                console.error("AvatarManager: Canvas toBlob failed.");
                this.showToast("Error al procesar imagen", true);
                return;
            }
            this.close();

            if (this.onSuccess) {
                this.onSuccess(blob);
            } else {
                // Default upload logic if no callback provided
                await this.uploadDefault(blob);
            }
        }, 'image/jpeg', 0.9);
    },

    uploadDefault: async function (blob) {
        if (!window.supabaseClient) {
            alert("Error: Supabase no inicializado.");
            return;
        }

        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) return;

        try {
            const userId = session.user.id;

            // 1. Fetch current profile to find old avatar for cleanup
            const { data: profile } = await window.supabaseClient
                .from('users')
                .select('avatar_url')
                .eq('id', userId)
                .single();

            const oldUrl = profile?.avatar_url;
            const fileName = `${userId}_${Date.now()}.jpg`;

            // 2. Upload to storage
            const { error: uploadError } = await window.supabaseClient.storage
                .from('avatars')
                .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

            if (uploadError) throw uploadError;

            // 3. Get public URL
            const { data: { publicUrl } } = window.supabaseClient.storage.from('avatars').getPublicUrl(fileName);

            // 4. Update user profile
            const { error: updateError } = await window.supabaseClient
                .from('users')
                .update({ avatar_url: publicUrl })
                .eq('id', userId);

            if (updateError) throw updateError;

            // 5. STORAGE CLEANUP: Delete old avatar from bucket
            if (oldUrl) {
                const bucketUrl = window.supabaseClient.storage.from('avatars').getPublicUrl('').data.publicUrl;
                if (oldUrl.includes(bucketUrl)) {
                    const oldFileName = oldUrl.split('/').pop();
                    if (oldFileName && oldFileName !== fileName) {
                        try {
                            console.log("🗑️ AvatarManager: Silently cleaning up old avatar:", oldFileName);
                            const { error: delErr } = await window.supabaseClient.storage.from('avatars').remove([oldFileName]);
                            if (delErr) throw delErr;
                            console.log("✅ AvatarManager: Old avatar deleted.");
                        } catch (cleanErr) {
                            console.warn("AvatarManager: Cleanup error (non-fatal):", cleanErr);
                        }
                    }
                }
            }

            if (publicUrl) {
                // INSTANT FEEDBACK: Set flag and reload immediately
                localStorage.setItem('avatar_update_success', 'true');
                window.location.reload();
            } else {
                this.showToast("Error al subir el avatar.", true);
            }

        } catch (err) {
            console.error("Upload error:", err);
            this.showToast("Error al subir el avatar.", true);
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
     * If the avatar is external (e.g. Google), download and re-upload to our own bucket
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
            const bucketUrl = window.supabaseClient.storage.from('avatars').getPublicUrl('').data.publicUrl;

            // Check if URL is NOT already in our bucket
            if (!url.includes(bucketUrl) && (url.startsWith('http') || url.startsWith('https'))) {
                console.log("🛠️ AvatarManager: Internalizing external avatar...", url);

                const response = await fetch(url);
                const blob = await response.blob();

                if (blob) {
                    const userId = session.user.id;
                    const fileName = `${userId}_migrated_${Date.now()}.jpg`;

                    const { error: uploadError } = await window.supabaseClient.storage
                        .from('avatars')
                        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = window.supabaseClient.storage.from('avatars').getPublicUrl(fileName);

                    const { error: updateError } = await window.supabaseClient
                        .from('users')
                        .update({ avatar_url: publicUrl })
                        .eq('id', userId);

                    if (updateError) throw updateError;

                    console.log("✅ AvatarManager: Avatar internalized successfully.");
                    // Update cache to prevent flickering
                    localStorage.setItem('offszn_cached_avatar', publicUrl);
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
