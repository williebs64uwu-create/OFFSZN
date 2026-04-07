const fs = require('fs');
const path = require('path');

const targetDir = 'c:/Users/Willie/Desktop/OFFSZN';

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        // Ignore specific folders and JS files just in case
        if (file.includes('node_modules') || file.includes('.git') || file.includes('.agent') || file.includes('script\\')) return;
        
        try {
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                results = results.concat(walkDir(file));
            } else if (file.endsWith('.html')) {
                results.push(file);
            }
        } catch (e) {
            // Ignore stat errors
        }
    });
    return results;
}

const htmlFiles = walkDir(targetDir);
let changedCount = 0;

for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Original Reels mega menu regex
    const desktopReelsRegex = /<a href="\/studio\/reels[^>]*class="dropdown-item"[^>]*>[\s\S]*?<div class="dropdown-item-title">Reels<\/div>[\s\S]*?<\/a>/g;
    
    const replacement = `<a href="/studio/generador.html" class="dropdown-item" style="border-radius: 8px;">
                  <i class="bi bi-music-note-beamed"></i>
                  <div class="dropdown-item-content">
                    <div class="dropdown-item-title">Generador IA</div>
                    <div class="dropdown-item-desc" style="font-size: 0.7rem; color: #888;">Pide lo que quieres y obtelo en segundos!</div>
                  </div>
                </a>`;

    const mobileReelsRegex = /<a href="\/studio\/reels[^>]*class="mobile-menu-link sub"[^>]*>[\s\S]*?REELS<\/a>/gi;
    const mobileReplacement = `<a href="/studio/generador.html" class="mobile-menu-link sub"><i class="bi bi-music-note-beamed"></i> GENERADOR IA</a>`;

    let changed = false;
    if (desktopReelsRegex.test(content)) {
        content = content.replace(desktopReelsRegex, replacement);
        changed = true;
    }
    if (mobileReelsRegex.test(content)) {
        content = content.replace(mobileReelsRegex, mobileReplacement);
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        changedCount++;
        console.log('Updated', file);
    }
}

console.log('Total files updated:', changedCount);
