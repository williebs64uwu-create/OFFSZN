const fs = require('fs');
let content = fs.readFileSync('plugins/easy-master-mockup.html', 'utf8');

// 1. Add spinner CSS
content = content.replace('/* ACTIVATION OVERLAY */', `/* ACTIVATION OVERLAY */
        .activation-overlay {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(10, 10, 10, 0.98);
            backdrop-filter: blur(10px);
            z-index: 1000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.5s ease;
        }
        .activation-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }
        
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            border-top-color: var(--accent);
            animation: spin 1s ease-in-out infinite;
            margin-top: 20px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .activation-content {
            display: none;
            flex-direction: column;
            align-items: center;
            width: 100%;
            animation: fadeIn 0.3s ease;
        }
        .activation-content.visible { display: flex; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        /* OLD_OVERLAY_HACK */`);
content = content.replace(/\#activation-overlay \{[\s\S]*?pointer-events: all;\s*\}/, '');

// 2. Add spinner HTML
content = content.replace(/<div id="activation-overlay" class="active">[\s\S]*?<\/div>\s*<\/div>/, `<div class="activation-overlay active" id="activation-overlay">
        <img src="https://offszn.lat/assets/img/OFZ_Logo.png" alt="OFFSZN" class="offszn-logo-activation">
        <div class="loading-spinner" id="loading-spinner"></div>
        <p id="loading-text" style="margin-top:15px; font-size:14px; color:rgba(255,255,255,0.6);">Verificando licencia...</p>
        <div class="activation-content" id="activation-content">
            <h2>EASY MASTER</h2>
            <p>Por favor, activa tu copia para continuar.</p>
            <input type="text" id="serial-input" class="serial-input" placeholder="Ingresa tu Serial Key..." autocomplete="off" spellcheck="false">
            <button class="activate-btn" id="activate-btn" onclick="verifyLicense()">Activar Licencia</button>
            <p class="error-msg" id="activation-error"></p>
            <a href="https://offszn.lat" target="_blank" class="buy-link">¿No tienes una licencia? Consíguela aquí</a>
        </div>
    </div>`);

// 3. Update setLicenseStatus
content = content.replace(/window\.setLicenseStatus = function\(isValid\) \{[\s\S]*?\};/m, `window.setLicenseStatus = function(isValid) {
            const overlay = document.getElementById('activation-overlay');
            const spinner = document.getElementById('loading-spinner');
            const loadText = document.getElementById('loading-text');
            const content = document.getElementById('activation-content');
            if (isValid) overlay.classList.remove('active');
            else {
                overlay.classList.add('active');
                if (spinner) spinner.style.display = 'none';
                if (loadText) loadText.style.display = 'none';
                if (content) content.classList.add('visible');
            }
        };`);

// 4. Update the logic for background verification timeout
content = content.replace(/\.catch\(err => \{[\s\S]*?alert\("Error de conexión. Inténtalo de nuevo."\);[\s\S]*?\}\);/m, `.catch(err => {
                    if (btn) btn.innerText = "Activar Licencia";
                    setTimeout(() => {
                        callNative("getLicenseState").then((s) => {
                            if (s && s.isValid) window.setLicenseStatus(true);
                            else window.setLicenseStatus(false);
                        });
                    }, 500);
                });`);

fs.writeFileSync('plugins/easy-master-mockup.html', content);
