const fs = require('fs');
const path = require('path');

const targetDir = 'c:/Users/Willie/Desktop/OFFSZN/cuenta';

function getHtmlFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getHtmlFiles(file));
        } else if (file.endsWith('.html') && !file.includes('planes.html')) {
            results.push(file);
        }
    });
    return results;
}

const files = getHtmlFiles(targetDir);

// The new profile card HTML (simplified, no username yet, will be filled by JS)
const profileCardHTML = `<!-- Profile Card -->
        <div class="sidebar-profile-card">
            <div class="sidebar-avatar-wrapper">
                <img id="sidebarAvatar" src="../images/LOGO-OFFSZN.png" alt="Avatar" class="sidebar-avatar">
            </div>
            <span id="sidebarUsername" class="sidebar-username">...</span>
            <a id="sidebarProfileLink" href="/explorar.html" class="sidebar-profile-btn">
                Ir a mi perfil <i class="bi bi-arrow-right"></i>
            </a>
        </div>`;

// The CSS - REMOVED HOVER EFFECTS and refined centering
const profileCSS = `
        /* ===== SIDEBAR PROFILE CARD ===== */
        .sidebar-profile-card { display: flex; flex-direction: column; align-items: center; width: 100%; padding: 20px 0 20px 0; border-bottom: 1px solid #1a1a1a; margin-bottom: 12px; }
        .sidebar-avatar-wrapper { width: 85px; height: 85px; border-radius: 50%; overflow: hidden; border: 2px solid #333; margin-bottom: 12px; background: #000; }
        .sidebar-avatar { width: 100%; height: 100%; object-fit: cover; }
        .sidebar-username { color: #fff; font-size: 15px; font-weight: 600; font-family: 'Inter', sans-serif; margin-bottom: 12px; text-align: center; max-width: 90%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sidebar-profile-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 18px; border-radius: 100px; border: 1px solid #333; background: transparent; color: #aaa; font-size: 12px; font-weight: 500; font-family: 'Inter', sans-serif; text-decoration: none; transition: all 0.2s ease; cursor: pointer; }
        .sidebar-profile-btn:hover { border-color: #fff; color: #fff; background: rgba(255,255,255,0.05); }
        .sidebar-profile-btn i { font-size: 11px; }
`;

// The JS snippet - USING 'nickname' instead of 'username'
const profileJS = `
    <!-- Sidebar Profile Loader -->
    <script>
    (async function loadSidebarProfile() {
        try {
            const sb = window.supabaseClient || (window.supabase?.createClient ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null);
            if (!sb) { console.warn('Sidebar: Supabase client not found'); return; }
            
            const { data: { user } } = await sb.auth.getUser();
            if (!user) return;

            // Nickname is the correct field in the 'users' table
            const { data: profile, error } = await sb.from('users')
                .select('nickname, avatar_url, storage_version, id')
                .eq('id', user.id)
                .single();

            if (error) { 
                console.error('Sidebar profile error:', error);
                // Try profiles table as backup if users fails
                const { data: profileAlt } = await sb.from('profiles').select('username, avatar_url, storage_version, id').eq('user_id', user.id).single();
                if (profileAlt) {
                    updateSidebarUI(profileAlt.username, profileAlt.avatar_url, profileAlt.storage_version, profileAlt.id);
                }
                return; 
            }

            if (profile) {
                updateSidebarUI(profile.nickname, profile.avatar_url, profile.storage_version, profile.id);
            }

            async function updateSidebarUI(name, avatar, version, uid) {
                const avatarEl = document.getElementById('sidebarAvatar');
                const nameEl = document.getElementById('sidebarUsername');
                const linkEl = document.getElementById('sidebarProfileLink');

                if (nameEl && name) nameEl.textContent = name;
                if (linkEl && name) linkEl.href = '/' + name;
                if (avatarEl && avatar) {
                    try {
                        if (window.AuthUtils && window.AuthUtils.getAuthorizedUrl) {
                            const signedUrl = await window.AuthUtils.getAuthorizedUrl(avatar, version, uid);
                            avatarEl.src = signedUrl;
                        } else {
                            avatarEl.src = avatar;
                        }
                    } catch(e) { avatarEl.src = avatar; }
                }
            }
        } catch(e) { console.warn('Sidebar profile load error:', e); }
    })();
    </script>`;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Remove old injections if they exist to overwrite cleanly
    const oldCSSPattern = /\/\* ===== SIDEBAR PROFILE CARD ===== \*\/[\s\S]*?\.sidebar-profile-btn:hover i \{ transform: translateX\(3px\); \}/;
    content = content.replace(oldCSSPattern, '');
    
    const oldJSPattern = /<!-- Sidebar Profile Loader -->[\s\S]*?<\/script>/;
    content = content.replace(oldJSPattern, '');

    // 1. Inject the NEW CSS
    if (content.includes('<style>')) {
        content = content.replace('<style>', '<style>' + profileCSS);
    }

    // 2. Identify and replace/insert profile card
    const profileCardPattern = /<!-- Profile Card -->[\s\S]*?<\/div>\s*<!-- 1. GESTIÓN -->/;
    if (profileCardPattern.test(content)) {
        content = content.replace(profileCardPattern, profileCardHTML + '\n        <!-- 1. GESTIÓN -->');
    } else {
        // Fallback for subfolders or different layouts
        const sidebarStubPattern = /<div class="sidebar-stub">/;
        if (sidebarStubPattern.test(content)) {
            content = content.replace(sidebarStubPattern, '<div class="sidebar-stub">\n        ' + profileCardHTML);
        }
    }

    // 3. Inject the NEW JS
    if (!content.includes('loadSidebarProfile')) {
        content = content.replace('</body>', profileJS + '\n</body>');
    }

    fs.writeFileSync(file, content, 'utf8');
    console.log('Profile Card Fixed:', path.basename(file));
});

console.log('\\nDone! Profile card fixes applied to', files.length, 'files.');
