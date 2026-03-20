// Tasa fija para visualización (legacy - prefer CurrencyManager)
const TASA_VISUAL = 3.80;

function cambiarMonedaGlobal(monedaDestino) {
    // Use CurrencyManager if available
    if (window.CurrencyManager) {
        window.CurrencyManager.setCurrency(monedaDestino);
        window.CurrencyManager.updateAllPrices();
        return;
    }

    // Legacy fallback
    localStorage.setItem('OFFSZN_CURRENCY', monedaDestino);
    const precios = document.querySelectorAll('.product-price, .cart-item-price');

    precios.forEach(el => {
        const precioBaseUSD = parseFloat(el.dataset.priceUsd);
        if (!precioBaseUSD) return;

        if (monedaDestino === 'PEN') {
            el.textContent = `S/ ${(precioBaseUSD * TASA_VISUAL).toFixed(2)}`;
        } else if (monedaDestino === 'EUR') {
            el.textContent = `€${(precioBaseUSD * 0.92).toFixed(2)}`;
        } else {
            el.textContent = `$ ${precioBaseUSD.toFixed(2)}`;
        }
    });
}

// Copiar al portapapeles con fallback
window.copyToClipboard = function (text) {
    if (!navigator.clipboard) {
        // Fallback para navegadores antiguos
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            // Silent fail
        }
        document.body.removeChild(textArea);
        return Promise.resolve();
    }
    return navigator.clipboard.writeText(text);
};

// Al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    const pref = (window.CurrencyManager ? window.CurrencyManager.getCurrency() : localStorage.getItem('OFFSZN_CURRENCY')) || 'USD';
    const selector = document.getElementById('currencySelector');
    if (selector) selector.value = pref;
});

/**
 * ======================================================================
 * ONBOARDING WIDGET LOGIC
 * ======================================================================
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check if dismissed or if we should show it
    if (localStorage.getItem('offszn_onboarding_dismissed') === 'true') return;
    
    // Prevent showing on the login or register pages which don't have the full authenticated structure
    if (window.location.pathname.includes('/login.html') || window.location.pathname.includes('/register.html') || window.location.pathname.includes('/welcome.html')) return;
    
    // Wait for Supabase to be ready
    if (!window.supabaseClient) {
        let retries = 0;
        while (!window.supabaseClient && retries < 10) {
            await new Promise(r => setTimeout(r, 200));
            retries++;
        }
        if (!window.supabaseClient) return;
    }
    
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) return; // Only show to logged in users 
    
    // Create Widget
    const widget = document.createElement('div');
    widget.id = 'offszn-onboarding-widget';
    widget.innerHTML = `
        <style>
            #offszn-onboarding-widget {
                position: fixed;
                bottom: 24px;
                right: 24px;
                width: 320px;
                background: rgba(10, 10, 10, 0.85);
                backdrop-filter: blur(25px);
                -webkit-backdrop-filter: blur(25px);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 16px;
                padding: 20px;
                color: #fff;
                z-index: 9999;
                box-shadow: 0 15px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1);
                opacity: 0;
                transform: translateY(30px) scale(0.95);
                transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
            }
            #offszn-onboarding-widget.show {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            .ow-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 14px;
            }
            .ow-title {
                font-weight: 800;
                font-size: 0.95rem;
                display: flex;
                align-items: center;
                gap: 8px;
                letter-spacing: -0.2px;
            }
            .ow-title i {
                color: #8b5cf6;
                font-size: 1.2rem;
                animation: float-icon 3s ease-in-out infinite;
            }
            @keyframes float-icon {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-3px); }
            }
            .ow-close-btn {
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.05);
                color: #888;
                cursor: pointer;
                font-size: 1.1rem;
                width: 26px;
                height: 26px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s ease;
            }
            .ow-close-btn:hover {
                color: #fff;
                background: rgba(239, 68, 68, 0.2);
                border-color: rgba(239, 68, 68, 0.4);
                transform: scale(1.05);
            }
            .ow-step {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: #141414;
                border: 1px solid rgba(255,255,255,0.06);
                border-radius: 12px;
                padding: 14px 16px;
                margin-bottom: 10px;
                cursor: pointer;
                text-decoration: none;
                color: #eee;
                transition: all 0.25s ease;
            }
            .ow-step:hover {
                background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(0,0,0,0) 100%);
                border-color: rgba(139, 92, 246, 0.3);
                transform: translateX(4px);
            }
            .ow-step-left {
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 0.85rem;
                font-weight: 600;
                letter-spacing: -0.1px;
            }
            .ow-step-number {
                background: rgba(139, 92, 246, 0.15);
                color: #a78bfa;
                width: 22px;
                height: 22px;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                font-weight: 800;
                border: 1px solid rgba(139, 92, 246, 0.2);
            }
            .ow-step i.bi-arrow-right {
                color: #555;
                font-size: 1.1rem;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .ow-step:hover i.bi-arrow-right {
                color: #a78bfa;
                transform: translateX(5px);
            }
            .ow-text-sub {
                display: block;
                font-size: 0.7rem;
                color: #777;
                font-weight: 500;
                margin-top: 2px;
            }
        </style>
        <div class="ow-header">
            <div class="ow-title"><i class="bi bi-rocket-takeoff-fill"></i> ¡Empieza Ahora!</div>
            <button class="ow-close-btn" title="Cerrar"><i class="bi bi-x"></i></button>
        </div>
        <a href="/cuenta/subir-kit.html" class="ow-step">
            <div class="ow-step-left">
                <span class="ow-step-number">1</span> 
                <div>
                    <div>Sube tu primer producto</div>
                    <span class="ow-text-sub">Beats, drumkits, o presets</span>
                </div>
            </div>
            <i class="bi bi-arrow-right"></i>
        </a>
        <a href="/cuenta/planes.html" class="ow-step" style="margin-bottom:0;">
            <div class="ow-step-left">
                <span class="ow-step-number">2</span>
                <div>
                    <div>Mejora a OFFSZN PRO</div>
                    <span class="ow-text-sub">Vende sin comisiones</span>
                </div>
            </div>
            <i class="bi bi-arrow-right"></i>
        </a>
    `;
    
    document.body.appendChild(widget);
    
    // Trigger animation
    setTimeout(() => {
        widget.classList.add('show');
    }, 1000);
    
    // Handle close with local storage persisting
    widget.querySelector('.ow-close-btn').addEventListener('click', (e) => {
        e.preventDefault();
        widget.style.opacity = '0';
        widget.style.transform = 'translateY(30px) scale(0.95)';
        setTimeout(() => {
            widget.remove();
        }, 500); // Wait for transition out
        localStorage.setItem('offszn_onboarding_dismissed', 'true');
    });
});
