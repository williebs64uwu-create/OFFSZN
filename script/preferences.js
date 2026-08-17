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

document.addEventListener('DOMContentLoaded', async () => {
    // Basic UI Init
    const loadPromise = loadPreferences();
    const sidebarPromise = loadSidebarAvatar();

    // Minimum delay for premium skeleton feel
    const delayPromise = new Promise(resolve => setTimeout(resolve, 2000));

    await Promise.all([loadPromise, sidebarPromise, delayPromise]);

    // Remove Skeletons
    document.querySelectorAll('.skeleton-base').forEach(el => {
        el.classList.remove('skeleton-base');
        el.classList.remove('skeleton-circle');
        el.style.width = '';
        el.style.height = '';
    });
});

// --- Upload Preferences (Radio Buttons & Switches) ---
async function loadPreferences() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            window.location.href = '/pages/login.html';
            return;
        }

        const { data, error } = await supabaseClient
            .from('profiles')
            .select('upload_defaults_preference, auto_delist_exclusive')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        // 1. Upload defaults preference
        const pref = data?.upload_defaults_preference || 'last_used';
        const radio = document.querySelector(`input[name="uploadDefaults"][value="${pref}"]`);
        if (radio) radio.checked = true;

        // 2. Auto-delist exclusive preference (default: false)
        const autoDelist = data?.auto_delist_exclusive === true;
        const autoDelistToggle = document.getElementById('autoDelistExclusiveToggle');
        if (autoDelistToggle) autoDelistToggle.checked = autoDelist;

    } catch (error) {
        console.error('Error loading preferences:', error);
    }
}

window.saveUploadPreference = async function (value) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        await Promise.all([
            supabaseClient
                .from('profiles')
                .update({ upload_defaults_preference: value })
                .eq('id', user.id),
            supabaseClient
                .from('users')
                .update({ upload_defaults_preference: value })
                .eq('id', user.id)
        ]);
    } catch (error) {
        console.error('Error saving upload preference:', error);
    }
}

window.saveAutoDelistPreference = async function (isChecked) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        await Promise.all([
            supabaseClient
                .from('profiles')
                .update({ auto_delist_exclusive: isChecked })
                .eq('id', user.id),
            supabaseClient
                .from('users')
                .update({ auto_delist_exclusive: isChecked })
                .eq('id', user.id)
        ]);

        if (window.toast) {
            window.toast.success('Preferencia guardada correctamente');
        }
    } catch (error) {
        console.error('Error saving auto delist preference:', error);
        if (window.toast) {
            window.toast.error('Error al guardar preferencia');
        }
    }
}

// --- Sidebar Avatar ---
async function loadSidebarAvatar() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { data: profile, error } = await supabaseClient
            .from('users')
            .select('nickname, avatar_url, first_name, last_name, role')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        const sidebarAvatar = document.getElementById('sidebarAvatar');
        const sidebarName = document.getElementById('sidebarName');
        const sidebarRole = document.getElementById('sidebarRole');

        if (sidebarAvatar) {
            if (profile.avatar_url) {
                const safeUrl = escapeHTML(profile.avatar_url);
                sidebarAvatar.innerHTML = `<img src="${safeUrl}" alt="Avatar" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            } else {
                sidebarAvatar.textContent = (profile.nickname || 'U').charAt(0).toUpperCase();
            }
        }
        if (sidebarName) {
            const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
            sidebarName.textContent = fullName || profile.nickname || 'Usuario';
        }
        if (sidebarRole) {
            sidebarRole.textContent = (profile.role === 'admin') ? 'Administrador' : 'Productor';
        }
    } catch (e) {
        // console.warn('Sidebar load failed:', e);
    }
}
