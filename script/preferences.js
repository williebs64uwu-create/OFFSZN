document.addEventListener('DOMContentLoaded', async () => {
    // 1. Basic UI Init (Sidebar active state handled by HTML)
    const loadPromise = loadPreferences();
    const sidebarPromise = loadSidebarAvatar();
    const promoPromise = loadPromotion();

    // Minimum 2-second delay for premium skeleton feel (Project standard)
    const delayPromise = new Promise(resolve => setTimeout(resolve, 2000));

    await Promise.all([loadPromise, sidebarPromise, promoPromise, delayPromise]);

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

// ========================================
// PROMOTIONS LOGIC (NUEVO)
// ========================================

async function loadPromotion() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { data, error } = await supabaseClient
            .from('promociones_offszn_seguro')
            .select('*')
            .eq('producer_id', user.id)
            .maybeSingle();

        if (error) {
            console.error('Error loading promotion:', error);
            return;
        }

        const promoToggle = document.getElementById('promoToggleInput');
        const buyQty = document.getElementById('promoBuyQty');
        const getQty = document.getElementById('promoGetQty');

        if (data) {
            if (promoToggle) promoToggle.checked = data.active;
            if (buyQty) buyQty.value = data.buy_quantity;
            if (getQty) getQty.value = data.get_quantity;
        }

        togglePromoOptions();
    } catch (error) {
        console.error('Error loading promotion:', error);
    }
}

window.togglePromoOptions = function () {
    const toggle = document.getElementById('promoToggleInput');
    const container = document.getElementById('promoOptionsContainer');
    if (toggle && container) {
        container.style.display = toggle.checked ? 'block' : 'none';
        updatePromoTotal();
    }
};

window.updatePromoTotal = function () {
    let buyQtyInput = document.getElementById('promoBuyQty');
    let getQtyInput = document.getElementById('promoGetQty');

    let buyQty = parseInt(buyQtyInput?.value) || 2;
    let getQty = parseInt(getQtyInput?.value) || 1;

    // Límite de 20 solicitado por el usuario
    if (buyQty > 20) { buyQty = 20; if (buyQtyInput) buyQtyInput.value = 20; }
    if (getQty > 20) { getQty = 20; if (getQtyInput) getQtyInput.value = 20; }
    if (buyQty < 1) { buyQty = 1; if (buyQtyInput) buyQtyInput.value = 1; }
    if (getQty < 1) { getQty = 1; if (getQtyInput) getQtyInput.value = 1; }

    document.getElementById('promoBuyDisplay').innerText = buyQty;
    document.getElementById('promoTotalDisplay').innerText = buyQty + getQty;
};

// Listeners
document.getElementById('promoBuyQty')?.addEventListener('input', updatePromoTotal);
document.getElementById('promoGetQty')?.addEventListener('input', updatePromoTotal);

window.savePromotion = async function () {
    const saveBtn = document.getElementById('savePromoBtn');
    const originalText = saveBtn.innerText;

    try {
        saveBtn.innerText = 'Guardando...';
        saveBtn.disabled = true;

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const isActive = document.getElementById('promoToggleInput')?.checked || false;
        const buyQty = parseInt(document.getElementById('promoBuyQty')?.value) || 2;
        const getQty = parseInt(document.getElementById('promoGetQty')?.value) || 1;

        const { data: existingPromo } = await supabaseClient
            .from('promociones_offszn_seguro')
            .select('id')
            .eq('producer_id', user.id)
            .maybeSingle();

        if (existingPromo) {
            const { error } = await supabaseClient
                .from('promociones_offszn_seguro')
                .update({
                    buy_quantity: buyQty,
                    get_quantity: getQty,
                    active: isActive
                })
                .eq('id', existingPromo.id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('promociones_offszn_seguro')
                .insert({
                    producer_id: user.id,
                    buy_quantity: buyQty,
                    get_quantity: getQty,
                    discount_percent: 100, // Siempre gratis adicional
                    active: isActive
                });
            if (error) throw error;
        }

        // Éxito - Mantener Premium B&W
        saveBtn.innerText = '✓ Guardado';
        saveBtn.style.backgroundColor = '#000';
        saveBtn.style.color = '#fff';
        saveBtn.style.border = '1px solid #fff';

        setTimeout(() => {
            saveBtn.innerText = originalText;
            saveBtn.style.backgroundColor = '#fff';
            saveBtn.style.color = '#000';
            saveBtn.style.border = 'none';
            saveBtn.disabled = false;
        }, 2500);

    } catch (error) {
        console.error('Error saving promotion:', error);
        saveBtn.innerText = 'Error al guardar';
        saveBtn.style.backgroundColor = '#ef4444'; // rojo
        saveBtn.style.borderColor = '#ef4444';

        setTimeout(() => {
            saveBtn.innerText = originalText;
            saveBtn.style.backgroundColor = '';
            saveBtn.style.borderColor = '';
            saveBtn.disabled = false;
        }, 2500);
    }
};
