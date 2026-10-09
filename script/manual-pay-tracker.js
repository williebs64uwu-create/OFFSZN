// Pagos manuales (Yape / Mercado Pago / Binance / WhatsApp).
// El mensaje de WhatsApp YA NO lleva precio: lleva un codigo "Ref". El precio que vio el cliente
// (variante A/B) queda registrado y se consulta en /owner/pagos-manuales con ese codigo.
(function () {
    var SOLES = { 17: 65, 25: 95 };

    // Si el cliente tiene sesion iniciada, se manda su token para que el servidor registre su email.
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

    function methodOf(text) {
        text = text.toLowerCase();
        if (text.indexOf('yape') !== -1) return 'Yape';
        if (text.indexOf('mercado') !== -1) return 'Mercado Pago';
        if (text.indexOf('binance') !== -1) return 'Binance';
        return 'WhatsApp';
    }

    document.addEventListener('click', function (e) {
        var link = e.target.closest && e.target.closest('a[href*="wa.me"]');
        if (!link) return;
        var href = link.getAttribute('href') || '';
        if (href.indexOf('text=') === -1) return;

        var parts = href.split('text=');
        var raw;
        try { raw = decodeURIComponent(parts[1]); } catch (_) { raw = parts[1]; }
        // Soporte tecnico / instalacion: no es una compra.
        if (/problema|instal|ayuda|soporte/i.test(raw)) return;

        var price = window.CURRENT_PROMO_PRICE;
        var method = methodOf(raw + ' ' + (link.innerText || ''));
        var product = window.PLUGIN_NAME || 'Easy Mix';
        var ref = newRef();

        // Mensaje limpio: sin "por $17", sin "(S/ 65)". Solo el codigo de referencia.
        var base = raw
            .replace(/\s*por\s+\$?\d+(\s*USD)?(\s*\/\s*S\/\s*\d+\s*soles)?/gi, '')
            .replace(/\s*\(\$?\d+(\s*USD)?(\s*\/\s*S\/\s*\d+\s*soles)?\)/gi, '')
            .trim();
        link.setAttribute('href', parts[0] + 'text=' + encodeURIComponent(base + ' (Ref: ' + ref + ')'));

        var payload = JSON.stringify({
            ref: ref,
            product: product,
            method: method,
            price_usd: price,
            price_pen: SOLES[price] || null,
            variant: window.AB_VARIANT || '',
            page: location.pathname
        });
        try {
            var headers = { 'Content-Type': 'application/json' };
            if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
            fetch('/api/plugin/payment-click', { method: 'POST', headers: headers, body: payload, keepalive: true });
        } catch (_) { /* no bloquear el clic */ }
    }, true);
})();
