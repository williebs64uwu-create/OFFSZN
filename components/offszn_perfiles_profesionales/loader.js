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
            const resp = await fetch('/components/offszn_perfiles_profesionales/navbar.html?v=55');
            const html = await resp.text();

            if (html.includes('Te perdiste') || html.includes('<title>404')) {
                throw new Error("El servidor devolvió la página 404 en lugar de la barra de navegación.");
            }

            container.innerHTML = html;

            const avatar = container.querySelector('#nav-avatar');
            const nickname = container.querySelector('#nav-nickname');
            const userLink = container.querySelector('#nav-user-link');
            
            // Unique IDs from navbar.html
            const beatsLink = container.querySelector('#nav-link-beats');
            const servicesLink = container.querySelector('#nav-link-services');
            const playlistsLink = container.querySelector('#nav-link-playlists');
            const aboutLink = container.querySelector('#nav-link-about');

            if (nickname) nickname.textContent = (user.nickname || '').toUpperCase();
            if (avatar && user.avatar_url) avatar.src = user.avatar_url;
            if (userLink) userLink.href = `/@${user.nickname}`;

            // 1. SERVICES VISIBILITY
            const services = user.socials?.custom_services || [];
            if (services.length === 0 && servicesLink) {
                servicesLink.style.display = 'none';
            }

            // 2. PLAYLISTS VISIBILITY & LOGIC
            const playlists = user.socials?.playlists || [];
            if (playlists.length === 0 && playlistsLink) {
                playlistsLink.style.display = 'none';
            } else if (playlists.length === 1 && playlistsLink) {
                // If only 1 playlist, link directly to it
                playlistsLink.href = `/playlist.html?id=${playlists[0].id}`;
            }

            // 3. ABOUT LINK (Points to FAQ by default in navbar.html)
            
        } catch (err) {
            console.error("Error loading professional navbar:", err);
        }
    },

    async loadFooter(user, container) {
        if (!container) return;

        try {
            const resp = await fetch('/components/offszn_perfiles_profesionales/footer.html?v=55');
            const html = await resp.text();

            if (html.includes('Te perdiste') || html.includes('<title>404')) {
                throw new Error("El servidor devolvió la página 404 en lugar del footer.");
            }

            container.innerHTML = html;

            const socialsContainer = container.querySelector('#footer-socials');
            if (socialsContainer && user.socials) {
                const s = user.socials;
                let socialsHTML = '';
                
                const icons = {
                    instagram: '<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.981 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.058-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>',
                    youtube: '<svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
                    twitter: '<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
                    spotify: '<svg viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.49 17.307a.64.64 0 0 1-.893.213c-2.835-1.733-6.403-2.126-10.609-1.164a.64.64 0 1 1-.285-1.248c4.588-1.047 8.532-.6 11.72 1.348a.64.64 0 0 1 .267.851zm1.465-3.26a.8.8 0 0 1-1.1-.267c-1.258-2.043-4.148-3.553-7.852-2.21a.8.8 0 0 1-.533-1.506c4.15-1.258 7.37.406 8.87 2.87a.8.8 0 0 1-.615 1.113zm.126-3.41c-3.253-1.933-8.626-2.113-11.753-1.164a.961.961 0 1 1-.564-1.837c3.585-1.087 9.53-.873 13.29 1.357a.961.961 0 1 1-.973 1.644z"/></svg>'
                };

                const formatUrl = (val, platform) => {
                    if (!val) return '';
                    if (val.startsWith('http')) return val;
                    if (platform === 'instagram') return `https://instagram.com/${val}`;
                    if (platform === 'youtube') return `https://youtube.com/@${val}`;
                    if (platform === 'twitter') return `https://twitter.com/${val}`;
                    if (platform === 'spotify') return val.includes('spotify.com') ? val : `https://open.spotify.com/user/${val}`;
                    return val;
                };

                if (s.instagram) socialsHTML += `<a href="${formatUrl(s.instagram, 'instagram')}" target="_blank" title="Instagram">${icons.instagram}</a>`;
                if (s.youtube) socialsHTML += `<a href="${formatUrl(s.youtube, 'youtube')}" target="_blank" title="YouTube">${icons.youtube}</a>`;
                if (s.twitter) socialsHTML += `<a href="${formatUrl(s.twitter, 'twitter')}" target="_blank" title="Twitter">${icons.twitter}</a>`;
                if (s.spotify) socialsHTML += `<a href="${formatUrl(s.spotify, 'spotify')}" target="_blank" title="Spotify">${icons.spotify}</a>`;
                
                socialsContainer.innerHTML = socialsHTML;
            }
        } catch (err) {
            console.error("Error loading professional footer:", err);
        }
    }
};

window.ProfLoader = ProfLoader;
