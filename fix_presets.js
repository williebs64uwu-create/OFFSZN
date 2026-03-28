const fs = require('fs');
const path = 'cuenta/Upload/Presets.html';
if (fs.existsSync(path)) {
    const content = fs.readFileSync(path, 'utf8').split('\n');
    console.log(`Original line count: ${content.length}`);
    // Delete lines 4812 to 5006 (index 4811 to 5005)
    // Splice(start_index, delete_count)
    content.splice(4811, 5006 - 4811 + 1);
    fs.writeFileSync(path, content.join('\n'));
    console.log(`New line count: ${content.length}`);
} else {
    console.error(`File not found: ${path}`);
}
