// --- SUPABASE AUTH GUARD ---
// This script initializes Supabase and enforces authentication.
// It redirects to /index.html if no active session is found.

(function () {
    // 1. Initialize Supabase (Centralized Config)
    if (window.AuthUtils && window.AuthUtils.initSupabase) {
        window.AuthUtils.initSupabase();
    }
    
    // Use the global client initialized by auth-utils.js
    const supabaseClient = window.supabaseClient;

    // Safety check
    if (!supabaseClient) {
        console.error("Critical: Global Supabase not found. Ensure auth-utils.js is loaded.");
        return;
    }
    window.currentUser = null;

    // 2. Strict Auth Check & Cookie Sync
    async function checkAuth() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) {
                window.currentUser = session.user;

                // --- SECURITY UPDATE: Sync Token to Cookie for Server Validation ---
                // Set cookie with Secure and SameSite attributes to mitigate CSRF/leakage
                const token = session.access_token;
                const maxAge = 60 * 60 * 24 * 7; // 1 week
                document.cookie = `sb-access-token=${token}; path=/; max-age=${maxAge}; SameSite=Strict; Secure`;

                console.log("✅ Auth Guard: Protected Access Granted & Token Synced");
            } else {
                // 🔥 BYPASS: If we are on planes.html, don't redirect. Let them see the pricing.
                if (window.location.pathname.includes('planes.html')) {
                    console.log("ℹ️ Auth Guard: No session but on planes.html. Bypass redirect.");
                    return;
                }

                console.warn("⛔ Auth Guard: No Session. Redirecting...");
                redirectToLogin();
            }
        } catch (e) {
            console.error("Auth Guard Error:", e);
            if (!window.location.pathname.includes('planes.html')) {
                redirectToLogin();
            }
        }
    }

    function redirectToLogin() {
        // Clear cookie to be safe
        document.cookie = "sb-access-token=; path=/; max-age=0; SameSite=Strict; Secure";
        
        // 🔥 BYPASS: If we are on planes.html, don't redirect. Let them see the pricing.
        if (window.location.pathname.includes('planes.html')) {
            console.log("ℹ️ Auth Guard: User signed out, but on planes.html. Bypass redirect.");
            return;
        }
        
        window.location.href = '/explorar.html';
    }

    // Run immediately
    checkAuth();

    // 3. Proactive Upload Protection
    window.AuthGuard = {
        /**
         * Protects entry points that are for creating new uploads.
         * If the URL contains `?edit=` or `?draft=`, we bypass this check so the user can edit existing products.
         */
        protectUploadEntry: async function () {
            const searchParams = new URLSearchParams(window.location.search);
            if (searchParams.has('edit') || searchParams.has('draft')) {
                // User is editing an existing product. Let them pass.
                return { isLimited: false, hasYT: true, isYTLimited: false, bypass: true };
            }
            
            const isYTPage = window.location.pathname.includes('beats-yt.html');

            // 1. FAST CACHE CHECK (Synchronous protection)
            const cached = sessionStorage.getItem('offszn_upload_limit_status');
            if (cached) {
                try {
                    const status = JSON.parse(cached);
                    const hasYTFeature = sessionStorage.getItem('offszn_yt_access') === 'true';
                    const isYTLimitedCached = sessionStorage.getItem('offszn_yt_limited') === 'true';
                    
                    if (status.isLimited || !hasYTFeature || (isYTPage && isYTLimitedCached)) {
                        console.warn("⛔ Auth Guard: Cached limit reached.");
                        return { 
                            isLimited: status.isLimited, 
                            hasYT: hasYTFeature, 
                            isYTLimited: isYTLimitedCached,
                            fromCache: true 
                        };
                    }
                } catch(e) {}
            }

            if (!window.AuthUtils) return { isLimited: false, hasYT: true, isYTLimited: false };
            
            try {
                // 2. LIVE CHECK (Async)
                const [status, ytStatus] = await Promise.all([
                    window.AuthUtils.getUploadLimitStatus(),
                    window.AuthUtils.getYouTubeUploadStatus()
                ]);

                // 🔥 FIX: Use actual quota, not plan name. Free=3/mo, Starter=10, Pro=30.
                // Server-side (YouTubeController.js) enforces the real limit regardless.
                const hasYTFeature = ytStatus.limit > 0;
                
                sessionStorage.setItem('offszn_yt_access', hasYTFeature ? 'true' : 'false');
                sessionStorage.setItem('offszn_yt_limited', ytStatus.isLimited ? 'true' : 'false');

                return { 
                    isLimited: status.isLimited, 
                    hasYT: hasYTFeature, 
                    isYTLimited: ytStatus.isLimited 
                };
            } catch (e) {
                console.error("Auth Guard Limit Check Error:", e);
                return { isLimited: false, hasYT: true, isYTLimited: false, error: true };
            }
        },

        /**
         * Safely navigates to an upload URL or blocks with a modal if at limit.
         */
        safeNavigate: async function (url) {
            // Bypass limit check if trying to edit/draft
            if (url && (url.includes('?edit=') || url.includes('&edit=') || url.includes('?draft=') || url.includes('&draft='))) {
                window.location.href = url;
                return;
            }

            // 1. Check Cache
            const cached = sessionStorage.getItem('offszn_upload_limit_status');
            if (cached) {
                const status = JSON.parse(cached);
                if (status.isLimited) {
                    if (typeof window.showLimitReachedModal === 'function') {
                        window.showLimitReachedModal();
                    } else {
                        window.location.href = '/cuenta/subir-kit.html?limit=reached';
                    }
                    return;
                }
            }

            // 2. Async Re-Verify (just in case)
            if (window.AuthUtils && window.AuthUtils.getUploadLimitStatus) {
                const status = await window.AuthUtils.getUploadLimitStatus();
                if (status.isLimited) {
                    if (typeof window.showLimitReachedModal === 'function') {
                        window.showLimitReachedModal();
                    } else {
                        window.location.href = '/cuenta/subir-kit.html?limit=reached';
                    }
                    return;
                }
            }

            // 3. Proceed
            window.location.href = url;
        }
    };

    // Listen for auth changes (e.g. sign out)
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            redirectToLogin();
        } else if (event === 'SIGNED_IN' && session) {
            const token = session.access_token;
            const maxAge = 60 * 60 * 24 * 7;
            document.cookie = `sb-access-token=${token}; path=/; max-age=${maxAge}; SameSite=Strict; Secure`;
        }
    });
})();
