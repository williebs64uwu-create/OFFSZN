const fs = require('fs');
const content = fs.readFileSync('producto.html', 'utf8');

// Find the index of the last correct part
const goodPartEnd = content.indexOf('    })();\n  </script>\n</head>\n\n<body>\n\n');

if (goodPartEnd !== -1) {
    // We already have a good head, wait! The regex replacement earlier messed up.
}

// Let's just fix it by replacing the bad chunk.
// The bad chunk starts at `< !DOCTYPE html >` and ends before `<!-- ==================== DYNAMIC NAVBAR`.
const badChunkStart = content.indexOf('< !DOCTYPE html >');
const dynamicNav = content.indexOf('<!-- ==================== DYNAMIC NAVBAR');

if (badChunkStart !== -1 && dynamicNav !== -1) {
    const fixedContent = content.substring(0, badChunkStart) + content.substring(dynamicNav);
    fs.writeFileSync('producto.html', fixedContent);
    console.log("Fixed HTML");
} else {
    // maybe it's `<!DOCTYPE html>` at line 47 but mangled by the view?
    const pattern = /<\/script>\s*<\/head>\s*<body>\s*<!DOCTYPE html>[\s\S]*?<!-- ==================== DYNAMIC NAVBAR/;
    const fixedContent = content.replace(pattern, '</script>\n</head>\n<body>\n\n  <!-- ==================== DYNAMIC NAVBAR');
    fs.writeFileSync('producto.html', fixedContent);
    console.log("Fixed HTML using regex");
}
