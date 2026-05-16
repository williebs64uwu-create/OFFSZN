/**
 * updates-handler.js
 * Manages the "What's New" modal for logged-in users.
 * Persists "seen" status in Supabase to show each update once.
 */

(function () {
    const CURRENT_UPDATE_ID = 'update_v11_giveaway_1mo';
    const FORM_URL = 'https://forms.gle/3ZA5sMZVyShhsHQZA';

    const UpdatesHandler = {
        init: async function () {
            // 1. Check if user is logged in
            if (typeof AuthUtils === 'undefined' || !AuthUtils.isLoggedIn()) {
                return;
            }

            // 2. Wait for Supabase to be ready
            if (!window.supabaseClient) {
                // If not ready yet, wait a bit or listen for init
                let attempts = 0;
                const checkInterval = setInterval(async () => {
                    attempts++;
                    if (window.supabaseClient) {
                        clearInterval(checkInterval);
                        this.checkUpdates();
                    } else if (attempts > 20) {
                        clearInterval(checkInterval);
                        console.warn('UpdatesHandler: Supabase client not found after multiple attempts.');
                    }
                }, 200);
                return;
            }

            this.checkUpdates();
        },

        checkUpdates: async function () {
            try {
                const user = AuthUtils.getCurrentUser();
                if (!user || !user.id) return;

                // Fetch seen_updates from public.users
                const { data, error } = await window.supabaseClient
                    .from('users')
                    .select('seen_updates')
                    .eq('id', user.id)
                    .single();

                if (error) {
                    console.error('UpdatesHandler: Error fetching user updates status', error);
                    return;
                }

                const seenUpdates = data.seen_updates || [];
                
                // If current update ID is not in seen list, show modal
                if (!seenUpdates.includes(CURRENT_UPDATE_ID)) {
                    this.renderModal();
                }
            } catch (err) {
                console.error('UpdatesHandler: Fatal error in checkUpdates', err);
            }
        },

        renderModal: function () {
            // Prevent multiple modals
            if (document.getElementById('updates-modal-overlay')) return;

            const modalHtml = `
                <div class="updates-modal-overlay" id="updates-modal-overlay">
                    <div class="updates-modal-card">
                        <button class="update-close-x" id="btn-update-close-x" aria-label="Cerrar">&times;</button>
                        <div class="updates-modal-header">
                            <h2 class="updates-modal-title" style="margin-bottom: 8px;">¡Gana una suscripción de OFFSZN por 1 mes!</h2>
                            <p class="updates-modal-subtitle" style="margin-bottom: 24px;">Queremos conocer tu opinión sobre el futuro de OFFSZN. Completa el formulario para participar.</p>
                        </div>
                        
                        <div class="updates-actions">
                            <a href="${FORM_URL}" target="_blank" class="btn-update-discord" id="btn-update-discord" style="justify-content: center; text-decoration: none;">
                                Participar
                            </a>
                            <button class="btn-update-dismiss" id="btn-update-dismiss">Quizás más tarde</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Trigger animation
            const overlay = document.getElementById('updates-modal-overlay');
            setTimeout(() => {
                overlay.style.display = 'flex';
                setTimeout(() => overlay.classList.add('active'), 10);
            }, 500);

            // Bind events
            document.getElementById('btn-update-discord').addEventListener('click', () => this.markAsSeen());
            document.getElementById('btn-update-dismiss').addEventListener('click', () => this.markAsSeen());
            document.getElementById('btn-update-close-x').addEventListener('click', () => this.markAsSeen());
        },

        markAsSeen: async function () {
            const overlay = document.getElementById('updates-modal-overlay');
            
            // UI Feedback: Close immediately
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 400);

            try {
                const user = AuthUtils.getCurrentUser();
                if (!user || !user.id) return;

                // Get current status first to append
                const { data } = await window.supabaseClient
                    .from('users')
                    .select('seen_updates')
                    .eq('id', user.id)
                    .single();

                let currentSeen = data?.seen_updates || [];
                if (!currentSeen.includes(CURRENT_UPDATE_ID)) {
                    currentSeen.push(CURRENT_UPDATE_ID);
                }

                // Update DB
                await window.supabaseClient
                    .from('users')
                    .update({ seen_updates: currentSeen })
                    .eq('id', user.id);

            } catch (err) {
                console.error('UpdatesHandler: Error marking update as seen', err);
            }
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UpdatesHandler.init());
    } else {
        UpdatesHandler.init();
    }

    // Export if needed
    window.UpdatesHandler = UpdatesHandler;
})();
