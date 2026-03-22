/**
 * Global Onboarding Widget
 * Shows a floating checklist for users who haven't completed their profile 100%.
 */

async function initOnboardingWidget() {
    // 0. Mobile hide
    if (window.innerWidth < 768) {
        const existing = document.getElementById('offszn-onb-widget');
        if (existing) existing.remove();
        return;
    }

    // 1. Wait for Supabase to be initialized
    const maxRetries = 50;
    let retries = 0;
    while (!window.supabaseClient && retries < maxRetries) {
        await new Promise(r => setTimeout(r, 100));
        retries++;
    }
    if (!window.supabaseClient) return;

    // 1. Check if we are on the welcome page or login/register
    const currentPath = window.location.pathname;
    if (currentPath.includes('welcome') || currentPath.includes('login') || currentPath.includes('register')) {
        return;
    }

    // 2. Auth Check Session
    const { data: sessionData } = await window.supabaseClient.auth.getSession();
    if (!sessionData || !sessionData.session) return; // Not logged in

    const userId = sessionData.session.user.id;

    // 3. Fetch User Profile
    const { data: profile, error } = await window.supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('❌ Onboarding widget: Error fetching profile:', error);
        return;
    }
    if (!profile) return;

    // 4. Handle Pending Referral Tracking
    const pendingRef = localStorage.getItem('offszn_referral_code');
    if (pendingRef) {
        try {
            // Find referrer by code
            const { data: referrer, error: refError } = await window.supabaseClient
                .from('users')
                .select('id')
                .eq('referral_code', pendingRef)
                .single();
            
            if (referrer && referrer.id !== userId) {
                // Link current user to referrer
                const { error: insertError } = await window.supabaseClient
                    .from('referrals')
                    .insert([{
                        referrer_id: referrer.id,
                        referred_user_id: userId,
                        status: 'pending'
                    }]);
                
                if (!insertError) {
                    localStorage.removeItem('offszn_referral_code');
                } else if (insertError.code === '23505') {
                    // Already referred by someone else or already exists
                    localStorage.removeItem('offszn_referral_code');
                }
            } else {
                // Self-referral or invalid code
                localStorage.removeItem('offszn_referral_code');
            }
        } catch (e) { /* silent */ }
    }

    // 5. Fetch Products Count (For Upload Task)
    const { count: productCount } = await window.supabaseClient
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('producer_id', userId);

    // 5. Fetch Referral Count
    const { count: referralCount } = await window.supabaseClient
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', userId)
        .eq('status', 'verified');

    // 6. Calculate Completion
    const tasks = [
        { 
            id: 'avatar', 
            title: 'Añadir foto de perfil', 
            completed: !!(profile.avatar_url && !profile.avatar_url.includes('googleusercontent.com') && !profile.avatar_url.includes('ui-avatars.com')), 
            link: '/perfilpro.html', 
            weight: 20 
        },
        { 
            id: 'paypal', 
            title: 'Configurar Paypal para pagos', 
            completed: !!profile.paypal_email, 
            link: '/transacciones.html', 
            weight: 20 
        },
        { 
            id: 'firstBeat', 
            title: 'Sube tu primer beat o kit', 
            completed: (productCount > 0), 
            link: '/cuenta/subir-kit.html', 
            weight: 20 
        },
        { 
            id: 'referral', 
            title: 'Invita a tus amigos', 
            completed: (referralCount >= 30),
            modal: 'referral',
            link: '#', 
            weight: 20 
        },
        { 
            id: 'proPlan', 
            title: 'Consigue más ventas con plan pro', 
            completed: (profile.plan_id === 'pro'), 
            link: '/cuenta/planes.html', 
            weight: 20 
        }
    ];

    const completedWeight = tasks.filter(t => t.completed).reduce((sum, t) => sum + t.weight, 0);

    if (completedWeight >= 100) {
        const existing = document.getElementById('offszn-onb-widget');
        if (existing) existing.remove();
        return;
    }

    // 7. Render Widget
    renderWidget(tasks, completedWeight, profile, { productCount, referralCount });
}

// Expose globally
window.refreshOnboardingWidget = initOnboardingWidget;

// Initial Call
initOnboardingWidget();

// Window Resize Handling
window.addEventListener('resize', () => {
    initOnboardingWidget();
});

function renderWidget(tasks, progress, profile, stats) {
    let container = document.getElementById('offszn-onb-widget');
    const wasActive = document.getElementById('onbModal')?.classList.contains('active');

    // If already exists, just update content to avoid flickering/re-injecting CSS
    if (container) {
        updateWidgetContent(tasks, progress, profile, stats, wasActive);
        return;
    }

    // Inject CSS
    if (!document.getElementById('offszn-onboarding-css')) {
        const style = document.createElement('style');
        style.id = 'offszn-onboarding-css';
        style.textContent = `
            .onb-widget-container {
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 99999;
                font-family: 'Inter', sans-serif;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 12px;
            }
            .onb-toggle-btn {
                background: #fff;
                color: #000;
                border-radius: 50px;
                padding: 10px 18px;
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                font-weight: 700;
                font-size: 0.85rem;
                transition: transform 0.2s, background 0.2s;
                border: 1px solid rgba(255,255,255,0.1);
            }
            .onb-toggle-btn:hover {
                transform: scale(1.03);
                background: #f4f4f5;
            }
            .onb-progress-circle {
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: conic-gradient(#000 var(--progress, 0%), #e5e5e5 var(--progress, 0%) 100%);
                display:flex;
                align-items:center;
                justify-content:center;
            }
            .onb-progress-inner {
                width: 16px;
                height: 16px;
                background: #fff;
                border-radius: 50%;
            }
            .onb-modal {
                width: 340px;
                background: #121214;
                border: 1px solid #1f1f23;
                border-radius: 20px;
                padding: 24px;
                color: #fff;
                box-shadow: 0 20px 50px rgba(0,0,0,0.9);
                display: none;
                flex-direction: column;
                gap: 16px;
                transform-origin: bottom right;
                animation: slideUpFade 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .onb-modal.active {
                display: flex;
            }
            @keyframes slideUpFade {
                from { opacity: 0; transform: translateY(20px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .onb-header {
                display:flex; justify-content:space-between; align-items:flex-start;
            }
            .onb-title {
                font-size: 1.1rem; font-weight: 800; margin:0 0 4px 0; letter-spacing:-0.5px;
            }
            .onb-subtitle {
                font-size: 0.8rem; color: #a1a1aa; margin:0;
            }
            .onb-close {
                background:none; border:none; color:#a1a1aa; cursor:pointer; font-size:1.4rem; padding:0; line-height:1;
            }
            .onb-close:hover { color:#fff; }
            .onb-task {
                display:flex; align-items:center; gap:12px; padding:12px 14px; background: rgba(255,255,255,0.02);
                border-radius: 12px; cursor: pointer; border: 1px solid rgba(255,255,255,0.04);
                transition: all 0.2s;
                text-decoration: none; color: inherit;
            }
            .onb-task:hover {
                background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.08);
                transform: translateX(4px);
            }
            .onb-task.completed {
                opacity: 0.6;
            }
            .onb-check {
                width: 20px; height: 20px; border-radius: 50%; border: 2px solid #3f3f46;
                display:flex; align-items:center; justify-content:center; flex-shrink:0;
                transition: all 0.2s;
            }
            .onb-task.completed .onb-check {
                background: #fff; border-color: #fff; color: #000;
            }
            .onb-check i { font-size: 0.75rem; opacity: 0; font-weight: 800; display:flex;}
            .onb-task.completed .onb-check i { opacity: 1; }
            .onb-task-title {
                font-size: 0.85rem; font-weight: 600;
            }
            
            /* Referral Modal Styles */
            .ref-header {
                text-align: center; margin-bottom: 20px;
            }
            .ref-badge {
                background: #fde04750; color: #fde047; padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; display: inline-block; margin-bottom: 8px;
            }
            .ref-points {
                font-size: 2.2rem; font-weight: 900; margin: 10px 0; color: #fff; line-height: 1;
            }
            .ref-points span { font-size: 1rem; color: #a1a1aa; font-weight: 500; margin-left: 4px;}
            .ref-progress-bar {
                height: 8px; background: #27272a; border-radius: 10px; overflow: hidden; margin: 15px 0;
            }
            .ref-progress-fill {
                height: 100%; background: linear-gradient(90deg, #fff, #a1a1aa); width: 0%; transition: width 1s ease;
            }
            .ref-link-box {
                background: #000; border: 1px solid #27272a; border-radius: 12px; padding: 12px; display: flex; align-items: center; gap: 10px; margin-top: 10px;
            }
            .ref-link-input {
                background: none; border: none; color: #a1a1aa; font-size: 0.8rem; width: 100%; pointer-events: none;
            }
            .ref-copy-btn {
                background: #fff; color: #000; border: none; border-radius: 8px; padding: 6px 12px; font-size: 0.75rem; font-weight: 700; cursor: pointer;
            }
            .ref-copy-btn:hover { background: #e5e5e5; }
            
            .ref-rule-item {
                display: flex; gap: 10px; margin-bottom: 12px; align-items: flex-start;
            }
            .ref-rule-icon { color: #fde047; font-size: 0.9rem; margin-top: 2px;}
            .ref-rule-text { font-size: 0.75rem; color: #d4d4d8; line-height: 1.4; }

            /* Back Button */
            .onb-back {
                background: none; border: none; color: #a1a1aa; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; padding: 0; margin-bottom: 16px;
            }
            .onb-back:hover { color: #fff; }

            @media (max-width: 768px) {
                .onb-widget-container { display: none !important; }
            }
        `;
        document.head.appendChild(style);
    }

    container = document.createElement('div');
    container.id = 'offszn-onb-widget';
    container.className = 'onb-widget-container';
    document.body.appendChild(container);

    updateWidgetContent(tasks, progress, profile, stats, false);
}

function updateWidgetContent(tasks, progress, profile, stats, wasActive) {
    const container = document.getElementById('offszn-onb-widget');
    if (!container) return;

    const hasSeen = localStorage.getItem('offszn_onb_modal_seen') === '1';
    const refProgress = Math.min((stats.referralCount / 30) * 100, 100);

    container.innerHTML = `
        <div class="onb-modal ${wasActive || !hasSeen ? 'active' : ''}" id="onbModal">
            <!-- Main Content (Checklist) -->
            <div id="onbChecklist">
                <div class="onb-header">
                    <div>
                        <h3 class="onb-title">Completar perfil</h3>
                        <p class="onb-subtitle">${progress}% Completado</p>
                    </div>
                    <button class="onb-close" id="onbCloseBtn">&times;</button>
                </div>
                
                <div style="display:flex; flex-direction:column; gap:8px; margin-top: 20px;">
                    ${tasks.map(t => `
                        <div class="onb-task ${t.completed ? 'completed' : ''}" data-task="${t.id}" data-link="${t.link}" data-modal="${t.modal || ''}">
                            <div class="onb-check"><i class="bi bi-check-lg" style="margin-top:1px;"></i></div>
                            <span class="onb-task-title">${t.completed ? '<s>'+t.title+'</s>' : t.title}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Referral Modal View -->
            <div id="onbReferral" style="display:none;">
                <button class="onb-back" id="refBackBtn"><i class="bi bi-arrow-left"></i> Volver</button>
                <div class="ref-header">
                    <div class="ref-badge">MEMBRESIA PRO GRATIS</div>
                    <div class="ref-points">${stats.referralCount}<span>/ 30</span></div>
                    <p class="onb-subtitle">Referidos verificados</p>
                </div>

                <div class="ref-progress-bar">
                    <div class="ref-progress-fill" style="width: ${refProgress}%"></div>
                </div>

                <div class="ref-rule-item">
                    <i class="bi bi-stars ref-rule-icon"></i>
                    <p class="ref-rule-text"><b>Invita amigos:</b> Comparte tu link y obtén 1 mes de Plan PRO tras 30 referidos exitosos.</p>
                </div>
                
                <div class="ref-rule-item">
                    <i class="bi bi-shield-check ref-rule-icon"></i>
                    <p class="ref-rule-text"><b>Regla:</b> El invitado debe registrarse, verificar correo y subir su primer beat para valer.</p>
                </div>

                <div class="ref-link-box">
                    <input type="text" class="ref-link-input" value="${window.location.origin}/pages/register.html?ref=${profile.referral_code || ''}" id="refLinkInput">
                    <button class="ref-copy-btn" id="refCopyBtn">Copiar</button>
                </div>
            </div>
        </div>
        
        <div class="onb-toggle-btn" id="onbToggleBtn">
            <div class="onb-progress-circle" style="--progress: ${progress}%">
                <div class="onb-progress-inner"></div>
            </div>
            <span>Completar perfil</span>
        </div>
    `;

    setupWidgetListeners(container);
}

function setupWidgetListeners(container) {
    const toggleBtn = document.getElementById('onbToggleBtn');
    const modal = document.getElementById('onbModal');
    const closeBtn = document.getElementById('onbCloseBtn');
    const checklistView = document.getElementById('onbChecklist');
    const referralView = document.getElementById('onbReferral');
    const tasksEls = document.querySelectorAll('.onb-task');
    const refBackBtn = document.getElementById('refBackBtn');
    const refCopyBtn = document.getElementById('refCopyBtn');
    const refLinkInput = document.getElementById('refLinkInput');

    toggleBtn.addEventListener('click', () => {
        modal.classList.toggle('active');
        localStorage.setItem('offszn_onb_modal_seen', '1');
    });

    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modal.classList.remove('active');
    });

    tasksEls.forEach(el => {
        el.addEventListener('click', () => {
            const modalType = el.dataset.modal;
            const link = el.dataset.link;
            if (modalType === 'referral') {
                checklistView.style.display = 'none';
                referralView.style.display = 'block';
            } else if (link && link !== '#') {
                window.location.href = link;
            }
        });
    });

    refBackBtn.addEventListener('click', () => {
        checklistView.style.display = 'block';
        referralView.style.display = 'none';
    });

    refCopyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(refLinkInput.value);
        refCopyBtn.innerText = '¡Copiado!';
        refCopyBtn.style.color = '#10b981';
        setTimeout(() => {
            refCopyBtn.innerText = 'Copiar';
            refCopyBtn.style.color = '#000';
        }, 2000);
    });

    document.addEventListener('click', (e) => {
        if (!container.contains(e.target) && modal.classList.contains('active')) {
            modal.classList.remove('active');
        }
    });
}
