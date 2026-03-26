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
    
    // 1. sidebar-stub
    content = content.replace(/\.sidebar-stub\s*\{[^}]+\}/g, `.sidebar-stub { width: 220px; background: #000; border-right: 1px solid #1a1a1a; height: 100vh; position: fixed; left: 0; top: 0; z-index: 100; display: flex; flex-direction: column; align-items: flex-start; padding-top: 20px; padding-left: 15px; padding-right: 15px; gap: 10px; }`);
    
    // 2. sidebar-icon-btn (base class only)
    // We only want to replace the exact base class, excluding pseudo-classes like :hover
    content = content.replace(/\.sidebar-icon-btn\s*\{[^}]+\}/g, `.sidebar-icon-btn { width: 100%; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: flex-start; padding-left: 10px; gap: 15px; color: #888; font-size: 14px; font-weight: 500; transition: 0.2s; text-decoration: none; position: relative; background: transparent; border: none; cursor: pointer; }`);
    
    // 3. Add .sidebar-icon-btn i style if missing
    if (!content.includes('.sidebar-icon-btn i {')) {
        content = content.replace('.sidebar-icon-btn:hover', `.sidebar-icon-btn i { font-size: 20px; color: #666; transition: 0.2s; }\n\n        .sidebar-icon-btn:hover`);
    }

    // 4. Disable tooltips
    content = content.replace(/\.sidebar-icon-btn\[data-title\]:hover::after\s*\{[^}]+\}/g, `.sidebar-icon-btn[data-title]:hover::after { display: none; }`);
    content = content.replace(/\.sidebar-icon-btn\[title\]:hover::after\s*\{[^}]+\}/g, `.sidebar-icon-btn[title]:hover::after { display: none; }`);
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed CSS in:', file);
});

// Also fix checkout
const checkoutFile = 'c:/Users/Willie/Desktop/OFFSZN/checkout.html';
if (fs.existsSync(checkoutFile)) {
    let content = fs.readFileSync(checkoutFile, 'utf8');
    content = content.replace(/\.sidebar-stub\s*\{[^}]+\}/g, `.sidebar-stub { width: 220px; background: #000; border-right: 1px solid #1a1a1a; height: 100vh; position: fixed; left: 0; top: 0; z-index: 100; display: flex; flex-direction: column; align-items: flex-start; padding-top: 20px; padding-left: 15px; padding-right: 15px; gap: 10px; }`);
    content = content.replace(/\.sidebar-icon-btn\s*\{[^}]+\}/g, `.sidebar-icon-btn { width: 100%; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: flex-start; padding-left: 10px; gap: 15px; color: #888; font-size: 14px; font-weight: 500; transition: 0.2s; text-decoration: none; position: relative; background: transparent; border: none; cursor: pointer; }`);
    if (!content.includes('.sidebar-icon-btn i {')) {
        content = content.replace('.sidebar-icon-btn:hover', `.sidebar-icon-btn i { font-size: 20px; color: #666; transition: 0.2s; }\n\n        .sidebar-icon-btn:hover`);
    }
    content = content.replace(/\.sidebar-icon-btn\[data-title\]:hover::after\s*\{[^}]+\}/g, `.sidebar-icon-btn[data-title]:hover::after { display: none; }`);
    content = content.replace(/\.sidebar-icon-btn\[title\]:hover::after\s*\{[^}]+\}/g, `.sidebar-icon-btn[title]:hover::after { display: none; }`);
    fs.writeFileSync(checkoutFile, content, 'utf8');
    console.log('Fixed CSS in:', checkoutFile);
}
