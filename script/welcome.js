document.addEventListener('DOMContentLoaded', () => {

  // ============================================
  // CONFIGURACIÓN Y DATOS
  // ============================================
  const chipData = {
    genres: ["Hip-Hop", "Trap", "R&B", "Pop", "EDM", "House", "Techno", "Dubstep", "Drum & Bass", "Lo-Fi", "Reggaeton", "Latin", "Rock", "Metal", "Jazz", "Soul", "Funk", "Ambient", "Orchestral", "Synthwave", "Indie", "Afrobeats"],
    daws: ["FL Studio", "Ableton Live", "Logic Pro", "Pro Tools", "Studio One", "Cubase", "Reason", "GarageBand", "Reaper", "Bitwig", "Otro"],
    skills: ["Beatmaking", "Mixing", "Mastering", "Sound Design", "Sampling", "Síntesis", "Composición", "Arreglos", "Grabación", "Vocal Production"],
    interests: ["Plugins VST", "Hardware", "Tutoriales", "Colaboraciones", "Feedback", "Samples", "Presets", "Masterclass"],
    experience: ["Principiante (0-1 año)", "Intermedio (1-3 años)", "Avanzado (3-5 años)", "Profesional (5+ años)"],
    goals: ["Aprender producción", "Mejorar mi sonido", "Lanzar música", "Trabajar profesionalmente", "Crear beats para vender", "Producir para artistas", "Solo por hobby"],
    source: ["YouTube", "Instagram", "TikTok", "Recomendación", "Google", "Foro/Comunidad", "Spotify", "Anuncio", "Otro"]
  };

  const userData = {
    nickname: '',
    firstName: '',
    lastName: '',
    role: '',
    genres: [],
    daws: [],
    skills: [],
    interests: [],
    experience: [],
    goals: [],
    source: [],
    socials: {}
  };

  let currentStep = 1;
  let nicknameAvailable = false;
  let checkNicknameTimeout;

  const API_URL = 'https://offszn-academy.onrender.com/api';
  const token = localStorage.getItem('authToken');

  // ============================================
  // ELEMENTOS DEL DOM
  // ============================================
  const nicknameInput = document.getElementById('nickname');
  const nicknameStatus = document.getElementById('nicknameStatus');
  const nextBtn = document.getElementById('nextBtn');
  const backBtn = document.getElementById('backBtn');
  const skipBtn = document.getElementById('skipTop');
  const successModal = document.getElementById('successModal');
  const goToDashboardBtn = document.getElementById('goToDashboard');

  // ============================================
  // FUNCIONES DE CHIPS
  // ============================================
  function createChip(text, category) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.type = 'button';
    chip.textContent = text;
    chip.onclick = () => {
      const idx = userData[category].indexOf(text);
      if (idx === -1) {
        // Agregar
        userData[category].push(text);
        chip.classList.add('selected');
      } else {
        // Quitar
        userData[category].splice(idx, 1);
        chip.classList.remove('selected');
      }
      hideError(category);
      validateCurrentStep();
    };
    return chip;
  }

  function renderChips(items, containerId, category) {
    const container = document.getElementById(containerId);
    if (!container) return;
    items.forEach(item => container.appendChild(createChip(item, category)));
  }

  // ============================================
  // VALIDACIÓN DE NICKNAME
  // ============================================
  async function checkNicknameAvailability() {
    const nickname = nicknameInput.value.trim();
    nicknameStatus.textContent = '';
    nicknameAvailable = false;
    nextBtn.disabled = true;

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
          nextBtn.disabled = false;
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

  // ============================================
  // MANEJO DE ERRORES
  // ============================================
  function showError(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 3000);
    }
  }

  function hideError(category) {
    const errorMap = {
      genres: 'genresError',
      daws: 'dawsError',
      experience: 'expError',
      nickname: 'step1Error'
    };
    const id = errorMap[category];
    if (id) {
      document.getElementById(id)?.classList.remove('show');
    }
  }

  // ============================================
  // VALIDACIÓN POR PASO
  // ============================================
  function validateCurrentStep() {
    let isValid = false;

    if (currentStep === 1) {
      // Validar nickname
      isValid = nicknameAvailable;
    } else if (currentStep === 2) {
      // Validar géneros y DAWs
      isValid = userData.genres.length > 0 && userData.daws.length > 0;
    } else if (currentStep === 3) {
      // Opcional, siempre válido
      isValid = true;
    } else if (currentStep === 4) {
      // Validar experiencia
      isValid = userData.experience.length > 0;
    }

    nextBtn.disabled = !isValid;
    return isValid;
  }

  function validateStep() {
    if (currentStep === 1) {
      if (!nicknameAvailable) {
        showError('step1Error');
        return false;
      }
    } else if (currentStep === 2) {
      if (userData.genres.length === 0) {
        showError('genresError');
        return false;
      }
      if (userData.daws.length === 0) {
        showError('dawsError');
        return false;
      }
    } else if (currentStep === 4) {
      if (userData.experience.length === 0) {
        showError('expError');
        return false;
      }
    }
    return true;
  }

  // ============================================
  // NAVEGACIÓN ENTRE PASOS
  // ============================================
  function updateProgress() {
    const fill = document.getElementById('progressFill');
    fill.style.width = ((currentStep - 1) / 3) * 100 + '%';

    document.querySelectorAll('.step').forEach((step, i) => {
      const num = i + 1;
      step.classList.remove('active', 'completed');
      
      if (num < currentStep) {
        step.classList.add('completed');
        step.querySelector('.step-num').innerHTML = '<svg style="width:16px;height:16px;stroke-width:3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
      } else if (num === currentStep) {
        step.classList.add('active');
        step.querySelector('.step-num').textContent = num;
      } else {
        step.querySelector('.step-num').textContent = num;
      }
    });
  }

  function showStep(step) {
    document.querySelectorAll('.step-view').forEach(v => v.classList.remove('active'));
    document.querySelector('.step-view[data-step="' + step + '"]').classList.add('active');

    backBtn.style.display = step === 1 ? 'none' : 'block';
    nextBtn.textContent = step === 4 ? 'Finalizar' : 'Continuar';

    updateProgress();
    validateCurrentStep();
  }

  function nextStep() {
    if (!validateStep()) return;

    // Guardar datos del paso actual
    if (currentStep === 1) {
      userData.nickname = nicknameInput.value.trim();
      userData.firstName = document.getElementById('firstName').value.trim();
      userData.lastName = document.getElementById('lastName').value.trim();
      userData.role = document.getElementById('role').value;
    } else if (currentStep === 4) {
      // Guardar redes sociales
      const instagram = document.getElementById('instagram')?.value.trim();
      const tiktok = document.getElementById('tiktok')?.value.trim();
      const youtube = document.getElementById('youtube')?.value.trim();
      const spotify = document.getElementById('spotify')?.value.trim();
      
      if (instagram) userData.socials.instagram = instagram;
      if (tiktok) userData.socials.tiktok = tiktok;
      if (youtube) userData.socials.youtube = youtube;
      if (spotify) userData.socials.spotify = spotify;
    }

    if (currentStep < 4) {
      currentStep++;
      showStep(currentStep);
    } else {
      // Finalizar onboarding
      finishOnboarding();
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  }

  // ============================================
  // FINALIZAR ONBOARDING
  // ============================================
  async function finishOnboarding() {
    nextBtn.disabled = true;
    nextBtn.textContent = 'Guardando...';

    try {
      const response = await fetch(`${API_URL}/me/onboarding`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al guardar el perfil.');
      }

      console.log('✅ Onboarding completado');
      successModal.classList.add('show');

    } catch (error) {
      console.error('❌ Error al finalizar onboarding:', error);
      alert(`Error: ${error.message}`);
      nextBtn.disabled = false;
      nextBtn.textContent = 'Finalizar';
    }
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================
  if (nicknameInput) {
    nicknameInput.addEventListener('input', checkNicknameAvailability);
  }

  nextBtn.addEventListener('click', nextStep);
  backBtn.addEventListener('click', prevStep);

  skipBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('¿Seguro que quieres saltar la personalización? Puedes completarla después desde tu perfil.')) {
      window.location.href = '/cuenta/dashboard.html';
    }
  });

  goToDashboardBtn.addEventListener('click', () => {
    window.location.replace('/cuenta/dashboard.html');
  });

  // ============================================
  // INICIALIZACIÓN
  // ============================================
  renderChips(chipData.genres, 'genres', 'genres');
  renderChips(chipData.daws, 'daws', 'daws');
  renderChips(chipData.skills, 'skills', 'skills');
  renderChips(chipData.interests, 'interests', 'interests');
  renderChips(chipData.experience, 'experience', 'experience');
  renderChips(chipData.goals, 'goals', 'goals');
  renderChips(chipData.source, 'source', 'source');

  updateProgress();
  validateCurrentStep();

  console.log('✅ Welcome onboarding inicializado');
});
