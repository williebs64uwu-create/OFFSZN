/**
 * Christmas Snow Background Effect for OFFSZN
 * Isolated logic to avoid interference with other scripts.
 */

(function() {
    // Configuration
    const SNOW_COUNT = 150;
    const SNOW_MIN_SIZE = 1;
    const SNOW_MAX_SIZE = 3;
    const SNOW_MIN_SPEED = 0.5;
    const SNOW_MAX_SPEED = 1.5;
    const SNOW_COLOR = 'rgba(255, 255, 255, 0.6)';

    let canvas, ctx;
    let particles = [];
    let width, height;

    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height * -1; // Start above the screen
            this.size = Math.random() * (SNOW_MAX_SIZE - SNOW_MIN_SIZE) + SNOW_MIN_SIZE;
            this.speed = Math.random() * (SNOW_MAX_SPEED - SNOW_MIN_SPEED) + SNOW_MIN_SPEED;
            this.opacity = Math.random() * 0.5 + 0.2;
            this.wind = Math.random() * 0.5 - 0.25;
        }

        update() {
            this.y += this.speed;
            this.x += this.wind;

            // Loop back to top if it goes off bottom
            if (this.y > height) {
                this.y = -10;
                this.x = Math.random() * width;
            }

            // Loop back to other side if it goes off left/right
            if (this.x > width) this.x = 0;
            else if (this.x < 0) this.x = width;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
            ctx.fill();
        }
    }

    function init() {
        // Create canvas
        canvas = document.createElement('canvas');
        canvas.id = 'christmas-snow-canvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '1'; // Behind content but above background color
        
        // Find the producers page container to insert after or just body
        const container = document.querySelector('.producers-page') || document.body;
        container.prepend(canvas);

        ctx = canvas.getContext('2d');
        resize();

        // Create particles
        for (let i = 0; i < SNOW_COUNT; i++) {
            const p = new Particle();
            // Stagger initial positions so it doesn't all start at the top
            p.y = Math.random() * height;
            particles.push(p);
        }

        animate();
    }

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        particles.forEach(p => {
            p.update();
            p.draw();
        });

        requestAnimationFrame(animate);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }

    window.addEventListener('resize', resize);

})();
