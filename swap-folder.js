const fs = require('fs');
const path = require('path');
const dir = 'c:/Users/Willie/Desktop/OFFSZN/cuenta/';

fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('bi bi-folder-fill')) {
      content = content.replace(/bi bi-folder-fill/g, 'bi bi-folder2-open');
      fs.writeFileSync(filePath, content);
      console.log('Fixed ' + file);
  }
});
