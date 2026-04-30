// script/social-proof.js
const SocialProof = {
    container: null,
    
    // Mock data combinada (Sin precios, solo Prueba Social).
    mockEvents: [
        { type: 'register', name: 'novawav', action: 'acaba de unirse a', item: 'OFFSZN', time: 'hace 2 min', icon: 'bi-person' },
        { type: 'download', name: 'void.wav', action: 'descargó', item: '[FREE] detroit type beat "fama"', time: 'hace 5 min', icon: 'bi-download' },
        { type: 'purchase', name: 'night.wav', action: 'adquirió la licencia de', item: '[FREE] trap type beat "demons"', time: 'hace 12 min', icon: 'bi-bag-check' },
        { type: 'subscribe', name: 'dray.wav', action: 'se suscribió al', item: 'Plan Pro', time: 'hace 1 hora', icon: 'bi-lightning-charge-fill' },
        { type: 'register', name: 'kairo.wav', action: 'se registró en', item: 'OFFSZN', time: 'hace 15 min', icon: 'bi-person' },
        { type: 'download', name: 'ghost.wav', action: 'descargó', item: 'Dark Synth Drum Kit', time: 'hace 45 min', icon: 'bi-download' },
        { type: 'subscribe', name: 'drysignal.wav', action: 'se suscribió al', item: 'Plan Starter', time: 'hace 3 horas', icon: 'bi-star-fill' },
        { type: 'purchase', name: '808wav', action: 'adquirió la exclusiva de', item: '[FREE] drill type beat "ops"', time: 'hace 20 min', icon: 'bi-music-note-beamed' },
        { type: 'download', name: 'pure.wav', action: 'descargó', item: '[FREE] rnb type beat "star"', time: 'hace 10 min', icon: 'bi-download' },
        { type: 'register', name: 'saint.wav', action: 'acaba de unirse a', item: 'OFFSZN', time: 'hace 8 min', icon: 'bi-person' },
        { type: 'download', name: 'fvde.wav', action: 'descargó', item: 'Vocal Chops Vol. 2', time: 'hace 1 hora', icon: 'bi-download' },
        { type: 'purchase', name: 'onyx.wav', action: 'compró la licencia de', item: '[FREE] reggaeton type beat "sola"', time: 'hace 2 horas', icon: 'bi-bag-check' }
    ],

    init() {
        // Regla 1: Ocultar en móviles (menos de 768px de ancho) por UX
        if (window.innerWidth <= 768) return; 

        // Regla 2: Solo Guests. Si existe un token de Supabase en storage, abortamos.
        // Así no molestamos a los usuarios que ya están en el ecosistema OFFSZN.
        const isLogged = Object.keys(localStorage).some(k => k.includes('auth-token')) || 
                         Object.keys(sessionStorage).some(k => k.includes('auth-token'));
        if (isLogged) return; 

        // Crear contenedor
        this.container = document.createElement('div');
        this.container.className = 'sp-container';
        document.body.appendChild(this.container);

        // Mezclar aleatoriamente (shuffle) la lista de eventos para que no salgan en el mismo orden
        this.mockEvents = this.mockEvents.sort(() => Math.random() - 0.5);

        // Iniciar ciclo: Primer popup aparece a los 5 segundos de haber cargado la página
        setTimeout(() => this.showNext(), 5000);
    },

    showNext() {
        // Si ya mostramos todos los eventos de la lista, detenemos el ciclo
        // Esto evita que se repitan y delaten que es data simulada
        if (this.mockEvents.length === 0) return;

        // Sacar el último evento de la lista (así nunca se repite)
        const event = this.mockEvents.pop();
        const toast = this.createToast(event);
        
        this.container.appendChild(toast);

        // Animación GSAP (si está disponible, que en Landing lo está)
        if (typeof gsap !== 'undefined') {
            gsap.fromTo(toast, 
                { autoAlpha: 0, y: 30, scale: 0.95 },
                { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: "back.out(1.2)" }
            );

            // Ocultar suavemente después de 5.5 segundos
            setTimeout(() => {
                gsap.to(toast, {
                    autoAlpha: 0,
                    x: -20,
                    scale: 0.98,
                    duration: 0.5,
                    ease: "power2.in",
                    onComplete: () => toast.remove()
                });
            }, 5500);
        } else {
            // Fallback si por alguna razón GSAP no cargó
            setTimeout(() => toast.remove(), 5500);
        }

        // Programar la siguiente aparición: Aleatorio entre 15 y 25 segundos
        // Esto evita que parezca un bot o algo automatizado y se sienta "orgánico"
        const nextDelay = Math.floor(Math.random() * (25000 - 15000 + 1) + 15000); 
        setTimeout(() => this.showNext(), nextDelay);
    },

    createToast(data) {
        const div = document.createElement('div');
        div.className = 'sp-toast';
        div.innerHTML = `
            <div class="sp-img-wrapper type-${data.type}">
                <i class="bi ${data.icon}"></i>
            </div>
            <div class="sp-content">
                <span class="sp-text"><strong>${data.name}</strong> ${data.action} <strong>${data.item}</strong></span>
                <span class="sp-time">${data.time}</span>
            </div>
        `;
        return div;
    }
};

// Arrancar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SocialProof.init());
} else {
    SocialProof.init();
}
