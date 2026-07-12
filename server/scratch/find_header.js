import fs from 'fs';
const c = fs.readFileSync('plugins/easy-mix-mockup.html','utf8');
const lines = c.split('\n');
const keywords = ['header', 'logo', 'tagline', 'global-io', 'EASY', 'plugin'];
lines.forEach((l,i) => {
    const lt = l.trim();
    if ((lt.includes('class=') && (lt.includes('header') || lt.includes('logo') || lt.includes('tagline') || lt.includes('global-io'))) ||
        (lt.includes('EASY') && lt.includes('MIX') && lt.includes('<'))) {
        console.log('L' + (i+1) + ': ' + lt.substring(0,180));
    }
});
