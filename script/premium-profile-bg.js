/**
 * Premium Profile - Background Particles
 * Elegant particle background using HTML5 Canvas.
 * Particles subtly react to mouse movement (Parallax effect).
 */

window.initParticles = function() {
    if (window.particlesAnimationId) {
        cancelAnimationFrame(window.particlesAnimationId);
    }

    const canvas = document.getElementById('particles-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let width, height;
    let particles = [];
    
    function resize() {
        width = canvas.width = canvas.parentElement ? canvas.parentElement.offsetWidth : window.innerWidth;
        height = canvas.height = canvas.parentElement ? canvas.parentElement.offsetHeight : window.innerHeight;
    }
    
    window.removeEventListener('resize', window._particlesResizeHandler);
    window._particlesResizeHandler = resize;
    window.addEventListener('resize', window._particlesResizeHandler);
    resize();

    let mouse = { x: width / 2, y: height / 2 };
    let targetMouse = { x: width / 2, y: height / 2 };

    // Crear particulas
    const particleCount = 100;
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 1.5 + 0.5,
            speedX: (Math.random() - 0.5) * 0.15,
            speedY: (Math.random() - 0.5) * 0.15,
            parallaxFactor: Math.random() * 0.04 + 0.01,
            opacity: 0.2 + Math.random() * 0.4
        });
    }

    if (!window._particlesMouseHandlerAdded) {
        document.addEventListener('mousemove', (e) => {
            if(window._particlesTargetMouse) {
                const activeCanvas = document.getElementById('particles-bg');
                if (activeCanvas) {
                    const rect = activeCanvas.getBoundingClientRect();
                    window._particlesTargetMouse.x = e.clientX - rect.left;
                    window._particlesTargetMouse.y = e.clientY - rect.top;
                } else {
                    window._particlesTargetMouse.x = e.clientX;
                    window._particlesTargetMouse.y = e.clientY;
                }
            }
        });
        window._particlesMouseHandlerAdded = true;
    }
    window._particlesTargetMouse = targetMouse;

    function animate() {
        ctx.clearRect(0, 0, width, height);
        
        // Interpolacion suave para el mouse
        mouse.x += (targetMouse.x - mouse.x) * 0.05;
        mouse.y += (targetMouse.y - mouse.y) * 0.05;

        particles.forEach(p => {
            p.x += p.speedX;
            p.y += p.speedY;
            
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;

            let offsetX = (mouse.x - width / 2) * p.parallaxFactor;
            let offsetY = (mouse.y - height / 2) * p.parallaxFactor;

            ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
            ctx.beginPath();
            ctx.arc(p.x - offsetX, p.y - offsetY, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        
        window.particlesAnimationId = requestAnimationFrame(animate);
    }
    window.particlesAnimationId = requestAnimationFrame(animate);
};;
