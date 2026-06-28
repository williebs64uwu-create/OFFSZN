import fs from 'fs';

const content = fs.readFileSync('c:/Users/Willie/Desktop/OFFSZN/plugins/easy-mix-mockup.html', 'utf8');
const lines = content.split('\n');

console.log("Searching for DOMContentLoaded or initialization in easy-mix-mockup.html:");
lines.forEach((line, index) => {
    if (line.includes('DOMContentLoaded') || line.includes('window.onload') || line.includes('renderPresetLists')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
