document.addEventListener('DOMContentLoaded', () => {
  // ============================================
  // CONFIGURACIÓN Y DATOS
  // ============================================
  const chipData = {
    roles: ["Productor Musical", "Artista / Cantante", "Compositor / Songwriter", "Ingeniero de Mezcla/Master", "Músico / Instrumentista", "Otro Rol Musical", "Fan / Consumidor"]
  };

  const RESERVED_USERNAMES = [
    'admin', 'administrator', 'root', 'webmaster', 'support', 'help', 'info',
    'api', 'dashboard', 'login', 'register', 'auth', 'user', 'users',
    'css', 'script', 'js', 'images', 'img', 'assets', 'pages', 'public',
    'offszn', 'official', 'server', 'database', 'undefined', 'null', 'test',
    '404', 'robots', 'sitemap', 'favicon', 'home', 'account', 'settings',
    'billing', 'shop', 'cart', 'checkout', 'orders', 'products', 'studio'
  ];

  const API_URL = '/api';
  const token = localStorage.getItem('authToken');

  let nicknameAvailable = false;
  let checkNicknameTimeout;
  let avatarFile = null;
  let cropper = null;
  let referralCheckTimeout;
  let validationController = null;

  // ELEMENTOS DEL DOM
  const nicknameInput = document.getElementById('nickname');
  const nicknameStatus = document.getElementById('nicknameStatus');
  const nicknameCounter = document.getElementById('nicknameCounter');
  const nicknameSuggestions = document.getElementById('nicknameSuggestions');
  
  const roleHidden = document.getElementById('role');
  
  const referralInput = document.getElementById('referralCode');
  const referralStatus = document.getElementById('referralStatus');
  
  const nextBtn = document.getElementById('nextBtn');
  const stepError = document.getElementById('stepError');
  const successModal = document.getElementById('successModal');
  const goToDashboardBtn = document.getElementById('goToDashboard');

  // INIT
  renderChips(chipData.roles, 'roleChips', 'role');
  setupAvatarUpload();
  setupReferralCode();

  // ============================================
  // VALIDACIÓN DE NICKNAME
  // ============================================
  if (nicknameInput) {
    nicknameInput.addEventListener('input', checkNicknameAvailability);
  }

  function checkNicknameAvailability() {
    clearTimeout(checkNicknameTimeout);
    if (validationController) validationController.abort();

    let nickname = nicknameInput.value;
    const sanitized = nickname.toLowerCase().replace(/[^a-z0-9._-]/g, '');

    if (sanitized !== nickname) {
      const start = nicknameInput.selectionStart;
      nicknameInput.value = sanitized;
      nickname = sanitized;
      if (start !== null && start > 0) {
        nicknameInput.setSelectionRange(start - 1, start - 1);
      }
    }

    if (nicknameCounter) {
      nicknameCounter.textContent = `${nickname.length}/30`;
      nicknameCounter.style.color = nickname.length === 30 ? '#ef4444' : '#52525b';
    }

    nicknameStatus.textContent = '';
    nicknameStatus.className = 'nickname-status';
    nicknameAvailable = false;
    nicknameSuggestions.innerHTML = '';
    
    validateForm();

    const guidanceText = 'Solo letras (a-z), números, (.) y (_).';

    if (nickname.length === 0) {
      nicknameStatus.textContent = guidanceText;
      nicknameStatus.style.color = '#71717a';
      return;
    }

    if (nickname.length < 3) {
      nicknameStatus.textContent = 'Mínimo 3 caracteres.';
      nicknameStatus.className = 'nickname-status checking';
      return;
    }

    if (RESERVED_USERNAMES.includes(nickname) || RESERVED_USERNAMES.some(r => nickname.startsWith(r + '.'))) {
      nicknameStatus.textContent = 'Nombre de usuario no permitido.';
      nicknameStatus.className = 'nickname-status taken';
      return;
    }

    nicknameStatus.textContent = 'Comprobando...';
    nicknameStatus.className = 'nickname-status checking';

    checkNicknameTimeout = setTimeout(() => {
      performNicknameCheck(nickname);
    }, 600);
  }

  async function performNicknameCheck(nickname) {
    if (validationController) validationController.abort();
    validationController = new AbortController();

    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('id')
        .ilike('nickname', nickname)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      nicknameAvailable = !data;

      if (nicknameAvailable) {
        nicknameStatus.textContent = 'Disponible';
        nicknameStatus.className = 'nickname-status available';
      } else {
        nicknameStatus.textContent = 'No disponible';
        nicknameStatus.className = 'nickname-status taken';
      }
    } catch (error) {
      console.error('Error checking nickname:', error);
      nicknameAvailable = false;
      nicknameStatus.textContent = 'Error al verificar';
      nicknameStatus.className = 'nickname-status taken';
    } finally {
      validationController = null;
    }
    validateForm();
  }

  // ============================================
  // REFERRAL CODE
  // ============================================
  function setupReferralCode() {
    if (!referralInput) return;
    const savedCode = localStorage.getItem('offszn_referral_code');
    if (savedCode) {
      referralInput.value = savedCode;
      checkReferralCode(savedCode);
    }
    referralInput.addEventListener('input', (e) => {
      const val = e.target.value.trim().toUpperCase();
      referralInput.value = val;
      checkReferralCode(val);
    });
  }

  async function checkReferralCode(code) {
    clearTimeout(referralCheckTimeout);
    if (!referralStatus) return;
    if (!code) {
      referralStatus.style.display = 'none';
      return;
    }

    referralStatus.style.display = 'block';
    referralStatus.textContent = 'Verificando código...';
    referralStatus.style.color = '#71717a';

    referralCheckTimeout = setTimeout(async () => {
      try {
        const { data, error } = await supabaseClient.from('users').select('nickname').eq('referral_code', code).maybeSingle();
        if (error) throw error;
        if (data) {
          referralStatus.textContent = `✅ Código válido (${data.nickname})`;
          referralStatus.style.color = '#22c55e';
        } else {
          referralStatus.textContent = '❌ Código inválido';
          referralStatus.style.color = '#ef4444';
        }
      } catch (err) {
        referralStatus.style.display = 'none';
      }
    }, 500);
  }

  // ============================================
  // FUNCIONES DE CHIPS (ROL)
  // ============================================
  function createChip(text, category) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.type = 'button';
    chip.textContent = text;
    chip.onclick = () => {
      roleHidden.value = text;
      document.getElementById('roleChips').querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      validateForm();
    };
    return chip;
  }

  function renderChips(items, containerId, category) {
    const container = document.getElementById(containerId);
    if (!container) return;
    items.forEach(item => container.appendChild(createChip(item, category)));
  }

  // ============================================
  // VALIDACIÓN GENERAL
  // ============================================
  function showStepError(message) {
    if (stepError) {
      stepError.textContent = message;
      stepError.classList.add('show');
      setTimeout(() => stepError.classList.remove('show'), 4000);
    }
  }

  function validateForm() {
    const nick = nicknameInput.value.trim();
    const role = roleHidden.value;
    const validNickFormat = /^[a-z0-9._-]+$/.test(nick);
    
    const isValid = (nick.length >= 3 && validNickFormat && role !== '' && nicknameAvailable);
    nextBtn.disabled = !isValid;
    return isValid;
  }

  // ============================================
  // AVATAR UPLOAD (CROPPER)
  // ============================================
  function setupAvatarUpload() {
    const dropZone = document.getElementById('avatarDropZone');
    const input = document.getElementById('avatarInput');
    const preview = document.getElementById('avatarPreview');
    const modalOverlay = document.getElementById('cropModalOverlay');
    const closeBtn = document.getElementById('cropCancelBtn');
    const confirmBtn = document.getElementById('cropConfirmBtn');
    const cropImage = document.getElementById('cropImage');

    if (!dropZone || !input || !modalOverlay) return;

    dropZone.addEventListener('click', () => input.click());

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
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    input.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/jfif'];
      if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.jfif')) {
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
      if (cropper) { cropper.destroy(); cropper = null; }
      input.value = ''; 
    }

    closeBtn.onclick = closeModal;

    confirmBtn.onclick = () => {
      if (!cropper) return;
      try {
        const canvas = cropper.getCroppedCanvas({ width: 500, height: 500, fillColor: '#000000' });
        if (!canvas) throw new Error("No se pudo recortar la imagen");
        canvas.toBlob((blob) => {
          if (!blob) return;
          avatarFile = blob; 
          preview.src = URL.createObjectURL(blob);
          dropZone.classList.add('has-image');
          closeModal();
          validateForm();
        }, 'image/jpeg', 0.9);
      } catch (err) {
        alert("Error al recortar la imagen. Intenta con otra.");
        closeModal();
      }
    };
  }

  // ============================================
  // FINALIZAR ONBOARDING
  // ============================================
  nextBtn.addEventListener('click', finishOnboarding);

  async function finishOnboarding() {
    if (!validateForm()) return;
    
    nextBtn.disabled = true;
    nextBtn.textContent = 'Guardando...';

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      showStepError("Error: Sesión no válida. Recarga la página.");
      nextBtn.disabled = false;
      return;
    }

    const finalNick = nicknameInput.value.toLowerCase().trim().replace(/[^a-z0-9._-]/g, '');
    const role = roleHidden.value;
    const refCode = referralInput ? referralInput.value.trim() : '';

    if (RESERVED_USERNAMES.includes(finalNick)) {
      showStepError("Nombre de usuario inválido o reservado.");
      nextBtn.disabled = false;
      return;
    }

    try {
      // UPLOAD AVATAR (If selected)
      let avatarUrl = null;
      if (avatarFile) {
        try {
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(avatarFile);
          });

          const { data: { session } } = await supabaseClient.auth.getSession();
          if (session) {
            const avatarRes = await fetch(`/api/imagekit/avatar`, {
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
            }
          }
        } catch (err) {
          console.warn("Avatar upload warning:", err);
        }
      }

      const updatePayload = {
        nickname: finalNick,
        firstName: '', // Removed from frontend
        lastName: '', // Removed from frontend
        role: role,
        genres: [],    // Removed from frontend
        daws: [],      // Removed from frontend
        experience: [],// Removed from frontend
        goals: [],     // Removed from frontend
        interests: [], // Removed from frontend
        source: [],    // Removed from frontend
        socials: {},   // Removed from frontend
        referralCode: refCode,
        avatarUrl: avatarUrl
      };

      // SERVER ONBOARDING CALL
      const response = await fetch(`${API_URL}/me/onboarding`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatePayload)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error al completar el perfil.');

      // CREATE DEFAULT PROFILE
      await supabaseClient.from('profiles').insert([{ id: user.id, plan: 'free' }]).select();

      // WELCOME NOTIFICATION (PRODUCERS ONLY)
      const producerRoles = ['Productor Musical', 'Artista / Cantante', 'Compositor / Songwriter', 'Ingeniero de Mezcla/Master', 'Músico / Instrumentista', 'Otro Rol Musical'];
      if (producerRoles.includes(role)) {
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
          goToDashboardBtn.classList.add('btn-pending-highlight');
        }
        const modalText = successModal.querySelector('p');
        if (modalText) modalText.innerText = "¡Todo listo! Ya puedes descargar el kit que querías. Te estamos esperando.";
      }

      successModal.classList.add('active'); // Wait, success-modal class logic? Let's check modal logic
      successModal.style.display = 'flex';
      successModal.style.opacity = '1';

      if(goToDashboardBtn) {
        goToDashboardBtn.addEventListener('click', () => {
           window.location.replace('/' + finalNick);
        });
      }

    } catch (error) {
      console.error('Error:', error);
      showStepError(error.message || "Error al guardar. Intenta de nuevo.");
      nextBtn.disabled = false;
      nextBtn.textContent = 'Completar Perfil';
    }
  }
});
