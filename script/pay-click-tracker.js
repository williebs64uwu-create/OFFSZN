// OFFSZN - Telemetría Universal de Clics de Pago (Yape, PayPal, Mercado Pago, Binance, WhatsApp)
// Registra el precio exacto (USD y Soles) que vio el cliente en su variante A/B al tocar cualquier método de pago.
// Se consulta en /owner/pagos-manuales y se cruza por hora, método y producto.
(function () {
    var SOLES = { 5: 19, 10: 38, 15: 57, 17: 65, 20: 76, 25: 95, 30: 114, 35: 133 };

    // Si el cliente tiene sesión iniciada, se manda su token para que el servidor registre su email.
    var authToken = null;
    try {
        if (window.AuthUtils && typeof window.AuthUtils.getSession === 'function') {
            window.AuthUtils.getSession().then(function (s) { authToken = s && s.access_token; }).catch(function () {});
        }
    } catch (_) {}

    function newRef() {
        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        var out = '';
        for (var i = 0; i < 5; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
        return out;
    }

    function detectProduct() {
        if (window.PLUGIN_NAME && typeof window.PLUGIN_NAME === 'string') return window.PLUGIN_NAME;
        var p = (location.pathname || '').toLowerCase();
        if (p.indexOf('easy-pitch') !== -1) return 'Easy Pitch';
        if (p.indexOf('easy-mix') !== -1) return 'Easy Mix';
        if (p.indexOf('vocal-preset') !== -1) return 'Vocal Preset';
        if (p.indexOf('inka-kola') !== -1) return 'Inka Kola';
        if (p.indexOf('coca-cola') !== -1) return 'Coca-Cola';
        if (p.indexOf('easy-master') !== -1) return 'Easy Master';
        if (p.indexOf('omni') !== -1) return 'Omni Plugin';
        if (p.indexOf('promo-2x1') !== -1) return 'Promo 2x1';
        if (p.indexOf('easy-youtube') !== -1) return 'Easy YouTube';
        if (p.indexOf('offszn-recorder') !== -1) return 'OFFSZN Recorder';
        return 'Plugin OFFSZN';
    }

    function detectPriceUSD() {
        if (typeof window.CURRENT_PROMO_PRICE === 'number' && window.CURRENT_PROMO_PRICE > 0) {
            return window.CURRENT_PROMO_PRICE;
        }
        var ids = [
            'omni-price-val', 'easy-pitch-price-val', 'vocal-preset-price-val',
            'inka-kola-price-val', 'coca-cola-price-val', 'easy-master-price-val',
            'promo-price-val', 'plugin-price-val'
        ];
        for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (el) {
                var m = (el.innerText || '').match(/(\d+)/);
                if (m) return parseInt(m[1], 10);
            }
        }
        var pr = detectProduct();
        if (pr === 'Easy Mix' || pr === 'Omni Plugin') return 17;
        if (pr === 'Promo 2x1') return 25;
        return 5;
    }

    function detectPricePEN(priceUsd) {
        if (window.YAPE_FIXED_PRICE_PEN) return Number(window.YAPE_FIXED_PRICE_PEN);
        if (SOLES[priceUsd]) return SOLES[priceUsd];
        return Math.round(priceUsd * 3.8);
    }

    function methodOf(text) {
        text = (text || '').toLowerCase();
        if (text.indexOf('yape') !== -1) return 'Yape';
        if (text.indexOf('mercado') !== -1) return 'Mercado Pago';
        if (text.indexOf('binance') !== -1) return 'Binance';
        if (text.indexOf('paypal') !== -1) return 'PayPal';
        return 'WhatsApp';
    }

    var lastTracked = {};
    function sendTracking(method, extraRef) {
        var product = detectProduct();
        var key = method + ':' + product;
        var now = Date.now();
        if (lastTracked[key] && (now - lastTracked[key] < 2000)) {
            return lastTracked[key + ':ref'] || extraRef; // Debounce clics repetidos
        }
        lastTracked[key] = now;

        var priceUsd = detectPriceUSD();
        var pricePen = detectPricePEN(priceUsd);
        var ref = extraRef || newRef();
        lastTracked[key + ':ref'] = ref;

        var payload = JSON.stringify({
            ref: ref,
            product: product,
            method: method,
            price_usd: priceUsd,
            price_pen: pricePen,
            variant: window.AB_VARIANT || '',
            page: location.pathname
        });

        try {
            var headers = { 'Content-Type': 'application/json' };
            if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
            fetch('/api/plugin/payment-click', {
                method: 'POST',
                headers: headers,
                body: payload,
                keepalive: true
            }).catch(function () {});
        } catch (_) {}

        return ref;
    }

    // Interceptar clics en todos los métodos de pago
    function handleTrigger(e) {
        var target = e.target;
        if (!target) return;

        // 1. Enlaces de WhatsApp
        var link = target.closest && target.closest('a[href*="wa.me"], a[href*="wa.link"]');
        if (link) {
            var href = link.getAttribute('href') || '';
            var parts = href.split('text=');
            var raw = '';
            if (parts.length > 1) {
                try { raw = decodeURIComponent(parts[1]); } catch (_) { raw = parts[1]; }
            }
            // Soporte técnico / ayuda de instalación: no es un clic de compra
            if (/problema|instal|ayuda|soporte/i.test(raw)) return;

            var method = methodOf(raw + ' ' + (link.innerText || ''));
            var ref = newRef();

            // Mensaje limpio: sin precios hardcodeados
            var base = raw
                .replace(/\s*por\s+\$?\d+(\s*USD)?(\s*\/\s*S\/\s*\d+\s*soles)?/gi, '')
                .replace(/\s*\(\$?\d+(\s*USD)?(\s*\/\s*S\/\s*\d+\s*soles)?\)/gi, '')
                .trim();
            link.setAttribute('href', parts[0] + 'text=' + encodeURIComponent(base));

            sendTracking(method, ref);
            return;
        }

        // 2. Botón modal de Yape
        var yapeBtn = target.closest && target.closest('[data-action="open-yape-checkout"], #btn-yape-checkout, #btn-yape, .btn-yape-white, .btn-yape-trigger, .btn-yape');
        if (yapeBtn) {
            sendTracking('Yape');
            return;
        }

        // 3. Botón / contenedor de PayPal
        var paypalBtn = target.closest && target.closest('#plugin-paypal-button-container, #paypal-button-container, .paypal-buttons, [data-funding-source="paypal"]');
        if (paypalBtn) {
            sendTracking('PayPal');
            return;
        }

        // 4. Botón directo de Mercado Pago
        var mpBtn = target.closest && target.closest('[data-action="open-mp-checkout"], #btn-mp-checkout, .btn-mercadopago, a[href*="mercadopago.com"]');
        if (mpBtn) {
            sendTracking('Mercado Pago');
            return;
        }

        // 5. Botón directo de Binance
        var binanceBtn = target.closest && target.closest('[data-action="open-binance-checkout"], #btn-binance-checkout, .btn-binance, a[href*="binance.com"]');
        if (binanceBtn) {
            sendTracking('Binance');
            return;
        }
    }

    document.addEventListener('click', handleTrigger, true);
    document.addEventListener('pointerdown', function (e) {
        // Para iframes de PayPal donde el clic puede ser interceptado
        var target = e.target;
        if (target && target.closest && target.closest('#plugin-paypal-button-container, #paypal-button-container')) {
            sendTracking('PayPal');
        }
    }, true);

    // Exportar función global por si algún checkout la llama explícitamente
    window.OFFSZN_TRACK_PAY_CLICK = sendTracking;
})();
