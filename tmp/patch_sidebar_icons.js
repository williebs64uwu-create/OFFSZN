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
    
    // Make sure we have the i styles defined and with fixed width for alignment
    if (!content.includes('.sidebar-icon-btn i {')) {
        // If missing, add it before hover
        content = content.replace('.sidebar-icon-btn:hover', `.sidebar-icon-btn i { font-size: 20px; width: 24px; text-align: center; display: inline-block; color: #666; transition: 0.2s; }\n\n        .sidebar-icon-btn:hover`);
    } else {
        // Update existing definition to include width and text-align
        content = content.replace(/\.sidebar-icon-btn i\s*\{[^}]+\}/g, `.sidebar-icon-btn i { font-size: 20px; width: 24px; text-align: center; display: inline-block; color: #666; transition: 0.2s; }`);
    }
    
    fs.writeFileSync(file, content, 'utf8');
});

// Also fix checkout
const checkoutFile = 'c:/Users/Willie/Desktop/OFFSZN/checkout.html';
if (fs.existsSync(checkoutFile)) {
    let content = fs.readFileSync(checkoutFile, 'utf8');
    if (!content.includes('.sidebar-icon-btn i {')) {
        content = content.replace('.sidebar-icon-btn:hover', `.sidebar-icon-btn i { font-size: 20px; width: 24px; text-align: center; display: inline-block; color: #666; transition: 0.2s; }\n\n        .sidebar-icon-btn:hover`);
    } else {
        content = content.replace(/\.sidebar-icon-btn i\s*\{[^}]+\}/g, `.sidebar-icon-btn i { font-size: 20px; width: 24px; text-align: center; display: inline-block; color: #666; transition: 0.2s; }`);
    }
    fs.writeFileSync(checkoutFile, content, 'utf8');
}
console.log('Fixed icon alignments!');
