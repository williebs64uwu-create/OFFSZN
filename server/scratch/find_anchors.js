import fs from 'fs';
const content = fs.readFileSync('plugins/easy-mix.html', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('href="#')) {
        console.log(`L${index + 1}: ${line.trim()}`);
    }
});
