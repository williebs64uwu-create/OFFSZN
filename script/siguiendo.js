let followingData = {
    sidebar: null,
    list: []
};

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, function (m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inject Skeletons IMMEDIATELY
    injectSkeletons();

    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = '/pages/login.html';
        return;
    }

    const userId = session.user.id;

    // 2. Start Minimum Wait Timer (2s)
    const timerPromise = new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Start Data Fetching
    const fetchPromise = Promise.all([
        loadSidebarData(userId),
        fetchFollowingList(userId)
    ]);

    // 4. Wait for BOTH (Timer + Data) to finish
    try {
        await Promise.all([timerPromise, fetchPromise]);
    } catch (err) {
        // Log generic error
    } finally {
        // 5. Render and Reveal Everything Simultaneously
        renderEverything();
        removeSkeletons();
    }
});

async function loadSidebarData(userId) {
    try {
        const { data: user, error } = await supabaseClient
            .from('users')
            .select('nickname, role, avatar_url')
            .eq('id', userId)
            .single();

        if (error) throw error;
        followingData.sidebar = user;
    } catch (err) {
        // Silently fail or log generic
    }
}

async function fetchFollowingList(userId) {
    try {
        // 1. Get IDs of users I follow
        const response = await fetch('/api/me/following', {
            headers: {
                'Authorization': `Bearer ${(await supabaseClient.auth.getSession()).data.session.access_token}`
            }
        });

        if (!response.ok) throw new Error('Error fetching following list');
        const followingIds = await response.json();

        if (!followingIds || followingIds.length === 0) {
            followingData.list = [];
            return;
        }

        // 2. Fetch profile details for these users
        const { data: profiles, error: profileError } = await supabaseClient
            .from('users')
            .select('id, nickname, first_name, last_name, avatar_url, role, is_verified, bio')
            .in('id', followingIds);

        if (profileError) throw profileError;

        // 3. Get follower counts for each user in parallel
        const countPromises = profiles.map(profile =>
            supabaseClient
                .from('followers')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', profile.id)
                .then(({ count, error }) => ({ id: profile.id, count: error ? 0 : count }))
        );

        const results = await Promise.all(countPromises);
        const followerCounts = {};
        results.forEach(res => {
            followerCounts[res.id] = res.count || 0;
        });

        profiles.forEach(profile => {
            profile.follower_count = followerCounts[profile.id] || 0;
        });

        followingData.list = profiles;
    } catch (err) {
        followingData.list = null; // Error state
    }
}

function renderEverything() {
    // Sidebar
    if (followingData.sidebar) {
        const user = followingData.sidebar;
        const sidebarAvatar = document.getElementById('sidebarAvatar');
        const sidebarName = document.getElementById('sidebarName');
        const sidebarRole = document.getElementById('sidebarRole');

        if (sidebarName) sidebarName.textContent = user.nickname || 'Usuario';
        if (sidebarRole) sidebarRole.textContent = user.role || 'Productor';

        if (sidebarAvatar) {
            if (user.avatar_url) {
                sidebarAvatar.innerHTML = '';
                const img = document.createElement('img');
                img.src = user.avatar_url;
                img.alt = "Avatar";
                // img.crossOrigin = "anonymous";
                img.style.cssText = "width:100%; height:100%; border-radius:50%; object-fit:cover;";
                sidebarAvatar.appendChild(img);
            } else {
                sidebarAvatar.textContent = (user.nickname || 'U').charAt(0).toUpperCase();
            }
        }
    }

    // Main Grid
    const container = document.getElementById('followingList');
    if (!container) return;

    if (followingData.list === null) {
        container.innerHTML = `<p style="color:red; grid-column:1/-1;">Error al cargar la lista.</p>`;
        return;
    }

    if (followingData.list.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
                <i class="bi bi-people" style="font-size: 3rem; display: block; margin-bottom: 10px;"></i>
                <p>Aún no sigues a nadie.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    followingData.list.forEach(profile => {
        const card = createProducerCard(profile);
        container.appendChild(card);
    });
}

function injectSkeletons() {
    // Sidebar
    const name = document.getElementById('sidebarName');
    const role = document.getElementById('sidebarRole');
    const avatar = document.getElementById('sidebarAvatar');
    if (name) name.classList.add('skeleton-base', 'skeleton-name');
    if (role) role.classList.add('skeleton-base', 'skeleton-role');
    if (avatar) avatar.classList.add('skeleton-base', 'skeleton-avatar');

    // Main Grid
    const skeleton = document.getElementById('followingSkeleton');
    const list = document.getElementById('followingList');
    if (skeleton) skeleton.style.display = 'grid';
    if (list) list.style.display = 'none';
}

function removeSkeletons() {
    const name = document.getElementById('sidebarName');
    const role = document.getElementById('sidebarRole');
    const avatar = document.getElementById('sidebarAvatar');

    if (name) name.classList.remove('skeleton-base', 'skeleton-name');
    if (role) role.classList.remove('skeleton-base', 'skeleton-role');
    if (avatar) avatar.classList.remove('skeleton-base', 'skeleton-avatar');

    const skeleton = document.getElementById('followingSkeleton');
    const list = document.getElementById('followingList');
    if (skeleton) skeleton.style.display = 'none';
    if (list) list.style.display = 'grid';
}

function createProducerCard(user) {
    const card = document.createElement('div');
    card.className = 'following-card';
    card.style.cssText = `
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 24px 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 12px;
        transition: all 0.3s ease;
        cursor: pointer;
        position: relative;
        aspect-ratio: 1 / 1.15;
        width: 100%;
        max-width: 260px;
    `;

    // Hover effect
    card.onmouseenter = () => {
        card.style.background = 'rgba(255, 255, 255, 0.05)';
        card.style.borderColor = 'rgba(139, 92, 246, 0.3)';
        card.style.transform = 'translateY(-4px)';
    };
    card.onmouseleave = () => {
        card.style.background = 'rgba(255, 255, 255, 0.03)';
        card.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        card.style.transform = 'translateY(0)';
    };

    // Click handler for entire card
    card.onclick = (e) => {
        // Don't navigate if clicking the message button
        if (!e.target.closest('.message-btn')) {
            window.location.href = `/@${user.nickname}`;
        }
    };

    const nicknameEscaped = escapeHTML(user.nickname);
    const initial = (nicknameEscaped || escapeHTML(user.first_name) || 'U').charAt(0).toUpperCase();
    const avatarUrl = user.avatar_url;

    // Sanitize nickname for handle error to prevent XSS in attribute
    const nicknameForError = nicknameEscaped.replace(/'/g, "\\'");

    const avatarContent = avatarUrl
        ? `<img src="${avatarUrl}" alt="${nicknameEscaped}" onerror="if(window.AvatarManager) window.AvatarManager.handleError(this, '${nicknameForError}')" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
        : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background: #222; border: 1px solid #333; border-radius:50%; font-size:2.5rem; font-weight:700; color:#fff;">${initial}</div>`;

    // Get follower count
    const followerCount = parseInt(user.follower_count) || 0;
    const roleEscaped = escapeHTML(user.role || 'Productor');

    card.innerHTML = `
        <div style="width: 80px; height: 80px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(255, 255, 255, 0.1); flex-shrink: 0; margin-bottom: 8px;" 
             data-artist="${user.id}" onmouseenter="showArtistCard(event, this)" onmouseleave="hideArtistCard(event, this)">
            ${avatarContent}
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px; width: 100%; flex: 1; min-height: 0; overflow: hidden;">
            <div style="font-size: 0.9rem; font-weight: 600; color: #fff; display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                 data-artist="${user.id}" onmouseenter="showArtistCard(event, this)" onmouseleave="hideArtistCard(event, this)">
                ${nicknameEscaped}
                ${user.is_verified ? '<i class="bi bi-patch-check-fill" style="color: #fff; font-size: 0.8rem;"></i>' : ''}
            </div>
            <div style="font-size: 0.75rem; color: #999; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${roleEscaped}
            </div>
            <div style="font-size: 0.7rem; color: #666; margin-top: 2px;">
                <i class="bi bi-people" style="margin-right: 2px;"></i>${followerCount} ${followerCount === 1 ? 'seguidor' : 'seguidores'}
            </div>
        </div>
        <button class="message-btn" style="
            width: 100%;
            padding: 6px 12px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            color: #fff;
            font-size: 0.75rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            margin-top: auto;
        ">
            <i class="bi bi-chat-dots"></i> Mensaje
        </button>
    `;

    // Add message button handler
    const messageBtn = card.querySelector('.message-btn');
    messageBtn.addEventListener('mouseenter', function () {
        this.style.background = '#fff';
        this.style.color = '#000';
        this.style.borderColor = '#fff';
    });
    messageBtn.addEventListener('mouseleave', function () {
        this.style.background = 'transparent';
        this.style.color = '#fff';
        this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });
    messageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.location.href = `/mensajes.html?user=${encodeURIComponent(user.nickname)}`;
    });

    return card;
}
