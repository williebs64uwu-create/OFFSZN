const fs = require("fs");
const path = require("path");
const assert = require("assert");

const htmlPath = path.join(__dirname, "panel.html");
const html = fs.readFileSync(htmlPath, "utf8");

assert.match(html, /keyword:\s*"FEID"/);
assert.match(html, /Comenta “FEID” y te lo envío por DM\./);
assert.match(html, /hashtagsIG:\s*"#feid #ferxxo #flstudio #vocalpreset #vocalchain #reggaeton #mezcladevoces #mixingtips"/);
assert.match(html, /hashtagsTT:\s*"#feid #ferxxo #flstudio #vocalpreset #vocalchain #reggaeton #mixingtips #produccionmusical"/);

console.log("panel FEID defaults: OK");

