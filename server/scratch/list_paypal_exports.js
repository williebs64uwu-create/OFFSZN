import fs from 'fs';
const content = fs.readFileSync('server/src/infrastructure/http/controllers/PayPalController.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('export ')) {
        console.log(`L${index + 1}: ${line.trim()}`);
    }
});
