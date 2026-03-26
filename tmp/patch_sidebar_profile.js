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

// The new profile card HTML that replaces the logo
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

// The CSS for the profile card
const profileCSS = `
        /* ===== SIDEBAR PROFILE CARD ===== */
        .sidebar-profile-card { display: flex; flex-direction: column; align-items: center; width: 100%; padding: 8px 0 20px 0; border-bottom: 1px solid #1a1a1a; margin-bottom: 8px; }
        .sidebar-avatar-wrapper { width: 72px; height: 72px; border-radius: 50%; overflow: hidden; border: 2px solid #333; margin-bottom: 10px; transition: border-color 0.3s ease; }
        .sidebar-avatar-wrapper:hover { border-color: #fff; }
        .sidebar-avatar { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
        .sidebar-avatar-wrapper:hover .sidebar-avatar { transform: scale(1.08); }
        .sidebar-username { color: #fff; font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif; margin-bottom: 10px; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sidebar-profile-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 100px; border: 1px solid #333; background: transparent; color: #aaa; font-size: 12px; font-weight: 500; font-family: 'Inter', sans-serif; text-decoration: none; transition: all 0.25s ease; cursor: pointer; }
        .sidebar-profile-btn:hover { border-color: #fff; color: #fff; background: rgba(255,255,255,0.05); }
        .sidebar-profile-btn i { font-size: 12px; transition: transform 0.2s ease; }
        .sidebar-profile-btn:hover i { transform: translateX(3px); }
`;

// The JS snippet to populate the profile card (injected before </body>)
const profileJS = `
    <!-- Sidebar Profile Loader -->
    <script>
    (async function loadSidebarProfile() {
        try {
            const sb = window.supabaseClient || window.supabase?.createClient?.(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            if (!sb) return;
            const { data: { user } } = await sb.auth.getUser();
            if (!user) return;
            const { data: profile } = await sb.from('users').select('username, avatar_url, storage_version, id').eq('id', user.id).single();
            if (!profile) return;

            const avatarEl = document.getElementById('sidebarAvatar');
            const nameEl = document.getElementById('sidebarUsername');
            const linkEl = document.getElementById('sidebarProfileLink');

            if (nameEl && profile.username) {
                nameEl.textContent = profile.username;
            }
            if (linkEl && profile.username) {
                linkEl.href = '/' + profile.username;
            }
            if (avatarEl && profile.avatar_url) {
                try {
                    if (typeof window.AuthUtils !== 'undefined' && window.AuthUtils.getAuthorizedUrl) {
                        const signedUrl = await window.AuthUtils.getAuthorizedUrl(profile.avatar_url, profile.storage_version, profile.id);
                        avatarEl.src = signedUrl;
                    } else {
                        avatarEl.src = profile.avatar_url;
                    }
                } catch(e) {
                    avatarEl.src = profile.avatar_url;
                }
            }
        } catch(e) { console.warn('Sidebar profile load error:', e); }
    })();
    </script>`;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Inject the CSS (only once, at the first <style> tag)
    if (!content.includes('.sidebar-profile-card')) {
        content = content.replace('<style>', '<style>' + profileCSS);
    }

    // 2. Replace the logo block with the profile card
    // Match the logo <a> tag pattern
    const logoRegex = /<!-- Brand\/Home -->\s*<a href="\/explorar\.html"[^>]*>[\s\S]*?<\/a>/;
    if (logoRegex.test(content)) {
        content = content.replace(logoRegex, profileCardHTML);
    } else {
        // Fallback: try to find any sidebar-logo-btn
        const altLogoRegex = /<a[^>]*class="sidebar-logo-btn"[^>]*>[\s\S]*?<\/a>/;
        if (altLogoRegex.test(content)) {
            content = content.replace(altLogoRegex, profileCardHTML);
        }
    }

    // 3. Inject the JS snippet before </body> (only once)
    if (!content.includes('loadSidebarProfile')) {
        content = content.replace('</body>', profileJS + '\n</body>');
    }

    fs.writeFileSync(file, content, 'utf8');
    console.log('Profile Card Applied:', path.basename(file));
});

console.log('\\nDone! Profile card applied to', files.length, 'files.');
