const fs = require('fs');
const content = fs.readFileSync('producto.html', 'utf8');
const replaced = content.replace(/<header class=\"navbar\">[\s\S]*?<\/header>/,
    `  <!-- ==================== DYNAMIC NAVBAR ==================== -->
  <div id="navbar-placeholder"></div>
  <script src="/script/load-navbar.js?v=22"></script>`);
fs.writeFileSync('producto.html', replaced);
console.log("Done");
