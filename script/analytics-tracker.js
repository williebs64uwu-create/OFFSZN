/**
 * analytics-tracker.js
 * Rastrea eventos en la plataforma (visitas, descargas, likes) y su país de origen.
 */

(function () {
    const AnalyticsTracker = {
        countryCode: null,
        sessionId: null,

        init: async function () {
            // 1. Generar o recuperar ID de sesión de invitado local
            this.sessionId = localStorage.getItem('offszn_guest_session');
            if (!this.sessionId) {
                this.sessionId = 'guest_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('offszn_guest_session', this.sessionId);
            }

            // 2. Obtener país en "local" usando API gratuita y anónima (sin keys) o timezone
            this.countryCode = localStorage.getItem('offszn_country_code');
            if (!this.countryCode) {
                const providers = [
                    { url: 'https://get.geojs.io/v1/ip/country.json', key: 'country' },
                    { url: 'https://ipapi.co/json/', key: 'country_code' },
                    { url: 'https://ipinfo.io/json', key: 'country' }
                ];

                for (const provider of providers) {
                    try {
                        const res = await fetch(provider.url);
                        const data = await res.json();
                        if (data && data[provider.key]) {
                            this.countryCode = data[provider.key];
                            break;
                        }
                    } catch (e) {
                        console.warn(`Tracker: Provider ${provider.url} failed.`);
                    }
                }

                if (!this.countryCode) {
                    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    if (tz.includes('Lima')) this.countryCode = 'PE';
                    else if (tz.includes('Bogota')) this.countryCode = 'CO';
                    else if (tz.includes('Buenos_Aires')) this.countryCode = 'AR';
                    else if (tz.includes('Santiago')) this.countryCode = 'CL';
                    else if (tz.includes('Mexico_City')) this.countryCode = 'MX';
                    else if (tz.includes('Madrid')) this.countryCode = 'ES';
                    else if (tz.includes('Caracas')) this.countryCode = 'VE';
                    else this.countryCode = 'US';
                }
                
                if (this.countryCode) {
                    localStorage.setItem('offszn_country_code', this.countryCode);
                }
            }
        },

        /**
         * Registra un evento en la base de datos
         * @param {string} producerId - ID de Supabase del productor (dueño del perfil o producto)
         * @param {string} actionType - 'view_profile', 'view_product', 'download', 'like', 'cart', 'purchase'
         * @param {string} targetId - ID del producto interactuado (opcional)
         */
        track: async function (producerId, actionType, targetId = null) {
            if (!window.supabaseClient) {
                console.warn("Tracker: Supabase no está inicializado.");
                return;
            }
            if (!producerId) return;

            // Esperar a que el país se cargue si aún no lo ha hecho
            if (!this.countryCode) await this.init();

            // Identificar si está logueado o es invitado
            let guestOrUserId = this.sessionId;
            if (typeof AuthUtils !== 'undefined' && AuthUtils.isLoggedIn()) {
                const user = AuthUtils.getCurrentUser();
                if (user && user.id) guestOrUserId = user.id;
            }

            // No registrar acciones propias (si un productor ve su propio perfil)
            if (guestOrUserId === producerId) return;

            try {
                const { error } = await window.supabaseClient
                    .from('analytics_events')
                    .insert([{
                        producer_id: producerId,
                        guest_id: guestOrUserId,
                        action_type: actionType,
                        target_id: targetId,
                        country_code: this.countryCode
                    }]);

                if (error) console.error("Tracker Error:", error.message);
            } catch (err) {
                console.error("Tracker Fatal Error:", err);
            }
        }
    };

    // Auto-iniciar al cargar el script
    AnalyticsTracker.init();

    // Exportar globalmente
    window.AnalyticsTracker = AnalyticsTracker;
})();
