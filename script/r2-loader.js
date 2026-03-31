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
                    (src.includes('r2.offszn.lat') || src.includes('pub-') || src.includes('offsznlatbucket')) && 
                    !src.includes('supabase.co') &&
                    !src.startsWith('http') // Only treat local/relative as R2 if it's NOT Supabase
                );

            if (isR2 && !src.includes('X-Amz-Signature')) {
                const originalSrc = src;
                if (!el.src || el.src.includes(originalSrc)) {
                    el.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                }

                el.style.opacity = el.style.opacity || '0';
                el.style.transition = 'opacity 0.4s ease';

                try {
                    if (el.dataset.r2Processing) return;
                    el.dataset.r2Processing = 'true';

                    // Detect relative Supabase path (starts with UUID folder OR is a legacy root file without slashes like 1774225861578_cover.jpg)
                    const isUUIDFolder = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i.test(originalSrc);
                    const isLegacyRoot = !originalSrc.includes('/') && /\.(jpg|jpeg|png|webp|gif|svg|mp3|wav|zip)$/i.test(originalSrc);
                    const isRelativeSupabase = typeof originalSrc === 'string' && !originalSrc.startsWith('http') && (isUUIDFolder || isLegacyRoot);
                    
                    const r2Version = el.getAttribute('data-r2-version') || (originalSrc.includes('supabase.co') || isRelativeSupabase ? 'supabase' : 'v2');
                    const productId = el.getAttribute('data-product-id');
                    const authorizedUrl = await window.getAuthorizedUrl(originalSrc, r2Version, productId);
                    
                    if (authorizedUrl && authorizedUrl !== originalSrc) {
                        el.onload = () => { 
                            el.style.opacity = '1'; 
                            el.classList.add('r2-loaded');
                        };
                        el.onerror = () => {
                            if (!el.dataset.r2FallbackAttempted) {
                                el.dataset.r2FallbackAttempted = 'true';
                                const apiRoot = (window.AuthUtils && window.AuthUtils._apiUrl) || '/api';
                                el.src = `${apiRoot}/r2-public/${originalSrc.startsWith('/') ? originalSrc.substring(1) : originalSrc}`;
                            } else {
                                el.style.opacity = '1';
                            }
                        };
                        el.src = authorizedUrl;
                        if (el.complete) {
                            if (el.naturalWidth === 0 && el.naturalHeight === 0) el.onerror();
                            else el.onload();
                        }
                    } else {
                        el.style.opacity = '1';
                    }
                } catch (e) {
                    el.style.opacity = '1';
                } finally {
                    delete el.dataset.r2Processing;
                }
            }
        }
        
        // 2. Handle data-r2-bg (Background Images)
        const bgPath = el.getAttribute('data-r2-bg');
        if (bgPath) {
            try {
                if (el.dataset.r2Processing) return;
                el.dataset.r2Processing = 'true';

                const isUUIDFolder = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i.test(bgPath);
                const isLegacyRoot = !bgPath.includes('/') && /\.(jpg|jpeg|png|webp|gif|svg|mp3|wav|zip)$/i.test(bgPath);
                const isRelativeSupabase = typeof bgPath === 'string' && !bgPath.startsWith('http') && (isUUIDFolder || isLegacyRoot);

                const r2Version = el.getAttribute('data-r2-version') || (bgPath.includes('supabase.co') || isRelativeSupabase ? 'supabase' : 'v2');
                const productId = el.getAttribute('data-product-id');
                const authorizedUrl = await window.getAuthorizedUrl(bgPath, r2Version, productId);
                if (authorizedUrl) {
                    const tempImg = new Image();
                    tempImg.onload = () => {
                        el.style.backgroundImage = `url('${authorizedUrl}')`;
                        el.classList.add('r2-loaded');
                    };
                    tempImg.onerror = () => {
                        if (!el.dataset.r2FallbackAttempted) {
                            el.dataset.r2FallbackAttempted = 'true';
                            const apiRoot = (window.AuthUtils && window.AuthUtils._apiUrl) || '/api';
                            const cleanPath = bgPath.startsWith('/') ? bgPath.substring(1) : bgPath;
                            el.style.backgroundImage = `url('${apiRoot}/r2-public/${cleanPath}')`;
                            el.classList.add('r2-loaded');
                        }
                    };
                    tempImg.src = authorizedUrl;
                }
            } catch (e) {
                if (window.OFFSZN_DEBUG) console.error(`[R2-Loader] BG Error:`, e);
            } finally {
                delete el.dataset.r2Processing;
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
