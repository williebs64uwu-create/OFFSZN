/**
 * Premium Profile - Background Particles
 * Elegant particle background using HTML5 Canvas.
 * Particles subtly react to mouse movement (Parallax effect).
 */

window.initParticles = function() {
    const canvas = document.getElementById('particles-bg');
    if (!canvas) return;
    
    if (window.currentParticlesCanvas === canvas) {
        return; // Canvas already initialized and running
    }
    window.currentParticlesCanvas = canvas;

    if (window.particlesAnimationId) {
        cancelAnimationFrame(window.particlesAnimationId);
    }

    const ctx = canvas.getContext('2d');
    
    let width, height;
    let particles = [];
    
     function resize() {
         const parent = canvas.parentElement;
         const currentWidth = parent && parent.offsetWidth > 0 ? parent.offsetWidth : (window.innerWidth > 0 ? window.innerWidth : 800);
         const currentHeight = parent && parent.offsetHeight > 0 ? parent.offsetHeight : (window.innerHeight > 0 ? window.innerHeight : 600);
         
         // Scale existing particles if the width or height changes
         if (width && height && width > 0 && height > 0 && currentWidth > 0 && currentHeight > 0) {
             const scaleX = currentWidth / width;
             const scaleY = currentHeight / height;
             if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
                 window.currentParticles.forEach(p => {
                     p.x *= scaleX;
                     p.y *= scaleY;
                 });
             }
         }
         
         width = canvas.width = currentWidth;
         height = canvas.height = currentHeight;
     }
    
    window.removeEventListener('resize', window._particlesResizeHandler);
    window._particlesResizeHandler = resize;
    window.addEventListener('resize', window._particlesResizeHandler);
    resize();

    // Persist mouse positions globally to prevent jumping when re-initializing
    if (!window.currentParticlesMouse) {
        window.currentParticlesMouse = { x: width / 2, y: height / 2 };
    }
    if (!window.currentParticlesTargetMouse) {
        window.currentParticlesTargetMouse = { x: width / 2, y: height / 2 };
    }

    // Crear particulas
    const particleCount = 100;
    if (!window.currentParticles || window.currentParticles.length !== particleCount) {
        window.currentParticles = [];
        for (let i = 0; i < particleCount; i++) {
            window.currentParticles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 1.5 + 0.5,
                speedX: (Math.random() - 0.5) * 0.15,
                speedY: (Math.random() - 0.5) * 0.15,
                parallaxFactor: Math.random() * 0.04 + 0.01,
                opacity: 0.2 + Math.random() * 0.4
            });
        }
    }
    particles = window.currentParticles;

    if (!window._particlesMouseHandlerAdded) {
        document.addEventListener('mousemove', (e) => {
            const activeCanvas = document.getElementById('particles-bg');
            if (activeCanvas) {
                const rect = activeCanvas.getBoundingClientRect();
                window.currentParticlesTargetMouse.x = e.clientX - rect.left;
                window.currentParticlesTargetMouse.y = e.clientY - rect.top;
            } else {
                window.currentParticlesTargetMouse.x = e.clientX;
                window.currentParticlesTargetMouse.y = e.clientY;
            }
        });
        window._particlesMouseHandlerAdded = true;
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        
        // Interpolacion suave para el mouse usando las globales persistentes
        window.currentParticlesMouse.x += (window.currentParticlesTargetMouse.x - window.currentParticlesMouse.x) * 0.05;
        window.currentParticlesMouse.y += (window.currentParticlesTargetMouse.y - window.currentParticlesMouse.y) * 0.05;

        particles.forEach(p => {
            p.x += p.speedX;
            p.y += p.speedY;
            
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;

            let offsetX = (window.currentParticlesMouse.x - width / 2) * p.parallaxFactor;
            let offsetY = (window.currentParticlesMouse.y - height / 2) * p.parallaxFactor;

            ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
            ctx.beginPath();
            ctx.arc(p.x - offsetX, p.y - offsetY, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        
        window.particlesAnimationId = requestAnimationFrame(animate);
    }
    window.particlesAnimationId = requestAnimationFrame(animate);
};
