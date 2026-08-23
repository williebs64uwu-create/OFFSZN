/**
 * OFFSZN Meta Pixel & Attribution Client Module
 * ==============================================
 * Handles Meta Pixel base initialization, cookie / UTM attribution preservation,
 * and client-side tracking with standard deduplication (event_id).
 */

(function () {
    // Cookie helpers
    function getCookie(name) {
        const matches = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
        return matches ? decodeURIComponent(matches[1]) : undefined;
    }

    function setCookie(name, value, days = 90) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = "; expires=" + date.toUTCString();
        // Domain is set to root domain if on offszn.lat
        const domain = window.location.hostname.includes('offszn.lat') ? '; domain=.offszn.lat' : '';
        document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/" + domain + "; SameSite=Lax";
    }

    // Capture & Persist Attribution Data (UTMs, fbclid, _fbp, _fbc)
    function captureAttribution() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            
            // 1. Capture UTM parameters
            const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
            utmKeys.forEach(key => {
                const val = urlParams.get(key);
                if (val) {
                    localStorage.setItem('offszn_' + key, val);
                }
            });

            // 2. Capture fbclid & generate _fbc
            const fbclid = urlParams.get('fbclid');
            if (fbclid) {
                localStorage.setItem('offszn_fbclid', fbclid);
                const fbcVal = `fb.1.${Date.now()}.${fbclid}`;
                setCookie('_fbc', fbcVal, 90);
                localStorage.setItem('offszn_fbc', fbcVal);
            }

            // 3. Persist existing _fbp cookie into localStorage if present
            const fbpCookie = getCookie('_fbp');
            if (fbpCookie) {
                localStorage.setItem('offszn_fbp', fbpCookie);
            }
        } catch (e) {
            console.warn('[MetaPixel] Error capturing attribution:', e);
        }
    }

    // Initialize Meta Pixel Base Snippet
    function initPixel(pixelId) {
        if (!pixelId || window._metaPixelInitialized) return;

        // Standard Meta Pixel Snippet
        /* eslint-disable */
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        /* eslint-enable */

        fbq('init', pixelId);
        window._metaPixelInitialized = true;
        console.log(`[MetaPixel] Initialized Pixel ID: ${pixelId}`);

        // Track PageView once
        MetaPixel.trackPageView();
    }

    // Main MetaPixel Interface
    const MetaPixel = {
        init: function (customPixelId) {
            const pixelId = customPixelId || window.META_PIXEL_ID;
            if (pixelId) {
                initPixel(pixelId);
            } else {
                // Wait briefly for /env.js to load if needed
                window.addEventListener('DOMContentLoaded', () => {
                    if (window.META_PIXEL_ID && !window._metaPixelInitialized) {
                        initPixel(window.META_PIXEL_ID);
                    }
                });
            }
        },

        trackPageView: function () {
            if (window._metaPixelPageViewFired) return;
            if (typeof window.fbq === 'function') {
                window.fbq('track', 'PageView');
                window._metaPixelPageViewFired = true;
                console.log('[MetaPixel] Event: PageView');
            }
        },

        trackViewContent: function ({ content_ids, content_name, content_type = 'product', value, currency = 'USD', event_id }) {
            if (typeof window.fbq !== 'function') return;
            const params = {
                content_ids: Array.isArray(content_ids) ? content_ids : [content_ids],
                content_name: content_name || 'Product',
                content_type: content_type,
                value: parseFloat(value) || 0,
                currency: currency
            };
            const options = event_id ? { eventID: event_id } : undefined;
            window.fbq('track', 'ViewContent', params, options);
            console.log(`[MetaPixel] Event: ViewContent ($${params.value} ${params.currency})`, params, options);
        },

        trackInitiateCheckout: function ({ content_ids, content_name, content_type = 'product', value, currency = 'USD', num_items = 1, event_id }) {
            if (typeof window.fbq !== 'function') return;
            const params = {
                content_ids: Array.isArray(content_ids) ? content_ids : [content_ids],
                content_name: content_name || 'Product',
                content_type: content_type,
                value: parseFloat(value) || 0,
                currency: currency,
                num_items: num_items
            };
            const options = event_id ? { eventID: event_id } : undefined;
            window.fbq('track', 'InitiateCheckout', params, options);
            console.log(`[MetaPixel] Event: InitiateCheckout ($${params.value} ${params.currency})`, params, options);
        },

        trackPurchase: function ({ content_ids, content_name, content_type = 'product', value, currency = 'USD', order_id, event_id }) {
            if (typeof window.fbq !== 'function') return;
            const params = {
                content_ids: Array.isArray(content_ids) ? content_ids : [content_ids],
                content_name: content_name || 'Order',
                content_type: content_type,
                value: parseFloat(value) || 0,
                currency: currency,
                order_id: order_id
            };
            const options = event_id ? { eventID: event_id } : undefined;
            window.fbq('track', 'Purchase', params, options);
            console.log(`[MetaPixel] Event: Purchase (Order: ${order_id}, Total: $${params.value} ${params.currency})`, params, options);
        },

        getAttributionData: function () {
            const fbp = getCookie('_fbp') || localStorage.getItem('offszn_fbp') || undefined;
            const fbc = getCookie('_fbc') || localStorage.getItem('offszn_fbc') || undefined;
            const fbclid = localStorage.getItem('offszn_fbclid') || undefined;
            
            return {
                fbp,
                fbc,
                fbclid,
                utm_source: localStorage.getItem('offszn_utm_source') || undefined,
                utm_medium: localStorage.getItem('offszn_utm_medium') || undefined,
                utm_campaign: localStorage.getItem('offszn_utm_campaign') || undefined,
                utm_content: localStorage.getItem('offszn_utm_content') || undefined,
                utm_term: localStorage.getItem('offszn_utm_term') || undefined
            };
        }
    };

    // Run attribution capture immediately
    captureAttribution();

    // Export to global window object
    window.MetaPixel = MetaPixel;

    // Auto-init if pixel ID is already present
    if (window.META_PIXEL_ID) {
        MetaPixel.init(window.META_PIXEL_ID);
    }
})();
