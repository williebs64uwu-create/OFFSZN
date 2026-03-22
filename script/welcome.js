document.addEventListener('DOMContentLoaded', () => {

  // ============================================
  // CONFIGURACIÓN Y DATOS
  // ============================================
  const chipData = {
    // Reordered roles as requested: "Otro" moved for better layout
    roles: ["Productor Musical", "Artista / Cantante", "Compositor / Songwriter", "Ingeniero de Mezcla/Master", "Músico / Instrumentista", "Otro Rol Musical", "Fan / Consumidor"],
    daws: ["FL Studio", "Ableton Live", "Logic Pro", "Pro Tools", "Studio One", "Cubase", "Reason", "GarageBand", "Reaper", "Bitwig", "Otro"],
    interests: ["Plugins VST", "Hardware", "Tutoriales", "Colaboraciones", "Feedback", "Samples", "Presets", "Masterclass"],
    experience: ["Principiante (0-1 año)", "Intermedio (1-3 años)", "Avanzado (3+ años)"],
    goals: ["Aprender producción", "Mejorar mi sonido", "Lanzar música", "Trabajar profesionalmente", "Crear beats para vender", "Producir para artistas", "Solo por hobby"],
    source: ["YouTube", "Instagram", "TikTok", "Discord", "Recomendación", "Google", "Foro/Comunidad", "Spotify", "Anuncio", "Otro"]
  };

  // ============================================
  // VARIABLES GLOBAL
  // ============================================
  const userData = {
    nickname: '',
    firstName: '',
    lastName: '',
    role: '',
    daws: [],
    interests: [],
    experience: [],
    goals: [],
    source: [],
    socials: {}
  };

  let currentStep = 1;
  let nicknameAvailable = false;
  let checkNicknameTimeout;
  let avatarFile = null;
  let cropper = null;

  const API_URL = `${window.OFFSZN_CONFIG?.API_BASE_URL || 'https://offszn.lat'}/api`;
  const token = localStorage.getItem('authToken');

  // ELEMENTOS DEL DOM
  const nicknameInput = document.getElementById('nickname');
  const firstNameInput = document.getElementById('firstName');
  const lastNameInput = document.getElementById('lastName');
  const roleSelect = document.getElementById('role');
  const nicknameStatus = document.getElementById('nicknameStatus');
  const nextBtn = document.getElementById('nextBtn');
  const backBtn = document.getElementById('backBtn');
  const skipBtn = document.getElementById('skipTop');
  const successModal = document.getElementById('successModal');
  const goToDashboardBtn = document.getElementById('goToDashboard');

  // INIT AVATAR
  setupAvatarUpload();
  setupCharacterCounters();
  // ... (skipped some lines)

  // ============================================
  // VALIDACIÓN DE NICKNAME (STRICT & SECURE)
  // ============================================
  const RESERVED_USERNAMES = [
    'admin', 'administrator', 'root', 'webmaster', 'support', 'help', 'info',
    'api', 'dashboard', 'login', 'register', 'auth', 'user', 'users',
    'css', 'script', 'js', 'images', 'img', 'assets', 'pages', 'public',
    'offszn', 'official', 'server', 'database', 'undefined', 'null', 'test',
    '404', 'robots', 'sitemap', 'favicon', 'home', 'account', 'settings',
    'billing', 'shop', 'cart', 'checkout', 'orders', 'products', 'studio'
  ];

  function setupCharacterCounters() {
    const inputs = [
      { id: 'firstName', counter: 'firstNameCounter' },
      { id: 'lastName', counter: 'lastNameCounter' }
    ];

    inputs.forEach(item => {
      const input = document.getElementById(item.id);
      const counter = document.getElementById(item.counter);
      if (input && counter) {
        input.addEventListener('input', () => {
          const length = input.value.length;
          counter.textContent = `${length}/25`;
          counter.style.color = length === 25 ? '#ef4444' : '#52525b';
          validateCurrentStep();
        });
      }
    });

    // Nickname is handled separately in checkNicknameAvailability
    if (nicknameInput) {
      nicknameInput.addEventListener('input', checkNicknameAvailability);
    }
  }

  let nicknameCheckPromise = null;

  function checkNicknameAvailability() {
    // 1. Limpiar el temporizador ANTES que nada para evitar carreras al borrar rápido
    clearTimeout(checkNicknameTimeout);
    
    if (validationController) {
      validationController.abort(); // Abort pending requests if typing fast
    }

    let nickname = nicknameInput.value;

    // 2. AUTO-SANITIZE: Strict compliance (no spaces, lowercase, safe chars only)
    const sanitized = nickname.toLowerCase().replace(/[^a-z0-9._-]/g, '');

    // Correction Logic: Update input if it contained invalid chars, preserve cursor roughly
    if (sanitized !== nickname) {
      const start = nicknameInput.selectionStart;
      nicknameInput.value = sanitized;
      nickname = sanitized;
      if (start !== null && start > 0) {
        nicknameInput.setSelectionRange(start - 1, start - 1);
      }
    }

    // UPDATE COUNTER
    const counterEl = document.getElementById('nicknameCounter');
    if (counterEl) {
      counterEl.textContent = `${nickname.length}/30`;
      counterEl.style.color = nickname.length === 30 ? '#ef4444' : '#52525b';
    }

    const nicknameStatus = document.getElementById('nicknameStatus');

    // Reset UI while typing/waiting
    nicknameStatus.textContent = '';
    nicknameStatus.className = 'nickname-status';
    nicknameAvailable = false;

    // Hide suggestions
    const suggestionsContainer = document.getElementById('nicknameSuggestions');
    if (suggestionsContainer) {
      suggestionsContainer.innerHTML = '';
      suggestionsContainer.style.display = 'none';
    }

    // 3. Local Validation (Instant)
    const guidanceText = 'Solo se permiten letras (a-z), números, puntos (.) y guiones bajos (_).';

    if (nickname.length === 0) {
      nicknameStatus.textContent = guidanceText; // Show rule when empty
      nicknameStatus.className = 'nickname-status';
      nicknameStatus.style.color = '#71717a'; // Neutral gray hint
      validateCurrentStep();
      return;
    }

    if (nickname.length < 3) {
      nicknameStatus.textContent = 'Mínimo 3 caracteres.';
      nicknameStatus.className = 'nickname-status checking';
      validateCurrentStep();
      return;
    }

    if (nickname.length > 30) {
      nicknameStatus.textContent = 'Máximo 30 caracteres.';
      nicknameStatus.className = 'nickname-status taken';
      validateCurrentStep();
      return;
    }

    // RESERVED WORD CHECK
    if (RESERVED_USERNAMES.includes(nickname) || RESERVED_USERNAMES.some(r => nickname.startsWith(r + '.'))) {
      nicknameStatus.textContent = 'Este nombre de usuario no está permitido.';
      nicknameStatus.className = 'nickname-status taken';
      validateCurrentStep();
      return;
    }

    // 4. Debounced Server Check
    nicknameStatus.textContent = 'Comprobando disponibilidad...';
    nicknameStatus.className = 'nickname-status checking';

    validateCurrentStep(); // Disable next button while waiting

    checkNicknameTimeout = setTimeout(() => {
      performNicknameCheck(nickname, true);
    }, 600);
  }


  let validationController = null;

  async function performNicknameCheck(nickname, silent = false) {
    if (validationController) {
      validationController.abort();
    }
    validationController = new AbortController();

    try {
      // ⚡ FAST & DIRECT: Use Supabase Client
      const { data, error } = await supabaseClient
        .from('users')
        .select('id')
        .ilike('nickname', nickname)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // If data exists, Nickname is TAKEN.
      nicknameAvailable = !data;

      // Update UI
      const nicknameStatus = document.getElementById('nicknameStatus');
      if (nicknameStatus) {
        if (nicknameAvailable) {
          nicknameStatus.textContent = 'Disponible';
          nicknameStatus.className = 'nickname-status available';
        } else {
          nicknameStatus.textContent = 'No disponible';
          nicknameStatus.className = 'nickname-status taken';
        }
      }

    } catch (error) {
      console.error('Error checking nickname:', error);
      nicknameAvailable = false;
      const nicknameStatus = document.getElementById('nicknameStatus');
      if (nicknameStatus) {
        nicknameStatus.textContent = 'Error al verificar';
        nicknameStatus.className = 'nickname-status taken';
      }
    } finally {
      validationController = null;
    }
    validateCurrentStep();
  }


  // ============================================
  // CUSTOM DROPDOWN LOGIC
  // ============================================
  // ============================================
  // CUSTOM DROPDOWN LOGIC
  // ============================================
  function setupCustomDropdown() {
    const dropdown = document.getElementById('roleSelect');
    if (!dropdown) return; // Guard clause
    const trigger = dropdown.querySelector('.select-trigger');
    const options = dropdown.querySelector('.select-options');
    const hiddenInput = document.getElementById('role');
    const displaySpan = trigger.querySelector('.selected-text');

    function closeDropdown() {
      dropdown.classList.remove('open');
      // Reset inline styles
      options.style.position = '';
      options.style.top = '';
      options.style.left = '';
      options.style.width = '';
      options.style.zIndex = '';
    }

    // Toggle
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');

      if (isOpen) {
        closeDropdown();
      } else {
        dropdown.classList.add('open');

        // Dynamic Fixed Positioning
        const rect = trigger.getBoundingClientRect();
        options.style.position = 'fixed';
        options.style.top = (rect.bottom + 6) + 'px'; // 6px gap
        options.style.left = rect.left + 'px';
        options.style.width = rect.width + 'px';
        options.style.zIndex = '9999';
        options.style.display = 'block'; // Ensure it's visible for calculation if needed
      }
    });

    // Select Option
    options.querySelectorAll('.option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.getAttribute('data-value');
        const text = opt.textContent;

        // Set Value
        hiddenInput.value = val;
        displaySpan.textContent = text;
        displaySpan.style.color = '#fff';
        trigger.classList.add('has-value');

        // Visual Selection State
        options.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');

        closeDropdown();
        validateCurrentStep();
      });
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !options.contains(e.target)) {
        closeDropdown();
      }
    });

    // Close on scroll/resize (to prevent floating menu detachment)
    window.addEventListener('resize', closeDropdown);
    window.addEventListener('scroll', closeDropdown, { capture: true });
  }



  // ============================================
  // UTILIDADES
  // ============================================
  function normalizeSpaces(str) {
    return str.replace(/\s+/g, ' ').trim();
  }

  function isValidYouTubeURL(url) {
    if (!url) return true; // Opcional
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/.+$/,
      /^https?:\/\/youtu\.be\/.+$/
    ];
    return patterns.some(pattern => pattern.test(url));
  }

  function isValidSpotifyURL(url) {
    if (!url) return true; // Opcional
    return /^https?:\/\/open\.spotify\.com\/.+$/.test(url);
  }

  // ============================================
  // FUNCIONES DE CHIPS
  // ============================================
  // ============================================
  // FUNCIONES DE CHIPS
  // ============================================
  function createChip(text, category) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.type = 'button';
    chip.textContent = text;
    chip.onclick = () => {
      // Logic for single selection (DAW, Role, Experience, Source)
      if (category === 'daws' || category === 'role' || category === 'experience' || category === 'source') {
        const isRole = category === 'role';
        const isExp = category === 'experience';

        // Update Data
        if (isRole) userData.role = text;
        else if (isExp) userData[category] = [text]; // Keep as array for consistency but max 1
        else userData[category] = [text];

        // Update Hidden Input for Validation (Role only)
        if (isRole) {
          const hiddenInput = document.getElementById('role');
          if (hiddenInput) hiddenInput.value = text;
        }

        // Update UI
        const containerId = isRole ? 'roleChips' : category;
        const container = document.getElementById(containerId);
        if (container) {
          container.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
        }
        chip.classList.add('selected');
      }
      // Logic for multi selection
      else {
        const idx = userData[category].indexOf(text);
        if (idx === -1) {
          userData[category].push(text);
          chip.classList.add('selected');
        } else {
          userData[category].splice(idx, 1);
          chip.classList.remove('selected');
        }
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






  function generateSuggestions(base) {
    const suggestionsContainer = document.getElementById('nicknameSuggestions');
    if (!suggestionsContainer) return;
    suggestionsContainer.innerHTML = '';

    const randomSuffix = Math.floor(Math.random() * 999);
    const variants = [
      `${base}${randomSuffix}`,
      `${base}_music`,
      `iam${base}`
    ];

    const label = document.createElement('div');
    label.className = 'w-full text-zinc-500 text-xs mb-1';
    label.textContent = 'Sugerencias:';
    suggestionsContainer.appendChild(label);

    variants.forEach(variant => {
      const chip = document.createElement('button');
      chip.className = 'suggestion-chip';
      chip.textContent = variant;
      chip.type = 'button';
      chip.onclick = () => {
        nicknameInput.value = variant;
        checkNicknameAvailability();
      };
      suggestionsContainer.appendChild(chip);
    });
  }

  // ============================================
  // MANEJO DE ERRORES
  // ============================================
  function showError(message) {
    const errorEl = document.getElementById('step1Error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('show');
      setTimeout(() => errorEl.classList.remove('show'), 4000);
    }
  }

  function hideError(category) {
    const errorMap = {
      genres: 'genresError',
      daws: 'dawsError',
      experience: 'expError'
    };
    const id = errorMap[category];
    if (id) {
      document.getElementById(id)?.classList.remove('show');
    }
  }

  function showStepError(id, message) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = message;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 4000);
    }
  }

  // ============================================
  // VALIDACIÓN POR PASO
  // ============================================
  function validateCurrentStep() {
    let isValid = false;

    if (currentStep === 1) {
      // Paso 1: Perfil
      const firstName = normalizeSpaces(firstNameInput.value);
      const lastName = normalizeSpaces(lastNameInput.value);
      const role = roleSelect.value;
      const nick = nicknameInput.value.trim();
      // Validamos formato básico para habilitar el botón
      const validNickFormat = /^[a-z0-9._-]+$/.test(nick);
      isValid = nick.length >= 3 && validNickFormat && firstName.length > 0 && lastName.length > 0 && role !== '' && nicknameAvailable;
    } else {
      // Pasos 2-5 son opcionales, siempre válido
      isValid = true;
    }

    nextBtn.disabled = !isValid;
    return isValid;
  }

  async function validateStep() {
    if (currentStep === 1) {
      const nickname = nicknameInput.value.trim();

      if (nickname.length < 3) {
        showError('El usuario debe tener al menos 3 caracteres');
        return false;
      }
      // Strict Regex (No uppercase allowed in final validation)
      if (!/^[a-z0-9._-]+$/.test(nickname)) {
        showError('Usuario inválido (solo letras minúsculas, números, . _ -)');
        return false;
      }

      // Reserved Check
      if (RESERVED_USERNAMES.includes(nickname) || RESERVED_USERNAMES.some(r => nickname.startsWith(r + '.'))) {
        showError('Este nombre de usuario no está permitido');
        return false;
      }

      const firstName = normalizeSpaces(firstNameInput.value);
      if (firstName.length === 0) {
        showError('El nombre es obligatorio');
        return false;
      }
      if (firstName.length > 25) {
        showError('Max 25 caracteres en el nombre');
        return false;
      }
      const lastName = normalizeSpaces(lastNameInput.value);
      if (lastName.length === 0) {
        showError('El apellido es obligatorio');
        return false;
      }
      if (lastName.length > 25) {
        showError('Max 25 caracteres en el apellido');
        return false;
      }
      const role = roleSelect.value;
      if (!role) {
        showError('Selecciona tu rol');
        return false;
      }

      // Check Real Availability if not ready
      if (!nicknameAvailable) {
        const btnText = nextBtn.textContent;
        nextBtn.textContent = 'Verificando...';
        await performNicknameCheck(nickname);
        nextBtn.textContent = btnText;

        if (!nicknameAvailable) {
          showError('Nombre de usuario no disponible');
          return false;
        }
      }

    } else if (currentStep >= 2) {
      // Pasos 2-5 son opcionales
      return true;
    }
    return true;
  }

  function hideError(category) {
    const errorMap = {
      genres: 'genresError',
      daws: 'dawsError',
      experience: 'expError'
    };
    const id = errorMap[category];
    if (id) {
      document.getElementById(id)?.classList.remove('show');
    }
  }

  function showStepError(id, message) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = message;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 4000);
    }
  }



  // ============================================
  // NAVEGACIÓN ENTRE PASOS
  // ============================================
  function updateProgress() {
    const fill = document.getElementById('progressFill');
    // Ahora son 4 pasos en total. (Step 1 -> 0%, Step 4 -> 100% full bar?)
    // Logic: (current - 1) / (total - 1)
    fill.style.width = ((currentStep - 1) / 4) * 100 + '%';

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
    nextBtn.textContent = step === 5 ? 'Finalizar' : 'Continuar';

    updateProgress();
    validateCurrentStep();
  }

  async function nextStep() {
    const isValid = await validateStep();
    if (!isValid) return;

    // Guardar datos del paso actual si son inputs (Paso 1 y 4)
    if (currentStep === 1) {
      userData.nickname = nicknameInput.value.trim();
      userData.firstName = normalizeSpaces(firstNameInput.value);
      userData.lastName = normalizeSpaces(lastNameInput.value);
      userData.role = roleSelect.value;
    }

    // Paso 5 es Redes, guardar antes de enviar
    if (currentStep === 5) {
      // HELPER: Extract username from input (handles @, URL, or plain text)
      const cleanUsername = (val) => {
        if (!val) return '';
        // Remove URL parts if pasted
        let clean = val.replace(/https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\//, '');
        // Remove trailing slash
        clean = clean.replace(/\/$/, '');
        // Remove @ and spaces
        return clean.replace(/[@\s]/g, '');
      };

      const rawIg = document.getElementById('instagram')?.value.trim();
      const rawTik = document.getElementById('tiktok')?.value.trim();
      const youtube = document.getElementById('youtube')?.value.trim();
      const spotify = document.getElementById('spotify')?.value.trim();

      if (rawIg) userData.socials.instagram = cleanUsername(rawIg);
      if (rawTik) userData.socials.tiktok = cleanUsername(rawTik);
      if (youtube) userData.socials.youtube = youtube; // Keep full URL
      if (spotify) userData.socials.spotify = spotify; // Keep full URL
    }

    if (currentStep < 5) {
      currentStep++;
      showStep(currentStep);
    } else {
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

    // 1. Get User ID from Supabase Auth
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      alert("Error: Sesión no válida. Recarga la página.");
      return;
    }

    // 3. Determine if user is a producer based on role
    // Must match the roles defined in chipData (and backend logic)
    const producerRoles = [
      'Productor Musical',
      'Artista / Cantante',
      'Compositor / Songwriter',
      'Ingeniero de Mezcla/Master',
      'Músico / Instrumentista',
      'Otro Rol Musical'
    ];
    // 'Fan / Consumidor' is the only non-producer role usually

    const isProducer = producerRoles.includes(userData.role);

    // SECURITY CHECK: Re-sanitize Nickname before save
    const finalNick = userData.nickname.toLowerCase().trim().replace(/[^a-z0-9._-]/g, '');
    if (finalNick !== userData.nickname || RESERVED_USERNAMES.includes(finalNick)) {
      // If tampering detected or invalid
      alert("Nombre de usuario inválido o reservado.");
      nextBtn.disabled = false;
      return;
    }

    try {
      // UPLOAD AVATAR (If selected) — via Cloudinary
      let avatarUrl = null;
      if (avatarFile) {
        try {
          // Convert blob to base64
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(avatarFile);
          });

          const { data: { session } } = await supabaseClient.auth.getSession();
          if (session) {
            const avatarRes = await fetch(`${API_URL.replace('/api', '')}/api/cloudinary/avatar`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                image: base64,
                isGif: false,
                fileSize: avatarFile.size
              })
            });

            const avatarData = await avatarRes.json();
            if (avatarRes.ok && avatarData.success) {
              avatarUrl = avatarData.url;
            } else {
              console.warn("Avatar upload warning:", avatarData.error);
            }
          }
        } catch (avatarErr) {
          console.warn("Avatar upload warning:", avatarErr);
        }
      }

      const updateData = {
        nickname: finalNick,
        first_name: userData.firstName,
        last_name: userData.lastName,
        role: userData.role,
        genres: userData.genres,
        daws: userData.daws,
        experience: userData.experience,
        goals: userData.goals,
        interests: userData.interests,
        source: userData.source,
        socials: userData.socials,
        is_producer: isProducer,
        onboarding_completed: true,
        updated_at: new Date()
      };
      if (avatarUrl) updateData.avatar_url = avatarUrl;

      // 2. Direct DB Update
      const { error } = await supabaseClient
        .from('users')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      // 3. CREATE DEFAULT PROFILE (Matches Reels dependency)
      // Done silently to ensure subsequent platform features work (like Reels)
      await supabaseClient
        .from('profiles')
        .insert([{
          id: user.id,
          plan: 'free'
        }]).select(); // Use maybeSingle or ignore if already exists? Insert is better for new users.

      console.log('Onboarding completado (DB Direct + Profile)');

      // 4. --- NEW: Send Payment Welcome Notification ---
      if (isProducer) {
        await supabaseClient.from('notifications').insert([{
          user_id: user.id,
          type: 'system_alert',
          title: '¡Configura tu PayPal!',
          message: 'Bienvenido a <strong>OFFSZN</strong>. Para empezar a recibir ventas de tus beats y kits, por favor configura tu correo de PayPal en tus ajustes.',
          read: false,
          data: { action: 'open_paypal_settings', link: '/cuenta/ajustes' }
        }]);
      }

      // Check for pending download
      const pendingDownload = localStorage.getItem('offszn_pending_download');
      if (pendingDownload) {
        if (goToDashboardBtn) {
          goToDashboardBtn.innerHTML = '<i class="bi bi-download"></i> Descargar mi Kit';
          goToDashboardBtn.classList.add('btn-pending-highlight'); // Optional style class
        }
        const modalText = successModal.querySelector('p');
        if (modalText) modalText.innerText = "¡Todo listo! Ya puedes descargar el kit que querías. Te estamos esperando.";
      }

      successModal.classList.add('show');

    } catch (error) {
      console.error('Error al finalizar onboarding:', error);
      // alert(`Error: ${error.message}`); // Silent error better or toast

      // Fallback: If error is RLS (Row Level Security), maybe user doesn't have update rights?
      // But typically user can update own profile.

      const step1Error = document.getElementById('step1Error'); // Reuse error area or alert
      if (step1Error) {
        step1Error.textContent = "Error al guardar. Intenta de nuevo.";
        step1Error.classList.add('show');
      } else {
        alert("Error de conexión al guardar.");
      }

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

  if (firstNameInput) {
    firstNameInput.addEventListener('input', () => {
      const normalized = normalizeSpaces(firstNameInput.value);
      if (firstNameInput.value !== normalized) {
        firstNameInput.value = normalized;
      }

      // UPDATE COUNTER
      const nameCounter = document.getElementById('nameCounter');
      if (nameCounter) {
        const len = firstNameInput.value.length;
        nameCounter.textContent = `${len}/30`;
        nameCounter.style.color = len === 30 ? '#ef4444' : '#52525b';
      }

      validateCurrentStep();
    });
  }

  if (roleSelect) {
    roleSelect.addEventListener('change', validateCurrentStep);
  }

  nextBtn.addEventListener('click', nextStep);
  backBtn.addEventListener('click', prevStep);

  goToDashboardBtn.addEventListener('click', () => {
    // Smart Redirect
    const pendingDownload = localStorage.getItem('offszn_pending_download');
    const returnUrl = localStorage.getItem('offszn_return_after_welcome');

    if (pendingDownload) {
      localStorage.removeItem('offszn_pending_download');
      // Add a flag for auto-opening the modal
      localStorage.setItem('offszn_auto_download_trigger', 'true');
      window.location.href = pendingDownload;
    } else if (returnUrl) {
      // Return to the product page where they claimed the coupon
      localStorage.removeItem('offszn_return_after_welcome');
      window.location.href = returnUrl;
    } else {
      // Default: Redirect to Public Profile
      const nick = userData.nickname || 'user';
      window.location.href = '/@' + nick;
    }
  });

  // ============================================
  // INICIALIZACIÓN
  // ============================================
  renderChips(chipData.roles, 'roleChips', 'role');
  renderChips(chipData.daws, 'daws', 'daws');

  renderChips(chipData.interests, 'interests', 'interests');
  renderChips(chipData.experience, 'experience', 'experience');
  renderChips(chipData.goals, 'goals', 'goals');
  renderChips(chipData.source, 'source', 'source');

  updateProgress();
  validateCurrentStep();

  console.log('Welcome onboarding inicializado');

  // ============================================
  // AVATAR UPLOAD LOGIC
  // ============================================
  function setupAvatarUpload() {
    const dropZone = document.getElementById('avatarDropZone');
    const input = document.getElementById('avatarInput');
    const preview = document.getElementById('avatarPreview');
    const status = document.getElementById('avatarStatus'); // We use this for hints

    const modalOverlay = document.getElementById('cropModalOverlay');
    const cropImage = document.getElementById('cropImage');
    const closeBtn = document.getElementById('closeCropModal');
    const cancelBtn = document.getElementById('cancelCrop');
    const confirmBtn = document.getElementById('confirmCrop');

    if (!dropZone || !input) return;

    // Trigger Input
    dropZone.addEventListener('click', () => input.click());

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault(); e.stopPropagation();
      dropZone.style.borderColor = '#fff';
    });
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault(); e.stopPropagation();
      dropZone.style.borderColor = '#27272a';
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      dropZone.style.borderColor = '#27272a';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    // File Input Change
    input.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
      }
    });

    function handleFile(file) {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/jfif'];
      const isJfif = file.name.toLowerCase().endsWith('.jfif');

      if (!validTypes.includes(file.type) && !isJfif) {
        alert("Solo se aceptan JPG, PNG o JFIF.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        cropImage.src = e.target.result;
        openModal();
      };
      reader.readAsDataURL(file);
    }

    function openModal() {
      modalOverlay.classList.add('active');
      if (cropper) cropper.destroy();
      cropper = new Cropper(cropImage, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        guides: false,
        center: false,
        background: false,
        autoCropArea: 1,
      });
    }

    function closeModal() {
      modalOverlay.classList.remove('active');
      if (cropper) {
        cropper.destroy();
        cropper = null;
      }
      input.value = ''; // Reset
    }

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    confirmBtn.onclick = () => {
      if (!cropper) return;

      try {
        const canvas = cropper.getCroppedCanvas({
          width: 500, height: 500, // Reasonable avatar size
          fillColor: '#000000'
        });

        if (!canvas) {
          throw new Error("No se pudo recortar la imagen");
        }

        canvas.toBlob((blob) => {
          if (!blob) {
            console.error("Canvas to Blob failed");
            return;
          }
          avatarFile = blob; // Save for later upload

          // Update Preview
          const url = URL.createObjectURL(blob);
          preview.src = url;
          dropZone.classList.add('has-image');

          closeModal(); // But keep the blob!

          // FORCE UPDATE BUTTON STATE
          validateCurrentStep();

        }, 'image/jpeg', 0.9);
      } catch (err) {
        console.error("Cropper error:", err);
        alert("Error al recortar la imagen. Intenta con otra.");
        closeModal();
      }
    };
  }
});
