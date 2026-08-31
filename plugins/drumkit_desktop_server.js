const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 4782;
const HTML_FILE = path.join(__dirname, 'capykit-mockup.html');

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Serve Main HTML
    if (url.pathname === '/' || url.pathname === '/index.html') {
        if (fs.existsSync(HTML_FILE)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(fs.readFileSync(HTML_FILE, 'utf8'));
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('capykit-mockup.html not found');
        }
        return;
    }

    // API: List local directory
    if (url.pathname === '/api/list-dir' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { targetDir } = JSON.parse(body || '{}');
                if (!targetDir || !fs.existsSync(targetDir)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Directorio no válido o inexistente' }));
                    return;
                }

                const structure = scanDirectory(targetDir);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: structure, rootPath: targetDir }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // API: Save .NFO file directly to local folder
    if (url.pathname === '/api/save-nfo' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { folderPath, tip, color, iconIndex } = JSON.parse(body || '{}');
                if (!folderPath || !fs.existsSync(folderPath)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Directorio destino inexistente' }));
                    return;
                }

                const nfoPath = path.join(folderPath, '.nfo');
                const nfoContent = `Tip=${tip || ''}\r\nColor=${color || '$00FF76'}\r\nIconIndex=${iconIndex || 15}\r\nSort=1\r\n`;
                fs.writeFileSync(nfoPath, nfoContent, 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, nfoPath }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // API: Serve local audio/media files for preview
    if (url.pathname === '/api/media') {
        const filePath = url.searchParams.get('path');
        if (filePath && fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.wav': 'audio/wav',
                '.mp3': 'audio/mpeg',
                '.ogg': 'audio/ogg',
                '.flac': 'audio/flac',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg'
            };
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(filePath).pipe(res);
            return;
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }
    }

    // Default 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

function scanDirectory(dirPath) {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    let categories = [];
    let standaloneFiles = [];

    // Check for root .nfo
    let rootTip = '';
    const rootNfo = path.join(dirPath, '.nfo');
    if (fs.existsSync(rootNfo)) {
        try {
            const content = fs.readFileSync(rootNfo, 'utf8');
            const match = content.match(/Tip=(.*)/i);
            if (match) rootTip = match[1].trim();
        } catch (e) {}
    }

    for (const item of items) {
        if (item.name.startsWith('.')) continue;

        const fullPath = path.join(dirPath, item.name);
        if (item.isDirectory()) {
            // Read folder .nfo
            let tip = '';
            let color = '#76ff03';
            let icon = '↻';
            const subNfo = path.join(fullPath, '.nfo');
            if (fs.existsSync(subNfo)) {
                try {
                    const c = fs.readFileSync(subNfo, 'utf8');
                    const mTip = c.match(/Tip=(.*)/i);
                    if (mTip) tip = mTip[1].trim();
                } catch(e){}
            }

            const subFiles = [];
            const childItems = fs.readdirSync(fullPath, { withFileTypes: true });
            for (const child of childItems) {
                if (child.name.startsWith('.')) continue;
                const childFullPath = path.join(fullPath, child.name);
                if (child.isFile()) {
                    const ext = path.extname(child.name).toLowerCase();
                    if (['.wav', '.mp3', '.ogg', '.flac', '.mid', '.flp', '.fst'].includes(ext)) {
                        subFiles.push({
                            id: 'f_' + Math.random().toString(36).substr(2, 9),
                            name: path.parse(child.name).name,
                            fullName: child.name,
                            fullPath: childFullPath,
                            ext: ext.replace('.', '').toUpperCase(),
                            type: getFileType(child.name),
                            tip: tip || '',
                            icon: getFileIcon(child.name),
                            color: getFileColor(child.name)
                        });
                    }
                }
            }

            categories.push({
                id: 'cat_' + Math.random().toString(36).substr(2, 9),
                name: item.name,
                fullPath: fullPath,
                icon: icon,
                tip: tip,
                color: color,
                isOpen: true,
                items: subFiles
            });
        }
    }

    return {
        kitName: path.basename(dirPath),
        rootTip: rootTip,
        categories: categories
    };
}

function getFileType(filename) {
    const fn = filename.toLowerCase();
    if (fn.includes('808') || fn.includes('bass') || fn.includes('zay')) return '808';
    if (fn.includes('kick')) return 'Kick';
    if (fn.includes('snare')) return 'Snare';
    if (fn.includes('clap')) return 'Clap';
    if (fn.includes('hh') || fn.includes('hat')) return 'HiHat';
    if (fn.includes('oh') || fn.includes('open')) return 'OpenHat';
    if (fn.includes('perc')) return 'Perc';
    if (fn.includes('loop')) return 'Loop';
    if (fn.includes('midi') || fn.endsWith('.mid')) return 'MIDI';
    if (fn.endsWith('.fst')) return 'Preset';
    return 'Sample';
}

function getFileIcon(filename) {
    const fn = filename.toLowerCase();
    if (fn.endsWith('.mid')) return '🎹';
    if (fn.endsWith('.fst')) return '⚙';
    if (fn.includes('loop')) return '🎧';
    return '✨';
}

function getFileColor(filename) {
    const fn = filename.toLowerCase();
    if (fn.endsWith('.mid') || fn.includes('loop')) return '#ffd600';
    if (fn.endsWith('.fst')) return '#8fa0b8';
    return '#ff5722';
}

server.listen(PORT, () => {
    console.log(`FL Studio Drumkit Studio running on http://localhost:${PORT}`);
});
