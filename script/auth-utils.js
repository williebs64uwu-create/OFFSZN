/**

 * OFFSZN Auth Utilities

 * Centralized token management and plan-based feature restrictions.

 */



window.PLAN_LIMITS = {

    free: {

        name: 'Básico',

        price: 'Free',

        max_uploads: 20,

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

        const API_URL = `${window.OFFSZN_CONFIG?.API_BASE_URL || 'https://offszn.lat'}/api`;

        this._apiUrl = API_URL;



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

     * @returns {Promise<string|null>} The authorized URL

     */

    /**
     * Strips signed R2 URLs / proxy URLs down to the storage key (e.g. products/covers/...).
     */
    normalizeR2StoragePath: function (pathOrUrl) {
        if (!pathOrUrl || typeof pathOrUrl !== 'string') return pathOrUrl;

        let key = pathOrUrl.split('?')[0];

        if (key.startsWith('http')) {
            if (key.includes('/api/r2-public/')) {
                key = key.split('/api/r2-public/')[1];
            } else if (key.includes('.r2.cloudflarestorage.com/')) {
                key = key.split('.r2.cloudflarestorage.com/')[1];
            } else {
                try {
                    key = new URL(key).pathname;
                } catch (e) { }
            }
        }

        while (key.startsWith('/')) key = key.substring(1);

        const bucketPrefixes = ['offsznlatbucket/', 'offszn-storage/', 'bucket3lat/'];
        for (const prefix of bucketPrefixes) {
            if (key.toLowerCase().startsWith(prefix)) {
                key = key.substring(prefix.length);
            }
        }

        return key.replace(/\/\/+/g, '/');
    },

    isPublicR2Key: function (key) {
        if (!key) return false;
        const publicPrefixes = [
            'products/', 'beats/mp3/', 'mp3_tagged/', 'avatars/', 'public/', 'banners/',
            'drumkits/', 'temp-previews/', 'covers/', 'audio/',
            'secure-products/beats/mp3_tagged/'
        ];
        return publicPrefixes.some(prefix => key.startsWith(prefix));
    },

    /** Tagged MP3 previews on the marketplace — guests may stream without signing. */
    isPreviewAudioKey: function (key) {
        if (!key || typeof key !== 'string') return false;
        const k = key.toLowerCase();
        if (!/\.(mp3|m4a|aac)(\?|$)/.test(k)) return false;
        const privatePatterns = ['/wav/', 'wav_untagged', '/stems/', '/kits/', '.wav', '.zip', '.rar'];
        if (privatePatterns.some(p => k.includes(p))) return false;
        return true;
    },

    /** Sync public preview URL when possible (no download-url round trip). */
    resolvePreviewMediaUrl: function (pathOrUrl, version) {
        if (!pathOrUrl) return null;
        if (typeof pathOrUrl === 'string' && pathOrUrl.includes('pub-') && pathOrUrl.includes('.r2.dev')) {
            return pathOrUrl;
        }
        if (typeof pathOrUrl === 'string' && pathOrUrl.includes('r2-public/')) {
            return pathOrUrl;
        }
        if (!this.isR2Url(pathOrUrl)) {
            return pathOrUrl.startsWith('http') ? pathOrUrl : null;
        }
        const key = this.normalizeR2StoragePath(pathOrUrl);
        if (!key) return null;
        if (this.isPublicR2Key(key) || this.isPreviewAudioKey(key)) {
            return this.getR2PublicProxyUrl(key, version || 'v2');
        }
        return null;
    },

    getR2PublicProxyUrl: function (key, version) {
        const apiRoot = this._getApiUrl();
        const base = apiRoot.replace(/\/api\/?$/, '') || 'https://offszn.lat';
        const cleanKey = key.startsWith('/') ? key.substring(1) : key;
        const v = version && version !== 'supabase' ? `?v=${version}` : '';
        return `${base}/api/r2-public/${cleanKey}${v}`;
    },

    getAuthorizedUrl: async function (pathOrUrl, version, productId) {

        if (!pathOrUrl) return null;

        const storageVersion = version || 'v3';
        const cacheKey = `${pathOrUrl}|${storageVersion}`;

        // --- CACHE CHECK ---
        if (this._urlCache[cacheKey]) {
            return this._urlCache[cacheKey];
        }

        // Never reuse expired presigned URLs from DB — normalize to key first
        if (typeof pathOrUrl === 'string' && pathOrUrl.includes('X-Amz-Signature')) {
            pathOrUrl = this.normalizeR2StoragePath(pathOrUrl);
        }



        // 🔥 ZERO LATENCY FIX: If the URL is already a Cloudflare public DEV URL (pub-...), 

        // do NOT ask the backend to sign it. It's already public.

        if (typeof pathOrUrl === 'string' && pathOrUrl.includes('pub-') && pathOrUrl.includes('.r2.dev')) {

            return pathOrUrl;

        }



        // --- HYBRID LOGIC ---

        // 1. Identification: Is it R2 or a public Supabase URL?

        const isR2Url = (

            pathOrUrl.includes('r2.cloudflarestorage.com') ||

            pathOrUrl.includes('pub-') ||

            // Local Relative path check (Should be R2)

            (!pathOrUrl.startsWith('http') &&

                !pathOrUrl.startsWith('data:') &&

                !pathOrUrl.startsWith('/images') &&

                !pathOrUrl.startsWith('/assets') &&

                !pathOrUrl.startsWith('/icon') &&

                !pathOrUrl.startsWith('/script') &&

                pathOrUrl.includes('/')

            )

        );



        // 2. Normalization: Clean accidental double slashes for R2 keys/paths

        // We skip this for full HTTP URLs to avoid 400 errors from sensitive servers (like Supabase storage)

        let processedPath = pathOrUrl;

        if (!pathOrUrl.startsWith('http')) {

            processedPath = pathOrUrl.replace(/\/\/+/g, "/");

        }



        if (!isR2Url && processedPath.startsWith('http')) {

            return processedPath; // Supabase public URL or already signed

        }



        // --- SECOND LAYER DEFENSE ---

        if (!isR2Url) return processedPath;



        // --- R2 LOGIC ---

        let key = processedPath;

        if (processedPath.startsWith('http')) {

            // Extract key from full R2 URL

            const r2Base = '.r2.cloudflarestorage.com/';

            if (processedPath.includes(r2Base)) {

                key = processedPath.split(r2Base)[1];

            } else {

                try {

                    const urlObj = new URL(pathOrUrl);

                    key = urlObj.pathname; // Note: pathname starts with / usually

                } catch (e) { }

            }

        }



        // 🔥 KEY CLEANUP: R2 keys must NOT start with / and must NOT have query params

        if (key.includes('?')) key = key.split('?')[0];

        while (key.startsWith('/')) key = key.substring(1);



        if (!key) return pathOrUrl;

        // Public covers, tagged MP3 previews, legacy audio paths — proxy (no auth)
        if (this.isPublicR2Key(key) || this.isPreviewAudioKey(key)) {
            const proxyUrl = this.getR2PublicProxyUrl(key, storageVersion);
            this._urlCache[cacheKey] = proxyUrl;
            return proxyUrl;
        }

        // --- SIGNING VIA API (private assets only) ---

        try {

            const token = this.getAccessToken();
            const response = await fetch(`${this._apiUrl}/r2/download-url`, {

                method: 'POST',

                headers: {

                    'Content-Type': 'application/json',

                    'Authorization': token ? `Bearer ${token}` : undefined

                },

                body: JSON.stringify({ key, version: storageVersion, productId })

            });



            if (!response.ok) {

                console.warn(`AuthUtils: Failed to sign R2 key: ${key}`, response.status);

                // Return original if signing fails as fallback (might be public)

                return pathOrUrl;

            }



            const { downloadUrl } = await response.json();

            this._urlCache[cacheKey] = downloadUrl; // Cache result

            return downloadUrl;

        } catch (error) {

            console.error('AuthUtils: Error getting authorized URL:', error);

            return pathOrUrl; // Fallback to original

        }

    },



    /**

     * Deletes one or more files from Cloudflare R2 via API.

     * @param {string|string[]} keys Single key or array of keys to delete.

     * @returns {Promise<boolean>} True if operation completed.

     */

    deleteFromR2: async function (keys) {

        if (!keys) return true;

        const keysArray = Array.isArray(keys) ? keys : [keys];

        if (keysArray.length === 0) return true;



        // Clean keys: Ensure only the path part is sent (no query params, no base URL)

        const cleanKeys = keysArray.map(k => {

            if (!k) return null;

            let key = k;

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

            }

            return key;

        }).filter(k => k);



        if (cleanKeys.length === 0) return true;



        try {

            const token = this.getAccessToken();

            const response = await fetch(`${this._apiUrl}/r2/delete-files`, {

                method: 'POST',

                headers: {

                    'Content-Type': 'application/json',

                    'Authorization': token ? `Bearer ${token}` : undefined

                },

                body: JSON.stringify({ keys: cleanKeys })

            });



            if (!response.ok) {

                const error = await response.json();

                console.error("AuthUtils: Failed to delete from R2:", error);

                return false;

            }



            return true;

        } catch (error) {

            console.error('AuthUtils: Error deleting from R2:', error);

            return false;

        }

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

    },



    _getApiUrl: function () {

        return this._apiUrl || `${window.OFFSZN_CONFIG?.API_BASE_URL || 'https://offszn.lat'}/api`;

    },



    _parseJwtPayload: function (token) {

        if (!token) return null;

        try {

            const payloadStr = token.split('.')[1];

            if (!payloadStr) return null;

            return JSON.parse(atob(payloadStr));

        } catch (e) {

            return null;

        }

    },



    getUserId: function () {

        if (window.currentUserId) return window.currentUserId;

        if (window.currentUserProfile?.id) return window.currentUserProfile.id;



        const lsId = localStorage.getItem('userId');

        if (lsId && lsId !== 'undefined' && lsId !== 'null') return lsId;



        const token = this.getAccessToken();

        const payload = this._parseJwtPayload(token);

        if (payload?.sub) return payload.sub;



        return null;

    },



    isLoggedIn: function () {

        return !!this.getAccessToken() && !!this.getUserId();

    },



    /** @deprecated Alias kept for older scripts (e.g. explore.js v28) */

    isUserLogged: function () {

        return this.isLoggedIn();

    },



    getCurrentUser: function () {

        if (window.currentUserProfile) return window.currentUserProfile;



        try {

            const cached = localStorage.getItem('offszn_user_cache');

            if (cached) return JSON.parse(cached);

        } catch (e) { }



        const userId = this.getUserId();

        if (!userId) return null;



        const token = this.getAccessToken();

        const payload = this._parseJwtPayload(token);

        return {

            id: userId,

            email: payload?.email || null,

            nickname: localStorage.getItem('offszn_cached_nickname') || null

        };

    },



    getCurrentUsername: function () {

        const user = this.getCurrentUser();

        return user?.nickname || localStorage.getItem('offszn_cached_nickname') || null;

    },



    getSession: async function () {

        if (!window.supabaseClient) this.initSupabase();

        if (!window.supabaseClient) return null;

        const { data } = await window.supabaseClient.auth.getSession();

        return data?.session || null;

    },



    getMe: async function () {

        const token = this.getAccessToken();

        if (!token) return null;



        try {

            const res = await fetch(`${this._getApiUrl()}/me`, {

                headers: { 'Authorization': `Bearer ${token}` }

            });

            if (!res.ok) return null;

            const user = await res.json();

            if (user?.id) {

                window.currentUserId = user.id;

                window.currentUserProfile = user;

                try {

                    localStorage.setItem('offszn_user_cache', JSON.stringify(user));

                } catch (e) { }

            }

            return user;

        } catch (e) {

            console.warn('AuthUtils.getMe failed:', e);

            return null;

        }

    },



    isR2Url: function (pathOrUrl) {

        if (!pathOrUrl || typeof pathOrUrl !== 'string') return false;

        return (

            pathOrUrl.includes('r2.cloudflarestorage.com') ||

            pathOrUrl.includes('pub-') ||

            pathOrUrl.includes('.r2.dev') ||

            (!pathOrUrl.startsWith('http') &&

                !pathOrUrl.startsWith('data:') &&

                !pathOrUrl.startsWith('/images') &&

                !pathOrUrl.startsWith('/assets') &&

                !pathOrUrl.startsWith('/icon') &&

                !pathOrUrl.startsWith('/script') &&

                pathOrUrl.includes('/'))

        );

    },



    getFormattedSupabaseUrl: function (path) {

        if (!path) return path;

        if (path.startsWith('http') || path.startsWith('data:')) return path;

        const sbUrl = window.SUPABASE_URL || 'https://qtjpvztpgfymjhhpoouq.supabase.co';

        return `${sbUrl}/storage/v1/object/public/products/${path.replace(/^\/+/, '')}`;

    },



    canFreeDownload: function (prod) {

        if (!prod) return false;

        if (prod.is_free === true) return true;

        return !!(prod.free_download_type && prod.free_download_type !== 'none');

    },



    getUploadLimitStatus: async function () {

        const fallback = { isLimited: false, count: 0, limit: 20, plan: 'free' };

        const planData = await this.getUserPlanData();

        if (!planData) return fallback;



        const limit = planData.limits?.max_uploads ?? 20;

        if (limit === Infinity) {

            return { isLimited: false, count: 0, limit: Infinity, plan: planData.plan };

        }



        const userId = this.getUserId();

        if (!userId || !window.supabaseClient) {

            return { ...fallback, limit, plan: planData.plan };

        }



        try {

            const countTables = [

                window.supabaseClient.from('products').select('*', { count: 'exact', head: true }).eq('producer_id', userId).neq('status', 'deleted'),

                window.supabaseClient.from('beat_drafts').select('*', { count: 'exact', head: true }).eq('user_id', userId),

                window.supabaseClient.from('drumkit_drafts').select('*', { count: 'exact', head: true }).eq('user_id', userId),

                window.supabaseClient.from('loopkit_drafts').select('*', { count: 'exact', head: true }).eq('user_id', userId),

                window.supabaseClient.from('preset_drafts').select('*', { count: 'exact', head: true }).eq('user_id', userId)

            ];

            const results = await Promise.all(countTables);

            const count = results.reduce((sum, r) => sum + (r.count || 0), 0);

            const status = { isLimited: count >= limit, count, limit, plan: planData.plan };

            try {

                sessionStorage.setItem('offszn_upload_limit_status', JSON.stringify(status));

            } catch (e) { }

            return status;

        } catch (e) {

            console.warn('AuthUtils.getUploadLimitStatus failed:', e);

            return { ...fallback, limit, plan: planData.plan };

        }

    },



    getYouTubeUploadStatus: async function () {

        const YT_LIMITS = { free: 3, starter: 10, pro: 30 };

        const planData = await this.getUserPlanData();

        const plan = planData?.plan || 'free';

        const limit = YT_LIMITS[plan] ?? YT_LIMITS.free;

        let used = planData?.usage?.youtube_uploads_this_month || 0;



        const token = this.getAccessToken();

        if (token) {

            try {

                const res = await fetch(`${this._getApiUrl()}/youtube/quota`, {

                    headers: { 'Authorization': `Bearer ${token}` }

                });

                if (res.ok) {

                    const data = await res.json();

                    used = data.used ?? used;

                    const apiLimit = data.limit ?? limit;

                    return {

                        used,

                        limit: apiLimit,

                        remaining: Math.max(0, apiLimit - used),

                        isLimited: used >= apiLimit,

                        plan: data.plan || plan

                    };

                }

            } catch (e) {

                console.warn('AuthUtils.getYouTubeUploadStatus API fallback:', e);

            }

        }



        return {

            used,

            limit,

            remaining: Math.max(0, limit - used),

            isLimited: used >= limit,

            plan

        };

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

        const num = parseFloat(priceStr.replace(/[^0-9.]/g, ''));

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

window.resolvePreviewMediaUrl = window.AuthUtils.resolvePreviewMediaUrl.bind(window.AuthUtils);

window.deleteFromR2 = window.AuthUtils.deleteFromR2.bind(window.AuthUtils);



// Attempt Init immediately

window.AuthUtils.initSupabase();

