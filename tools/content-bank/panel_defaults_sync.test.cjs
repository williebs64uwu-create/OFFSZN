const fs = require("fs");
const path = require("path");
const assert = require("assert");

const htmlPath = path.join(__dirname, "panel.html");
const html = fs.readFileSync(htmlPath, "utf8");

assert.match(html, /DEFAULTS_SIG/);
assert.match(html, /defaultsSig/);
assert.match(html, /syncDefaultsIfChanged/);

console.log("panel defaults sync: OK");

