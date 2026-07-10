/**
 * YouTube Uploader Module for OFFSZN (v2 — Server-Side Render)
 * Uses server-side FFmpeg for video generation (fast, ~3-5 sec).
 * Handles Google OAuth and YouTube Data API uploads client-side.
 */

const YouTubeUploader = (function () {
    // Configuration
    const CONFIG = {
        CLIENT_ID: '804444303530-bl8gtp4sdjkcnrkjl1295vns59tqp4tc.apps.googleusercontent.com',
        SCOPES: 'https://www.googleapis.com/auth/youtube.upload',
        DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest']
    };

    // State
    let renderedVideoBlob = null;
    let accessToken = null;
    let tokenClient = null;
    let isInitializing = false;
    let isReady = false;
    let authRequest = null;
    let previewContainer = null;

    async function init() {
        if (isReady || isInitializing) return;
        isInitializing = true;

        // Wait for central Google client if needed
        if (!window._googleTokenClient || !window._gapiInited || !window._gisInited) {
            await new Promise(resolve => {
                let attempts = 0;
                const check = () => {
                    attempts++;
                    if (window._googleTokenClient && window._gapiInited && window._gisInited) resolve();
                    else if (attempts > 100) resolve(); // 10s timeout
                    else setTimeout(check, 100);
                };
                check();
            });
        }

        initTokenClient();
        isInitializing = false;
        isReady = true;
    }

    function initTokenClient() {
        if (window._googleTokenClient) {
            tokenClient = window._googleTokenClient;
        }
    }

    function requestAuth() {
        return new Promise((resolve, reject) => {
            if (!tokenClient) initTokenClient();
            if (!tokenClient) return reject(new Error('Google Identity Services no está listo.'));

            if (authRequest) {
                clearTimeout(authRequest.timeout);
                authRequest.reject(new Error('Auth request superseded'));
            }

            const timeout = setTimeout(() => {
                if (authRequest && authRequest.reject) {
                    authRequest.reject(new Error('TIMEOUT_AUTH'));
                    authRequest.resolve = null;
                    authRequest.reject = null;
                }
            }, 300000); // 5 min

            authRequest = { resolve, reject, timeout };

            try {
                if (typeof window._googleRequestAuth !== 'function') {
                    throw new Error('Global Auth Proxy (_googleRequestAuth) not found');
                }

                window._googleRequestAuth((resp) => {
                    if (!authRequest) return;
                    clearTimeout(authRequest.timeout);
                    if (resp.error) {
                        authRequest.reject(new Error(resp.error_description || resp.error || 'Autenticación fallida'));
                    } else if (!resp.access_token) {
                        authRequest.reject(new Error('No se recibió el token de acceso de Google.'));
                    } else {
                        authRequest.resolve(resp.access_token);
                    }
                    authRequest = null;
                });
            } catch (err) {
                if (authRequest) {
                    clearTimeout(authRequest.timeout);
                    authRequest.reject(err);
                    authRequest = null;
                }
            }
        });
    }

    async function renderPreviewUI(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        previewContainer = container;

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
                    <div style="background:#000; aspect-ratio:16/9; border-radius:12px; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; border: 1px solid #333;" id="yt-render-preview">
                        ${data.coverUrl ? `<img crossorigin="anonymous" src="${data.coverUrl}" style="width:100%; height:100%; object-fit:cover; opacity:0.4; filter: blur(2px);">` : ''}
                        <div style="position:absolute; z-index:2; text-align:center; display:flex; flex-direction:column; align-items:center; gap:12px; width: 100%;">
                            <div style="background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); padding:8px 16px; border-radius:20px; border:1px solid rgba(255,255,255,0.1);">
                                <p style="margin:0; font-size:13px; color:#ddd; font-weight: 500;" id="yt-status-text">Paso 2: Generar antes de subir</p>
                            </div>
                            <button id="btn-start-render" style="padding:12px 24px; background:#8b5cf6; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600; font-size:14px; box-shadow:0 4px 12px rgba(139, 92, 246, 0.3); transition: all 0.2s; display:flex; align-items:center; gap:8px;">
                                <span>Generar Video</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            </button>
                        </div>
                    </div>

                    <div style="font-size:14px; color:#ccc;">
                        <div style="margin-bottom:16px;">
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

        const publishBtn = document.getElementById('publishNow');
        if (publishBtn) {
            publishBtn.disabled = true;
            publishBtn.style.opacity = '0.5';
            publishBtn.style.cursor = 'not-allowed';
            publishBtn.title = "Primero debes generar el video";
        }

        const btnRender = document.getElementById('btn-start-render');
        if (btnRender) {
            btnRender.onclick = async () => {
                btnRender.disabled = true;
                btnRender.innerText = 'Generando...';
                btnRender.style.background = '#666';

                const statusText = document.getElementById('yt-status-text');

                try {
                    // SERVER-SIDE RENDER (fast!)
                    if (statusText) statusText.innerText = 'Creando video...';

                    const formData = new FormData();
                    formData.append('cover', data.coverBlob, 'cover.jpg');
                    formData.append('audio', data.audioBlob, 'audio.mp3');

                    const session = await window.supabaseClient.auth.getSession();
                    const token = session.data.session?.access_token;
                    if (!token) throw new Error('Sesión expirada. Recarga la página.');

                    const apiBase = window.OFFSZN_CONFIG?.API_BASE_URL || '';

                    const response = await fetch(`${apiBase}/api/youtube/render-video`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(errData.error || `Error ${response.status}`);
                    }

                    if (statusText) statusText.innerText = 'Procesando video...';

                    const videoArrayBuffer = await response.arrayBuffer();
                    renderedVideoBlob = new Blob([videoArrayBuffer], { type: 'video/mp4' });

                    btnRender.innerText = 'Video Listo ✅';
                    btnRender.style.background = '#10b981';
                    if (statusText) statusText.innerText = 'Paso 3: ¡Listo para publicar!';

                    if (publishBtn) {
                        publishBtn.disabled = false;
                        publishBtn.style.opacity = '1';
                        publishBtn.style.cursor = 'pointer';
                        publishBtn.title = "";
                    }

                } catch (e) {
                    btnRender.innerText = 'Error al Generar';
                    btnRender.style.background = '#ef4444';
                    btnRender.disabled = false;
                    if (statusText) statusText.innerText = 'Error: ' + e.message;
                }
            };
        }
    }

    async function requestAuth() {
        if (accessToken) return accessToken;

        return new Promise((resolve, reject) => {
            if (typeof window._googleRequestAuth !== 'function') {
                return reject(new Error('GIS Proxy (_googleRequestAuth) no cargado en la página.'));
            }

            console.log('📹 [YT-V2] Requesting auth via proxy...');

            const authTimeout = setTimeout(() => {
                reject(new Error('La autenticación de Google tardó demasiado o la ventana fue cerrada. Reintenta.'));
            }, 60000); // 1 minute safety timeout

            window._googleRequestAuth((resp) => {
                clearTimeout(authTimeout);
                if (resp.error) {
                    console.error('🛑 [YT-V2] Auth Error:', resp);
                    return reject(new Error(resp.error_description || resp.error || 'Autenticación fallida'));
                }
                if (resp.access_token) {
                    accessToken = resp.access_token;
                    console.log('✅ [YT-V2] Auth Success');
                    resolve(accessToken);
                } else {
                    reject(new Error('Respuesta de Google sin token de acceso.'));
                }
            }, CONFIG.SCOPES);
        });
    }

    async function handleUpload(metadata) {
        if (!renderedVideoBlob) {
            throw new Error('Video no generado aún. Por favor espera a que termine el procesamiento.');
        }

        try {
            const token = await requestAuth();

            // 🔥 The overlay is handled by handlePublish in Beats.html but we update its progress here
            const videoId = await uploadToAPI(renderedVideoBlob, metadata, token);
            return videoId;
        } catch (error) {
            console.error('🛑 [YT-V2] handleUpload Fail:', error);
            throw error;
        }
    }

    async function uploadToAPI(file, metadata, token) {
        return new Promise((resolve, reject) => {
            const url = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';

            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
            xhr.setRequestHeader('X-Upload-Content-Length', file.size);
            xhr.setRequestHeader('X-Upload-Content-Type', 'video/mp4');

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const location = xhr.getResponseHeader('Location');
                    if (location) {
                        performActualUpload(location, file, resolve, reject);
                    } else {
                        reject(new Error('No se recibió la URL de subida (Location).'));
                    }
                } else {
                    reject(new Error(`Error inicializando subida: ${xhr.status} ${xhr.responseText}`));
                }
            };

            xhr.onerror = () => reject(new Error('Error de red al intentar conectar con YouTube.'));

            const body = {
                snippet: {
                    title: metadata.title,
                    description: metadata.description,
                    tags: metadata.tags || [],
                    categoryId: '10' // Music
                },
                status: {
                    privacyStatus: 'public',
                    selfDeclaredMadeForKids: false
                }
            };
            xhr.send(JSON.stringify(body));
        });
    }

    function performActualUpload(location, file, resolve, reject) {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', location, true);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);

                // 🔥 Update Beats.html Progress Bar & Title
                const progressBar = document.getElementById('publishProgressBar');
                const overlayTitle = document.getElementById('publishOverlayTitle');

                if (progressBar) progressBar.style.width = percent + '%';
                if (overlayTitle) overlayTitle.innerText = `SUBIENDO: ${percent}%`;
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 201) {
                try {
                    const resp = JSON.parse(xhr.responseText);
                    resolve(resp.id);
                } catch (e) {
                    reject(new Error('Error al procesar la respuesta de YouTube.'));
                }
            } else {
                reject(new Error(`Error durante la subida: ${xhr.status} ${xhr.responseText}`));
            }
        };

        xhr.onerror = () => reject(new Error('Error de red durante la transferencia del video.'));
        xhr.send(file);
    }

    return {
        init: (config) => { console.log('📹 YouTubeUploader V2 Inited'); },
        renderPreviewUI,
        handleUpload,
        requestAuth,
        setRenderedVideo: (blob) => { renderedVideoBlob = blob; }
    };
})();

window.YouTubeUploader = YouTubeUploader;
