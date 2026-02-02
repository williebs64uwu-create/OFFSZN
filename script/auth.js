document.addEventListener('DOMContentLoaded', () => {

  // Use the global client initialized by auth-utils.js
  const supabaseClient = window.supabaseClient;

  // Safety check
  if (!supabaseClient) {
    console.error("Critical: Global Supabase not found. Ensure auth-utils.js is loaded.");
    // alert("Error de conexión con la base de datos.");
    return;
  }

  // ============================================
  // 🆕 OBTENER PARÁMETRO REDIRECT DE LA URL
  // ============================================
  const urlParams = new URLSearchParams(window.location.search);
  const redirectParam = urlParams.get('redirect');

  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');
  const forgotPasswordForm = document.getElementById('forgot-password-form');
  const messageDiv = document.getElementById('form-message');

  // ============================================
  // 🔥 URL BASE DINÁMICA (Local vs Producción)
  // ============================================
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseURL = isLocal ? window.location.origin : 'https://offszn-oc7c.onrender.com';

  console.log(`🌍 Entorno detectado: ${isLocal ? 'LOCAL' : 'PRODUCCIÓN'} -> BaseURL: ${baseURL}`);

  // ============================================
  // 🛡️ HELPER: TRANSLATE ERRORS TO SPANISH
  // ============================================
  function translateError(msg) {
    if (!msg) return "Ocurrió un error desconocido.";
    const lower = msg.toLowerCase();

    if (lower.includes("user already registered")) return "Este correo ya está registrado.";
    if (lower.includes("valid email")) return "Ingresa un correo válido.";
    if (lower.includes("password")) return "La contraseña no es válida o es muy corta.";
    if (lower.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
    if (lower.includes("email not confirmed")) return "Debes verificar tu correo electrónico antes de entrar.";
    if (lower.includes("user not found")) return "No encontramos una cuenta con este correo.";
    if (lower.includes("too many requests")) return "Demasiados intentos. Espera un momento.";

    return "Ocurrió un error. Inténtalo de nuevo."; // Fallback generic
  }

  // ============================================
  // REGISTRO
  // ============================================
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-password').value;
      const messageDiv = document.getElementById('form-message');
      const submitButton = registerForm.querySelector('button[type="submit"]');

      showMessage(messageDiv, '', false);
      submitButton.disabled = true;
      submitButton.textContent = 'Creando cuenta...';

      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email: email,
          password: password,
          options: {
            emailRedirectTo: `${baseURL}/pages/welcome.html`
          }
        });

        if (error) {
          throw error;
        }

        if (data.user && !data.session) {
          // Case 1: Registration successful, but Email Confirmation is enabled (No session yet)
          console.log("Registro exitoso. Esperando verificación de correo.");
          sessionStorage.setItem('pendingEmailVerification', 'true');
          sessionStorage.setItem('pendingEmail', email); // Save email for display
          window.location.href = '/pages/verify-email.html';
        }
        else if (data.session && data.session.access_token) {
          // Case 2: Email Confirmation DISABLED (Auto-login)
          localStorage.setItem('authToken', data.session.access_token);

          // --- SECURITY: Sync Token to Cookie ---
          const token = data.session.access_token;
          const maxAge = 60 * 60 * 24 * 7;
          document.cookie = `sb-access-token=${token}; path=/; max-age=${maxAge}; SameSite=Strict; Secure`;

          console.log("Registro exitoso, sesión iniciada.");

          if (redirectParam === 'carrito') {
            window.location.href = '/carrito.html';
          } else {
            console.log("Registro exitoso. Redirigiendo a Welcome...");
            window.location.href = '/pages/welcome.html';
          }
        }
        else {
          // Edge Case
          window.location.href = '/pages/verify-email.html';
        }

      } catch (error) {
        console.error('Error de registro:', error);

        const lower = error.message.toLowerCase();
        let handledInline = false;

        // 1. Check for Duplicate Email
        if (lower.includes("user already registered") || lower.includes("already registered")) {
          if (window.showRegisterError) {
            window.showRegisterError('email', 'Este correo ya está registrado. Intenta iniciar sesión.');
            handledInline = true;
          }
        }
        // 2. Check for Password Issues (Server side)
        else if (lower.includes("password") && !lower.includes("email")) {
          if (window.showRegisterError) {
            window.showRegisterError('password', 'La contraseña debe ser válida (mín. 6 caracteres).');
            handledInline = true;
          }
        }
        // 3. Check for Invalid Email (Server side)
        else if (lower.includes("valid email")) {
          if (window.showRegisterError) {
            window.showRegisterError('email', 'Ingresa un correo válido.');
            handledInline = true;
          }
        }

        // Only show global message if NOT handled inline
        if (!handledInline) {
          showMessage(messageDiv, translateError(error.message), true);
        } else {
          // Ensure global message is clear if it was previously set
          showMessage(messageDiv, '', false);
        }

        submitButton.disabled = false;
        submitButton.textContent = 'Crear Cuenta';
      }
    });
  }

  // ============================================
  // LOGIN
  // ============================================
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('log-email').value;
      const password = document.getElementById('log-password').value;
      const submitButton = loginForm.querySelector('button[type="submit"]');

      // Clear previous
      showMessage(messageDiv, '', false);

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Procesando...';
      }

      try {
        const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (loginError) {
          throw loginError;
        }

        const { data: profileData, error: profileError } = await supabaseClient
          .from('users')
          .select('is_admin')
          .eq('id', loginData.user.id)
          .single();

        if (profileError) {
          throw new Error('Login exitoso, pero no se pudo leer el perfil: ' + profileError.message);
        }

        localStorage.setItem('authToken', loginData.session.access_token);

        // --- SECURITY: Sync Token to Cookie for Server Validation ---
        const token = loginData.session.access_token;
        const maxAge = 60 * 60 * 24 * 7; // 1 week
        document.cookie = `sb-access-token=${token}; path=/; max-age=${maxAge}; SameSite=Strict; Secure`;


        // ✅ PRIORIDAD 1: Redirect al carrito si viene de ahí
        if (redirectParam === 'carrito') {
          console.log('Redirigiendo al carrito...');
          window.location.href = '/carrito.html';
          return;
        }

        // ✅ PRIORIDAD 2: Si es admin, a dashboard admin
        if (profileData && profileData.is_admin === true) {
          console.log("Usuario es Admin, redirigiendo a /admin-frontend/admin_dashboard.html");
          window.location.href = '/admin-frontend/admin_dashboard.html';
        } else {
          // ✅ PRIORIDAD 3: Inteligente (Welcome vs Home)
          const { data: profileCheck } = await supabaseClient
            .from('users')
            .select('nickname')
            .eq('id', loginData.user.id)
            .single();

          if (profileCheck && profileCheck.nickname) {
            // Usuario Veterano -> Perfil Público (Directo)
            const profilePath = `/${profileCheck.nickname}`;
            console.log(`Usuario completo. Redirigiendo a ${profilePath}`);
            window.location.href = profilePath;
          } else {
            // Usuario Nuevo -> Welcome
            console.log("Usuario incompleto. Redirigiendo a /pages/welcome.html");
            window.location.href = '/pages/welcome.html';
          }
        }

      } catch (error) {
        console.error('Error de inicio de sesión:', error);
        // Use translateError here
        showMessage(messageDiv, translateError(error.message), true);

        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Iniciar Sesión';
        }
      }
    });
  }

  // ============================================
  // RECUPERAR CONTRASEÑA (FORGOT PASSWORD)
  // ============================================
  // ============================================
  // RECUPERAR CONTRASEÑA (FORGOT PASSWORD)
  // ============================================
  if (forgotPasswordForm) {
    const COOLDOWN_SECONDS = 60;
    const submitButton = forgotPasswordForm.querySelector('button[type="submit"]');
    const inputEmail = document.getElementById('recovery-email');

    // 🕒 Check Cooldown on Load
    function checkCooldown() {
      const lastRequest = localStorage.getItem('lastResetRequest');
      if (lastRequest) {
        const elapsed = (Date.now() - parseInt(lastRequest)) / 1000;
        if (elapsed < COOLDOWN_SECONDS) {
          const remaining = Math.ceil(COOLDOWN_SECONDS - elapsed);
          disableButtonWithTimer(remaining);
        } else {
          localStorage.removeItem('lastResetRequest'); // Expired
        }
      }
    }

    function disableButtonWithTimer(seconds) {
      submitButton.disabled = true;
      inputEmail.disabled = true;

      let counter = seconds;
      submitButton.textContent = `Reenviar en ${counter}s`;

      const interval = setInterval(() => {
        counter--;
        if (counter <= 0) {
          clearInterval(interval);
          submitButton.disabled = false;
          inputEmail.disabled = false;
          submitButton.textContent = 'Enviar enlace de recuperación';
          localStorage.removeItem('lastResetRequest');
        } else {
          submitButton.textContent = `Reenviar en ${counter}s`;
        }
      }, 1000);
    }

    // Run check immediately
    checkCooldown();

    forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = inputEmail.value;

      showMessage(messageDiv, '', false);
      submitButton.disabled = true;
      submitButton.textContent = 'Enviando...';

      try {
        const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: `${baseURL}/pages/update-password.html`,
        });

        if (error) throw error;

        // Success state
        showMessage(messageDiv, '¡Enlace enviado! Revisa tu correo.', false);

        // 🕒 Set Cooldown
        localStorage.setItem('lastResetRequest', Date.now().toString());
        disableButtonWithTimer(COOLDOWN_SECONDS);

      } catch (error) {
        console.error('Error reset password:', error);

        // Handle "Too Many Requests" specifically if not caught by local timer
        if (error.message.includes("Too many requests") || error.status === 429) {
          showMessage(messageDiv, "Demasiados intentos. Espera unos segundos.", true);
          localStorage.setItem('lastResetRequest', Date.now().toString()); // Force cooldown
          disableButtonWithTimer(COOLDOWN_SECONDS);
        } else {
          showMessage(messageDiv, translateError(error.message), true);
          submitButton.disabled = false;
          submitButton.textContent = 'Enviar enlace de recuperación';
        }
      }
    });
  }

  // ============================================
  // ACTUALIZAR CONTRASEÑA (UPDATE PASSWORD)
  // ============================================
  // ============================================
  // ACTUALIZAR CONTRASEÑA (UPDATE PASSWORD)
  // ============================================
  const updatePasswordForm = document.getElementById('update-password-form');
  if (updatePasswordForm) {
    // 🔒 SECURIZATION: Verify we have a session (Magic Link or Logged In)
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // No valid session -> Invalid link or direct access
        console.warn('⚠️ Acceso a update-password sin sesión. Redirigiendo...');
        document.querySelector('main').innerHTML = `
          <div class="text-center">
             <h1 class="text-white text-2xl font-semibold mb-2">Enlace no válido</h1>
             <p class="text-zinc-400 text-sm mb-6">El enlace de recuperación ha expirado o es inválido.</p>
             <a href="/pages/login.html" class="btn-primary px-6 py-3 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-colors">
               Volver al Inicio
             </a>
          </div>
        `;
      } else {
        console.log('✅ Sesión válida para actualizar contraseña.');
      }
    });

    // Check if we have a session (user clicked link from email)
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth State Change:', event);
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked magic link, now we are in recovery mode
      }
    });

    updatePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPassword = document.getElementById('new-password').value;
      const messageDiv = document.getElementById('form-message');
      const submitButton = updatePasswordForm.querySelector('button[type="submit"]');

      if (newPassword.length < 6) {
        showMessage(messageDiv, 'La contraseña debe tener al menos 6 caracteres.', true);
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'Actualizando...';

      try {
        const { data, error } = await supabaseClient.auth.updateUser({
          password: newPassword
        });

        if (error) throw error;

        showMessage(messageDiv, '¡Contraseña actualizada! Redirigiendo...', false);

        // Wait a sec then redirect to home
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);

      } catch (error) {
        console.error('Error updating password:', error);
        showMessage(messageDiv, translateError(error.message), true);
        submitButton.disabled = false;
        submitButton.textContent = 'Actualizar Contraseña';
      }
    });
  }

  // ============================================
  // 🆕 OAUTH - GOOGLE
  // ============================================
  window.signUpWithGoogle = async function () {
    try {
      const callbackURL = redirectParam === 'carrito'
        ? `${baseURL}/pages/auth-callback.html?redirect=carrito`
        : `${baseURL}/pages/auth-callback.html`;

      console.log('🔍 OAuth Google - Callback URL:', callbackURL);

      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackURL
        }
      });

      if (error) throw error;
    } catch (error) {
      console.error('❌ Error con Google OAuth:', error);
      if (messageDiv) {
        showMessage(messageDiv, 'Error al iniciar sesión con Google: ' + error.message, true);
      }
    }
  };

  // ============================================
  // 🆕 OAUTH - APPLE
  // ============================================
  window.signUpWithApple = async function () {
    try {
      const callbackURL = redirectParam === 'carrito'
        ? `${baseURL}/pages/auth-callback.html?redirect=carrito`
        : `${baseURL}/pages/auth-callback.html`;

      console.log('🔍 OAuth Apple - Callback URL:', callbackURL);

      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: callbackURL
        }
      });

      if (error) throw error;
    } catch (error) {
      console.error('❌ Error con Apple OAuth:', error);
      if (messageDiv) {
        showMessage(messageDiv, 'Error al iniciar sesión con Apple: ' + error.message, true);
      }
    }
  };

  // ============================================
  // HELPER: Mostrar mensajes
  // ============================================
  function showMessage(element, message, isError = true) {
    if (!element) return;
    element.textContent = message;
    element.className = 'form-message';
    if (message) {
      element.classList.add(isError ? 'error' : 'success');
    }
  }
});
