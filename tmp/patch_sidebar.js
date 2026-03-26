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
        } else if (file.endsWith('.html') && !file.includes('planes.html') && !file.includes('dashboard.html')) {
            results.push(file);
        }
    });
    return results;
}

const files = getHtmlFiles(targetDir);

const cssReplacement = `
        /* ===== SIDEBAR STUB (For layout consistency) ===== */
        .sidebar-stub {
            width: 220px;
            /* Expanded */
            background: #000;
            border-right: 1px solid var(--border-color);
            height: 100vh;
            position: fixed;
            left: 0;
            top: 0;
            z-index: 100;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            padding-top: 20px;
            padding-left: 15px;
            padding-right: 15px;
            gap: 10px;
        }

        /* RADIAL GLOW BACKGROUND */
        .radial-glow {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.08), transparent 70%);
            z-index: -1;
            pointer-events: none;
        }

        .sidebar-icon-btn {
            width: 100%;
            height: 40px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            padding-left: 10px;
            gap: 15px;
            color: #888;
            font-size: 14px;
            font-weight: 500;
            transition: 0.2s;
            text-decoration: none;
        }
        
        .sidebar-icon-btn i {
            font-size: 20px;
            color: #666;
            transition: 0.2s;
        }

        .sidebar-icon-btn:hover, .sidebar-icon-btn:hover i {
            color: #fff;
            background: rgba(255, 255, 255, 0.05);
        }

        .sidebar-icon-btn.active, .sidebar-icon-btn.active i {
            color: #fff;
            background: var(--accent-purple);
            box-shadow: 0 0 10px var(--accent-glow);
        }

        /* ===== SIDEBAR TOOLTIPS ===== */
        .sidebar-icon-btn {
            position: relative;
        }

        /* Hiding tooltips when expanded */
        .sidebar-icon-btn[data-title]:hover::after, .sidebar-icon-btn[title]:hover::after {
            display: none;
        }`;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // 1. Replace CSS
    // Match from /* ===== SIDEBAR STUB to the end of tooltip hover block
    content = content.replace(/\/\*\s*=====\s*SIDEBAR STUB[\s\S]*?(?=\.sidebar-icon-btn\[data-title\]:hover::after|\.sidebar-icon-btn\[title\]:hover::after)[\s\S]*?\{[\s\S]*?\}/i, cssReplacement);
    
    // 2. Replace dividers
    content = content.replace(/<div style="width:40px;\s*border-bottom:1px solid #222;\s*margin:5px 0;"><\/div>/g, '<div style="width:calc(100% - 20px); border-bottom:1px solid #222; margin:5px 10px;"></div>');
    
    // 3. Replace Icon Buttons HTML
    content = content.replace(/(<a[^>]*class="[^"]*sidebar-icon-btn[^"]*"[^>]*>)\s*(<i[^>]*><\/i>)\s*(<\/a>)/gi, (match, aTag, iTag, closeATag) => {
        const titleMatch = aTag.match(/(?:data-title|title)="([^"]+)"/i);
        const title = titleMatch ? titleMatch[1] : '';
        if (!title) return match;
        
        // Special case for 'Mejorar Plan' rocket icon to inherit yellow color
        if (title.toLowerCase().includes('mejorar')) {
             if (!iTag.includes('style=')) {
                 iTag = iTag.replace('class="', 'style="color: #FFD700;" class="');
             }
             return `${aTag}${iTag} <span style="color: #FFD700;">${title}</span>${closeATag}`;
        }
        
        return `${aTag}${iTag} <span>${title}</span>${closeATag}`;
    });

    // 4. Replace Logo Area HTML
    content = content.replace(/(<a[^>]*class="[^"]*sidebar-logo-btn[^"]*"[^>]*>)\s*(<img[^>]*>)\s*(<\/a>)/gi, (match, aTag, imgTag) => {
        let newATag = aTag.replace(/style="[^"]*"/, 'style="margin-bottom:10px; display:flex; align-items:center; justify-content:flex-start; width:100%; height:44px; padding-left:10px; text-decoration:none;"');
        if (newATag === aTag) {
            newATag = aTag.replace('class="sidebar-logo-btn"', 'class="sidebar-logo-btn" style="margin-bottom:10px; display:flex; align-items:center; justify-content:flex-start; width:100%; height:44px; padding-left:10px; text-decoration:none;"');
        }
        
        let newImgTag = imgTag.replace(/style="[^"]*"/, 'style="width:38px; mix-blend-mode: screen; margin-right: 12px;"');
        if (newImgTag === imgTag) {
            newImgTag = imgTag.replace('<img', '<img style="width:38px; mix-blend-mode: screen; margin-right: 12px;"');
        }
        return `${newATag}\n            ${newImgTag}\n            <span style="color: #fff; font-family: 'Playfair Display', serif; font-size: 22px; font-weight: bold; letter-spacing: 1px;">OFFSZN</span>\n        </a>`;
    });

    fs.writeFileSync(file, content, 'utf8');
    console.log('Patched:', file);
});

console.log('Done!');
