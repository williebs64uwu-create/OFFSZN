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
    // Initialize Custom Selector UI
    initPromoSelector();

    // Basic UI Init
    const loadPromise = loadPreferences();
    const sidebarPromise = loadSidebarAvatar();
    const promoPromise = loadPromotion();

    // Minimum delay for premium skeleton feel
    const delayPromise = new Promise(resolve => setTimeout(resolve, 2000));

    await Promise.all([loadPromise, sidebarPromise, promoPromise, delayPromise]);

    // Remove Skeletons
    document.querySelectorAll('.skeleton-base').forEach(el => {
        el.classList.remove('skeleton-base');
        el.classList.remove('skeleton-circle');
        el.style.width = '';
        el.style.height = '';
    });
});

// --- Upload Preferences (Radio Buttons) ---
async function loadPreferences() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            window.location.href = '/pages/login.html';
            return;
        }

        const { data, error } = await supabaseClient
            .from('profiles')
            .select('upload_defaults_preference')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        const pref = data?.upload_defaults_preference || 'last_used';
        const radio = document.querySelector(`input[name="uploadDefaults"][value="${pref}"]`);
        if (radio) radio.checked = true;

    } catch (error) {
        // console.error('Error loading preferences:', error);
    }
}

window.saveUploadPreference = async function (value) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        await supabaseClient
            .from('profiles')
            .update({ upload_defaults_preference: value })
            .eq('id', user.id);
    } catch (error) {
        // console.error('Error saving preference:', error);
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
                sidebarAvatar.innerHTML = `<img crossorigin="anonymous" src="${safeUrl}" alt="Avatar" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
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

// --- Promotion Logic ---
async function loadPromotion() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { data, error } = await supabaseClient
            .from('promociones_offszn_seguro')
            .select('*')
            .eq('producer_id', user.id)
            .maybeSingle();

        if (error) return;

        if (data) {
            // Determine promo value for UI sync
            let val = 'custom';
            if (!data.active) val = 'none';
            else if (data.buy_quantity === 1 && data.get_quantity === 1) val = '2,1';
            else if (data.buy_quantity === 1 && data.get_quantity === 2) val = '3,1';

            // Initial manual values (hidden unless custom)
            document.getElementById('promoBuyQty').value = data.buy_quantity;
            document.getElementById('promoGetQty').value = data.get_quantity;

            handlePromoSelector(val);
        } else {
            handlePromoSelector('2,1'); // Default
        }
    } catch (error) {
        // console.error('Promo load error:', error);
    }
}

function updatePromoSummary() {
    const buyQty = parseInt(document.getElementById('promoBuyQty')?.value) || 0;
    const getQty = parseInt(document.getElementById('promoGetQty')?.value) || 0;
    const summary = document.getElementById('promoSummary');

    // Check if "None" is active
    const activeTab = document.querySelector('.promo-tab.active');
    const isNone = activeTab && activeTab.dataset.value === 'none';

    if (summary) {
        if (isNone || (buyQty === 0 && getQty === 0)) {
            summary.innerHTML = `<span style="color: #666; font-size: 0.8rem;">Promoción Desactivada</span>`;
        } else {
            summary.innerHTML = `Compra <span style="color: #fff; font-weight: 700;">${buyQty}</span> y Lleva <span style="color: #fff; font-weight: 700;">${getQty}</span> Gratis`;
        }
    }
}

function initPromoSelector() {
    const trigger = document.getElementById('promoCustomTrigger');
    const optionsList = document.getElementById('promoOptionsList');
    const options = document.querySelectorAll('.custom-option');
    const tabs = document.querySelectorAll('.promo-tab');
    const chevron = document.getElementById('promoChevron');

    if (!trigger || !optionsList) return;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = optionsList.style.display === 'block';
        if (!isOpen) {
            optionsList.style.display = 'block';
            trigger.classList.add('active');
            if (chevron) chevron.classList.add('open');
        } else {
            closeAllCustomDropdowns();
        }
    });

    options.forEach(opt => {
        opt.addEventListener('click', () => {
            const val = opt.dataset.value;
            handlePromoSelector(val);
            closeAllCustomDropdowns();
        });
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            handlePromoSelector(tab.dataset.value);
        });
    });

    document.addEventListener('click', () => closeAllCustomDropdowns());
}

function closeAllCustomDropdowns() {
    const list = document.getElementById('promoOptionsList');
    const trigger = document.getElementById('promoCustomTrigger');
    const chevron = document.getElementById('promoChevron');

    if (list) list.style.display = 'none';
    if (trigger) trigger.classList.remove('active');
    if (chevron) chevron.classList.remove('open');
}

function handlePromoSelector(value) {
    // 1. Sync Mobile
    const display = document.getElementById('promoSelectedDisplay');
    document.querySelectorAll('.custom-option').forEach(opt => {
        if (opt.dataset.value === value) {
            opt.classList.add('selected');
            if (display) display.textContent = opt.textContent;
        } else {
            opt.classList.remove('selected');
        }
    });

    // 2. Sync Desktop
    document.querySelectorAll('.promo-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.value === value);
    });

    // 3. Logic
    const customRow = document.getElementById('customPromoRow');
    let buy = 2, get = 1;

    if (value === 'none') {
        buy = 0; get = 0;
        customRow.style.display = 'none';
    } else if (value === '2,1') {
        buy = 1; get = 1; // 2x1: Llevas 2, pagas 1
        customRow.style.display = 'none';
    } else if (value === '3,1') {
        buy = 1; get = 2; // 3x1: Llevas 3, pagas 1
        customRow.style.display = 'none';
    } else if (value === 'custom') {
        customRow.style.display = 'grid';
        buy = parseInt(document.getElementById('promoBuyQty').value) || 2;
        get = parseInt(document.getElementById('promoGetQty').value) || 1;
    }

    updatePromoValues(buy, get);
}

function updatePromoValues(buy, get) {
    document.getElementById('promoBuyQty').value = buy;
    document.getElementById('promoGetQty').value = get;
    const dbuy = document.getElementById('displayBuyQty');
    const dget = document.getElementById('displayGetQty');
    if (dbuy) dbuy.textContent = buy;
    if (dget) dget.textContent = get;
    updatePromoSummary();
    autosavePromotion();
}

window.adjustQty = function (id, delta) {
    const input = document.getElementById(id);
    if (!input) return;
    let val = (parseInt(input.value) || 0) + delta;
    if (val < 1) val = 1;
    if (val > 20) val = 20;
    input.value = val;
    // Manual adjustment only from "custom" so we just update values
    updatePromoValues(
        parseInt(document.getElementById('promoBuyQty').value),
        parseInt(document.getElementById('promoGetQty').value)
    );
};

let autosaveTimer;
window.autosavePromotion = function () {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return;

            // Active status is FALSE if "none" is selected
            const activeTab = document.querySelector('.promo-tab.active');
            const isActive = activeTab && activeTab.dataset.value !== 'none';

            const buy = parseInt(document.getElementById('promoBuyQty')?.value) || 0;
            const get = parseInt(document.getElementById('promoGetQty')?.value) || 0;

            const { data: existing } = await supabaseClient
                .from('promociones_offszn_seguro')
                .select('id')
                .eq('producer_id', user.id)
                .maybeSingle();

            if (existing) {
                await supabaseClient.from('promociones_offszn_seguro').update({ buy_quantity: buy, get_quantity: get, active: isActive }).eq('id', existing.id);
            } else {
                await supabaseClient.from('promociones_offszn_seguro').insert({ producer_id: user.id, buy_quantity: buy, get_quantity: get, discount_percent: 100, active: isActive });
            }
            // console.log('Promotion autosaved (Active:', isActive, ')');
        } catch (e) {
            // console.error('Autosave failed:', e);
        }
    }, 800);
};
