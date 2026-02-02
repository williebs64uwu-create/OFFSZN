
let currentUser = null;
let currentProfileData = null;
let cropper = null; // Store cropper instance

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Initial State Check
    // Use the global client initialized by auth-utils.js
    if (!window.supabaseClient) {
        console.error("Critical: Global Supabase not found in account-settings.js. Ensure auth-utils.js is loaded.");
        return;
    }

    const { data: { session } } = await window.supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = '/pages/login.html';
        return;
    }

    currentUser = session.user;

    // 2. Load User Data
    await loadUserData();

    // 3. Setup Listeners
    setupFormListeners();

    // 4. Setup Avatar Listeners (New Manager)
    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
        avatarInput.addEventListener('change', AvatarManager.handleFileSelect);
    }
});

async function loadUserData() {
    try {
        const { data, error } = await window.supabaseClient
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;
        currentProfileData = data;

        // POPULATE SIDEBAR
        document.getElementById('sidebarName').textContent = data.nickname || (data.first_name ? `${data.first_name} ${data.last_name || ''}` : 'Usuario');
        document.getElementById('sidebarRole').textContent = data.role || 'Sin rol';

        // Handle Sidebar Avatar
        const sidebarAvatar = document.getElementById('sidebarAvatar');
        if (data.avatar_url) {
            sidebarAvatar.innerHTML = `<img src="${data.avatar_url}" alt="Avatar">`;
            sidebarAvatar.classList.add('has-image');
        } else {
            sidebarAvatar.innerHTML = (data.nickname || data.email || 'U').charAt(0).toUpperCase();
            sidebarAvatar.classList.remove('has-image');
        }

        const fName = document.getElementById('firstName');
        if (fName) fName.value = data.first_name || '';

        const lName = document.getElementById('lastName');
        if (lName) lName.value = data.last_name || '';

        const nick = document.getElementById('nickname');
        if (nick) nick.value = data.nickname || '';

        const mail = document.getElementById('email');
        if (mail) mail.value = data.email || ''; // Readonly

        // POPULATE BIO
        const bioEl = document.getElementById('bio');
        if (bioEl) {
            bioEl.value = data.bio || '';
            const bioCounter = document.getElementById('bioCounter');
            if (bioCounter) bioCounter.textContent = `${(data.bio || '').length}/500`;
        }

        // Handle Form Avatar
        const formAvatar = document.getElementById('formAvatar');
        if (formAvatar) {
            if (data.avatar_url) {
                formAvatar.innerHTML = `<img src="${data.avatar_url}" alt="Avatar">`;
            } else {
                formAvatar.innerHTML = (data.nickname || data.email || 'U').charAt(0).toUpperCase();
            }
        }

        // POPULATE DROPDOWNS (Role & Experience)
        if (data.role) {
            setSelectValue('role', data.role);
        }
        if (data.experience && data.experience.length > 0) {
            // Setup robust matching for array or string
            const expVal = Array.isArray(data.experience) ? data.experience[0] : (data.experience || '');
            setSelectValue('experience', expVal);
        }

        // POPULATE SOCIALS (Removed Website)
        if (data.socials) {
            const ig = document.getElementById('instagram');
            if (ig) ig.value = data.socials.instagram || '';
            const tk = document.getElementById('tiktok');
            if (tk) tk.value = data.socials.tiktok || '';
            const yt = document.getElementById('youtube');
            if (yt) yt.value = data.socials.youtube || '';
            const sp = document.getElementById('spotify');
            if (sp) sp.value = data.socials.spotify || '';
        }

    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

// Helper: match select option robustly
function setSelectValue(id, value) {
    const select = document.getElementById(id);
    if (!select || !value) return;

    // Exact match
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === value) {
            select.selectedIndex = i;
            return;
        }
    }

    // Partial match fallback (e.g. "Principiante" matches "Principiante (0-1 year)")
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value.includes(value) || value.includes(select.options[i].value)) {
            select.selectedIndex = i;
            return;
        }
    }
}

function setupFormListeners() {
    // 1. Account Form
    const accountForm = document.getElementById('accountForm');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const nickInput = document.getElementById('nickname');
    const accountSubmitBtn = accountForm?.querySelector('button[type="submit"]');

    if (accountForm) {
        accountForm.addEventListener('submit', (e) => saveProfileChanges(e, 'account'));
    }

    // 2. Profile Form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', (e) => saveProfileChanges(e, 'profile'));
    }

    // 3. Socials Form
    const socialsForm = document.getElementById('socialsForm');
    if (socialsForm) {
        socialsForm.addEventListener('submit', (e) => saveProfileChanges(e, 'socials'));
    }

    // 4. Password Form
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', changePassword);
    }

    // 5. Bio Counter & Sanitization (Optional)
    const bioInput = document.getElementById('bio');
    if (bioInput) {
        bioInput.addEventListener('input', () => {
            const val = bioInput.value;
            if (val.length > 500) {
                bioInput.value = val.substring(0, 500);
            }
            const counter = document.getElementById('bioCounter');
            if (counter) {
                counter.textContent = `${bioInput.value.length}/500`;
                counter.style.color = bioInput.value.length >= 500 ? '#ef4444' : '#a1a1aa';
            }
        });
    }

    // 6. Profile Inputs Refinement

    setupSocialListeners();
    setupPasswordListeners();
    setupPasswordToggles();

    function syncCounters() {
        // First Name Counter
        const fnVal = firstNameInput.value;
        const fnCounter = document.getElementById('firstNameCounter');
        if (fnCounter) {
            fnCounter.textContent = `${fnVal.length}/25`;
            fnCounter.style.color = fnVal.length === 25 ? '#ef4444' : '#a1a1aa';
        }

        // Last Name Counter
        const lnVal = lastNameInput.value;
        const lnCounter = document.getElementById('lastNameCounter');
        if (lnCounter) {
            lnCounter.textContent = `${lnVal.length}/25`;
            lnCounter.style.color = lnVal.length === 25 ? '#ef4444' : '#a1a1aa';
        }

        // Nickname Counter
        const nickVal = nickInput.value;
        const nickCounter = document.getElementById('nicknameCounter');
        if (nickCounter) {
            nickCounter.textContent = `${nickVal.length}/30`;
            nickCounter.style.color = nickVal.length === 30 ? '#ef4444' : '#a1a1aa';
        }
    }

    // SANITIZATION: Strict Nickname Logic
    function sanitizeNickname() {
        let val = nickInput.value;
        const sanitized = val.toLowerCase().replace(/[^a-z0-9._-]/g, '');
        if (sanitized !== val) {
            nickInput.value = sanitized;
        }
        syncCounters();
    }

    if (nickInput) {
        nickInput.addEventListener('input', () => {
            sanitizeNickname();
            clearTimeout(timeout);
            const val = nickInput.value.trim();

            // Initial feedback
            const status = document.getElementById('nicknameStatus');
            if (val.length < 3 && val.length > 0) {
                status.textContent = "Mínimo 3 caracteres";
                status.style.color = "#ef4444";
                if (accountSubmitBtn) accountSubmitBtn.disabled = true;
            } else if (val.length === 0) {
                status.textContent = "";
                if (accountSubmitBtn) accountSubmitBtn.disabled = true;
            } else {
                if (accountSubmitBtn) accountSubmitBtn.disabled = true; // Wait for server check
                timeout = setTimeout(() => checkNickname(val, accountSubmitBtn), 500);
            }
        });
    }

    [firstNameInput, lastNameInput].forEach(input => {
        if (input) {
            input.addEventListener('input', syncCounters);
        }
    });

    // Initial sync
    setTimeout(syncCounters, 500);

    // Initial Bio call if present
    if (bioInput) {
        const counter = document.getElementById('bioCounter');
        if (counter) counter.textContent = `${bioInput.value.length}/500`;
    }

    // 6. Forgot Password (Trigger Recovery)
    const btnForgotPassword = document.getElementById('btnForgotPassword');
    if (btnForgotPassword) {
        btnForgotPassword.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!currentUser || !currentUser.email) return;

            if (confirm(`¿Enviar un correo de recuperación a ${currentUser.email}?`)) {
                const { error } = await window.supabaseClient.auth.resetPasswordForEmail(currentUser.email, {
                    redirectTo: window.location.origin + '/pages/update-password.html',
                });
                if (error) alert("Error: " + error.message);
                else alert("Correo enviado. Revisa tu bandeja de entrada.");
            }
        });
    }
}

/* ==================== AVATAR MANAGER (Crop & Upload) ==================== */
window.AvatarManager = {
    fileToUpload: null,

    handleFileSelect: (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate Type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            alert("Solo se permiten imágenes (JPG, PNG, WEBP, GIF).");
            return;
        }

        // Show Premium Modal for GIFs (Upsell)
        if (file.type === 'image/gif') {
            // Rudimentary check for 'is_premium' could be added here
            // document.getElementById('premiumModal').style.display = 'flex';
        }

        // Prepare Cropper
        const reader = new FileReader();
        reader.onload = (event) => {
            const image = document.getElementById('cropImage');
            image.src = event.target.result;

            // Show Modal
            document.getElementById('cropModal').style.display = 'flex';

            // Init Cropper (Destroy old if exists)
            if (cropper) {
                cropper.destroy();
            }

            cropper = new Cropper(image, {
                aspectRatio: 1, // Square/Circle
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 1,
                restore: false,
                guides: false,
                center: false,
                highlight: false,
                cropBoxMovable: false,
                cropBoxResizable: false,
                toggleDragModeOnDblclick: false,
                background: false, // Dark theme
            });
        };
        reader.readAsDataURL(file);
    },

    rotate: (degree) => {
        if (cropper) cropper.rotate(degree);
    },

    zoom: (ratio) => {
        if (cropper) cropper.zoom(ratio);
    },

    closeCropModal: () => {
        document.getElementById('cropModal').style.display = 'none';
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        document.getElementById('avatarInput').value = ''; // Reset input
    },

    saveCrop: async () => {
        if (!cropper) return;

        // Get canvas
        const canvas = cropper.getCroppedCanvas({
            width: 400, // Optimized size
            height: 400,
            imageSmoothingQuality: 'high',
        });

        // Convert to Blob
        canvas.toBlob(async (blob) => {
            if (!blob) {
                alert("Error al recortar la imagen.");
                return;
            }

            // Close Modal & Start Upload
            AvatarManager.closeCropModal();
            await AvatarManager.uploadToSupabase(blob);
        }, 'image/jpeg', 0.9);
    },

    uploadToSupabase: async (fileBlob) => {
        // Show Loading State

        try {
            // 1. DELETE OLD AVATAR IF EXISTS
            if (currentProfileData.avatar_url && currentProfileData.avatar_url.includes('/avatars/')) {
                const segments = currentProfileData.avatar_url.split('/avatars/');
                if (segments.length > 1) {
                    const oldFileName = segments[1].split('?')[0]; // Remove query params
                    // console.log("Deleting old avatar:", oldFileName);
                    await window.supabaseClient.storage.from('avatars').remove([oldFileName]);
                }
            }

            // 2. UPLOAD NEW
            const fileName = `${currentUser.id}_${Date.now()}.jpg`; // Force JPG from crop
            const { error: uploadError } = await window.supabaseClient.storage
                .from('avatars')
                .upload(fileName, fileBlob, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) {
                // RLS Error Handling
                if (uploadError.statusCode === "403" || uploadError.message.includes("row-level security")) {
                    alert("Error de permisos: No puedes subir archivos. Contacta soporte.");
                    console.error("RLS Error:", uploadError);
                    return;
                }
                throw uploadError;
            }

            const { data: { publicUrl } } = window.supabaseClient.storage.from('avatars').getPublicUrl(fileName);

            // 3. UPDATE DB
            const { error: updateError } = await window.supabaseClient
                .from('users')
                .update({ avatar_url: publicUrl })
                .eq('id', currentUser.id);

            if (updateError) throw updateError;

            // 4. SUCCESS
            // Update local state immediately
            currentProfileData.avatar_url = publicUrl;

            // Visual Update
            const formAvatar = document.getElementById('formAvatar');
            const sidebarAvatar = document.getElementById('sidebarAvatar');
            const navAvatar = document.getElementById('user-avatar-display');

            const imgTag = `<img src="${publicUrl}" alt="Avatar">`;
            formAvatar.innerHTML = imgTag;
            sidebarAvatar.innerHTML = imgTag;
            sidebarAvatar.classList.add('has-image');

            // Should also update Navbar avatar if possible (DIRECT DOM UPDATE)
            if (navAvatar) {
                navAvatar.innerHTML = imgTag;
                navAvatar.classList.remove('user-avatar-placeholder');
            }

            // Navbar dropdown large avatar
            const navDropAvatar = document.querySelector('.user-dropdown-avatar-lg');
            if (navDropAvatar) {
                navDropAvatar.innerHTML = imgTag;
            }

            alert("Imagen de perfil actualizada.");

        } catch (err) {
            console.error(err);
            alert("Ocurrió un error al subir la imagen.");
        }
    }
};

/* ==================== FORM SUBMISSION LOGIC ==================== */

async function saveProfileChanges(e, type) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
        let updates = {};

        // === 1. ACCOUNT FORM ===
        if (type === 'account') {
            const first_name = document.getElementById('firstName').value.trim();
            const last_name = document.getElementById('lastName').value.trim();
            const nickname = document.getElementById('nickname').value.trim();

            if (!nickname) throw new Error("El nombre de usuario es obligatorio.");
            if (nickname.length > 30) throw new Error("Nombre de usuario máximo 30 caracteres.");
            if (first_name.length > 25) throw new Error("Nombre máximo 25 caracteres.");
            if (last_name.length > 25) throw new Error("Apellido máximo 25 caracteres.");
            if (!/^[a-z0-9._-]+$/.test(nickname)) throw new Error("Usuario inválido (solo a-z, 0-9, . , _)");

            // USERNAME CHANGE LIMIT
            if (nickname !== currentProfileData.nickname) {
                const today = new Date().toISOString().split('T')[0];
                let { last_nick_change, nick_changes_today } = currentUser.user_metadata || {};

                if (last_nick_change !== today) {
                    nick_changes_today = 0; // Reset
                }

                if (nick_changes_today >= 3) {
                    throw new Error("Has alcanzado el límite de 3 cambios de nombre por día.");
                }

                const { data: existing } = await window.supabaseClient
                    .from('users')
                    .select('id')
                    .eq('nickname', nickname)
                    .maybeSingle();

                if (existing) throw new Error("Este nombre de usuario ya está ocupado.");

                await window.supabaseClient.auth.updateUser({
                    data: {
                        last_nick_change: today,
                        nick_changes_today: (nick_changes_today || 0) + 1
                    }
                });
            }

            updates = { first_name, last_name, nickname };
        }

        // === 2. PROFILE FORM ===
        if (type === 'profile') {
            const role = document.getElementById('role').value;
            const expEl = document.getElementById('experience');
            const experience = expEl ? expEl.value : null;

            if (!role) throw new Error("Selecciona tu rol principal.");

            // Save experience as ARRAY (Postgres text[])
            updates = {
                role,
                bio: document.getElementById('bio') ? document.getElementById('bio').value.trim() : currentProfileData.bio
            };
            if (experience) {
                updates.experience = [experience];
            }
        }

        // === 3. SOCIALS FORM ===
        if (type === 'socials') {
            const socials = {
                instagram: document.getElementById('instagram').value.trim(),
                tiktok: document.getElementById('tiktok').value.trim(),
                youtube: document.getElementById('youtube').value.trim(),
                spotify: document.getElementById('spotify').value.trim(),
                // Website field removed
            };
            updates = { socials };
        }

        // EXECUTE UPDATE
        const { error } = await window.supabaseClient
            .from('users')
            .update(updates)
            .eq('id', currentUser.id);

        if (error) throw error;

        // SUCCESS FEEDBACK
        // Update local data
        currentProfileData = { ...currentProfileData, ...updates };

        // Inline Success logic can be added here
        alert("Cambios guardados correctamente.");

        // Refresh specific UI parts if needed
        if (updates.first_name || updates.nickname) {
            document.getElementById('sidebarName').textContent = updates.nickname || updates.first_name;
        }
        if (updates.role) {
            document.getElementById('sidebarRole').textContent = updates.role;
        }

    } catch (err) {
        alert(err.message || "Error al guardar cambios.");
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function changePassword(e) {
    e.preventDefault();
    const currentPass = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;

    if (!currentPass || !newPass || !confirmPass) {
        showInlineError('error-password', "Todos los campos son obligatorios.");
        return;
    }

    if (newPass !== confirmPass) {
        showInlineError('error-password', "Las contraseñas nuevas no coinciden.");
        return;
    }

    if (newPass.length < 6) {
        showInlineError('error-password', "La nueva contraseña debe tener al menos 6 caracteres.");
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
        // VERIFY CURRENT PASSWORD via Re-Auth
        const { error: authError } = await window.supabaseClient.auth.signInWithPassword({
            email: currentUser.email,
            password: currentPass
        });

        if (authError) {
            showInlineError('error-password', "La contraseña actual es incorrecta.");
            return;
        }

        // UPDATE PASSWORD
        await window.supabaseClient.auth.updateUser({ password: newPass });

        // Success feedback
        const form = document.getElementById('passwordForm');
        form.reset();

        const statusSpan = document.getElementById('error-password');
        if (statusSpan) {
            statusSpan.textContent = "Contraseña actualizada correctamente.";
            statusSpan.style.color = "#22c55e"; // Green
            statusSpan.classList.add('active');
            setTimeout(() => {
                statusSpan.textContent = '';
                statusSpan.classList.remove('active');
                statusSpan.style.color = ''; // Reset
            }, 5000);
        } else {
            alert("Contraseña actualizada correctamente.");
        }
    } catch (err) {
        showInlineError('error-password', err.message);
    } finally {
        btn.disabled = false;
    }
}


async function checkNickname(nick, submitBtn) {
    const status = document.getElementById('nicknameStatus');
    const RESERVED_USERNAMES = [
        'admin', 'administrator', 'root', 'webmaster', 'support', 'help', 'info',
        'api', 'dashboard', 'login', 'register', 'auth', 'user', 'users',
        'css', 'script', 'js', 'images', 'img', 'assets', 'pages', 'public',
        'offszn', 'official', 'server', 'database', 'undefined', 'null', 'test',
        '404', 'robots', 'sitemap', 'favicon', 'home', 'account', 'settings',
        'billing', 'shop', 'cart', 'checkout', 'orders', 'products', 'studio'
    ];

    if (nick.length < 3) {
        status.textContent = "Mínimo 3 caracteres";
        status.style.color = "#ef4444";
        if (submitBtn) submitBtn.disabled = true;
        return;
    }

    if (RESERVED_USERNAMES.includes(nick)) {
        status.textContent = "Nombre de usuario no permitido";
        status.style.color = "#ef4444";
        if (submitBtn) submitBtn.disabled = true;
        return;
    }

    if (nick === currentProfileData?.nickname) {
        status.textContent = "Tu nombre actual";
        status.style.color = "#a1a1aa";
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    status.textContent = "Comprobando...";
    status.style.color = "#a1a1aa";
    if (submitBtn) submitBtn.disabled = true;

    try {
        const { data } = await window.supabaseClient
            .from('users')
            .select('id')
            .ilike('nickname', nick)
            .maybeSingle();

        if (data) {
            status.textContent = "No disponible";
            status.style.color = "#ef4444";
            if (submitBtn) submitBtn.disabled = true;
        } else {
            status.textContent = "Disponible";
            status.style.color = "#22c55e";
            if (submitBtn) submitBtn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        status.textContent = "Error al verificar";
        if (submitBtn) submitBtn.disabled = false; // Allow try anyway
    }
}

// HELPERS
function showInlineError(id, msg) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = msg;
        el.classList.add('active');
        el.style.color = '#ef4444';
    }
}

// SOCIALS VALIDATION
function setupSocialListeners() {
    const inputs = {
        instagram: document.getElementById('instagram'),
        tiktok: document.getElementById('tiktok'),
        youtube: document.getElementById('youtube'),
        spotify: document.getElementById('spotify')
    };

    if (inputs.instagram) {
        inputs.instagram.addEventListener('blur', (e) => {
            let val = e.target.value.trim();
            if (val.includes('instagram.com/')) {
                const parts = val.split('instagram.com/');
                if (parts[1]) {
                    val = parts[1].split('/')[0].split('?')[0]; // Clean params
                }
            }
            if (val && !val.startsWith('@') && !val.startsWith('http')) {
                // Assuming it's a username if it's not a link
                // val = '@' + val; // Optional: Force @ prefix
            }
            e.target.value = val;
        });
    }

    if (inputs.tiktok) {
        inputs.tiktok.addEventListener('blur', (e) => {
            let val = e.target.value.trim();
            if (val.includes('tiktok.com/@')) {
                val = val.split('tiktok.com/@')[1].split('/')[0].split('?')[0];
            } else if (val.includes('tiktok.com/')) {
                val = val.split('tiktok.com/')[1].split('/')[0].split('?')[0];
            }
            e.target.value = val;
        });
    }

    if (inputs.youtube) {
        inputs.youtube.addEventListener('input', (e) => { // Changed to input for real-time
            const val = e.target.value.trim();
            const errorEl = document.getElementById('error-youtube');

            if (val && !val.startsWith('http')) {
                errorEl.textContent = "Por favor ingresa una URL válida (https://...)";
                errorEl.classList.add('active');
                errorEl.style.color = '#ef4444';
            } else {
                errorEl.textContent = "";
                errorEl.classList.remove('active');
            }
        });
    }

    if (inputs.spotify) {
        inputs.spotify.addEventListener('input', (e) => { // Changed to input for real-time
            const val = e.target.value.trim();
            const errorEl = document.getElementById('error-spotify');

            if (val && !val.startsWith('http')) {
                errorEl.textContent = "Por favor ingresa una URL válida (https://...)";
                errorEl.classList.add('active');
                errorEl.style.color = '#ef4444';
            } else {
                errorEl.textContent = "";
                errorEl.classList.remove('active');
            }
        });
    }
}

// PASSWORD VALIDATION
function setupPasswordListeners() {
    const newPassInput = document.getElementById('newPassword');
    const confirmPassInput = document.getElementById('confirmPassword');
    const errorMatch = document.getElementById('error-password-match');

    function checkMatch() {
        const p1 = newPassInput.value;
        const p2 = confirmPassInput.value;

        if (p2.length > 0) {
            if (p1 !== p2) {
                errorMatch.textContent = "Las contraseñas no coinciden";
                errorMatch.style.color = "#ef4444";
                errorMatch.classList.add('active');
            } else {
                errorMatch.textContent = "¡Coinciden!";
                errorMatch.style.color = "#22c55e"; // Green
                errorMatch.classList.add('active');
            }
        } else {
            errorMatch.textContent = "";
            errorMatch.classList.remove('active');
        }
    }

    if (newPassInput && confirmPassInput) {
        newPassInput.addEventListener('input', checkMatch);
        confirmPassInput.addEventListener('input', checkMatch);
    }
}

// PASSWORD VISIBILITY TOGGLE
function setupPasswordToggles() {
    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', function () {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);

            if (input.type === 'password') {
                input.type = 'text';
                this.classList.remove('bi-eye-slash');
                this.classList.add('bi-eye'); // Open eye = Visible
            } else {
                input.type = 'password';
                this.classList.remove('bi-eye');
                this.classList.add('bi-eye-slash'); // Slashed eye = Hidden
            }
        });
    });
}
