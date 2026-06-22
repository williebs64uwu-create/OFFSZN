const fs = require('fs');

let html = fs.readFileSync('plugins/easy-master-mockup.html', 'utf8');

// Normalize all newlines to LF (\n) to prevent CRLF mismatch issues
html = html.replace(/\r\n/g, '\n');

// 1. Add CSS root variables
html = html.replace(':root {', `:root {
            --primary: #ff7300;
            --accent: #ff7300;
            --accent-rgb: 255, 115, 0;`);

// Replace color glows and static colors to use var(--primary) and rgba(var(--accent-rgb), ...)
html = html.replace(/rgba\(255, 214, 0, 0.4\)/g, 'rgba(var(--accent-rgb), 0.4)');
html = html.replace(/rgba\(255, 214, 0, 0.2\)/g, 'rgba(var(--accent-rgb), 0.2)');
html = html.replace(/rgba\(255, 214, 0, 0.1\)/g, 'rgba(var(--accent-rgb), 0.1)');
html = html.replace(/#ffd600/g, 'var(--primary)');

// 2. Prepend MODES DROPDOWN and FOOTER styles to /* ACTIVATION OVERLAY */
html = html.replace('/* ACTIVATION OVERLAY */', `/* MODES DROPDOWN */
        .modes-dropdown {
            position: relative;
            display: inline-block;
            margin-left: 12px;
        }
        .dropdown-trigger {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: var(--text-main);
            padding: 6px 14px;
            border-radius: 8px;
            font-weight: bold;
            font-family: 'Outfit', sans-serif;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.3s ease;
            letter-spacing: 0.05em;
        }
        .dropdown-trigger:hover {
            border-color: var(--primary);
            box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.2);
        }
        .dropdown-content {
            display: none;
            position: absolute;
            left: 0;
            margin-top: 5px;
            background: rgba(15, 15, 15, 0.98);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            min-width: 140px;
            z-index: 10000;
            box-shadow: 0 10px 25px rgba(0,0,0,0.6);
            backdrop-filter: blur(10px);
        }
        .dropdown-content.show {
            display: block;
        }
        .dropdown-content div {
            color: #aaa;
            padding: 10px 14px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            transition: all 0.2s;
            text-align: left;
        }
        .dropdown-content div:hover {
            background: rgba(255, 255, 255, 0.05);
            color: var(--primary);
        }

        /* FOOTER STYLE */
        .footer {
            position: absolute;
            bottom: 12px;
            left: 20px;
            right: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: rgba(255, 255, 255, 0.2);
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.08em;
            pointer-events: none;
            font-family: 'Outfit', sans-serif;
            z-index: 5;
        }
        .footer-left {
            text-transform: uppercase;
        }

        /* ACTIVATION OVERLAY */`);

// 3. Remove logo area and inject dropdown in header
html = html.replace(/<div class="logo-area">[\s\S]*?<\/div>/, '');

html = html.replace(
    /<div class="header-left">\s*<button class="preset-btn">Default<\/button>\s*<\/div>/,
    `<div class="header-left" style="display: flex; align-items: center;">
                <button class="preset-btn">Default</button>
                <div class="modes-dropdown" id="modes-dropdown">
                    <button class="dropdown-trigger" id="active-mode-btn" onclick="toggleDropdown(event)">MODO PREMIUM</button>
                    <div class="dropdown-content" id="dropdown-content">
                        <div onclick="selectMode(0, event)">MODO STARTER</div>
                        <div onclick="selectMode(1, event)">MODO PREMIUM</div>
                        <div onclick="selectMode(2, event)">MODO SAUCE</div>
                    </div>
                </div>
            </div>`
);

// Translate Reset to RESETEAR
html = html.replace('Reset', 'RESETEAR');

// 4. Translate perilla titles and amount marks
html = html.replace('<div class="label" style="margin-top: -5px;">AMOUNT</div>', '<div class="label" style="margin-top: -5px;">CANTIDAD</div>');
html = html.replace('<div class="label">OUTPUT</div>', '<div class="label">SALSA EXTRA</div>');

// Replace Amount mode labels
html = html.replace('CLEAN', 'LIMPIO');
html = html.replace('WARM', 'CÁLIDO');
html = html.replace('PUNCH', 'EQUILIBRADO');
html = html.replace('GLUE', 'POTENTE');
html = html.replace('SAUCE', 'SAUCE');

// 5. Correct SVG ring dashoffsets to 25% (offset 70.7 and 212.0)
html = html.replace(
    /<circle class="ring-bg" cx="55" cy="55" r="45" stroke-dasharray="282.7" stroke-dashoffset="56.5"/g,
    '<circle class="ring-bg" cx="55" cy="55" r="45" stroke-dasharray="282.7" stroke-dashoffset="70.7"'
);
html = html.replace(
    /<circle class="ring-bg" cx="160" cy="160" r="135" stroke-dasharray="848.2" stroke-dashoffset="169.6"/g,
    '<circle class="ring-bg" cx="160" cy="160" r="135" stroke-dasharray="848.2" stroke-dashoffset="212.0"'
);

// 6. Inject Canvas particles and Salsa SVG drip inside the central perilla
html = html.replace(
    /<div class="knob-dial" onmousedown="startDrag\(event, 'amount'\)">\s*<div class="knob-indicator" id="ind-amount"><\/div>\s*<span class="knob-value" id="val-amount">0%<\/span>\s*<\/div>/,
    `<div class="knob-dial" onmousedown="startDrag(event, 'amount')">
                        <canvas id="particles-canvas" style="position: absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; border-radius:50%; z-index:1;"></canvas>
                        <svg id="salsa-drip" viewBox="0 0 100 100" style="position: absolute; top: 25%; left: 25%; width: 50%; height: 50%; opacity: 0.12; pointer-events: none; fill: var(--primary); transition: fill 0.3s; z-index:0;">
                            <path d="M50,10 C50,10 42,25 42,35 C42,42 47,48 50,48 C53,48 58,42 58,35 C58,25 50,10 50,10 Z M46,55 C46,55 35,62 35,72 C35,82 43,88 50,88 C57,88 65,82 65,72 C65,62 54,55 54,55 C54,55 53,60 50,60 C47,60 46,55 46,55 Z"/>
                        </svg>
                        <div class="knob-indicator" id="ind-amount" style="z-index:2;"></div>
                        <span class="knob-value" id="val-amount" style="z-index:2;">0%</span>
                    </div>`
);

// 7. Inject Footer before </body>
html = html.replace(
    '</div>\n\n    <script>',
    `</div>\n    <div class="footer">\n        <div class="footer-left">EASY MASTER by OFFSZN</div>\n        <div class="footer-right">Versión 1.0.0</div>\n    </div>\n\n    <script>`
);

// 8. Update Javascript variables and calculations
// Initial defaults: global-out = 100, amount = 100
html = html.replace(
    /let params = \{\s*'global-in': 25,[\s\S]*?'amount': 0\s*\};/,
    `let params = {
            'global-in': 25, // default to -12dB (25%)
            'global-out': 100, // default to 100% Salsa Extra (Limiter full)
            'amount': 100, // default Cantidad to 100%
            'mode': 1 // default Premium Mode
        };`
);

html = html.replace(
    'const dashOffsetSmall = circumSmall * 0.2; // 20% gap at bottom\n        const dashOffsetLarge = circumLarge * 0.2;',
    'const dashOffsetSmall = circumSmall * 0.25; // 25% gap at bottom\n        const dashOffsetLarge = circumLarge * 0.25;'
);

// Display Salsa Extra in % instead of dB
html = html.replace(
    /if \(textEl\) \{\s*if \(id === 'global-in' \|\| id === 'global-out'\) \{[\s\S]*?\}\s*else \{\s*textEl\.innerText = Math\.round\(val\) \+ '%';\s*updateModeLabels\(val\);\s*\}\s*\}/,
    `if (textEl) {
                if (id === 'global-in') {
                    let db = -24 + (pct * 48);
                    textEl.innerText = (db > 0 ? '+' : '') + db.toFixed(1);
                } else if (id === 'global-out') {
                    textEl.innerText = Math.round(val) + '%'; // Salsa Extra displays in percentage
                } else {
                    textEl.innerText = Math.round(val) + '%';
                    updateModeLabels(val);
                }
            }`
);

// Update resetAll function defaults
html = html.replace(
    /function resetAll\(\) \{[\s\S]*?sendParam\('amount', 0\);\s*\}/,
    `function resetAll() {
            params['global-in'] = 25; 
            params['global-out'] = 100;
            params['amount'] = 100;
            params['mode'] = 1;
            updateKnobVisuals('global-in', 25);
            updateKnobVisuals('global-out', 100);
            updateKnobVisuals('amount', 100);
            selectMode(1); // Reset colors to Premium
            sendParam('global-in', 25);
            sendParam('global-out', 100);
            sendParam('amount', 100);
            sendParam('mode', 1);
        }`
);

// Update init values call
html = html.replace(
    /updateKnobVisuals\('global-in', 25\);\s*updateKnobVisuals\('global-out', 50\);\s*updateKnobVisuals\('amount', 0\);/,
    `updateKnobVisuals('global-in', 25);
        updateKnobVisuals('global-out', 100);
        updateKnobVisuals('amount', 100);`
);

// Fix display: none on activation overlay to prevent blocking clicks
html = html.replace(
    /window\.setLicenseStatus = function\(isValid\) \{[\s\S]*?\};/,
    `window.setLicenseStatus = function(isValid) {
            const overlay = document.getElementById('activation-overlay');
            const spinner = document.getElementById('loading-spinner');
            const loadText = document.getElementById('loading-text');
            const content = document.getElementById('activation-content');
            if (isValid) {
                overlay.classList.remove('active');
                overlay.style.display = 'none'; // Unblock all mouse pointer clicks!
            } else {
                overlay.classList.add('active');
                overlay.style.display = 'flex';
                if (spinner) spinner.style.display = 'none';
                if (loadText) loadText.style.display = 'none';
                if (content) content.classList.add('visible');
            }
        };`
);

// Append the Modes dropdown, Gem particles and RMS interaction scripts
html = html.replace(
    '        // Redraw on resize to scale visually',
    `        // --- Premium Modes Dropdown Logic ---
        const modesColors = [
            { name: 'MODO STARTER', primary: '#ffd600', accentRgb: '255, 214, 0' },
            { name: 'MODO PREMIUM', primary: '#ff7300', accentRgb: '255, 115, 0' },
            { name: 'MODO SAUCE', primary: '#a300ff', accentRgb: '163, 0, 255' }
        ];

        function selectMode(idx, e) {
            if (e) e.stopPropagation();
            params['mode'] = idx;
            const mode = modesColors[idx];
            const btn = document.getElementById('active-mode-btn');
            if (btn) btn.innerText = mode.name;
            document.documentElement.style.setProperty('--primary', mode.primary);
            document.documentElement.style.setProperty('--accent', mode.primary);
            document.documentElement.style.setProperty('--accent-rgb', mode.accentRgb);
            
            // Close dropdown
            const dropdown = document.getElementById('dropdown-content');
            if (dropdown) dropdown.classList.remove('show');
            
            // Send to C++
            sendParam('mode', idx);
        }

        function toggleDropdown(e) {
            if (e) e.stopPropagation();
            const dropdown = document.getElementById('dropdown-content');
            if (dropdown) dropdown.classList.toggle('show');
        }

        window.addEventListener('click', () => {
            const dropdown = document.getElementById('dropdown-content');
            if (dropdown) dropdown.classList.remove('show');
        });

        // --- Gem Particles Animation ---
        const canvas = document.getElementById('particles-canvas');
        const ctx = canvas.getContext('2d');
        let particles = [];
        let audioRms = 0;

        function resizeCanvas() {
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width;
                canvas.height = rect.height;
            }
        }
        window.addEventListener('resize', resizeCanvas);
        setTimeout(resizeCanvas, 400);

        class GemParticle {
            constructor() {
                this.reset();
                this.y = Math.random() * 200; // start randomly
            }
            reset() {
                if (!canvas) return;
                this.x = Math.random() * canvas.width;
                this.y = canvas.height + 10;
                this.size = Math.random() * 4 + 2;
                this.speedY = Math.random() * 0.8 + 0.3;
                this.speedX = (Math.random() - 0.5) * 0.4;
                this.alpha = Math.random() * 0.5 + 0.3;
                this.rot = Math.random() * Math.PI * 2;
                this.rotSpeed = (Math.random() - 0.5) * 0.05;
            }
            update() {
                const mult = 1.0 + audioRms * 12.0; // speed up with music volume
                this.y -= this.speedY * mult;
                this.x += this.speedX;
                this.rot += this.rotSpeed * mult;
                if (this.y < -10 || (canvas && (this.x < -10 || this.x > canvas.width + 10))) {
                    this.reset();
                }
            }
            draw() {
                if (!canvas) return;
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rot);
                ctx.globalAlpha = this.alpha * (0.5 + audioRms * 0.8);
                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
                
                // Draw diamond shape
                ctx.beginPath();
                ctx.moveTo(0, -this.size);
                ctx.lineTo(this.size * 0.7, 0);
                ctx.lineTo(0, this.size);
                ctx.lineTo(-this.size * 0.7, 0);
                ctx.closePath();
                ctx.fill();
                
                // Glow
                ctx.shadowBlur = 10;
                ctx.shadowColor = ctx.fillStyle;
                ctx.fill();
                
                ctx.restore();
            }
        }

        // Create particles
        for (let i = 0; i < 20; i++) {
            particles.push(new GemParticle());
        }

        function animateParticles() {
            if (canvas) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                particles.forEach(p => {
                    p.update();
                    p.draw();
                });
                
                // Pulse central dial with audio RMS
                const dial = document.querySelector('.large-knob .knob-dial');
                if (dial) {
                    const pulse = 1.0 + audioRms * 0.12; // sutil scale pulse
                    dial.style.transform = \`scale(\${pulse})\`;
                    dial.style.boxShadow = \`0 10px 30px rgba(0,0,0,0.5), inset 0 0 20px rgba(var(--accent-rgb), \${0.1 + audioRms * 0.4})\`;
                }
            }
            requestAnimationFrame(animateParticles);
        }
        requestAnimationFrame(animateParticles);

        // Listen to native audio RMS
        try {
            if (window.__JUCE__ && window.__JUCE__.backend) {
                window.__JUCE__.backend.addEventListener('audio-rms', (val) => {
                    const r = (typeof val === 'object' && val !== null) ? (val.value || 0) : Number(val);
                    audioRms = r;
                });
            }
        } catch(e){}

        // Handle init-params from C++
        try {
            if (window.__JUCE__ && window.__JUCE__.backend) {
                window.__JUCE__.backend.addEventListener('init-params', (ev) => {
                    const data = (typeof ev === 'object' && ev !== null) ? (ev.value || ev) : ev;
                    if (data) {
                        if (data['global-in'] !== undefined) {
                            params['global-in'] = data['global-in'];
                            updateKnobVisuals('global-in', data['global-in']);
                        }
                        if (data['global-out'] !== undefined) {
                            params['global-out'] = data['global-out'];
                            updateKnobVisuals('global-out', data['global-out']);
                        }
                        if (data['amount'] !== undefined) {
                            params['amount'] = data['amount'];
                            updateKnobVisuals('amount', data['amount']);
                        }
                        if (data['mode'] !== undefined) {
                            selectMode(Math.round(data['mode']));
                        }
                    }
                });
            }
        } catch(e){}

        // Redraw on resize to scale visually`
);

fs.writeFileSync('plugins/easy-master-mockup.html', html);
console.log('Done!');
