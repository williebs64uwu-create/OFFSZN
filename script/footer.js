/**
 * Footer Component Loader
 * Injects the footer into the target element or body.
 */
document.addEventListener('DOMContentLoaded', () => {
    loadFooter();
});

async function loadFooter() {
    // 1. Check if footer holder exists, if not create one at the end of body
    let footerContainer = document.getElementById('footer-placeholder');

    if (!footerContainer) {
        // If specific placeholder logic isn't used, we rely on manual placement
        // OR we append to body if explicitly requested.
        // For now, let's look for a specific container to be safe, 
        // or append to the main wrapper if available.
        return;
    }

    // 2. Load CSS if not present
    if (!document.querySelector('link[href="/css/footer.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/css/footer.css';
        document.head.appendChild(link);
    }

    // 3. Fetch HTML
    try {
        const response = await fetch('/components/footer.html');
        if (!response.ok) throw new Error('Footer load failed');
        const html = await response.text();
        footerContainer.innerHTML = html;

        // Initialize Newsletter Form — native submit to hidden iframe
        const form = document.getElementById('footer-newsletter-form');
        if (form && !form.dataset.initialized) {
            form.dataset.initialized = 'true';
            
            form.addEventListener('submit', () => {
                const btn = form.querySelector('button[type="submit"]');
                const msg = form.querySelector('.form-message');
                
                // Disable button while submitting
                btn.disabled = true;
                btn.style.opacity = '0.5';
                
                // Show success message after a short delay (form submits to hidden iframe)
                setTimeout(() => {
                    msg.textContent = '¡Gracias por suscribirte! 🎉';
                    msg.style.color = '#34d399';
                    msg.style.display = 'block';
                    form.reset();
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    
                    setTimeout(() => { msg.style.display = 'none'; }, 5000);
                }, 1000);
            });
        }
    } catch (e) {
        console.error("Error loading footer:", e);
    }
}
