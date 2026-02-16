document.addEventListener('DOMContentLoaded', async () => {
    // 1. Basic UI Init (Sidebar active state handled by HTML)
    const loadPromise = loadPreferences();
    const sidebarPromise = loadSidebarAvatar();

    // Minimum 2-second delay for premium skeleton feel (Project standard)
    const delayPromise = new Promise(resolve => setTimeout(resolve, 2000));

    await Promise.all([loadPromise, sidebarPromise, delayPromise]);

    // Remove ALL Skeletons from the page (Sidebar + Content + Radios)
    document.querySelectorAll('.skeleton-base').forEach(el => {
        el.classList.remove('skeleton-base');
        el.classList.remove('skeleton-circle');
        el.style.width = '';
        el.style.height = '';
    });
});

async function loadPreferences() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            window.location.href = '/pages/login.html';
            return;
        }

        // Fetch profile preference
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('upload_defaults_preference')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        // Default to 'last_used' if null (Global Default Change)
        const pref = data?.upload_defaults_preference || 'last_used';

        // Update UI
        const radio = document.querySelector(`input[name="uploadDefaults"][value="${pref}"]`);
        if (radio) radio.checked = true;

    } catch (error) {
        console.error('Error loading preferences:', error);
    }
}

async function saveUploadPreference(value) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { error } = await supabaseClient
            .from('profiles')
            .update({ upload_defaults_preference: value })
            .eq('id', user.id);

        if (error) throw error;

        // Toast removed per user request for less intrusive feel

    } catch (error) {
        console.error('Error saving preference:', error);
        alert('Error al guardar cambios');
    }
}

// Simple Sidebar Avatar Loader to match Account Settings look
async function loadSidebarAvatar() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        // Fetch visual profile data
        const { data: profile, error } = await supabaseClient
            .from('users')
            .select('nickname, avatar_url, first_name, last_name, role')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        const sidebarAvatar = document.getElementById('sidebarAvatar');
        const sidebarName = document.getElementById('sidebarName');
        const sidebarRole = document.getElementById('sidebarRole');

        // 1. Avatar
        if (sidebarAvatar) {
            if (profile.avatar_url) {
                sidebarAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            } else {
                sidebarAvatar.textContent = (profile.nickname || 'U').charAt(0).toUpperCase();
            }
        }

        // 2. Name (First Name + Last Name OR Nickname)
        if (sidebarName) {
            const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
            sidebarName.textContent = fullName || profile.nickname || 'Usuario';
        }

        // 3. Role
        if (sidebarRole) {
            // Capitalize role if needed or mapped
            sidebarRole.textContent = (profile.role === 'admin') ? 'Administrador' : 'Productor';
        }

    } catch (e) {
        console.warn('Error loading sidebar info:', e);
    }
}
