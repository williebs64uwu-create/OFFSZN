/**
* OFFSZN Auth Utilities
* Centralized token management to prevent 403 errors and duplication.
*/

window.AuthUtils = {
    /**
     * Initialize Supabase Client globally if credentials exist.
     * Use this ensuring window.SUPABASE_URL is defined before loading this script.
     */
    initSupabase: function () {
        if (window.supabaseClient) return; // Already initialized

        if (typeof window.supabase !== 'undefined' && window.supabase.createClient && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
            window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            console.log("✅ Supabase Client Initialized via AuthUtils");

            // 🔄 SYNC: Listen for Auto-Refresh Events to keep token fresh
            window.supabaseClient.auth.onAuthStateChange((event, session) => {
                if (session && session.access_token) {
                    window.AuthUtils._cachedToken = session.access_token;
                    // Optional: Update manual storage if used
                    if (localStorage.getItem('authToken')) {
                        localStorage.setItem('authToken', session.access_token);
                    }
                } else if (event === 'SIGNED_OUT') {
                    window.AuthUtils._cachedToken = null;
                }
            });

            // Try to set initial cache
            window.supabaseClient.auth.getSession().then(({ data }) => {
                if (data?.session?.access_token) {
                    window.AuthUtils._cachedToken = data.session.access_token;
                }
            });

        } else {
            console.warn("⚠️ AuthUtils: Cannot init Supabase (Missing credentials or Lib)");
        }
    },

    _cachedToken: null,

    /**
     * Retrieves the Supabase Access Token from Memory (fastest), Cookie (primary) or LocalStorage (fallback).
     * @returns {string|null} The access token or null if not found.
     */
    getAccessToken: function () {
        // 0. Try Memory Cache (Synced with Auto-Refresh)
        if (this._cachedToken) return this._cachedToken;

        const ANON_KEY = window.SUPABASE_ANON_KEY || "";

        // Helper to validate token is NOT the anon key AND has a valid role
        const isValid = (t) => {
            if (!t || t === 'undefined' || t === 'null' || t === ANON_KEY) return false;

            // Robust Check: Is it an 'anon' role JWT?
            try {
                // Decode payload (middle part of JWT)
                const payloadStr = t.split('.')[1];
                if (!payloadStr) return true; // Not a JWT? Let it through for standard validation

                const payload = JSON.parse(atob(payloadStr));
                if (payload && payload.role === 'anon') return false;

                // --- EXPIRY CHECK ---
                // If strictly expired, we prefer NOT to return it to avoid 401s.
                // However, we don't delete it immediately to allow refresh logic to run.
                if (payload && payload.exp && payload.exp < (Date.now() / 1000)) {
                    console.warn("⚠️ AuthUtils: Token found but expired. Waiting for refresh...");
                    return false;
                }
            } catch (e) {
                // If decoding fails, it might not be a JWT or is mangled.
                // We let it pass to the server to decide, unless it's the known ANON_KEY.
            }

            return true;
        };

        // 1. Try Cookie
        const match = document.cookie.match(/(^| )sb-access-token=([^;]+)/);
        if (match && isValid(match[2])) {
            this._cachedToken = match[2];
            return match[2];
        }

        // 2. Try LocalStorage (Custom 'authToken')
        const lsToken = localStorage.getItem('authToken');
        if (isValid(lsToken)) {
            this._cachedToken = lsToken;
            return lsToken;
        }

        // 3. Try Supabase LocalStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                try {
                    const session = JSON.parse(localStorage.getItem(key));
                    if (session && isValid(session.access_token)) {
                        this._cachedToken = session.access_token;
                        return session.access_token;
                    }
                } catch (e) {
                    console.warn("AuthUtils: Failed to parse Supabase LS session", e);
                }
            }
        }

        return null;
    },

    /**
     * Returns the Headers object with Authorization if token exists.
     * @returns {Headers} Fetch API compatible headers
     */
    getAuthHeaders: function () {
        const headers = new Headers();
        const token = this.getAccessToken();
        if (token) {
            headers.append('Authorization', `Bearer ${token}`);
        }
        return headers;
    },

    /**
     * Simple object version for manual fetch calls
     */
    getAuthHeaderObj: function () {
        const token = this.getAccessToken();
        if (token) {
            // console.log("🛡️ AuthUtils: Generating header with token:", token.substring(0, 15) + "...");
            return { 'Authorization': `Bearer ${token}` };
        } else {
            console.warn("🛡️ AuthUtils: No token found when requesting headers.");
            return {};
        }
    },

    _urlCache: {}, // In-memory cache for signed URLs to speed up repeat loads

    /**
     * Resolves a path or URL to an authorized/signed URL if it's an R2 resource.
     * Supports Hybrid (Supabase/R2) logic.
     * @param {string} pathOrUrl The path or URL to resolve
     * @returns {Promise<string|null>} The authorized URL
     */
    getAuthorizedUrl: async function (pathOrUrl) {
        if (!pathOrUrl) return null;

        // --- CACHE CHECK ---
        if (this._urlCache[pathOrUrl]) {
            return this._urlCache[pathOrUrl];
        }


        // --- HYBRID LOGIC ---
        // If it's a full URL and NOT R2, it's already public (Supabase)
        // 🔥 FIX: Ignore data: URIs, local images (/images, /assets, /icon) and empty strings
        const isR2Url = (
            pathOrUrl.includes('r2.cloudflarestorage.com') ||
            pathOrUrl.includes('pub-') ||
            // Relative path check: Must NOT start with http, NOT be data:, NOT be local static asset folders
            (!pathOrUrl.startsWith('http') &&
                !pathOrUrl.startsWith('data:') &&
                !pathOrUrl.startsWith('/images') &&
                !pathOrUrl.startsWith('/assets') &&
                !pathOrUrl.startsWith('/icon') &&
                pathOrUrl.includes('/') // Must have some folder structure
            )
        );

        if (!isR2Url && pathOrUrl.startsWith('http')) {
            return pathOrUrl; // Supabase public URL
        }

        // --- SECOND LAYER DEFENSE ---
        // If it's not R2 and doesn't look like an R2 key (relative path), return original
        if (!isR2Url) return pathOrUrl;

        // --- R2 LOGIC ---
        let key = pathOrUrl;
        if (pathOrUrl.startsWith('http')) {
            // Extract key from full R2 URL
            const r2Base = '.r2.cloudflarestorage.com/';
            if (pathOrUrl.includes(r2Base)) {
                key = pathOrUrl.split(r2Base)[1];
            } else {
                try {
                    const urlObj = new URL(pathOrUrl);
                    key = urlObj.pathname.substring(1);
                } catch (e) { }
            }
        }

        // --- SIGNING VIA API ---
        try {
            const token = this.getAccessToken(); // Use self
            const response = await fetch('/api/r2/download-url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : undefined
                },
                body: JSON.stringify({ key })
            });

            if (!response.ok) {
                console.warn(`AuthUtils: Failed to sign R2 key: ${key}`, response.status);
                // Return original if signing fails as fallback (might be public)
                return pathOrUrl;
            }

            const { downloadUrl } = await response.json();
            this._urlCache[pathOrUrl] = downloadUrl; // Cache result
            return downloadUrl;
        } catch (error) {
            console.error('AuthUtils: Error getting authorized URL:', error);
            return pathOrUrl; // Fallback to original
        }
    }
};

// Backwards compatibility / Direct global access shortcuts
window.getAccessToken = window.AuthUtils.getAccessToken.bind(window.AuthUtils);
window.getAuthorizedUrl = window.AuthUtils.getAuthorizedUrl.bind(window.AuthUtils);

// Attempt Init immediately
window.AuthUtils.initSupabase();

console.log("🛡️ AuthUtils Loaded.");
