// --- SUPABASE AUTH GUARD ---
// This script initializes Supabase and enforces authentication.
// It redirects to /index.html if no active session is found.

(function () {
    // 1. Initialize Supabase (Centralized Config)
    const supabaseUrl = 'https://qtjpvztpgfymjhhpoouq.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw';

    // Check if Supabase global is available
    if (typeof supabase === 'undefined') {
        console.error("Supabase SDK not loaded! Auth Guard cannot function.");
        return;
    }

    const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
    window.supabaseClient = supabaseClient; // Expose globally
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
        window.location.href = '/index.html';
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
