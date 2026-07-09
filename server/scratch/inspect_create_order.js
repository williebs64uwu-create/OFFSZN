import fs from 'fs';

const content = fs.readFileSync('c:/Users/Willie/Desktop/OFFSZN/server/src/infrastructure/http/controllers/PayPalController.js', 'utf8');
const lines = content.split('\n');

console.log("Lines 450 to 580 of PayPalController.js:");
for (let i = 450; i < 580; i++) {
    if (lines[i]) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
}
