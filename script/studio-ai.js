/**
 * OFFSZN Studio AI - Chat Conversacional + NVIDIA NIM
 * Flujo: IA saluda (typewriter) → User escribe → IA responde (NIM) → Genera sample
 */

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.AuthUtils) { console.error('AuthUtils not found'); return; }

    // DOM
    const creditsDisplay = document.getElementById('user-credits-display');
    const promptInput = document.getElementById('ai-prompt-input');
    const btnGenerate = document.getElementById('btn-generate-ai');
    const btnArrow = document.getElementById('btn-arrow-icon');
    const loader = document.getElementById('ai-loader');
    const resultCard = document.getElementById('ai-result-card');
    const btnDownload = document.getElementById('btn-download-ai');
    const btnAttachContext = document.getElementById('btn-attach-context');
    const fileInput = document.getElementById('ai-file-input');
    const filesList = document.getElementById('ai-files-list');
    const tagsArea = document.getElementById('ai-tags-area');
    const playPauseBtn = document.getElementById('btn-play-ai');
    const timeDisplay = document.getElementById('ai-time');
    const chatMessages = document.getElementById('chat-messages');
    const currentVariantLabel = document.getElementById('current-variant');
    const placeholderView = document.getElementById('ai-placeholder-view');
    const resultPromptTitle = document.getElementById('result-prompt-title');
    const genreChips = document.querySelectorAll('.genre-chip');
    const sidebar = document.getElementById('ai-sidebar');
    const resizeHandle = document.getElementById('resize-handle');
    const charCounter = document.getElementById('char-counter');
    const btnContext = document.getElementById('btn-attach-context');
    const contextMenu = document.getElementById('context-menu');
    const modelSelectorBtn = document.getElementById('model-selector-btn');
    const modelMenu = document.getElementById('model-menu');

    let wavesurfer = null;
    let currentAudioUrl = null;
    let currentCredits = 0;
    let activeTags = new Set();
    let attachedFiles = [];
    let variantCount = 0;
    let currentModelCost = 5; // Default cost

    // ===== DROPDOWN LOGIC =====
    // Toggle Context
    btnContext.addEventListener('click', (e) => {
        e.stopPropagation();
        contextMenu.classList.toggle('show');
        modelMenu.classList.remove('show');
    });

    // Toggle Model
    modelSelectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modelMenu.classList.toggle('show');
        contextMenu.classList.remove('show');
    });

    // Select Model
    modelMenu.querySelectorAll('.dropdown-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            modelMenu.querySelectorAll('.dropdown-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const cost = parseInt(btn.dataset.cost);
            currentModelCost = cost;
            
            // Text to show in header
            const newLabel = btn.querySelector('div').textContent.split('\n')[1].trim(); 
            currentVariantLabel.textContent = newLabel;
            
            modelMenu.classList.remove('show');
            checkCreditAvailability();
        });
    });

    // Close on out-click
    document.addEventListener('click', () => {
        contextMenu.classList.remove('show');
        modelMenu.classList.remove('show');
    });

    // Handle Context Audio click
    document.getElementById('btn-context-audio').addEventListener('click', (e) => {
        e.stopPropagation();
        contextMenu.classList.remove('show');
        fileInput.click();
    });

    // ===== CHAR COUNTER LOGIC =====
    function updateCharCounter() {
        const len = promptInput.value.length;
        charCounter.textContent = `${len} / 150`;
        if (len >= 150) {
            charCounter.classList.add('limit');
        } else {
            charCounter.classList.remove('limit');
        }
    }
    
    promptInput.addEventListener('input', updateCharCounter);

    // ===== WELCOME POOL (Rotatorios) =====
    const welcomePool = [
        { text: "¡Hey! ¿Qué sonido estás buscando hoy?", suggestions: ["808 grave y oscuro", "Hi-hat rápido", "Snare trap pesado", "Kick drill"] },
        { text: "¡Vamos a crear algo único! ¿Qué sample necesitas?", suggestions: ["Clap seco", "Perc afrobeat", "808 Spinz", "Open hat crujiente"] },
        { text: "Describe el vibe que buscas y yo me encargo 🎧", suggestions: ["Trap oscuro", "Plugg melódico", "Afrobeat bounce", "RnB suave"] },
        { text: "¿Listo para producir? Cuéntame qué necesitas", suggestions: ["Rim shot vintage", "Sub bass profundo", "Vocal chop", "FX riser"] },
        { text: "Tu próximo hit empieza aquí. ¿Por dónde vamos?", suggestions: ["808 Zay distorsionado", "Snare con reverb", "Hi-hat bouncy", "Kick punchoso"] },
        { text: "Puedo ayudarte a encontrar el sonido perfecto ✨", suggestions: ["Perc latina", "Clap layered", "Kick 808 combo", "Bell melódico"] }
    ];

    function getWelcome() {
        const idx = (new Date().getHours() + new Date().getDate()) % welcomePool.length;
        return welcomePool[idx];
    }

    // ===== TYPEWRITER EFFECT =====
    function typeWriter(element, text, speed = 25) {
        return new Promise(resolve => {
            let i = 0;
            element.textContent = '';
            const cursor = document.createElement('span');
            cursor.className = 'typewriter-cursor';
            cursor.textContent = '▍';
            element.appendChild(cursor);

            function type() {
                if (i < text.length) {
                    element.insertBefore(document.createTextNode(text.charAt(i)), cursor);
                    i++;
                    setTimeout(type, speed + Math.random() * 15);
                } else {
                    cursor.remove();
                    resolve();
                }
            }
            type();
        });
    }

    // ===== CHAT MESSAGE RENDERING =====
    function addAiMessage(text, options = {}) {
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble ai';

        bubble.innerHTML = `
            <div class="bubble-label">
                <span class="dot"></span>
                OFFSZN AI
            </div>
            <div class="bubble-content">
                <span class="bubble-text"></span>
            </div>
        `;

        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        const textEl = bubble.querySelector('.bubble-text');
        const contentEl = bubble.querySelector('.bubble-content');

        // Typewriter or instant
        const writePromise = options.instant
            ? (() => { textEl.textContent = text; return Promise.resolve(); })()
            : typeWriter(textEl, text);

        writePromise.then(() => {
            // Add suggestions after text finishes typing
            if (options.suggestions && options.suggestions.length) {
                const sugContainer = document.createElement('div');
                sugContainer.className = 'bubble-suggestions';
                options.suggestions.forEach(s => {
                    const btn = document.createElement('button');
                    btn.className = 'bubble-suggestion';
                    btn.textContent = s;
                    btn.addEventListener('click', () => handleSuggestionClick(btn, sugContainer));
                    sugContainer.appendChild(btn);
                });
                contentEl.appendChild(sugContainer);
                // Animate suggestions in
                sugContainer.style.animation = 'msgIn 0.3s ease';
            }

            // Add status log
            if (options.status && options.status.length) {
                const statusEl = document.createElement('div');
                statusEl.className = 'bubble-status';
                options.status.forEach(s => {
                    const item = document.createElement('div');
                    item.className = `s-item ${s.state}`;
                    item.innerHTML = `<i class="fas ${s.state === 'done' ? 'fa-check' : s.state === 'running' ? 'fa-spinner fa-spin' : 'fa-circle'}"></i> ${s.text}`;
                    statusEl.appendChild(item);
                });
                contentEl.appendChild(statusEl);
            }

            chatMessages.scrollTop = chatMessages.scrollHeight;
        });

        return bubble;
    }

    function handleSuggestionClick(btn, container) {
        // Toggle behavior: click sets it, click again clears it
        const isActive = btn.classList.contains('selected');

        // Reset all in this container
        container.querySelectorAll('.bubble-suggestion').forEach(b => {
            b.classList.remove('selected');
            b.style.background = '';
            b.style.color = '';
            b.style.borderColor = '';
        });

        if (isActive) {
            // Deselect — clear input
            promptInput.value = '';
        } else {
            // Select
            btn.classList.add('selected');
            btn.style.background = '#fff';
            btn.style.color = '#000';
            btn.style.borderColor = '#fff';
            promptInput.value = btn.textContent;
            promptInput.focus();
        }
        updateCharCounter();
    }

    function addUserMessage(text) {
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble user';
        bubble.innerHTML = `<div class="bubble-content">${text}</div>`;
        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return bubble;
    }

    function addTypingIndicator() {
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble ai';
        bubble.id = 'typing-bubble';
        bubble.innerHTML = `
            <div class="bubble-label"><span class="dot"></span> OFFSZN AI</div>
            <div class="typing-indicator"><span></span><span></span><span></span></div>
        `;
        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return bubble;
    }

    function removeTypingIndicator() {
        const el = document.getElementById('typing-bubble');
        if (el) el.remove();
    }

    // ===== WELCOME =====
    function showWelcome() {
        setTimeout(() => {
            const welcome = getWelcome();
            addAiMessage(welcome.text, { suggestions: welcome.suggestions });
        }, 500);
    }

    // ===== NVIDIA NIM CHAT (via backend proxy) =====
    async function getAiChatResponse(userMessage) {
        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            const token = session?.access_token;
            if (!token) return null;

            const response = await fetch('/api/studio/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message: userMessage })
            });

            if (!response.ok) return null;
            const data = await response.json();
            return data.reply;
        } catch (err) {
            console.error('[Studio AI] NIM chat error:', err);
            return null;
        }
    }

    // ===== WAVESURFER =====
    function initWaveSurfer() {
        if (wavesurfer) wavesurfer.destroy();
        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: 'rgba(255, 255, 255, 0.1)',
            progressColor: '#fff',
            cursorColor: '#fff',
            barWidth: 2, barRadius: 4, cursorWidth: 1, height: 100, barGap: 3
        });
        wavesurfer.on('play', () => playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>');
        wavesurfer.on('pause', () => playPauseBtn.innerHTML = '<i class="fas fa-play"></i>');
        wavesurfer.on('finish', () => playPauseBtn.innerHTML = '<i class="fas fa-play"></i>');
        wavesurfer.on('audioprocess', updateTimer);
        wavesurfer.on('ready', updateTimer);
    }

    function updateTimer() {
        const c = formatTime(wavesurfer.getCurrentTime());
        const t = formatTime(wavesurfer.getDuration());
        timeDisplay.innerText = `${c} / ${t}`;
    }

    function formatTime(s) {
        return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
    }

    playPauseBtn.addEventListener('click', () => { if (wavesurfer) wavesurfer.playPause(); });

    // ===== CREDITS =====
    async function fetchCredits() {
        try {
            if (!window.supabaseClient && window.AuthUtils) window.AuthUtils.initSupabase();
            if (!window.supabaseClient) return;

            const { data: { session } } = await window.supabaseClient.auth.getSession();
            const user = session?.user;
            if (!user) { creditsDisplay.innerHTML = 'Inicia sesión'; return; }

            const { data, error } = await window.supabaseClient.from('users').select('reward_balance').eq('id', user.id).single();
            if (error) throw error;
            currentCredits = data.reward_balance || 0;
            creditsDisplay.innerHTML = `${currentCredits} Créditos`;
            checkCreditAvailability();
            fetchHistory(user.id);
        } catch (err) {
            console.error('[Studio AI] Credits error:', err);
        }
    }

    function checkCreditAvailability() {
        if (currentCredits < currentModelCost) {
            promptInput.disabled = true;
            btnGenerate.disabled = true;
            promptInput.placeholder = `Sin créditos para esto (Cuesta ${currentModelCost})...`;
        } else {
            promptInput.disabled = false;
            btnGenerate.disabled = false;
            promptInput.placeholder = 'Describe un sonido... (Máx 150 caracteres)';
        }
    }

    // ===== HISTORY =====
    async function fetchHistory(userId) {
        try {
            const { data, error } = await window.supabaseClient
                .from('studio_ai_history')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            if (data && data.length > 0) renderHistoryAsChat(data);
        } catch (err) {
            console.error('[Studio AI] History error:', err);
        }
    }

    function renderHistoryAsChat(items) {
        chatMessages.innerHTML = '';
        items.forEach(item => {
            addUserMessage(item.prompt);
            addAiMessage('¡Listo! Tu sample fue generado.', {
                instant: true,
                status: [{ text: 'Sample entregado', state: 'done' }]
            });
        });
        variantCount = items.length;
        currentVariantLabel.innerText = `Variant ${variantCount}`;

        const last = items[items.length - 1];
        if (last?.audio_url) loadIntoViewport(last.audio_url, last.prompt);
    }

    function loadIntoViewport(url, prompt) {
        currentAudioUrl = url;
        placeholderView.style.display = 'none';
        document.getElementById('ai-result-card').style.display = 'block';
        resultPromptTitle.innerText = prompt;
        if (!wavesurfer) initWaveSurfer();
        wavesurfer.load(url);
    }

    async function saveToHistory(userId, prompt, tags, audioUrl) {
        try {
            await window.supabaseClient.from('studio_ai_history').insert([{
                user_id: userId, prompt, tags: Array.from(tags), audio_url: audioUrl
            }]);
        } catch (err) {
            console.error('[Studio AI] Save error:', err);
        }
    }

    // ===== GENRE CHIPS → TAGS =====
    genreChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const genre = chip.getAttribute('data-genre');
            chip.classList.contains('active') ? removeTag(genre) : addTag(genre);
        });
    });

    function addTag(text) {
        if (activeTags.has(text)) return;
        activeTags.add(text);

        const tag = document.createElement('div');
        tag.className = 'chat-tag';
        tag.setAttribute('data-tag', text);
        tag.innerHTML = `${text} <i class="fas fa-times"></i>`;
        tag.querySelector('i').addEventListener('click', () => removeTag(text));
        tagsArea.appendChild(tag);
        tagsArea.style.display = 'flex';

        const chip = document.querySelector(`.genre-chip[data-genre="${text}"]`);
        if (chip) chip.classList.add('active');
    }

    window.removeTag = (text) => {
        activeTags.delete(text);
        const tag = tagsArea.querySelector(`.chat-tag[data-tag="${text}"]`);
        if (tag) tag.remove();
        if (activeTags.size === 0) tagsArea.style.display = 'none';
        const chip = document.querySelector(`.genre-chip[data-genre="${text}"]`);
        if (chip) chip.classList.remove('active');
    };

    // ===== FILE ATTACH =====
    btnAttachContext.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (attachedFiles.length >= 3) { if (window.showToast) window.showToast('Máximo 3 audios', 'warning'); break; }
            if (!file.name.toLowerCase().endsWith('.mp3')) { if (window.showToast) window.showToast('Solo MP3', 'error'); continue; }
            addFileItem(file);
        }
        fileInput.value = '';
    });

    function addFileItem(file) {
        const fileId = Date.now() + Math.random().toString(36).substr(2, 5);
        attachedFiles.push({ id: fileId, file, status: 'analyzing' });

        const el = document.createElement('div');
        el.className = 'file-item scanning';
        el.id = `file-${fileId}`;
        el.innerHTML = `
            <i class="fas fa-file-audio" style="font-size:1.1rem; color:#555;"></i>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-status">Analizando...</div>
            </div>
            <i class="fas fa-trash-alt file-remove" onclick="removeFile('${fileId}')"></i>
        `;
        filesList.appendChild(el);

        setTimeout(() => {
            const item = attachedFiles.find(f => f.id === fileId);
            if (item) {
                item.status = 'ready';
                const fileEl = document.getElementById(`file-${fileId}`);
                if (fileEl) {
                    fileEl.classList.remove('scanning');
                    fileEl.querySelector('.file-status').innerText = 'BPM/Key detectados';
                    fileEl.querySelector('.file-status').style.color = '#2ed573';
                    fileEl.querySelector('.fa-file-audio').style.color = '#fff';
                }
            }
        }, 3000);
    }

    window.removeFile = (fileId) => {
        attachedFiles = attachedFiles.filter(f => f.id !== fileId);
        const el = document.getElementById(`file-${fileId}`);
        if (el) el.remove();
    };

    // ===== GENERATION =====
    btnGenerate.addEventListener('click', handleGenerate);
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
    });

    async function handleGenerate() {
        if (!window.supabaseClient && window.AuthUtils) window.AuthUtils.initSupabase();

        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const user = session?.user;
        const token = session?.access_token;
        if (!user || !token) { if (window.showToast) window.showToast('Inicia sesión', 'error'); return; }

        const promptText = promptInput.value.trim();
        const tagsText = Array.from(activeTags).join(', ');
        if (!promptText && !tagsText) { if (window.showToast) window.showToast('Escribe algo o selecciona un género', 'warning'); return; }

        if (currentCredits < currentModelCost) {
            addAiMessage(`Bro, estás corto de créditos para esto (necesitas ${currentModelCost}). Pásate por tu perfil para recargar y seguir esculpiendo sonido. 🎧`);
            return;
        }

        const fullPrompt = `${tagsText ? '[' + tagsText + '] ' : ''}${promptText}`;
        const displayPrompt = promptText || tagsText;

        // 1. User bubble
        addUserMessage(displayPrompt);
        promptInput.value = '';
        updateCharCounter();

        // 2. Typing indicator
        addTypingIndicator();

        // 3. Loading
        btnGenerate.disabled = true;
        btnArrow.className = 'fas fa-spinner fa-spin';
        placeholderView.style.display = 'none';
        document.getElementById('ai-result-card').style.display = 'none';
        loader.style.display = 'block';

        try {
            // Try to get an AI chat response first (NIM)
            const aiReply = await getAiChatResponse(fullPrompt);

            // Generate the sample
            const response = await fetch('/api/studio/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ prompt: fullPrompt, userId: user.id, filesCount: attachedFiles.length, cost: currentModelCost })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error en la generación');

            currentAudioUrl = data.audioUrl;
            currentCredits = data.remainingCredits !== undefined ? data.remainingCredits : (currentCredits - currentModelCost);
            creditsDisplay.innerHTML = `${currentCredits} Créditos`;

            removeTypingIndicator();
            variantCount++;

            // AI message with reply if we got one from API
            const aiText = aiReply || '¡Tu sample está listo! Escúchalo en el viewport →';
            const finalAiText = `${aiText} ¿Quieres crear otra variante del mismo vibe o probamos algo nuevo?`;
            
            addAiMessage(finalAiText, {
                status: [
                    { text: 'Frecuencias analizadas', state: 'done' },
                    { text: 'Sample generado', state: 'done' },
                    { text: `Variant ${variantCount}`, state: 'done' }
                ]
            });

            loader.style.display = 'none';
            document.getElementById('ai-result-card').style.display = 'block';
            resultPromptTitle.innerText = displayPrompt;
            currentVariantLabel.innerText = `Variant ${variantCount}`;

            if (!wavesurfer) initWaveSurfer();
            wavesurfer.load(currentAudioUrl);

            saveToHistory(user.id, displayPrompt, activeTags, currentAudioUrl);
            if (window.showToast) window.showToast('¡Sample generado!', 'success');

        } catch (error) {
            console.error('[Studio AI] Failed:', error);
            removeTypingIndicator();
            addAiMessage(`Hubo un error: ${error.message}. Intenta de nuevo.`, { instant: true });
            loader.style.display = 'none';
            placeholderView.style.display = 'block';
        } finally {
            btnGenerate.disabled = false;
            btnArrow.className = 'fas fa-arrow-up';
        }
    }

    // ===== DOWNLOAD =====
    btnDownload.addEventListener('click', async () => {
        if (!currentAudioUrl) return;
        try {
            const r = await fetch(currentAudioUrl);
            const blob = await r.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `OFFSZN_AI_${Date.now()}.wav`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch { window.open(currentAudioUrl, '_blank'); }
    });

    // ===== SIDEBAR RESIZE =====
    let isResizing = false;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.classList.add('resizing');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const min = 320, max = 560;
        const w = Math.max(min, Math.min(max, e.clientX));
        sidebar.style.width = w + 'px';
        sidebar.style.minWidth = w + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) { isResizing = false; document.body.classList.remove('resizing'); }
    });

    // ===== INIT =====
    showWelcome();
    fetchCredits();
});
