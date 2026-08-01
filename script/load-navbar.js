/**

 * load-navbar.js

 * Injects the exact same extracted navbar HTML block into any page.

 * Dispatches a 'navbarLoaded' event so scripts inside navbar.js know when to initialize.

 * 

 * 🔥 FOUC FIX: Immediately injects a lightweight skeleton that matches the navbar's

 * dimensions and background, eliminating the black flash between page loads.

 */



(async () => {

    const placeholder = document.getElementById('navbar-placeholder');

    const CACHE_KEY = 'offszn_navbar_cache_v2'; // Increment key if structure changes significantly

    const NAVBAR_URL = 'components/navbar.html?v=23';



    /**

     * 🔥 ZERO-FLASH CACHING LOGIC

     * 1. Check if we have a cached version in localStorage.

     * 2. If yes, inject it IMMEDIATELY to avoid any flash.

     * 3. Fetch fresh copy in background.

     * 4. If different, update DOM and cache.

     */



    if (placeholder && document.querySelector('header.navbar')) {

        placeholder.remove();

        if (placeholder) placeholder.remove();

        window.dispatchEvent(new CustomEvent('offszn-navbar-loaded'));

        initGlobalDependencies();

        return;

    }



    if (!placeholder) {

        return;

    }



    // 2. Try to load from cache

    const cachedHtml = localStorage.getItem(CACHE_KEY);

    let injectedFromCache = false;



    if (cachedHtml) {

        placeholder.innerHTML = cachedHtml;

        injectedFromCache = true;

        // Notify listeners that navbar is partially ready (from cache)

        window.dispatchEvent(new CustomEvent('offszn-navbar-loaded', { detail: { source: 'cache' } }));



        // As a backward-compatible fallback

        if (typeof window.initNavbarUI === 'function') {

            window.initNavbarUI();

        }

    } else {

        // Fallback: Show skeleton if no cache exists

        placeholder.innerHTML = `

            <header style="background: #050505; height: 64px; width: 100%; display: flex; align-items: center; padding: 0 24px; box-sizing: border-box; position: sticky; top: 0; z-index: 1000; border-bottom: 1px solid rgba(255,255,255,0.06);">

                <div style="display:flex; align-items:center; gap:16px; width:100%;">

                    <div style="width:100px; height:28px; background:rgba(255,255,255,0.04); border-radius:6px;"></div>

                    <div style="flex:1; max-width:440px; height:40px; background:rgba(255,255,255,0.03); border-radius:12px; margin-left:24px;"></div>

                    <div style="margin-left:auto; display:flex; gap:12px; align-items:center;">

                        <div style="width:36px; height:36px; background:rgba(255,255,255,0.04); border-radius:50%;"></div>

                        <div style="width:36px; height:36px; background:rgba(255,255,255,0.04); border-radius:50%;"></div>

                    </div>

                </div>

            </header>`;

    }



    try {

        let pathPrefix = '/';

        if (window.location.protocol === 'file:') {

            pathPrefix = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/recursos/') || window.location.pathname.includes('/comunidad/') || window.location.pathname.includes('/cursos/') || window.location.pathname.includes('/studio/') || window.location.pathname.includes('/cuenta/') || window.location.pathname.includes('/servicios/') ? '../' : './';

        }



        const response = await fetch(pathPrefix + NAVBAR_URL);

        if (!response.ok) throw new Error(`Failed to load navbar: ${response.status}`);



        const freshHtml = await response.text();



        // 3. Update if different or not already injected

        if (freshHtml !== cachedHtml) {

            placeholder.innerHTML = freshHtml;

            localStorage.setItem(CACHE_KEY, freshHtml);



            // Dispatch event for fresh load

            window.dispatchEvent(new CustomEvent('offszn-navbar-loaded', { detail: { source: 'network' } }));



            // Re-init UI if it was updated

            if (typeof window.initNavbarUI === 'function') {

                window.initNavbarUI();

            }

        }



        // Dynamically load dependencies
        loadDependency('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css', 'css', 'bootstrap-icons-css');
        loadDependency(pathPrefix + 'script/share-modal.js?v=23', 'js', 'share-modal-script');
        loadDependency(pathPrefix + 'css/share-modal.css?v=23', 'css', 'share-modal-css');



    } catch (error) {

        console.error('Error loading navbar component:', error);

    }



    function loadDependency(url, type, id) {

        if (document.getElementById(id)) return;

        if (type === 'js') {

            const s = document.createElement('script');

            s.id = id;

            s.src = url;

            document.body.appendChild(s);

        } else {

            const l = document.createElement('link');

            l.id = id;

            l.rel = 'stylesheet';

            l.href = url;

            document.head.appendChild(l);

        }

    }

})();





