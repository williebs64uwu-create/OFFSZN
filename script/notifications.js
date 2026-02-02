(function () {
    /* ---------- NOTIFICATIONS SYSTEM ---------- */

    // We rely on window.supabaseClient being available or passed in
    let sbClient = null;
    let currentUserId = null;

    window.NotificationsManager = {
        renderedIds: [],
        _lastMarkRead: 0, // Cooldown tracker

        init: function () {
            // UI Setup only
            document.addEventListener('click', e => {
                const dropdown = document.querySelector('.notification-dropdown');
                const btn = document.querySelector('.notification-dropdown .navbar-icon-button');
                const icon = btn ? btn.querySelector('i') : null;
                if (dropdown && !dropdown.contains(e.target) && e.target !== btn && e.target !== icon) {
                    dropdown.classList.remove('active');
                }
            });

            // INSTANT LOAD: Check LocalStorage
            const cachedCount = localStorage.getItem('notificationCount');
            if (cachedCount && cachedCount !== '0') {
                const badge = document.getElementById('notification-badge');
                if (badge) {
                    badge.innerText = cachedCount;
                    badge.style.display = 'flex';
                }
            }

            // Subscribe if user already exists
            if (currentUserId) this.subscribe();
        },

        setUser: function (user) {
            sbClient = window.supabaseClient;

            if (!sbClient) return;

            // Prevent redundant updates (fixes Alt+Tab log flood)
            if (user?.id === currentUserId) return;

            if (user && user.id) {
                currentUserId = user.id;
                this.fetch();
                this.subscribe();

                // --- GLOBAL: Fetch Following List for Hover Cards ---
                // FIX: Use API instead of direct table access to avoid 400 Bad Request / RLS issues
                if (!window.currentUserFollowing) {
                    window.currentUserFollowing = new Set();

                    const fetchFollowing = async () => {
                        const { data: { session } } = await sbClient.auth.getSession();
                        if (session?.access_token) {
                            try {
                                const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                                    ? 'http://localhost:3000/api'
                                    : 'https://offszn-oc7c.onrender.com/api';

                                const res = await fetch(`${API_URL}/me/following`, {
                                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                                });
                                if (res.ok) {
                                    const ids = await res.json();
                                    if (Array.isArray(ids)) {
                                        window.currentUserFollowing = new Set(ids);
                                        console.log(`[Notifications] Loaded ${ids.length} following IDs (via API).`);
                                    }
                                }
                            } catch (err) {
                                console.warn("[Notifications] Failed to fetch following list", err);
                            }
                        }
                    };
                    fetchFollowing();
                }
            } else {
                currentUserId = null;
                window.currentUserFollowing = new Set(); // Clear on logout
                this.render([]);
            }
        },

        updateBadge: function (count) {
            const badge = document.getElementById('notification-badge');
            if (badge) {
                badge.innerText = count;
                badge.style.display = count > 0 ? 'flex' : 'none';
            }
            try {
                localStorage.setItem('notificationCount', count);
            } catch (e) { /* ignore */ }
        },

        fetch: async function () {
            if (!currentUserId) return;

            // Use GLOBAL AuthUtils
            const headers = window.AuthUtils.getAuthHeaderObj();
            if (!headers.Authorization) return; // No token, no fetch

            try {
                // 1. Get Unread Count
                const countRes = await window.supabaseClient
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', currentUserId)
                    .eq('read', false); // Only count unread

                if (countRes.error) throw countRes.error;

                // Update Badge
                window.NotificationsManager.updateBadge(countRes.count || 0);

                // 2. Fetch Recent Notifications (Limit 50)
                const { data: notifs, error } = await window.supabaseClient
                    .from('notifications')
                    .select('*')
                    .eq('user_id', currentUserId)
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (error) throw error;

                const invites = []; // Placeholder if not fetched in this simplified version
                const acceptedInvites = []; // Placeholder

                const pendingList = invites || [];
                const acceptedList = acceptedInvites || [];

                // 3. Virtual Notifications Construction
                const readInvites = JSON.parse(localStorage.getItem('readInvites') || '[]');
                const deletedNotifs = JSON.parse(localStorage.getItem('deletedNotifs') || '[]');

                // --- ENHANCEMENT: Collect Actor IDs AND Product IDs ---
                const actorIds = new Set();
                const productIds = new Set();

                (notifs || []).forEach(n => {
                    if (n.type === 'product_like' && n.data?.liker_id) actorIds.add(n.data.liker_id);
                    if (n.type === 'product_like' && n.data?.product_id) productIds.add(n.data.product_id);
                    if (n.type === 'new_follower' && n.data?.follower_id) actorIds.add(n.data.follower_id);
                });

                // Fetch Actors
                let actorsMap = {};
                if (actorIds.size > 0) {
                    const { data: actors } = await sbClient
                        .from('users')
                        .select('id, nickname, first_name, last_name, avatar_url')
                        .in('id', Array.from(actorIds));
                    if (actors) actors.forEach(u => actorsMap[u.id] = u);
                }

                // Fetch Products (New)
                let productsMap = {};
                if (productIds.size > 0) {
                    const { data: products } = await sbClient
                        .from('products')
                        .select('id, name, product_type')
                        .in('id', Array.from(productIds));
                    if (products) products.forEach(p => productsMap[p.id] = p);
                }

                // Process Standard Notifications with Rich HTML
                const processedNotifs = (notifs || []).map(n => {
                    let finalMessage = n.message;
                    let finalTitle = n.title;

                    if (n.type === 'product_like' && n.data?.liker_id) {
                        const actor = actorsMap[n.data.liker_id];
                        if (actor) {
                            const name = actor.nickname || actor.first_name || 'Alguien';
                            const nameHtml = `<strong class="artist-hover-trigger" data-username="${name}" style="cursor:pointer;">${name}</strong>`;

                            // Product Logic
                            let prodName = 'tu producto';
                            let categoryLabel = 'producto';

                            // Try to get from Map first (freshest), fall back to notification snapshot
                            if (n.data?.product_id && productsMap[n.data.product_id]) {
                                const p = productsMap[n.data.product_id];
                                prodName = p.name;
                                const cat = p.product_type || 'beat';
                                categoryLabel = cat === 'beat' ? 'Beat' : (cat.charAt(0).toUpperCase() + cat.slice(1));
                            } else if (n.data?.product_name) {
                                prodName = n.data.product_name;
                            }

                            // Reconstruct message: "A [Name] le gustó tu [Category] "[Prod]""
                            finalMessage = `A ${nameHtml} le gustó tu ${categoryLabel} <strong>"${prodName}"</strong>.`;
                        }
                    } else if (n.type === 'new_follower' && n.data?.follower_id) {
                        const actor = actorsMap[n.data.follower_id];
                        if (actor) {
                            const name = actor.nickname || actor.first_name || 'Alguien';
                            // FIX: User request - Underline, Link to Profile, NO HOVER CARD
                            // Fix: Add data-artist for hover-card.js compatibility
                            const artistData = JSON.stringify({ nickname: name }).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

                            const nameHtml = `<strong class="artist-hover-trigger" 
                                                      data-artist='${artistData}'
                                                      data-id="${n.data.follower_id}" 
                                                      onmouseenter="window.showArtistCard(event, this)" 
                                                      onmouseleave="window.hideArtistCard(event, this)"
                                                      onclick="window.openProfile('${n.data.follower_id}', event)" 
                                                      style="cursor:pointer;">${name}</strong>`;
                            finalMessage = `${nameHtml} comenzó a seguirte.`;
                        }
                    }

                    return {
                        ...n,
                        message: finalMessage,
                        title: finalTitle
                    };
                });

                // A. Pending Invites
                const inviteNotifs = pendingList.map(invite => {
                    const name = invite.inviter?.nickname || invite.inviter?.first_name || 'Alguien';
                    const prodName = invite.product?.name || 'un producto';
                    const cat = invite.product?.product_type || 'beat';
                    const catLabel = cat === 'beat' ? 'Beat' : (cat.charAt(0).toUpperCase() + cat.slice(1));
                    const inviteId = `invite-${invite.id}`;
                    const percent = invite.royalty_percent ? `(${invite.royalty_percent}%)` : '';
                    const nameHtml = `<strong class="artist-hover-trigger" data-username="${name}" style="cursor:pointer;">${name}</strong>`;

                    return {
                        id: inviteId,
                        type: 'collab_invitation',
                        title: '¡Invitación Pendiente!',
                        message: `${nameHtml} te invita a colaborar en el ${catLabel} <strong>"${prodName}"</strong> ${percent}.`,
                        created_at: invite.created_at,
                        read: readInvites.includes(inviteId),
                        data: { ...invite }
                    };
                });

                // B. Accepted Invites
                const acceptedNotifs = acceptedList.map(invite => {
                    const name = invite.collaborator?.nickname || invite.collaborator?.first_name || 'Un usuario';
                    const nameHtml = `<strong class="artist-hover-trigger" data-username="${name}" style="cursor:pointer;">${name}</strong>`;

                    const notifId = `accepted-${invite.id}`;
                    return {
                        id: notifId,
                        type: 'collab_accepted',
                        title: '¡Colaboración Aceptada!',
                        message: `${nameHtml} aceptó tu invitación.`,
                        created_at: invite.updated_at || invite.created_at,
                        read: readInvites.includes(notifId)
                    };
                });

                // 4. Merge
                let mixedList = [...inviteNotifs, ...acceptedNotifs, ...processedNotifs];

                // Filter out deleted AND Self-Likes
                mixedList = mixedList.filter(n => {
                    if (deletedNotifs.includes(n.id)) return false;
                    if (n.type === 'product_like' && n.data?.liker_id === currentUserId) return false;
                    return true;
                });

                // Sort by Date DESC
                mixedList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                // Strict Limit
                const finalDisplay = mixedList.slice(0, 50);

                this.render(finalDisplay);

                // DISPATCH EVENT FOR SYNC
                window.dispatchEvent(new CustomEvent('notifications-updated', {
                    detail: { count: finalDisplay.length }
                }));

            } catch (err) {
                console.warn('Error fetching notifications:', err);
            }
        },

        render: function (notifications) {
            if (notifications) this.renderedIds = notifications.map(n => n.id);

            // 🛡️ TARGETS: Check for both Global Dropdown AND Main Page List
            const dropdownList = document.getElementById('notification-list');
            const mainList = document.getElementById('full-notification-list'); // Main Page ID

            const badge = document.getElementById('notification-badge');

            if (notifications) {
                const unreadCount = notifications.filter(n => !n.read).length;
                this.updateBadge(unreadCount);
            }

            // Exit only if NEITHER list exists
            if (!dropdownList && !mainList) return;

            const html = (!notifications || notifications.length === 0)
                ? `
                <div class="notif-empty" style="text-align: center; color: #fff; padding: 40px 20px;">
                    <div style="font-size: 2rem; margin-bottom: 16px; color: #333;"><i class="bi bi-bell-slash"></i></div>
                    <h4 style="margin-bottom: 8px; font-size: 0.9rem; font-weight: 500; color:#666;">Sin notificaciones</h4>
                    <p style="font-size:0.75rem; color:#444;">Te avisaremos cuando haya actividad.</p>
                </div>`
                : notifications.map(n => {
                    const isReal = !n.id.startsWith('invite-') && !n.id.startsWith('accepted-');
                    let extraId = '';
                    if (n.type === 'product_like') extraId = n.data?.product_id || '';
                    else if (n.type === 'new_follower') extraId = n.data?.follower_id || '';

                    return `
                        <div class="notification-item ${n.read ? '' : 'unread'}" onclick="handleNotificationClick('${n.id}', '${n.type}', '${extraId}')">
                            <div class="notif-icon ${n.type}">
                                <i class="fas ${this.getIcon(n.type)}"></i>
                            </div>
                            <div class="notif-content">
                                <div class="notif-title">${n.title || 'Notificación'}</div>
                                <div class="notif-message">${n.message}</div>
                                <div class="notif-time">${timeAgo(n.created_at)}</div>
                            </div>
                        </div>
                    `;
                }).join('');


            // ✅ Populates BOTH lists if they exist
            if (dropdownList) dropdownList.innerHTML = html;
            if (mainList) mainList.innerHTML = html;

            // --- Re-Init Hover Cards ---
            if (window.HoverCardManager) {
                setTimeout(() => window.HoverCardManager.initTriggers(), 50);
            }

            setTimeout(() => {
                if (window.HoverCardManager && window.HoverCardManager.initTriggers) {
                    window.HoverCardManager.initTriggers();
                } else if (typeof initHoverCards === 'function') {
                    initHoverCards();
                }
            }, 100);
        },

        subscribe: function () {
            if (!currentUserId || !sbClient) return;

            const channel = sbClient.channel('public:notifications_invites');

            // 1. General Notifications
            channel.on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${currentUserId}`
            }, payload => {
                this.fetch();
            })

                // 2. Collab Invitations (Incoming)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'collab_invitations',
                    filter: `collaborator_id=eq.${currentUserId}`
                }, payload => {
                    this.fetch();
                })

                // 3. Collab Accepted (Outgoing Updates)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'collab_invitations',
                    filter: `inviter_id=eq.${currentUserId}`
                }, payload => {
                    if (payload.new.status === 'accepted') {
                        this.fetch();
                    }
                })
                .subscribe();
        },

        getIcon: function (type) {
            switch (type) {
                case 'collab_invitation': return 'fa-handshake';
                case 'collab_accepted': return 'fa-check-circle';
                case 'new_follower': return 'fa-user-plus';
                case 'product_like': return 'fa-heart text-danger';
                case 'product_published': return 'fa-rocket';
                default: return 'fa-bell';
            }
        },

        markAllAsRead: async function () {
            // Cooldown: Prevent double-clicks or spam (5 seconds)
            const now = Date.now();
            if (this._lastMarkRead && (now - this._lastMarkRead < 5000)) {
                console.log("Cooldown active for markAllAsRead");
                return;
            }
            this._lastMarkRead = now;

            console.log("Marking all as read...");
            if (!currentUserId || !sbClient) return;

            // 1. Mark virtuals as read in localStorage
            if (this.renderedIds) {
                const readInvites = JSON.parse(localStorage.getItem('readInvites') || '[]');
                const virtuals = this.renderedIds.filter(id => id.startsWith('invite-') || id.startsWith('accepted-'));
                virtuals.forEach(id => {
                    if (!readInvites.includes(id)) readInvites.push(id);
                });
                localStorage.setItem('readInvites', JSON.stringify(readInvites));
            }

            // 2. Mark DB notifications as read
            try {
                await sbClient.from('notifications')
                    .update({ read: true })
                    .eq('user_id', currentUserId)
                    .eq('read', false);

                // Refresh UI immediately
                this.fetch();
            } catch (err) {
                console.error("Error marking all read:", err);
            }
        },

        // --- Visual Delete Functionality ---
        deleteNotification: async function (id, type) {
            console.log(`[Dropdown] Visual delete for: ${id}`);
            const deleted = JSON.parse(localStorage.getItem('deletedNotifs') || '[]');
            if (!deleted.includes(id)) {
                deleted.push(id);
                localStorage.setItem('deletedNotifs', JSON.stringify(deleted));
            }
            this.fetch();
        }
    };


    // --- Global Helpers for Onclick ---



    window.triggerDeleteNotif = function (id, type, event) {
        if (event) event.stopPropagation();
        window.NotificationsManager.deleteNotification(id, type);
    };

    window.triggerViewDetails = function (id, type, extraId, event) {
        if (event) event.stopPropagation();

        console.log("View Details Triggered:", type, extraId);

        // Logic based on type
        if (type === 'new_follower') {
            // "comenzó a seguirte" => Perfil
            if (extraId && extraId !== 'undefined') {
                window.location.href = `/usuarios.html?id=${extraId}`;
            } else {
                console.warn("No follower ID found");
            }
        }
        else if (type === 'collab_invitation') {
            // "Has sido invitado a algo" => Colaboraciones (Recibidas)
            window.location.href = '/cuenta/colaboraciones.html?tab=recibidas';
        }
        else if (type === 'product_like') {
            // "le gusto tu producto" => Product Page
            if (extraId && extraId !== 'undefined') {
                window.location.href = `/producto.html?id=${extraId}`;
            } else {
                // Fallback if product ID is missing
                window.location.href = '/cuenta/mis-kits.html';
            }
        }
        else if (type === 'collab_accepted') {
            // "Accepted" => View in My Invitations
            window.location.href = '/cuenta/colaboraciones.html?tab=mis-invitaciones';
        }
        else {
            // Default fallback for others
            console.log("Unknown type for view details:", type);
        }
    };

    window.handleNotificationClick = async function (id, type, extraId) {
        // Optimistic UI Update
        const badge = document.getElementById('notification-badge');
        const count = parseInt(localStorage.getItem('notificationCount') || '0');
        if (count > 0) {
            const newCount = count - 1;
            localStorage.setItem('notificationCount', newCount);
            if (badge) {
                badge.innerText = newCount;
                if (newCount === 0) badge.style.display = 'none';
            }
        }

        // 1. Handle Virtual (Local Storage)
        if (id.startsWith('invite-') || id.startsWith('accepted-')) {
            const readInvites = JSON.parse(localStorage.getItem('readInvites') || '[]');
            if (!readInvites.includes(id)) {
                readInvites.push(id);
                localStorage.setItem('readInvites', JSON.stringify(readInvites));
            }
        }
        // 2. Handle Real Notifications (DB)
        else if (sbClient) {
            await sbClient.from('notifications').update({ read: true }).eq('id', id);
        }

        // Redirect Logic
        if (type === 'collab_invitation') {
            window.location.href = '/cuenta/colaboraciones.html?tab=recibidas';
        } else if (type === 'collab_accepted') {
            window.location.href = '/cuenta/colaboraciones.html?tab=mis-invitaciones';
        } else if (type === 'new_follower') {
            if (extraId) {
                window.location.href = `/usuarios.html?id=${extraId}`;
            } else {
                window.location.reload();
            }
        } else if (type === 'product_like') {
            if (extraId && extraId !== 'undefined') {
                // Redirect to PUBLIC product page
                window.location.href = `/producto.html?id=${extraId}`;
            } else {
                window.location.href = '/cuenta/subir-kit.html';
            }
        }


        // Background Refresh
        window.NotificationsManager.fetch();
    };

    // Utils
    // Helper for safely opening profiles (Global)
    window.openProfile = function (id, event) {
        if (event) {
            event.preventDefault(); // Stop link default
            event.stopPropagation(); // Stop bubbling to parent notification-item
        }
        if (id && id !== 'undefined' && id !== 'null') {
            window.location.href = `/usuarios.html?id=${id}`;
        } else {
            console.warn('Cannot open profile: Invalid ID', id);
        }
    };

    function timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return "Hace " + Math.floor(interval) + " años";
        interval = seconds / 2592000;
        if (interval > 1) return "Hace " + Math.floor(interval) + " meses";
        interval = seconds / 86400;
        if (interval > 1) return "Hace " + Math.floor(interval) + " d";
        interval = seconds / 3600;
        if (interval > 1) return "Hace " + Math.floor(interval) + " h";
        interval = seconds / 60;
        if (interval > 1) return "Hace " + Math.floor(interval) + " min";
        return "Hace un momento";
    }

    // Init UI listeners immediately
    document.addEventListener('DOMContentLoaded', () => {
        window.NotificationsManager.init();
    });

})();
