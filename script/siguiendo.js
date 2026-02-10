// script/siguiendo.js


document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = '/pages/login.html';
        return;
    }

    const userId = session.user.id;

    // Initialize Sidebar User Info
    await loadSidebarInfo(userId);

    // Load Following List
    await loadFollowingList(userId);
});

async function loadSidebarInfo(userId) {
    try {
        const { data: user, error } = await supabaseClient
            .from('users')
            .select('nickname, role, avatar_url')
            .eq('id', userId)
            .single();

        if (error) throw error;

        const sidebarAvatar = document.getElementById('sidebarAvatar');
        const sidebarName = document.getElementById('sidebarName');
        const sidebarRole = document.getElementById('sidebarRole');

        if (sidebarName) sidebarName.textContent = user.nickname || 'Usuario';
        if (sidebarRole) sidebarRole.textContent = user.role || 'Productor';

        if (sidebarAvatar) {
            if (user.avatar_url) {
                sidebarAvatar.innerHTML = `<img src="${user.avatar_url}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            } else {
                sidebarAvatar.textContent = (user.nickname || 'U').charAt(0).toUpperCase();
            }
        }
    } catch (err) {
        console.error("Error loading sidebar info:", err);
    }
}

async function loadFollowingList(userId) {
    const container = document.getElementById('followingList');
    const skeleton = document.getElementById('followingSkeleton');
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
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
                    <i class="bi bi-people" style="font-size: 3rem; display: block; margin-bottom: 10px;"></i>
                    <p>Aún no sigues a nadie.</p>
                </div>
            `;
            return;
        }

        // 2. Fetch profile details for these users
        const { data: profiles, error: profileError } = await supabaseClient
            .from('users')
            .select('id, nickname, first_name, last_name, avatar_url, role, is_verified, bio')
            .in('id', followingIds);

        if (profileError) throw profileError;

        // 3. Get follower counts for each user
        const followerCounts = {};
        for (const profile of profiles) {
            const { count, error: countError } = await supabaseClient
                .from('followers')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', profile.id);

            if (!countError) {
                followerCounts[profile.id] = count || 0;
            }
        }

        // Add follower counts to profiles
        profiles.forEach(profile => {
            profile.follower_count = followerCounts[profile.id] || 0;
        });

        // 4. Render cards
        container.innerHTML = '';
        profiles.forEach(profile => {
            const card = createProducerCard(profile);
            container.appendChild(card);
        });

        // Toggle visibility
        if (skeleton) skeleton.style.display = 'none';
        if (container) container.style.display = 'grid';

    } catch (err) {
        console.error("Error loading following list:", err);
        if (skeleton) skeleton.style.display = 'none';
        if (container) {
            container.style.display = 'grid';
            container.innerHTML = `<p style="color:red; grid-column:1/-1;">Error al cargar la lista.</p>`;
        }
    }
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

    const initial = (user.nickname || user.first_name || 'U').charAt(0).toUpperCase();
    const avatarContent = user.avatar_url
        ? `<img src="${user.avatar_url}" alt="${user.nickname}" onerror="if(window.AvatarManager) window.AvatarManager.handleError(this, '${user.nickname.replace(/'/g, "\\'")}')" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
        : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background: #222; border: 1px solid #333; border-radius:50%; font-size:2.5rem; font-weight:700; color:#fff;">${initial}</div>`;

    // Get follower count (will be 0 for now, we'll add the real count later)
    const followerCount = user.follower_count || 0;

    card.innerHTML = `
        <div style="width: 80px; height: 80px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(255, 255, 255, 0.1); flex-shrink: 0; margin-bottom: 8px;">
            ${avatarContent}
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px; width: 100%; flex: 1; min-height: 0; overflow: hidden;">
            <div style="font-size: 0.9rem; font-weight: 600; color: #fff; display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${user.nickname}
                ${user.is_verified ? '<i class="bi bi-patch-check-fill" style="color: #fff; font-size: 0.8rem;"></i>' : ''}
            </div>
            <div style="font-size: 0.75rem; color: #999; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${user.role || 'Productor'}
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

