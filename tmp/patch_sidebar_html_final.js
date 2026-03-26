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
    
    // 1. Standardize the Logo (find the first link in sidebar-stub)
    const logoRegex = /<a href="\/explorar\.html"[^>]*>[\s\S]*?<\/a>/;
    const standardLogo = `<a href="/explorar.html" class="sidebar-logo-btn" style="margin-bottom:40px; margin-top:10px; display:flex; align-items:center; justify-content:center; width:100%; text-decoration:none; padding: 0 10px;">
            <img src="../images/LOGO-OFFSZN.png" style="width:100%; max-width:140px; height:auto; mix-blend-mode: screen; transition: transform 0.3s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
        </a>`;
    if (logoRegex.test(content)) {
        content = content.replace(logoRegex, standardLogo);
    }

    // 2. Remove all those ugly divider lines
    content = content.replace(/<div style="width:calc\(100% - 20px\);\s*border-bottom:1px solid #222;\s*margin:5px 10px;"><\/div>/g, '');
    content = content.replace(/<div style="width:calc\(100% - 20px\);\s*border-bottom:1px solid #222;\s*margin:10px 10px;"><\/div>/g, '');
    content = content.replace(/<div style="width:calc\(100% - 20px\);\s*border-bottom:1px solid #222;\s*margin:20px 10px;"><\/div>/g, '');
    
    // Specific match for the Gestion/Negocio/etc headers if they have dividers
    content = content.replace(/<!-- \d\. [A-ZÁÉÍÓÚ ]+ -->\s*<div style="width:calc\(100% - 20px\); border-bottom:1px solid #222; margin:5px 10px;"><\/div>/g, (match) => {
        return match.split('-->')[0] + '-->'; // Keep the comment but remove the div
    });

    // 3. Optional: Add a very subtle margin or header text for sections instead of lines
    // (Skipping for now to keep it super clean as requested)

    fs.writeFileSync(file, content, 'utf8');
    console.log('HTML Aestheticized:', file);
});
