document.addEventListener('DOMContentLoaded', () => {

    const menuToggle = document.getElementById('menuToggle');
    const menuCloseBtn = document.getElementById('menuCloseBtn');
    const navMenu = document.getElementById('navMenu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            navMenu.classList.add('show');
            document.body.classList.add('menu-open');
        });
    }
    if (menuCloseBtn && navMenu) {
        menuCloseBtn.addEventListener('click', () => {
            navMenu.classList.remove('show');
            document.body.classList.remove('menu-open');
        });
    }

    const authToken = localStorage.getItem('authToken');
    const body = document.body;
    const userDropdown = document.querySelector('.user-dropdown');
    
    let userData = null; 
    let isAdmin = false;

    function decodeToken(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error("Error decodificando token:", e);
            localStorage.removeItem('authToken');
            return null;
        }
    }

    if (authToken) {
        userData = decodeToken(authToken);
        if (userData) {
            const nowInSeconds = Math.floor(Date.now() / 1000);
            if (userData.exp && userData.exp < nowInSeconds) {
                 console.log("Token expirado.");
                 localStorage.removeItem('authToken');
                 userData = null;
            } else {
                 body.classList.add('user-logged-in');
                 isAdmin = userData.isAdmin === true; 
                 if (isAdmin) {
                      body.classList.add('user-is-admin'); 
                 }
                 const userNameEl = document.querySelector('.user-dropdown-name');
                 const userEmailEl = document.querySelector('.user-dropdown-email');
                 const userAvatarEl = document.querySelector('.user-dropdown-avatar');
                 if (userNameEl) userNameEl.textContent = userData.firstName || userData.email.split('@')[0]; // Usa nombre o parte del email
                 if (userEmailEl) userEmailEl.textContent = userData.email;
                 if (userAvatarEl && userData.firstName) {
                      userAvatarEl.textContent = userData.firstName.charAt(0).toUpperCase();
                 } else if (userAvatarEl && userData.email) {
                      userAvatarEl.textContent = userData.email.charAt(0).toUpperCase();
                 }
            }
        }
    } else {
        body.classList.remove('user-logged-in');
        body.classList.remove('user-is-admin');
    }

    function toggleUserDropdown(event) {
        event.stopPropagation();
        userDropdown.classList.toggle('active');
    }

    document.addEventListener('click', (event) => {
        if (userDropdown && !userDropdown.contains(event.target)) {
            userDropdown.classList.remove('active');
        }
    });

    const dropdownToggleButton = document.querySelector('.user-dropdown > button.navbar-icon-button');
    if(dropdownToggleButton) {
        dropdownToggleButton.onclick = null; 
        dropdownToggleButton.addEventListener('click', toggleUserDropdown);
    }

    function handleLogout(event) {
        if(event) event.preventDefault();
        localStorage.removeItem('authToken');
        alert('¡Has cerrado sesión!');
        window.location.replace('/index.html'); 
    }

    const dropdownLogoutLink = document.querySelector('.user-dropdown-menu .logout');
    if(dropdownLogoutLink) {
         dropdownLogoutLink.onclick = null;
         dropdownLogoutLink.addEventListener('click', handleLogout);
    }


});