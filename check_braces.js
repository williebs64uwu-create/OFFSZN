const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Willie\\Desktop\\OFFSZN\\script\\payment-settings.js', 'utf8');

let braces = 0;
let lines = content.split('\n');
lines.forEach((line, i) => {
    // Basic check, ignoring comments and strings for simplicity but can be more complex if needed
    for (let char of line) {
        if (char === '{') { braces++; }
        else if (char === '}') { braces--; }
        if (braces === 0) {
            console.log(`Braces hit 0 at line ${i + 1}`);
        }
        if (braces < 0) {
            console.log(`Braces went negative at line ${i + 1}`);
            braces = 0;
        }
    }
});
console.log(`Final brace count: ${braces}`);
