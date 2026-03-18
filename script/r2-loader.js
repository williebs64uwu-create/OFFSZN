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
        // 1. Handle IMG tags
        if (el.tagName === 'IMG') {
            const src = el.getAttribute('data-r2-src') || el.getAttribute('src');
            if (!src) return;

            const isR2 = (window.AuthUtils && window.AuthUtils.isR2Url) 
                ? window.AuthUtils.isR2Url(src)
                : (
                    src.includes('r2.cloudflarestorage.com') ||
                    src.includes('pub-') ||
                    src.includes('supabase.co') ||
                    src.startsWith('@') ||
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

            if (isR2 && !src.includes('X-Amz-Signature')) {
                const originalSrc = src;
                if (!el.src || el.src.includes(originalSrc)) {
                    el.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                }

                el.style.opacity = el.style.opacity || '0';
                el.style.transition = 'opacity 0.4s ease';

                try {
                    const r2Version = el.getAttribute('data-r2-version') || 'v1';
                    const productId = el.getAttribute('data-product-id');
                    const authorizedUrl = await window.getAuthorizedUrl(originalSrc, r2Version, productId);
                    
                    if (authorizedUrl && authorizedUrl !== originalSrc) {
                        el.onload = () => { 
                            el.style.opacity = '1'; 
                            el.classList.add('r2-loaded');
                        };
                        el.src = authorizedUrl;
                        if (el.complete) el.onload();
                    } else {
                        el.style.opacity = '1';
                    }
                } catch (e) {
                    el.style.opacity = '1';
                }
            }
        }
        
        // 2. Handle data-r2-bg (Background Images)
        const bgPath = el.getAttribute('data-r2-bg');
        if (bgPath) {
            try {
                const r2Version = el.getAttribute('data-r2-version') || 'v1';
                const productId = el.getAttribute('data-product-id');
                const authorizedUrl = await window.getAuthorizedUrl(bgPath, r2Version, productId);
                if (authorizedUrl) {
                    el.style.backgroundImage = `url('${authorizedUrl}')`;
                }
            } catch (e) {
                if (window.OFFSZN_DEBUG) console.error(`[R2-Loader] BG Error:`, e);
            }
        }
    }

    // --- MUTATION OBSERVER ---
    // Watches for new images added via JS (Template Literals, innerHTML, etc.)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // ELEMENT_NODE
                    if (node.tagName === 'IMG' || node.hasAttribute('data-r2-bg')) {
                        resolveElement(node);
                    } else {
                        node.querySelectorAll('img, [data-r2-bg]').forEach(resolveElement);
                    }
                }
            });
        });
    });

    // --- INITIALIZATION ---
    function init() {
        // 1. Process existing images and bg elements
        document.querySelectorAll('img, [data-r2-bg]').forEach(resolveElement);

        // 2. Start observing DOM for new images
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
