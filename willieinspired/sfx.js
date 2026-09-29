/* WillieInspired SFX — modular UI sounds (Web Audio, sin archivos mp3).
 *
 * Uso:
 *   <script src="/willieinspired/sfx.js" defer></script>
 *   <button data-sfx="success">   -> suena ese sonido
 *   <button>                      -> suena "click" por defecto
 *   <div data-sfx-skip>...</div>  -> silencia todo lo de adentro
 *   window.WISfx.play('pop')      -> desde JS
 *   window.WISfx.setEnabled(false)-> mute (se guarda en localStorage)
 */
(function () {
    'use strict';
    if (window.WISfx) return;

    var KEY = 'wi-sfx-enabled';
    var MASTER = 0.5;
    var ctx = null, master = null, unlocked = false, last = {};

    // Throttle mínimo (ms) por sonido
    var THROTTLE = { tick: 60, hover: 80, swoosh: 200 };

    function enabled() {
        try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; }
    }

    function ensure() {
        if (ctx) return ctx;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = MASTER;
        var comp = ctx.createDynamicsCompressor();
        master.connect(comp); comp.connect(ctx.destination);
        return ctx;
    }

    // Un "blip": oscilador con envolvente y glide opcional
    function blip(t, o) {
        var osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = o.type || 'sine';
        osc.frequency.setValueAtTime(o.f, t);
        if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.d);
        var v = o.v == null ? 0.5 : o.v;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
        osc.connect(g); g.connect(master);
        osc.start(t); osc.stop(t + o.d + 0.02);
    }

    function noise(t, d, from, to, v) {
        var len = Math.max(1, Math.floor(ctx.sampleRate * d));
        var buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        var src = ctx.createBufferSource(); src.buffer = buf;
        var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
        f.frequency.setValueAtTime(from, t);
        f.frequency.exponentialRampToValueAtTime(to, t + d);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v || 0.3, t + d * 0.25);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        src.connect(f); f.connect(g); g.connect(master);
        src.start(t); src.stop(t + d + 0.02);
    }

    // Transiente seco: ráfaga de ruido filtrada con caída rápida
    function snap(t, d, freq, v) {
        var len = Math.max(1, Math.floor(ctx.sampleRate * d));
        var buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        var src = ctx.createBufferSource(); src.buffer = buf;
        var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.9;
        var g = ctx.createGain(); g.gain.value = v;
        src.connect(f); f.connect(g); g.connect(master);
        src.start(t);
    }

    // Samples opcionales: si existe /willieinspired/sounds/<nombre>.mp3 se usa en vez del sintetizado
    var SAMPLE_BASE = '/willieinspired/sounds/';
    var samples = {}, tried = {};
    function loadSample(name) {
        if (tried[name] || !ctx) return;
        tried[name] = true;
        fetch(SAMPLE_BASE + name + '.mp3').then(function (r) {
            if (!r.ok) throw 0;
            return r.arrayBuffer();
        }).then(function (ab) {
            return new Promise(function (ok, no) { ctx.decodeAudioData(ab, ok, no); });
        }).then(function (buf) { samples[name] = buf; }).catch(function () {});
    }
    function playSample(name, t) {
        var src = ctx.createBufferSource(); src.buffer = samples[name];
        var g = ctx.createGain(); g.gain.value = 0.9;
        src.connect(g); g.connect(master); src.start(t);
    }

    var SOUNDS = {
        // Click mecánico: dos transientes cortos de ruido (~3.5kHz) + golpe grave leve
        click:   function (t) {
            snap(t, 0.014, 3800, 0.85);
            snap(t + 0.031, 0.012, 3200, 0.5);
            blip(t, { f: 180, to: 90, d: 0.03, type: 'sine', v: 0.25 });
        },
        tick:    function (t) { blip(t, { f: 1800, d: 0.025, type: 'square', v: 0.12 }); },
        pop:     function (t) { blip(t, { f: 380, to: 760, d: 0.09, type: 'sine', v: 0.55 }); },
        toggle:  function (t) { blip(t, { f: 520, d: 0.05, type: 'triangle', v: 0.4 }); blip(t + 0.05, { f: 780, d: 0.07, type: 'triangle', v: 0.4 }); },
        success: function (t) { [523, 659, 784].forEach(function (f, i) { blip(t + i * 0.07, { f: f, d: 0.16, type: 'sine', v: 0.4 }); }); },
        error:   function (t) { blip(t, { f: 220, to: 150, d: 0.18, type: 'sawtooth', v: 0.22 }); blip(t + 0.1, { f: 180, to: 120, d: 0.2, type: 'sawtooth', v: 0.22 }); },
        swoosh:  function (t) { noise(t, 0.22, 500, 3500, 0.28); },
        play:    function (t) { blip(t, { f: 440, d: 0.08, type: 'triangle', v: 0.4 }); blip(t + 0.06, { f: 660, d: 0.12, type: 'triangle', v: 0.4 }); },
        hover:   function (t) { blip(t, { f: 1400, d: 0.02, type: 'sine', v: 0.08 }); }
    };

    function play(name, force) {
        if (!enabled() || !unlocked) return;
        var fn = SOUNDS[name]; if (!fn) return;
        var c = ensure(); if (!c) return;
        var now = performance.now(), th = THROTTLE[name] || 0;
        if (!force && th && now - (last[name] || 0) < th) return;
        last[name] = now;
        if (c.state === 'suspended') c.resume();
        try {
            if (samples[name]) playSample(name, c.currentTime + 0.005); else fn(c.currentTime + 0.005);
        } catch (e) {}
        try { if (navigator.vibrate) navigator.vibrate(6); } catch (e) {}
    }

    function unlock() {
        unlocked = true;
        var c = ensure();
        if (c && c.state === 'suspended') c.resume();
        Object.keys(SOUNDS).forEach(loadSample);
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
        window.addEventListener(ev, unlock, { once: true, capture: true, passive: true });
    });

    // Delegación global de clicks
    var DEFAULT_SEL = 'button, [role="button"], summary, input[type="button"], input[type="submit"], .btn';
    window.addEventListener('click', function (e) {
        var t = e.target; if (!t || !t.closest) return;
        var tagged = t.closest('[data-sfx]');
        if (tagged) {
            if (tagged.closest('[data-sfx-skip]')) return;
            var name = tagged.getAttribute('data-sfx');
            if (name && name !== 'none') play(name);
            return;
        }
        var el = t.closest(DEFAULT_SEL);
        if (el && !el.disabled && !el.closest('[data-sfx-skip]')) play('click');
    }, true);

    window.WISfx = {
        play: function (n) { play(n, true); },
        enabled: enabled,
        setEnabled: function (v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {} },
        sounds: Object.keys(SOUNDS)
    };
})();
