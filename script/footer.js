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
    } catch (e) {
        console.error("Error loading footer:", e);
    }
}
