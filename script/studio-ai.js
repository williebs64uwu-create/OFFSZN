/**
 * OFFSZN Studio AI - Professional Layout & Logic
 * Features: DAW-style Tabs, Logic Fallback, Credit-aware UI, Single Audio Reference.
 */

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.AuthUtils) { console.error('AuthUtils not found'); return; }

    // DOM Elements
    const creditsDisplay = document.getElementById('user-credits-display');
    const promptInput = document.getElementById('ai-prompt-input');
    const btnGenerate = document.getElementById('btn-generate-ai');
    const btnArrow = document.getElementById('btn-arrow-icon');
    const loader = document.getElementById('ai-loader');
    const resultCard = document.getElementById('ai-result-card');
    const btnDownload = document.getElementById('btn-download-ai');
    const fileInput = document.getElementById('ai-file-input');
    const charCounter = document.getElementById('char-counter');
    const chatMessages = document.getElementById('chat-messages');
    const sidebar = document.getElementById('ai-sidebar');
    const resizeHandle = document.getElementById('resize-handle');
    const placeholderView = document.getElementById('ai-placeholder-view');
    const resultPromptTitle = document.getElementById('result-prompt-title');
    const currentVariantLabel = document.getElementById('current-variant');
    const genreChips = document.querySelectorAll('.genre-chip');
    const playPauseBtn = document.getElementById('btn-play-ai');
    const timeDisplay = document.getElementById('ai-time');

    // Menus & Banners
    const btnContext = document.getElementById('btn-attach-context');
    const contextMenu = document.getElementById('context-menu');
    const modelSelectorBtn = document.getElementById('model-selector-btn');
    const modelMenu = document.getElementById('model-menu');
    const lowCreditsBanner = document.getElementById('low-credits-banner');

    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const historyList = document.getElementById('ai-history-list');

    // State Variables
    let wavesurfer = null;
    let currentReference = null;
    let user = null;
    let isGuest = false;
    let currentCredits = 0;
    let currentModelId = 'flash'; 
    let currentModelCost = 5;
    let currentAudioUrl = null; 


    // Modal Elements
    const upgradeModal = document.getElementById('upgrade-modal-overlay');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnLaterModal = document.getElementById('btn-later-modal');
    
    // Auth Modal (NEW)
    const authModal = document.getElementById('auth-modal-overlay');
    const btnCloseAuth = document.getElementById('btn-close-auth');



    // Initialize Supabase if needed
    if (!window.supabaseClient && window.AuthUtils) window.AuthUtils.initSupabase();

    // ===== UI DROPDOWNS =====
    if (btnContext) {
        btnContext.addEventListener('click', (e) => {
            e.stopPropagation();
            contextMenu.classList.toggle('show');
            modelMenu.classList.remove('show');
        });
    }

    if (modelSelectorBtn) {
        modelSelectorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            modelMenu.classList.toggle('show');
            contextMenu.classList.remove('show');
        });
    }

    document.addEventListener('click', () => {
        if (contextMenu) contextMenu.classList.remove('show');
        if (modelMenu) modelMenu.classList.remove('show');
    });

    modelMenu?.querySelectorAll('.dropdown-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            modelMenu.querySelectorAll('.dropdown-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentModelId = btn.dataset.model || 'flash';
            currentModelCost = parseInt(btn.dataset.cost);
            
            const label = btn.querySelector('div')?.textContent.split('\n')[1]?.trim() || "Model"; 
            if (currentVariantLabel) currentVariantLabel.textContent = label;
            
            modelMenu.classList.remove('show');
            checkCreditAvailability();
        });
    });

    document.getElementById('btn-context-audio')?.addEventListener('click', (e) => {
        e.stopPropagation();
        contextMenu.classList.remove('show');
        fileInput.click();
    });

    // ===== TABS LOGIC =====
    function switchToTab(tabId) {
        const btn = Array.from(tabBtns).find(b => b.dataset.tab === tabId);
        if (btn) btn.click();
    }
    window.switchToTab = switchToTab;

    // ===== MODAL LOGIC =====
    function toggleUpgradeModal(show) {
        if (!upgradeModal) return;
        if (show) {
            upgradeModal.style.display = 'flex';
            if (window.gsap) {
                gsap.fromTo(upgradeModal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
                gsap.fromTo('#upgrade-modal', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, delay: 0.1, ease: "power2.out" });
            } else {
                upgradeModal.style.opacity = 1;
            }
        } else {
            if (window.gsap) {
                gsap.to(upgradeModal, { opacity: 0, duration: 0.2, onComplete: () => upgradeModal.style.display = 'none' });
            } else {
                upgradeModal.style.display = 'none';
            }
        }
    }

    lowCreditsBanner?.addEventListener('click', () => {
        if (isGuest) toggleAuthModal(true);
        else toggleUpgradeModal(true);
    });
    btnCloseModal?.addEventListener('click', () => toggleUpgradeModal(false));
    btnLaterModal?.addEventListener('click', () => toggleUpgradeModal(false));
    upgradeModal?.addEventListener('click', (e) => { if (e.target === upgradeModal) toggleUpgradeModal(false); });

    // Auth Modal Triggers
    function toggleAuthModal(show) {
        if (!authModal) return;
        if (show) {
            authModal.style.display = 'flex';
            if (window.gsap) {
                gsap.fromTo(authModal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
                gsap.fromTo('#auth-modal', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, delay: 0.1, ease: "power2.out" });
            } else {
                authModal.style.opacity = 1;
            }
        } else {
            if (window.gsap) {
                gsap.to(authModal, { opacity: 0, duration: 0.2, onComplete: () => authModal.style.display = 'none' });
            } else {
                authModal.style.display = 'none';
            }
        }
    }
    btnCloseAuth?.addEventListener('click', () => toggleAuthModal(false));
    document.getElementById('btn-close-auth-secondary')?.addEventListener('click', () => toggleAuthModal(false));
    authModal?.addEventListener('click', (e) => { if (e.target === authModal) toggleAuthModal(false); });




    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            if (btn.classList.contains('active')) return;

            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetPane = document.getElementById(`pane-${target}`);
            tabPanes.forEach(p => p.classList.remove('active'));
            if (targetPane) targetPane.classList.add('active');

            if (window.gsap && targetPane) {
                gsap.fromTo(targetPane, { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.25 });
            }
        });
    });

    // ===== PROMPT & COUNTER =====
    function updateCharCounter() {
        if (!promptInput || !charCounter) return;
        const len = promptInput.value.length;
        charCounter.innerText = `${len} / 150`;
        charCounter.classList.toggle('limit', len >= 150);
        
        promptInput.style.height = 'auto';
        promptInput.style.height = promptInput.scrollHeight + 'px';
    }
    window.updateCharCounter = updateCharCounter;
    promptInput?.addEventListener('input', updateCharCounter);

    // ===== AUDIO REFERENCE CHIPS =====
    const refContainer = document.createElement('div');
    refContainer.id = 'ref-container';
    if (promptInput) promptInput.parentNode.insertBefore(refContainer, promptInput);

    fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        currentReference = file;
        renderReferenceChip(file.name);
        
        const chip = refContainer.querySelector('.ref-chip');
        const statusText = document.createElement('span');
        statusText.className = 'scanning-text';
        statusText.innerText = 'Escaneando audio (30s)...';
        if (chip) chip.appendChild(statusText);

        btnGenerate.disabled = true;

        setTimeout(() => {
            if (statusText) {
                statusText.innerText = '✓ Audio analizado';
                statusText.style.color = '#00ff88';
            }
            btnGenerate.disabled = false;
        }, 2000);
    });

    function renderReferenceChip(name) {
        refContainer.innerHTML = `
            <div class="ref-chip">
                <i class="bi bi-soundwave"></i>
                <span class="ref-name">${name}</span>
                <i class="fas fa-times ref-remove" onclick="window.removeReference()"></i>
            </div>
        `;
    }

    window.removeReference = () => {
        currentReference = null;
        refContainer.innerHTML = '';
        if (fileInput) fileInput.value = '';
    };

    // ===== CHAT LOGIC =====
    function addUserMessage(text) {
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble user';
        bubble.innerHTML = `<div class="bubble-content">${text}</div>`;
        chatMessages?.appendChild(bubble);
        if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addAiMessage(text, options = {}) {
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble ai';
        bubble.innerHTML = `
            <div class="bubble-label"><span class="dot"></span> OFFSZN AI</div>
            <div class="bubble-content">
                <span class="bubble-text"></span>
            </div>
        `;
        chatMessages?.appendChild(bubble);

        const textEl = bubble.querySelector('.bubble-text');
        const contentEl = bubble.querySelector('.bubble-content');

        const writePromise = options.instant 
            ? (() => { textEl.textContent = text; return Promise.resolve(); })()
            : typeWriter(textEl, text);

        writePromise.then(() => {
            if (options.suggestions) {
                const sugCont = document.createElement('div');
                sugCont.className = 'bubble-suggestions';
                options.suggestions.forEach(s => {
                    const b = document.createElement('button');
                    b.className = 'bubble-suggestion';
                    b.textContent = s;
                    b.addEventListener('click', () => {
                        if (promptInput) {
                            promptInput.value = s;
                            updateCharCounter();
                            promptInput.focus();
                        }
                    });
                    sugCont.appendChild(b);
                });
                contentEl.appendChild(sugCont);
            }

            if (options.status) {
                const statEl = document.createElement('div');
                statEl.className = 'bubble-status';
                options.status.forEach(s => {
                    const item = document.createElement('div');
                    item.className = `s-item ${s.state}`;
                    item.innerHTML = `<i class="fas ${s.state==='done'?'fa-check':s.state==='running'?'fa-spinner fa-spin':'fa-circle'}"></i> ${s.text}`;
                    statEl.appendChild(item);
                });
                contentEl.appendChild(statEl);
            }
            if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
        });

        return bubble;
    }

    function typeWriter(element, text) {
        return new Promise(resolve => {
            let i = 0;
            const cursor = document.createElement('span');
            cursor.className = 'typewriter-cursor';
            cursor.textContent = '▍';
            element.appendChild(cursor);

            function type() {
                if (i < text.length) {
                    if (cursor && cursor.parentNode === element) {
                        element.insertBefore(document.createTextNode(text.charAt(i)), cursor);
                    } else {
                        element.appendChild(document.createTextNode(text.charAt(i)));
                    }
                    i++;
                    setTimeout(type, 20);
                } else {
                    if (cursor && cursor.parentNode === element) cursor.remove();
                    resolve();
                }
            }
            type();
        });
    }

    // ===== GENERATION HANDLER =====
    btnGenerate?.addEventListener('click', handleGenerate);
    promptInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
    });

    async function handleGenerate() {
        const prompt = promptInput.value.trim();
        if (!prompt) {
            if (window.showToast) window.showToast('Describe el sonido, bro (el prompt es obligatorio)', 'warning');
            return;
        }

        // TEASER MODE: If guest, simulate a bit of processing then show auth modal
        if (isGuest) {
            btnGenerate.disabled = true;
            if (btnArrow) btnArrow.className = 'fas fa-spinner fa-spin';
            
            setTimeout(() => {
                toggleAuthModal(true);
                btnGenerate.disabled = false;
                if (btnArrow) btnArrow.className = 'fas fa-arrow-up';
            }, 600);
            return;
        }


        if (currentCredits < currentModelCost) {
            checkCreditAvailability();
            return;
        }


        btnGenerate.disabled = true;
        if (btnArrow) btnArrow.className = 'fas fa-spinner fa-spin';

        addUserMessage(prompt);

        const aiBubble = addAiMessage(`Iniciando generación en modo ${currentModelId}...`, {
            status: [
                { text: 'Conectando con motor de audio', state: 'running' },
                { text: 'Procesando referencia', state: 'pending' }
            ]
        });

        try {
            const statusItems = aiBubble.querySelectorAll('.s-item');
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            const token = session?.access_token;
            user = session?.user;

            const response = await fetch('/api/studio/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    message: prompt, 
                    model: currentModelId,
                    userId: user.id,
                    hasReference: !!currentReference
                })
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.error);

            if (statusItems.length >= 2) {
                statusItems[0].className = 's-item done';
                statusItems[0].innerHTML = '<i class="fas fa-check"></i> Motor listo';
                statusItems[1].className = 's-item done';
                statusItems[1].innerHTML = `<i class="fas fa-check"></i> ${currentReference ? 'Referencia aplicada' : 'Sin referencia'}`;
            }

            const textEl = aiBubble.querySelector('.bubble-text');
            if (textEl) {
                textEl.textContent = '';
                await typeWriter(textEl, result.chatReply);
            }

            currentAudioUrl = result.audioUrl;
            if (currentAudioUrl) {
                loadIntoViewport(currentAudioUrl, result.promptUsed || prompt);
                promptInput.value = '';
                updateCharCounter();
                switchToTab('result');
            }
            
            fetchCredits(); 

        } catch (err) {
            console.error('[Studio AI] Failed:', err);
            addAiMessage(`Error: ${err.message}`, { instant: true });
        } finally {
            btnGenerate.disabled = false;
            if (btnArrow) btnArrow.className = 'fas fa-arrow-up';
        }
    }

    function loadIntoViewport(url, pText) {
        currentAudioUrl = url;
        if (placeholderView) placeholderView.style.display = 'none';
        if (loader) loader.style.display = 'none';
        if (resultCard) resultCard.style.display = 'block';
        if (resultPromptTitle) resultPromptTitle.innerText = pText;
        if (!wavesurfer) initWaveSurfer();
        wavesurfer.load(url);
    }

    // ===== AUDIO ENGINE (WaveSurfer) =====
    function initWaveSurfer() {
        if (wavesurfer) wavesurfer.destroy();
        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: 'rgba(255, 255, 255, 0.1)',
            progressColor: '#fff',
            cursorColor: '#fff',
            barWidth: 2, height: 100, barGap: 3
        });
        wavesurfer.on('audioprocess', () => {
            const cur = formatTime(wavesurfer.getCurrentTime());
            const dur = formatTime(wavesurfer.getDuration());
            if (timeDisplay) timeDisplay.innerText = `${cur} / ${dur}`;
        });
    }
    function formatTime(s) { return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; }
    playPauseBtn?.addEventListener('click', () => wavesurfer?.playPause());

    // ===== CREDITS & HISTORY =====
    async function fetchCredits() {
        if (!window.supabaseClient) return;
        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            user = session?.user;
            
            if (!user) {
                isGuest = true;
                currentCredits = 0;
                if (creditsDisplay) creditsDisplay.innerHTML = `<i class="fas fa-user-secret"></i> Invitado`;
                checkCreditAvailability();
                return;
            }

            isGuest = false;
            // Try 'users' table first (source of truth for reward_balance)

            let { data, error } = await window.supabaseClient
                .from('users')
                .select('reward_balance')
                .eq('id', user.id)
                .single();

            // Fallback to 'profiles' if 'users' query fails or lacks the column
            if (error || !data) {
                const profileRes = await window.supabaseClient
                    .from('profiles')
                    .select('reward_balance')
                    .eq('id', user.id)
                    .single();
                if (profileRes.data) data = profileRes.data;
            }

            currentCredits = data?.reward_balance || 0;
            if (creditsDisplay) creditsDisplay.innerHTML = `<i class="fas fa-gem"></i> ${currentCredits} Créditos`;
            
            checkCreditAvailability();
            fetchHistory(user.id);
        } catch (err) {
            console.warn('[Studio AI] Credit fetch failed, defaulting to 0:', err);
            currentCredits = 0;
            checkCreditAvailability();
        }
    }


    function checkCreditAvailability() {
        if (isGuest) {
            if (lowCreditsBanner) {
                lowCreditsBanner.style.display = 'flex';
                lowCreditsBanner.querySelector('span').innerText = 'Inicia sesión para generar sonidos gratis';
            }
            if (promptInput) promptInput.disabled = false; // Allow typing to "teaser"
            if (btnGenerate) btnGenerate.disabled = false;
            return;
        }

        const low = currentCredits < currentModelCost;
        if (promptInput) promptInput.disabled = low;
        if (btnGenerate) btnGenerate.disabled = low;
        if (lowCreditsBanner) {
            lowCreditsBanner.style.display = low ? 'flex' : 'none';
            lowCreditsBanner.querySelector('span').innerText = 'Mejora tu plan para seguir generando';
        }
    }


    async function fetchHistory(userId) {
        const { data } = await window.supabaseClient.from('studio_ai_history').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (data && historyList) renderHistoryEntries(data);
    }

    function renderHistoryEntries(items) {
        if (!historyList) return;
        historyList.innerHTML = '';
        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'history-item';
            row.innerHTML = `
                <div class="history-icon"><i class="fas fa-music"></i></div>
                <div class="history-main">
                    <div class="h-prompt">${item.prompt}</div>
                    <div class="h-meta">${new Date(item.created_at).toLocaleDateString()}</div>
                </div>
                <div class="h-actions">
                    <button class="h-btn primary" onclick="switchToTab('result'); window.loadSampleInViewport('${item.audio_url}', '${item.prompt.replace(/'/g,"\\'")}')"><i class="fas fa-play"></i></button>
                    <button class="h-btn" onclick="window.usePrompt('${item.prompt.replace(/'/g,"\\'")}')"><i class="fas fa-redo"></i></button>
                </div>
            `;
            historyList.appendChild(row);
        });
    }

    window.loadSampleInViewport = (url, pr) => loadIntoViewport(url, pr);
    window.usePrompt = (p) => { 
        if (promptInput) {
            promptInput.value = p; 
            updateCharCounter(); 
            promptInput.focus(); 
        }
    };

    // ===== RESIZE SIDEBAR =====
    resizeHandle?.addEventListener('mousedown', (e) => {
        const startX = e.clientX;
        const startWidth = sidebar.offsetWidth;
        const onMove = (me) => {
            const w = Math.max(320, Math.min(560, startWidth + (me.clientX - startX)));
            sidebar.style.width = w + 'px';
            sidebar.style.minWidth = w + 'px';
        };
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    // Init
    fetchCredits();
    addAiMessage("¡Hey bro! ¿Qué sonido estás buscando hoy? Puedes añadir una referencia de audio arriba para guiarme.", {
        suggestions: ["808 grave oscuro", "Hi-hat rápido", "Snare trap pesado"]
    });
});
