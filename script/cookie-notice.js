/**
 * OFFSZN Cookie & Privacy Notice
 * Handles the display of the cookie consent banner for first-time visitors.
 */
document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'offszn_privacy_accepted';

    // check if already accepted
    if (localStorage.getItem(STORAGE_KEY) === 'true') {
        return;
    }

    // Create the notice element
    const notice = document.createElement('div');
    notice.id = 'offszn-cookie-notice';
    notice.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[400px] bg-neutral-900/90 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-2xl z-[9999] transform transition-all duration-300 translate-y-0 opacity-100';
    notice.innerHTML = `
        <div class="flex flex-col gap-4">
            <div class="flex items-start justify-between">
                <div class="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="w-5 h-5 text-[#00ff88]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <h3 class="text-white font-semibold text-lg">Privacidad y Cookies</h3>
                </div>
                <button id="cookie-close-btn" class="text-gray-400 hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <p class="text-gray-300 text-sm leading-relaxed">
                Utilizamos cookies y tecnologías similares para mejorar tu experiencia, garantizar la seguridad de las transacciones y recordar tus preferencias. Al usar OFFSZN, aceptas nuestra 
                <a href="/legal/politica-de-privacidad.html" class="text-[#00ff88] hover:underline">Política de Privacidad</a>.
            </p>

            <div class="flex gap-3 mt-1">
                <button id="cookie-accept-btn" class="flex-1 bg-[#00ff88] text-black font-medium py-2 px-4 rounded-lg hover:bg-[#00cc6a] transition-colors shadow-[0_0_15px_rgba(0,255,136,0.3)]">
                    Aceptar
                </button>
                <a href="/legal/politica-de-privacidad.html" class="flex-1 bg-white/5 border border-white/10 text-white text-center font-medium py-2 px-4 rounded-lg hover:bg-white/10 transition-colors">
                    Leer más
                </a>
            </div>
        </div>
    `;

    document.body.appendChild(notice);

    // Animation entry
    requestAnimationFrame(() => {
        notice.classList.remove('translate-y-10', 'opacity-0');
    });

    const acceptBtn = notice.querySelector('#cookie-accept-btn');
    const closeBtn = notice.querySelector('#cookie-close-btn');

    const closeNotice = () => {
        notice.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => {
            notice.remove();
        }, 300);
    };

    acceptBtn.addEventListener('click', () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        closeNotice();
    });

    closeBtn.addEventListener('click', () => {
        // Just close for this session, but don't mark as accepted if that's preferred?
        // Or maybe just close it visually. Let's assume close = dismiss for now but maybe show again later.
        // For simplicity, treating X same as accept or just dismiss session?
        // Let's make X just dismiss without saving 'true', so it shows again next refresh (standard behavior for some).
        // BUT user asked for "visible only to first-time visitors". If they close it, they might see it again.
        // Let's set it to true even on close to avoid annoying them?
        // Actually typically 'Accept' is explicit consent. 'Close' is implicit ignore.
        // Let's leave 'Close' as temporary dismiss.
        closeNotice();
    });
});
