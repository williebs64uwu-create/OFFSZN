# Social Proof Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Implementar notificaciones flotantes (toasts) que muestran actividad reciente de usuarios (compras, descargas) para aumentar la conversión mediante prueba social.
**Architecture:** Módulo Vanilla JS (`social-proof.js`) con inyección dinámica del DOM y animaciones fluidas usando GSAP.
**Tech Stack:** HTML/CSS (Vanilla), JavaScript, GSAP.
---

### Task 1: Crear Estilo Premium (Estética Glassmorphism)

**Files:**
- Create `assets/css/social-proof.css` (o agregar al main css)

- [ ] **Step 1: Write minimal implementation**
```css
/* social-proof.css */
.sp-container {
    position: fixed;
    bottom: 24px;
    left: 24px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 12px;
    pointer-events: none; /* Que los clicks pasen a traves a menos que tenga un link */
}

/* Ocultar en móviles por UX, o mostrar en un lugar menos intrusivo */
@media (max-width: 768px) {
    .sp-container {
        display: none; /* Mejor no mostrar en móvil para no tapar el sticky player */
    }
}

.sp-toast {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(20, 20, 20, 0.65);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
    color: white;
    font-family: 'Outfit', sans-serif; /* Ajustar a la fuente de OFFSZN */
    max-width: 320px;
}

.sp-img-wrapper {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
}

.sp-img-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.sp-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.sp-text {
    font-size: 13px;
    line-height: 1.3;
    color: rgba(255,255,255,0.9);
}

.sp-text strong {
    color: #fff;
    font-weight: 600;
}

.sp-time {
    font-size: 11px;
    color: rgba(255,255,255,0.5);
}
```

### Task 2: Lógica de Inyección y Animación GSAP

**Files:**
- Create `assets/js/social-proof.js`

- [ ] **Step 1: Write minimal implementation**
```javascript
// social-proof.js
const SocialProof = {
    container: null,
    
    // Mock data temporal. En prod, esto puede venir de Supabase (Realtime o polling)
    mockEvents: [
        { name: 'Laura de El Salvador', action: 'descargó', item: 'Dark Synth Preset', time: 'hace 5 min', img: '/assets/images/preset-cover.jpg' },
        { name: 'Un productor en España', action: 'compró la licencia exclusiva de', item: 'Midnight Trap Beat', time: 'hace 12 min', img: '/assets/images/beat-cover.jpg' },
        { name: 'Carlos de México', action: 'descargó', item: 'Drum Kit Vol. 1', time: 'hace 2 horas', img: '/assets/images/kit-cover.jpg' }
    ],

    init() {
        // Regla 1: Solo Desktop
        if (window.innerWidth <= 768) return; 

        // Regla 2: Solo Guests (Si hay token de Supabase, abortamos)
        const session = localStorage.getItem('supabase.auth.token'); // o sessionStorage
        if (session) return; // No mostrar a usuarios logueados

        this.container = document.createElement('div');
        this.container.className = 'sp-container';
        document.body.appendChild(this.container);

        // Iniciar ciclo: Primer popup a los 5 segundos de carga
        setTimeout(() => this.showNext(), 5000);
    },

    showNext() {
        const event = this.mockEvents[Math.floor(Math.random() * this.mockEvents.length)];
        const toast = this.createToast(event);
        
        this.container.appendChild(toast);

        // Animación GSAP
        if (typeof gsap !== 'undefined') {
            gsap.fromTo(toast, 
                { autoAlpha: 0, y: 20, scale: 0.95 },
                { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.2)" }
            );

            // Ocultar después de 5 segundos
            setTimeout(() => {
                gsap.to(toast, {
                    autoAlpha: 0,
                    x: -20,
                    duration: 0.4,
                    ease: "power2.in",
                    onComplete: () => toast.remove()
                });
            }, 5000);
        } else {
            // Fallback si GSAP no carga
            setTimeout(() => toast.remove(), 5000);
        }

        // Programar la siguiente aparición: Aleatorio entre 15 y 25 segundos
        // Esto evita que se sienta "spammy" o automatizado.
        const nextDelay = Math.floor(Math.random() * (25000 - 15000 + 1) + 15000); 
        setTimeout(() => this.showNext(), nextDelay);
    },

    createToast(data) {
        const div = document.createElement('div');
        div.className = 'sp-toast';
        div.innerHTML = `
            <div class="sp-img-wrapper">
                <img src="${data.img}" alt="Cover" onerror="this.src='/assets/images/default-cover.jpg'">
            </div>
            <div class="sp-content">
                <span class="sp-text"><strong>${data.name}</strong> ${data.action} <strong>${data.item}</strong></span>
                <span class="sp-time">${data.time}</span>
            </div>
        `;
        return div;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    SocialProof.init();
});
```

### Task 3: Inyección Global

**Files:**
- Modify `index.html` (Landing)
- Modify `explorar/beats.html` (o `beats.html`)
- Modify `explorar/kits.html` (o `sounds.html`)
- Modify `creators.html` (Productores)

- [ ] **Step 1: Write the insertion**
Agregar los scripts al final del body:
```html
<link rel="stylesheet" href="/assets/css/social-proof.css">
<!-- Asegurar que GSAP esté cargado -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js" defer></script>
<script src="/assets/js/social-proof.js" defer></script>
```

- [ ] **Step 2: Verify visually**
Navegar en Desktop y esperar 3 segundos para ver aparecer el popup, luego desaparecer.
