/**
 * Premium Profile - Background Particles
 * Elegant particle background using HTML5 Canvas.
 * Particles subtly react to mouse movement (Parallax effect).
 */

window.initParticles = function() {
    const canvas = document.getElementById('particles-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let width, height;
    let particles = [];
    let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let targetMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    
    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = canvas.parentElement.offsetHeight || window.innerHeight;
    }
    
    window.addEventListener('resize', resize);
    resize();

    // Crear particulas (100 para un look limpio pero premium)
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

    document.addEventListener('mousemove', (e) => {
        targetMouse.x = e.clientX;
        targetMouse.y = e.clientY;
    });

    function animate() {
        ctx.clearRect(0, 0, width, height);
        
        // Interpolacion suave para el mouse
        mouse.x += (targetMouse.x - mouse.x) * 0.05;
        mouse.y += (targetMouse.y - mouse.y) * 0.05;

        particles.forEach(p => {
            // Movimiento natural
            p.x += p.speedX;
            p.y += p.speedY;
            
            // Loop infinito
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;

            // Desplazamiento por el mouse (Paralaje)
            let offsetX = (mouse.x - width / 2) * p.parallaxFactor;
            let offsetY = (mouse.y - height / 2) * p.parallaxFactor;

            ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
            ctx.beginPath();
            ctx.arc(p.x - offsetX, p.y - offsetY, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        
        requestAnimationFrame(animate);
    }
    animate();
};;
