import fs from 'fs';

const content = fs.readFileSync('c:/Users/Willie/Desktop/OFFSZN/server/src/infrastructure/http/controllers/PayPalController.js', 'utf8');
const lines = content.split('\n');

console.log("Searching for keywords in PayPalController.js:");
lines.forEach((line, index) => {
    if (line.includes('const') && (line.includes('async') || line.includes('function') || line.includes('=>'))) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
