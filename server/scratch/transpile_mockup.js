import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.resolve(__dirname, '..', '..', 'plugins', 'easy-mix-mockup.html');

console.log("Leyendo archivo:", filePath);
let content = fs.readFileSync(filePath, 'utf8');

// A simple but robust helper to convert common arrow functions to ES5 functions in mockup
// Let's replace the most common patterns:

// 1. Array functions like: `.forEach(content => content.classList.remove('active'))` -> `.forEach(function(content) { content.classList.remove('active') })`
// We'll target patterns like: `.forEach(x => y)`
content = content.replace(/\.forEach\(([a-zA-Z0-9_]+)\s*=>\s*([^)]+)\)/g, '.forEach(function($1) { $2 })');

// 2. Timeout functions like: `setTimeout(() => {` -> `setTimeout(function() {`
content = content.replace(/setTimeout\(\(\)\s*=>\s*\{/g, 'setTimeout(function() {');

// 3. Event listeners: `window.addEventListener('resize', () => {` -> `window.addEventListener('resize', function() {`
content = content.replace(/\.addEventListener\((['"][^'"]+['"]),\s*\(\)\s*=>\s*\{/g, '.addEventListener($1, function() {');
content = content.replace(/\.addEventListener\((['"][^'"]+['"]),\s*([a-zA-Z0-9_]+)\s*=>\s*\{/g, '.addEventListener($1, function($2) {');

// 4. Promises: `.then(response => {` -> `.then(function(response) {`
content = content.replace(/\.then\(([a-zA-Z0-9_]+)\s*=>\s*\{/g, '.then(function($1) {');
content = content.replace(/\.then\(([a-zA-Z0-9_]+)\s*=>\s*([a-zA-Z0-9_().]+)\)/g, '.then(function($1) { return $2; })');

// 5. Let's do some manual cleanups of specific lines we saw in PowerShell output:
// Line 1431: document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
content = content.replace(
    /document\.querySelectorAll\('\.tab-content'\)\.forEach\(content\s*=>\s*content\.classList\.remove\('active'\)\);/,
    "document.querySelectorAll('.tab-content').forEach(function(content) { content.classList.remove('active'); });"
);

// Line 1449: document.querySelectorAll('.knob').forEach(k => drawKnob(k));
content = content.replace(
    /document\.querySelectorAll\('\.knob'\)\.forEach\(k\s*=>\s*drawKnob\(k\)\);/,
    "document.querySelectorAll('.knob').forEach(function(k) { drawKnob(k); });"
);

// Line 4182: window.addEventListener('DOMContentLoaded', () => {
content = content.replace(
    /window\.addEventListener\('DOMContentLoaded',\s*\(\)\s*=>\s*\{/,
    "window.addEventListener('DOMContentLoaded', function() {"
);

// Line 4221: window.__JUCE__.backend.addEventListener('audio-rms', (rms) => {
content = content.replace(
    /window\.__JUCE__\.backend\.addEventListener\('audio-rms',\s*\(rms\)\s*=>\s*\{/,
    "window.__JUCE__.backend.addEventListener('audio-rms', function(rms) {"
);

// Line 4229: setInterval(() => updateWaveform(Math.random() * 0.2), 100);
content = content.replace(
    /setInterval\(\(\)\s*=>\s*updateWaveform\(Math\.random\(\)\s*\*\s*0\.2\),\s*100\);/,
    "setInterval(function() { updateWaveform(Math.random() * 0.2); }, 100);"
);

// Line 4578: document.querySelectorAll('.knob').forEach(knob => {
content = content.replace(
    /document\.querySelectorAll\('\.knob'\)\.forEach\(knob\s*=>\s*\{/,
    "document.querySelectorAll('.knob').forEach(function(knob) {"
);

// Line 4583: knob.addEventListener('mousedown', e => {
content = content.replace(
    /knob\.addEventListener\('mousedown',\s*e\s*=>\s*\{/,
    "knob.addEventListener('mousedown', function(e) {"
);

// Line 4604: knob.addEventListener('dblclick', () => {
content = content.replace(
    /knob\.addEventListener\('dblclick',\s*\(\)\s*=>\s*\{/,
    "knob.addEventListener('dblclick', function() {"
);

// Line 4616: knob.addEventListener('contextmenu', e => {
content = content.replace(
    /knob\.addEventListener\('contextmenu',\s*e\s*=>\s*\{/,
    "knob.addEventListener('contextmenu', function(e) {"
);

// Line 4630: window.addEventListener('resize', () => {
content = content.replace(
    /window\.addEventListener\('resize',\s*\(\)\s*=>\s*\{/,
    "window.addEventListener('resize', function() {"
);

// Line 4646: siblings.forEach(b => b.classList.remove('active'));
content = content.replace(
    /siblings\.forEach\(b\s*=>\s*b\.classList\.remove\('active'\)\);/g,
    "siblings.forEach(function(b) { b.classList.remove('active'); });"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Transpilación básica completada!");
