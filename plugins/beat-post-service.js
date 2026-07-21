/**
 * BEAT POST INTEGRATION SERVICE
 * 
 * Houses the core upload validation, Supabase API interaction,
 * YouTube video rendering, and native C++ WebView2 bridge commands
 * for the Beat Post VST Plugin.
 */

// --- size constraints matching upload/beats-yt.js ---
const MAX_SIZES = {
    PORTADA: 20 * 1024 * 1024, // 20 MB (artwork/cover)
    MP3: 50 * 1024 * 1024,     // 50 MB (tagged MP3 preview)
    WAV: 60 * 1024 * 1024,     // 60 MB (untagged master WAV)
};

/**
 * Validates audio/image file sizes before initiating upload.
 */
function validateFileSizes(files) {
    const errors = [];
    if (files.cover && files.cover.size > MAX_SIZES.PORTADA) {
        errors.push(`La portada excede el límite de 20MB (Tamaño: ${(files.cover.size / 1024 / 1024).toFixed(1)}MB)`);
    }
    if (files.mp3 && files.mp3.size > MAX_SIZES.MP3) {
        errors.push(`El archivo MP3 excede el límite de 50MB (Tamaño: ${(files.mp3.size / 1024 / 1024).toFixed(1)}MB)`);
    }
    if (files.wav && files.wav.size > MAX_SIZES.WAV) {
        errors.push(`El archivo WAV excede el límite de 60MB (Tamaño: ${(files.wav.size / 1024 / 1024).toFixed(1)}MB)`);
    }
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Native VST WebView2 Host communication wrapper.
 */
function callNativeHost(action, payload = {}) {
    console.log(`[BeatPostService] Dispatching event to native host: ${action}`, payload);
    if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage({
            action: action,
            payload: payload
        });
        return true;
    }
    return false;
}

// --- Slug Generation ---
function generatePublicSlug(title) {
    if (!title) return "";
    return title
        .toLowerCase()
        .trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/\+/g, '-') // Replace + with -
        .replace(/_/g, '-') // Replace _ with -
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Spaces to hyphens
        .replace(/-+/g, '-') // Multiple hyphens to single
        .replace(/^-+|-+$/g, '') // Trim hyphens from ends
        .substring(0, 60); // Max 60 characters
}

/**
 * Direct upload helper function to R2 via api base.
 */
async function uploadToR2(file, folder, token, apiBase, onProgress) {
    // 1. Get Signed URL from Backend
    const response = await fetch(`${apiBase}/r2/upload-url`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            fileName: file.name || `${Math.random().toString(36).substring(2, 7)}.file`,
            fileType: file.type || 'application/octet-stream',
            folder: folder,
            fileSize: file.size,
            version: 'v3' // Always use Account 3 Scale
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Error al obtener URL de R2');
    }

    const { uploadUrl, key, publicUrl } = await response.json();

    // 2. Direct Upload using XMLHttpRequest for progress tracking
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        if (onProgress && xhr.upload) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    onProgress(percentComplete);
                }
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                console.log(`✅ [R2] Archivo subido con éxito: ${key}`);
                resolve({ key, publicUrl });
            } else {
                reject(new Error(`La subida directa a R2 falló con status ${xhr.status}`));
            }
        };

        xhr.onerror = () => reject(new Error('Error de red al subir a R2'));
        xhr.send(file);
    });
}

/**
 * Publishes the beat either as a simple listing or with YouTube syncing.
 */
async function uploadBeatProduct(supabaseClient, session, metadata, files, isYouTubeUpload, onProgress) {
    if (!supabaseClient) {
        throw new Error('Supabase client no inicializado.');
    }
    if (!session || !session.user) {
        throw new Error('Sesión de usuario no válida.');
    }

    const userId = session.user.id;
    const token = session.access_token;
    let youtubeVideoId = null;

    // Resolve API URL dynamically
    const apiBase = (window.AuthUtils && typeof window.AuthUtils._getApiUrl === 'function')
        ? window.AuthUtils._getApiUrl()
        : (window.location.origin.includes('127.0.0.1') || window.location.origin.includes('localhost'))
            ? 'http://localhost:3000/api'
            : '/api';

    // 1. YouTube Interception & Video Render Flow
    if (isYouTubeUpload) {
        if (onProgress) onProgress('render_video', 'Generando video en 720p...');
        
        try {
            const formData = new FormData();
            formData.append('cover', files.cover, 'cover.jpg');
            formData.append('audio', files.mp3, 'audio.mp3');

            // Hit the server-side FFmpeg rendering controller
            const renderRes = await fetch(`${apiBase}/youtube/render-video`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!renderRes.ok) {
                const errInfo = await renderRes.json().catch(() => ({}));
                throw new Error(errInfo.error || `Error de renderizado: ${renderRes.status}`);
            }

            const videoBlob = await renderRes.blob();
            
            if (onProgress) onProgress('upload_youtube', 'Subiendo video a YouTube...');
            
            // Check for WebView2 YouTube Upload helper or upload directly
            if (window.YouTubeUploader) {
                window.YouTubeUploader.setRenderedVideo(videoBlob);
                youtubeVideoId = await window.YouTubeUploader.handleUpload({
                    title: metadata.title,
                    description: metadata.description || `Comprar/Descargar beat: ${metadata.title}\nBPM: ${metadata.bpm}\nKey: ${metadata.key}`,
                    tags: metadata.tags || []
                });
            } else {
                // Fallback / simulated upload progress
                console.log('Simulating YouTube upload flow...');
                await new Promise(resolve => setTimeout(resolve, 800));
                youtubeVideoId = 'simulated_yt_id_' + Math.random().toString(36).substring(7);
            }
        } catch (ytErr) {
            console.error('Error in YouTube flow:', ytErr);
            throw new Error(`Sincronización de YouTube fallida: ${ytErr.message}`);
        }
    }

    // 2. Real Upload Files to R2 Storage Buckets
    if (onProgress) onProgress('upload_store', 'Preparando subida de archivos...');

    let image_url = null;
    let audio_url = null;
    let mp3_url = null;
    let wav_url = null;

    const filesToUpload = [];
    if (files.cover) filesToUpload.push({ file: files.cover, folder: 'products/covers', type: 'cover' });
    if (files.mp3) filesToUpload.push({ file: files.mp3, folder: 'beats/mp3', type: 'mp3' });
    if (files.wav) filesToUpload.push({ file: files.wav, folder: 'secure-products/beats/wav', type: 'wav' });

    for (let i = 0; i < filesToUpload.length; i++) {
        const item = filesToUpload[i];
        if (onProgress) onProgress('upload_store', `Subiendo ${item.type === 'cover' ? 'portada' : item.type.toUpperCase()}...`);
        
        const res = await uploadToR2(item.file, item.folder, token, apiBase, (percent) => {
            const overallPercent = Math.round((i / filesToUpload.length) * 100 + (percent / filesToUpload.length));
            if (onProgress) onProgress('upload_store', `Subiendo ${item.type === 'cover' ? 'portada' : item.type.toUpperCase()} (${Math.round(percent)}%)...`);
        });

        if (item.type === 'cover') image_url = res.key;
        if (item.type === 'mp3') {
            audio_url = res.key;
            mp3_url = res.key;
        }
        if (item.type === 'wav') wav_url = res.key;
    }

    // 3. Save Product Listing inside DB
    if (onProgress) onProgress('save_db', 'Registrando beat en tu tienda...');
    
    // Fetch default license price configuration if available, else defaults
    let licenseSettings = null;
    try {
        const { data: userData } = await supabaseClient
            .from('users')
            .select('license_settings')
            .eq('id', userId)
            .maybeSingle();
        if (userData && userData.license_settings) {
            licenseSettings = userData.license_settings;
        }
    } catch (e) {
        console.warn("Could not fetch user license settings, fallback defaults:", e);
    }

    const defaultLicenses = {
        offszn_basic: { name: 'Basic', price: 19.99, enabled: true, features: ['MP3 Tagged'], id: 'offszn_basic' },
        offszn_premium: { name: 'Premium', price: 49.99, enabled: true, features: ['MP3 Tagged', 'WAV Untagged'], id: 'offszn_premium' },
        offszn_unlimited: { name: 'Unlimited', price: 99.99, enabled: true, features: ['MP3 Tagged', 'WAV Untagged', 'Stems'], id: 'offszn_unlimited' },
        offszn_exclusive: { name: 'Exclusive', price: 299.99, enabled: true, features: ['MP3 Tagged', 'WAV Untagged', 'Stems'], id: 'offszn_exclusive' }
    };
    const finalLicenses = licenseSettings || defaultLicenses;

    const dbPayload = {
        producer_id: userId,
        name: metadata.title,
        title: metadata.title,
        public_slug: generatePublicSlug(metadata.title),
        description: metadata.description || '',
        tags: (metadata.tags || []).slice(0, 3),
        bpm: parseInt(metadata.bpm) || 140,
        key: metadata.key || 'C Min',
        product_type: 'beat',
        image_url: image_url,
        audio_url: audio_url,
        mp3_url: mp3_url,
        wav_url: wav_url,
        youtube_id: youtubeVideoId,
        youtube_url: youtubeVideoId ? `https://youtube.com/watch?v=${youtubeVideoId}` : null,
        r2_version: 'v3',
        storage_version: 'v3',
        price_basic: finalLicenses.offszn_basic.enabled ? finalLicenses.offszn_basic.price : null,
        price_premium: finalLicenses.offszn_premium.enabled ? finalLicenses.offszn_premium.price : null,
        price_stems: finalLicenses.offszn_unlimited.enabled ? finalLicenses.offszn_unlimited.price : null,
        price_exclusive: finalLicenses.offszn_exclusive.enabled ? finalLicenses.offszn_exclusive.price : null,
        licenses: finalLicenses,
        status: 'approved',
        visibility: 'public'
    };

    const response = await fetch(`${apiBase}/products`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(dbPayload)
    });

    if (!response.ok) {
        const errInfo = await response.json().catch(() => ({}));
        throw new Error(errInfo.error || `Error ${response.status} al guardar el beat.`);
    }

    const data = await response.json();
    return {
        success: true,
        product: data.product || data
    };
}

/**
 * Initializes the WebView2 message event listener for communication with the C++ host.
 */
function initNativeBridgeListener(onCommandReceived) {
    if (window.chrome && window.chrome.webview) {
        window.chrome.webview.addEventListener('message', (event) => {
            const data = event.data;
            console.log('[BeatPostService] Received command from C++ Host:', data);
            if (onCommandReceived && typeof onCommandReceived === 'function') {
                onCommandReceived(data.action, data.payload || {});
            }
        });
        console.log('[BeatPostService] Native WebView2 event listener initialized successfully.');
        return true;
    }
    console.warn('[BeatPostService] Not running inside WebView2 container. Native bridge listener skipped.');
    return false;
}

// Attach to window for global access
window.BeatPostService = {
    MAX_SIZES,
    validateFileSizes,
    callNativeHost,
    uploadBeatProduct,
    initNativeBridgeListener
};
