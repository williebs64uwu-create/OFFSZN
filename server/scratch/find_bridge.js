import fs from 'fs';
const c = fs.readFileSync('plugins/easy-mix-mockup.html','utf8');
const lines = c.split('\n');
lines.forEach((l,i) => {
    if (l.includes('callNative') || l.includes('hasJuceBridge') || l.includes('__JUCE__') || l.includes('juce')) {
        console.log('L' + (i+1) + ': ' + l.trim().substring(0,160));
    }
});
