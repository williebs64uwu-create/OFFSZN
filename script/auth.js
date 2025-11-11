document.addEventListener('DOMContentLoaded', () => {

  const SUPABASE_URL = "https://qtjpvztpgfymjhhpoouq.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Error: Las variables de Supabase no están configuradas...");
    alert("Error de configuración. Contacta al administrador.");
    return;
  }

  const { createClient } = supabase;
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ============================================
  // 🆕 OBTENER PARÁMETRO REDIRECT DE LA URL
  // ============================================
  const urlParams = new URLSearchParams(window.location.search);
  const redirectParam = urlParams.get('redirect');

  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');
  const messageDiv = document.getElementById('form-message');

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
          password: password
        });

        if (error) {
          throw error;
        }

        if (data.session && data.session.access_token) {
          localStorage.setItem('authToken', data.session.access_token);
          console.log("Registro exitoso, token de Supabase guardado.");
          
          // ✅ REDIRIGIR SEGÚN EL PARÁMETRO
          if (redirectParam === 'carrito') {
            console.log('Redirigiendo al carrito...');
            window.location.href = '/carrito.html';
          } else {
            window.location.href = '/pages/welcome.html';
          }
        } else {
          throw new Error('Registro exitoso pero no se recibió sesión.');
        }

      } catch (error) {
        console.error('Error de registro:', error);
        showMessage(messageDiv, error.message, true);
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

      showMessage(messageDiv, '', false);
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Ingresando...';
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
          // ✅ PRIORIDAD 3: Usuario normal, a dashboard
          console.log("Usuario normal, redirigiendo a /cuenta/dashboard.html");
          window.location.href = '/cuenta/dashboard.html';
        }

      } catch (error) {
        console.error('Error de inicio de sesión:', error);
        showMessage(messageDiv, error.message, true);
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Iniciar Sesión';
        }
      }
    });
  }

  function showMessage(element, message, isError = true) {
    if (!element) return;
    element.textContent = message;
    element.className = 'message';
    if (message) {
      element.classList.add(isError ? 'error' : 'success');
    }
  }
});
