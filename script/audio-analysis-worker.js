/**
 * Audio Analysis Worker for OFFSZN
 * Handles heavy BPM and Key detection using Essentia.js
 */

// ?? SHIM: Essentia-wasm.web.js looks for 'document' or 'window' to resolve paths
// Workers don't have these, so we mock them.
if (typeof self.window === 'undefined') {
    self.window = self;
}
if (typeof self.document === 'undefined') {
    self.document = {
        createElement: () => ({}),
        getElementsByTagName: () => [],
        location: self.location
    };
}

// Import Essentia from CDN
importScripts('https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.web.js');
importScripts('https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.js');

let essentia;
let wasmModule;

async function initEssentia() {
    if (essentia) return;
    try {
        // ?? FIX: Specify the WASM location explicitly for the worker
        wasmModule = await EssentiaWASM({
            locateFile: (path) => {
                if (path.endsWith('.wasm')) {
                    return "https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.web.wasm";
                }
                return path;
            }
        });
        essentia = new Essentia(wasmModule);
        console.log('Backend: Essentia Worker Initialized');
    } catch (e) {
        console.error('Backend: Failed to initialize Essentia in worker', e);
    }
}

self.onmessage = async (e) => {
    const { channelData, sampleRate } = e.data;

    await initEssentia();

    if (!essentia) {
        self.postMessage({ error: 'Essentia not initialized' });
        return;
    }

    try {
        // Convert Float32Array to Essentia Vector
        const vector = essentia.arrayToVector(channelData);

        // 1. Key Detection
        let key = null;
        try {
            const keyData = essentia.KeyExtractor(vector);
            if (keyData && keyData.key && keyData.scale) {
                const scaleMap = { 'major': 'Major', 'minor': 'Minor' };
                key = `${keyData.key} ${scaleMap[keyData.scale] || keyData.scale}`;
            }
        } catch (keyErr) {
            console.warn('Worker: Key detection failed', keyErr);
        }

        // 2. BPM Detection
        let bpm = 0;
        try {
            const rhythm = essentia.RhythmExtractor2013(vector);
            if (rhythm && rhythm.bpm > 0) {
                bpm = Math.round(rhythm.bpm);
            }
        } catch (bpmErr) {
            console.warn('Worker: BPM detection failed', bpmErr);
        }

        // Cleanup
        // In Essentia.js, vectors often need to be deleted if they are Emscripten objects
        // However, the JS wrapper might handle it. For safety:
        try {
            if (vector && vector.delete) vector.delete();
        } catch (e) { }

        self.postMessage({ bpm, key });

    } catch (err) {
        console.error('Worker: Analysis error', err);
        self.postMessage({ error: err.message });
    }
};
