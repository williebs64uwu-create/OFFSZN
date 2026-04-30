/**
 * OFFSZN Analytics Core
 * Handles behavioral tracking, session management, and event logging.
 */

(function() {
    const Analytics = {
        _sessionId: null,
        _userId: null,
        _isInitialized: false,

        /**
         * Initialize the analytics engine
         */
        init: function() {
            if (this._isInitialized) return;
            
            this._sessionId = this._getOrCreateSessionId();
            this._userId = window.AuthUtils?.getUserId() || null;
            
            // Listen for auth changes to update userId
            if (window.supabaseClient) {
                window.supabaseClient.auth.onAuthStateChange((event, session) => {
                    if (session?.user) {
                        this._userId = session.user.id;
                        this.track('auth_state_change', { event, user_id: session.user.id });
                    }
                });
            }

            this._isInitialized = true;
            this.trackPageView();
            this._setupAutoClickTracking();
            
            if (window.OFFSZN_DEBUG) console.log('📊 Analytics Initialized', { sessionId: this._sessionId, userId: this._userId });
        },

        /**
         * Get or create a unique session ID
         */
        _getOrCreateSessionId: function() {
            let sid = sessionStorage.getItem('offszn_sid');
            if (!sid) {
                sid = 'sid_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                sessionStorage.setItem('offszn_sid', sid);
            }
            return sid;
        },

        /**
         * Main tracking function
         * @param {string} eventName - Descriptive name (e.g., 'cta_click_hero')
         * @param {Object} metadata - Additional context
         * @param {string} eventType - Type category ('click', 'view', 'conversion', 'error')
         */
        track: async function(eventName, metadata = {}, eventType = 'custom') {
            if (!window.supabaseClient) {
                // Silently fail if supabase not ready, or queue it
                return;
            }

            const payload = {
                event_type: eventType,
                event_name: eventName,
                user_id: this._userId || window.AuthUtils?.getUserId(),
                session_id: this._sessionId,
                page_url: window.location.pathname + window.location.search,
                metadata: {
                    ...metadata,
                    referrer: document.referrer,
                    screen_res: `${window.screen.width}x${window.screen.height}`,
                    user_agent: navigator.userAgent
                }
            };

            try {
                const { error } = await window.supabaseClient
                    .from('app_events')
                    .insert([payload]);

                if (error && window.OFFSZN_DEBUG) console.error('❌ Analytics Error:', error);
            } catch (err) {
                if (window.OFFSZN_DEBUG) console.error('❌ Analytics Crash:', err);
            }
        },

        /**
         * Specialized track for page views
         */
        trackPageView: function() {
            this.track('page_view', {}, 'view');
        },

        /**
         * Automatically track elements with [data-track] attribute
         */
        _setupAutoClickTracking: function() {
            document.addEventListener('click', (e) => {
                const target = e.target.closest('[data-track]');
                if (target) {
                    const eventName = target.getAttribute('data-track');
                    const metadata = {};
                    
                    if (target.id === 'pricing-toggle') {
                        metadata.current_mode = document.querySelector('.toggle-label.active')?.innerText || 'unknown';
                    }

                    this.track(eventName, metadata, 'click');
                }
            }, true);

            // Auto-track Input Focus for Funnel Analysis
            document.addEventListener('focusin', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    const fieldId = e.target.id || e.target.name;
                    const page = window.location.pathname;
                    
                    if (page.includes('register.html') || page.includes('login.html')) {
                        this.track(`funnel_field_focus`, { field: fieldId }, 'view');
                    }
                }
            }, true);
        },

        /**
         * Track specific UI flows (like registration steps)
         */
        trackStep: function(flowName, stepIndex, stepName, status = 'complete') {
            this.track(`flow_${flowName}`, {
                step_index: stepIndex,
                step_name: stepName,
                status: status
            }, 'conversion');
        }
    };

    // Attach to window
    window.Analytics = Analytics;

    // Auto-init when DOM ready or if Supabase is already there
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Analytics.init());
    } else {
        Analytics.init();
    }
})();
