const fs = require('fs');
const path = require('path');

const navbarPath = path.join(__dirname, 'script', 'navbar.js');

const codeToAppend = `

// ==================== MOBILE MENU ACTIONS ==================== //
window.openSubmenu = function(menuId) {
    const slider = document.getElementById('mobile-menu-slides');

    // Hide all submenus first
    document.querySelectorAll('.submenu-content').forEach(el => el.style.display = 'none');

    // Show the specific submenu
    const targetSub = document.getElementById('submenu-' + menuId);
    if (targetSub) {
        targetSub.style.display = 'block';
    }

    if (slider) {
        slider.style.transform = 'translateX(-50%)'; // Slide to View 2
    }
};

window.closeSubmenu = function() {
    const slider = document.getElementById('mobile-menu-slides');
    if (slider) {
        slider.style.transform = 'translateX(0)'; // Back to View 1
    }
};

// Also export to global for inline onclick
window.syncMobileCartBadge = function(count) {
    const mobileBadge = document.getElementById('mobile-cart-badge');
    if (mobileBadge) {
        mobileBadge.textContent = count;
        mobileBadge.style.display = count > 0 ? 'flex' : 'none';
    }
};
`;

try {
    fs.appendFileSync(navbarPath, codeToAppend);
    console.log('Appended successfully');
} catch (e) {
    console.error(e);
}
