document.addEventListener('DOMContentLoaded', () => {

    const steps = document.querySelectorAll('.onboarding-step');
    const step1Form = document.getElementById('step-1-form');
    const step2Form = document.getElementById('step-2-form');
    const step3Form = document.getElementById('step-3-form');
    const nicknameInput = document.getElementById('nickname');
    const nicknameStatus = document.getElementById('nickname-status');
    const btnStep1Next = document.getElementById('btn-step1-next');
    const btnStep2Skip = document.getElementById('btn-step2-skip');
    const btnStep2Next = document.getElementById('btn-step2-next');
    const btnStep3Skip = document.getElementById('btn-step3-skip');
    const btnStep3Finish = document.getElementById('btn-step3-finish');
    const finalMessageDiv = document.getElementById('final-message');

    let currentStep = 1;
    let onboardingData = {
        nickname: '',
        firstName: '',
        lastName: '',
        role: null,
        socials: {} 
    };
    let nicknameAvailable = false;
    let checkNicknameTimeout;

    let API_URL = '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_URL = 'http://localhost:3000/api';
    } else {
        API_URL = 'https://offszn-academy.onrender.com/api';
    }
    const token = localStorage.getItem('authToken');

    if (!token) {
        console.error("No hay token, redirigiendo al login.");
        window.location.replace('/pages/login.html');
        return;
    }

    function goToStep(nextStep) {
        const currentStepEl = document.getElementById(`step-${currentStep}`);
        const nextStepEl = document.getElementById(`step-${nextStep}`);

        if (currentStepEl && nextStepEl) {
            currentStepEl.classList.remove('active');
            currentStepEl.classList.add('hidden-left');

            nextStepEl.classList.remove('hidden-left', 'active');
            nextStepEl.classList.add('hidden-right');
            nextStepEl.style.display = 'block';
            void nextStepEl.offsetWidth;

            setTimeout(() => {
                nextStepEl.classList.remove('hidden-right');
                nextStepEl.classList.add('active');
                setTimeout(() => { currentStepEl.style.display = 'none'; }, 500);
                currentStep = nextStep;
                const firstInput = nextStepEl.querySelector('input, select');
                if (firstInput) firstInput.focus();
            }, 50);
        }
    }

    async function checkNicknameAvailability() {
        const nickname = nicknameInput.value.trim();
        nicknameStatus.textContent = ''; 
        btnStep1Next.disabled = true;
        nicknameAvailable = false;

        if (nickname.length < 3 || nickname.includes(' ')) {
            nicknameStatus.textContent = 'Inválido (mínimo 3 caracteres, sin espacios).';
            nicknameStatus.className = 'nickname-status taken';
            return;
        }

        nicknameStatus.textContent = 'Verificando disponibilidad...';
        nicknameStatus.className = 'nickname-status checking';

        clearTimeout(checkNicknameTimeout);
        checkNicknameTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`${API_URL}/auth/check-nickname`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nickname: nickname })
                });
                const data = await response.json();

                if (response.ok && data.available) {
                    nicknameStatus.textContent = '¡Nickname disponible!';
                    nicknameStatus.className = 'nickname-status available';
                    nicknameAvailable = true;
                    btnStep1Next.disabled = false;
                } else {
                    nicknameStatus.textContent = data.message || 'Nickname no disponible.';
                    nicknameStatus.className = 'nickname-status taken';
                }
            } catch (error) {
                console.error("Error verificando nickname:", error);
                nicknameStatus.textContent = 'Error al verificar.';
                nicknameStatus.className = 'nickname-status taken';
            }
        }, 500); 
    }

    if (nicknameInput) {
        nicknameInput.addEventListener('input', checkNicknameAvailability);
    }
    if (step1Form) {
        step1Form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (nicknameAvailable) {
                onboardingData.nickname = nicknameInput.value.trim();
                goToStep(2);
            }
        });
    }

    if (step2Form) {
        step2Form.addEventListener('submit', (e) => {
            e.preventDefault();
            onboardingData.firstName = document.getElementById('firstName').value.trim();
            onboardingData.lastName = document.getElementById('lastName').value.trim();
            onboardingData.role = document.getElementById('role').value || null;
            goToStep(3);
        });
    }
    if (btnStep2Skip) {
        btnStep2Skip.addEventListener('click', () => goToStep(3));
    }

    if (step3Form) {
        step3Form.addEventListener('submit', async (e) => {
            e.preventDefault();
            btnStep3Finish.disabled = true;
            btnStep3Finish.textContent = 'Guardando...';
            finalMessageDiv.textContent = '';
            finalMessageDiv.className = 'message';

            const instagram = document.getElementById('social-instagram').value.trim();
            const tiktok = document.getElementById('social-tiktok').value.trim();
            const youtube = document.getElementById('social-youtube').value.trim();
            const spotify = document.getElementById('social-spotify').value.trim();
            if (instagram) onboardingData.socials.instagram = instagram;
            if (tiktok) onboardingData.socials.tiktok = tiktok;
            if (youtube) onboardingData.socials.youtube = youtube;
            if (spotify) onboardingData.socials.spotify = spotify;

            try {
                const response = await fetch(`${API_URL}/me/onboarding`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(onboardingData)
                });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Error al guardar el perfil.');
                }

                console.log("Onboarding completado, redirigiendo al dashboard final...");
                window.location.replace('/cuenta/dashboard.html'); 

            } catch (error) {
                console.error("Error al finalizar onboarding:", error);
                finalMessageDiv.textContent = `Error: ${error.message}`;
                finalMessageDiv.classList.add('error');
                btnStep3Finish.disabled = false;
                btnStep3Finish.textContent = 'Finalizar';
            }
        });
    }
    if (btnStep3Skip) {
        btnStep3Skip.addEventListener('click', () => step3Form.requestSubmit());
    }

    steps.forEach((step, index) => {
    if (index === 0) {
        step.classList.add('active');
         step.style.display = 'block'; 
        step.classList.remove('hidden-left', 'hidden-right');
    } else {
        step.classList.remove('active');
        step.style.display = 'none'; 
    }
});
if (nicknameInput) nicknameInput.focus(); 

    function showMessage(element, message, isError = true) {
        if (!element) return;

        element.textContent = message;
        element.className = 'message';

        if (message) {
            element.classList.add(isError ? 'error' : 'success');
        }
    }

});