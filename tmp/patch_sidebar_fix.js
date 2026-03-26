const fs = require('fs');
const path = require('path');

const targetDir = 'c:/Users/Willie/Desktop/OFFSZN/cuenta';

// Get all html files recursively
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
    
    // 1. Fix main-content margin and width
    content = content.replace(/(\.main-content-elite\s*\{[^}]*margin-left:\s*)80px([^}]*width:\s*calc\(100%\s*-\s*)80px/g, '$1220px$2220px');
    content = content.replace(/(\.main-content\s*\{[^}]*margin-left:\s*)80px/g, '$1220px');

    // Make sure we also cover potential other variations safely
    // Search for any margin-left: 80px inside main-content blocks
    if (content.includes('.main-content-elite')) {
        let blockRegex = /\.main-content-elite\s*\{[^}]+\}/g;
        content = content.replace(blockRegex, match => {
            return match.replace(/margin-left:\s*80px/, 'margin-left: 220px').replace(/width:\s*calc\(100%\s*-\s*80px\)/, 'width: calc(100% - 220px)');
        });
    }
    if (content.includes('.main-content {')) {
        let blockRegex = /\.main-content\s*\{[^}]+\}/g;
        content = content.replace(blockRegex, match => {
            return match.replace(/margin-left:\s*80px/, 'margin-left: 220px').replace(/width:\s*calc\(100%\s*-\s*80px\)/, 'width: calc(100% - 220px)');
        });
    }
    if (content.includes('.main-content-wrapper')) {
        let blockRegex = /\.main-content-wrapper\s*\{[^}]+\}/g;
        content = content.replace(blockRegex, match => {
            return match.replace(/margin-left:\s*80px/, 'margin-left: 220px').replace(/width:\s*calc\(100%\s*-\s*80px\)/, 'width: calc(100% - 220px)');
        });
    }
    
    // 2. Fix Logo
    // The current logo HTML looks like:
    // <a href="/explorar.html" class="sidebar-logo-btn" style="margin-bottom:10px; display:flex; align-items:center; justify-content:flex-start; width:100%; height:44px; padding-left:10px; text-decoration:none;">
    //     <img src="../images/LOGO-OFFSZN.png" style="width:38px; mix-blend-mode: screen; margin-right: 12px;">
    //     <span style="color: #fff; font-family: 'Playfair Display', serif; font-size: 22px; font-weight: bold; letter-spacing: 1px;">OFFSZN</span>
    // </a>
    const logoRegex = /<a[^>]*class="[^"]*sidebar-logo-btn[^"]*"[^>]*>\s*<img[^>]*>\s*(<span[^>]*>[^<]*<\/span>\s*)?<\/a>/gi;
    
    content = content.replace(logoRegex, `<a href="/explorar.html" class="sidebar-logo-btn" style="margin-bottom:20px; margin-top:10px; display:flex; align-items:center; justify-content:center; width:100%; height:54px; text-decoration:none;">
            <img src="../images/LOGO-OFFSZN.png" style="width:54px; mix-blend-mode: screen;">
        </a>`);
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed:', file);
});

// Extra fix for checkout.html, which is not in /cuenta/
const checkoutFile = 'c:/Users/Willie/Desktop/OFFSZN/checkout.html';
if (fs.existsSync(checkoutFile)) {
    let checkoutContent = fs.readFileSync(checkoutFile, 'utf8');
    
    // Fix main-content margin and width
    if (checkoutContent.includes('.main-content-elite')) {
        let blockRegex = /\.main-content-elite\s*\{[^}]+\}/g;
        checkoutContent = checkoutContent.replace(blockRegex, match => {
            return match.replace(/margin-left:\s*80px/, 'margin-left: 220px').replace(/width:\s*calc\(100%\s*-\s*80px\)/, 'width: calc(100% - 220px)');
        });
    }
    
    // Fix Logo
    const logoRegexCheckout = /<a[^>]*class="[^"]*sidebar-logo-btn[^"]*"[^>]*>\s*<img[^>]*>\s*(<span[^>]*>[^<]*<\/span>\s*)?<\/a>/gi;
    checkoutContent = checkoutContent.replace(logoRegexCheckout, `<a href="/explorar.html" class="sidebar-logo-btn" style="margin-bottom:20px; margin-top:10px; display:flex; align-items:center; justify-content:center; width:100%; height:54px; text-decoration:none;">
            <img src="../images/LOGO-OFFSZN.png" style="width:54px; mix-blend-mode: screen;">
        </a>`);
        
    fs.writeFileSync(checkoutFile, checkoutContent, 'utf8');
    console.log('Fixed:', checkoutFile);
}

console.log('All layout bugs fixed!');
