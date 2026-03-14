/**
 * R2 Auto-Loader - Premium Authorization Hook
 * Automatically signs R2 resources found in the DOM.
 * This works globally without having to refactor existing render logic.
 */
(function () {
    /**
     * Resolves an image element's R2 source.
     */
    async function resolveElement(el) {
        if (el.tagName === 'IMG') {
            const src = el.getAttribute('src');
            if (window.OFFSZN_DEBUG && src && !src.startsWith('data:')) {
                console.log(`[R2-Loader] Checking image: ${src.substring(0, 50)}${src.length > 50 ? '...' : ''}`);
            }
            if (!src) return;

            // Detect R2 paths (Full URLs or relative keys)
            // 🔥 FIX: Ignore data: URIs, local images (/images, /assets), and non-string src
            const isR2 = (
                src.includes('r2.cloudflarestorage.com') ||
                src.includes('pub-') ||
                src.startsWith('@') || // NEW: Support @ prefix
                // Relative path check: Must NOT start with http, NOT be data:, NOT be local static asset folders
                (!src.startsWith('http') &&
                    !src.startsWith('data:') &&
                    !src.startsWith('/images') &&
                    !src.startsWith('/assets') &&
                    !src.startsWith('/icon') &&
                    !src.startsWith('/banners') &&
                    !src.startsWith('/fonts') &&
                    (src.includes('/') || /\.(jpg|jpeg|png|webp|gif|svg|mp3|wav|zip)$/i.test(src))
                )
            );

            // Sign only if it's R2 and NOT already signed (contains AWS signature params)
            if (isR2 && !src.includes('X-Amz-Signature')) {
                const originalSrc = src;
                if (window.OFFSZN_DEBUG) console.log(`[R2-Loader] Attempting to sign R2 resource: ${originalSrc}`);

                // 🔥 SILENCE 404: Set src to a transparent pixel immediately to stop the browser 
                // from trying to load the raw R2 key as a relative path to the local server.
                el.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

                // 🧪 UX Enhancement: Set to empty state to avoid "broken icon" during signing
                el.style.opacity = el.style.opacity || '0';
                el.style.transition = 'opacity 0.4s ease';

                try {
                    const r2Version = el.getAttribute('data-r2-version') || 'v1';
                    const authorizedUrl = await window.getAuthorizedUrl(originalSrc, r2Version);
                    
                    if (authorizedUrl && authorizedUrl !== originalSrc) {
                        if (window.OFFSZN_DEBUG) console.log(`[R2-Loader] Successfully signed: ${originalSrc} -> ${authorizedUrl.substring(0, 30)}...`);
                        el.onload = () => { 
                            el.style.opacity = '1'; 
                            el.classList.add('r2-loaded');
                        };
                        el.src = authorizedUrl;
                        if (el.complete) el.onload();
                    } else {
                        if (window.OFFSZN_DEBUG) console.log(`[R2-Loader] Signing returned same URL or null for: ${originalSrc}`);
                        // Fallback: If signing fails, show original (might be public)
                        el.style.opacity = '1';
                    }
                } catch (e) {
                    if (window.OFFSZN_DEBUG) console.error(`[R2-Loader] Error signing ${originalSrc}:`, e);
                    el.style.opacity = '1';
                }
            }
        }
    }

    // --- MUTATION OBSERVER ---
    // Watches for new images added via JS (Template Literals, innerHTML, etc.)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // ELEMENT_NODE
                    if (node.tagName === 'IMG') {
                        resolveElement(node);
                    } else {
                        node.querySelectorAll('img').forEach(resolveElement);
                    }
                }
            });
        });
    });

    // --- INITIALIZATION ---
    function init() {
        // 1. Process existing images
        document.querySelectorAll('img').forEach(resolveElement);

        // 2. Start observing DOM for new images
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
