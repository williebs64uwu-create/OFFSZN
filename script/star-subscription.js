/**
 * STAR CHAIN en 3 cuotas · botón de suscripción de PayPal.
 * Cuota 1 y 2 = clave temporal de 1 mes (STAR-SUB); cuota 3 = licencia FULL de por vida. El servidor confirma cada cobro con PayPal.
 * Solo corre en el checkout con ?tier=cuotas: el SDK de suscripciones no se puede mezclar con el de pago único.
 */
(function () {
    const container = document.getElementById('star-subscription-container');
    // Solo en el modo cuotas (?tier=cuotas): el SDK de suscripciones no se puede cargar junto al de pago único
    if (!container || !window.PLUGIN_SKIP_DIRECT) return;

    const say = (html) => { container.innerHTML = `<div class="account-hint show" style="margin-top:0">${html}</div>`; };

    function loadSdk(clientId) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription&currency=USD`;
            s.onload = resolve;
            s.onerror = () => reject(new Error('No se pudo cargar PayPal.'));
            document.head.appendChild(s);
        });
    }

    function showModal({ serialKey, pending, email }) {
        if (window.pluginDirectCheckout && typeof window.pluginDirectCheckout.injectModalCSS === 'function') window.pluginDirectCheckout.injectModalCSS();
        if (window.pluginDirectCheckout) window.pluginDirectCheckout.hideProcessingState();
        let modal = document.getElementById('plugin-success-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'plugin-success-modal';
            modal.className = 'plugin-modal-overlay';
            document.body.appendChild(modal);
        }
        const body = pending
            ? `<p class="plugin-modal-desc">Tu suscripción está activa. En unos minutos te llega tu <b>clave de la cuota 1</b> a <b>${email}</b>. Revisa también spam.</p>`
            : `<p class="plugin-modal-desc">¡Gracias! Esta es tu clave de <b>STAR CHAIN</b> para este mes. Con la cuota 3 recibirás tu licencia FULL de por vida:</p>
               <div class="plugin-key-container"><span class="plugin-key-value">${serialKey}</span><button class="plugin-copy-btn" id="star-copy-key">Copiar</button></div>
               <p class="plugin-modal-desc" style="font-size:.85rem">También la enviamos a <b>${email}</b>.</p>`;
        modal.innerHTML = `<div class="plugin-modal-card">
            <button class="plugin-modal-close-x" id="star-modal-close" title="Cerrar">&times;</button>
            <div class="plugin-modal-success-icon"><i class="bi bi-check-lg"></i></div>
            <h2 class="plugin-modal-title">¡Suscripción activa!</h2>${body}
            <a href="/mis-compras" class="plugin-dl-btn" style="display:inline-flex;margin-top:10px"><i class="bi bi-download"></i> Descargar instalador</a>
        </div>`;
        modal.querySelector('#star-modal-close').onclick = () => modal.classList.remove('active');
        const copy = modal.querySelector('#star-copy-key');
        if (copy) copy.onclick = () => navigator.clipboard.writeText(serialKey).then(() => { copy.innerText = '¡Copiado!'; setTimeout(() => (copy.innerText = 'Copiar'), 2000); });
        setTimeout(() => modal.classList.add('active'), 100);
    }

    async function init() {
        let cfg = {};
        try { cfg = await (await fetch('/api/orders/star/config')).json(); } catch (_) {}
        if (!cfg.planId) {
            say('Las 3 cuotas mensuales aún no están habilitadas. Para pagar en cuotas escríbele a Willie por WhatsApp, o elige <b>Licencia FULL</b> y paga una sola vez.');
            return;
        }
        try { await loadSdk(window.PAYPAL_CLIENT_ID); } catch (e) { say(e.message); return; }
        container.innerHTML = '';

        window.paypal.Buttons({
            style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'subscribe' },
            onClick: (data, actions) => (typeof window.PLUGIN_BEFORE_PAY === 'function' && !window.PLUGIN_BEFORE_PAY() ? actions.reject() : actions.resolve()),
            createSubscription: (data, actions) => actions.subscription.create({ plan_id: cfg.planId, custom_id: 'STAR-CHAIN' }),
            onApprove: async (data) => {
                const checkout = window.pluginDirectCheckout;
                if (checkout) { checkout.injectModalCSS(); checkout.showProcessingState(); }
                try {
                    const res = await fetch('/api/orders/star/subscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ subscriptionID: data.subscriptionID, email: window.BUYER_EMAIL || (document.getElementById('buyerEmail') || {}).value || '' })
                    });
                    const out = await res.json();
                    if (!res.ok) throw new Error(out.error || 'No se pudo confirmar la suscripción.');
                    showModal({ serialKey: out.serialKey, pending: out.pending, email: out.email });
                } catch (err) {
                    if (checkout) checkout.hideProcessingState();
                    alert(err.message);
                }
            },
            onError: (err) => console.error('[STAR sub] PayPal error:', err)
        }).render('#star-subscription-container');
    }

    init();
})();
