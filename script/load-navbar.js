/**
 * load-navbar.js
 * Injects the exact same extracted navbar HTML block into any page.
 * Dispatches a 'navbarLoaded' event so scripts inside navbar.js know when to initialize.
 */

(async () => {
    const placeholder = document.getElementById('navbar-placeholder');
    if (!placeholder) {
        console.warn('load-navbar.js: No <div id="navbar-placeholder"> found on this page.');
        return;
    }

    try {
        // Determine the base path based on the current URL depth, or just use absolute if on a server
        let pathPrefix = '/';
        if (window.location.protocol === 'file:') {
            pathPrefix = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/recursos/') || window.location.pathname.includes('/comunidad/') || window.location.pathname.includes('/cursos/') || window.location.pathname.includes('/studio/') || window.location.pathname.includes('/cuenta/') || window.location.pathname.includes('/servicios/') ? '../' : './';
        }
        const response = await fetch(pathPrefix + 'components/navbar.html?v=' + new Date().getTime());
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
            script.src = pathPrefix + 'script/share-modal.js?v=' + new Date().getTime();
            document.body.appendChild(script);
        }

        // Dynamically load share-modal.css so it's available globally
        if (!document.getElementById('share-modal-css')) {
            const link = document.createElement('link');
            link.id = 'share-modal-css';
            link.rel = 'stylesheet';
            link.href = pathPrefix + 'css/share-modal.css?v=' + new Date().getTime();
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
