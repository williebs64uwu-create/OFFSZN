import fs from 'fs';
import path from 'path';

function main() {
    const filePath = 'c:\\Users\\Willie\\Desktop\\OFFSZN\\plugins\\easy-mix-mockup.html';
    if (!fs.existsSync(filePath)) {
        console.log('File does not exist:', filePath);
        return;
    }

    const buffer = fs.readFileSync(filePath);
    // Detect UTF-16 or UTF-8
    let content = '';
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
        content = buffer.toString('utf16le');
        console.log('Detected UTF-16 LE encoding');
    } else {
        content = buffer.toString('utf8');
        console.log('Detected UTF-8 encoding');
    }

    // Look for license or serial words (case-insensitive)
    const lines = content.split('\n');
    console.log(`Total lines: ${lines.length}`);
    
    let count = 0;
    lines.forEach((line, index) => {
        if (line.toLowerCase().includes('serial') || line.toLowerCase().includes('licens') || line.toLowerCase().includes('valid')) {
            count++;
            if (count <= 40) {
                console.log(`Line ${index + 1}: ${line.trim().substring(0, 120)}`);
            }
        }
    });
    console.log(`Found ${count} matching lines.`);
}

main();
