/**
 * Settings UI Logic - Handles mobile navigation dropdowns
 */
function setupMobileNav() {
    const trigger = document.getElementById('mobileNavTrigger');
    const nav = document.getElementById('settingsNav');

    if (!trigger || !nav) return;

    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        nav.classList.toggle('open');
        trigger.classList.toggle('active');
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!nav.contains(e.target) && !trigger.contains(e.target)) {
            nav.classList.remove('open');
            trigger.classList.remove('active');
        }
    });

    // Sync trigger text with active item
    const activeItem = nav.querySelector('.settings-nav-item.active');
    if (activeItem) {
        const triggerContent = trigger.querySelector('.trigger-content');
        if (triggerContent) {
            triggerContent.innerHTML = activeItem.innerHTML;
        }
    }
}

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMobileNav);
} else {
    setupMobileNav();
}
