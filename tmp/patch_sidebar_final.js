const fs = require('fs');
const path = require('path');

const targetDir = 'c:/Users/Willie/Desktop/OFFSZN/cuenta';

function getHtmlFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getHtmlFiles(file));
        } else if (file.endsWith('.html') && !file.includes('planes.html')) {
            results.push(file);
        }
    });
    return results;
}

const files = getHtmlFiles(targetDir);

const standardCSS = `
        /* ===== SIDEBAR STYLES (B&W PREMIUM) ===== */
        .sidebar-stub { width: 220px; background: #000; border-right: 1px solid #1a1a1a; height: 100vh; position: fixed; left: 0; top: 0; z-index: 100; display: flex; flex-direction: column; align-items: flex-start; padding-top: 30px; padding-left: 15px; padding-right: 15px; gap: 6px; }
        .sidebar-icon-btn { width: 100%; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: flex-start; padding-left: 12px; gap: 14px; color: #888; font-size: 14px; font-weight: 500; transition: all 0.2s ease; text-decoration: none; position: relative; background: transparent; border: none; cursor: pointer; }
        .sidebar-icon-btn i { font-size: 20px; width: 24px; text-align: center; display: inline-block; color: #666; transition: 0.2s; }
        .sidebar-icon-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
        .sidebar-icon-btn.active { color: #000 !important; background: #fff !important; font-weight: 700; box-shadow: 0 4px 20px rgba(255, 255, 255, 0.15); }
        .sidebar-icon-btn.active i { color: #000 !important; }
        .sidebar-icon-btn[data-title]:hover::after, .sidebar-icon-btn[title]:hover::after { display: none; }
`;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // 1. Remove all old sidebar-related CSS rules
    content = content.replace(/\.sidebar-stub\s*\{[^}]+\}/g, '');
    content = content.replace(/\.sidebar-icon-btn\s*\{[^}]+\}/g, '');
    content = content.replace(/\.sidebar-icon-btn\s+i\s*\{[^}]+\}/g, '');
    content = content.replace(/\.sidebar-icon-btn:hover[^\{]*\{[^}]*\}/g, '');
    content = content.replace(/\.sidebar-icon-btn\.active[^\{]*\{[^}]*\}/g, '');
    
    // 2. Insert the fresh standard CSS
    if (content.includes('<style>')) {
        content = content.replace('<style>', '<style>' + standardCSS);
    }
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('CSS Enhanced:', file);
});

// Fix checkout.html separately
const checkoutFile = 'c:/Users/Willie/Desktop/OFFSZN/checkout.html';
if (fs.existsSync(checkoutFile)) {
    let content = fs.readFileSync(checkoutFile, 'utf8');
    content = content.replace(/\.sidebar-stub\s*\{[^}]+\}/g, '');
    content = content.replace(/\.sidebar-icon-btn\s*\{[^}]+\}/g, '');
    content = content.replace('<style>', '<style>' + standardCSS);
    fs.writeFileSync(checkoutFile, content, 'utf8');
}
