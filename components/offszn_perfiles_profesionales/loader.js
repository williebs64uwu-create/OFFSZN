/**
 * Loader for Professional Profile Components
 * Handles modular loading of Navbar and Footer
 */
const ProfLoader = {
    async init(userData) {
        // Inicialmente ocultamos los contenedores si existen para evitar FOUC
        const navContainer = document.getElementById('prof-navbar-container');
        const footerContainer = document.getElementById('prof-footer-container');
        
        if (navContainer) navContainer.style.opacity = '0';
        if (footerContainer) footerContainer.style.opacity = '0';

        await Promise.all([
            this.loadNavbar(userData, navContainer),
            this.loadFooter(userData, footerContainer)
        ]);

        // Pequeño timeout para asegurar que el navegador haya renderizado y evitar el flash
        setTimeout(() => {
            if (navContainer) {
                navContainer.style.transition = 'opacity 0.4s ease';
                navContainer.style.opacity = '1';
            }
            if (footerContainer) {
                footerContainer.style.transition = 'opacity 0.4s ease';
                footerContainer.style.opacity = '1';
            }
        }, 100);
    },

    async loadNavbar(user, container) {
        if (!container) return;

        try {
            const resp = await fetch('/components/offszn_perfiles_profesionales/navbar.html');
            const html = await resp.text();
            container.innerHTML = html;

            const avatar = container.querySelector('#nav-avatar');
            const nickname = container.querySelector('#nav-nickname');
            const userLink = container.querySelector('#nav-user-link');
            const servicesLink = container.querySelector('#nav-services-link');

            if (nickname) nickname.textContent = user.nickname;
            if (avatar && user.avatar_url) avatar.src = user.avatar_url;
            if (userLink) userLink.href = `/@${user.nickname}`;
            if (servicesLink) servicesLink.href = `/@${user.nickname}`;
            
        } catch (err) {
            console.error("Error loading professional navbar:", err);
        }
    },

    async loadFooter(user, container) {
        if (!container) return;

        try {
            const resp = await fetch('/components/offszn_perfiles_profesionales/footer.html');
            const html = await resp.text();
            container.innerHTML = html;

            const socialsContainer = container.querySelector('#footer-socials');
            if (socialsContainer && user.socials) {
                const s = user.socials;
                let socialsHTML = '';
                
                const icons = {
                    instagram: '<svg viewBox="0 0 24 24"><path d="M7 2h10c2.76 0 5 2.24 5 5v10c0 2.76-2.24 5-5 5H7c-2.76 0-5-2.24-5-5V7c0-2.76 2.24-5 5-5zm10 2H7c-1.66 0-3 1.34-3 3v10c0 1.66 1.34 3 3 3h10c1.66 0 3-1.34 3-3V7c0-1.66-1.34-3-3-3zM12 7c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5zm0 2c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm5.25-1a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z"/></svg>',
                    youtube: '<svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
                    twitter: '<svg viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>',
                    spotify: '<svg viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.372 0 12s5.373 12 12 12 12-5.372 12-12S18.627 0 12 0zm5.49 17.307c-.215.352-.676.463-1.026.248-2.835-1.733-6.404-2.126-10.61-1.164-.4.092-.8-.158-.89-.558s.16-.8.56-.89c4.588-1.048 8.533-.6 11.718 1.348.35.215.464.675.248 1.016zm1.465-3.26c-.27.44-.085.101-1.285.42-.35.57-.428.14-3.555-2.16-7.85-2.21-12.83-2.583-.49-.1-.976.136-1.116.486s.133.977.484 1.117c4.15 1.258 10.155 1.718 14.868-1.18.44-.27.58-.847.31-1.287zm.126-3.41a15.01 15.01 0 0 0-14.71-3.64c-.473.093-.946-.208-1.04-.68-.093-.473.208-.946.68-1.04 5.373-1.06 11.23.86 16.03 3.82.413.253.546.79.293 1.203s-.79.546-1.203.293z"/></svg>'
                };

                if (s.instagram) socialsHTML += `<a href="${s.instagram}" target="_blank" title="Instagram">${icons.instagram}</a>`;
                if (s.youtube) socialsHTML += `<a href="${s.youtube}" target="_blank" title="YouTube">${icons.youtube}</a>`;
                if (s.twitter) socialsHTML += `<a href="${s.twitter}" target="_blank" title="Twitter">${icons.twitter}</a>`;
                if (s.spotify) socialsHTML += `<a href="${s.spotify}" target="_blank" title="Spotify">${icons.spotify}</a>`;
                
                socialsContainer.innerHTML = socialsHTML;
            }
        } catch (err) {
            console.error("Error loading professional footer:", err);
        }
    }
};

window.ProfLoader = ProfLoader;
