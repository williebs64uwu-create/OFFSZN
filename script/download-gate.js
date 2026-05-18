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
window.downloadGateProductRegistry = window.downloadGateProductRegistry || new Map();

window.openDownloadGateModal = function (url, producerName, productId, productData = null) {
    const product = productData || (productId && window.downloadGateProductRegistry ? window.downloadGateProductRegistry.get(String(productId)) : null) || window.currentProductData;
    let producerId = product?.producer_id;
    if (!producerId && product?.producer) {
        producerId = Array.isArray(product.producer) ? product.producer[0]?.id : product.producer?.id;
    }
    if (!producerId && product?.user_id) {
        producerId = product.user_id;
    }
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
                <div class="share-modal-content" style="background: rgba(10, 10, 10, 0.8) !important; backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 32px; padding: 40px; width: 400px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
                    <button onclick="closeDownloadGateModal()" style="position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.05); border: none; color: #fff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'"><i class="bi bi-x" style="font-size: 1.5rem;"></i></button>
                    
                    <div style="text-align: center; margin-bottom: 25px;">
                        <div style="width: 70px; height: 70px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.05)); color: #a78bfa; border-radius: 22px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 2rem; border: 1px solid rgba(139, 92, 246, 0.2);">
                            <i class="bi bi-cloud-download"></i>
                        </div>
                        <h3 style="color:#fff; margin:0 0 10px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.5px;">¡Descárgalo ahora!</h3>
                        <p style="color:#a1a1aa; font-size:0.95rem; line-height:1.6; margin: 0; font-weight: 400;">
                            Ingresa tu correo para recibir el enlace y guardar tus kits.
                        </p>
                    </div>

                    <div style="margin-bottom: 25px;">
                        <div style="position: relative;">
                            <input type="email" id="gate-guest-email" placeholder="tu@email.com" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 16px 16px 16px 45px; color: #fff; font-size: 0.95rem; outline: none; transition: all 0.2s; box-sizing: border-box;">
                            <i class="bi bi-envelope" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #666; font-size: 1.1rem;"></i>
                        </div>
                        <div id="gate-email-error" style="color: #ef4444; font-size: 0.75rem; margin-top: 8px; display: none; padding-left: 5px;">Por favor ingresa un correo real (ej: Gmail, iCloud)</div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button id="btn-gate-action" disabled style="width:100%; border-radius:16px; padding:18px; font-weight: 700; font-size: 1rem; background: #fff; color: #000; border: none; display: flex; align-items: center; justify-content: center; gap: 12px; transition: all 0.2s; cursor: not-allowed; opacity: 0.5;">
                            <i class="bi bi-download"></i> DESCARGAR AHORA
                        </button>
                    </div>
                </div>
            `;

            const emailInput = document.getElementById('gate-guest-email');
            const actionBtn = document.getElementById('btn-gate-action');
            const errorText = document.getElementById('gate-email-error');

            const validateEmail = (email) => {
                const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!re.test(email)) return false;

                // Real provider check (requested: gmail, icloud, etc)
                const realProviders = ['gmail.com', 'icloud.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'live.com', 'me.com', 'msn.com', 'protonmail.com'];
                const domain = email.split('@')[1]?.toLowerCase();
                return realProviders.includes(domain) || domain.includes('.edu') || domain.includes('.org');
            };

            emailInput.oninput = (e) => {
                const isValid = validateEmail(e.target.value);
                if (isValid) {
                    actionBtn.disabled = false;
                    actionBtn.style.opacity = '1';
                    actionBtn.style.cursor = 'pointer';
                    emailInput.style.borderColor = 'rgba(139, 92, 246, 0.5)';
                    errorText.style.display = 'none';
                } else {
                    actionBtn.disabled = true;
                    actionBtn.style.opacity = '0.5';
                    actionBtn.style.cursor = 'not-allowed';
                    emailInput.style.borderColor = 'rgba(255,255,255,0.1)';
                    if (e.target.value.length > 5) errorText.style.display = 'block';
                }
            };

            if (actionBtn) {
                actionBtn.onclick = () => {
                    const emailValue = emailInput.value;
                    completeGate(url, productId, emailValue, product);
                };
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
        actionBtn.onclick = () => completeGate(url, productId, null, product);
    }

    backdrop.style.display = 'flex';
    setTimeout(() => backdrop.classList.add('active'), 10);
}

window.completeGate = async function (url, productId, guestEmail = null, productData = null) {
    const btn = document.getElementById('btn-gate-action');
    const originalHTML = btn.innerHTML;

    // 1. Prevenir múltiples clics
    if (btn.disabled) return;

    // Validación temprana para evitar crasheos si el beat no tiene archivo
    if (!url || url === 'null' || url === 'undefined') {
        console.error("[Gate] Download failed: URL is missing or null.");
        if (typeof showEliteToast === 'function') {
            showEliteToast("Este beat aún no tiene un archivo de audio disponible para descarga.", "error");
        } else if (typeof notify === 'function') {
            notify("Este beat aún no tiene un archivo de audio disponible para descarga.", "error");
        } else {
            alert("Este beat no tiene archivo disponible.");
        }
        window.closeDownloadGateModal();
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px; height:20px; border-width:2px; margin:0 auto;"></div>';

    try {
        const product = productData || (productId && window.downloadGateProductRegistry ? window.downloadGateProductRegistry.get(String(productId)) : null) || window.currentProductData;
        let producerId = product?.producer_id;
        if (!producerId && product?.producer) {
            producerId = Array.isArray(product.producer) ? product.producer[0]?.id : product.producer?.id;
        }
        if (!producerId && product?.user_id) {
            producerId = product.user_id;
        }
        const currentUserId = window.currentUserId;

        // 2. Registro de Invitado (AWAIT para asegurar concurrencia)
        if (!currentUserId && guestEmail) {
            console.log("[Gate] Recording guest email download...");
            try {
                await fetch('/api/orders/free-guest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId: productId, guestEmail: guestEmail })
                });
            } catch (err) {
                console.warn("[Gate] Guest sync failed (non-blocking):", err);
            }
        }

        // 3. Lógica de Follow (Solo si está logueado)
        if (currentUserId && producerId && currentUserId !== producerId) {
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
                if (response.ok && window.currentUserFollowing) window.currentUserFollowing.add(producerId);
            }
        }

        // 4. Record en Dashboard ($0 Order) - Solo si está logueado
        if (currentUserId && productId && productId !== 'undefined') {
            console.log("[Gate] Recording free download in dashboard...");
            try {
                await fetch('/api/orders/free', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify({ productId: productId })
                });
            } catch (e) {
                console.warn("[Gate] Dashboard sync failed:", e);
            }
        }

        // 5. Resolución de URL de descarga (R2)
        let finalUrl = url;
        if (url && !url.startsWith('blob:') && !url.startsWith('data:')) {
            if (!url.startsWith('http') || url.includes('cloudflarestorage.com') || url.includes('r2.dev')) {
                console.log("[Gate] Resolving R2 URL...", url);
                try {
                    const token = localStorage.getItem('authToken');
                    const headers = { 'Content-Type': 'application/json' };
                    if (token) headers['Authorization'] = `Bearer ${token}`;

                    const versionToUse = product?.storage_version || product?.r2_version || 'v2';
                    const res = await fetch('/api/r2/download-url', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({ key: url, version: versionToUse, productId: productId })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        if (data.downloadUrl) finalUrl = data.downloadUrl;
                    }
                } catch (r2Err) {
                    console.error("[Gate] R2 Resolution Error:", r2Err);
                }
            }
        }

        // 6. Activar descarga
        console.log("[Gate] Triggering download...");
        const a = document.createElement('a');
        a.href = finalUrl;
        try {
            const ext = (typeof finalUrl === 'string' && finalUrl.split('?')[0].includes('.')) ? finalUrl.split('?')[0].split('.').pop() : 'mp3';
            a.download = typeof finalUrl === 'string' ? finalUrl.split('/').pop().split('?')[0] : `descarga-offszn.${ext}`;
        } catch (e) {
            a.download = 'descarga-offszn';
        }
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();

        setTimeout(() => document.body.removeChild(a), 200);

    } catch (e) {
        console.error("[Gate] Critical error:", e);
        // Fallback: intentar abrir en nueva pestaña
        window.open(url, '_blank');
    } finally {
        // SIEMPRE cerrar el modal y restaurar el botón
        setTimeout(() => {
            window.closeDownloadGateModal();
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }, 500);
    }
}
