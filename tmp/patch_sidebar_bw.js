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

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // 1. Update .sidebar-icon-btn.active to B&W
    content = content.replace(/\.sidebar-icon-btn\.active\s*\{[^}]+\}/g, `.sidebar-icon-btn.active { color: #000 !important; background: #fff !important; font-weight: 700; box-shadow: 0 4px 15px rgba(255, 255, 255, 0.1); }`);
    
    // 2. Ensure active icon is also black
    if (content.includes('.sidebar-icon-btn.active i')) {
        content = content.replace(/\.sidebar-icon-btn\.active i\s*\{[^}]+\}/g, `.sidebar-icon-btn.active i { color: #000 !important; }`);
    } else {
        // Add it if missing
        content = content.replace('.sidebar-icon-btn.active {', `.sidebar-icon-btn.active i { color: #000 !important; }\n\n        .sidebar-icon-btn.active {`);
    }

    // 3. Update hover state
    content = content.replace(/\.sidebar-icon-btn:hover\s*\{[^}]+\}/g, `.sidebar-icon-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }`);
    
    // 4. Update Mejorar Plan (Rocket) from Yellow to White/B&W
    content = content.replace(/style="color:#FFD700; margin-top: 10px;"/g, 'style="color:#fff; margin-top: 10px;"');
    content = content.replace(/style="color: #FFD700;"/g, 'style="color: #fff;"');
    content = content.replace(/color:#FFD700/g, 'color:#fff'); // Catch any others

    // 5. Cleanup any stray purple glow variables if they were used in box-shadows
    content = content.replace(/box-shadow: 0 0 10px var\(--accent-glow\);/g, '');
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('Branded B&W:', file);
});

// Also fix checkout.html
const checkoutFile = 'c:/Users/Willie/Desktop/OFFSZN/checkout.html';
if (fs.existsSync(checkoutFile)) {
    let content = fs.readFileSync(checkoutFile, 'utf8');
    content = content.replace(/\.sidebar-icon-btn\.active\s*\{[^}]+\}/g, `.sidebar-icon-btn.active { color: #000 !important; background: #fff !important; font-weight: 700; box-shadow: 0 4px 15px rgba(255, 255, 255, 0.1); }`);
    if (content.includes('.sidebar-icon-btn.active i')) {
        content = content.replace(/\.sidebar-icon-btn\.active i\s*\{[^}]+\}/g, `.sidebar-icon-btn.active i { color: #000 !important; }`);
    }
    content = content.replace(/\.sidebar-icon-btn:hover\s*\{[^}]+\}/g, `.sidebar-icon-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }`);
    content = content.replace(/style="color:#FFD700; margin-top: 10px;"/g, 'style="color:#fff; margin-top: 10px;"');
    content = content.replace(/style="color: #FFD700;"/g, 'style="color: #fff;"');
    fs.writeFileSync(checkoutFile, content, 'utf8');
    console.log('Branded B&W:', checkoutFile);
}
