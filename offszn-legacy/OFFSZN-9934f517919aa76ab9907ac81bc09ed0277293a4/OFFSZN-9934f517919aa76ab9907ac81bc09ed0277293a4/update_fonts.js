const fs = require('fs');
const path = require('path');

const directory = `${__dirname}`;

const HTMLFONTREGEX = /<link[^>]+href=["']https:\/\/fonts\.googleapis\.com\/css2\?family=[^"']+["'][^>]*>/gi;
const GEISTLINK = `<link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap" rel="stylesheet">`;

const CSSFONTREGEX = /font-family:\s*['"]?(?:Montserrat|Inter|Plus Jakarta Sans|Outfit|Poppins|Arial|Helvetica)['"]?(?:\s*,[^;]*)?;/gi;
const GEISTCSS = `font-family: 'Geist', sans-serif;`;

const DIRS_TO_IGNORE = ['node_modules', '.git', '.gemini', '.agent'];

function walkAndReplace(dir) {
    let files = fs.readdirSync(dir);
    
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        if (DIRS_TO_IGNORE.includes(file)) continue;

        let fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkAndReplace(fullPath);
        } else {
            let ext = path.extname(fullPath).toLowerCase();
            if (ext === '.html' || ext === '.css') {
                let content = fs.readFileSync(fullPath, 'utf8');
                let modified = false;

                // Replace in HTML
                if (ext === '.html') {
                    if (HTMLFONTREGEX.test(content)) {
                        content = content.replace(HTMLFONTREGEX, GEISTLINK);
                        modified = true;
                    }
                }

                // Replace font-family in both CSS and HTML (inline styles)
                if (CSSFONTREGEX.test(content)) {
                    content = content.replace(CSSFONTREGEX, GEISTCSS);
                    modified = true;
                }

                if (modified) {
                    fs.writeFileSync(fullPath, content);
                    console.log(`Updated fonts in: ${fullPath}`);
                }
            }
        }
    }
}

console.log("Starting font replacement process to Geist...");
walkAndReplace(directory);
console.log("Done!");
