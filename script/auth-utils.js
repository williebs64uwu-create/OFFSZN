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
        } else {
            console.warn("⚠️ AuthUtils: Cannot init Supabase (Missing credentials or Lib)");
        }
    },

    /**
     * Retrieves the Supabase Access Token from Cookie (primary) or LocalStorage (fallback).
     * @returns {string|null} The access token or null if not found.
     */
    getAccessToken: function () {
        const ANON_KEY = window.SUPABASE_ANON_KEY || "";

        // Helper to validate token is NOT the anon key
        const isValid = (t) => t && t !== 'undefined' && t !== 'null' && t !== ANON_KEY;

        // 1. Try Cookie
        const match = document.cookie.match(/(^| )sb-access-token=([^;]+)/);
        if (match && isValid(match[2])) {
            return match[2];
        }

        // 2. Try LocalStorage (Custom 'authToken')
        const lsToken = localStorage.getItem('authToken');
        if (isValid(lsToken)) {
            return lsToken;
        }

        // 3. Try Supabase LocalStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                try {
                    const session = JSON.parse(localStorage.getItem(key));
                    if (session && isValid(session.access_token)) return session.access_token;
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
            console.log("🛡️ AuthUtils: Generating header with token:", token.substring(0, 15) + "...");
            return { 'Authorization': `Bearer ${token}` };
        } else {
            console.warn("🛡️ AuthUtils: No token found when requesting headers.");
            return {};
        }
    }
};

// Backwards compatibility / Direct global access shortcuts
window.getAccessToken = window.AuthUtils.getAccessToken.bind(window.AuthUtils);

// Attempt Init immediately
window.AuthUtils.initSupabase();

console.log("🛡️ AuthUtils Loaded. Token present:", !!window.getAccessToken());
