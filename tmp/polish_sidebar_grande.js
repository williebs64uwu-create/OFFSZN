const fs = require('fs');
const path = require('path');

const targetFiles = [
    'cuenta/dashboard.html',
    'cuenta/mis-kits.html',
    'cuenta/subir-kit.html',
    'cuenta/admin-licencias.html',
    'cuenta/negociar.html',
    'cuenta/cupones.html',
    'cuenta/colaboraciones.html',
    'cuenta/cursos.html',
    'cuenta/reels.html',
    'cuenta/ventas.html',
    'cuenta/analytics.html',
    'cuenta/billing.html',
    'cuenta/ajustes.html',
    'cuenta/Upload/Drum-Kits.html'
];

const basePath = 'c:/Users/Willie/Desktop/OFFSZN';

targetFiles.forEach(file => {
    const fullPath = path.join(basePath, file);
    if (!fs.existsSync(fullPath)) {
        console.warn(`File not found: ${fullPath}`);
        return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');

    // 1. Update Avatar size to 100px (Grande)
    content = content.replace(/width:\s*85px;\s*height:\s*85px;/g, 'width: 100px; height: 100px;');
    
    // 2. Reduce spacing
    content = content.replace(/margin-bottom:\s*12px;/g, 'margin-bottom: 8px;');
    
    // 3. Make username more prominent
    if (!content.includes('font-weight: 700;')) {
        content = content.replace('class="sidebar-username', 'style="font-weight: 700; font-size: 1.1rem; color: #fff; margin-bottom: 4px;" class="sidebar-username');
    }

    fs.writeFileSync(fullPath, content);
    console.log(`Polished sidebar in: ${file}`);
});
