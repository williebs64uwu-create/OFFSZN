/**
 * YouTube Uploader Module for OFFSZN
 * Encapsulates all logic for Client-Side Video Rendering (ffmpeg.wasm) and YouTube Data API Uploads.
 * 
 * Usage:
 * window.YouTubeUploader.init(config);
 * window.YouTubeUploader.renderPreview(containerId, metadata, files);
 * await window.YouTubeUploader.handleUpload(metadata, files);
 */

const YouTubeUploader = (function () {
    // Configuration
    const CONFIG = {
        // FFmpeg v0.11.6 + Single-Threaded Core (core-st v0.11.1)
        FFMPEG_LIB_URL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js',
        FFMPEG_CORE_URL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js',

        // This is the SAME client ID used in youtube-importer.js. 
        // We will need 'https://www.googleapis.com/auth/youtube.upload' scope.
        CLIENT_ID: '804444303530-bl8gtp4sdjkcnrkjl1295vns59tqp4tc.apps.googleusercontent.com', // Replace if different
        SCOPES: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
        DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest']
    };

    // State
    let ffmpeg = null;
    let isRendering = false;
    let renderedVideoBlob = null;
    let tokenClient = null;
    let gapiInited = false;
    let gisInited = false;

    // UI Elements
    let previewContainer = null;

    /**
     * Initialize the module. 
     * Loads GAPI and GIS scripts if not already loaded (though youtube-importer might have loaded them).
     */
    async function init() {
        console.log('🎥 YouTubeUploader: Initializing...');
        await loadLibs();
    }

    /**
     * Load Google scripts if not present.
     */
    function loadLibs() {
        return new Promise((resolve) => {
            let loaded = 0;
            const check = () => { if (loaded === 2) resolve(); };

            if (typeof gapi !== 'undefined') {
                gapi.load('client', async () => {
                    await gapi.client.init({
                        // 🔥 FIX: Remove clientId/scope from GAPI init (Use GIS for Auth)
                        discoveryDocs: CONFIG.DISCOVERY_DOCS,
                    });
                    gapiInited = true;
                    loaded++;
                    check();
                });
            } else {
                // Load GAPI
                const script = document.createElement('script');
                script.src = 'https://apis.google.com/js/api.js';
                script.onload = () => {
                    gapi.load('client', async () => {
                        await gapi.client.init({
                            // 🔥 FIX: Remove clientId/scope from GAPI init (Use GIS for Auth)
                            discoveryDocs: CONFIG.DISCOVERY_DOCS,
                        });
                        gapiInited = true;
                        loaded++;
                        check();
                    });
                };
                document.body.appendChild(script);
            }

            if (typeof google !== 'undefined' && google.accounts) {
                initTokenClient();
                gisInited = true;
                loaded++;
                check();
            } else {
                // Load GIS
                const script2 = document.createElement('script');
                script2.src = 'https://accounts.google.com/gsi/client';
                script2.onload = () => {
                    initTokenClient();
                    gisInited = true;
                    loaded++;
                    check();
                };
                document.body.appendChild(script2);
            }
        });
    }

    function initTokenClient() {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.CLIENT_ID,
            scope: CONFIG.SCOPES,
            callback: (resp) => {
                if (resp.error !== undefined) {
                    throw (resp);
                }
                console.log('🎥 YouTubeUploader: Auth Success', resp);
                // Dispatch event or callback handling
            },
        });
    }

    /**
     * Request Authorization from User
     */
    function requestAuth() {
        return new Promise((resolve, reject) => {
            if (!tokenClient) return reject('Token Client not connected');

            // Override callback for this specific request
            tokenClient.callback = (resp) => {
                if (resp.error) reject(resp);
                else resolve(resp.access_token);
            };

            // Request permission
            // ALWAYS force consent prompt during debugging to ensure callback fires
            // In production we might optimize this, but for now we need reliability
            tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    }


    /**
     * Render the Video Preview UI in the specified container.
     */
    async function renderPreviewUI(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        previewContainer = container;

        // Basic HTML structure
        container.innerHTML = `
            <div style="background: #0f0f0f; border: 1px solid #333; border-radius: 16px; padding: 24px; margin-top: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <div style="display:flex; align-items:center; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #222;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="#8b5cf6" xmlns="http://www.w3.org/2000/svg">
                         <path d="M19.615 3.184C19.385 2.327 18.711 1.653 17.854 1.423C16.301 1.007 12 1 12 1C12 1 7.699 1.007 6.146 1.423C5.289 1.653 4.615 2.327 4.385 3.184C3.969 4.737 3.969 8 3.969 8C3.969 8 3.969 11.263 4.385 12.816C4.615 13.673 5.289 14.347 6.146 14.577C7.699 14.993 12 15 12 15C12 15 16.301 14.993 17.854 14.577C18.711 14.347 19.385 13.657 19.615 12.816C20.031 11.263 20.031 8 20.031 8C20.031 8 20.031 4.737 19.615 3.184Z" fill="#8b5cf6"/>
                         <polygon points="10,11 15,8 10,5" fill="white"/>
                    </svg>
                    <div>
                        <h3 style="margin:0; font-size:18px; font-weight: 600; color:#fff;">Publicar en YouTube</h3>
                        <p style="margin:4px 0 0 0; font-size:13px; color:#666;">Genera y sube tu video automáticamente</p>
                    </div>
                </div>

                <!-- 🔥 STEPS GUIDE -->
                <div style="display:flex; justify-content:space-between; margin-bottom:30px; background:#1a1a1a; padding:16px; border-radius:12px; font-size:13px; color:#888; border: 1px solid #222;">
                    <div style="text-align:center; flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;">
                        <span style="display:flex; align-items:center; justify-content:center; width:24px; height:24px; background:#333; color:#fff; border-radius:50%; font-size:12px; font-weight:bold;">1</span>
                        <span>Verificar Info</span>
                    </div>
                    <div style="width: 1px; background: #333; margin: 0 10px;"></div>
                    <div style="text-align:center; flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;">
                        <span style="display:flex; align-items:center; justify-content:center; width:24px; height:24px; background:#8b5cf6; color:#fff; border-radius:50%; font-size:12px; font-weight:bold; box-shadow: 0 0 10px rgba(139, 92, 246, 0.3);">2</span>
                        <span style="color:#fff; font-weight:500;">Generar Video</span>
                    </div>
                    <div style="width: 1px; background: #333; margin: 0 10px;"></div>
                    <div style="text-align:center; flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;">
                        <span style="display:flex; align-items:center; justify-content:center; width:24px; height:24px; background:#333; color:#fff; border-radius:50%; font-size:12px; font-weight:bold;">3</span>
                        <span>Publicar</span>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:30px; align-items:start;">
                    <!-- Preview Player Helper -->
                    <div style="background:#000; aspect-ratio:16/9; border-radius:12px; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; border: 1px solid #333;" id="yt-render-preview">
                        ${data.coverUrl ? `<img src="${data.coverUrl}" style="width:100%; height:100%; object-fit:cover; opacity:0.4; filter: blur(2px);">` : ''}
                        <div style="position:absolute; z-index:2; text-align:center; display:flex; flex-direction:column; align-items:center; gap:12px; width: 100%;">
                            <div style="background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); padding:8px 16px; border-radius:20px; border:1px solid rgba(255,255,255,0.1);">
                                <p style="margin:0; font-size:13px; color:#ddd; font-weight: 500;">Paso 2: Generar antes de subir</p>
                            </div>
                            <button id="btn-start-render" style="padding:12px 24px; background:#8b5cf6; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600; font-size:14px; box-shadow:0 4px 12px rgba(139, 92, 246, 0.3); transition: all 0.2s; display:flex; align-items:center; gap:8px;">
                                <span>Generar Video</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            </button>
                        </div>
                    </div>

                    <!-- Metadata Readonly -->
                    <div style="font-size:14px; color:#ccc;">
                        <div style="mb-4">
                            <label style="display:block; color:#666; font-size:12px; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">Título</label>
                            <div style="color:#fff; font-weight:500; line-height:1.4;">${data.title}</div>
                        </div>
                        
                        <div style="margin-top:16px;">
                            <label style="display:block; color:#666; font-size:12px; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">Descripción</label>
                            <div style="color:#aaa; font-size:13px; line-height:1.5; white-space: pre-wrap; max-height:80px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${data.desc || '<span style="color:#444; font-style:italic;">Sin descripción</span>'}</div>
                        </div>

                        <div style="margin-top:20px; padding:16px; background:rgba(139, 92, 246, 0.05); border-radius:8px; border:1px solid rgba(139, 92, 246, 0.1);">
                            <div style="display:flex; gap:10px;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                <div>
                                    <p style="margin:0 0 4px 0; font-size:13px; color:#fff; font-weight:600;">Instrucciones</p>
                                    <p style="margin:0; font-size:12px; color:#aaa; line-height:1.5;">
                                        1. Haz click en <strong>Generar Video</strong> y espera la confirmación.<br>
                                        2. Una vez listo, usa el botón <strong>Publicar</strong> (abajo a la derecha).
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 🔥 LOCK PUBLISH BUTTON INITIALLY
        const publishBtn = document.getElementById('publishNow');
        if (publishBtn) {
            publishBtn.disabled = true;
            publishBtn.style.opacity = '0.5';
            publishBtn.style.cursor = 'not-allowed';
            publishBtn.title = "Primero debes generar el video";
        }

        // Attach listeners
        const btnRender = document.getElementById('btn-start-render');
        if (btnRender) {
            btnRender.onclick = async () => {
                btnRender.disabled = true;
                btnRender.innerText = 'Generando... (Esto puede tardar)';
                btnRender.style.background = '#666'; // Neutral processing
                try {
                    // Logic to load render
                    await generateVideo(data.coverBlob, data.audioBlob);
                    btnRender.innerText = 'Video Listo ✅';
                    btnRender.style.background = '#10b981';

                    // 🔥 UNLOCK PUBLISH BUTTON
                    if (publishBtn) {
                        publishBtn.disabled = false;
                        publishBtn.style.opacity = '1';
                        publishBtn.style.cursor = 'pointer';
                        publishBtn.title = "";
                    }

                } catch (e) {
                    console.error(e);
                    btnRender.innerText = 'Error al Generar';
                    btnRender.style.background = '#ef4444'; // Error red is ok for error
                    btnRender.disabled = false;
                }
            };
        }

        // 🔥 ELIMINADO PARA OFFSZN: No sobrescribir el onclick de publishBtn
        // ya que la subida a OFFSZN debe ejecutarse en el handlePublish real.
        /*
        if (publishBtn) {
            publishBtn.onclick = async () => {
                if (!renderedVideoBlob) {
                    alert('Primero debes generar el video.');
                    return;
                }
                const response = await handleUpload(data);

                // 🔥 TRIGGER CALLBACK FOR OFFSZN SAVE
                if (response && response.id && data.onSuccess) {
                    console.log('🔗 Triggering OFFSZN Save Callback...');
                    data.onSuccess(response.id);
                }
            };
        }
        */
    }

    /**
     * Load FFmpeg v0.11.6 (Single-Threaded Core @ffmpeg/core-st@0.11.1)
     * Uses jsdelivr CDN which is whitelisted in CSP.
     * core-st is compiled WITHOUT threading — no SharedArrayBuffer/COOP/COEP needed.
     */
    async function loadFFmpeg() {
        if (ffmpeg) return ffmpeg;
        console.log('⏳ Loading FFmpeg v0.11.6 (core-st@0.11.1)...');

        try {
            // Safety polyfill: some ffmpeg init code may check for SAB existence
            if (typeof SharedArrayBuffer === 'undefined') {
                window.SharedArrayBuffer = ArrayBuffer;
            }

            // 1. Load the FFmpeg library (v0.11.6)
            if (!window.FFmpeg) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = CONFIG.FFMPEG_LIB_URL;
                    script.onload = resolve;
                    script.onerror = () => reject(new Error('Failed to load ffmpeg.min.js'));
                    document.head.appendChild(script);
                });
            }

            // 2. Create instance with core-st (truly single-threaded, no SAB)
            const { createFFmpeg, fetchFile } = window.FFmpeg;
            window.FFmpegUtil = { fetchFile };

            console.log('🔧 Core Path (core-st):', CONFIG.FFMPEG_CORE_URL);

            ffmpeg = createFFmpeg({
                log: true,
                corePath: CONFIG.FFMPEG_CORE_URL,
            });

            // 3. Load
            await ffmpeg.load();

            console.log('✅ FFmpeg Loaded & Ready (v0.11.6, core-st@0.11.1)');
            return { ffmpeg, fetchFile };

        } catch (error) {
            console.error('❌ FFmpeg Load Error:', error);
            throw error;
        }
    }

    /**
     * Generate Video using FFmpeg
     */
    async function generateVideo(coverBlob, audioBlob) {
        console.log('🎥 Generating video (ffmpeg v0.11.6)...', coverBlob, audioBlob);

        if (!ffmpeg || !ffmpeg.isLoaded()) {
            await loadFFmpeg();
        }

        const { fetchFile } = window.FFmpeg; // Directamente de la librería

        // Determine Extensions
        const audioExt = audioBlob.type.includes('wav') ? 'wav' : 'mp3';

        // Write Files to Virtual FS
        ffmpeg.FS('writeFile', 'input.jpg', await fetchFile(coverBlob));
        ffmpeg.FS('writeFile', `audio.${audioExt}`, await fetchFile(audioBlob));

        console.log('🎥 FFmpeg Running...');

        // Run Command
        await ffmpeg.run(
            '-loop', '1',
            '-framerate', '1',
            '-i', 'input.jpg',
            '-i', `audio.${audioExt}`,
            '-c:v', 'libx264',
            '-tune', 'stillimage',
            '-preset', 'ultrafast',
            '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-pix_fmt', 'yuv420p',
            '-shortest',
            'out.mp4'
        );

        console.log('🎥 FFmpeg Reading output...');
        const data = ffmpeg.FS('readFile', 'out.mp4');

        renderedVideoBlob = new Blob([data.buffer], { type: 'video/mp4' });
        console.log('🎥 Video Blob Created:', renderedVideoBlob.size);

        // Cleanup
        try {
            ffmpeg.FS('unlink', 'input.jpg');
            ffmpeg.FS('unlink', `audio.${audioExt}`);
            ffmpeg.FS('unlink', 'out.mp4');
        } catch (e) { }

        return renderedVideoBlob;
    }


    /**
     * Main Upload Function
     * Called by Beats.html
     */
    async function handleUpload(metadata) {
        try {
            console.log('🎥 Starting YouTube Upload...', metadata);

            // 1. Check Auth & Token FIRST (Before blocking UI)
            // This prevents the overlay from blocking the Auth Popup interaction
            const accessToken = await requestAuth();

            // 🔥 SHOW BLOCKING OVERLAY (Now that we have the token)
            const overlay = document.getElementById('publishOverlay');
            if (overlay) {
                overlay.querySelector('h3').textContent = 'SUBIENDO A YOUTUBE...';
                overlay.querySelector('p').innerHTML = 'Por favor espera. No cierres esta página.';
                overlay.style.display = 'flex';
            }

            // 2. Ensure Video is Ready
            if (!renderedVideoBlob) {
                // Try to render if not ready
                // await generateVideo(metadata.coverBlob, metadata.audioBlob);
                throw new Error("El video de YouTube no se ha generado aún. Por favor genéralo en la vista previa.");
            }

            // 3. Upload to YouTube
            const response = await uploadToAPI(renderedVideoBlob, metadata, accessToken);

            // ✅ Success Logic
            console.log('✅ Upload Success:', response);

            // Hide Overlay
            if (overlay) overlay.style.display = 'none';

            // Show Success Modal (Reuse Beats.html modal or Alert)
            // Assuming Beats.html has a success modal, let's try to use it or fallback to alert
            const successModal = document.getElementById('publishSuccessModal');
            if (successModal) {
                const msgEl = successModal.querySelector('#publishMessage');
                if (msgEl) {
                    msgEl.style.display = 'block';
                    msgEl.innerText = '¡Publicado en YouTube exitosamente!';
                }
                const linkInput = successModal.querySelector('#uniqueLinkInput');
                if (linkInput) linkInput.value = `https://youtu.be/${response.id}`;

                successModal.classList.add('active'); // Use class active for modals in this system
            } else {
                alert(`¡Video subido con éxito! ID: ${response.id}`);
            }

            return response;

        } catch (error) {
            console.error('🎥 Upload Failed:', error);

            // Hide Overlay
            const overlay = document.getElementById('publishOverlay');
            if (overlay) overlay.style.display = 'none';

            alert('Error subiendo a YouTube: ' + (error.message || error));
            throw error;
        }
    }

    /**
     * Helper to update the progress bar UI
     * @param {number} percent 0-100
     * @param {string} text Optional status text
     */
    function updateProgressBar(percent, text) {
        const bar = document.getElementById('publishProgressBar');
        if (bar) bar.style.width = `${percent}%`;
        const textEl = document.getElementById('publishOverlayText');
        if (textEl && text) textEl.innerText = text;
    }

    /**
     * Call YouTube Data API (videos.insert) using Resumable Upload
     * Switch to XMLHttpRequest for real progress tracking
     */
    function uploadToAPI(blob, metadata, token) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('📤 uploadToAPI called with:', { size: blob.size, metadata });
                updateProgressBar(5, 'Iniciando sesión de subida...');

                const snippet = {
                    title: metadata.title,
                    description: metadata.description,
                    tags: metadata.tags,
                    categoryId: '10' // Music
                };
                const status = {
                    privacyStatus: 'public'
                };

                // START RESUMABLE SESSION
                const initResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ snippet, status })
                });

                if (!initResponse.ok) {
                    const err = await initResponse.json().catch(() => ({ error: { message: initResponse.statusText } }));
                    throw new Error(err.error?.message || 'Error iniciando sesión de subida');
                }

                const uploadUrl = initResponse.headers.get('Location');
                if (!uploadUrl) throw new Error('No se recibió URL de subida (Location header)');

                updateProgressBar(10, 'Subiendo video a YouTube...');

                // UPLOAD BYTES using XHR for events
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', uploadUrl, true);

                // Track Progress
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        // Rescale progress: 10% to 95%
                        const percent = Math.round((e.loaded / e.total) * 85) + 10;
                        updateProgressBar(percent, `Subiendo: ${percent}%`);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const resp = JSON.parse(xhr.responseText);
                            updateProgressBar(100, '¡Subida completada!');
                            resolve(resp);
                        } catch (e) {
                            reject(new Error('Respuesta de YouTube inválida'));
                        }
                    } else {
                        try {
                            const err = JSON.parse(xhr.responseText);
                            reject(new Error(err.error?.message || `Error en la subida: ${xhr.status}`));
                        } catch (e) {
                            reject(new Error(`Error en la subida: ${xhr.status}`));
                        }
                    }
                };

                xhr.onerror = () => reject(new Error('Error de red durante la subida'));
                xhr.send(blob);

            } catch (err) {
                reject(err);
            }
        });
    }


    // Public API
    return {
        init: init,
        renderPreviewUI: renderPreviewUI,
        handleUpload: handleUpload,
        // Expose render function if needed manually
        renderVideo: generateVideo
    };

})();

// Attach to window
window.YouTubeUploader = YouTubeUploader;

console.log('🎥 YouTubeUploader Module Loaded');
