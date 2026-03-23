/**
 * OFFSZN Download Gate
 * Centralized logic for free product downloads and follow-to-download gate.
 */

window.closeDownloadGateModal = function () {
    const backdrop = document.getElementById('gate-modal-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        setTimeout(() => backdrop.style.display = 'none', 300);
    }
}

window.openDownloadGateModal = function (url, producerName, productId) {
    const product = window.currentProductData;
    const producerId = product?.producer_id;
    const currentUserId = window.currentUserId;

    // Check if already following or if it's the owner
    const isOwner = currentUserId && producerId && currentUserId === producerId;
    const isFollowing = window.currentUserFollowing && window.currentUserFollowing.has(producerId);

    const isAlreadyConnected = isOwner || isFollowing;

    // --- GUEST HANDLING ---
    if (!currentUserId) {
        const isFree = product?.is_free || false;
        let backdrop = document.getElementById('gate-modal-backdrop');

        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'gate-modal-backdrop';
            backdrop.className = 'share-modal-backdrop';
            backdrop.onclick = (e) => { if (e.target === backdrop) window.closeDownloadGateModal(); };
            document.body.appendChild(backdrop);
        }

        if (isFree) {
            // Guest is allowed to download free items!
            backdrop.innerHTML = `
                <div class="share-modal-content" style="background: rgba(10, 10, 10, 0.8) !important; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 28px; padding: 35px; width: 380px;">
                    <button onclick="closeDownloadGateModal()" style="position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.05); border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><i class="bi bi-x" style="font-size: 1.4rem;"></i></button>
                    
                    <div style="text-align: center; margin-bottom: 25px;">
                        <div style="width: 60px; height: 60px; background: rgba(139, 92, 246, 0.1); color: #8b5cf6; border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; font-size: 1.8rem;">
                            <i class="bi bi-cloud-download"></i>
                        </div>
                        <h3 style="color:#fff; margin:0 0 8px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 1.4rem; font-weight: 700; letter-spacing: -0.5px;">Descarga para invitados</h3>
                        <p style="color:#888; font-size:0.9rem; line-height:1.5; margin: 0; font-weight: 400;">
                            Crea una cuenta luego para guardar este item permanentemente en tu librería.
                        </p>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button id="btn-gate-action" class="btn-glass-primary" style="width:100% !important; border-radius:14px; padding:16px; font-weight: 700; font-size: 0.95rem; background: #fff !important; color: #000 !important; border: none !important; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.2s;">
                            <i class="bi bi-download" style="font-size: 1.1rem;"></i> DESCARGAR AHORA
                        </button>
                        
                        <button id="btn-gate-login" style="width:100%; height: 50px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; color: #aaa; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.06)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.03)'; this.style.color='#aaa';">
                            <i class="bi bi-person-plus-fill" style="margin-right: 6px; color: #8b5cf6;"></i> Registrarse y guardar
                        </button>
                    </div>
                </div>
            `;

            const actionBtn = document.getElementById('btn-gate-action');
            if (actionBtn) {
                actionBtn.onclick = () => completeGate(url, productId);
            }
        } else {
            // Paid item or restricted (shouldn't really hit here if it's a "download gate" for free items)
            backdrop.innerHTML = `
                <div class="share-modal-content">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                         <h3 style="color:#fff; margin:0;">Inicia Sesión</h3>
                         <button onclick="closeDownloadGateModal()" style="background:none; border:none; color:#666; font-size:1.5rem; cursor:pointer;"><i class="bi bi-x"></i></button>
                    </div>
                    <p style="color:#ccc; font-size:1rem; margin-bottom:20px; line-height:1.5;">
                        Para acceder a este contenido y guardarlo en tu librería, necesitas una cuenta en OFFSZN.
                    </p>
                    <button id="btn-gate-login" class="btn-glass-primary" style="width:100%; border-radius:30px; padding:12px; margin-top:10px;">
                        <i class="bi bi-person-plus-fill"></i> INICIAR SESIÓN / REGISTRARSE
                    </button>
                    <button onclick="closeDownloadGateModal()" class="btn-minimal-link" style="width:100%; justify-content:center; margin-top:15px;">
                        Quizás luego
                    </button>
                </div>
            `;
        }

        const loginBtn = document.getElementById('btn-gate-login');
        if (loginBtn) {
            loginBtn.onclick = () => {
                localStorage.setItem('offszn_pending_download', window.location.href);
                window.location.href = '/pages/login.html';
            };
        }

        backdrop.style.display = 'flex';
        setTimeout(() => backdrop.classList.add('active'), 10);
        return;
    }

    let backdrop = document.getElementById('gate-modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'gate-modal-backdrop';
        backdrop.className = 'share-modal-backdrop';

        backdrop.onclick = function (e) {
            if (e.target === backdrop) window.closeDownloadGateModal();
        };

        backdrop.innerHTML = `
            <div class="share-modal-content">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                     <h3 style="color:#fff; margin:0;">Descarga Gratuita</h3>
                     <button onclick="closeDownloadGateModal()" style="background:none; border:none; color:#666; font-size:1.5rem; cursor:pointer;"><i class="bi bi-x"></i></button>
                </div>
                <p id="gate-message" style="color:#ccc; font-size:1rem; margin-bottom:20px; line-height:1.5;"></p>
                
                <button id="btn-gate-action" class="btn-glass-primary" style="width:100%; border-radius:30px; padding:12px; margin-top:10px;">
                    <i id="gate-action-icon" class="bi"></i> <span id="gate-action-text"></span>
                </button>
                <button onclick="closeDownloadGateModal()" class="btn-minimal-link" style="width:100%; justify-content:center; margin-top:15px;">
                    Cancelar
                </button>
            </div>
        `;
        document.body.appendChild(backdrop);
    } else {
        // Reset to standard download content if it was guest content before
        backdrop.querySelector('.share-modal-content').innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                     <h3 style="color:#fff; margin:0;">Descarga Gratuita</h3>
                     <button onclick="closeDownloadGateModal()" style="background:none; border:none; color:#666; font-size:1.5rem; cursor:pointer;"><i class="bi bi-x"></i></button>
                </div>
                <p id="gate-message" style="color:#ccc; font-size:1rem; margin-bottom:20px; line-height:1.5;"></p>
                
                <button id="btn-gate-action" class="btn-glass-primary" style="width:100%; border-radius:30px; padding:12px; margin-top:10px;">
                    <i id="gate-action-icon" class="bi"></i> <span id="gate-action-text"></span>
                </button>
                <button onclick="closeDownloadGateModal()" class="btn-minimal-link" style="width:100%; justify-content:center; margin-top:15px;">
                    Cancelar
                </button>
         `;
    }

    // Dynamic UI Update
    const msgEl = document.getElementById('gate-message');
    const actionTextEl = document.getElementById('gate-action-text');
    const actionIconEl = document.getElementById('gate-action-icon');

    if (isAlreadyConnected) {
        msgEl.innerHTML = `¡Gracias por tu apoyo! Ya sigues a <b>${producerName || 'Productor'}</b>.`;
        actionTextEl.innerText = 'DESCARGAR AHORA';
        actionIconEl.className = 'bi bi-download';
    } else {
        msgEl.innerHTML = `Para descargar este kit, sigue a <b>${producerName || 'Productor'}</b>.`;
        actionTextEl.innerText = 'SEGUIR & DESCARGAR';
        actionIconEl.className = 'bi bi-person-plus-fill';
    }

    const actionBtn = document.getElementById('btn-gate-action');
    if (actionBtn) {
        actionBtn.onclick = () => completeGate(url, productId);
    }

    backdrop.style.display = 'flex';
    setTimeout(() => backdrop.classList.add('active'), 10);
}

window.completeGate = async function (url, productId) {
    const btn = document.getElementById('btn-gate-action');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px; height:20px; border-width:2px; margin:0 auto;"></div>';

    try {
        const product = window.currentProductData;
        let producerObj = product?.producer;
        if (Array.isArray(producerObj)) producerObj = producerObj[0]; // Robustness fix

        const producerId = producerObj?.id;
        const producerEmail = producerObj?.email;
        const currentUserId = window.currentUserId;

        // 1. Follow Logic (Only if logged in and not owner and not already following)
        if (currentUserId && producerId && currentUserId !== producerId) {
            // Check if already following via window.currentUserFollowing set (if available)
            const isFollowing = window.currentUserFollowing && window.currentUserFollowing.has(producerId);

            if (!isFollowing) {
                console.log("[Gate] Auto-following producer...");
                const response = await fetch(`/api/users/${producerId}/follow`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                });

                if (response.ok) {
                    if (window.currentUserFollowing) window.currentUserFollowing.add(producerId);
                    console.log("[Gate] Follow successful.");
                } else {
                    console.warn("[Gate] Follow failed, but proceeding to download.");
                }
            }
        } else {
            console.log("[Gate] Guest, Owner or local check passed, skipping follow.");
        }

        // 2. Dashboard Persistence ($0 Order) - Only if logged in
        if (currentUserId && productId && productId !== 'undefined') {
            console.log("[Gate] Recording free download in dashboard...");
            fetch('/api/orders/free', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ productId: productId })
            }).then(r => r.json()).then(data => console.log("[Gate] Dashboard sync:", data))
                .catch(err => console.error("[Gate] Dashboard sync error:", err));
        }

        // 3. EmailJS Notification (Consolidated/Hybrid) - Only if logged in or we have info
        if (typeof emailjs !== 'undefined' && producerId && currentUserId && currentUserId !== producerId) {
            // A. Notify Producer (Template Producer)
            const producerParams = {
                activity_type: 'Descarga Gratuita',
                to_name: producerObj?.nickname || 'Productor',
                to_email: producerEmail || '',
                product_name: product?.name || 'Sonido',
                downloader_name: window.currentUserNickname || window.currentUserData?.nickname || 'Un invitado',
                amount: 'Gratis'
            };

            emailjs.send('service_w50l62y', 'template_bgp3zb5', producerParams, 'If_WAVcuXiGSPp2SB')
                .then(() => console.log("[Gate] Producer notification sent."))
                .catch(err => console.error("[Gate] Producer Email error:", err));

            // B. Notify Client (Template Client Receipt - Only if user has email)
            const clientEmail = window.currentUserData?.email;
            if (clientEmail) {
                const clientParams = {
                    downloader_name: window.currentUserNickname || window.currentUserData?.nickname || 'Usuario',
                    to_email: clientEmail,
                    product_name: product?.name || 'Sonido',
                    activity_type: 'descarga gratuita',
                    download_url: url
                };
                // Assuming template_client_receipt exists
                emailjs.send('service_w50l62y', 'template_client_receipt', clientParams, 'If_WAVcuXiGSPp2SB')
                    .then(() => console.log("[Gate] Client confirmation sent."))
                    .catch(err => console.warn("[Gate] Client Email skipped/failed (Template might not exist yet)."));
            }
        }

        // 4. Download Trigger (Direct)
        setTimeout(async () => {
            try {

                // R2 Key Resolution (If url doesn't start with blob or data)
                let finalUrl = url;
                if (url && !url.startsWith('blob:') && !url.startsWith('data:')) {
                    // Si es una URL de R2 directa (cloudflarestorage), o si es un path relativo
                    if (!url.startsWith('http') || url.includes('cloudflarestorage.com') || url.includes('r2.dev')) {
                        console.log("[Gate] Detected R2/Storage Key or R2 URL. Resolving...", url);
                        try {
                            const token = localStorage.getItem('authToken'); // Need auth for R2 signing
                            const headers = { 'Content-Type': 'application/json' };
                            if (token) headers['Authorization'] = `Bearer ${token}`;

                            const versionToUse = window.currentProductData?.storage_version || window.currentProductData?.r2_version || 'v1';
                            const currentProductId = window.currentProductData?.id || productId;
                            const res = await fetch('/api/r2/download-url', {
                                method: 'POST',
                                headers: headers,
                                body: JSON.stringify({ key: url, version: versionToUse, productId: currentProductId })
                            });

                            if (res.ok) {
                                const data = await res.json();
                                if (data.downloadUrl) {
                                    finalUrl = data.downloadUrl;
                                    console.log("[Gate] Resolved URL:", finalUrl);
                                }
                            } else {
                                console.warn("[Gate] Failed to resolve R2 key. Status:", res.status);
                            }
                        } catch (r2Err) {
                            console.error("[Gate] R2 Resolution Error:", r2Err);
                        }
                    }
                } // <-- Added closing brace for the outer if block

                console.log("[Gate] Starting direct download via link click...");
                const a = document.createElement('a');
                a.href = finalUrl;
                // We use standard download behavior. Cross-origin relies on Content-Disposition header.
                const fileName = url.split('/').pop().split('?')[0] || 'descarga-offszn.mp3';
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                
                setTimeout(() => {
                    document.body.removeChild(a);
                }, 200);

            } catch (downloadErr) {
                console.warn("[Gate] Direct link click failed, falling back to simple trigger", downloadErr);
                const a = document.createElement('a');
                a.href = typeof finalUrl !== 'undefined' ? finalUrl : url;
                a.target = '_blank';
                a.download = '';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }

            window.closeDownloadGateModal();
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }, 800);

    } catch (e) {
        console.error("[Gate] Critical error:", e);
        window.open(url, '_blank'); // Fail open for the user
        window.closeDownloadGateModal();
    }
}
