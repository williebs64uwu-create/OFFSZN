(function () {
    /* ---------- NOTIFICATIONS SYSTEM ---------- */

    // We rely on window.supabaseClient being available or passed in
    let sbClient = null;
    let currentUserId = null;

    // --- DEFENSIVE SAFEGUARDS: Polyfill Link Generators if id-obfuscator.js is missing ---
    if (typeof window.createProfileLink !== 'function') {
        window.createProfileLink = function (user) {
            if (!user) return '#';
            if (user.nickname) return `/@${user.nickname}`;
            if (user.id) return `/perfil-publico.html?id=${user.id}`;
            return '#';
        };
    }
    if (typeof window.createSeoLink !== 'function') {
        window.createSeoLink = function (product) {
            if (!product) return '#';
            if (product.public_slug) return `/beat/${product.public_slug}`;
            return `/producto.html?id=${product.id}`;
        };
    }

    console.log("[Notifications] System v26 - Loaded");
    // --- IMMEDIATE ACTION: Kill any phantom placeholders (like "4") as soon as script loads ---
    (function () {
        const badge = document.getElementById('notification-badge');
        if (badge) {
            badge.innerText = '0';
            badge.style.display = 'none';
        }
        localStorage.removeItem('notificationCount');
    })();

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
                // IMPLEMENTED: Cap display at +9 for counts > 9 as requested.
                badge.innerText = count > 9 ? '+9' : count;
                badge.style.display = count > 0 ? 'flex' : 'none';
            }
            // Removed localStorage caching completely to prevent stale data flickers.
        },

        fetch: async function () {
            if (!currentUserId) return;

            // Use GLOBAL AuthUtils
            const headers = window.AuthUtils.getAuthHeaderObj();
            if (!headers.Authorization) return; // No token, no fetch

            try {
                // UNREAD FILTER: Only count notifications from the last 10 days
                const tenDaysAgo = new Date();
                tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
                const dateIso = tenDaysAgo.toISOString();

                // 1. Get Unread Count (Filtered by date)
                const countRes = await window.supabaseClient
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', currentUserId)
                    .eq('read', false)
                    .gt('created_at', dateIso); // Ignore old "buggy" notifications

                if (countRes.error) throw countRes.error;

                // Update Badge
                // Deleted premature updateBadge to prevent "4" flicker.

                // 2. Fetch Recent Notifications (Limit 50, strictly > 10 days)
                const { data: notifs, error } = await window.supabaseClient
                    .from('notifications')
                    .select('*')
                    .eq('user_id', currentUserId)
                    .gt('created_at', dateIso)
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
                    if (n.type === 'new_follower') {
                        // ROBUST: Check for follower_id OR data.id if data is the follower record
                        const fid = n.data?.follower_id || n.data?.id || (n.data?.user_id !== currentUserId ? n.data?.user_id : null);
                        if (fid) {
                            actorIds.add(fid);
                        } else {
                            // FALLBACK: Extract username from message if data is null (Legacy/Broken notifications)
                            // Message format: "<strong>username</strong> te empezó a seguir."
                            const match = n.message && n.message.match(/<strong[^>]*>(.*?)<\/strong>/);
                            if (match && match[1]) {
                                n._extractedUsername = match[1]; // Store for later
                            }
                        }
                    }
                });

                // Fetch Actors (By ID and Username)
                let actorsMap = {};
                let actorsByNameMap = {}; // New map for username lookup

                // 1. Fetch by ID
                if (actorIds.size > 0) {
                    const { data: actors } = await sbClient
                        .from('users')
                        .select('id, nickname, first_name, last_name, avatar_url')
                        .in('id', Array.from(actorIds));
                    if (actors) actors.forEach(u => {
                        actorsMap[u.id] = u;
                        if (u.nickname) actorsByNameMap[u.nickname] = u;
                    });
                }

                // 2. Fetch by Username (Rescue)
                const usernamesToFetch = new Set();
                (notifs || []).forEach(n => {
                    if (n._extractedUsername && !Object.values(actorsMap).some(u => u.nickname === n._extractedUsername)) {
                        usernamesToFetch.add(n._extractedUsername);
                    }
                });

                if (usernamesToFetch.size > 0) {
                    const { data: rescued } = await sbClient
                        .from('users')
                        .select('id, nickname, first_name, last_name, avatar_url')
                        .in('nickname', Array.from(usernamesToFetch));

                    if (rescued) rescued.forEach(u => {
                        actorsMap[u.id] = u; // Add to main map too
                        if (u.nickname) actorsByNameMap[u.nickname] = u;
                    });
                }

                // Fetch Products (New)
                let productsMap = {};
                if (productIds.size > 0) {
                    const { data: products } = await sbClient
                        .from('products')
                        .select('id, name, product_type, public_slug')
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
                    } else if (n.type === 'new_follower') {
                        const fid = n.data?.follower_id || n.data?.id || (n.data?.user_id !== currentUserId ? n.data?.user_id : null);

                        // Try by ID first, then by extracted username
                        let actor = fid ? actorsMap[fid] : null;
                        if (!actor && n._extractedUsername) {
                            actor = actorsByNameMap[n._extractedUsername];
                        }

                        if (actor) {
                            const name = actor.nickname || actor.first_name || 'Alguien';
                            // Fix: User request - Underline, Link to Profile, NO HOVER CARD
                            // Fix: Add data-artist for hover-card.js compatibility
                            const artistData = JSON.stringify({ nickname: name }).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                            const profileUrl = window.createProfileLink(actor); // Generate SEO link

                            const nameHtml = `<strong class="artist-hover-trigger" 
                                                      data-artist='${artistData}'
                                                      data-id="${actor.id}" 
                                                      onmouseenter="window.showArtistCard(event, this)" 
                                                      onmouseleave="window.hideArtistCard(event, this)"
                                                      onclick="event.stopPropagation(); window.location.href='${profileUrl}'" 
                                                      style="cursor:pointer;">${name}</strong>`;
                            finalMessage = `${nameHtml} comenzó a seguirte.`;
                        } else {
                            // If actor NOT found (Deleted user or Name changed + Legacy Notif), strip interactive elements to avoid 404s
                            finalMessage = finalMessage.replace(/class="[^"]*artist-hover-trigger[^"]*"/g, '')
                                .replace(/data-username="[^"]*"/g, '')
                                .replace(/data-artist='[^']*'/g, '')
                                .replace(/onclick="[^"]*"/g, '')
                                .replace(/style="cursor:pointer;"/g, '');
                        }


                    }


                    return {
                        ...n,
                        message: finalMessage,
                        title: finalTitle,
                        targetUrl: (n.type === 'product_like' && n.data?.product_id && productsMap[n.data.product_id])
                            ? window.createSeoLink(productsMap[n.data.product_id])
                            : (n.type === 'new_follower')
                                ? (function () {
                                    const fid = n.data?.follower_id || n.data?.id || (n.data?.user_id !== currentUserId ? n.data?.user_id : null);
                                    let actor = (fid && actorsMap[fid]) ? actorsMap[fid] : null;

                                    if (!actor && n._extractedUsername) {
                                        actor = actorsByNameMap[n._extractedUsername];
                                    }

                                    return actor ? window.createProfileLink(actor) : null;
                                })()
                                : (n.type === 'new_message' && n.data?.conversation_id)
                                    ? `/mensajes.html?convId=${n.data.conversation_id}`
                                    : null
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
                        targetUrl: '/cuenta/colaboraciones.html?tab=recibidas',
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
                        read: readInvites.includes(notifId),
                        targetUrl: '/cuenta/colaboraciones.html?tab=mis-invitaciones'
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

            // 🛡️ TARGETS: Check only for Global Dropdown
            const dropdownList = document.getElementById('notification-list');
            const badge = document.getElementById('notification-badge');

            if (notifications) {
                const unreadCount = notifications.filter(n => !n.read).length;
                this.updateBadge(unreadCount);
            }

            // Exit only if no dropdown exists
            if (!dropdownList) return;

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
                    else if (n.type === 'new_message') extraId = n.data?.conversation_id || '';

                    extraId = extraId ? extraId.toString().replace(/"/g, '&quot;') : '';

                    return `

                        <div class="notification-item ${n.read ? '' : 'unread'}" 
                             data-id="${n.id}" 
                             data-type="${n.type}" 
                             data-extra-id="${extraId}"
                             data-url="${n.targetUrl || ''}"
                             onclick="handleNotificationItemClick(this)">
                            <div class="notif-icon ${n.type}">
                                <i class="fas ${this.getIcon(n.type)}"></i>
                            </div>
                            <div class="notif-content">
                                <div class="notif-message">${n.message}</div>
                                <div class="notif-time">${timeAgo(n.created_at)}</div>
                            </div>
                            <div class="notif-badge-dot"></div>
                        </div>
                    `;
                }).join('');


            // ✅ Populates BOTH lists if they exist
            if (dropdownList) dropdownList.innerHTML = html;

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
                case 'new_message': return 'fa-comment-dots';
                default: return 'fa-bell';
            }
        },

        markAllAsRead: async function () {
            // Cooldown: Prevent double-clicks or spam (5 seconds)
            const now = Date.now();
            this._lastMarkRead = now;

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
            const deleted = JSON.parse(localStorage.getItem('deletedNotifs') || '[]');
            if (!deleted.includes(id)) {
                deleted.push(id);
                localStorage.setItem('deletedNotifs', JSON.stringify(deleted));
            }
            this.fetch();
        }
    };


    // --- Global Helpers for Onclick ---

    // New safe handler
    window.handleNotificationItemClick = function (el) {
        const id = el.getAttribute('data-id');
        const type = el.getAttribute('data-type');
        const extraId = el.getAttribute('data-extra-id');
        const url = el.getAttribute('data-url');
        if (typeof window.handleNotificationClick === 'function') {
            window.handleNotificationClick(id, type, extraId, url);
        }
    };



    window.triggerDeleteNotif = function (id, type, event) {
        if (event) event.stopPropagation();
        window.NotificationsManager.deleteNotification(id, type);
    };

    window.triggerViewDetails = function (id, type, extraId, event) {
        if (event) event.stopPropagation();

        // Logic based on type
        if (type === 'new_follower') {
            // "comenzó a seguirte" => Perfil
            if (extraId && extraId !== 'undefined') {
                window.location.href = `/perfil-publico.html?id=${extraId}`;
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
        }
    };

    window.handleNotificationClick = async function (id, type, extraId, targetUrl) {
        console.log(`[Notifications] Click Handled: ID=${id}, Type=${type}, ExtraId=${extraId}, Target=${targetUrl}`);

        // 1. Mark as Read immediately (Optimistic UI)
        if (id && !id.startsWith('invite-') && !id.startsWith('accepted-') && sbClient) {
            sbClient.from('notifications').update({ read: true }).eq('id', id).then(() => {
                window.NotificationsManager.fetch();
            });
        }

        // 2. REDIRECTION LOGIC - Robust fallbacks
        let finalUrl = (targetUrl && targetUrl !== '#' && targetUrl !== 'null' && targetUrl !== 'undefined') ? targetUrl : null;

        // If no targetUrl, calculate from data
        if (!finalUrl || finalUrl === '') {
            if (type === 'new_message') {
                finalUrl = extraId ? `/mensajes.html?convId=${extraId}` : '/mensajes.html';
            } else if (type === 'product_like' || type === 'product_published') {
                finalUrl = extraId ? `/producto.html?id=${extraId}` : '/cuenta/mis-kits.html';
            } else if (type === 'new_follower') {
                // FORCE Profile Link if we have an ID
                if (extraId && extraId !== 'undefined' && extraId !== 'null') {
                    finalUrl = `/perfil-publico.html?id=${extraId}`;
                } else {
                    finalUrl = '/explorar.html';
                }
            } else if (type === 'collab_invitation') {
                finalUrl = '/cuenta/colaboraciones.html?tab=recibidas';
            } else if (type === 'collab_accepted') {
                finalUrl = '/cuenta/colaboraciones.html?tab=mis-invitaciones';
            }
        }

        // 3. APPLY REDIRECTION
        if (finalUrl && finalUrl !== '#' && finalUrl !== '') {
            console.log(`[Notifications] Final Redirect: ${finalUrl}`);
            window.location.href = finalUrl;
        } else {
            console.warn("[Notifications] Fallback to Explore - No URL found");
            window.location.href = '/explorar.html';
        }
    };

    // Utils
    // Helper for safely opening profiles (Global)
    window.openProfile = function (id, event) {
        if (event) {
            event.preventDefault(); // Stop link default
            event.stopPropagation(); // Stop bubbling to parent notification-item
        }
        if (id && id !== 'undefined' && id !== 'null') {
            window.location.href = `/perfil-publico.html?id=${id}`;
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
