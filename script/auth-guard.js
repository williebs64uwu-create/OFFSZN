// --- SUPABASE AUTH GUARD ---
// This script initializes Supabase and enforces authentication.
// It redirects to /index.html if no active session is found.

(function () {
    // 1. Initialize Supabase (Centralized Config)
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
                console.warn("⛔ Auth Guard: No Session. Redirecting...");
                redirectToLogin();
            }
        } catch (e) {
            console.error("Auth Guard Error:", e);
            redirectToLogin();
        }
    }

    function redirectToLogin() {
        // Clear cookie to be safe
        document.cookie = "sb-access-token=; path=/; max-age=0; SameSite=Strict; Secure";
        window.location.href = '/explorar.html';
    }

    // Run immediately
    checkAuth();

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
