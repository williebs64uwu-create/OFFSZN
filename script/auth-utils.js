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
    _apiUrl: null,
    _apiBase: null,

    /**
     * Initialize Supabase Client globally if credentials exist.
     * Use this ensuring window.SUPABASE_URL is defined before loading this script.
     */
    initSupabase: function () {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        // 🔥 DEBUG: Disabled by default to keep console clean
        // if (isLocal) window.OFFSZN_DEBUG = true;

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
                    
                    // Always ensure localStorage has the token for strict client guards
                    localStorage.setItem('authToken', session.access_token);
                    
                    // Always ensure cookie has the token for server API calls
                    const maxAge = 60 * 60 * 24 * 7; // 1 week
                    document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${maxAge}; SameSite=Strict; Secure`;
                } else if (event === 'SIGNED_OUT') {
                    window.AuthUtils._cachedToken = null;
                    localStorage.removeItem('authToken');
                    document.cookie = `sb-access-token=; path=/; max-age=0; SameSite=Strict; Secure`;
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

    _urlCache: {}, // In-memory cache
    _signingQueue: [], // Queue for batching: { key, version, resolve, reject }
    _batchTimeout: null,

    /**
     * Tries to load cache from sessionStorage to persist signed URLs during the session.
     */
    _loadCache: function () {
        try {
            const saved = sessionStorage.getItem('offszn_r2_cache');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Only keep urls signed in the last 12 hours
                const now = Date.now();
                for (const [k, v] of Object.entries(parsed)) {
                    if (v.url && (now - v.timestamp < 12 * 3600 * 1000)) {
                        this._urlCache[k] = v.url;
                    }
                }
            }
        } catch (e) { }
    },

    /**
     * Saves the current cache to sessionStorage.
     */
    _saveCache: function (key, url) {
        this._urlCache[key] = url;
        try {
            const saved = sessionStorage.getItem('offszn_r2_cache');
            let cache = saved ? JSON.parse(saved) : {};
            cache[key] = { url, timestamp: Date.now() };

            // Limit cache size to 200 items to avoid sessionStorage bloat
            const keys = Object.keys(cache);
            if (keys.length > 200) {
                delete cache[keys[0]];
            }

            sessionStorage.setItem('offszn_r2_cache', JSON.stringify(cache));
        } catch (e) { }
    },

    getAuthorizedUrl: async function (pathOrUrl, version = null, productId = null) {
        if (!pathOrUrl) return null;

        // 🔥 SUPABASE FAST-PATH: If version is 'supabase' or URL is already Supabase, skip signing
        if (version === 'supabase' || (typeof pathOrUrl === 'string' && pathOrUrl.includes('supabase.co'))) {
            return this.getFormattedSupabaseUrl(pathOrUrl);
        }

        // Ensure cache is loaded (once)
        if (Object.keys(this._urlCache).length === 0 && !this._cacheLoaded) {
            this._loadCache();
            this._cacheLoaded = true;
        }

        // 🔥 STRATEGY: 100% Explicit Versioning. No guessing bucket names or URL strings.
        const actualVersion = version || (window.R2_CURRENT_VERSION || 'v2');
        const cacheKey = `${pathOrUrl}__v=${actualVersion}`;

        const cachedUrl = this._urlCache[cacheKey];
        if (cachedUrl) return cachedUrl;

        let key = pathOrUrl;
        if (typeof key === 'string') {
            if (key.startsWith('@')) key = key.substring(1);
            if (key.startsWith('http')) {
                try {
                    const urlObj = new URL(key);
                    key = urlObj.pathname;
                    if (urlObj.hostname.includes('supabase.co')) {
                        const parts = key.split('/');
                        const objIdx = parts.indexOf('object');
                        if (objIdx !== -1 && parts.length > objIdx + 2) key = parts.slice(objIdx + 2).join('/');
                    }
                } catch (e) { }
            }
            while (key.startsWith('/')) key = key.substring(1);
            if (key.includes('?')) key = key.split('?')[0];
        }

        if (window.OFFSZN_DEBUG) console.log(`[AuthUtils] Queueing sign for key: ${key} (Version: ${actualVersion})`);

        if (!key) return pathOrUrl;

        return new Promise((resolve, reject) => {
            this._signingQueue.push({
                raw: pathOrUrl,
                cacheKey: cacheKey,
                key,
                version: actualVersion,
                productId,
                resolve,
                reject
            });

            if (!this._batchTimeout) {
                this._batchTimeout = setTimeout(() => this._processSigningQueue(), 50);
            }
        });
    },

    /**
     * Sanitizes and formats a Supabase URL to prevent double-prefixing.
     * Works with both relative paths and already-full URLs.
     */
    getFormattedSupabaseUrl: function (pathOrUrl) {
        if (!pathOrUrl) return null;
        if (typeof pathOrUrl !== 'string') return pathOrUrl;

        // Skip common protocols or local paths
        if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:') || pathOrUrl.startsWith('/')) return pathOrUrl;

        // If it's an external URL (not Supabase), return as is
        if (pathOrUrl.startsWith('http') && !pathOrUrl.includes('supabase.co')) return pathOrUrl;

        // Safety check: if it starts with 'http' but is actually a Supabase path mistakenly prefixed
        if (pathOrUrl.startsWith('http') && pathOrUrl.includes('supabase.co')) {
            try {
                const urlObj = new URL(pathOrUrl);
                const parts = urlObj.pathname.split('/');
                const publicIdx = parts.indexOf('public');
                if (publicIdx !== -1 && parts.length > publicIdx + 2) {
                    const bucket = parts[publicIdx + 1];
                    const path = parts.slice(publicIdx + 2).join('/');
                    return `${bucket}/${path}`;
                }
            } catch (e) {
                console.error("Error parsing Supabase URL:", e);
            }
        }

        const sbUrl = (window.SUPABASE_URL || "https://qtjpvztpgfymjhhpoouq.supabase.co").replace(/\/$/, '');
        let path = pathOrUrl;

        // 1. If it's already a full Supabase URL, extract the path part for re-sanitization
        if (path.includes('supabase.co')) {
            const publicIdx = path.indexOf('/public/');
            if (publicIdx !== -1) {
                const afterPublic = path.substring(publicIdx + 8);
                const firstSlash = afterPublic.indexOf('/');
                if (firstSlash !== -1) {
                    // Re-process from bucket + path
                    path = afterPublic;
                }
            }
        }

        // 2. Identify and strip the bucket name from the start of the path
        let bucket = 'products';
        // Expanded list to include legacy/misplaced bucket prefixes
        const buckets = ['avatars', 'banners', 'public', 'licenses', 'products', 'beats', 'audio', 'mp3_tagged', 'wav_tagged'];

        for (const b of buckets) {
            if (path.startsWith(`${b}/`)) {
                // Special case: if bucket is 'beats' or 'audio' but that bucket doesn't exist in Supabase storage,
                // we treat it as a path part within the 'products' bucket.
                if (b === 'beats' || b === 'audio' || b === 'mp3_tagged') {
                    bucket = 'products';
                } else {
                    bucket = b;
                    path = path.substring(b.length + 1);
                }
                break;
            }
        }

        // 3. Robust clean: recursively remove redundant prefixes
        while (path.startsWith('products/') || path.startsWith('avatars/') || path.startsWith('banners/') || path.startsWith('public/')) {
            const firstSlash = path.indexOf('/');
            path = path.substring(firstSlash + 1);
        }

        // 4. LEGACY PATH REPAIR: Swap "type/UUID" or "type/subtype/UUID" to "UUID/type/subtype"
        // This is a common structural mismatch in the OFFSZN database.
        // Matches: covers/UUID, audio/UUID, beats/mp3/UUID, mp3_tagged/UUID etc.
        const legacyPattern = /^(covers|audio|mp3_tagged|beats|wav_tagged)(\/[^\/]+)?\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/.*)?$/i;
        const match = path.match(legacyPattern);
        if (match) {
            const type = match[1];
            const subType = match[2] || ''; // e.g. /mp3
            const uuid = match[3];
            const rest = match[4] || '';
            // New structure: UUID/type[/subtype][rest]
            path = `${uuid}/${type}${subType}${rest}`;
        }

        return `${sbUrl}/storage/v1/object/public/${bucket}/${path}`;
    },

    /**
     * Processes all queued signing requests in a single batch call.
     */
    _processSigningQueue: async function () {
        const queue = [...this._signingQueue];
        this._signingQueue = [];
        this._batchTimeout = null;

        if (queue.length === 0) return;

        // Handle single request normally for simplicity or if batch fails
        if (queue.length === 1) {
            const item = queue[0];
            this._performSigningCall(item.key, item.version, item.productId)
                .then(url => {
                    this._saveCache(item.cacheKey || item.raw, url);
                    item.resolve(url);
                })
                .catch(err => item.reject(err));
            return;
        }

        try {
            const token = this.getAccessToken();
            // 🔥 GROUP BY VERSION: Send separate batches to avoid signing errors
            const versions = [...new Set(queue.map(i => i.version || 'v2'))];

            for (const v of versions) {
                const versionItems = queue.filter(i => (i.version || 'v2') === v);
                const items = versionItems.map(i => ({ path: i.key, productId: i.productId }));

                try {
                    const response = await fetch(`${this._apiUrl}/r2/bulk-sign`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token ? `Bearer ${token}` : undefined
                        },
                        body: JSON.stringify({
                            items,
                            version: v,
                            version: v,
                            productId: versionItems[0].productId // Pass first ID as hint/safety
                        })
                    });

                    if (response.ok) {
                        const { results } = await response.json();

                        versionItems.forEach(item => {
                            const res = results[item.key];
                            if (res && res.downloadUrl) {
                                this._saveCache(item.cacheKey || item.raw, res.downloadUrl);
                                item.resolve(res.downloadUrl);
                            } else {
                                this._handleSigningFailure(item.key, item.raw)
                                    .then(url => item.resolve(url))
                                    .catch(err => item.reject(err));
                            }
                        });
                    } else {
                        throw new Error(`Batch signing failed for ${v}: ${response.status}`);
                    }
                } catch (err) {
                    console.error(`[AuthUtils] Error batch signing ${v}:`, err);
                    versionItems.forEach(item => {
                        this._handleSigningFailure(item.key, item.raw)
                            .then(url => item.resolve(url))
                            .catch(err => item.reject(err));
                    });
                }
            }
        } catch (error) {
            console.error('[AuthUtils] Batch signing crash, falling back to individual calls:', error);
            // Fallback: perform individual calls for everything in this failed batch
            queue.forEach(item => {
                this._performSigningCall(item.key, item.version, item.productId)
                    .then(url => {
                        this._saveCache(item.cacheKey || item.raw, url);
                        item.resolve(url);
                    })
                    .catch(e => item.reject(e));
            });
        }
    },

    /**
     * Individual signing call logic (Moved from getAuthorizedUrl)
     */
    _performSigningCall: async function (key, version, productId = null) {
        try {
            const token = this.getAccessToken();
            const response = await fetch(`${this._apiUrl}/r2/download-url`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : undefined
                },
                body: JSON.stringify({ key, version, productId })
            });

            if (!response.ok) return this._handleSigningFailure(key);

            const { downloadUrl } = await response.json();
            return downloadUrl;
        } catch (e) {
            return this._handleSigningFailure(key);
        }
    },

    /**
     * Centralized failure handling with better fallbacks.
     */
    _handleSigningFailure: async function (key, rawOriginal) {
        // Recognition of UUID/covers as public even if 'products/' was stripped
        const isProductAsset = key.includes('/covers/') || key.includes('/previews/') || key.includes('/mp3/') || 
            // Also recognize legacy Cloudinary/Timestamped root files e.g., 1774225861578_cover_edit.jpg
            (!key.includes('/') && /\.(jpg|jpeg|png|webp|gif|mp3|wav)$/i.test(key));

        console.warn(`AuthUtils: Signing failed for ${key} (ProductAsset: ${isProductAsset})`);

        const publicPrefixes = ['products/', 'beats/mp3/', 'avatars/', 'public/', 'banners/', 'drumkits/'];
        const isPublic = isProductAsset || publicPrefixes.some(prefix => key.startsWith(prefix));

        if (isPublic) {
            // Check if it's already a full URL that was passed in
            if (rawOriginal && rawOriginal.includes('supabase.co')) return rawOriginal;

            // If it's a legacy root file without prefix, it was in Supabase `products/` originally
            if (!key.includes('/') && /\.(jpg|jpeg|png|webp|gif)$/i.test(key)) {
                const sbUrl = this.SUPABASE_URL || "https://qtjpvztpgfymjhhpoouq.supabase.co";
                return `${sbUrl}/storage/v1/object/public/products/${key}`;
            }

            // 🔥 FIX: Use _apiUrl which already includes /api
            const apiRoot = this._apiUrl || '/api';
            return `${apiRoot}/r2-public/${key}`;
        }

        return rawOriginal; // Last resort: return original string
    },

    /**
     * Identification if a URL belongs to a storage provider structure (R2 or Supabase).
     */
    isR2Url: function (pathOrUrl) {
        if (!pathOrUrl || typeof pathOrUrl !== 'string') return false;

        // 🔥 SUPABASE EXCLUSION: If it contains supabase.co, it's NOT an R2 URL that needs signing by our proxy
        if (pathOrUrl.includes('supabase.co')) return false;
        if (pathOrUrl.startsWith('products/')) return true;

        // UUID Path detection (for migrated image_url)
        // We ONLY consider it R2 if it starts with 'products/' or other R2 prefixes.
        // Plain UUID/covers/... paths are now treated as Supabase by default unless r2_version is explicitly set to v1/v2.
        const isUUIDPath = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(pathOrUrl);

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
                (pathOrUrl.includes('/') || /\.(jpg|jpeg|png|webp|gif|svg|mp3|wav|zip)$/i.test(pathOrUrl) || pathOrUrl.startsWith('@') || pathOrUrl.startsWith('beats/') || pathOrUrl.startsWith('products/'))
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
                    if (k.includes('offsznlatbucket') || k.includes('42fc23b1767793610255470d2b453e92')) {
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
    },

    /**
     * 🔥 CURRENCY SYNC: Persists user preference to DB
     */
    syncCurrencyPreference: async function (currency) {
        const token = this.getAccessToken();
        if (!token) return;

        try {
            await fetch(`${this._apiUrl}/users/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ preferredCurrency: currency })
            });
            if (window.OFFSZN_DEBUG) console.log(`[AuthUtils] Currency preference synced to DB: ${currency}`);
        } catch (e) {
            console.warn("[AuthUtils] Failed to sync currency preference", e);
        }
    }
};


// Backwards compatibility / Direct global access shortcuts
window.getAccessToken = window.AuthUtils.getAccessToken.bind(window.AuthUtils);
window.getAuthorizedUrl = window.AuthUtils.getAuthorizedUrl.bind(window.AuthUtils);
window.uploadToR2 = window.AuthUtils.uploadToR2.bind(window.AuthUtils);
window.deleteFromR2 = window.AuthUtils.deleteFromR2.bind(window.AuthUtils);

// Attempt Init immediately
window.AuthUtils.initSupabase();

/**
 * 🔥 R2 SIGNING UTILITY: Asynchronously signs all R2 images in the target container
 * This ensures that relative paths or unsigned R2 URLs are replaced with valid signed URLs.
 */
window.signR2Images = async function (container = document) {
    if (!window.AuthUtils || !window.AuthUtils.getAuthorizedUrl) return;

    // 1. Handle regular IMG tags
    const images = container.querySelectorAll('img[data-r2-src], img[data-r2-version]');
    const imgPromises = Array.from(images).map(async img => {
        const rawSrc = img.getAttribute('data-r2-src') || img.getAttribute('src');
        const currentSrc = img.src;

        if (!rawSrc) return;

        // Only sign if it's not already signed or is a data-r2-src placeholder
        const needsSigning = (rawSrc && !rawSrc.startsWith('http')) ||
            (currentSrc.includes('r2.cloudflarestorage.com') && !currentSrc.includes('X-Amz-Signature')) ||
            (img.getAttribute('data-r2-src'));

        if (needsSigning) {
            const version = img.getAttribute('data-r2-version') || 'v2';
            const signedUrl = await window.AuthUtils.getAuthorizedUrl(rawSrc, version);

            if (signedUrl && signedUrl !== currentSrc) {
                img.src = signedUrl;
            }
        }
    });

    // 2. Handle background images (elements with data-r2-bg)
    const bgElements = container.querySelectorAll('[data-r2-bg]');
    const bgPromises = Array.from(bgElements).map(async el => {
        const rawPath = el.getAttribute('data-r2-bg');
        if (!rawPath) return;

        const version = el.getAttribute('data-r2-version') || 'v2';
        const signedUrl = await window.AuthUtils.getAuthorizedUrl(rawPath, version);

        if (signedUrl) {
            el.style.backgroundImage = `url('${signedUrl}')`;
        }
    });

    await Promise.all([...imgPromises, ...bgPromises]);
};

// ==================== GLOBAL IMAGE FALLBACK ==================== //
/**
 * Catch all image 404s (specifically Cloudinary) and try to load from Supabase Storage instead.
 */
// --- GLOBAL IMAGE ERROR HANDLER (R2 Fallback & Supabase Auto-Fix) ---
window.addEventListener('error', function (e) {
    if (e.target.tagName !== 'IMG') return;
    const img = e.target;
    if (img.dataset.fallbackTried === "true") return;

    const currentSrc = img.src;

    // 1. Supabase Auto-Fix (Catch double-prefixing 400 errors)
    if (currentSrc && currentSrc.includes('supabase.co')) {
        if (window.AuthUtils && typeof window.AuthUtils.getFormattedSupabaseUrl === 'function') {
            const sanitized = window.AuthUtils.getFormattedSupabaseUrl(currentSrc);
            if (sanitized && sanitized !== currentSrc) {
                if (window.OFFSZN_DEBUG) console.log(`[AuthUtils] Supabase 400/404 detected. Auto-fixing URL: ${sanitized}`);
                img.dataset.fallbackTried = "true";
                img.src = sanitized;
                return;
            }
        }
    }

    // 2. R2 Fallback (Catch signed R2 URLs or public R2 URLs that 404)
    if (currentSrc && (currentSrc.includes('r2.cloudflarestorage.com') || currentSrc.includes('pub-'))) {
        try {
            let key = img.getAttribute('data-r2-src');
            if (!key) {
                const urlObj = new URL(currentSrc);
                const pathParts = urlObj.pathname.split('/');
                const filteredParts = pathParts.filter(p => p && p !== 'offszn-storage' && p !== 'offsznlatbucket');
                key = filteredParts.join('/');
            }

            if (key) {
                const fallbackUrl = window.AuthUtils.getFormattedSupabaseUrl(key);
                if (window.OFFSZN_DEBUG) console.log(`[AuthUtils] R2 404 caught. Attempting Supabase fallback: ${fallbackUrl}`);
                img.dataset.fallbackTried = "true";
                img.src = fallbackUrl;
                return;
            }
        } catch (err) { }
    }

    // 3. Cloudinary Fallback (Legacy)
    if (currentSrc && currentSrc.includes('res.cloudinary.com')) {
        try {
            const parts = currentSrc.split('/upload/');
            if (parts.length > 1) {
                let pathAfterUpload = parts[1].replace(/^v\d+\//, '');
                const fallbackUrl = window.AuthUtils.getFormattedSupabaseUrl(pathAfterUpload);
                img.dataset.fallbackTried = "true";
                img.src = fallbackUrl;
            }
        } catch (err) { }
    }
}, true); // Use capture phase to catch all images before they bubble
