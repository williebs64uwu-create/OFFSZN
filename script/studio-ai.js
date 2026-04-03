/**
 * OFFSZN Studio AI - Text-to-Sample Implementation
 * Handles generation requests, credits validation and audio playback.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Wait for AuthUtils to be ready if needed, or just use it
    if (!window.AuthUtils) {
        console.error('AuthUtils not found');
        return;
    }

    const creditsDisplay = document.getElementById('user-credits-display');
    const promptInput = document.getElementById('ai-prompt-input');
    const btnGenerate = document.getElementById('btn-generate-ai');
    const feedback = document.getElementById('ai-feedback');
    const loader = document.getElementById('ai-loader');
    const resultCard = document.getElementById('ai-result-card');
    const audioPlayer = document.getElementById('ai-audio-player');
    const btnDownload = document.getElementById('btn-download-ai');
    let currentAudioUrl = null;
    let currentCredits = 0;

    async function fetchCredits() {
        try {
            // Ensure Supabase is initialized
            if (!window.supabaseClient && window.AuthUtils) {
                window.AuthUtils.initSupabase();
            }

            if (!window.supabaseClient) {
                creditsDisplay.innerHTML = `Error de conexión`;
                return;
            }

            // More robust: wait for the actual session
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            const user = session?.user;

            if (!user) {
                creditsDisplay.innerHTML = `Inicia sesión para generar`;
                return;
            }

            const { data, error } = await window.supabaseClient
                .from('users')
                .select('reward_balance')
                .eq('id', user.id)
                .single();
            
            if (error) throw error;
            currentCredits = data.reward_balance || 0;
            creditsDisplay.innerHTML = `<i class="fas fa-gem" style="margin-right: 5px;"></i> ${currentCredits} Créditos`;
        } catch (err) {
            console.error('[Studio AI] Error fetching credits:', err);
            creditsDisplay.innerHTML = `Error al cargar créditos`;
        }
    }

    // Initial load
    await fetchCredits();

    btnGenerate.addEventListener('click', async () => {
        // Ensure supabase is ready
        if (!window.supabaseClient && window.AuthUtils) window.AuthUtils.initSupabase();
        
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const user = session?.user;
        const token = session?.access_token;

        if (!user || !token) {
            if (window.showToast) window.showToast('Debes iniciar sesión para usar la IA', 'error');
            else alert('Debes iniciar sesión para usar la IA');
            return;
        }

        const prompt = promptInput.value.trim();
        if (!prompt) {
            showFeedback('Por favor, describe qué sample quieres generar.', 'error');
            return;
        }

        if (currentCredits < 5) {
            showFeedback('Créditos insuficientes (Costo: 5). Consigue más en tu perfil.', 'error');
            return;
        }

        // UI State: Loading
        setLoadingState(true);

        try {
            const response = await fetch('/api/studio/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    prompt: prompt,
                    userId: user.id 
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error en la generación');
            }

            // Success
            currentAudioUrl = data.audioUrl;
            audioPlayer.src = currentAudioUrl;
            audioPlayer.load(); // Fuerza la carga para mostrar la onda/duración
            
            // Deduct locally and sync
            currentCredits = data.remainingCredits !== undefined ? data.remainingCredits : (currentCredits - 5);
            creditsDisplay.innerHTML = `<i class="fas fa-gem" style="margin-right: 5px;"></i> ${currentCredits} Créditos`;

            // Result display
            loader.style.display = 'none';
            resultCard.style.display = 'block';
            
            if (window.showToast) window.showToast('¡Sample generado con éxito!', 'success');

        } catch (error) {
            console.error('[Studio AI] Generation failed:', error);
            showFeedback(error.message, 'error');
            loader.style.display = 'none';
        } finally {
            btnGenerate.disabled = false;
        }
    });

    function setLoadingState(isLoading) {
        feedback.style.display = 'none';
        resultCard.style.display = 'none';
        loader.style.display = isLoading ? 'block' : 'none';
        btnGenerate.disabled = isLoading;
        if (isLoading) {
            btnGenerate.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
        } else {
            btnGenerate.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Generar';
        }
    }

    function showFeedback(msg, type) {
        feedback.innerText = msg;
        feedback.style.color = type === 'error' ? '#ff4757' : '#2ed573';
        feedback.style.display = 'block';
    }

    // Handle download
    btnDownload.addEventListener('click', async () => {
        if (!currentAudioUrl) return;
        
        try {
            // Direct download might be blocked by CORS for external URLs, 
            // so we try a simple cross-origin friendly approach
            const response = await fetch(currentAudioUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `OFFSZN_Sample_${Date.now()}.wav`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            // Fallback to direct link
            window.open(currentAudioUrl, '_blank');
        }
    });
});
