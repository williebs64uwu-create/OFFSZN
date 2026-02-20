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
        // A simple fix for local files is to try './components/navbar.html' if on root, or '../' if in a subfolder.
        const pathPrefix = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/recursos/') || window.location.pathname.includes('/comunidad/') || window.location.pathname.includes('/cursos/') || window.location.pathname.includes('/studio/') || window.location.pathname.includes('/cuenta/') || window.location.pathname.includes('/servicios/') ? '../' : './';
        const response = await fetch(pathPrefix + 'components/navbar.html?v=' + new Date().getTime());
        if (!response.ok) {
            throw new Error(`Failed to load navbar: ${response.status}`);
        }

        const html = await response.text();
        placeholder.outerHTML = html; // Replaces the placeholder entirely with the <header class="navbar">

        // Notify anyone listening (like navbar.js) that the elements now exist
        window.dispatchEvent(new CustomEvent('offszn-navbar-loaded'));

        // As a backward-compatible fallback, if initNavbarUI is defined, call it directly
        if (typeof window.initNavbarUI === 'function') {
            window.initNavbarUI();
        }

    } catch (error) {
        console.error('Error loading navbar component:', error);
    }
})();
