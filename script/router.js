/**
 * GLOBAL SPA ROUTER WITH HYPER-PERFORMANCE CACHING & FAST CLICKS
 * Handles seamless page transitions without stopping the audio player.
 */

const Router = {
    contentId: 'app-main',
    isTransitioning: false,
    _loadAbort: null,
    _loadGen: 0,
    _pageCache: new Map(), // Zero-latency memory cache

    init() {
        console.log("🚀 SPA Router Initialized with Zero-Latency Caching & Fast Click Prioritization");

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

        // ⚡ Hover / Touch Prefetching for instant click transitions
        document.addEventListener('mouseover', (e) => {
            const link = e.target.closest('a');
            if (!link) return;
            const url = link.getAttribute('href');
            if (this.shouldIntercept(url, link)) {
                this.prefetch(url);
            }
        });

        document.addEventListener('touchstart', (e) => {
            const link = e.target.closest('a');
            if (!link) return;
            const url = link.getAttribute('href');
            if (this.shouldIntercept(url, link)) {
                this.prefetch(url);
            }
        }, { passive: true });
    },

    shouldIntercept(url, element) {
        if (!url) return false;
        if (url.startsWith('http') && !url.includes(window.location.host)) return false; // External
        if (url.startsWith('#')) return false; // Anchor
        if (element.hasAttribute('download') || element.getAttribute('target') === '_blank') return false;
        if (url.startsWith('mailto:') || url.startsWith('tel:')) return false;
        if (url.includes('.php') || url.includes('.zip') || url.includes('.png') || url.includes('.mp3') || url.includes('.wav')) return false; // Assets
        return true;
    },

    async prefetch(url) {
        if (!url || this._pageCache.has(url)) return;

        try {
            const response = await fetch(url, { cache: 'default' });
            if (response.ok) {
                const html = await response.text();
                this._pageCache.set(url, html);
                console.log(`⚡ Prefetched & Cached: ${url}`);
            }
        } catch (e) {
            // Silently ignore prefetch failures
        }
    },

    showProgressBar() {
        let bar = document.getElementById('spa-progress-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'spa-progress-bar';
            bar.style.position = 'fixed';
            bar.style.top = '0';
            bar.style.left = '0';
            bar.style.height = '3px';
            bar.style.background = 'linear-gradient(90deg, #b026ff, #ff2a85)';
            bar.style.boxShadow = '0 0 8px #b026ff, 0 0 12px #ff2a85';
            bar.style.zIndex = '99999';
            bar.style.transition = 'width 0.2s ease, opacity 0.2s ease';
            bar.style.width = '0%';
            bar.style.opacity = '1';
            document.body.appendChild(bar);
        }
        bar.style.opacity = '1';
        bar.style.width = '0%';
        setTimeout(() => {
            if (bar.style.opacity === '1') {
                bar.style.width = '75%';
            }
        }, 30);
    },

    hideProgressBar() {
        const bar = document.getElementById('spa-progress-bar');
        if (bar) {
            bar.style.width = '100%';
            setTimeout(() => {
                bar.style.opacity = '0';
                setTimeout(() => {
                    bar.style.width = '0%';
                }, 200);
            }, 50);
        }
    },

    async navigate(url) {
        if (this._loadAbort) {
            this._loadAbort.abort();
        }

        window.history.pushState({}, '', url);
        await this.loadPage(url, true);
    },

    async loadPage(url, scrollUp = true) {
        const loadGen = ++this._loadGen;
        if (this._loadAbort) {
            this._loadAbort.abort();
        }
        this._loadAbort = new AbortController();
        const { signal } = this._loadAbort;

        this.isTransitioning = true;
        const main = document.getElementById(this.contentId);
        if (!main) {
            console.error("Router: Main container not found!");
            window.location.href = url; // Fallback
            return;
        }

        // Check page cache
        const cachedHtml = this._pageCache.get(url);
        let renderedFromCache = false;

        if (cachedHtml) {
            this.renderPageHTML(cachedHtml, main, scrollUp);
            renderedFromCache = true;
            this.isTransitioning = false; // Fast unlock to prioritize next clicks
        } else {
            this.showProgressBar();
            main.style.opacity = '0.85';
        }

        try {
            // Perform background revalidation
            const response = await fetch(url, { signal, cache: 'no-cache' });
            if (!response.ok) throw new Error("Load failed");
            if (loadGen !== this._loadGen) return;

            const html = await response.text();
            
            // If content has changed or was never rendered, update DOM and cache
            if (!renderedFromCache || this._pageCache.get(url) !== html) {
                this._pageCache.set(url, html);
                this.renderPageHTML(html, main, !renderedFromCache && scrollUp);
            }

            this.hideProgressBar();
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error("Router Error:", err);
            if (!renderedFromCache) {
                window.location.href = url; // Fallback hard reload
            }
        } finally {
            if (loadGen === this._loadGen) {
                main.style.opacity = '1';
                this.isTransitioning = false;
                this.hideProgressBar();
            }
        }
    },

    renderPageHTML(html, main, scrollUp) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 1. Update Title
        document.title = doc.title;

        // 2. Swap Content
        const newContent = doc.getElementById(this.contentId);
        if (newContent) {
            main.innerHTML = newContent.innerHTML;
            main.className = newContent.className;
        } else {
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
