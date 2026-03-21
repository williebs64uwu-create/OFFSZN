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

    // Inject CSS for Tailwind independence and premium look
    const style = document.createElement('style');
    style.textContent = `
        #offszn-cookie-notice {
            position: fixed;
            bottom: 24px;
            left: 24px;
            right: 24px;
            background: rgba(10, 10, 10, 0.8);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 20px;
            padding: 24px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
            z-index: 10000;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            color: #fff;
            max-width: 420px;
            transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (min-width: 768px) {
            #offszn-cookie-notice {
                left: auto;
                right: 24px;
            }
        }
        .cookie-content { display: flex; flex-direction: column; gap: 16px; }
        .cookie-header { display: flex; align-items: center; justify-content: space-between; }
        .cookie-title-row { display: flex; align-items: center; gap: 10px; }
        .cookie-title { font-weight: 600; font-size: 18px; margin: 0; }
        .cookie-text { font-size: 14px; color: #a1a1aa; line-height: 1.6; margin: 0; }
        .cookie-link { color: #00ff88; text-decoration: none; font-weight: 500; }
        .cookie-link:hover { text-decoration: underline; }
        .cookie-actions { display: flex; gap: 12px; margin-top: 4px; }
        .cookie-btn-accept { 
            flex: 1; 
            background: #00ff88; 
            color: #000; 
            border: none; 
            border-radius: 12px; 
            padding: 10px 20px; 
            font-weight: 600; 
            cursor: pointer; 
            transition: transform 0.2s, background 0.2s;
            box-shadow: 0 4px 15px rgba(0, 255, 136, 0.3);
        }
        .cookie-btn-accept:hover { background: #00cc6a; transform: translateY(-1px); }
        .cookie-btn-more { 
            flex: 1; 
            background: rgba(255, 255, 255, 0.05); 
            color: #fff; 
            border: 1px solid rgba(255, 255, 255, 0.1); 
            border-radius: 12px; 
            padding: 10px 20px; 
            font-weight: 500; 
            cursor: pointer; 
            text-align: center;
            text-decoration: none;
            font-size: 14px;
            transition: background 0.2s;
        }
        .cookie-btn-more:hover { background: rgba(255, 255, 255, 0.1); }
        .cookie-close { background: none; border: none; color: #71717a; cursor: pointer; padding: 4px; transition: color 0.2s; }
        .cookie-close:hover { color: #fff; }
    `;
    document.head.appendChild(style);

    // Create the notice element
    const notice = document.createElement('div');
    notice.id = 'offszn-cookie-notice';
    notice.style.transform = 'translateY(30px)';
    notice.style.opacity = '0';
    
    notice.innerHTML = `
        <div class="cookie-content">
            <div class="cookie-header">
                <div class="cookie-title-row">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                    <h3 class="cookie-title">Privacidad y Cookies</h3>
                </div>
                <button id="cookie-close-btn" class="cookie-close">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            
            <p class="cookie-text">
                Utilizamos cookies para personalizar tu experiencia y analizar nuestro tráfico. Al continuar navegando, aceptas nuestra 
                <a href="/legal/politica-de-cookies.html" class="cookie-link">Política de Cookies</a>.
            </p>

            <div class="cookie-actions">
                <button id="cookie-accept-btn" class="cookie-btn-accept">Aceptar</button>
                <a href="/legal/politica-de-privacidad.html" class="cookie-btn-more">Leer más</a>
            </div>
        </div>
    `;

    document.body.appendChild(notice);

    // Animation entry
    setTimeout(() => {
        notice.style.transform = 'translateY(0)';
        notice.style.opacity = '1';
    }, 100);

    const acceptBtn = notice.querySelector('#cookie-accept-btn');
    const closeBtn = notice.querySelector('#cookie-close-btn');

    const closeNotice = () => {
        notice.style.transform = 'translateY(30px)';
        notice.style.opacity = '0';
        setTimeout(() => {
            notice.remove();
        }, 500);
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
