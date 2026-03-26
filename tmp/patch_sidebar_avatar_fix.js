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

// The JS snippet - ADDED FIX FOR FULL URLs (ImageKit/Cloudinary)
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
                // Try profiles table as backup
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
                        // 🔥 FIX: If it's a full URL (ImageKit/Cloudinary) and NOT Supabase, use it directly.
                        // Passing external URLs to getAuthorizedUrl corrupts them and causes CORB errors.
                        if (typeof avatar === 'string' && avatar.startsWith('http') && !avatar.includes('supabase.co')) {
                            avatarEl.src = avatar;
                        } else if (window.AuthUtils && window.AuthUtils.getAuthorizedUrl) {
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
    const oldJSPattern = /<!-- Sidebar Profile Loader -->[\s\S]*?<\/script>/;
    content = content.replace(oldJSPattern, '');

    // 1. Inject the FIXED JS
    if (!content.includes('loadSidebarProfile')) {
        content = content.replace('</body>', profileJS + '\n</body>');
    }

    fs.writeFileSync(file, content, 'utf8');
    console.log('Profile JS Fixed (URL Logic):', path.basename(file));
});

console.log('\\nDone! Avatar URL logic fixed in', files.length, 'files.');
