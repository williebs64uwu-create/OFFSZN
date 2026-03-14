/**
 * OFFSZN Auth Utilities
 * Centralized token management and plan-based feature restrictions.
 */

window.PLAN_LIMITS = {
    free: {
        name: 'Básico',
        price: 'Free',
        max_uploads: 30,
        commission: 0.05,
        youtube_uploads_per_month: 1,
        requests_per_day: 1,
        credits_per_month: 0,
        badge: 'None'
    },
    starter: {
        name: 'Starter',
        price: '$9/mo',
        max_uploads: 60,
        commission: 0.03,
        youtube_uploads_per_month: 5,
        requests_per_day: 5,
        credits_per_month: 60,
        badge: 'Purple'
    },
    pro: {
        name: 'PRO',
        price: '$19/mo',
        max_uploads: Infinity,
        commission: 0.0,
        youtube_uploads_per_month: 30,
        requests_per_day: Infinity,
        credits_per_month: 100,
        badge: 'Gold'
    }
};

window.AuthUtils = {
    _userPlanCache: null,
    /**
     * Initialize Supabase Client globally if credentials exist.
     * Use this ensuring window.SUPABASE_URL is defined before loading this s   cript.
     */
    initSupabase: function () {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // 🔥 DEBUG: Enable logging on local
        if (isLocal) window.OFFSZN_DEBUG = true;
        
        let apiBase = window.OFFSZN_CONFIG?.API_BASE_URL;
        
        // Auto-detect port 3008 if on localhost and no config
        if (isLocal && !apiBase) {
            apiBase = window.location.port === '3008' ? 'http://localhost:3008' : 'http://localhost:3000';
        } else if (!apiBase) {
            apiBase = 'https://offszn.lat';
        }

        this._apiUrl = `${apiBase}/api`;
        this._apiBase = apiBase; // Keep base for fallbacks

        if (window.supabaseClient) return; // Already initialized
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
            window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

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
                    // console.warn("⚠️ AuthUtils: Token found but expired. Waiting for refresh...");
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
            return { 'Authorization': `Bearer ${token}` };
        } else {
            return {};
        }
    },

    _urlCache: {}, // In-memory cache for signed URLs to speed up repeat loads

    /**
     * Resolves a path or URL to an authorized/signed URL if it's an R2 resource.
     * Supports Hybrid (Supabase/R2) logic.
     * @param {string} pathOrUrl The path or URL to resolve
     * @param {string} version Optional R2 version ('v1' or 'v2')
     * @returns {Promise<string|null>} The authorized URL
     */
    getAuthorizedUrl: async function (pathOrUrl, version = 'v2') {
        if (!pathOrUrl) return null;

        // --- CACHE CHECK ---
        if (this._urlCache[pathOrUrl]) {
            return this._urlCache[pathOrUrl];
        }

        // 🔥 PREVENT DOUBLE SIGNING: If already contains signature params, return as is
        if (typeof pathOrUrl === 'string' && pathOrUrl.includes('X-Amz-Signature')) {
            return pathOrUrl;
        }

        // 🔥 ZERO LATENCY FIX: If the URL is already a Cloudflare public DEV URL (pub-...), 
        // do NOT ask the backend to sign it. It's already public.
        if (typeof pathOrUrl === 'string' && pathOrUrl.includes('pub-') && pathOrUrl.includes('.r2.dev')) {
            return pathOrUrl;
        }

        // --- HYBRID LOGIC ---
        // 1. Identification: Is it R2 or a public Supabase URL?
        const isR2 = this.isR2Url(pathOrUrl);

        // 2. Normalization: Clean accidental double slashes for R2 keys/paths
        // We skip this for full HTTP URLs to avoid 400 errors from sensitive servers (like Supabase storage)
        let processedPath = pathOrUrl;
        if (typeof pathOrUrl === 'string' && !pathOrUrl.startsWith('http')) {
            // Clean @ prefix only for v1 logic or as a general rule before signing
            processedPath = pathOrUrl.startsWith('@') ? pathOrUrl.substring(1) : pathOrUrl;
            processedPath = processedPath.replace(/\/\/+/g, "/");
        }

        if (!isR2 && typeof processedPath === 'string' && processedPath.startsWith('http')) {
            return processedPath; // Supabase public URL or already signed
        }

        // --- SECOND LAYER DEFENSE ---
        if (!isR2) return processedPath;

        // --- R2 LOGIC ---
        let key = processedPath;
        if (typeof processedPath === 'string' && processedPath.startsWith('http')) {
            // Extract key from full R2 URL
            const r2Base = '.r2.cloudflarestorage.com/';
            if (processedPath.includes(r2Base)) {
                key = processedPath.split(r2Base)[1];
            }
        }

        // 🔥 AUTO-DETECT VERSION AND PUBLIC PATHS
        if (typeof pathOrUrl === 'string') {
            // Version detection
            if (pathOrUrl.includes('offsznlatbucket') || pathOrUrl.includes('42fc23b11a6c329b76b2babc20afcbf7')) {
                version = 'v2';
            } else if (pathOrUrl.includes('offszn-storage') || pathOrUrl.includes('41d0f49121d02c88f71fdb4da54a791d')) {
                version = 'v1'; 
            } else if (pathOrUrl.includes('pub-')) {
                version = 'v1';
            }

            // 🔥 ZERO LATENCY PUBLIC PATHS
            // If it's a known public folder, we use the public endpoint if available
            const publicPrefixes = ['products/covers/', 'beats/mp3/', 'avatars/', 'public/', 'banners/'];
            const isPublicPath = publicPrefixes.some(p => pathOrUrl.includes(p));

            if (isPublicPath) {
                // For V2 (new account), if the bucket has a public domain or we use the cloudflarestorage endpoint
                // we can return it. However, since R2 requires a custom domain for real public access,
                // we'll still call the signing API unless we HAVE a known public alias.
                // If you have a custom domain for R2, we should put it here.
            }
        }

        // 🔥 KEY CLEANUP: R2 keys must NOT start with / and must NOT have query params
        if (typeof key === 'string') {
            if (key.includes('?')) key = key.split('?')[0];
            while (key.startsWith('/')) key = key.substring(1);
        }

        if (!key) return pathOrUrl;

        // --- SIGNING VIA API ---
        try {
            const token = this.getAccessToken(); // Use self
            const response = await fetch(`${this._apiUrl}/r2/download-url`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : undefined
                },
                body: JSON.stringify({ key, version })
            });

            // Success logs removed as requested by user
            if (window.OFFSZN_DEBUG && !response.ok) {
                console.warn(`[R2-Signing] Error: ${response.status} for Key: ${key} | Version: ${version}`);
            }

            if (!response.ok) {
                console.warn(`AuthUtils: Failed to sign R2 key: ${key}`, response.status);
                // 🔥 FALLBACK: For public assets, construct a direct public URL if signing fails
                const publicPrefixes = ['products/covers/', 'beats/mp3/', 'avatars/', 'public/', 'banners/', 'drumkits/covers/'];
                const isPublic = publicPrefixes.some(prefix => key.startsWith(prefix));

                if (isPublic) {
                    console.warn(`[AuthUtils] Signing failed for public asset, using fallback: ${key}`);
                    // Ensure we return a full URL to avoid CORB (relative paths may hit frontend router)
                    const baseUrl = this._apiBase || 'https://offszn.lat';
                    return `${baseUrl}/r2-public/${key}`;
                }

                // If it's a relative path, try to make it absolute to avoid CORB 404s
                if (!key.startsWith('http')) {
                    const baseUrl = this._apiBase || 'https://offszn.lat';
                    return `${baseUrl}/${key}`;
                }

                return key; 
            }

            const { downloadUrl } = await response.json();
            this._urlCache[pathOrUrl] = downloadUrl; // Cache result
            return downloadUrl;
        } catch (error) {
            console.error('AuthUtils: Error getting authorized URL:', error);
            return pathOrUrl; // Fallback to original
        }
    },

    /**
     * Identification if a URL belongs to Cloudflare R2 structure.
     */
    isR2Url: function (pathOrUrl) {
        if (!pathOrUrl || typeof pathOrUrl !== 'string') return false;
        return (
            pathOrUrl.includes('r2.cloudflarestorage.com') ||
            pathOrUrl.includes('pub-') ||
            pathOrUrl.startsWith('@') ||
            (!pathOrUrl.startsWith('http') &&
                !pathOrUrl.startsWith('data:') &&
                !pathOrUrl.startsWith('/images') &&
                !pathOrUrl.startsWith('/assets') &&
                !pathOrUrl.startsWith('/icon') &&
                !pathOrUrl.startsWith('/script') &&
                (pathOrUrl.includes('/') || /\.(jpg|jpeg|png|webp|gif|svg|mp3|wav|zip)$/i.test(pathOrUrl) || pathOrUrl.startsWith('@'))
            )
        );
    },

    /**
     * Uploads a file to Cloudflare R2 via the backend API.
     * @param {File|Blob} file The file or blob to upload.
     * @param {string} folder Target folder (e.g., 'products/covers').
     * @returns {Promise<{key: string, r2_version: string, publicUrl: string|null}>}
     */
    uploadToR2: async function (file, folder = 'uploads') {
        try {
            const token = this.getAccessToken();
            if (!token) throw new Error('No hay sesión activa para subir a R2');

            // 1. Get signed Upload URL from backend
            const response = await fetch(`${this._apiUrl}/r2/upload-url`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    fileName: file.name || 'blob',
                    fileType: file.type || 'application/octet-stream',
                    folder: folder,
                    fileSize: file.size,
                    version: 'v2' // Always use v2 for new uploads
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al obtener URL de subida R2');
            }

            const { uploadUrl, key, r2_version, publicUrl } = await response.json();

            // 2. Perform direct PUT to R2
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type || 'application/octet-stream'
                }
            });

            if (!uploadRes.ok) throw new Error('La subida directa a R2 falló');

            return { key, r2_version, publicUrl };
        } catch (error) {
            console.error('AuthUtils: Error in uploadToR2:', error);
            throw error;
        }
    },

    /**
     * Deletes one or more files from Cloudflare R2 via API.
     * @param {string|string[]} keys Single key or array of keys to delete.
     * @param {string} version Optional R2 version ('v1' or 'v2')
     * @returns {Promise<boolean>} True if operation completed.
     */
    deleteFromR2: async function (keys, version = null) {
        if (!keys) return true;
        const keysArray = Array.isArray(keys) ? keys : [keys];
        if (keysArray.length === 0) return true;

        // Clean keys: Ensure only the path part is sent (no query params, no base URL)
        const v1Keys = [];
        const v2Keys = [];

        keysArray.forEach(k => {
            if (!k || typeof k !== 'string') return;
            
            let key = k;
            let detectedVersion = version;

            // Extract key from full URL if needed
            if (k.startsWith('http')) {
                const r2Base = '.r2.cloudflarestorage.com/';
                if (k.includes(r2Base)) {
                    key = k.split(r2Base)[1].split('?')[0];
                } else {
                    try {
                        const urlObj = new URL(k);
                        key = urlObj.pathname.substring(1);
                    } catch (e) { }
                }

                // Auto-detect version from URL if not explicitly provided
                if (!detectedVersion) {
                    if (k.includes('offsznlatbucket') || k.includes('42fc23b11a6c329b76b2babc20afcbf7')) {
                        detectedVersion = 'v2';
                    } else if (k.includes('offszn-storage') || k.includes('41d0f49121d02c88f71fdb4da54a791d') || k.includes('pub-')) {
                        detectedVersion = 'v1';
                    }
                }
            }

            // Cleanup Key
            if (key.includes('?')) key = key.split('?')[0];
            while (key.startsWith('/')) key = key.substring(1);

            // Default fallback if still no version
            if (!detectedVersion) detectedVersion = 'v1';

            if (detectedVersion === 'v2') v2Keys.push(key);
            else v1Keys.push(key);
        });

        const deleteBatch = async (batchKeys, batchVersion) => {
            if (batchKeys.length === 0) return true;
            try {
                const token = this.getAccessToken();
                const response = await fetch(`${this._apiUrl}/r2/delete-files`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : undefined
                    },
                    body: JSON.stringify({ keys: batchKeys, version: batchVersion })
                });
                return response.ok;
            } catch (error) {
                console.error(`AuthUtils: Error deleting batch (${batchVersion}):`, error);
                return false;
            }
        };

        // Parallel execution for both versions
        const results = await Promise.all([
            deleteBatch(v1Keys, 'v1'),
            deleteBatch(v2Keys, 'v2')
        ]);

        return results.every(res => res);
    },

    /**
     * Fetches the user's plan and stores it in session storage for performance.
     * @returns {Promise<Object|null>} The plan data or null.
     */
    getUserPlanData: async function () {
        if (this._userPlanCache) return this._userPlanCache;

        // Try SessionStorage first
        const sessionPlan = sessionStorage.getItem('offszn_user_plan');
        if (sessionPlan) {
            try {
                this._userPlanCache = JSON.parse(sessionPlan);
                return this._userPlanCache;
            } catch (e) { }
        }

        if (!window.supabaseClient) return null;

        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) return null;

        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('plan')
            .eq('id', session.user.id)
            .maybeSingle();

        if (error || !data) return null;

        const planKey = data.plan || 'free';

        // Try to fetch YouTube quota columns (may not exist if SQL migration not run yet)
        let ytUploadsThisMonth = 0;
        try {
            const { data: quotaData } = await window.supabaseClient
                .from('profiles')
                .select('youtube_uploads_this_month, youtube_quota_reset_date')
                .eq('id', session.user.id)
                .maybeSingle();

            if (quotaData) {
                ytUploadsThisMonth = quotaData.youtube_uploads_this_month || 0;
                const resetDate = quotaData.youtube_quota_reset_date ? new Date(quotaData.youtube_quota_reset_date) : null;
                if (resetDate && new Date() > resetDate) {
                    ytUploadsThisMonth = 0;
                }
            }
        } catch (_) { /* Columns may not exist yet — graceful fallback to 0 */ }

        const planData = {
            plan: planKey,
            limits: window.PLAN_LIMITS[planKey] || window.PLAN_LIMITS.free,
            usage: {
                youtube_uploads_this_month: ytUploadsThisMonth
            }
        };

        this._userPlanCache = planData;
        sessionStorage.setItem('offszn_user_plan', JSON.stringify(planData));
        return planData;
    },

    /**
     * Checks if a user has access to a specific feature or limit.
     * @param {string} feature Feature key to check.
     * @returns {Promise<boolean>}
     */
    checkFeatureAccess: async function (feature) {
        const planData = await this.getUserPlanData();
        if (!planData) return false;

        const limits = planData.limits;

        switch (feature) {
            case 'youtube_upload': {
                // 🔥 Monthly quota check: Free=1, Starter=5, Pro=30
                const ytLimit = limits.youtube_uploads_per_month || 0;
                const ytUsed = planData.usage?.youtube_uploads_this_month || 0;
                return ytUsed < ytLimit;
            }
            case 'unlimited_uploads':
                return limits.max_uploads === Infinity;
            default:
                return false;
        }
    }
};

// ==================== CURRENCY MANAGER ==================== //
// Visual-only conversion for reference. Payments are ALWAYS in USD.
// Supported: USD (base), PEN, EUR
window.CurrencyManager = {
    _RATES: { USD: 1, PEN: 3.80, EUR: 0.92 },
    _SYMBOLS: { USD: '$', PEN: 'S/', EUR: '€' },
    _STORAGE_KEY: 'userCurrency',

    getCurrency() {
        return localStorage.getItem(this._STORAGE_KEY) || 'PEN';
    },

    setCurrency(currency) {
        if (!this._RATES[currency]) return;
        localStorage.setItem(this._STORAGE_KEY, currency);
        window.dispatchEvent(new CustomEvent('currencyChanged', { detail: { currency } }));
    },

    getRate(currency) { return this._RATES[currency] || 1; },
    getSymbol(currency) { return this._SYMBOLS[currency] || '$'; },

    /** Convert USD amount to user's selected currency */
    convert(amountUSD, currency) {
        const curr = currency || this.getCurrency();
        return amountUSD * (this._RATES[curr] || 1);
    },

    /** Format USD amount as display string in user's currency */
    format(amountUSD, opts = {}) {
        if (amountUSD === 0 || amountUSD == null) return 'Free';
        const curr = opts.currency || this.getCurrency();
        const converted = this.convert(amountUSD, curr);
        const symbol = this._SYMBOLS[curr] || '$';
        const decimals = opts.showDecimals !== false ? 2 : 0;
        return `${symbol}${converted.toFixed(decimals)}`;
    },

    /** Parse a price string like "$29.00" and re-format in user's currency */
    formatFromString(priceStr, opts = {}) {
        if (!priceStr || priceStr === 'Free' || priceStr === 'Gratis') return 'Free';
        const str = String(priceStr);
        const num = parseFloat(str.replace(/[^0-9.]/g, ''));
        if (isNaN(num) || num === 0) return 'Free';
        return this.format(num, opts);
    },

    /** Batch-update all [data-price-usd] elements on the page */
    updateAllPrices() {
        const curr = this.getCurrency();
        document.querySelectorAll('[data-price-usd]').forEach(el => {
            const usd = parseFloat(el.dataset.priceUsd);
            if (isNaN(usd) || usd === 0) { el.textContent = 'Free'; return; }
            el.textContent = this.format(usd, { currency: curr });
        });
    }
};

// Auto-update [data-price-usd] elements when currency changes
window.addEventListener('currencyChanged', () => window.CurrencyManager.updateAllPrices());

// Backwards compatibility / Direct global access shortcuts
window.getAccessToken = window.AuthUtils.getAccessToken.bind(window.AuthUtils);
window.getAuthorizedUrl = window.AuthUtils.getAuthorizedUrl.bind(window.AuthUtils);
window.uploadToR2 = window.AuthUtils.uploadToR2.bind(window.AuthUtils);
window.deleteFromR2 = window.AuthUtils.deleteFromR2.bind(window.AuthUtils);

// Attempt Init immediately
window.AuthUtils.initSupabase();
