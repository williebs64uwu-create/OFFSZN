/**
 * GLOBAL SPA ROUTER
 * Handles seamless page transitions without stopping the audio player.
 */

const Router = {
    contentId: 'app-main',
    isTransitioning: false,

    init() {
        console.log("🚀 SPA Router Initialized");

        // Intercept all internal clicks
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (!link) return;

            const url = link.getAttribute('href');
            if (this.shouldIntercept(url, link)) {
                e.preventDefault();
                this.navigate(url);
            }
        });

        // Handle Back/Forward buttons
        window.addEventListener('popstate', () => {
            this.loadPage(window.location.pathname + window.location.search, false);
        });
    },

    shouldIntercept(url, element) {
        if (!url) return false;
        if (url.startsWith('http') && !url.includes(window.location.host)) return false; // External
        if (url.startsWith('#')) return false; // Anchor
        if (element.hasAttribute('download') || element.getAttribute('target') === '_blank') return false;
        if (url.startsWith('mailto:') || url.startsWith('tel:')) return false;
        if (url.includes('.php') || url.includes('.zip') || url.includes('.png')) return false; // Assets
        return true;
    },

    async navigate(url) {
        if (this.isTransitioning) return;

        // Update URL immediately for responsiveness
        window.history.pushState({}, '', url);
        await this.loadPage(url, true);
    },

    async loadPage(url, scrollUp = true) {
        this.isTransitioning = true;
        const main = document.getElementById(this.contentId);
        if (!main) {
            console.error("Router: Main container not found!");
            window.location.href = url; // Fallback
            return;
        }

        // Show loading state (optional subtle opacity?)
        main.style.opacity = '0.7';

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Load failed");

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // 1. Update Title
            document.title = doc.title;

            // 2. Swop Content
            const newContent = doc.getElementById(this.contentId);
            if (newContent) {
                main.innerHTML = newContent.innerHTML;

                // Transfer classes if any
                main.className = newContent.className;
            } else {
                // Fallback: If no #app-main found in target, try replacing the whole body content 
                // but keep the player and navbar containers if they exist outside.
                // For now, we assume all pages have #app-main.
                console.warn("Router: #app-main not found in target page, reloading...");
                window.location.reload();
                return;
            }

            // 3. Re-inject Scripts
            this.executeScripts(main);

            // 4. Reset UI States (Close menus)
            if (window.closeAllOverlays) window.closeAllOverlays();
            if (window.closeAllUI) window.closeAllUI();

            if (scrollUp) window.scrollTo(0, 0);

        } catch (err) {
            console.error("Router Error:", err);
            window.location.href = url; // Hard reload on error
        } finally {
            main.style.opacity = '1';
            this.isTransitioning = false;
        }
    },

    executeScripts(container) {
        const scripts = container.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });

            if (oldScript.innerText) {
                newScript.innerText = oldScript.innerText;
            }

            // Replace to trigger execution
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });

        // Trigger custom event for manual re-init
        setTimeout(() => {
            document.dispatchEvent(new Event('DOMContentLoaded')); // Trigger legacy scripts
            document.dispatchEvent(new CustomEvent('offszn:page-changed', {
                detail: { url: window.location.pathname }
            }));
            console.log("🔔 SPA: Page scripts re-triggered");
        }, 50);
    }
};

// Start
Router.init();
window.SPA_Router = Router;
