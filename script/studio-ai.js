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

    // Variables Globales
    let currentModelId = 'OFFSZN-PRO'; 
    let currentModelName = 'OFFSZN AI PRO (Recomendado)';
    let currentModelCost = 5; 
    let isGuest = true;
    let currentReference = null;
    let currentCredits = 0;
    let wavesurfer = null;
    let user = null; // 🔥 Declarado al inicio
    let pillWavesurfer = null; // 🔥 Segundo wavesurfer para el Pill Player
    let matchWavesurfer = null; // 🔥 Tercer wavesurfer para el Modal de Match
    let currentSampleUrl = null;
    let currentSampleTitle = "Selecciona un sonido";
    
    // 🔥 Fallback global de seguridad: El cargador nunca debe quedarse más de 5 segundos
    setTimeout(() => {
        const globalLoader = document.getElementById('chat-loader-overlay');
        if (globalLoader && globalLoader.style.display !== 'none') {
            globalLoader.style.opacity = '0';
            setTimeout(() => globalLoader.style.display = 'none', 500);
        }
    }, 5000);
 
    let selectedGenres = []; 
    let generationAbortController = null; // 🔥 Para poder cancelar


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
    
    document.getElementById('btn-context-audio-wav')?.addEventListener('click', (e) => {
        e.stopPropagation();
        contextMenu.classList.remove('show');
        fileInput.click();
    });

    // ===== AUTO-RESIZE PROMPT INPUT =====
    if (promptInput) {
        const setInputHeight = () => {
            promptInput.style.height = 'auto'; // Reset a auto para calcular scrollHeight real
            const newH = Math.min(85, promptInput.scrollHeight);
            promptInput.style.height = newH + 'px';
        };
        promptInput.addEventListener('input', setInputHeight);
        window.setInputHeight = setInputHeight; // Expose to handle programmatic updates
        
        // También actualizar al enfocar por si hubo cambios programáticos
        promptInput.addEventListener('focus', setInputHeight);

        // Inicializar si ya tiene texto (por el bridge de match)
        setTimeout(setInputHeight, 200);
    }


    // ===== GENRE CHIPS LOGIC (Categories) =====
    genreChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const genre = chip.textContent.trim();
            if (selectedGenres.includes(genre)) {
                selectedGenres = selectedGenres.filter(g => g !== genre);
                chip.classList.remove('active');
            } else {
                selectedGenres.push(genre);
                chip.classList.add('active');
            }
            renderGenreTags();
            promptInput.focus();
        });
    });

    const genresContainer = document.createElement('div');
    genresContainer.id = 'genres-container';
    genresContainer.className = 'tags-wrapper';
    if (promptInput) promptInput.parentNode.insertBefore(genresContainer, promptInput);

    function renderGenreTags() {
        if (!genresContainer) return;
        genresContainer.innerHTML = '';
        selectedGenres.forEach(g => {
            const tag = document.createElement('div');
            tag.className = 'genre-tag';
            tag.textContent = g + ' ';
            const icon = document.createElement('i');
            icon.className = 'fas fa-times';
            icon.style.cursor = 'pointer';
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                window.removeGenre(g);
            });
            tag.appendChild(icon);
            genresContainer.appendChild(tag);
        });
    }

    window.removeGenre = (g) => {
        selectedGenres = selectedGenres.filter(item => item !== g);
        genreChips.forEach(chip => {
            if (chip.textContent.trim() === g) chip.classList.remove('active');
        });
        renderGenreTags();
    };

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

            // Si entra a explorar, carga los beats
            if (target === 'explorar' && !window.exploreBeatsLoaded) {
                if (typeof window.loadExploreBeats === 'function') {
                    window.loadExploreBeats();
                    window.exploreBeatsLoaded = true;
                }
            }
        });
    });

    window.skippedIds = JSON.parse(localStorage.getItem('skipped_beats') || '[]');
    window.likedBeatsIds = []; // 🔥 Se rellena al autenticar, para excluir de Explore
    window.exploreBeatsLoaded = false;
    window.loadExploreBeats = async () => {
        if (!supabaseClient) return;
        try {
            // Buscamos Beats para hacer Tinder Match
            const { data, error } = await supabaseClient
                .from('products')
                .select(`
                    id, name, producer_nickname, audio_url, mp3_url, image_url, storage_version, r2_version, product_type, created_at,
                    producer:users!products_producer_id_fkey(id, nickname)
                `)
                .eq('product_type', 'beat')
                .not('id', 'in', `(${[...window.skippedIds, ...window.likedBeatsIds].join(',') || '0'})`)
                .order('plays_count', { ascending: false, nullsFirst: false })
                .limit(15);
                
            if (error) throw error;
            
            // Pasamos los datos completos para poder mostrar portada real y generar URLs frescas
            const beats = (data || []).filter(b => b.mp3_url || b.audio_url);
            renderRecentStack(beats);
        } catch (err) {
            console.error('[Studio AI] Falló al cargar los Explore Beats:', err);
        }
    };

    window.loadMoreBeats = async () => {
        if (!supabaseClient || !recentSwiperInstance) return;
        try {
            // Offset logic manually or just random samples not yet in stack
            const currentIds = (window._exploreBeats || []).map(b => b.id);
            const excluded = [...window.skippedIds, ...window.likedBeatsIds, ...currentIds];

            const { data, error } = await supabaseClient
                .from('products')
                .select(`
                    id, name, producer_nickname, audio_url, mp3_url, image_url, storage_version, r2_version, product_type, created_at,
                    producer:users!products_producer_id_fkey(id, nickname)
                `)
                .eq('product_type', 'beat')
                .not('id', 'in', `(${excluded.slice(-50).join(',') || '0'})`) // Limit exclude list for query length
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            if (data && data.length > 0) {
                const newBeats = data.filter(b => b.mp3_url || b.audio_url);
                window._exploreBeats = [...window._exploreBeats, ...newBeats];
                renderRecentStack(window._exploreBeats, true); // true means append
            }
        } catch (err) {
            console.error('[Studio AI] Falló al cargar más beats:', err);
        }
    };

    // ===== PROMPT & COUNTER =====
    function updateCharCounter() {
        if (!promptInput || !charCounter) return;
        const len = promptInput.value.length;
        charCounter.innerText = `${len} / 150`;
        charCounter.classList.toggle('limit', len >= 140);
        
        if (window.setInputHeight) window.setInputHeight();
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
        bubble.style.position = 'relative';

        // Pencil edit icon (top-right corner)
        const editBtn = document.createElement('button');
        editBtn.className = 'bubble-edit-btn';
        editBtn.title = 'Editar este mensaje';
        editBtn.innerHTML = '<i class="fas fa-pen"></i>';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (promptInput) {
                const cleanText = text.replace(/^\[.*?\]\s*/, '');
                promptInput.value = cleanText;
                promptInput.focus();
                if (window.updateCharCounter) window.updateCharCounter();
                if (window.setInputHeight) window.setInputHeight();

                // Flash feedback on the bubble
                bubble.style.opacity = '0.5';
                setTimeout(() => bubble.style.opacity = '1', 250);

                if (window.showToast) window.showToast('Prompt copiado al input', 'info');
            }
        });

        const contentDiv = document.createElement('div');
        contentDiv.className = 'bubble-content';
        contentDiv.textContent = text;
        
        bubble.appendChild(contentDiv);
        bubble.appendChild(editBtn);

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
                            if (window.setInputHeight) window.setInputHeight();
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
        // 🔥 Si ya está cargando, este botón ahora es STOP
        if (btnGenerate.classList.contains('loading')) {
            if (generationAbortController) generationAbortController.abort();
            return;
        }

        const prompt = promptInput.value.trim();
        if (!prompt) {
            if (window.showToast) window.showToast('Describe el sonido, bro (el prompt es obligatorio)', 'warning');
            return;
        }

        // Limpiar input inmediatamente para una sensación de rapidez
        promptInput.value = '';
        if (window.updateCharCounter) window.updateCharCounter();
        if (window.setInputHeight) window.setInputHeight();

        // TEASER MODE: If guest, simulate a bit of processing then show auth modal
        if (isGuest) {
            btnGenerate.classList.add('loading');
            if (btnArrow) btnArrow.className = 'fas fa-spinner fa-spin';
            setTimeout(() => {
                toggleAuthModal(true);
                btnGenerate.classList.remove('loading');
                if (btnArrow) btnArrow.className = 'fas fa-arrow-up';
            }, 600);
            return;
        }

        if (currentCredits < currentModelCost) {
            checkCreditAvailability();
            return;
        }

        btnGenerate.classList.add('loading');
        if (btnArrow) btnArrow.className = 'fas fa-stop'; // Cambiar a cuadrado de STOP

        generationAbortController = new AbortController();

        // Combinar géneros + texto
        const fullPrompt = (selectedGenres.length > 0 ? `[${selectedGenres.join(', ')}] ` : '') + prompt;
        
        addUserMessage(fullPrompt);

        const statusList = [{ text: 'Conectando con motor de audio', state: 'running' }];
        if (currentReference) {
            statusList.push({ text: 'Procesando referencia', state: 'pending' });
        }

        const aiBubble = addAiMessage(`Iniciando generación...`, {
            status: statusList
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
                signal: generationAbortController.signal,
                body: JSON.stringify({ 
                    message: fullPrompt, 
                    model: currentModelId,
                    userId: user.id,
                    hasReference: !!currentReference
                })
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.error);

            // Actualizar estados
            if (statusItems.length > 0) {
                statusItems[0].className = 's-item done';
                statusItems[0].innerHTML = '<i class="fas fa-check"></i> Motor listo';
                if (statusItems[1]) {
                    statusItems[1].className = 's-item done';
                    statusItems[1].innerHTML = '<i class="fas fa-check"></i> Referencia analizada';
                }
            }

            const textEl = aiBubble.querySelector('.bubble-text');
            if (textEl) {
                textEl.textContent = '';
                await typeWriter(textEl, result.chatReply);
            }

            // Limpieza: Ocultar estados después de la respuesta
            const statusCont = aiBubble.querySelector('.bubble-status');
            if (statusCont) {
                if (window.gsap) {
                    gsap.to(statusCont, { height: 0, opacity: 0, duration: 0.3, marginTop: 0, onComplete: () => statusCont.remove() });
                } else {
                    statusCont.style.display = 'none';
                }
            }

            currentSampleUrl = result.audioUrl;
            if (currentSampleUrl) {
                // TRUE: Es una generación, queremos skeleton y pasos
                loadIntoViewport(currentSampleUrl, prompt, true, true); 
                switchToTab('generados');
                // Refrescar historial
                if (user?.id) fetchHistory(user.id);
                // Resetear referencia para el siguiente
                window.removeReference();
            }
            
            fetchCredits(); 

        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('[Studio AI] Generación cancelada por el usuario');
                addAiMessage(`Generación detenida.`, { instant: true });
            } else {
                console.error('[Studio AI] Failed:', err);
                addAiMessage(`Error: ${err.message}`, { instant: true });
            }
        } finally {
            btnGenerate.classList.remove('loading');
            if (btnArrow) btnArrow.className = 'fas fa-arrow-up';
            generationAbortController = null;
        }
    }

    // ===== DOWNLOAD FIX =====
    btnDownload?.addEventListener('click', async () => {
        if (!currentAudioUrl) {
            if (window.showToast) window.showToast('No hay audio para descargar bro', 'info');
            return;
        }

        try {
            if (window.showToast) window.showToast('Etiquetando y descargando...', 'info');
            
            const promptTitle = document.getElementById('result-prompt-title')?.textContent?.replace(/"/g, '') || 'Studio AI Sample';
            const apiUrl = `/api/studio/download?url=${encodeURIComponent(currentAudioUrl)}&title=${encodeURIComponent(promptTitle)}`;
            
            const response = await fetch(apiUrl);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${promptTitle}.wav`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Limpiar memoria
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        } catch (err) {
            console.error('[Studio AI] Download failed:', err);
            // Fallback si fetch falla (CORS u otro error)
            window.open(currentAudioUrl, '_blank');
        }
    });

    let processingInterval;
    function showProcessingSteps() {
        const steps = [
            "Paso 1/4: Esculpiendo frecuencias...",
            "Paso 2/4: Ajustando el Low-End...",
            "Paso 3/4: Optimizando transientes...",
            "Paso 4/4: Finalizando Master AI..."
        ];
        let idx = 0;
        const stepText = document.getElementById('loader-steps-text');
        if (processingInterval) clearInterval(processingInterval);
        
        if (stepText) stepText.textContent = steps[0];
        processingInterval = setInterval(() => {
            idx++;
            if (idx < steps.length) {
                if (stepText) stepText.textContent = steps[idx];
            } else {
                clearInterval(processingInterval);
            }
        }, 2000);
    }

    function stopProcessingSteps() {
        if (processingInterval) clearInterval(processingInterval);
    }

    function loadIntoViewport(url, pText, shouldPlay = false, isGenerating = false) {
        currentSampleUrl = url; 

        if (!isGenerating) {
            updateGlobalPillPlayer(url, pText);
            return;
        }

        // ===== SOLO SI ES GENERACIÓN =====
        if (placeholderView) placeholderView.style.display = 'none';
        
        const skeleton = document.getElementById('ai-skeleton-screen');
        const stepText = document.getElementById('loader-steps-text');

        if (loader) {
            loader.style.display = 'block';
            if (skeleton) skeleton.style.display = 'block';
            showProcessingSteps();
        }

        if (resultCard) {
            resultCard.style.display = 'none';
            resultCard.classList.remove('ani-fade-up');
        }

        const titleEl = document.getElementById('result-prompt-title');
        if (titleEl) titleEl.textContent = `"${pText}"`;

        const delay = 3500;

        setTimeout(() => {
            if (loader) {
                loader.style.display = 'none';
                stopProcessingSteps();
            }
            if (!wavesurfer) initWaveSurfer();
            if (wavesurfer) {
                wavesurfer.load(url);
                wavesurfer.once('ready', () => {
                    updateGlobalPillPlayer(url, pText);
                });
                wavesurfer.once('error', (err) => {
                    console.error('[Studio AI] WaveSurfer Error:', err);
                    if (window.showToast) window.showToast('Error cargando el audio', 'error');
                });
            }
        }, delay);
    }
    
    // ===== AUDIO ENGINE (WaveSurfer) =====
    function initWaveSurfer() {
        if (wavesurfer && typeof wavesurfer.destroy === 'function') wavesurfer.destroy();
        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: 'rgba(255, 255, 255, 0.1)',
            progressColor: '#fff',
            cursorColor: '#fff',
            barWidth: 2, height: 100, barGap: 3,
            crossOrigin: 'anonymous'
        });
        wavesurfer.on('audioprocess', () => {
            const cur = formatTime(wavesurfer.getCurrentTime());
            const dur = formatTime(wavesurfer.getDuration());
            if (timeDisplay) timeDisplay.innerText = `${cur} / ${dur}`;
        });
    }

    function formatTime(s) { 
        if (isNaN(s)) return "0:00";
        return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; 
    }

    // ===== GLOBAL PILL PLAYER LOGIC =====
    function initPillWavesurfer() {
        if (pillWavesurfer) return;
        pillWavesurfer = WaveSurfer.create({
            container: '#mini-waveform',
            waveColor: 'rgba(255, 255, 255, 0.15)',
            progressColor: '#ffffff',
            cursorColor: '#ffffff',
            barWidth: 2, 
            height: 28, 
            barGap: 3,
            responsive: true,
            normalize: true,
            crossOrigin: 'anonymous'
        });

        pillWavesurfer.on('audioprocess', () => {
            const cur = document.getElementById('pill-current-time');
            if (cur) cur.innerText = formatTime(pillWavesurfer.getCurrentTime());
        });

        pillWavesurfer.on('ready', () => {
            const dur = document.getElementById('pill-duration');
            if (dur) dur.innerText = formatTime(pillWavesurfer.getDuration());
        });

        pillWavesurfer.on('play', () => {
            document.getElementById('studio-pill-player')?.classList.add('playing');
            const playBtn = document.getElementById('btn-pill-play');
            if (playBtn) playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        });

        pillWavesurfer.on('pause', () => {
            document.getElementById('studio-pill-player')?.classList.remove('playing');
            const playBtn = document.getElementById('btn-pill-play');
            if (playBtn) playBtn.innerHTML = '<i class="fas fa-play"></i>';
        });
    }

    function updateGlobalPillPlayer(url, title, coverUrl = null) {
        const player = document.getElementById('studio-pill-player');
        if (!player) return;

        player.classList.add('active'); // Mostrar el reproductor
        document.getElementById('pill-title').innerText = title || "Sample Generado";
        
        // Actualizar logo/portada si existe
        const pillLogo = document.getElementById('pill-logo');
        if (pillLogo) {
            pillLogo.src = coverUrl || '/images/LOGO-OFFSZN.png';
            // Si es una portada real, podemos quitarle el filtro de blanco si lo tuviera (opcional)
        }

        currentSampleUrl = url;
        currentSampleTitle = title;

        if (!pillWavesurfer) initPillWavesurfer();
        
        pillWavesurfer.load(url);
        pillWavesurfer.once('ready', () => pillWavesurfer.play());

        // Setup Download button
        const dlBtn = document.getElementById('btn-pill-download');
        if (dlBtn) {
            dlBtn.onclick = async () => {
                try {
                    if (window.showToast) window.showToast('Etiquetando y descargando...', 'info');
                    
                    const apiUrl = `/api/studio/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
                    const response = await fetch(apiUrl);
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = `${title}.wav`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                } catch (err) {
                    console.error('[Studio AI] Download failed:', err);
                    window.open(url, '_blank');
                }
            };
        }
    }

    // Controles del Pill Player
    document.getElementById('btn-pill-play')?.addEventListener('click', () => {
        pillWavesurfer?.playPause();
    });

    document.getElementById('pill-volume')?.addEventListener('input', (e) => {
        const vol = parseFloat(e.target.value);
        pillWavesurfer?.setVolume(vol);
    });
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

            window.dispatchEvent(new CustomEvent('offszn-credits-updated', {
                detail: { balance: currentCredits }
            }));
            
            checkCreditAvailability();
            fetchHistory(user.id);
            fetchChatHistory(); // 🔥 Cargar historial de chat persistente
            
            // 🔥 Cargar IDs de beats ya likeados para excluir de Explore
            try {
                const { data: likedData } = await window.supabaseClient
                    .from('likes')
                    .select('target_id')
                    .eq('user_id', user.id)
                    .eq('target_type', 'product');
                window.likedBeatsIds = (likedData || []).map(l => String(l.target_id));
            } catch (e) { console.warn('[Studio AI] Could not load liked beats:', e); }
        } catch (err) {
            console.warn('[Studio AI] Credit fetch failed, defaulting to 0:', err);
            currentCredits = 0;
            checkCreditAvailability();
            // Incluso si fallan los créditos, intentamos cargar chat
            fetchChatHistory();
        }
    }

    async function fetchChatHistory() {
        const loaderOverlay = document.getElementById('chat-loader-overlay');
        
        if (!window.supabaseClient) {
            if (loaderOverlay) loaderOverlay.style.display = 'none';
            return;
        }

        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            const token = session?.access_token;
            if (!token) {
                if (loaderOverlay) loaderOverlay.style.display = 'none';
                return;
            }

            const response = await fetch('/api/studio/messages', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();

            if (result.success && result.messages) {
                if (result.messages.length > 0 && chatMessages) {
                    chatMessages.innerHTML = '';
                }

                let lastUserPrompt = "Sample Generado";

                result.messages.forEach(msg => {
                    if (msg.role === 'user') {
                        lastUserPrompt = msg.content;
                        addUserMessage(msg.content);
                    } else {
                        const options = { instant: true };
                        const bubble = addAiMessage(msg.content, options);
                        
                        if (msg.audio_url) {
                            const btnCont = document.createElement('div');
                            btnCont.className = 'bubble-actions';
                            // Usamos el prompt del usuario como título oficial del sample
                            const cleanTitle = lastUserPrompt.substring(0, 50).replace(/"/g, '&quot;');
                            btnCont.innerHTML = `
                                <button class="b-action-btn load-sample-btn" 
                                        data-url="${msg.audio_url}" 
                                        data-prompt="${cleanTitle}">
                                    <i class="fas fa-play"></i> Escuchar Sonido
                                </button>
                            `;
                            bubble.querySelector('.bubble-content').appendChild(btnCont);
                        }
                    }
                });
            }
        } catch (err) {
            console.error('[Studio AI] Chat history failed:', err);
        } finally {
            if (loaderOverlay) {
                loaderOverlay.style.opacity = '0';
                setTimeout(() => loaderOverlay.style.display = 'none', 500);
            }
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
        if (!window.supabaseClient) return;
        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            const token = session?.access_token;
            if (!token) return;

            const response = await fetch('/api/studio/history', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            
            if (result.success && historyList) {
                renderHistoryEntries(result.history);
            }
        } catch (err) {
            console.error('[Studio AI] Failed to fetch sound history:', err);
        }
    }

    let recentSwiperInstance = null;

    function renderHistoryEntries(items) {
        if (!historyList) return;
        historyList.innerHTML = '';
        
        // Normal list for full history
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
                    <button class="h-btn primary load-sample-btn" 
                            data-url="${item.audio_url}" 
                            data-prompt="${item.prompt.replace(/"/g, '&quot;')}">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="h-btn redo-prompt-btn" 
                            data-prompt="${item.prompt.replace(/"/g, '&quot;')}">
                        <i class="fas fa-redo"></i>
                    </button>
                </div>
            `;
            historyList.appendChild(row);
        });

        const loadingSkeletons = document.getElementById('history-loading-skeletons');
        if (loadingSkeletons) loadingSkeletons.style.display = 'none';

        // Ocultar placeholder de lista si hay items
        if (placeholderView) {
            if (items.length > 0) {
                placeholderView.style.display = 'none';
            } else {
                placeholderView.style.display = 'flex';
            }
        }
    }

    function renderRecentStack(recentItems, isAppend = false) {
        const stackList = document.getElementById('recent-stack-list');
        const stackContainer = document.getElementById('recent-stack-container');
        if (!stackList || !stackContainer) return;

        if (!isAppend) {
            stackList.innerHTML = '';
            if (recentItems.length === 0) {
                stackContainer.style.display = 'none';
                return;
            }
            stackContainer.style.display = 'block';
            window._exploreBeats = recentItems;
        } else {
            // Unir nuevos beats al array global para que matchSound los encuentre
            window._exploreBeats = [...(window._exploreBeats || []), ...recentItems];
        }

        const itemsToRender = isAppend ? recentItems.slice(-10) : recentItems;

        itemsToRender.forEach((beat, idx) => {
            const index = isAppend ? (recentItems.length - itemsToRender.length + idx) : idx;
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.style.cssText = 'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px;';
            
            const title = beat.name || 'Sin título';
            const producer = beat.producer_nickname || (beat.producer ? beat.producer.nickname : 'Artista');
            const safeTitle = title.replace(/"/g, '&quot;');
            const rawAudio = beat.mp3_url || beat.audio_url || '';
            const rawCover = beat.image_url || '';
            const storageVer = beat.storage_version || beat.r2_version || 'v2';
            
            const hue = (index * 55) % 360;
            const bgFallback = `linear-gradient(135deg, hsl(${hue}, 50%, 12%), hsl(${hue + 40}, 70%, 6%))`;
            
            const coverImgId = `explore-cover-img-${index}-${Date.now()}`;
            const coverGroupId = `explore-cover-${index}-${Date.now()}`;

            slide.innerHTML = `
                <div class="recent-card" data-beat-id="${beat.id}" data-index="${index}" style="padding:0; overflow:hidden; width: 100%; border-radius: 20px; position: relative; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); transition: transform 0.3s ease;">
                    
                    <div id="${coverGroupId}" class="explore-cover-group" style="width: 100%; height: 320px; background: ${bgFallback}; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer;"
                         onmouseenter="this.querySelector('.explore-play-overlay').style.opacity='1'" 
                         onmouseleave="this.querySelector('.explore-play-overlay').style.opacity='0'"
                         onclick="window.playStackAudio(${index})">
                         
                        <img id="${coverImgId}" src="" alt="cover" style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0; opacity:0; transition: opacity 0.4s;" />
                        <i class="fas fa-compact-disc fa-spin" style="font-size: 5rem; color: rgba(255,255,255,0.04); animation-duration: 4s;"></i>
                        
                        <div class="explore-play-overlay" style="position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s;">
                            <div style="width: 70px; height: 70px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(255,255,255,0.4);">
                                <i class="fas fa-play" style="font-size: 1.8rem; margin-left: 4px;"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div style="padding: 24px; text-align: center;">
                        <h3 style="font-size: 1.4rem; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 900; color: #fff; letter-spacing: -0.5px;">${title}</h3>
                        <div style="margin-bottom: 15px;">
                            <a href="/producto/${beat.id}" target="_blank" style="color: #fff; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; text-decoration: none;">
                                ${producer}
                            </a>
                        </div>
                        <div style="display: flex; gap: 8px; justify-content: center; opacity: 0.6;">
                            <span style="border: 1px solid rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; font-size: 0.6rem; font-weight: 700; text-transform: uppercase;">BEAT</span>
                            <span style="border: 1px solid rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; font-size: 0.6rem; font-weight: 700; text-transform: uppercase;">PREMIUM</span>
                        </div>
                    </div>
                </div>
                
                <div class="slide-actions-outside" style="display: flex; gap: 40px; justify-content: center; width: 100%; margin-top: 15px; z-index: 10;">
                    <button tabindex="-1" style="width: 65px; height: 65px; background: rgba(0,0,0,0.4); color: #fff; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); display: flex; align-items:center; justify-content:center; cursor: pointer; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);" 
                            onmouseenter="this.style.borderColor='rgba(255,255,255,0.4)'; this.style.transform='scale(1.15)';" onmouseleave="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.transform='scale(1)';"
                            onclick="window.skipBeat('${beat.id}')">
                        <i class="fas fa-times" style="font-size:1.8rem;"></i>
                    </button>
                    
                    <button tabindex="-1" style="width: 65px; height: 65px; background: #ffffff; color: #000; border-radius: 50%; border: none; display: flex; align-items:center; justify-content:center; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,0.3); transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);" 
                            onmouseenter="this.style.transform='scale(1.15)';" onmouseleave="this.style.transform='scale(1)';"
                            onclick="window.matchSound('${beat.id}')">
                        <i class="fas fa-heart" style="font-size:1.8rem;"></i>
                    </button>
                </div>
            `;
            stackList.appendChild(slide);

            if (rawCover && window.getAuthorizedUrl) {
                window.getAuthorizedUrl(rawCover, storageVer, beat.id).then(url => {
                    beat.authorized_cover_url = url;
                    const img = document.getElementById(coverImgId);
                    if (img && url) {
                        img.onload = () => { img.style.opacity = '1'; };
                        img.src = url;
                    }
                }).catch(() => {});
            }
        });

        if (typeof Swiper !== 'undefined') {
            const lastIndex = recentSwiperInstance ? recentSwiperInstance.activeIndex : 0;
            if (recentSwiperInstance) recentSwiperInstance.destroy(true, true);
            
            recentSwiperInstance = new Swiper('#recent-swiper', {
                effect: 'slide',
                direction: 'vertical',
                grabCursor: true,
                centeredSlides: true,
                slidesPerView: 1,
                spaceBetween: 30,
                initialSlide: isAppend ? lastIndex : 0,
                navigation: {
                    nextEl: '.explore-nav-down',
                    prevEl: '.explore-nav-up',
                },
                on: {
                    init: function() {
                        renderStudioInsights(window._exploreBeats[this.activeIndex]);
                    },
                    slideChange: function() {
                        renderStudioInsights(window._exploreBeats[this.activeIndex]);
                        if (this.activeIndex >= window._exploreBeats.length - 3) {
                             window.loadMoreBeats();
                        }
                    }
                }
            });
        }
    }

    // Funciones globales para los botones de las cartas
    window.playStackAudio = async (index) => {
        const beat = window._exploreBeats?.[index];
        if (!beat) return;
        const rawAudio = beat.mp3_url || beat.audio_url || '';
        if (!rawAudio) return;
        
        const storageVer = beat.storage_version || beat.r2_version || 'v2';
        try {
            let finalUrl = rawAudio;
            if (window.getAuthorizedUrl) {
                finalUrl = await window.getAuthorizedUrl(rawAudio, storageVer, beat.id);
            }
            
            const coverUrl = beat.authorized_cover_url || beat.image_url || null;
            const producer = beat.producer_nickname || (beat.producer ? beat.producer.nickname : 'Artista');
            const displayTitle = `${beat.name || 'Beat'} - ${producer}`;
            
            updateGlobalPillPlayer(finalUrl, displayTitle, coverUrl);
        } catch (err) {
            console.error('Error al reproducir audio de la pila:', err);
        }
    };

    window.skipBeat = (id) => {
        const strId = String(id);
        if (!window.skippedIds.includes(strId)) {
            window.skippedIds.push(strId);
            localStorage.setItem('skipped_beats', JSON.stringify(window.skippedIds));
        }
        if (recentSwiperInstance) recentSwiperInstance.slideNext();
    };

    window.downloadSample = async (url, title = 'Studio AI Sample') => {
        try {
            if (window.showToast) window.showToast('Etiquetando y descargando...', 'info');
            const apiUrl = `/api/studio/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
            const res = await fetch(apiUrl);
            const blob = await res.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${title.replace(/\s+/g, '_')}.wav`;
            link.click();
        } catch (e) { 
            console.error('[Studio AI] Utility Download failed:', e);
            window.open(url, '_blank'); 
        }
    };

    window.matchSound = async (beatId) => {
        const beat = window._exploreBeats?.find(b => String(b.id) === String(beatId));
        if (!beat) {
            console.warn('[Studio AI] Beat not found in stack:', beatId, window._exploreBeats);
            return;
        }

        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) {
            const authModal = document.getElementById('auth-modal-overlay');
            if (authModal) authModal.style.display = 'flex';
            return;
        }

        // 1. Persistencia en DB (Favoritos)
        try {
            await window.supabaseClient.from('likes').upsert({
                user_id: session.user.id,
                target_type: 'product',
                target_id: beatId
            });
        } catch (err) { console.error('Error saving like:', err); }

        // Agregar al filtro local para que no reaparezca
        const strBeatId = String(beatId);
        if (!window.likedBeatsIds.includes(strBeatId)) {
            window.likedBeatsIds.push(strBeatId);
        }

        // 2. Animación "MATCH!" Premium
        const activeSlide = document.querySelector('.swiper-slide-active .recent-card');
        if (activeSlide && window.gsap) {
            const matchOverlay = document.createElement('div');
            matchOverlay.innerHTML = '¡MATCH!';
            matchOverlay.style.cssText = `
                position: absolute; top:0; left:0; width:100%; height:100%;
                display: flex; align-items: center; justify-content: center;
                background: rgba(255, 255, 255, 0.2); color: #fff;
                font-size: 4rem; font-weight: 900; z-index: 1000;
                opacity: 0; transform: scale(0.5); font-style: italic;
                text-shadow: 0 10px 30px rgba(0,0,0,0.5); border-radius: 20px;
            `;
            activeSlide.appendChild(matchOverlay);

            const tl = gsap.timeline();
            tl.to(matchOverlay, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' });
            tl.to(activeSlide, { scale: 1.05, duration: 0.2 }, "-=0.2");
            tl.to(matchOverlay, { opacity: 0, scale: 1.5, duration: 0.3, delay: 0.5, onComplete: () => {
                matchOverlay.remove();
                window.openMatchModal(beat);
            }});
        } else {
            window.openMatchModal(beat);
        }
    };

    window.openMatchModal = async (beat) => {
        const overlay = document.getElementById('match-modal-overlay');
        const modal = document.getElementById('match-modal');
        if (!overlay || !modal) return;

        overlay.style.display = 'flex';
        setTimeout(() => overlay.classList.add('active'), 10);

        document.getElementById('match-modal-title').innerText = beat.name || 'Beat';
        const producer = beat.producer_nickname || (beat.producer ? beat.producer.nickname : 'Artista');
        const producerEl = document.getElementById('match-modal-producer');
        producerEl.innerText = producer;
        producerEl.href = `/producto/${beat.id}`;
        
        const cover = beat.authorized_cover_url || beat.image_url || '/images/LOGO-OFFSZN.png';
        document.getElementById('match-modal-cover').src = cover;

        // Waveform preview (30s)
        if (!matchWavesurfer) {
            matchWavesurfer = WaveSurfer.create({
                container: '#match-waveform',
                waveColor: 'rgba(255, 255, 255, 0.15)',
                progressColor: '#ffffff',
                barWidth: 3, height: 75, barGap: 3,
                responsive: true, normalize: true,
                crossOrigin: 'anonymous'
            });
            const btnPlay = document.getElementById('btn-match-play');
            btnPlay.onclick = () => matchWavesurfer.playPause();
            matchWavesurfer.on('play', () => btnPlay.innerHTML = '<i class="fas fa-pause"></i>');
            matchWavesurfer.on('pause', () => btnPlay.innerHTML = '<i class="fas fa-play"></i>');
        }

        const rawAudio = beat.mp3_url || beat.audio_url || '';
        const storageVer = beat.storage_version || beat.r2_version || 'v2';
        try {
            let finalUrl = rawAudio;
            if (window.getAuthorizedUrl) {
                finalUrl = await window.getAuthorizedUrl(rawAudio, storageVer, beat.id);
            }
            matchWavesurfer.load(finalUrl);
        } catch (e) { console.error('Error loading modal audio:', e); }

        // Acciones
        document.getElementById('btn-match-generate').onclick = () => window.generateFromMatch(beat);
        document.getElementById('btn-match-goto').onclick = () => {
            window.location.href = `/producto/${beat.id}`;
        };
    };

    window.closeMatchModal = () => {
        const overlay = document.getElementById('match-modal-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.style.display = 'none';
                matchWavesurfer?.stop();
            }, 400);
        }
    };

    window.generateFromMatch = (beat) => {
        window.closeMatchModal();
        switchToTab('generar');
        
        const producer = beat.producer_nickname || (beat.producer ? beat.producer.nickname : 'Artista');
        
        // --- Mejorado: Usar el sistema de TAGS para que se vea como las "reglas" ---
        // 1. Limpiar géneros previos para no mezclar
        selectedGenres = [];
        genreChips.forEach(c => c.classList.remove('active'));
        
        // 2. Añadir el estilo/nombre como una "regla" (tag)
        const matchTag = `MATCH: ${beat.name}`;
        selectedGenres.push(matchTag.toUpperCase());
        renderGenreTags();
        
        // 3. Prompt más conciso (las reglas ya están en los tags)
        const promptText = `Analizar este sonido de ${producer} y refinar textura y tono.`;
        promptInput.value = promptText;
        
        // Forzar evento input para que el auto-resize funcione
        promptInput.dispatchEvent(new Event('input'));
        
        // Efecto visual: el input brilla
        promptInput.style.borderColor = '#ffffff';
        setTimeout(() => promptInput.style.borderColor = '', 2000);
    };

    function renderStudioInsights(item) {
        const insightsCont = document.getElementById('studio-insights');
        if (!insightsCont) return;

        insightsCont.classList.remove('show');
        
        setTimeout(() => {
            insightsCont.innerHTML = `
                <div class="insight-card">
                    <div class="insight-title"><i class="fas fa-microchip"></i> Engine Info</div>
                    <div class="insight-value">${currentModelId}</div>
                    <div class="insight-meta" style="font-size: 0.6rem; color: #444;">Baja latencia • Fidelity High</div>
                </div>
                <div class="insight-card" style="flex: 1.5;">
                    <div class="insight-title"><i class="fas fa-magic"></i> Refinar Sonido</div>
                    <div class="insight-tags">
                        <div class="insight-tag" onclick="window.usePrompt('Más brillante y con aire')">+ Brillo</div>
                        <div class="insight-tag" onclick="window.usePrompt('Añadirle distorsión tipo analógica')">+ Dirt</div>
                        <div class="insight-tag" onclick="window.usePrompt('Ponerle Reverb espacial')">+ Space</div>
                    </div>
                </div>
            `;
            insightsCont.classList.add('show');
        }, 300);
    }

    // ===== DELEGATED EVENT LISTENERS (Chat & History) =====
    // Este sistema evita errores de sintaxis por comillas en el prompt
    document.addEventListener('click', (e) => {
        const loadBtn = e.target.closest('.load-sample-btn');
        const redoBtn = e.target.closest('.redo-prompt-btn');

        if (loadBtn) {
            const url = loadBtn.getAttribute('data-url');
            const prompt = loadBtn.getAttribute('data-prompt');
            // FALSE: Es escucha, no generación
            loadIntoViewport(url, prompt, true, false); 
        }

        if (redoBtn) {
            const prompt = redoBtn.getAttribute('data-prompt');
            window.usePrompt(prompt);
        }
    });

    window.loadSampleInViewport = (url, pr, ap = false) => loadIntoViewport(url, pr, ap, false);
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
    
    // Solo mostramos el mensaje de bienvenida si el chat está vacío (se maneja en fetchChatHistory)
    setTimeout(() => {
        if (chatMessages && chatMessages.children.length === 0) {
            addAiMessage("¡Hey bro! ¿Qué sonido estás buscando hoy? Puedes añadir una referencia de audio arriba para guiarme.", {
                suggestions: ["808 grave oscuro", "Hi-hat rápido", "Snare trap pesado"]
            });
        }
    }, 1000);
});
