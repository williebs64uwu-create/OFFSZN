document.addEventListener('DOMContentLoaded', () => {

  //url del backend
  let API_URL = '';

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') {
    //para desarrollo local
    API_URL = 'http://localhost:3000/api';
  } else {
    //para producción
    API_URL = 'https://offszn-academy.onrender.com/api';
  }

  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');
  const messageDiv = document.getElementById('form-message');

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
        const response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok) {
          if (data.token) {
            localStorage.setItem('authToken', data.token);
            console.log("Registro exitoso, token guardado.");
            window.location.href = '/pages/welcome.html';
          } else {
            throw new Error('Registro exitoso pero no se recibió token.');
          }

        } else {
          throw new Error(data.error || `Error ${response.status}`);
        }
      } catch (error) {
        console.error('Error de registro:', error);
        showMessage(messageDiv, error.message, true);
        submitButton.disabled = false;
        submitButton.textContent = 'Crear Cuenta';
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('log-email').value;
      const password = document.getElementById('log-password').value;

      try {
        const response = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok) {
          localStorage.setItem('authToken', data.token);
          if (data.user && data.user.isAdmin === true) {
            console.log("Usuario es Admin, redirigiendo a /admin-frontend/admin_dashboard.html");
            window.location.href = '/admin-frontend/admin_dashboard.html';
          } else {
            console.log("Usuario normal, redirigiendo a /pages/my-products.html");
            window.location.href = '/pages/my-products.html';
          }
        } else {
          showMessage(messageDiv, data.error, true);
        }
      } catch (error) {
        console.error('Error de red:', error);
        showMessage(messageDiv, 'Error de conexión. Inténtalo más tarde.', true);
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