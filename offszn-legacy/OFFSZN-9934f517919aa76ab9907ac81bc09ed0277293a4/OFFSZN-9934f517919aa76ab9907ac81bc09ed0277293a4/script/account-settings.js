
/**
 * UTILS: Sanitization
 */
function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

let currentUser = null;
let currentProfileData = null;
let cropper = null; // Store cropper instance

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Inject Skeletons IMMEDIATELY
    injectSkeletons();

    // Use the global client initialized by auth-utils.js
    if (!window.supabaseClient) {
        // console.error("Critical: Global Supabase not found in account-settings.js. Ensure auth-utils.js is loaded.");
        return;
    }

    const { data: { session } } = await window.supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = '/pages/login.html';
        return;
    }

    currentUser = session.user;

    // 2. Start Minimum Wait Timer (2s)
    const timerPromise = new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Start Data Fetching
    const fetchPromise = loadUserData();

    // 4. Wait for BOTH (Timer + Data) to finish
    try {
        await Promise.all([timerPromise, fetchPromise]);
    } catch (err) {
        // console.error("Error during parallel load:", err);
    } finally {
        // 5. Render and Reveal Everything Simultaneously
        renderUserData();
        removeSkeletons();

        // 6. Setup Listeners
        setupFormListeners();
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
    } catch (err) {
        // console.error("Error loading profile:", err);
    }
}

function renderUserData() {
    if (!currentProfileData) return;
    const data = currentProfileData;

    // POPULATE SIDEBAR
    const sidebarName = document.getElementById('sidebarName');
    const sidebarRole = document.getElementById('sidebarRole');
    const sidebarAvatar = document.getElementById('sidebarAvatar');

    if (sidebarName) sidebarName.textContent = data.nickname || (data.first_name ? `${data.first_name} ${data.last_name || ''}` : 'Usuario');
    if (sidebarRole) sidebarRole.textContent = data.role || 'Sin rol';

    if (sidebarAvatar) {
        sidebarAvatar.innerHTML = '';
        if (data.avatar_url) {
            const img = document.createElement('img');
            img.src = data.avatar_url;
            img.alt = "Avatar";
            // crossorigin removed to prevent CORS issues with signed R2/Supabase URLs
            // img.crossOrigin = "anonymous";
            sidebarAvatar.appendChild(img);
            sidebarAvatar.classList.add('has-image');
        } else {
            sidebarAvatar.textContent = (data.nickname || data.email || 'U').charAt(0).toUpperCase();
            sidebarAvatar.classList.remove('has-image');
        }
    }

    // POPULATE FORMS
    const fName = document.getElementById('firstName');
    if (fName) fName.value = data.first_name || '';

    const lName = document.getElementById('lastName');
    if (lName) lName.value = data.last_name || '';

    const nick = document.getElementById('nickname');
    if (nick) nick.value = data.nickname || '';

    const mail = document.getElementById('email');
    if (mail) mail.value = data.email || '';

    const bioEl = document.getElementById('bio');
    if (bioEl) {
        bioEl.value = data.bio || '';
        const bioCounter = document.getElementById('bioCounter');
        if (bioCounter) bioCounter.textContent = `${(data.bio || '').length}/500`;
    }

    const formAvatar = document.getElementById('formAvatar');
    if (formAvatar) {
        formAvatar.innerHTML = '';
        if (data.avatar_url) {
            const img = document.createElement('img');
            img.src = data.avatar_url;
            img.alt = "Avatar";
            // img.crossOrigin = "anonymous";
            formAvatar.appendChild(img);
        } else {
            formAvatar.textContent = (data.nickname || data.email || 'U').charAt(0).toUpperCase();
        }
    }

    if (data.role) setSelectValue('role', data.role);
    if (data.experience && data.experience.length > 0) {
        const expVal = Array.isArray(data.experience) ? data.experience[0] : (data.experience || '');
        setSelectValue('experience', expVal);
    }

    if (data.socials) {
        const socials = data.socials;
        const ig = document.getElementById('instagram');
        if (ig) ig.value = socials.instagram || '';
        const tk = document.getElementById('tiktok');
        if (tk) tk.value = socials.tiktok || '';
        const yt = document.getElementById('youtube');
        if (yt) yt.value = socials.youtube || '';
        const sp = document.getElementById('spotify');
        if (sp) sp.value = socials.spotify || '';

        const pp = document.getElementById('paypalEmail');
        if (pp) pp.value = data.paypal_email || '';
    }

    // POPULATE REFERRAL CODE
    const refCode = document.getElementById('refCodeDisplay');
    if (refCode) {
        refCode.textContent = data.referral_code || 'Generando...';
        
        const btnCopy = document.getElementById('btnCopyRef');
        if (btnCopy && data.referral_code) {
            btnCopy.onclick = () => {
                const refLink = `${window.location.origin}/pages/register.html?ref=${data.referral_code}`;
                navigator.clipboard.writeText(refLink).then(() => {
                    showToast("¡Link de referido copiado!", "success");
                    btnCopy.textContent = "¡Copiado!";
                    setTimeout(() => btnCopy.textContent = "Copiar Link", 2000);
                });
            };
        }
    }

    const offered_services = data.socials?.offered_services || {};
    const mixing = document.getElementById('serviceMixing');
    if (mixing) mixing.checked = offered_services.mixing || false;
    const mastering = document.getElementById('serviceMastering');
    if (mastering) mastering.checked = offered_services.mastering || false;

    const spotifyWork = document.getElementById('spotifyWork');
    if (spotifyWork) spotifyWork.value = data.socials?.spotify_content || '';

    if (data.daws && data.daws.length > 0) {
        setSelectValue('mostUsedDaw', data.daws[0]);
    }

    const genresContainer = document.getElementById('genres');
    if (genresContainer) {
        window.selectedGenres = data.genres || [];
        genresContainer.innerHTML = '';
        const allGenres = ["Hip-Hop", "Trap", "R&B", "Pop", "EDM", "House", "Techno", "Dubstep", "Drum & Bass", "Lo-Fi", "Reggaeton", "Latin", "Rock", "Metal", "Jazz", "Soul", "Funk", "Ambient", "Orchestral", "Synthwave", "Indie", "Afrobeats"];
        
        allGenres.forEach(genre => {
            const chip = document.createElement('div');
            chip.className = `chip ${window.selectedGenres.includes(genre) ? 'selected' : ''}`;
            chip.textContent = genre;
            
            chip.addEventListener('click', () => {
                if (chip.classList.contains('selected')) {
                    chip.classList.remove('selected');
                    window.selectedGenres = window.selectedGenres.filter(g => g !== genre);
                } else {
                    if (window.selectedGenres.length >= 5) {
                        showToast("Puedes seleccionar un máximo de 5 géneros", "error");
                        return;
                    }
                    chip.classList.add('selected');
                    window.selectedGenres.push(genre);
                }
            });
            genresContainer.appendChild(chip);
        });
    }
}

function injectSkeletons() {
    // Sidebar
    const name = document.getElementById('sidebarName');
    const role = document.getElementById('sidebarRole');
    const avatar = document.getElementById('sidebarAvatar');
    if (name) name.classList.add('skeleton-base', 'skeleton-name');
    if (role) role.classList.add('skeleton-base', 'skeleton-role');
    if (avatar) avatar.classList.add('skeleton-base', 'skeleton-avatar');

    // Form Fields (Inputs & Selects)
    document.querySelectorAll('.form-input, .form-select').forEach(el => {
        el.classList.add('skeleton-base');
    });

    // Buttons
    document.querySelectorAll('.btn-primary-sm, .btn-change-avatar').forEach(btn => {
        // btn.classList.add('btn-loading-skeleton');
    });

    // Form Avatar
    const formAvatar = document.getElementById('formAvatar');
    if (formAvatar) formAvatar.classList.add('skeleton-base', 'skeleton-avatar');
}

function removeSkeletons() {
    const name = document.getElementById('sidebarName');
    const role = document.getElementById('sidebarRole');
    const avatar = document.getElementById('sidebarAvatar');
    const formAvatar = document.getElementById('formAvatar');

    if (name) name.classList.remove('skeleton-base', 'skeleton-name');
    if (role) role.classList.remove('skeleton-base', 'skeleton-role');
    if (avatar) avatar.classList.remove('skeleton-base', 'skeleton-avatar');
    if (formAvatar) formAvatar.classList.remove('skeleton-base', 'skeleton-avatar');

    document.querySelectorAll('.form-input, .form-select').forEach(el => {
        el.classList.remove('skeleton-base');
    });

    document.querySelectorAll('.btn-primary-sm, .btn-change-avatar').forEach(btn => {
        btn.classList.remove('btn-loading-skeleton');
    });
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
    let timeout = null; // Fix: Declare timeout variable for debounce

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

    // 4. Payments Form
    const paymentsForm = document.getElementById('paymentsForm');
    if (paymentsForm) {
        paymentsForm.addEventListener('submit', (e) => saveProfileChanges(e, 'payments'));
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
        if (firstNameInput) {
            const fnVal = firstNameInput.value;
            const fnCounter = document.getElementById('firstNameCounter');
            if (fnCounter) {
                fnCounter.textContent = `${fnVal.length}/25`;
                fnCounter.style.color = fnVal.length === 25 ? '#ef4444' : '#a1a1aa';
            }
        }

        // Last Name Counter
        if (lastNameInput) {
            const lnVal = lastNameInput.value;
            const lnCounter = document.getElementById('lastNameCounter');
            if (lnCounter) {
                lnCounter.textContent = `${lnVal.length}/25`;
                lnCounter.style.color = lnVal.length === 25 ? '#ef4444' : '#a1a1aa';
            }
        }

        // Nickname Counter
        if (nickInput) {
            const nickVal = nickInput.value;
            const nickCounter = document.getElementById('nicknameCounter');
            if (nickCounter) {
                nickCounter.textContent = `${nickVal.length}/30`;
                nickCounter.style.color = nickVal.length === 30 ? '#ef4444' : '#a1a1aa';
            }
        }
    }

    // SANITIZATION: Strict Nickname Logic
    function sanitizeNickname() {
        if (!nickInput) return;
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
            const daw = document.getElementById('mostUsedDaw') ? document.getElementById('mostUsedDaw').value : null;

            if (!role) throw new Error("Selecciona tu rol principal.");

            // Merge new settings into existing socials
            const mergedSocials = { ...currentProfileData.socials };
            mergedSocials.offered_services = {
                mixing: document.getElementById('serviceMixing')?.checked || false,
                mastering: document.getElementById('serviceMastering')?.checked || false
            };
            mergedSocials.spotify_content = document.getElementById('spotifyWork')?.value.trim() || null;

            // Aligned to Schema: daws (text[]), experience (text[]), socials (jsonb), genres (text[])
            updates = {
                role,
                bio: document.getElementById('bio') ? document.getElementById('bio').value.trim() : currentProfileData.bio,
                daws: daw ? [daw] : [],
                socials: mergedSocials
            };

            if (experience) {
                updates.experience = [experience];
            }
        }

        // === 3. SOCIALS FORM ===
        if (type === 'socials') {
            const mergedSocials = { ...currentProfileData.socials };
            mergedSocials.instagram = document.getElementById('instagram').value.trim();
            mergedSocials.tiktok = document.getElementById('tiktok').value.trim();
            mergedSocials.youtube = document.getElementById('youtube').value.trim();
            mergedSocials.spotify = document.getElementById('spotify').value.trim();

            updates = { socials: mergedSocials };
        }

        // === 4. PAYMENTS FORM ===
        if (type === 'payments') {
            const paypal_email = document.getElementById('paypalEmail').value.trim();
            // Validate basic email format if provided
            if (paypal_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypal_email)) {
                throw new Error("Por favor ingresa un correo de PayPal válido.");
            }
            updates = { paypal_email };
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
        // alert("Cambios guardados correctamente."); // REMOVED

        // Refresh specific UI parts if needed
        if (updates.first_name || updates.nickname) {
            document.getElementById('sidebarName').textContent = updates.nickname || updates.first_name;
        }
        if (updates.role) {
            document.getElementById('sidebarRole').textContent = updates.role;
        }

        // REDIRECT OR RELOAD
        const nickname = currentProfileData.nickname || currentUser.user_metadata?.nickname;

        // Refresh Onboarding Widget in real-time
        if (window.refreshOnboardingWidget) {
            window.refreshOnboardingWidget();
        }

        if (type === 'profile' && nickname) {
            showToast("Perfil actualizado. Redirigiendo...", 'success');
            setTimeout(() => {
                window.location.href = `/@${nickname}`;
            }, 1500);
        } else {
            showToast("Cambios guardados. Recargando...", 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        }

    } catch (err) {
        showToast(err.message || "Error al guardar cambios.", 'error');
        // console.error(err);
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
        // console.error(err);
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
                if (errorEl) {
                    errorEl.textContent = "Por favor ingresa una URL válida (https://...)";
                    errorEl.classList.add('active');
                    errorEl.style.color = '#ef4444';
                }
            } else if (errorEl) {
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
                if (errorEl) {
                    errorEl.textContent = "Por favor ingresa una URL válida (https://...)";
                    errorEl.classList.add('active');
                    errorEl.style.color = '#ef4444';
                }
            } else if (errorEl) {
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
        if (!newPassInput || !confirmPassInput || !errorMatch) return;
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

// TOAST SYSTEM
function showToast(message, type = 'success') {
    const existing = document.querySelector('.custom-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ef4444' : '#22c55e'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    // Add icon based on type
    const iconClass = type === 'error' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill';
    const iconEl = document.createElement('i');
    iconEl.className = `bi ${iconClass}`;
    const spanEl = document.createElement('span');
    spanEl.textContent = message;
    toast.appendChild(iconEl);
    toast.appendChild(spanEl);

    // Add animation styles if not present
    if (!document.getElementById('toast-style')) {
        const style = document.createElement('style');
        style.id = 'toast-style';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/* ==================== MENTIONS MANAGER ==================== */
class MentionsManager {
    constructor(textareaId, dropdownId) {
        this.textarea = document.getElementById(textareaId);
        this.dropdown = document.getElementById(dropdownId);
        if (!this.textarea || !this.dropdown) return;

        this.isActive = false;
        this.query = "";
        this.selectedIndex = -1;
        this.filteredUsers = [];
        this.debounceTimer = null;

        this.init();
    }

    init() {
        this.textarea.addEventListener('input', () => this.handleInput());
        this.textarea.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (e.target !== this.textarea && !this.dropdown.contains(e.target)) {
                this.close();
            }
        });
    }

    handleInput() {
        const text = this.textarea.value;
        const cursorPos = this.textarea.selectionStart;
        const textBeforeCaret = text.substring(0, cursorPos);

        // Match @username (only at the end of textBeforeCaret)
        const mentionMatch = textBeforeCaret.match(/@([a-z0-9._-]*)$/i);

        if (mentionMatch) {
            this.isActive = true;
            this.query = mentionMatch[1];
            this.showDropdown();

            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.searchUsers(this.query), 300);
        } else {
            this.close();
        }
    }

    async searchUsers(query) {
        if (!this.isActive) return;

        try {
            // Use the same search logic as Navbar but specifically for users
            const { data, error } = await window.supabaseClient
                .from('users')
                .select('nickname, avatar_url')
                .ilike('nickname', `%${query}%`)
                .limit(5);

            if (error) throw error;

            this.filteredUsers = data || [];
            this.renderResults();
        } catch (err) {
            console.error("Mentions Search Error:", err);
            this.renderResults([]);
        }
    }

    showDropdown() {
        this.dropdown.style.display = 'flex';
        // Basic positioning: below the textarea or follow caret (advanced)
        // For now, let's keep it anchored below the textarea for stability
        this.dropdown.style.top = (this.textarea.offsetTop + this.textarea.offsetHeight + 5) + 'px';
        this.dropdown.style.left = this.textarea.offsetLeft + 'px';
    }

    renderResults() {
        if (!this.isActive) return;

        this.dropdown.innerHTML = '';

        if (this.filteredUsers.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'mention-empty';
            empty.textContent = 'No se encontraron usuarios';
            this.dropdown.appendChild(empty);
            return;
        }

        this.filteredUsers.forEach((user, index) => {
            const item = document.createElement('div');
            item.className = `mention-item ${index === this.selectedIndex ? 'selected' : ''}`;
            item.dataset.index = index;

            const img = document.createElement('img');
            const defaultAvatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.nickname || 'User') + '&background=random';
            img.src = user.avatar_url || defaultAvatarUrl;
            img.className = 'mention-avatar';
            img.onerror = () => {
                img.src = defaultAvatarUrl;
            };

            const span = document.createElement('span');
            span.className = 'mention-nickname';
            span.textContent = `@${user.nickname}`;

            item.appendChild(img);
            item.appendChild(span);

            item.onclick = () => {
                this.selectUser(this.filteredUsers[index]);
            };

            this.dropdown.appendChild(item);
        });
    }

    selectUser(user) {
        const text = this.textarea.value;
        const cursorPos = this.textarea.selectionStart;
        const textBeforeCaret = text.substring(0, cursorPos);
        const textAfterCaret = text.substring(cursorPos);

        const mentionMatch = textBeforeCaret.match(/@([a-z0-9._-]*)$/i);
        if (mentionMatch) {
            const startPos = mentionMatch.index;
            const newTextBefore = textBeforeCaret.substring(0, startPos) + "@" + user.nickname + " ";
            this.textarea.value = newTextBefore + textAfterCaret;

            // Set caret position after the inserted name
            const newPos = newTextBefore.length;
            this.textarea.setSelectionRange(newPos, newPos);
            this.textarea.focus();

            // Trigger input event to update counters
            this.textarea.dispatchEvent(new Event('input'));
        }

        this.close();
    }

    handleKeyDown(e) {
        if (!this.isActive) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex + 1) % (this.filteredUsers.length || 1);
            this.renderResults();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex - 1 + (this.filteredUsers.length || 1)) % (this.filteredUsers.length || 1);
            this.renderResults();
        } else if (e.key === 'Enter') {
            if (this.selectedIndex >= 0 && this.filteredUsers[this.selectedIndex]) {
                e.preventDefault();
                this.selectUser(this.filteredUsers[this.selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            this.close();
        }
    }

    close() {
        this.isActive = false;
        this.dropdown.style.display = 'none';
        this.selectedIndex = -1;
    }
}

// Initialize Mentions
if (document.getElementById('bio')) {
    new MentionsManager('bio', 'mentionsDropdown');
}
