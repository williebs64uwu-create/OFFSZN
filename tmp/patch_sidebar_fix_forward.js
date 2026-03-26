const fs = require('fs');
const path = require('path');

const targetDir = 'c:/Users/Willie/Desktop/OFFSZN/cuenta';

function getHtmlFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fileResolved = path.resolve(dir, file);
        const stat = fs.statSync(fileResolved);
        if (stat && stat.isDirectory()) {
            results = results.concat(getHtmlFiles(fileResolved));
        } else if (fileResolved.endsWith('.html') && !fileResolved.includes('planes.html')) {
            results.push(fileResolved);
        }
    });
    return results;
}

const files = getHtmlFiles(targetDir);

// Profile Card HTML with Skeletons
const profileCardHTML = `
        <!-- Profile Card -->
        <div class="sidebar-profile-card" id="sidebarProfileCard">
            <div class="sidebar-avatar-wrapper skeleton" id="sidebarAvatarSkeleton" style="width: 85px; height: 85px; border-radius: 50%; margin-bottom: 12px; background: #1a1a1a;">
                <img id="sidebarAvatar" src="" alt="Avatar" class="sidebar-avatar" style="display:none; width: 100%; height: 100%; object-fit: cover;">
            </div>
            <span id="sidebarUsername" class="sidebar-username skeleton-text" style="width: 100px; height: 18px; display: inline-block; border-radius: 4px; margin-bottom: 12px;"></span>
            <div id="sidebarBtnSkeleton" class="skeleton" style="width: 110px; height: 30px; border-radius: 100px; background: #1a1a1a;"></div>
            <a id="sidebarProfileLink" href="/explorar.html" class="sidebar-profile-btn" style="display:none;">
                Ir a mi perfil <i class="bi bi-arrow-right"></i>
            </a>
        </div>`;

// CSS with Animation
const profileCSS = `
        /* ===== SIDEBAR PROFILE CARD ===== */
        .sidebar-profile-card { display: flex; flex-direction: column; align-items: center; width: 100%; padding: 20px 0 20px 0; border-bottom: 1px solid #1a1a1a; margin-bottom: 12px; }
        .sidebar-avatar-wrapper { width: 85px; height: 85px; border-radius: 50%; overflow: hidden; border: 2px solid #333; margin-bottom: 12px; background: #000; position: relative; }
        .sidebar-avatar { width: 100%; height: 100%; object-fit: cover; }
        .sidebar-username { color: #fff; font-size: 15px; font-weight: 600; font-family: 'Inter', sans-serif; margin-bottom: 12px; text-align: center; max-width: 90%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sidebar-profile-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 18px; border-radius: 100px; border: 1px solid #333; background: transparent; color: #aaa; font-size: 12px; font-weight: 500; font-family: 'Inter', sans-serif; text-decoration: none; transition: all 0.2s ease; cursor: pointer; }
        .sidebar-profile-btn:hover { border-color: #fff; color: #fff; background: rgba(255,255,255,0.05); }
        .sidebar-profile-btn i { font-size: 11px; }

        @keyframes sidebarPulse {
            0% { background-color: rgba(255,255,255,0.03); }
            50% { background-color: rgba(255,255,255,0.08); }
            100% { background-color: rgba(255,255,255,0.03); }
        }
        .sidebar-profile-card .skeleton, .sidebar-profile-card .skeleton-text {
            animation: sidebarPulse 2s infinite ease-in-out;
            background: rgba(255,255,255,0.05);
        }
`;

// Updated JS
const profileJS = `
    <!-- Sidebar Profile Loader -->
    <script>
    (async function loadSidebarProfile() {
        try {
            const sb = window.supabaseClient || (window.supabase?.createClient ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null);
            if (!sb) { console.warn('Sidebar: Supabase client not found'); return; }
            
            const { data: { user } } = await sb.auth.getUser();
            if (!user) return;

            const { data: profile, error } = await sb.from('users')
                .select('nickname, avatar_url, storage_version, id')
                .eq('id', user.id)
                .single();

            if (error) { 
                const { data: profileAlt } = await sb.from('profiles').select('username, avatar_url, storage_version, id').eq('user_id', user.id).single();
                if (profileAlt) updateSidebarUI(profileAlt.username, profileAlt.avatar_url, profileAlt.storage_version, profileAlt.id);
                return; 
            }

            if (profile) updateSidebarUI(profile.nickname, profile.avatar_url, profile.storage_version, profile.id);

            async function updateSidebarUI(name, avatar, version, uid) {
                const avatarEl = document.getElementById('sidebarAvatar');
                const avatarSkel = document.getElementById('sidebarAvatarSkeleton');
                const nameEl = document.getElementById('sidebarUsername');
                const btnSkel = document.getElementById('sidebarBtnSkeleton');
                const linkEl = document.getElementById('sidebarProfileLink');

                if (nameEl && name) {
                    nameEl.textContent = name;
                    nameEl.classList.remove('skeleton-text');
                    nameEl.style.background = 'none';
                    nameEl.style.width = 'auto';
                    nameEl.style.height = 'auto';
                }

                if (linkEl && name) {
                    linkEl.href = '/' + name;
                    linkEl.style.display = 'inline-flex';
                    if (btnSkel) btnSkel.style.display = 'none';
                }

                if (avatarEl && avatar) {
                    try {
                        let finalSrc = avatar;
                        if (typeof avatar === 'string' && avatar.startsWith('http') && !avatar.includes('supabase.co')) {
                            finalSrc = avatar;
                        } else if (window.AuthUtils && window.AuthUtils.getAuthorizedUrl) {
                            finalSrc = await window.AuthUtils.getAuthorizedUrl(avatar, version, uid);
                        }
                        
                        avatarEl.src = finalSrc;
                        avatarEl.onload = () => {
                            avatarEl.style.display = 'block';
                            if (avatarSkel) {
                                avatarSkel.classList.remove('skeleton');
                                avatarSkel.style.background = 'transparent';
                            }
                        };
                    } catch(e) { 
                        avatarEl.src = avatar; 
                        avatarEl.style.display = 'block';
                        if (avatarSkel) avatarSkel.classList.remove('skeleton');
                    }
                }
            }
        } catch(e) { console.warn('Sidebar profile load error:', e); }
    })();
    </script>`;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Remove all CSS logic that looks like the profile card
    // First remove the exact block if it exists
    content = content.replace(/\/\* ===== SIDEBAR PROFILE CARD ===== \*\/[\s\S]*?\.sidebar-profile-card \.skeleton, \.sidebar-profile-card \.skeleton-text\s*\{[\s\S]*?background:\s*rgba\(255,255,255,0\.05\);\s*\}/gi, '');
    
    // Then aggressively remove ANY stray @keyframes sidebarPulse and skeleton rules
    content = content.replace(/@keyframes sidebarPulse[\s\S]*?rgba\(255,255,255,0\.05\);\s*\}/gi, '');

    // 2. Remove all JS Loader copies
    content = content.replace(/<!-- Sidebar Profile Loader -->[\s\S]*?<\/script>/gi, '');

    // 3. Clean the HTML inside sidebar-stub
    // We match from `<div class="sidebar-stub">` until the start of navigation blocks or links.
    // Navigation usually starts with `<!-- 1. GESTION -->` or `<a href=... class="sidebar-icon-btn`
    // This allows us to wipe away any number of duplicated profile cards and random spans.
    const repairRegex = /(<div\s+class="sidebar-stub">)[\s\S]*?(?=(?:<!--\s*\d|<a\s+[^>]*class="[^"]*sidebar-icon-btn))/i;
    
    if (repairRegex.test(content)) {
        content = content.replace(repairRegex, '$1\n        ' + profileCardHTML + '\n\n        ');
    }

    // --- RE-INJECT EXACTLY ONCE ---
    
    // Inject CSS into <style>
    if (content.includes('<style>')) {
        content = content.replace('<style>', '<style>\n' + profileCSS);
    }

    // Inject JS before </body>
    if (!content.includes('loadSidebarProfile')) {
        content = content.replace('</body>', profileJS + '\n</body>');
    }

    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed Forward:', path.basename(file));
});

console.log('\\nDone! Sidebar perfectly cleaned and restored for', files.length, 'files.');
