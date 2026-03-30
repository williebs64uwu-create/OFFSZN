const fs = require('fs');
const path = require('path');
const dir = 'c:/Users/Willie/Desktop/OFFSZN/cuenta/';

fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('fa-solid fa-folder-open')) {
      content = content.replace(/fa-solid fa-folder-open/g, 'bi bi-folder-fill');
      fs.writeFileSync(filePath, content);
      console.log('Fixed ' + file);
  }
});
