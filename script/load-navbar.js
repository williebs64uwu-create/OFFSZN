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
    if (!placeholder) {
        console.warn('load-navbar.js: No <div id="navbar-placeholder"> found on this page.');
        return;
    }

    // 🔥 FOUC FIX: Immediately inject a skeleton that matches navbar dimensions
    // This prevents the "black flash" by reserving space with matching background
    placeholder.innerHTML = `
        <header style="
            background: #000;
            height: 64px;
            width: 100%;
            display: flex;
            align-items: center;
            padding: 0 24px;
            box-sizing: border-box;
            position: sticky;
            top: 0;
            z-index: 1000;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        ">
            <div style="display:flex; align-items:center; gap:16px; width:100%;">
                <div style="width:100px; height:28px; background:rgba(255,255,255,0.04); border-radius:6px;"></div>
                <div style="flex:1; max-width:440px; height:40px; background:rgba(255,255,255,0.03); border-radius:12px; margin-left:24px;"></div>
                <div style="margin-left:auto; display:flex; gap:12px; align-items:center;">
                    <div style="width:36px; height:36px; background:rgba(255,255,255,0.04); border-radius:50%;"></div>
                    <div style="width:36px; height:36px; background:rgba(255,255,255,0.04); border-radius:50%;"></div>
                </div>
            </div>
        </header>`;

    try {
        // Determine the base path based on the current URL depth, or just use absolute if on a server
        let pathPrefix = '/';
        if (window.location.protocol === 'file:') {
            pathPrefix = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/recursos/') || window.location.pathname.includes('/comunidad/') || window.location.pathname.includes('/cursos/') || window.location.pathname.includes('/studio/') || window.location.pathname.includes('/cuenta/') || window.location.pathname.includes('/servicios/') ? '../' : './';
        }
        const response = await fetch(pathPrefix + 'components/navbar.html?v=21');
        if (!response.ok) {
            throw new Error(`Failed to load navbar: ${response.status}`);
        }

        const html = await response.text();
        placeholder.outerHTML = html; // Replaces the placeholder entirely to avoid nested styling/double borders

        // Notify anyone listening (like navbar.js) that the elements now exist
        window.dispatchEvent(new CustomEvent('offszn-navbar-loaded'));

        // Dynamically load share-modal.js so it's available globally
        if (!document.getElementById('share-modal-script')) {
            const script = document.createElement('script');
            script.id = 'share-modal-script';
            script.src = pathPrefix + 'script/share-modal.js?v=20';
            document.body.appendChild(script);
        }

        // Dynamically load share-modal.css so it's available globally
        if (!document.getElementById('share-modal-css')) {
            const link = document.createElement('link');
            link.id = 'share-modal-css';
            link.rel = 'stylesheet';
            link.href = pathPrefix + 'css/share-modal.css?v=20';
            document.head.appendChild(link);
        }

        // As a backward-compatible fallback, if initNavbarUI is defined, call it directly
        if (typeof window.initNavbarUI === 'function') {
            window.initNavbarUI();
        }

    } catch (error) {
        console.error('Error loading navbar component:', error);
    }
})();

