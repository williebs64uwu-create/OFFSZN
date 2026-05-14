/**
 * FOLLOW MANAGER
 * Centralizes follow/unfollow logic with Optimistic UI, LocalStorage Caching,
 * and Debounced Server Syncing for a professional, instant UX.
 */

window.FollowManager = (function () {
    let followedIds = new Set();
    let isInitialized = false;
    let subscribers = new Set();
    let initPromise = null;

    const CACHE_KEY = 'offszn_following_ids';

    // 1. Load from cache immediately for zero-latency initial state
    function loadFromCache() {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const ids = JSON.parse(cached);
                followedIds = new Set(ids.map(String));
                // Notify UI immediately with cached data
                setTimeout(() => notifySubscribers(), 0);
            }
        } catch (e) {
            console.warn("[FollowManager] Failed to load cache", e);
        }
    }
    loadFromCache();

    let syncQueues = new Map(); // userId -> timeoutId

    // Initialize (Fetch real data from server)
    async function init() {
        if (isInitialized && followedIds.size > 0) return;
        if (initPromise) return initPromise;

        const token = window.getAccessToken ? window.getAccessToken() : null;
        if (!token) {
            isInitialized = true;
            return;
        }

        initPromise = (async () => {
            try {
                const res = await fetch('/api/me/following', {
                    headers: window.AuthUtils.getAuthHeaderObj()
                });

                if (!res.ok) throw new Error('API Error');
                const data = await res.json(); // Expected: array of user IDs

                if (Array.isArray(data)) {
                    followedIds = new Set(data.map(String));
                    localStorage.setItem(CACHE_KEY, JSON.stringify([...followedIds]));
                    isInitialized = true;
                    notifySubscribers();
                }
            } catch (err) {
                console.error("[FollowManager] Init failed:", err);
                isInitialized = true;
                // Keep cache if API fails
            } finally {
                initPromise = null;
            }
        })();

        return initPromise;
    }

    // Toggle Follow (Optimistic + Debounced)
    async function toggleFollow(targetUserId, buttonElement = null) {
        const token = window.getAccessToken ? window.getAccessToken() : null;
        if (!token) {
            if (window.showGuestModal) {
                window.showGuestModal(
                    "¡Sigue a tus artistas!",
                    "Inicia sesión para seguir a este productor y recibir notificaciones de sus nuevos lanzamientos."
                );
            } else {
                window.location.href = '/pages/register.html';
            }
            return;
        }

        const idStr = String(targetUserId);
        const isCurrentlyFollowing = followedIds.has(idStr);
        const nextState = !isCurrentlyFollowing;

        // --- 🚀 INSTANT OPTIMISTIC UI ---
        if (nextState) followedIds.add(idStr);
        else followedIds.delete(idStr);

        // Sync to cache
        localStorage.setItem(CACHE_KEY, JSON.stringify([...followedIds]));
        
        // Notify all UI listeners
        notifySubscribers();

        // Visual Feedback for specific button
        if (buttonElement) {
            updateButtonVisuals(buttonElement, nextState);
        }

        // --- ⚡ DEBOUNCED SERVER SYNC ---
        if (syncQueues.has(idStr)) {
            clearTimeout(syncQueues.get(idStr));
        }

        const timeoutId = setTimeout(async () => {
            syncQueues.delete(idStr);
            
            try {
                const finalState = followedIds.has(idStr);
                const method = finalState ? 'POST' : 'DELETE';
                
                const res = await fetch(`/api/users/${targetUserId}/follow`, {
                    method: method,
                    headers: {
                        ...window.AuthUtils.getAuthHeaderObj(),
                        'Content-Type': 'application/json'
                    }
                });

                if (res.status === 401 || res.status === 403) {
                    window.location.reload();
                    return;
                }

                if (!res.ok) throw new Error('API Error');
                const data = await res.json();

                // Correct if server disagrees
                const serverState = data.isFollowing !== undefined ? data.isFollowing : finalState;
                if (serverState !== followedIds.has(idStr)) {
                    if (serverState) followedIds.add(idStr);
                    else followedIds.delete(idStr);
                    localStorage.setItem(CACHE_KEY, JSON.stringify([...followedIds]));
                    notifySubscribers();
                }

            } catch (err) {
                console.error("[FollowManager] Sync failed:", err);
            }
        }, 800);

        syncQueues.set(idStr, timeoutId);
    }

    function isFollowing(id) {
        return followedIds.has(String(id));
    }

    function subscribe(callback) {
        subscribers.add(callback);
        // 🔥 IMPROVEMENT: Call immediately with current state for instant UI sync
        callback(new Set(followedIds));
        return () => subscribers.delete(callback);
    }

    function notifySubscribers() {
        // Sync backward compatibility for other scripts
        window.currentUserFollowing = followedIds;

        subscribers.forEach(cb => {
            try {
                cb(new Set(followedIds));
            } catch (e) {
                console.error("[FollowManager] Subscriber error:", e);
            }
        });
        
        // Dispatch global event for legacy components
        window.dispatchEvent(new CustomEvent('follow-state-changed', {
            detail: { followedIds: new Set(followedIds) }
        }));
    }

    function updateButtonVisuals(btn, isFollowing) {
        if (!btn) return;
        
        btn.classList.toggle('following-state', isFollowing);
        
        const icon = btn.querySelector('i');
        const span = btn.querySelector('span');

        if (isFollowing) {
            if (span) span.textContent = 'Siguiendo';
            else btn.innerText = 'Siguiendo';
            
            if (icon) {
                icon.className = 'bi bi-person-check-fill followed-pop';
                setTimeout(() => icon.classList.remove('followed-pop'), 300);
            }
        } else {
            if (span) span.textContent = 'Seguir';
            else {
                btn.innerHTML = '<i class="bi bi-person-plus-fill"></i> Seguir';
            }
            
            if (icon) icon.className = 'bi bi-person-plus-fill';
        }
    }


    // Inject Pop Animation CSS
    const style = document.createElement('style');
    style.textContent = `
        .followed-pop {
            animation: follow-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes follow-pop {
            0% { transform: scale(1); }
            50% { transform: scale(1.3); }
            100% { transform: scale(1); }
        }
        .following-state {
            transition: all 0.2s ease;
        }
    `;
    document.head.appendChild(style);

    return {
        init,
        toggleFollow,
        isFollowing,
        subscribe,
        updateButtonVisuals
    };
})();

// Auto-Init
(function() {
    const runInit = () => {
        if (window.FollowManager) window.FollowManager.init();
    };

    if (localStorage.getItem('authToken')) runInit();

    document.addEventListener('DOMContentLoaded', () => {
        window.addEventListener('offszn-session-ready', (e) => {
            if (e.detail.session) runInit();
        });
        if (window.supabaseClient) runInit();
    });
})();
