const fs = require('fs');
const file = 'c:/Users/Willie/Desktop/OFFSZN/cuenta/Upload/Beats.html';
let content = fs.readFileSync(file, 'utf8');

// Replace gisLoaded
const gisOldStart = '        function gisLoaded() {';
const gisOldEnd = '                window._gisInited = true;';
const gisIdx1 = content.indexOf(gisOldStart);
const gisIdx2 = content.indexOf(gisOldEnd, gisIdx1);

if(gisIdx1 !== -1 && gisIdx2 !== -1) {
    const endLine = content.indexOf('\n', gisIdx2 + gisOldEnd.length) + 1; // get to end of that block approx
    // let's do a replace based on the string instead
}

const gisOldStr =         function gisLoaded() {
            console.log('?? [CENTRAL] GIS Script Loaded');
            if (typeof google !== 'undefined') {
                window._googleTokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: window.SHARED_CONFIG.CLIENT_ID,
                    scope: window.SHARED_CONFIG.SCOPES,
                    callback: (resp) => {
                        console.log('?? [CENTRAL] Global Callback triggered!', resp);
                        if (typeof window._googleAuthPendingCallback === 'function') {
                            const cb = window._googleAuthPendingCallback;
                            window._googleAuthPendingCallback = null;
                            cb(resp);
                        }
                    }
                });
                window._gisInited = true;
                console.log('?? [CENTRAL] GIS Token Client Initialized');
            }
        };

const gisNewStr =         function gisLoaded() {
            console.log('🛡️ [CENTRAL] GIS Script Loaded');
            if (typeof google !== 'undefined') {
                window._googleTokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: window.SHARED_CONFIG.CLIENT_ID,
                    scope: window.SHARED_CONFIG.SCOPES,
                    callback: (resp) => {
                        console.log('✅ [CENTRAL] Global Callback triggered!', resp);
                        if (typeof window._googleAuthPendingCallback === 'function') {
                            const cb = window._googleAuthPendingCallback;
                            window._googleAuthPendingCallback = null;
                            cb(resp);
                        }
                    },
                    error_callback: (err) => {
                        console.warn('⚠️ [CENTRAL] Global Error Callback!', err);
                        if (typeof window._googleAuthPendingCallback === 'function') {
                            const cb = window._googleAuthPendingCallback;
                            window._googleAuthPendingCallback = null;
                            cb({ error: 'popup_closed', error_description: err.type || 'Popup closed' });
                        }
                    }
                });
                window._gisInited = true;
                console.log('✅ [CENTRAL] GIS Token Client Initialized');
            }
        };

// Try to replace by indexOf and substring for reliability
const start1 = content.indexOf('function gisLoaded() {');
const end1 = content.indexOf('window._gisInited = true;', start1);
if (start1 !== -1 && end1 !== -1) {
    const fullEnd1 = content.indexOf('}', content.indexOf('}', end1) + 1) + 1; // two closing braces
    content = content.substring(0, start1) + gisNewStr + content.substring(fullEnd1);
    console.log('Replaced gisLoaded.');
}


// Replace showLoading
const start2 = content.indexOf('// 🔥 LOADING HELPERS');
const end2 = content.indexOf('// 🔥 QUICK SAVE (HEADER BUTTON)', start2);

if (start2 !== -1 && end2 !== -1) {
    const loadingStr = // 🔥 LOADING HELPERS
        function showLoading(title = 'CARGANDO...', message = 'Por favor espera...', showProgress = false) {
            const overlay = document.getElementById('publishOverlay');
            if (overlay) {
                const titleEl = document.getElementById('publishOverlayTitle');
                const msgEl = document.getElementById('publishOverlayText');
                
                if (titleEl) titleEl.innerText = title;
                if (msgEl) msgEl.innerText = message;
                
                const spinner = document.getElementById('publishSpinner');
                const progressContainer = document.getElementById('publishProgressContainer');
                const progressBar = document.getElementById('publishProgressBar');

                if (showProgress) {
                    if (spinner) spinner.style.display = 'none';
                    if (progressContainer) progressContainer.style.display = 'block';
                    if (progressBar) progressBar.style.width = '0%';
                } else {
                    if (spinner) spinner.style.display = 'block';
                    if (progressContainer) progressContainer.style.display = 'none';
                }
                
                overlay.style.display = 'flex';
            }
        }

        function hideLoading() {
            const overlay = document.getElementById('publishOverlay');
            if (overlay) overlay.style.display = 'none';
        }

        // ========================================
        ;
    content = content.substring(0, start2) + loadingStr + content.substring(end2);
    console.log('Replaced showLoading/hideLoading.');
}

// Replace overlay HTML
const start3 = content.indexOf('<!-- 🔥 PUBLISH OVERLAY -->');
const end3 = content.indexOf('</html>', start3);

if (start3 !== -1 && end3 !== -1) {
    const overlayHtml = <!-- 🔥 PUBLISH OVERLAY -->
    <div id="publishOverlay"
        style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 9999; flex-direction: column; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
        
        <div class="spinner" id="publishSpinner"
            style="width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.1); border-left-color: #8b5cf6; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 24px;">
        </div>

        <div id="publishProgressContainer" style="display: none; width: 300px; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin-bottom: 24px; overflow: hidden;">
            <div id="publishProgressBar" style="width: 0%; height: 100%; background: #8b5cf6; transition: width 0.2s ease;"></div>
        </div>

        <h3 id="publishOverlayTitle"
            style="font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #fff; letter-spacing: -0.5px; text-align: center;">
            PUBLICANDO ARCHIVO...</h3>
        <p id="publishOverlayText" style="color: #888; font-size: 15px; font-weight: 500; text-align: center;">Por favor, no cierres esta página.</p>
    </div>
</body>
;
    content = content.substring(0, start3) + overlayHtml + content.substring(end3);
    console.log('Replaced Overlay HTML.');
}

fs.writeFileSync(file, content, 'utf8');
