import { checkAuth, logout } from './auth-utils.js';

let currentUser = null;
let currentRole = 'buyer'; // 'buyer' or 'producer'
let wsResponse = null;
let wsRegion = null;
let currentUploadFile = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await checkAuth();
    if (!currentUser) {
        window.location.href = '/login.html?redirect=/solicitudes.html';
        return;
    }

    // Load Navigation
    const navPlaceholder = document.getElementById('navbar-placeholder');
    if (navPlaceholder && window.loadNavbar) {
        window.loadNavbar();
    }

    // Sidebar Info
    if (currentUser) {
        document.getElementById('sidebarName').textContent = currentUser.display_name || currentUser.username || 'Usuario';
        document.getElementById('sidebarAvatar').textContent = (currentUser.display_name || currentUser.username || 'U').charAt(0).toUpperCase();

        const avatarUrl = currentUser.avatar_url || currentUser.user_metadata?.avatar_url;
        if (avatarUrl) {
            document.getElementById('sidebarAvatar').innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%; height:100%; object-fit:cover;">`;
        }

        const role = currentUser.role || currentUser.user_metadata?.role || 'buyer';
        document.getElementById('sidebarRole').textContent = role === 'producer' ? 'Productor' : 'Artista / Fan';

        if (role === 'producer') {
            document.getElementById('producerTab').style.display = 'block';
        }
    }

    // Tabs logic
    const tabs = document.querySelectorAll('.role-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.role-section').forEach(s => s.classList.remove('active'));

            tab.classList.add('active');
            const target = tab.getAttribute('data-tab');
            document.getElementById(`section-${target}`).classList.add('active');
            currentRole = target;
            loadRequests(target);
        });
    });

    // Load initial
    loadRequests('buyer');

    // Modal listeners
    document.getElementById('closeRespondModal').addEventListener('click', () => {
        document.getElementById('respondModal').style.display = 'none';
        if (wsResponse) {
            wsResponse.destroy();
            wsResponse = null;
        }
        document.getElementById('waveform-container').style.display = 'none';
        document.getElementById('audioUploadInput').value = '';
        currentUploadFile = null;
        document.getElementById('btnSubmitResponse').style.display = 'none';
        document.getElementById('uploadFileName').textContent = '';
    });

    document.getElementById('audioUploadInput').addEventListener('change', handleAudioUpload);

    document.getElementById('btnPlayPreviewAudio').addEventListener('click', () => {
        if (wsResponse) {
            if (wsResponse.isPlaying()) {
                wsResponse.pause();
                document.getElementById('btnPlayPreviewAudio').innerHTML = '<i class="bi bi-play-fill"></i>';
            } else {
                if (wsRegion) {
                    wsRegion.play();
                } else {
                    wsResponse.play();
                }
                document.getElementById('btnPlayPreviewAudio').innerHTML = '<i class="bi bi-pause-fill"></i>';
            }
        }
    });

    document.getElementById('btnSubmitResponse').addEventListener('click', submitResponse);
});

async function loadRequests(type) {
    const container = document.getElementById(`${type}-requests-container`);
    container.innerHTML = '<div style="text-align: center; color: #666; padding: 40px 0;"><i class="bi bi-arrow-repeat spin"></i> Cargando...</div>';

    try {
        const token = localStorage.getItem('offszn_token');
        const res = await fetch(`/api/custom-requests?type=${type}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) throw new Error('Error fetching requests');

        const { requests } = await res.json();

        if (!requests || requests.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #666; padding: 40px 0;">No tienes solicitudes en esta sección.</div>`;
            return;
        }

        container.innerHTML = '';
        requests.forEach(req => {
            container.appendChild(createRequestCard(req, type));
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="text-align: center; color: #f44336; padding: 40px 0;">Error al cargar las solicitudes.</div>`;
    }
}

function createRequestCard(req, viewType) {
    const card = document.createElement('div');
    card.className = 'request-card';

    const isPending = req.status === 'pending';
    const isResponded = req.status === 'responded';
    const isExpired = req.status === 'expired' || (req.expires_at && new Date(req.expires_at) < new Date());

    let statusHtml = '';
    if (isExpired) {
        statusHtml = `<span class="request-status status-expired">Expirada</span>`;
    } else if (isPending) {
        statusHtml = `<span class="request-status status-pending">Pendiente</span>`;
    } else if (isResponded) {
        statusHtml = `<span class="request-status status-responded">Respondida</span>`;
    }

    const otherParty = viewType === 'buyer' ? req.producer : req.buyer;
    const otherName = otherParty ? (otherParty.display_name || otherParty.username) : 'Usuario desconocido';

    let actionHtml = '';

    if (viewType === 'producer' && isPending && !isExpired) {
        actionHtml = `<button class="btn-primary-sm btn-respond" data-id="${req.id}" data-name="${otherName}" style="margin-top: 15px;"><i class="bi bi-reply"></i> Enviar Preview (30s)</button>`;
    } else if (viewType === 'buyer' && isResponded && !isExpired) {
        actionHtml = `
            <div style="margin-top: 15px; background: rgba(255,255,255,0.02); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                    <span style="font-size: 0.9rem; font-weight: 600;"><i class="bi bi-play-circle"></i> Preview del Productor</span>
                    <span style="font-size: 0.8rem; color: #00d3de;">Expira en: <span class="countdown" data-expires="${req.expires_at}">Calculando...</span></span>
                </div>
                <audio controls src="${req.preview_url}" style="width: 100%; height: 40px; margin-bottom: 15px;"></audio>
                <div style="display: flex; gap: 10px;">
                    <button class="offszn-btn-primary" style="flex: 1;" onclick="window.location.href='/pages/checkout.html?custom=${req.id}'">Comprar Licencia Completa</button>
                </div>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="request-header">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    ${otherParty && otherParty.avatar_url ? `<img src="${otherParty.avatar_url}" style="width:100%; height:100%; object-fit:cover;">` : `<i class="bi bi-person" style="color:#aaa;"></i>`}
                </div>
                <div>
                    <div style="font-weight: 700; font-size: 1rem;">${viewType === 'buyer' ? 'Para: ' : 'De: '}${otherName}</div>
                    <div style="font-size: 0.8rem; color: #888;">${new Date(req.created_at).toLocaleDateString()}</div>
                </div>
            </div>
            ${statusHtml}
        </div>
        <div style="font-size: 0.95rem; color: #ddd; margin-bottom: 10px; line-height: 1.5;">
            <strong>Descripción:</strong><br>
            ${req.description.replace(/\\n/g, '<br>')}
        </div>
        ${req.budget ? `<div style="font-size: 0.9rem; color: #aaa; margin-bottom: 15px;"><strong>Presupuesto:</strong> $${req.budget} USD</div>` : ''}
        ${actionHtml}
    `;

    if (viewType === 'producer' && isPending && !isExpired) {
        card.querySelector('.btn-respond').addEventListener('click', (e) => {
            const btn = e.currentTarget;
            document.getElementById('respondRequestId').value = btn.getAttribute('data-id');
            document.getElementById('respondBuyerName').textContent = btn.getAttribute('data-name');
            document.getElementById('respondModal').style.display = 'flex';
        });
    }

    return card;
}

// ---------------------------------------------------------
// Producer Upload & WaveSurfer Logic
// ---------------------------------------------------------

async function handleAudioUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    currentUploadFile = file;
    document.getElementById('uploadFileName').textContent = file.name;
    document.getElementById('waveform-container').style.display = 'block';

    // Initialize Wavesurfer
    const container = document.getElementById('waveform');
    container.innerHTML = '';

    if (wsResponse) {
        wsResponse.destroy();
    }

    wsResponse = WaveSurfer.create({
        container: '#waveform',
        waveColor: 'rgba(255, 255, 255, 0.2)',
        progressColor: '#00d3de',
        cursorColor: '#fff',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 80,
        normalize: true,
    });

    const wsRegions = wsResponse.registerPlugin(WaveSurfer.Regions.create());

    wsResponse.on('ready', () => {
        const duration = wsResponse.getDuration();
        const start = 0;
        const end = Math.min(30, duration); // Max 30 seconds

        wsRegion = wsRegions.addRegion({
            start: start,
            end: end,
            color: 'rgba(0, 211, 222, 0.3)',
            resize: true,
            drag: true,
            minLength: 1,
            maxLength: 30
        });

        updateDurationDisplay();

        wsRegion.on('update', () => {
            // Enforce max 30s
            if (wsRegion.end - wsRegion.start > 30) {
                wsRegion.end = wsRegion.start + 30;
            }
            updateDurationDisplay();
        });

        document.getElementById('btnSubmitResponse').style.display = 'block';
        document.getElementById('btnSubmitResponse').disabled = false;
    });

    // Load audio from file
    const objectUrl = URL.createObjectURL(file);
    wsResponse.load(objectUrl);
}

function updateDurationDisplay() {
    if (!wsRegion) return;
    const dur = (wsRegion.end - wsRegion.start).toFixed(1);
    document.getElementById('selectionDuration').textContent = `${dur}s`;
}

// ---------------------------------------------------------
// Slice Audio Client-Side and Submit
// ---------------------------------------------------------

async function submitResponse() {
    if (!currentUploadFile || !wsRegion) return;

    const btn = document.getElementById('btnSubmitResponse');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Procesando Audio (Cortando 30s)...';
    btn.disabled = true;

    try {
        const requestId = document.getElementById('respondRequestId').value;
        const token = localStorage.getItem('offszn_token');

        // 1. Slice audio using OfflineAudioContext to WAV
        const slicedBlob = await sliceAudioBuffer(currentUploadFile, wsRegion.start, wsRegion.end);

        btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Subiendo a la nube...';

        // 2. Get Presigned URL
        const fileName = `previews/custom_${requestId}_${Date.now()}.wav`;
        const presignedRes = await fetch(`/api/r2/presigned-url?fileName=${encodeURIComponent(fileName)}&fileType=audio/wav`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!presignedRes.ok) throw new Error('Error getting upload url');
        const { uploadUrl, publicUrl } = await presignedRes.json();

        // 3. Upload to R2
        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            body: slicedBlob,
            headers: { 'Content-Type': 'audio/wav' }
        });

        if (!uploadRes.ok) throw new Error('Error uploading to R2');

        btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Notificando al artista...';

        // 4. Send response to backend
        const respondReq = await fetch(`/api/custom-requests/${requestId}/respond`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ previewUrl: publicUrl })
        });

        if (!respondReq.ok) throw new Error('Error respondiendo la solicitud');

        alert('¡Respuesta enviada exitosamente!');
        document.getElementById('respondModal').style.display = 'none';
        loadRequests('producer');

    } catch (err) {
        console.error(err);
        alert('Ocurrió un error: ' + err.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function sliceAudioBuffer(file, startTime, endTime) {
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const channels = audioBuffer.numberOfChannels;
    const rate = audioBuffer.sampleRate;
    const startOffset = Math.floor(rate * startTime);
    const endOffset = Math.floor(rate * endTime);
    const frameCount = endOffset - startOffset;

    const offlineCtx = new OfflineAudioContext(channels, frameCount, rate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);

    source.start(0, startTime, endTime - startTime);
    const renderedBuffer = await offlineCtx.startRendering();

    // Convert AudioBuffer to WAV blob
    return bufferToWave(renderedBuffer, frameCount);
}

// Helper: AudioBuffer to WAV format
function bufferToWave(abuffer, len) {
    const numOfChan = abuffer.numberOfChannels;
    const length = len * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i, sample, offset = 0, pos = 0;

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this implementation)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (i = 0; i < abuffer.numberOfChannels; i++) {
        channels.push(abuffer.getChannelData(i));
    }

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
            view.setInt16(pos, sample, true); // write 16-bit sample
            pos += 2;
        }
        offset++;
    }

    return new Blob([buffer], { type: "audio/wav" });

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}

// Countdown timer interval
setInterval(() => {
    document.querySelectorAll('.countdown').forEach(el => {
        const expiresAt = el.getAttribute('data-expires');
        if (!expiresAt) return;

        const now = new Date().getTime();
        const expirationTime = new Date(expiresAt).getTime();
        const distance = expirationTime - now;

        if (distance < 0) {
            el.innerHTML = "EXPIRADA";
            el.style.color = "#f44336";
        } else {
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            el.innerHTML = `${hours}h ${minutes}m ${seconds}s`;
        }
    });
}, 1000);
