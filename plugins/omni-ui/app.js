// Omni VST3 Frontend Engine (Mockup JS)

document.addEventListener('DOMContentLoaded', () => {
  const I18N = window.OMNI_I18N;   // textos ES / EN (i18n.js)
  // --- Estado Global del Plugin ---
  const state = {
    mode: 'spectrum', // 'spectrum' | 'stereo' | 'waveform'
    globalMode: 'beat', // 'beat' | 'master'
    phaseMeterMode: 'multiband', // 'multiband' | 'single'
    simulating: true,
    params: {
      loudness: 50,
      clarity: 50,
      punch: 50,
      space: 50,
      warmth: 50,

      subweight: 50,
      airshine: 50,
      gluecomp: 50,
      transients: 50,
      harmonics: 50,
      stereowidth: 50,
      maximizer: 50,
      ceiling: 50
    },
    referenceTrackLoaded: false
  };

  // --- Inicialización de Canvas del Visualizador ---
  const canvas = document.getElementById('visualizerCanvas');
  const ctx = canvas.getContext('2d');

  // Alternar modo del medidor de correlación (Multibanda / Banda Única Master) al hacer clic sobre su zona
  canvas.addEventListener('click', (e) => {
    if (state.mode !== 'stereo') return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    const meterW = 46;
    const meterH = Math.min(185, h * 0.78);
    const meterX = w - meterW - 12;
    const meterY = (h - meterH) / 2;

    if (x >= meterX && x <= meterX + meterW && y >= meterY && y <= meterY + meterH) {
      state.phaseMeterMode = (state.phaseMeterMode === 'multiband') ? 'single' : 'multiband';
    }
  });

  // --- Inicialización de Canvas de Partículas Animadas de Fondo (Silk Veil Field) ---
  const particleCanvas = document.getElementById('ambientParticlesCanvas');
  const pCtx = particleCanvas ? particleCanvas.getContext('2d') : null;
  let particles = [];
  const PARTICLE_COUNT = 520; // Cantidad equilibrada (-20%)

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    if (particleCanvas) {
      const pRect = particleCanvas.parentElement.getBoundingClientRect();
      particleCanvas.width = pRect.width * window.devicePixelRatio;
      particleCanvas.height = pRect.height * window.devicePixelRatio;
      pCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
      initParticles(pRect.width, pRect.height);
    }
  }

  // Campo de Olas de Seda Granular (Partículas suaves y equilibradas)
  function initParticles(w, h) {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: Math.random() * 1.3 + 0.65, // Radio reducido ~20%
        baseAlpha: Math.random() * 0.45 + 0.25, // Opacidad sutil reducida ~20%
        speed: Math.random() * 0.4 + 0.2,
        seed: Math.random() * 1000
      });
    }
  }

  // ===========================================================================
  // TELEMETRÍA NATIVA (C++ → JS, evento "telemetry" a 30 Hz)
  //   fft: 512 bins lineales 0..255 · sr · lufsIn/lufsOut · corr[3] (graves/medios/agudos) · scope [L,R,L,R...]
  // El espectro se remapea a 256 puntos en escala LOGARÍTMICA 20 Hz–20 kHz (coincide con los rótulos del eje) y se suaviza.
  // ===========================================================================
  const SPEC_POINTS = 256;
  const specSmooth = new Float32Array(SPEC_POINTS);
  window.__OMNI_TEL__ = null;

  function onTelemetry(t) {
    if (!t) return;
    window.__OMNI_TEL__ = t;

    if (Array.isArray(t.fft) && t.fft.length > 1 && t.sr > 0) {
      const bins = t.fft.length;
      const binHz = (t.sr / 2) / bins;
      const out = new Uint8Array(SPEC_POINTS);
      for (let i = 0; i < SPEC_POINTS; i++) {
        const f = 20 * Math.pow(1000, i / (SPEC_POINTS - 1));        // 20 Hz → 20 kHz
        const pos = Math.min(bins - 1, f / binHz);
        const i0 = Math.floor(pos), i1 = Math.min(bins - 1, i0 + 1), fr = pos - i0;
        const v = t.fft[i0] * (1 - fr) + t.fft[i1] * fr;
        // Ataque rápido / caída lenta (aspecto de analizador profesional)
        specSmooth[i] = v > specSmooth[i] ? specSmooth[i] + (v - specSmooth[i]) * 0.6 : specSmooth[i] + (v - specSmooth[i]) * 0.18;
        out[i] = specSmooth[i];
      }
      window.__OMNI_CURRENT_FFT__ = out;
    }

    if (typeof t.lufsIn === 'number' && typeof t.lufsOut === 'number')
      window.__OMNI_RECEIVE_LUFS__(t.lufsIn, t.lufsOut);
  }

  let flowTime = 0;
  let particlesCleared = false;
  function updateAndRenderParticles() {
    if (!pCtx || !particleCanvas) return;
    const w = particleCanvas.width / window.devicePixelRatio;
    const h = particleCanvas.height / window.devicePixelRatio;
    if (!isGradientTheme()) {
      if (!particlesCleared) { pCtx.clearRect(0, 0, w, h); particlesCleared = true; }
      return;
    }
    particlesCleared = false;
    const colors = [getActiveAccentColor(), getActiveAccentColor2()];

    pCtx.clearRect(0, 0, w, h);
    pCtx.shadowBlur = 4;
    flowTime += 0.008;

    particles.forEach(p => {
      // Algoritmo de campo de fuerzas sinusoide (Wave Silk Field)
      const angle = Math.sin(p.x * 0.004 + flowTime) * Math.cos(p.y * 0.004 + flowTime) * Math.PI * 2;
      const waveOffset = Math.sin(p.y * 0.01 + flowTime * 2) * 0.5;

      p.x += (Math.cos(angle) + waveOffset) * p.speed;
      p.y += (Math.sin(angle) - 0.4) * p.speed; // Deriva ondulante hacia arriba-derecha

      // Reciclaje infinito dentro del lienzo
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;

      // Variación de opacidad orgánica suavizada
      const dynamicAlpha = Math.max(0.15, Math.min(0.85, p.baseAlpha + Math.sin(p.seed + flowTime * 3) * 0.22));

      const color = colors[(p.seed * 7 | 0) & 1];
      pCtx.beginPath();
      pCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      pCtx.fillStyle = color;
      pCtx.shadowColor = color;
      pCtx.globalAlpha = dynamicAlpha;
      pCtx.fill();
    });
    pCtx.globalAlpha = 1;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ===========================================================================
  // ANIMACIONES DE INTERFAZ (inspiradas en el acordeón de tarjetas con metal líquido)
  // ===========================================================================
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Capa de efectos en cada panel (destellos del chasis Glass) y orden de entrada escalonada. Es un elemento propio: los ::before/::after de los paneles ya los usan los tooltips.
  document.querySelectorAll('.glass-card').forEach((card, i) => {
    const fx = document.createElement('span');
    fx.className = 'card-fx';
    fx.setAttribute('aria-hidden', 'true');
    card.prepend(fx);
    card.style.setProperty('--intro-i', String(i));
  });
  if (!reduceMotion) {
    document.body.classList.add('omni-intro');
    setTimeout(() => document.body.classList.remove('omni-intro'), 1900);
  }


  // ===========================================================================
  // ONDAS DE METAL LÍQUIDO
  // Cintas cromadas que ondulan; cada lugar decide qué las agita:
  //   card → al pie de la tarjeta Loudness, se agitan con la sonoridad de salida
  //   knob → al pie de las 4 perillas grandes de Beat Mode, su intensidad sigue el valor de esa perilla
  //          (Master Mode no lleva ondas: sus 8 tarjetas son pequeñas y la onda taparía los valores)
  // ===========================================================================
  const WAVE_LAYERS = {
    card: [
      { base: 0.50, amp: 0.15, k: 1.5, speed: 0.32, phase: 0.0, thick: 0.22, alpha: 0.45 },
      { base: 0.62, amp: 0.12, k: 2.2, speed: -0.45, phase: 1.7, thick: 0.17, alpha: 0.7 },
      { base: 0.74, amp: 0.09, k: 3.0, speed: 0.7, phase: 3.1, thick: 0.13, alpha: 0.95 }
    ],
    knob: [
      { base: 0.52, amp: 0.15, k: 1.3, speed: 0.4, phase: 0.6, thick: 0.20, alpha: 0.45 },
      { base: 0.66, amp: 0.11, k: 1.9, speed: -0.55, phase: 2.2, thick: 0.15, alpha: 0.7 },
      { base: 0.79, amp: 0.08, k: 2.6, speed: 0.8, phase: 3.9, thick: 0.11, alpha: 0.95 }
    ]
  };

  const outputEnergy = () => {
    const tel = window.__OMNI_TEL__;
    return tel && typeof tel.lufsOut === 'number' ? Math.max(0, Math.min(1, (tel.lufsOut + 36) / 30)) : 0.35;
  };

  function createLiquidWaves(host, kind, energyFn) {
    const canvas = document.createElement('canvas');
    canvas.className = 'liquid-ribbon is-' + kind;
    canvas.setAttribute('aria-hidden', 'true');
    host.prepend(canvas);
    const ctx = canvas.getContext('2d');
    const layers = WAVE_LAYERS[kind];
    let last = 0, energy = energyFn();

    return function draw(now) {
      if (now - last < 33) return;      // ~30 fps
      last = now;
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return;           // oculta (p. ej. la fila del otro modo)
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      energy += (energyFn() - energy) * 0.06;
      const t = reduceMotion ? 0 : now / 1000;
      const rgb = getComputedStyle(document.body).getPropertyValue('--ribbon-rgb').trim() || '255, 255, 255';
      const acc = hexRgb(getActiveAccentColor());
      const steps = Math.max(32, Math.min(120, Math.round(cw / 6)));

      layers.forEach((L) => {
        const A = L.amp * ch * (0.45 + energy * 1.0);
        const top = [], bot = [];
        for (let i = 0; i <= steps; i++) {
          const x = (i / steps) * cw, u = x / cw;
          const y = ch * L.base + A * Math.sin(u * Math.PI * L.k + t * L.speed + L.phase)
                  + A * 0.35 * Math.sin(u * Math.PI * L.k * 2.3 - t * L.speed * 1.3);
          const th = ch * L.thick * (0.55 + 0.45 * Math.sin(u * Math.PI * 1.3 + t * 0.4 + L.phase));
          top.push([x, y]);
          bot.push([x, y + th]);
        }
        // Cuerpo: brillo cromado arriba, reflejo tenue del color del tema y fundido a oscuro
        const y0 = ch * (L.base - L.amp * 1.5), y1 = ch * (L.base + L.amp * 1.5 + L.thick);
        const body = ctx.createLinearGradient(0, y0, 0, y1);
        body.addColorStop(0, `rgba(${rgb}, ${0.32 * L.alpha})`);
        body.addColorStop(0.4, rgba(acc, 0.12 * L.alpha));
        body.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
        ctx.closePath();
        ctx.fillStyle = body;
        ctx.fill();

        // Filo especular: el punto de luz recorre la cinta despacio
        const p = 0.5 + 0.42 * Math.sin(t * 0.28 + L.phase);
        const edge = ctx.createLinearGradient(0, 0, cw, 0);
        edge.addColorStop(0, `rgba(${rgb}, ${0.08 * L.alpha})`);
        edge.addColorStop(Math.max(0.01, p - 0.22), `rgba(${rgb}, ${0.35 * L.alpha})`);
        edge.addColorStop(p, `rgba(${rgb}, ${0.95 * L.alpha})`);
        edge.addColorStop(Math.min(0.99, p + 0.22), `rgba(${rgb}, ${0.35 * L.alpha})`);
        edge.addColorStop(1, `rgba(${rgb}, ${0.08 * L.alpha})`);
        ctx.beginPath();
        top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      });
    };
  }

  const waveDrawers = [];
  const loudCard = document.querySelector('.main-knob-card');
  if (loudCard) waveDrawers.push(createLiquidWaves(loudCard, 'card', outputEnergy));
  document.querySelectorAll('#macroRow > .macro-card').forEach((card) => {
    const knob = card.querySelector('.knob-container[data-param]');
    if (!knob) return;
    const param = knob.dataset.param;
    // 0 % → casi quietas, 100 % → muy agitadas: la onda "muestra" cuánto está actuando esa perilla
    waveDrawers.push(createLiquidWaves(card, 'knob', () => 0.05 + 0.95 * Math.max(0, Math.min(100, Number(state.params[param]) || 0)) / 100));
  });
  function drawLiquidRibbon(now) { for (const d of waveDrawers) d(now); }

  // --- Web Audio API Synth Simulator ---
  let audioCtx, osc, gainNode, analyser;
  let dataArray, bufferLength;

  function initAudioSim() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Generador de Ruido Rosa/Música Simulada
    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11;
      b6 = white * 0.115926;
    }

    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.08;

    whiteNoise.connect(gainNode);
    gainNode.connect(analyser);
    whiteNoise.start(0);
  }

  // --- Generador de Datos Simulados si no hay Audio Nivel Hardware ---
  function getSimulatedData() {
    if (window.__OMNI_CURRENT_FFT__) {
      return window.__OMNI_CURRENT_FFT__;
    }
    // Dentro del DAW nunca se muestran datos inventados: sin señal, el espectro está en reposo
    if (IS_HOST) return new Uint8Array(256);
    const arr = new Uint8Array(256);
    const time = Date.now() * 0.003;
    const isMaster = state.globalMode === 'master';

    for (let i = 0; i < 256; i++) {
      const freqFactor = (256 - i) / 256;
      let val = Math.sin(i * 0.08 + time) * 40 + Math.cos(i * 0.04 - time * 1.5) * 35;
      val += freqFactor * 130 + Math.sin(time * 4) * 20;

      if (isMaster) {
        val += Math.sin(i * 0.12 + time * 2) * 15;
      }
      arr[i] = Math.max(15, Math.min(240, val));
    }
    return arr;
  }

  // --- Renderizado Histórico para Spectrogram Heatmap ---
  const spectrogramHistory = [];
  const maxHistory = 100;

  // --- Bucle Principal de Animación (60 FPS) ---
  function renderVisualizer() {
    requestAnimationFrame(renderVisualizer);

    // Animación continua de partículas de fondo si la skin gradiente está activa
    updateAndRenderParticles();
    drawLiquidRibbon(performance.now());

    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    // Fondo negro absoluto para el visor del canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    let freqData;
    if (window.__OMNI_CURRENT_FFT__) {
      freqData = window.__OMNI_CURRENT_FFT__;
    } else if (analyser) {
      analyser.getByteFrequencyData(dataArray);
      freqData = dataArray;
    } else {
      freqData = getSimulatedData();
    }

    if (state.mode === 'spectrum') {
      drawSpectrum(ctx, w, h, freqData);
    } else if (state.mode === 'stereo') {
      drawStereometer(ctx, w, h, freqData);
    } else if (state.mode === 'waveform') {
      drawWaveform(ctx, w, h, freqData);
    }

    updateMeters(freqData);
  }

  // --- Cuadrícula Técnica (Osciloscopio / Analizador) ---
  function drawTechnicalGrid(ctx, w, h) {
    // Líneas de cuadrícula del fondo eliminadas para una pantalla limpia y limpia de distracciones
    return;
  }

  // --- Modo 1: Spectrum ---
  // Colores de los visores (canvas). La pantalla del visor siempre es negra: si el chasis oscurece el acento para que
  // se lea sobre aluminio, aquí se usa la versión clara (--display-accent).
  function cssVar(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }
  function getActiveAccentColor() {
    return cssVar('--display-accent') || cssVar('--accent-color') || '#FF1E27';
  }
  function getActiveAccentColor2() {
    return cssVar('--display-accent-2') || cssVar('--accent-color-2') || getActiveAccentColor();
  }
  // '#RRGGBB' → [r, g, b] (los temas se definen en hex)
  function hexRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return [255, 30, 39];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(c, a) { return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`; }
  function mixRgb(a, b, t) { return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)); }
  const isGradientTheme = () => (state.theme && typeof state.theme.led === 'string' && state.theme.led.startsWith('gradient-'));

  function drawSpectrum(ctx, w, h, data) {
    drawTechnicalGrid(ctx, w, h);

    const accentColor = getActiveAccentColor();
    const c1 = hexRgb(accentColor), c2 = hexRgb(getActiveAccentColor2());
    // Deriva lenta (~20 s por ciclo) para que el degradado "respire" sin distraer; en colores lisos no cambia nada
    const drift = isGradientTheme() ? 0.18 * Math.sin(performance.now() / 3200) : 0;

    ctx.save();
    ctx.shadowBlur = 5;
    ctx.shadowColor = accentColor;

    ctx.beginPath();
    ctx.moveTo(0, h);

    const points = [];
    const len = data.length;
    for (let i = 0; i < len; i++) {
      const x = (i / len) * w;
      const v = data[i] / 255;
      const y = h - v * (h * 0.82) - 10;
      points.push({ x, y });
    }

    // Dibujar Curva Suave
    ctx.moveTo(0, h);
    for (let i = 0; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }

    ctx.lineTo(w, h);
    ctx.closePath();

    // Relleno: color del tema de izquierda (graves) a derecha (agudos) y desvanecido hacia abajo
    const hGrad = ctx.createLinearGradient(-w * drift, 0, w * (1 - drift), 0);
    hGrad.addColorStop(0, rgba(c1, 0.75));
    hGrad.addColorStop(1, rgba(c2, 0.75));
    ctx.fillStyle = hGrad;
    ctx.fill();
    const fade = ctx.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    fade.addColorStop(0.45, 'rgba(0, 0, 0, 0.45)');
    fade.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
    ctx.shadowBlur = 0;
    ctx.fillStyle = fade;
    ctx.fill();

    const sGrad = ctx.createLinearGradient(-w * drift, 0, w * (1 - drift), 0);
    sGrad.addColorStop(0, rgba(c1, 1));
    sGrad.addColorStop(1, rgba(c2, 1));
    ctx.shadowBlur = 5;
    ctx.strokeStyle = sGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // Curva REAL de la canción de referencia (espectro promedio calculado por el motor C++), dibujada como línea punteada.
    // Se ancla al nivel medio de tu señal (100 Hz–10 kHz) para comparar la FORMA del espectro, no el volumen.
    if (state.referenceTrackLoaded && state.refCurve && state.refCurve.length === 256) {
      let sum = 0, cnt = 0;
      for (let i = 59; i <= 229 && i < len; i++) { sum += data[i]; cnt++; }
      const liveMean = cnt ? sum / cnt / 255 : 0;
      const anchor = (window.__OMNI_REF_ANCHOR__ = (window.__OMNI_REF_ANCHOR__ === undefined ? 0.55 : window.__OMNI_REF_ANCHOR__) * 0.94 + (liveMean > 0.05 ? liveMean : 0.55) * 0.06);
      const curve = state.refCurve;

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(245, 242, 237, 0.85)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.4;
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * w;
        const dbRel = (curve[i] / 255) * 60 - 40;                         // -40 … +20 dB respecto a la media
        const v = Math.max(0, Math.min(1, anchor + dbRel / 106));         // 1 unidad del analizador = 106 dB (-100 … +6)
        const y = h - v * (h * 0.82) - 10;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = 'rgba(245, 242, 237, 0.6)';
      ctx.font = '9px "Space Grotesk", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('- - -  REFERENCIA: ' + (state.refName || ''), 10, 14);
      ctx.restore();
    }
  }

  // --- Modo 2: Estereómetro / Goniómetro Polar + Medidor de Correlación de Fase Multibanda ---
  function drawStereometer(ctx, w, h, data) {
    drawTechnicalGrid(ctx, w, h);

    // Shift Goniometer slightly left to make room for the Phase Correlation Meter on the right
    const meterBoxWidth = 52;
    const cx = (w - (meterBoxWidth + 15)) / 2;
    const cy = h / 2;
    const radius = Math.min(w - 70, h) * 0.37;

    // 1. Dibujar Cuadrícula de Diamante Exterior y Ejes de Fase (Sutil y Elegante)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.2;

    // Diamante Exterior (45 grados)
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx + radius, cy);
    ctx.lineTo(cx, cy + radius);
    ctx.lineTo(cx - radius, cy);
    ctx.closePath();
    ctx.stroke();

    // Diamantes Interiores Concentricos (Escala)
    for (let rFactor of [0.66, 0.33]) {
      const rInner = radius * rFactor;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - rInner);
      ctx.lineTo(cx + rInner, cy);
      ctx.lineTo(cx, cy + rInner);
      ctx.lineTo(cx - rInner, cy);
      ctx.closePath();
      ctx.stroke();
    }

    // Ejes Cruzados (L/R y Mid/Side)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius * 1.1); ctx.lineTo(cx, cy + radius * 1.1); // M (Mid / Vertical)
    ctx.moveTo(cx - radius * 1.1, cy); ctx.lineTo(cx + radius * 1.1, cy); // S (Side / Horizontal)

    // Diagonal 45° L / R
    const diag = radius * 0.78;
    ctx.moveTo(cx - diag, cy - diag); ctx.lineTo(cx + diag, cy + diag); // L
    ctx.moveTo(cx + diag, cy - diag); ctx.lineTo(cx - diag, cy + diag); // R
    ctx.stroke();
    ctx.restore();

    // 2. Generación y Renderizado de Nube de Puntos de Fase Estéreo (Goniómetro con Glow)
    const spaceSpread = ((state.params.space !== undefined ? state.params.space : 50) / 100);

    // Con el plugin cargado en un DAW se dibujan las muestras L/R reales de la salida; en la vista previa (navegador)
    // se mantiene la simulación.
    const tel = window.__OMNI_TEL__;
    const realScope = IS_HOST && tel && Array.isArray(tel.scope) && tel.scope.length >= 4 ? tel.scope : null;
    const pointsCount = realScope ? realScope.length / 2 : 140;

    // Autoescala suave: el goniómetro ocupa el diamante aunque el material esté a bajo nivel
    if (realScope) {
      let pk = 0.05;
      for (let k = 0; k < realScope.length; k++) pk = Math.max(pk, Math.abs(realScope[k]));
      window.__OMNI_SCOPE_PK__ = (window.__OMNI_SCOPE_PK__ || pk) * 0.92 + pk * 0.08;
    }
    const scopeGain = realScope ? 1 / Math.max(0.12, window.__OMNI_SCOPE_PK__ || 0.5) : 1;

    ctx.save();
    ctx.shadowBlur = 8;

    for (let i = 0; i < pointsCount; i++) {
      let left, right;
      if (realScope) {
        left = realScope[i * 2] * scopeGain * 0.9;
        right = realScope[i * 2 + 1] * scopeGain * 0.9;
      } else {
        const sample = data[i % data.length] / 255;
        const phase = (i * 0.18) + (Date.now() * 0.003);
        left = Math.sin(phase) * sample;
        right = Math.cos(phase * 1.1) * sample * spaceSpread;
      }

      // Transformación de coordenadas estéreo a rotación de 45° (Goniometer Polar Matrix)
      const mid = (left + right) * 0.7071;
      const side = (left - right) * 0.7071;

      const px = cx + side * radius * 0.85;
      const py = cy - mid * radius * 0.85;
      const pointDist = Math.hypot(side, mid);

      // Color dinámico según la correlación de fase y energía
      let dotColor;
      if (pointDist > 0.65) {
        dotColor = '#e74c3c'; // Rojo Neón / Alerta Picos
      } else if (pointDist > 0.4) {
        dotColor = '#f1c40f'; // Amarillo Neón
      } else if (pointDist > 0.2) {
        dotColor = '#2ecc71'; // Verde Neón
      } else {
        dotColor = '#B7B4AE'; // Ashes
      }

      ctx.shadowColor = dotColor;
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(px, py, Math.random() * 1.5 + 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Medidor de Correlación de Fase Multibanda Integrado (Estilo Imagen de Referencia)
    drawPhaseCorrelationMeter(ctx, w, h, data, spaceSpread);
  }

  // --- Renderizado del Medidor de Correlación de Fase (Multibanda / Banda Única con Estética SVNDVLPHON) ---
  function drawPhaseCorrelationMeter(ctx, w, h, data, spaceSpread) {
    const meterW = 46;
    const meterH = Math.min(185, h * 0.78);
    const meterX = w - meterW - 12;
    const meterY = (h - meterH) / 2;
    const zeroY = meterY + meterH / 2;

    const isSingle = (state.phaseMeterMode === 'single');

    ctx.save();

    // 1. Panel de Vidrio Biselado Hardware (Gradient Metallic Glass)
    const panelGrad = ctx.createLinearGradient(meterX, meterY, meterX + meterW, meterY + meterH);
    panelGrad.addColorStop(0, 'rgba(18, 16, 24, 0.92)');
    panelGrad.addColorStop(0.5, 'rgba(10, 9, 14, 0.95)');
    panelGrad.addColorStop(1, 'rgba(16, 14, 22, 0.92)');

    ctx.fillStyle = panelGrad;
    ctx.strokeStyle = 'rgba(215, 222, 235, 0.38)';
    ctx.lineWidth = 1.2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(meterX, meterY, meterW, meterH, 7);
    } else {
      ctx.rect(meterX, meterY, meterW, meterH);
    }
    ctx.fill();
    ctx.stroke();

    // 2. Encabezado de Modo (MULTI / MSTR)
    ctx.fillStyle = 'rgba(245, 242, 237, 0.55)';
    ctx.font = '7.5px "Space Grotesk", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(isSingle ? 'MSTR' : 'MULTI', meterX + meterW / 2, meterY + 11);

    // Escala Lateral (+1, 0, -1)
    ctx.fillStyle = 'rgba(245, 242, 237, 0.75)';
    ctx.font = '9px "Space Grotesk", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('+1', meterX - 3, meterY + 9);
    ctx.fillText('0', meterX - 3, zeroY + 3);
    ctx.fillText('-1', meterX - 3, meterY + meterH - 2);

    // Ticks Intermedios de Escala (+0.5 y -0.5)
    const tickPlusY = meterY + meterH * 0.25;
    const tickMinusY = meterY + meterH * 0.75;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    [tickPlusY, tickMinusY].forEach(ty => {
      ctx.beginPath();
      ctx.moveTo(meterX, ty);
      ctx.lineTo(meterX + 4, ty);
      ctx.moveTo(meterX + meterW - 4, ty);
      ctx.lineTo(meterX + meterW, ty);
      ctx.stroke();
    });

    // Línea de Referencia Neutra 0 (Cero Correlación con Glow)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(meterX, zeroY);
    ctx.lineTo(meterX + meterW, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Cálculo de Correlación de Fase Multibanda
    let lowSum = 0, midSum = 0, highSum = 0;
    const len = data.length;
    for (let i = 0; i < len; i++) {
      const val = data[i] / 255;
      if (i < len * 0.25) lowSum += val;
      else if (i < len * 0.65) midSum += val;
      else highSum += val;
    }
    const lowAvg = lowSum / (len * 0.25);
    const midAvg = midSum / (len * 0.40);
    const highAvg = highSum / (len * 0.35);

    const time = Date.now() * 0.003;

    // Correlación de fase (-1 a +1): REAL (calculada por el motor C++ sobre la salida) dentro del DAW; simulada en el navegador
    const telC = window.__OMNI_TEL__ && window.__OMNI_TEL__.corr;
    const useReal = IS_HOST && Array.isArray(telC) && telC.length === 3;
    let lowCorr, midCorr, highCorr;
    if (useReal) {
      // Suavizado visual para que las barras no vibren
      const sm = (window.__OMNI_CORR_SM__ = window.__OMNI_CORR_SM__ || [telC[0], telC[1], telC[2]]);
      for (let k = 0; k < 3; k++) sm[k] += (telC[k] - sm[k]) * 0.25;
      lowCorr = sm[0]; midCorr = sm[1]; highCorr = sm[2];
    } else {
      lowCorr = Math.min(0.98, Math.max(0.2, 0.95 - (spaceSpread * 0.12) + Math.sin(time) * 0.05 * lowAvg));
      midCorr = Math.min(0.95, Math.max(-0.35, 0.72 - (spaceSpread * 0.45) + Math.cos(time * 1.3) * 0.09 * midAvg));
      highCorr = Math.min(0.90, Math.max(-0.65, 0.50 - (spaceSpread * 0.70) + Math.sin(time * 1.7) * 0.14 * highAvg));
    }

    function getValY(c) {
      const norm = (c + 1) / 2; // -1 -> 0 (bottom), 1 -> 1 (top)
      return meterY + 16 + (1 - norm) * (meterH - 32);
    }

    const effZeroY = getValY(0);

    if (isSingle) {
      // --- Modo Banda Única Master ---
      const masterCorr = (lowCorr * 0.5) + (midCorr * 0.3) + (highCorr * 0.2);
      const masterY = getValY(masterCorr);
      const barW = 16;
      const barX = meterX + (meterW - barW) / 2;

      let masterColor = '#2ECC71';
      if (masterCorr < 0) masterColor = '#FF0055';
      else if (masterCorr < 0.4) masterColor = '#FFB703';

      ctx.save();
      ctx.fillStyle = masterColor + '40';
      if (masterY <= effZeroY) {
        ctx.fillRect(barX, masterY, barW, effZeroY - masterY);
      } else {
        ctx.fillRect(barX, effZeroY, barW, masterY - effZeroY);
      }

      ctx.shadowBlur = 8;
      ctx.shadowColor = masterColor;
      ctx.fillStyle = masterColor;
      ctx.fillRect(barX - 2, masterY - 2, barW + 4, 5);
      ctx.restore();

      ctx.fillStyle = 'rgba(245, 242, 237, 0.6)';
      ctx.font = '7.5px "Space Grotesk", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MSTR', meterX + meterW / 2, meterY + meterH - 5);

    } else {
      // --- Modo Multibanda (LOW, MID, HIGH) ---
      const bands = [
        { label: 'L', corr: lowCorr, defaultColor: '#FF3B30', x: meterX + 6 },  // LOW (Red)
        { label: 'M', corr: midCorr, defaultColor: '#2ECC71', x: meterX + 19 }, // MID (Green)
        { label: 'H', corr: highCorr, defaultColor: '#00F0FF', x: meterX + 32 } // HIGH (Cyan/Blue)
      ];

      const barW = 8;

      bands.forEach(band => {
        const yVal = getValY(band.corr);

        // Cambio dinámico a color de advertencia magenta/rojo (#FF0055) si la correlación es negativa
        const activeColor = band.corr < 0 ? '#FF0055' : band.defaultColor;

        // Canal Semitransparente de Relleno desde Cero (0) hasta el Valor
        ctx.save();
        ctx.fillStyle = activeColor + '45';
        if (yVal <= effZeroY) {
          ctx.fillRect(band.x, yVal, barW, effZeroY - yVal);
        } else {
          ctx.fillRect(band.x, effZeroY, barW, yVal - effZeroY);
        }

        // Bloque / Indicador LED Principal con Glow
        ctx.shadowBlur = (band.corr < 0) ? 10 : 6;
        ctx.shadowColor = activeColor;
        ctx.fillStyle = activeColor;
        ctx.fillRect(band.x - 1, yVal - 2, barW + 2, 4);
        ctx.restore();

        // Etiquetas Micro de Banda (L, M, H) en la parte inferior del medidor
        ctx.fillStyle = 'rgba(245, 242, 237, 0.6)';
        ctx.font = '7.5px "Space Grotesk", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(band.label, band.x + barW / 2, meterY + meterH - 5);
      });

      // Indicador General Master (Línea Blanca en el Promedio General)
      const masterCorr = (lowCorr * 0.5) + (midCorr * 0.3) + (highCorr * 0.2);
      const masterY = getValY(masterCorr);
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#FFFFFF';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(meterX + 3, masterY);
      ctx.lineTo(meterX + meterW - 3, masterY);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // --- Modo 3: Waveform Cromática Multibanda ---
  const waveformHistory = [];
  const maxWaveformSlices = 120;

  function drawWaveform(ctx, w, h, data) {
    drawTechnicalGrid(ctx, w, h);

    const cy = h / 2;

    // Guardar slice actual en el histórico para efecto scrolling
    waveformHistory.unshift(Array.from(data));
    if (waveformHistory.length > maxWaveformSlices) waveformHistory.pop();

    const sliceWidth = w / maxWaveformSlices;
    const wfC1 = hexRgb(getActiveAccentColor()), wfC2 = hexRgb(getActiveAccentColor2());

    ctx.save();
    ctx.shadowBlur = 6;

    for (let i = 0; i < waveformHistory.length; i++) {
      const slice = waveformHistory[i];
      const x = w - (i * sliceWidth);

      // Calcular energía por bandas (Low: 0-10, Mid: 11-40, High: 41+)
      let lowEnergy = 0, midEnergy = 0, highEnergy = 0;
      const len = slice.length;

      for (let k = 0; k < len; k++) {
        const val = slice[k] / 255;
        if (k < len * 0.2) lowEnergy += val;
        else if (k < len * 0.6) midEnergy += val;
        else highEnergy += val;
      }

      lowEnergy /= (len * 0.2);
      midEnergy /= (len * 0.4);
      highEnergy /= (len * 0.4);

      // Amplitud total vertical
      const totalAmp = Math.min(1.0, (lowEnergy * 0.5 + midEnergy * 0.35 + highEnergy * 0.25) * 1.4);
      const barHeight = totalAmp * (h * 0.85);

      // Color por frecuencia con la PALETA DEL TEMA: graves → color principal profundo, agudos → segundo color y más
      // luminoso. Se sigue leyendo dónde hay bombo/808 y dónde hay hats, pero combina con cualquier skin.
      const tot = lowEnergy + midEnergy + highEnergy + 1e-6;
      const tl = lowEnergy / tot, th = highEnergy / tot;
      let col = mixRgb(wfC1, wfC2, Math.min(1, th * 1.6));
      col = th > tl ? mixRgb(col, [255, 255, 255], Math.min(0.55, (th - tl) * 1.2))
                    : mixRgb(col, [0, 0, 0], Math.min(0.45, (tl - th) * 0.9));
      const [r, g, b] = col;

      const grad = ctx.createLinearGradient(0, cy - barHeight / 2, 0, cy + barHeight / 2);
      grad.addColorStop(0, `rgb(${r}, ${g}, ${b})`);
      grad.addColorStop(0.5, `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)})`);
      grad.addColorStop(1, `rgb(${r}, ${g}, ${b})`);

      ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
      ctx.fillStyle = grad;
      ctx.fillRect(x - sliceWidth, cy - barHeight / 2, sliceWidth + 0.5, barHeight);
    }

    ctx.restore();

    // Línea central de referencia
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.stroke();
  }

  // --- Telemetría de Medidores LUFS (Medición C++ Native a 60 FPS) ---
  window.__OMNI_RECEIVE_LUFS__ = function(inLufs, outLufs) {
    const meterInFill = document.getElementById('meterInFill');
    const meterInVal = document.getElementById('meterInVal');
    const meterOutFill = document.getElementById('meterOutFill');
    const meterOutVal = document.getElementById('meterOutVal');

    const fmt = (v) => (v <= -69.5 ? '-∞ LUFS' : `${v.toFixed(1)} LUFS`);
    if (meterInVal) meterInVal.textContent = fmt(inLufs);
    if (meterOutVal) meterOutVal.textContent = fmt(outLufs);

    const normIn = Math.max(0, Math.min(100, (inLufs + 40) * 2.5));    // -40 … 0 LUFS
    const normOut = Math.max(0, Math.min(100, (outLufs + 40) * 2.5));

    if (meterInFill) meterInFill.style.width = `${normIn}%`;
    if (meterOutFill) meterOutFill.style.width = `${normOut}%`;
  };

  function updateMeters(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    const avg = sum / data.length;
    const loudnessFactor = state.params.loudness / 100;

    const inLufs = -24 + (avg / 255) * 12;
    const outLufs = inLufs + (loudnessFactor * 6);

    const meterInVal = document.getElementById('meterInVal');
    const meterOutVal = document.getElementById('meterOutVal');
    if (meterInVal && !IS_HOST) meterInVal.textContent = `${inLufs.toFixed(1)} LUFS`;
    if (meterOutVal && !IS_HOST) meterOutVal.textContent = `${outLufs.toFixed(1)} LUFS`;
  }

  // --- Event Listeners UI & Sistema de Presets Dual ---
  
  // Los presets de fábrica viven en presets.js (datos puros, validados en C++ por tests/OmniTests.cpp)
  const PRESETS = window.OMNI_PRESETS;
  const NEUTRAL_PARAMS = PRESETS.NEUTRAL;
  const beatPresetData = PRESETS.beatPresetData;
  const referenceTargetData = PRESETS.masterPresetData;   // pestaña "MASTER PRESETS"
  const presetValuesMap = PRESETS.presetValuesMap;

  // Presets del usuario (se guardan dentro del proyecto DAW, ver collectUi)
  const userPresetsData = {
    beat: [],
    target: []
  };

  // Un preset SIEMPRE define los 13 parámetros: los que no especifica (presets de usuario antiguos) quedan neutros (50).
  function getPresetValues(presetName, itemObj) {
    let found = null;
    if (itemObj && itemObj.isUser && itemObj.params) found = itemObj.params;
    else if (presetValuesMap[presetName]) found = presetValuesMap[presetName];
    else if (itemObj && itemObj.sub && presetValuesMap[itemObj.sub]) found = presetValuesMap[itemObj.sub];
    return Object.assign({}, NEUTRAL_PARAMS, found || {});
  }

  // Envía un conjunto de valores al procesador con gestos de automatización y anima los knobs
  function pushParamSet(values) {
    Object.entries(values).forEach(([param, val]) => {
      gesture(param, true);
      sendParamToNative(param, val);
    });
    // Las escrituras salen en el próximo fotograma; los gestos se cierran justo después
    requestAnimationFrame(() => requestAnimationFrame(() => {
      Object.keys(values).forEach((param) => gesture(param, false));
    }));
    animateKnobsTo(values);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Estado de Navegación de Presets
  let activeTab = 'beat'; // 'beat' | 'target'
  let currentPresetIndex = 0;
  let currentPresetFull = 'No Preset';

  function getActiveFlatList() {
    const list = [];
    if (activeTab === 'beat') {
      list.push({ type: 'beat', category: null, sub: 'No Preset', fullName: 'No Preset' });
      
      // Presets de Usuario dentro de My Presets
      userPresetsData.beat.forEach(uPreset => {
        list.push({
          type: 'beat',
          category: 'My Presets',
          sub: uPreset.sub,
          fullName: uPreset.fullName,
          isUser: true,
          params: uPreset.params
        });
      });

      // Init Patch (Default Beat)
      list.push({ type: 'beat', category: null, sub: 'Default Beat (Start Here)', fullName: 'Default Beat (Start Here)' });

      // Presets de Fábrica
      Object.entries(beatPresetData).forEach(([category, subPresets]) => {
        subPresets.forEach(sub => {
          list.push({ type: 'beat', category, sub, fullName: `${category} - ${sub}` });
        });
      });
    } else {
      // Presets de Usuario dentro de My Presets
      userPresetsData.target.forEach(uPreset => {
        list.push({
          type: 'target',
          category: 'My Presets',
          sub: uPreset.sub,
          fullName: uPreset.fullName,
          isUser: true,
          params: uPreset.params
        });
      });

      // Presets de Fábrica
      if (Array.isArray(referenceTargetData)) {
        referenceTargetData.forEach(sub => {
          list.push({ type: 'target', category: null, sub, fullName: sub });
        });
      } else {
        Object.entries(referenceTargetData).forEach(([category, subPresets]) => {
          subPresets.forEach(sub => {
            list.push({ type: 'target', category, sub, fullName: sub });
          });
        });
      }
    }
    return list;
  }

  // Comunicación bidireccional Nativa (JS <-> JUCE 8 C++)
  // ===========================================================================
  // PUENTE JUCE 8 (única vía JS ↔ C++)
  //   JS → C++ : backend.emitEvent('__juce__invoke', {name, params, resultId})  → Promise (respuesta '__juce__complete')
  //   C++ → JS : backend.addEventListener('params' | 'ui' | 'telemetry', ...)
  // (Las llamadas antiguas window.__juce / window.__JUCE__.backend[fn] NO existen en JUCE 8: por eso nada llegaba al DSP.)
  // ===========================================================================
  const backend = window.__JUCE__ && window.__JUCE__.backend;
  const IS_HOST = !!backend;
  const _pending = {};
  let _nextId = 0;
  const _listeners = { params: [], ui: [], telemetry: [], license: [], refProgress: [], autoLevel: [], learnProgress: [], learnDone: [] };

  if (IS_HOST) {
    backend.addEventListener('__juce__complete', (d) => {
      const p = _pending[d.promiseId];
      if (p) { delete _pending[d.promiseId]; p(d.result); }
    });
    Object.keys(_listeners).forEach((ev) => {
      backend.addEventListener(ev, (data) => {
        _listeners[ev].forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
      });
    });
  }

  function native(name, ...args) {
    if (!IS_HOST) return Promise.resolve(null);
    return new Promise((resolve) => {
      const id = _nextId++;
      _pending[id] = resolve;
      backend.emitEvent('__juce__invoke', { name: name, params: args, resultId: id });
    });
  }
  function onNative(ev, fn) { _listeners[ev].push(fn); }

  // Los cambios de knob se agrupan en un solo envío por fotograma (arrastrar un knob genera cientos de eventos)
  let _paramQueue = {};
  let _paramScheduled = false;
  function sendParamToNative(param, val) {
    if (!IS_HOST) return;
    _paramQueue[param] = val;
    if (!_paramScheduled) {
      _paramScheduled = true;
      requestAnimationFrame(flushParamQueue);
    }
  }
  function flushParamQueue() {
    _paramScheduled = false;
    const q = _paramQueue;
    _paramQueue = {};
    Object.keys(q).forEach((k) => native('setParam', k, q[k]));
  }
  // Gestos de automatización: el DAW graba/“toca” el parámetro correctamente (touch/latch)
  function gesture(param, begin) { if (IS_HOST) native('paramGesture', param, begin); }

  // ---- Estado de interfaz persistente (lo guarda el DAW dentro del proyecto) -----------------------------------
  let _uiReady = false;      // hasta recibir el estado guardado NO se persiste nada (así jamás se pisa con valores por defecto)
  let _persistTimer = null;
  function collectUi() {
    return {
      v: 2,
      chassis: state.theme.chassis,
      led: state.theme.led,
      mode: state.globalMode,
      tab: activeTab,
      vis: state.mode,
      preset: presetRaw(),
      presetFull: currentPresetFull,
      ref: state.refName ? { name: state.refName, curve: state.refCurve || null, loud: state.refLoudLufs } : null,
      userPresets: userPresetsData
    };
  }
  function persistUi(now) {
    if (!IS_HOST || !_uiReady) return;
    clearTimeout(_persistTimer);
    const send = () => { _persistTimer = null; native('setUiState', JSON.stringify(collectUi())); };
    if (now) send(); else _persistTimer = setTimeout(send, 80);
  }
  // Si la ventana se cierra con un cambio pendiente, se envía en el último instante
  window.addEventListener('pagehide', () => { if (_persistTimer) persistUi(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && _persistTimer) persistUi(true); });

  function clamp01to100(v) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 50; }
  function cleanUserPresets(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, 200).filter((p) => p && typeof p.sub === 'string' && p.params && typeof p.params === 'object').map((p) => {
      const params = {};
      Object.keys(NEUTRAL_PARAMS).forEach((k) => { params[k] = clamp01to100(p.params[k] !== undefined ? p.params[k] : NEUTRAL_PARAMS[k]); });
      const name = p.sub.slice(0, 32);
      return { sub: name, fullName: name, isUser: true, params: params };
    });
  }

  function applyUiState(raw) {
    let ui = raw;
    if (typeof raw === 'string') { try { ui = JSON.parse(raw); } catch (e) { ui = null; } }
    if (!ui || typeof ui !== 'object') return;

    if (ui.userPresets && typeof ui.userPresets === 'object') {
      userPresetsData.beat = cleanUserPresets(ui.userPresets.beat);
      userPresetsData.target = cleanUserPresets(ui.userPresets.target);
    }
    if (typeof ui.chassis === 'string' && typeof ui.led === 'string') applyTheme(ui.chassis, ui.led, false);

    if (ui.mode === 'beat' || ui.mode === 'master') {
      setGlobalMode(ui.mode, true);
    }
    if (ui.tab === 'beat' || ui.tab === 'target') activeTab = ui.tab;

    if (ui.vis === 'spectrum' || ui.vis === 'stereo' || ui.vis === 'waveform') {
      state.mode = ui.vis;
      document.querySelectorAll('.toggle-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === ui.vis));
      const ax = document.querySelector('.canvas-axis-overlay');
      if (ax) ax.style.display = ui.vis === 'spectrum' ? 'block' : 'none';
    }

    // Preset activo: se localiza por nombre completo; solo se muestra (los valores ya vienen de los parámetros del DAW)
    const flat = getActiveFlatList();
    const idx = flat.findIndex((p) => p.fullName === ui.presetFull);
    if (idx >= 0) currentPresetIndex = idx;
    currentPresetFull = idx >= 0 ? ui.presetFull : 'No Preset';
    setPresetText(idx >= 0 ? flat[idx].sub : (typeof ui.preset === 'string' ? ui.preset.slice(0, 40) : 'No Preset'));
    renderPresetMenu();

    // Referencia guardada en el proyecto (nombre + curva espectral). Formato antiguo: solo el nombre.
    const refName = ui.ref && typeof ui.ref === 'object' ? ui.ref.name : (typeof ui.ref === 'string' ? ui.ref : '');
    if (refName && typeof refName === 'string') {
      const curve = ui.ref && Array.isArray(ui.ref.curve) && ui.ref.curve.length === 256 ? ui.ref.curve.map((v) => Math.max(0, Math.min(255, Math.round(Number(v) || 0)))) : null;
      state.refCurve = curve;
      const loud = ui.ref && typeof ui.ref === 'object' ? Number(ui.ref.loud) : NaN;
      state.refLoudLufs = isFinite(loud) && loud > -40 && loud < 0 ? loud : null;
      setReferenceLoadedState(refName.slice(0, 80));
    } else if (state.referenceTrackLoaded) {
      setReferenceDefaultState();
    }
  }

  // Cambios de parámetros originados fuera de la UI (automatización del DAW, cargar preset del host, Reference Match)
  function applyParamsFromNative(params) {
    if (!params) return;
    Object.keys(params).forEach((param) => {
      if (param === 'inputtrim') { setTrimUI(Number(params[param]), true); return; }
      const knob = document.querySelector(`.knob-container[data-param="${param}"]`);
      if (knob) applyKnobUI(knob, Math.round(Number(params[param])), true);
    });
  }
  onNative('params', applyParamsFromNative);
  onNative('ui', applyUiState);
  onNative('telemetry', onTelemetry);

  // ---- Input Trim (dB) ------------------------------------------------------------------------------------------
  const TRIM_DEFAULT = -12;
  const trimSlider = document.getElementById('trimSlider');
  const trimValue = document.getElementById('trimValue');
  function setTrimUI(db, fromNative) {
    if (!isFinite(db)) return;
    db = Math.max(-24, Math.min(12, db));
    state.trimDb = db;
    if (trimSlider && document.activeElement !== trimSlider) trimSlider.value = String(db);
    if (trimValue) trimValue.textContent = `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
    if (!fromNative) sendParamToNative('inputtrim', db);
  }
  if (trimSlider) {
    trimSlider.addEventListener('pointerdown', () => gesture('inputtrim', true));
    window.addEventListener('pointerup', () => gesture('inputtrim', false));
    trimSlider.addEventListener('input', () => setTrimUI(parseFloat(trimSlider.value), false));
    trimSlider.addEventListener('dblclick', () => { gesture('inputtrim', true); setTrimUI(TRIM_DEFAULT, false); gesture('inputtrim', false); });
    trimSlider.addEventListener('keydown', (e) => e.stopPropagation());
  }

  // Función centralizada para aplicar el renderizado gráfico de la perilla
  function applyKnobUI(knob, val, fromNative = false, notifyNative = true) {
    knob.dataset.value = val;
    const param = knob.dataset.param;
    state.params[param] = val;

    if (!fromNative && notifyNative && param) {
      sendParamToNative(param, val);
    }

    // 1. Relleno dinámico del anillo LED desde la izquierda (0% / 225°) hacia la derecha (100% / 495°)
    const ring = knob.querySelector('.knob-outer-ring');
    const activeDeg = (val / 100) * 270;
    if (ring) {
      ring.style.background = `conic-gradient(from 225deg, var(--display-accent, var(--accent-color)) 0deg, var(--display-accent-2, var(--accent-color-2)) ${activeDeg}deg, rgba(255, 255, 255, 0.07) ${activeDeg}deg 270deg, transparent 270deg 360deg)`;
    }

    // 2. Rotación de la aguja indicadora (-135° a +135°)
    const indicator = knob.querySelector('.knob-indicator');
    const deg = (val / 100) * 270 - 135;
    if (indicator) {
      indicator.style.transform = `rotate(${deg}deg)`;
    }

    // 3. Actualizar Displays de Texto
    if (param === 'loudness') {
      const valNum = knob.querySelector('.val-num');
      if (valNum) valNum.textContent = val;
    } else {
      const valElem = document.getElementById(`val-${param}`);
      if (valElem) {
        valElem.textContent = `${val}%`;
      }
    }
  }

  // Animación Suave de Knobs
  let knobAnimFrame = null;
  function animateKnobsTo(targetParams) {
    if (knobAnimFrame) cancelAnimationFrame(knobAnimFrame);

    const startParams = { ...state.params };
    const startTime = performance.now();
    const duration = 400; // ms

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3); // Ease Out Cubic

      document.querySelectorAll('.knob-container').forEach(knob => {
        const param = knob.dataset.param;
        if (targetParams[param] !== undefined) {
          const startVal = startParams[param] ?? 50;
          const endVal = targetParams[param];
          const currentVal = Math.round(startVal + (endVal - startVal) * ease);
          applyKnobUI(knob, currentVal, false, false);
        }
      });

      if (progress < 1) {
        knobAnimFrame = requestAnimationFrame(step);
      } else {
        // En el frame final, asegurar los valores exactos en la UI
        document.querySelectorAll('.knob-container').forEach(knob => {
          const param = knob.dataset.param;
          if (targetParams[param] !== undefined) {
            applyKnobUI(knob, targetParams[param], false, false);
          }
        });
      }
    }

    knobAnimFrame = requestAnimationFrame(step);
  }

  const presetDropdown = document.getElementById('presetDropdown');
  const dropdownTrigger = document.getElementById('dropdownTrigger');
  const dropdownMenu = document.getElementById('dropdownMenu');
  const selectedPresetText = document.getElementById('selectedPresetText');
  // El selector guarda el nombre interno del preset (identidad, va al proyecto) y muestra su traducción
  function setPresetText(raw) {
    if (!selectedPresetText) return;
    selectedPresetText.dataset.raw = raw;
    selectedPresetText.textContent = I18N.preset(raw);
  }
  function presetRaw() {
    if (!selectedPresetText) return 'No Preset';
    return selectedPresetText.dataset.raw !== undefined ? selectedPresetText.dataset.raw : selectedPresetText.textContent;
  }
  setPresetText(presetRaw());
  const savePresetBtn = document.getElementById('savePresetBtn');
  const prevPresetBtn = document.getElementById('prevPresetBtn');
  const nextPresetBtn = document.getElementById('nextPresetBtn');
  const refTitle = document.getElementById('refTitle');

  // Función para seleccionar preset por índice
  function selectPresetByIndex(index) {
    const flatList = getActiveFlatList();
    if (index < 0) {
      currentPresetIndex = flatList.length - 1;
    } else if (index >= flatList.length) {
      currentPresetIndex = 0;
    } else {
      currentPresetIndex = index;
    }

    const itemObj = flatList[currentPresetIndex];
    if (!itemObj) return;

    setPresetText(itemObj.sub);
    currentPresetFull = itemObj.fullName;

    // El nombre del preset se guarda en el estado del proyecto DAW
    persistUi();

    // Marcar seleccionado en el dropdown
    document.querySelectorAll('.dropdown-item').forEach(el => {
      if (el.dataset.fullname === itemObj.fullName) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });

    // Obtener los 13 valores del preset y aplicarlos (los presets nunca tocan el Input Trim ni la referencia cargada)
    pushParamSet(getPresetValues(itemObj.fullName, itemObj));
  }

  // Renderizar Custom Dropdown Multinivel con Pestañas
  function renderPresetMenu() {
    dropdownMenu.innerHTML = '';

    // Pestañas (BEAT PRESETS / MASTER PRESETS)
    const tabsDiv = document.createElement('div');
    tabsDiv.className = 'dropdown-tabs';

    const beatTabBtn = document.createElement('button');
    beatTabBtn.className = `dropdown-tab-btn ${activeTab === 'beat' ? 'active' : ''}`;
    beatTabBtn.type = 'button';
    beatTabBtn.textContent = I18N.t('pm.beat');

    const targetTabBtn = document.createElement('button');
    targetTabBtn.className = `dropdown-tab-btn ${activeTab === 'target' ? 'active' : ''}`;
    targetTabBtn.type = 'button';
    targetTabBtn.textContent = I18N.t('pm.master');

    beatTabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeTab !== 'beat') {
        activeTab = 'beat';
        currentPresetIndex = 0;
        renderPresetMenu();
      }
    });

    targetTabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeTab !== 'target') {
        activeTab = 'target';
        currentPresetIndex = 0;
        renderPresetMenu();
      }
    });

    tabsDiv.appendChild(beatTabBtn);
    tabsDiv.appendChild(targetTabBtn);
    dropdownMenu.appendChild(tabsDiv);

    // Renderizado según pestaña activa
    const activeData = activeTab === 'beat' ? beatPresetData : referenceTargetData;
    const flatList = getActiveFlatList();

    if (activeTab === 'beat') {
      // Opción autónoma "No Preset"
      const noPresetDiv = document.createElement('div');
      noPresetDiv.className = 'dropdown-item no-preset-option';
      noPresetDiv.textContent = I18N.preset('No Preset');
      noPresetDiv.dataset.fullname = 'No Preset';

      if (currentPresetIndex === 0 && activeTab === 'beat') {
        noPresetDiv.classList.add('selected');
      }

      noPresetDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        selectPresetByIndex(0);
        closeDropdownPortal();
      });

      dropdownMenu.appendChild(noPresetDiv);
    }

    // Contenedor Acordeón en línea "My Presets" dentro del menú desplegable principal
    const currentUsers = userPresetsData[activeTab];
    const myPresetsWrapperDiv = document.createElement('div');
    myPresetsWrapperDiv.className = 'my-presets-wrapper';

    // Abrir automáticamente si hay presets de usuario o si el preset activo pertenece a usuario
    const isUserPresetActive = flatList[currentPresetIndex] && flatList[currentPresetIndex].isUser;
    if (isUserPresetActive || currentUsers.length > 0) {
      myPresetsWrapperDiv.classList.add('open');
    }

    myPresetsWrapperDiv.innerHTML = `
      <div class="my-presets-category">
        <div class="category-title-group">
          <svg class="user-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>${escapeHtml(I18N.t('pm.mine'))}</span>
          <span class="my-presets-count">(${currentUsers.length})</span>
        </div>
        <span class="accordion-chevron">&#9660;</span>
      </div>
      <div class="my-presets-inline-list"></div>
    `;

    // Conmutar apertura / cierre del acordeón al hacer clic en el encabezado
    const categoryHeader = myPresetsWrapperDiv.querySelector('.my-presets-category');
    categoryHeader.addEventListener('click', (e) => {
      e.stopPropagation();
      myPresetsWrapperDiv.classList.toggle('open');
    });

    const inlineListDiv = myPresetsWrapperDiv.querySelector('.my-presets-inline-list');

    if (currentUsers.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'dropdown-item empty-folder-item';
      emptyDiv.textContent = I18N.t('pm.empty');
      inlineListDiv.appendChild(emptyDiv);
    } else {
      currentUsers.forEach(uPreset => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'dropdown-item user-preset-item';
        itemDiv.innerHTML = `
          <div class="user-preset-name-group">
            <svg class="check-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>${escapeHtml(uPreset.sub)}</span>
          </div>
          <button class="delete-preset-btn" type="button" title="${escapeHtml(I18N.t('pm.delete'))}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        `;
        itemDiv.dataset.fullname = uPreset.fullName;

        if (flatList[currentPresetIndex] && flatList[currentPresetIndex].fullName === uPreset.fullName && flatList[currentPresetIndex].isUser) {
          itemDiv.classList.add('selected');
        }

        // Selección del preset al hacer clic
        itemDiv.addEventListener('click', (e) => {
          if (e.target.closest('.delete-preset-btn')) return;
          e.stopPropagation();
          const targetIdx = flatList.findIndex(p => p.fullName === uPreset.fullName && p.isUser);
          if (targetIdx !== -1) {
            selectPresetByIndex(targetIdx);
          }
          closeDropdownPortal();
        });

        // Eliminar preset al hacer clic en la papelera
        const deleteBtn = itemDiv.querySelector('.delete-preset-btn');
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const wasSelected = flatList[currentPresetIndex] && flatList[currentPresetIndex].fullName === uPreset.fullName && flatList[currentPresetIndex].isUser;

          // Remover de userPresetsData
          userPresetsData[activeTab] = userPresetsData[activeTab].filter(p => p !== uPreset);

          if (wasSelected) {
            selectPresetByIndex(0); // Reset a No Preset
          }

          renderPresetMenu();
          persistUi();
        });

        inlineListDiv.appendChild(itemDiv);
      });
    }

    dropdownMenu.appendChild(myPresetsWrapperDiv);

    if (activeTab === 'beat') {
      const defaultBeatDiv = document.createElement('div');
      defaultBeatDiv.className = 'dropdown-item init-patch-item';
      defaultBeatDiv.textContent = I18N.preset('Default Beat (Start Here)');
      defaultBeatDiv.dataset.fullname = 'Default Beat (Start Here)';

      if (flatList[currentPresetIndex] && flatList[currentPresetIndex].fullName === 'Default Beat (Start Here)') {
        defaultBeatDiv.classList.add('selected');
      }

      defaultBeatDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetIdx = flatList.findIndex(p => p.fullName === 'Default Beat (Start Here)');
        if (targetIdx !== -1) {
          selectPresetByIndex(targetIdx);
        }
        closeDropdownPortal();
      });

      dropdownMenu.appendChild(defaultBeatDiv);
    }

    if (Array.isArray(activeData)) {
      activeData.forEach(presetName => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'dropdown-item';
        if (presetName.includes('(Start Here)')) {
          itemDiv.classList.add('init-patch-item');
        }
        itemDiv.textContent = I18N.preset(presetName);
        const fullName = presetName;
        itemDiv.dataset.fullname = fullName;

        if (flatList[currentPresetIndex] && flatList[currentPresetIndex].fullName === fullName && !flatList[currentPresetIndex].isUser) {
          itemDiv.classList.add('selected');
        }

        itemDiv.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetIdx = flatList.findIndex(p => p.fullName === fullName && !p.isUser);
          if (targetIdx !== -1) {
            selectPresetByIndex(targetIdx);
          }
          closeDropdownPortal();
        });

        dropdownMenu.appendChild(itemDiv);
      });
    } else {
      Object.entries(activeData).forEach(([category, subPresets]) => {
        const catDiv = document.createElement('div');
        catDiv.className = 'dropdown-category';
        catDiv.innerHTML = `
          <span>${category}</span>
          <span class="category-chevron">&#9656;</span>
          <div class="dropdown-submenu"></div>
        `;

        const subMenuDiv = catDiv.querySelector('.dropdown-submenu');
        subPresets.forEach(presetName => {
          const itemDiv = document.createElement('div');
          itemDiv.className = 'dropdown-item';
          itemDiv.textContent = I18N.preset(presetName);
          const fullName = activeTab === 'beat' ? `${category} - ${presetName}` : presetName;
          itemDiv.dataset.fullname = fullName;

          if (flatList[currentPresetIndex] && flatList[currentPresetIndex].fullName === fullName && !flatList[currentPresetIndex].isUser) {
            itemDiv.classList.add('selected');
          }

          itemDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetIdx = flatList.findIndex(p => p.fullName === fullName && !p.isUser);
            if (targetIdx !== -1) {
              selectPresetByIndex(targetIdx);
            }
            closeDropdownPortal();
          });

          subMenuDiv.appendChild(itemDiv);
        });

        // Hover controlado por JS: abre el submenú y detecta si desborda la ventana del plugin
        let catCloseTimer = null;
        const openSub = () => {
          if (catCloseTimer) { clearTimeout(catCloseTimer); catCloseTimer = null; }
          // Cerrar cualquier otra categoría abierta
          dropdownMenu.querySelectorAll('.dropdown-category.sub-open').forEach(c => {
            if (c !== catDiv) c.classList.remove('sub-open');
          });
          catDiv.classList.add('sub-open');
          // Detectar desbordamiento: si el submenú sale del viewport, abrir a la izquierda
          requestAnimationFrame(() => {
            const subRect = subMenuDiv.getBoundingClientRect();
            const pluginRight = document.querySelector('.plugin-container')
              ? document.querySelector('.plugin-container').getBoundingClientRect().right
              : window.innerWidth;
            if (subRect.right > pluginRight) {
              subMenuDiv.classList.add('flip-left');
              catDiv.classList.add('bridge-left');
            } else {
              subMenuDiv.classList.remove('flip-left');
              catDiv.classList.remove('bridge-left');
            }
          });
        };
        const closeSub = () => {
          catCloseTimer = setTimeout(() => { catDiv.classList.remove('sub-open'); }, 120);
        };
        catDiv.addEventListener('mouseenter', openSub);
        catDiv.addEventListener('mouseleave', closeSub);
        // El submenú también cancela el cierre al entrar (cubre el cruce categoría→submenú)
        subMenuDiv.addEventListener('mouseenter', () => {
          if (catCloseTimer) { clearTimeout(catCloseTimer); catCloseTimer = null; }
        });
        subMenuDiv.addEventListener('mouseleave', closeSub);

        dropdownMenu.appendChild(catDiv);
      });
    }
  }

  renderPresetMenu();

  // Navegación Stepper: Flecha Izquierda (<)
  prevPresetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectPresetByIndex(currentPresetIndex - 1);
  });

  // Navegación Stepper: Flecha Derecha (>)
  nextPresetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectPresetByIndex(currentPresetIndex + 1);
  });

  // --- Portalización del dropdown: se mueve a <body> para escapar de overflow:hidden ---
  function openDropdownPortal() {
    const triggerRect = dropdownTrigger.getBoundingClientRect();
    // Centrar el menú debajo del trigger
    document.body.appendChild(dropdownMenu);
    dropdownMenu.classList.add('portal-open');
    presetDropdown.classList.add('open');
    // Posicionar: centrado horizontalmente con el trigger, debajo + 8px
    const menuWidth = dropdownMenu.offsetWidth;
    let left = triggerRect.left + triggerRect.width / 2 - menuWidth / 2;
    // Clampar a los bordes de la ventana del plugin (body = viewport en WebView2)
    left = Math.max(4, Math.min(left, window.innerWidth - menuWidth - 4));
    dropdownMenu.style.top = (triggerRect.bottom + 8) + 'px';
    dropdownMenu.style.left = left + 'px';
  }

  function closeDropdownPortal() {
    presetDropdown.classList.remove('open');
    dropdownMenu.classList.remove('portal-open');
    // Devolver al DOM original (dentro de .custom-dropdown)
    presetDropdown.appendChild(dropdownMenu);
    dropdownMenu.style.top = '';
    dropdownMenu.style.left = '';
  }

  // Toggle Dropdown (Al hacer clic en el texto central)
  dropdownTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (presetDropdown.classList.contains('open')) {
      closeDropdownPortal();
    } else {
      openDropdownPortal();
    }
  });

  // Cerrar al hacer clic fuera (el menú puede estar en body o en el dropdown)
  document.addEventListener('click', (e) => {
    if (!presetDropdown.contains(e.target) && !dropdownMenu.contains(e.target)) {
      closeDropdownPortal();
    }
  });

  // --- Lógica del Save User Preset Modal ---
  const savePresetModal = document.getElementById('savePresetModal');
  const closeSaveModalBtn = document.getElementById('closeSaveModalBtn');
  const cancelSaveModalBtn = document.getElementById('cancelSaveModalBtn');
  const confirmSaveModalBtn = document.getElementById('confirmSaveModalBtn');
  const presetNameInput = document.getElementById('presetNameInput');

  function openSaveModal() {
    if (!savePresetModal) return;
    savePresetModal.classList.add('open');
    if (presetNameInput) {
      presetNameInput.value = '';
      presetNameInput.classList.remove('error-shake');
      setTimeout(() => presetNameInput.focus(), 80);
    }
  }

  function closeSaveModal() {
    if (!savePresetModal) return;
    savePresetModal.classList.remove('open');
    if (presetNameInput) presetNameInput.classList.remove('error-shake');
  }

  function handleSaveUserPreset() {
    if (!presetNameInput) return;
    const name = presetNameInput.value.trim();
    if (!name) {
      presetNameInput.classList.add('error-shake');
      setTimeout(() => presetNameInput.classList.remove('error-shake'), 350);
      presetNameInput.focus();
      return;
    }

    // Capturar los 13 parámetros actuales del plugin (el Input Trim no forma parte de un preset)
    const currentParams = {};
    Object.keys(NEUTRAL_PARAMS).forEach((k) => { currentParams[k] = clamp01to100(state.params[k]); });

    // Crear nuevo objeto de preset de usuario
    const newPreset = {
      sub: name,
      fullName: name,
      isUser: true,
      params: currentParams
    };

    // Guardar en la pestaña activa (se persiste dentro del proyecto DAW)
    userPresetsData[activeTab].push(newPreset);
    persistUi();

    // Cerrar modal
    closeSaveModal();

    // Re-renderizar menú desplegable
    renderPresetMenu();

    // Buscar e identificar el nuevo preset en la lista plana
    const flatList = getActiveFlatList();
    const newIndex = flatList.findIndex(p => p.fullName === name && p.isUser);

    if (newIndex !== -1) {
      selectPresetByIndex(newIndex);
    } else {
      setPresetText(name);
    }
  }

  // Event Listeners del Modal
  if (savePresetBtn) {
    savePresetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSaveModal();
    });
  }

  if (closeSaveModalBtn) closeSaveModalBtn.addEventListener('click', closeSaveModal);
  if (cancelSaveModalBtn) cancelSaveModalBtn.addEventListener('click', closeSaveModal);
  if (confirmSaveModalBtn) confirmSaveModalBtn.addEventListener('click', handleSaveUserPreset);

  // Cerrar al hacer clic en el backdrop fuera de la tarjeta
  if (savePresetModal) {
    savePresetModal.addEventListener('click', (e) => {
      if (e.target === savePresetModal) {
        closeSaveModal();
      }
    });
  }

  // Enviar formulario con tecla Enter y cerrar con Escape
  if (presetNameInput) {
    presetNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveUserPreset();
      } else if (e.key === 'Escape') {
        closeSaveModal();
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && savePresetModal && savePresetModal.classList.contains('open')) {
      closeSaveModal();
    }
  });

  // 3-Way Toggle Modos Visualizador
  const axisOverlay = document.querySelector('.canvas-axis-overlay');
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.mode = e.target.dataset.mode;
      persistUi();

      if (axisOverlay) {
        axisOverlay.style.display = state.mode === 'spectrum' ? 'block' : 'none';
      }
    });
  });

  // --- Conmutación de Modo Global (BEAT MODE vs MASTER MODE) ---
  function setGlobalMode(newMode, silent = false) {
    if (state.globalMode === newMode) return;
    state.globalMode = newMode;
    if (!silent) persistUi();

    // Actualizar estados visuales de los botones del switch global
    document.querySelectorAll('.mode-switch-btn').forEach(btn => {
      if (btn.dataset.globalMode === newMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const macroRow = document.getElementById('macroRow');
    const advancedControlsRow = document.getElementById('advancedControlsRow');
    const dropZone = document.getElementById('dropZone');

    if (newMode === 'beat') {
      // 1. Ocultar Reference Match
      if (dropZone) dropZone.style.display = 'none';

      // 2. Cambiar pestaña del dropdown a BEAT MASTERS
      activeTab = 'beat';
      currentPresetIndex = 0;
      renderPresetMenu();

      // 3. Transición suave del panel inferior
      if (advancedControlsRow) {
        advancedControlsRow.style.opacity = '0';
        advancedControlsRow.style.transform = 'translateY(6px)';
        setTimeout(() => {
          advancedControlsRow.style.display = 'none';
          if (macroRow) {
            macroRow.style.display = 'grid';
            macroRow.style.opacity = '0';
            macroRow.style.transform = 'translateY(6px)';
            setTimeout(() => {
              macroRow.style.opacity = '1';
              macroRow.style.transform = 'translateY(0)';
            }, 20);
          }
        }, 180);
      }
    } else if (newMode === 'master') {
      // 1. Mostrar Reference Match
      if (dropZone) dropZone.style.display = 'flex';

      // 2. Cambiar pestaña del dropdown a REFERENCE TARGETS
      activeTab = 'target';
      currentPresetIndex = 0;
      renderPresetMenu();

      // 3. Transición suave del panel inferior
      if (macroRow) {
        macroRow.style.opacity = '0';
        macroRow.style.transform = 'translateY(6px)';
        setTimeout(() => {
          macroRow.style.display = 'none';
          if (advancedControlsRow) {
            advancedControlsRow.style.display = 'grid';
            advancedControlsRow.style.opacity = '0';
            advancedControlsRow.style.transform = 'translateY(6px)';
            setTimeout(() => {
              advancedControlsRow.style.opacity = '1';
              advancedControlsRow.style.transform = 'translateY(0)';
            }, 20);
          }
        }, 180);
      }
    }
  }

  // Event Listeners para los botones del Global Switch
  document.querySelectorAll('.mode-switch-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = e.currentTarget.dataset.globalMode;
      setGlobalMode(mode);
    });
  });

  // ===========================================================================
  // REFERENCE MATCH (análisis real en C++)
  //   1. Clic en la zona → selector nativo (solo WAV, AIFF, FLAC, MP3, OGG; máx. 300 MB; mín. 10 s).
  //   2. Modal de progreso (lectura → sonoridad LUFS → espectro → ajustes), cancelable.
  //   3. Modal de resultado: curva espectral de la referencia, LUFS, cresta, ancho y los 13 ajustes propuestos.
  //   4. "Aplicar" mueve los knobs (el usuario decide); la curva de la referencia se dibuja sobre el analizador.
  // ===========================================================================
  const dropZone = document.getElementById('dropZone');
  const refFileName = document.getElementById('refFileName');
  const removeRefBtn = document.getElementById('removeRefBtn');
  const dropIcon = document.getElementById('dropIcon');
  let isAnalyzing = false;
  let pendingRef = null;

  const REF_ERR_CODES = ['unsupported_format', 'too_large', 'too_short', 'silent', 'unreadable'];
  function refErr(code) {
    const c = REF_ERR_CODES.includes(code) ? code : 'unreadable';
    return [I18N.t('err.' + c), I18N.t('err.' + c + '.msg')];
  }

  function setReferenceDefaultState() {
    isAnalyzing = false;
    pendingRef = null;
    state.referenceTrackLoaded = false;
    state.refName = '';
    state.refCurve = null;
    dropZone.classList.remove('active-match', 'analyzing-lock');
    if (refTitle) refTitle.textContent = 'Reference Match';
    refFileName.textContent = 'WAV · MP3 · FLAC · OGG';
    refFileName.style.color = '';
    dropIcon.style.display = 'flex';
    removeRefBtn.style.display = 'none';
  }

  // Referencia cargada: el encabezado muestra el nombre y una X para quitarla
  function setReferenceLoadedState(name) {
    isAnalyzing = false;
    state.referenceTrackLoaded = true;
    state.refName = name;
    dropZone.classList.remove('analyzing-lock');
    dropZone.classList.add('active-match');
    if (refTitle) refTitle.textContent = I18N.t('ref.active');
    refFileName.textContent = name;
    refFileName.style.color = '';
    dropIcon.style.display = 'flex';
    removeRefBtn.style.display = 'flex';
  }

  // ---- Modal ----
  const refModal = document.getElementById('refModal');
  // ===========================================================================
  // ANIMACIÓN "PARAMETRANDO" (Reference Match)
  // 13 columnas, una por perilla de Omni: dos puntos luminosos unidos por un hilo que ondulan como una onda viajera;
  // cuando una columna se cierra, los puntos se funden en una cápsula. Al terminar el análisis cada columna se asienta
  // en el valor propuesto para su parámetro ("Parametrizando") y de ahí se pasa a los resultados.
  // ===========================================================================
  const REF_SHORT = { subweight: 'SUB', punch: 'PUN', warmth: 'WRM', harmonics: 'HRM', clarity: 'CLR', airshine: 'AIR',
    gluecomp: 'GLU', transients: 'TRN', stereowidth: 'WID', space: 'SPC', maximizer: 'MAX', loudness: 'LOU', ceiling: 'CEI' };

  const refLoader = (() => {
    const canvas = document.getElementById('refLoader');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const KEYS = (PRESETS && PRESETS.ORDER) || Object.keys(REF_SHORT);
    const N = KEYS.length;
    const h = new Array(N).fill(0.4);
    let raf = 0, mode = 'idle', energy = 0.3, labels = 0;
    let settleFrom = null, settleTo = null, settleT0 = 0, settleDone = null, settleFired = false;
    const SETTLE_MS = 1300, HOLD_MS = 650;

    const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const easeOutBack = (p) => { const c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };

    // Onda viajera (hacia la derecha) + una segunda más lenta: casi siempre hay un grupo de columnas cerrándose
    function wave(i, t) {
      const a = 0.5 + 0.5 * Math.sin(t * 3.1 - i * 0.58);
      const b = 0.5 + 0.5 * Math.sin(t * 1.9 + i * 1.07 + 1.3);
      return smooth(0.16, 0.84, 0.66 * a + 0.34 * b);
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (!W || !H) return;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const t = now / 1000;
      energy += ((mode === 'idle' ? 0.32 : 1) - energy) * 0.06;

      if (mode === 'settle') {
        const p = Math.min(1, (now - settleT0) / SETTLE_MS);
        const e = easeOutBack(p);
        for (let i = 0; i < N; i++) h[i] = settleFrom[i] + (settleTo[i] - settleFrom[i]) * e;
        labels = Math.min(1, labels + 0.06);
        if (!settleFired && now - settleT0 >= SETTLE_MS + HOLD_MS) {
          settleFired = true;
          if (settleDone) settleDone();
        }
      } else {
        for (let i = 0; i < N; i++) {
          const target = 0.06 + wave(i, t) * energy * 0.94 + (1 - energy) * 0.12;
          h[i] += (target - h[i]) * 0.2;
        }
        labels = Math.max(0, labels - 0.08);
      }

      const core = hexRgb(getActiveAccentColor());
      const tint = mixRgb([255, 255, 255], core, 0.18);      // casi blanco, con un toque del tema (como en el video)
      const pad = 22, cy = H * 0.44, maxHalf = H * 0.34, r = 3.1;
      ctx.shadowColor = rgba(core, 0.85);
      ctx.lineCap = 'round';
      for (let i = 0; i < N; i++) {
        const x = pad + (i * (W - pad * 2)) / (N - 1);
        const half = r * 0.55 + Math.max(0, h[i]) * (maxHalf - r);
        const merge = Math.max(0, Math.min(1, 1 - (half - r) / (r * 2.4)));   // 1 = cápsula (puntos fundidos)

        ctx.shadowBlur = 6 + merge * 8;
        ctx.strokeStyle = rgba(tint, 0.42 + 0.58 * merge);
        ctx.lineWidth = 1 + merge * (r * 2 - 1);
        ctx.beginPath(); ctx.moveTo(x, cy - half); ctx.lineTo(x, cy + half); ctx.stroke();

        ctx.shadowBlur = 10;
        ctx.fillStyle = rgba(tint, 1);
        ctx.beginPath(); ctx.arc(x, cy - half, r, 0, Math.PI * 2); ctx.arc(x, cy + half, r, 0, Math.PI * 2); ctx.fill();

        if (labels > 0.01) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = `rgba(245, 242, 237, ${0.55 * labels})`;
          ctx.font = '700 7.5px "Space Grotesk", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(REF_SHORT[KEYS[i]] || '', x, H - 6);
        }
      }
      ctx.shadowBlur = 0;
    }

    return {
      start(m) {
        mode = m || 'idle'; settleDone = null; settleFired = false;
        if (!raf) raf = requestAnimationFrame(frame);
      },
      setMode(m) { if (mode !== 'settle') mode = m; },
      // Asienta cada columna en el valor de su parámetro (0-100) y avisa al terminar (asentado + pausa)
      settle(params, done) {
        settleFrom = h.slice();
        settleTo = KEYS.map((k) => 0.05 + 0.95 * Math.max(0, Math.min(100, Number(params && params[k]) || 50)) / 100);
        settleT0 = performance.now(); settleDone = done; settleFired = false; mode = 'settle';
        if (!raf) raf = requestAnimationFrame(frame);
      },
      stop() { if (raf) cancelAnimationFrame(raf); raf = 0; settleDone = null; }
    };
  })();

  const REF_STEPS = ['read', 'lufs', 'peak', 'spec', 'param'];
  function setRefStep(active) {
    const idx = REF_STEPS.indexOf(active);
    document.querySelectorAll('#refSteps li').forEach((li) => {
      const i = REF_STEPS.indexOf(li.dataset.step);
      li.classList.toggle('done', idx >= 0 && i < idx);
      li.classList.toggle('active', i === idx);
    });
  }

  function openRefModal(view) {
    refModal.dataset.view = view;
    refModal.classList.add('open');
  }
  function closeRefModal() {
    refModal.classList.remove('open');
    if (refLoader) refLoader.stop();
    document.querySelector('.ref-view-analyzing')?.classList.remove('leaving');
  }

  function fmtDuration(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  // Etapas reales del motor (ReferenceMatchEngine): lectura 5-45 %, LUFS 45-60 %, true peak y ancho 62-66 %,
  // espectro 66-94 %. El 100 % llega con el resultado; "Ajustes" es la fase de asentado de la animación.
  function onRefProgress(d) {
    if (!d || !isAnalyzing) return;
    if (d.stage === 'start' && d.name) document.getElementById('refAnName').textContent = d.name;
    const pct = Math.max(0, Math.min(1, Number(d.pct) || 0));
    if (refLoader) refLoader.setMode('analyzing');
    document.getElementById('refAnBar').style.width = (pct * 95).toFixed(0) + '%';
    document.getElementById('refAnPct').textContent = (pct * 95).toFixed(0) + '%';
    const step = pct < 0.45 ? 'read' : pct < 0.61 ? 'lufs' : pct < 0.66 ? 'peak' : 'spec';
    setRefStep(step);
    document.getElementById('refAnStage').textContent = I18N.t('ref.stage.' + step);
  }
  onNative('refProgress', onRefProgress);

  const PARAM_KEYS = ['loudness', 'clarity', 'punch', 'space', 'warmth', 'subweight', 'airshine', 'gluecomp', 'transients', 'harmonics',
    'stereowidth', 'maximizer', 'ceiling'];
  const paramLabel = (k) => { const s = I18N.t('p.' + k); return s.charAt(0) + s.slice(1).toLowerCase(); };

  // Curva promedio de una canción (0..255 → dB relativos, -40…+20) dibujada en un canvas
  function drawRefChart(canvas, curve, reveal = 1, mixCurve = null) {
    reveal = Math.max(0, Math.min(1, Number(reveal) || 0));
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const accent = getActiveAccentColor();

    // Rejilla y rótulos (escala logarítmica)
    c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 1;
    c.fillStyle = 'rgba(245,242,237,0.45)'; c.font = '9px "Space Grotesk", monospace'; c.textAlign = 'center';
    [[100, '100'], [1000, '1k'], [10000, '10k']].forEach(([f, t]) => {
      const x = Math.log(f / 20) / Math.log(1000) * w;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h - 14); c.stroke();
      c.fillText(t, x, h - 3);
    });
    const pts = curve.map((v, i) => [i / (curve.length - 1) * w, (h - 16) - (v / 255) * (h - 24) - 4]);
    c.save();
    c.beginPath(); c.rect(0, 0, w * reveal, h); c.clip();
    c.beginPath(); c.moveTo(0, h - 14);
    pts.forEach((p) => c.lineTo(p[0], p[1]));
    c.lineTo(w, h - 14); c.closePath();
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, accent + '66'); g.addColorStop(1, accent + '08');
    c.fillStyle = g; c.fill();
    c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.strokeStyle = accent; c.lineWidth = 1.6; c.stroke();
    c.restore();
    // Tu mezcla (Reference Match v2): línea discontinua sobre la referencia, con leyenda
    if (mixCurve && mixCurve.length === curve.length) {
      c.save();
      c.beginPath();
      mixCurve.forEach((v, i) => {
        const x = i / (mixCurve.length - 1) * w, y = (h - 16) - (v / 255) * (h - 24) - 4;
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      });
      c.setLineDash([5, 4]); c.strokeStyle = 'rgba(245, 242, 237, 0.85)'; c.lineWidth = 1.3; c.stroke();
      c.setLineDash([]);
      c.font = '9px "Space Grotesk", monospace'; c.textAlign = 'right';
      c.fillStyle = accent; c.fillText('— REFERENCIA', w - 8, 13);
      c.fillStyle = 'rgba(245, 242, 237, 0.8)'; c.fillText('- - TU MEZCLA', w - 8, 25);
      c.restore();
    }
    // Punto de luz en el frente del trazo mientras se dibuja
    if (reveal < 1) {
      const idx = Math.min(pts.length - 1, Math.round(reveal * (pts.length - 1)));
      c.beginPath(); c.arc(pts[idx][0], pts[idx][1], 3, 0, Math.PI * 2);
      c.fillStyle = '#ffffff'; c.shadowColor = accent; c.shadowBlur = 10; c.fill(); c.shadowBlur = 0;
    }
  }

  // ===========================================================================
  // REFERENCE MATCH v2: escuchar tu mezcla → comparar → aplicar la DIFERENCIA (EQ de match + ancho + volumen)
  // ===========================================================================
  let refMatch = null;          // propuesta de la última escucha (C++: MatchEngine)
  const refCompare = document.getElementById('refCompare');
  const refListenBtn = document.getElementById('refListenBtn');
  const refAmount = document.getElementById('refAmount');

  function setCompareState(st, hint) {
    refCompare.dataset.state = st;
    if (hint) document.getElementById('refCmpHint').textContent = hint;
    refListenBtn.textContent = I18N.t(st === 'listening' ? 'cancel' : st === 'done' ? 'ref.listenAgain' : 'ref.listen');
    document.getElementById('refResApply').textContent = I18N.t(refMatch ? 'ref.applyMatch' : 'ref.applyEstimate');
  }

  function resetCompare() {
    refMatch = null;
    document.getElementById('refListenBar').style.width = '0%';
    setCompareState('idle', I18N.t('ref.hint'));
  }

  // Valores que deja "Aplicar match": tono neutro (lo corrige el EQ), ancho hacia la referencia, volumen por Auto Volumen
  function matchParamValues(res, m) {
    const values = Object.assign({}, NEUTRAL_PARAMS);
    Object.keys(values).forEach((k) => { if (res && res.params && res.params[k] !== undefined) values[k] = clamp01to100(res.params[k]); });
    ['subweight', 'warmth', 'clarity', 'airshine', 'space', 'loudness'].forEach((k) => { values[k] = 50; });
    values.stereowidth = clamp01to100(m.stereoWidth);
    values.maximizer = clamp01to100(state.params.maximizer);
    return values;
  }

  function showMatchResult(m) {
    refMatch = m;
    const f1 = (v) => Number(v).toFixed(1);
    document.getElementById('refCmpTone').textContent = f1(m.errorBefore) + ' → ' + f1(m.errorAfter) + ' dB';
    document.getElementById('refCmpLoud').textContent = f1(m.mixLoud) + ' → ' + f1(m.refLoud);
    document.getElementById('refCmpWidth').textContent = Math.round(m.mixWidth) + '% → ' + Math.round(m.refWidth) + '%';
    setCompareState('done', I18N.t('ref.matchDone'));
    // La lista de ajustes pasa a mostrar lo que hará el match
    const vals = matchParamValues(pendingRef, m);
    document.querySelectorAll('#refParams .ref-param').forEach((cell) => {
      const k = cell.dataset.k;
      const bar = cell.querySelector('.ref-param-bar i'), num = cell.querySelector('.ref-num'), mark = cell.querySelector('.ref-param-val small');
      if (k === 'maximizer') { if (num) num.textContent = 'auto'; if (mark) mark.textContent = ''; return; }
      const v = Math.round(vals[k]), cur = Math.round(state.params[k]);
      if (bar) { bar.style.transitionDelay = '0ms'; bar.style.width = v + '%'; }
      if (num) num.textContent = String(v);
      if (mark) mark.textContent = v === cur ? '' : (v > cur ? ' ▲' : ' ▼');
    });
    if (pendingRef) drawRefChart(document.getElementById('refChart'), pendingRef.curve, 1, m.mixCurve);
  }

  // Vista previa en navegador: simula la escucha para poder ver el flujo completo
  function simulateLearn() {
    let sec = 0;
    const iv = setInterval(() => {
      if (refCompare.dataset.state !== 'listening') { clearInterval(iv); return; }
      sec += 0.5;
      onNativeLearnProgress({ seconds: sec, target: 10 });
      if (sec >= 10) {
        clearInterval(iv);
        const base = pendingRef ? pendingRef.curve : Array.from({ length: 256 }, () => 160);
        onNativeLearnDone({ ok: true, mixCurve: base.map((v, i) => Math.max(0, Math.min(255, Math.round(v + 18 * Math.sin(i / 40) - (i - 128) * 0.08)))),
          errorBefore: 4.3, errorAfter: 1.4, mixLoud: -13.8, refLoud: pendingRef && pendingRef.loudLufs !== undefined ? pendingRef.loudLufs : -7.6,
          mixWidth: 17, refWidth: pendingRef ? pendingRef.widthPct : 33, stereoWidth: 64 });
      }
    }, 120);
  }

  function onNativeLearnProgress(d) {
    if (!d || refCompare.dataset.state !== 'listening') return;
    const p = Math.max(0, Math.min(1, (Number(d.seconds) || 0) / (Number(d.target) || 10)));
    document.getElementById('refListenBar').style.width = (p * 100).toFixed(0) + '%';
    document.getElementById('refCmpHint').textContent = I18N.t('ref.listening', { s: Math.floor(Number(d.seconds) || 0), t: Number(d.target) || 10 });
  }
  function onNativeLearnDone(d) {
    if (!d || refCompare.dataset.state !== 'listening') return;
    if (!d.ok) {
      refMatch = null;
      setCompareState('idle', I18N.t(d.code === 'noreference' ? 'ref.noReference' : 'ref.noAudio'));
      return;
    }
    showMatchResult(d);
  }
  onNative('learnProgress', onNativeLearnProgress);
  onNative('learnDone', onNativeLearnDone);

  refListenBtn.addEventListener('click', async () => {
    if (refCompare.dataset.state === 'listening') {
      native('cancelLearn');
      setCompareState(refMatch ? 'done' : 'idle', refMatch ? undefined : I18N.t('ref.hint'));
      return;
    }
    refMatch = null;
    document.getElementById('refListenBar').style.width = '0%';
    setCompareState('listening', I18N.t('ref.listening', { s: 0, t: 10 }));
    if (!IS_HOST) { simulateLearn(); return; }
    const r = await native('learnMix');
    if (!r || !r.ok) onNativeLearnDone({ ok: false, code: r && r.code });
  });

  refAmount.addEventListener('input', () => {
    document.getElementById('refAmountVal').textContent = refAmount.value + '%';
  });

  function showRefResult(res) {
    pendingRef = res;
    document.getElementById('refResName').textContent = res.name;
    const ch = I18N.t(res.channels > 1 ? 'ref.stereo' : 'ref.mono');
    document.getElementById('refResMeta').textContent = fmtDuration(res.duration) + ' · ' + (res.sampleRate / 1000).toFixed(1).replace(/\.0$/, '') + ' kHz · ' + ch;
    document.getElementById('refMLufs').textContent = res.lufs.toFixed(1);
    document.getElementById('refMCrest').textContent = res.crestDb.toFixed(1) + ' dB';
    document.getElementById('refMWidth').textContent = Math.round(res.widthPct) + '%';
    const b = res.bands || {};
    const sgn = (v) => (v > 0 ? '+' : '') + v.toFixed(1);
    document.getElementById('refMBal').textContent = I18N.t('ref.bal', { sub: sgn(b.sub || 0), air: sgn(b.air || 0) });

    const grid = document.getElementById('refParams');
    grid.innerHTML = '';
    const counters = [];
    PARAM_KEYS.forEach((k, i) => {
      const v = Math.round(res.params[k]);
      const cur = Math.round(state.params[k]);
      const cell = document.createElement('div');
      cell.className = 'ref-param';
      cell.dataset.k = k;
      cell.style.setProperty('--d', String(i + 4));
      cell.innerHTML = '<span class="ref-param-name">' + escapeHtml(paramLabel(k)) + '</span>' +
        '<span class="ref-param-bar"><i></i></span>' +
        '<span class="ref-param-val"><span class="ref-num">0</span><small>' + (v === cur ? '' : (v > cur ? ' ▲' : ' ▼')) + '</small></span>';
      grid.appendChild(cell);
      counters.push({ bar: cell.querySelector('.ref-param-bar i'), num: cell.querySelector('.ref-num'), v: v, delay: 160 + (i + 4) * 45 });
    });
    document.querySelectorAll('#refModal .ref-metric').forEach((m, i) => m.style.setProperty('--d', String(i)));
    resetCompare();
    openRefModal('result');

    // Las barras se llenan y los números cuentan hasta su valor, en cascada
    requestAnimationFrame(() => {
      counters.forEach((c) => {
        c.bar.style.transitionDelay = (reduceMotion ? 0 : c.delay) + 'ms';
        c.bar.style.width = c.v + '%';
      });
      const t0 = performance.now();
      const tick = (now) => {
        let running = false;
        counters.forEach((c) => {
          const p = reduceMotion ? 1 : Math.max(0, Math.min(1, (now - t0 - c.delay) / 750));
          c.num.textContent = String(Math.round(c.v * (1 - Math.pow(1 - p, 3))));
          if (p < 1) running = true;
        });
        if (running) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      drawRefChartAnimated(document.getElementById('refChart'), res.curve);
    });
  }

  // La curva de la referencia se dibuja de izquierda (graves) a derecha (agudos)
  function drawRefChartAnimated(canvas, curve) {
    if (reduceMotion) { drawRefChart(canvas, curve, 1); return; }
    const t0 = performance.now();
    const step = (now) => {
      // El sello de tiempo del primer fotograma puede ser anterior a t0: el progreso nunca baja de 0
      const p = Math.max(0, Math.min(1, (now - t0) / 850));
      drawRefChart(canvas, curve, 1 - Math.pow(1 - p, 3), refMatch ? refMatch.mixCurve : null);
      if (p < 1 && refModal.classList.contains('open')) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  let refRun = 0;   // cada análisis tiene su número: cancelar invalida las fases pendientes del anterior

  // Vista previa en navegador (sin DAW): simula las etapas del motor para poder ver la animación completa
  function simulatedReference() {
    return new Promise((resolve) => {
      let pct = 0;
      onRefProgress({ stage: 'start', name: 'referencia_ejemplo.wav', pct: 0 });
      const iv = setInterval(() => {
        if (!isAnalyzing) { clearInterval(iv); resolve({ code: 'cancelled' }); return; }
        pct += 0.03;
        onRefProgress({ stage: 'progress', pct: Math.min(0.97, pct) });
        if (pct >= 0.97) {
          clearInterval(iv);
          const curve = Array.from({ length: 256 }, (_, i) => Math.round(150 + 70 * Math.sin(i / 22) - i * 0.2));
          resolve({ ok: true, name: 'referencia_ejemplo.wav', duration: 204, sampleRate: 44100, channels: 2, lufs: -9.8, loudLufs: -7.6,
            crestDb: 10.6, widthPct: 38, bands: { sub: 8.4, warm: 3.1, pres: -9.6, air: -19.2 }, curve: curve,
            params: Object.assign({}, NEUTRAL_PARAMS, { maximizer: 74, loudness: 58, subweight: 72, punch: 64, airshine: 38, clarity: 44,
              gluecomp: 66, transients: 61, harmonics: 57, stereowidth: 47, space: 41, warmth: 55, ceiling: 95 }) });
        }
      }, 90);
    });
  }

  async function pickReference() {
    if (isAnalyzing) return;
    const run = ++refRun;

    isAnalyzing = true;
    document.getElementById('refAnTitle').textContent = I18N.t('ref.analyzing');
    document.getElementById('refAnName').textContent = I18N.t('ref.choose');
    document.getElementById('refAnBar').style.width = '0%';
    document.getElementById('refAnPct').textContent = '0%';
    document.getElementById('refAnStage').textContent = I18N.t('ref.waiting');
    setRefStep(null);
    openRefModal('analyzing');
    if (refLoader) refLoader.start('idle');

    const res = IS_HOST ? await native('pickReference', I18N.lang) : await simulatedReference();
    if (!isAnalyzing || run !== refRun) return;        // el usuario canceló mientras tanto

    if (!res || res.code === 'cancelled' || res.code === 'busy') { isAnalyzing = false; closeRefModal(); return; }
    if (!res.ok) {
      isAnalyzing = false;
      closeRefModal();
      const e = refErr(res.code);
      showAlert(e[0], e[1], '&#9888;&#65039;');
      return;
    }

    // Fase "Parametrizando": las columnas se asientan en los valores propuestos y después aparecen los resultados
    document.getElementById('refAnTitle').textContent = I18N.t('ref.parametrizing');
    document.getElementById('refAnStage').textContent = I18N.t('ref.stage.param');
    document.getElementById('refAnBar').style.width = '100%';
    document.getElementById('refAnPct').textContent = '100%';
    setRefStep('param');

    const reveal = () => {
      if (run !== refRun || !isAnalyzing) return;
      isAnalyzing = false;
      const card = document.querySelector('.ref-view-analyzing');
      card.classList.add('leaving');
      setTimeout(() => {
        if (run !== refRun) return;
        card.classList.remove('leaving');
        if (refLoader) refLoader.stop();
        showRefResult(res);
      }, reduceMotion ? 0 : 220);
    };
    if (refLoader && !reduceMotion) refLoader.settle(res.params, reveal); else reveal();
  }

  // ===========================================================================
  // AUTO VOLUMEN (estilo "Master Assistant"): con la parte más fuerte sonando, Omni escucha la salida y ajusta el
  // Maximizer hasta el objetivo del preset (o la sonoridad de la canción de referencia). Lo decide C++; aquí solo se
  // pide, se muestra el progreso y se explica el resultado.
  // ===========================================================================
  const autoLevelBtn = document.getElementById('autoLevelBtn');
  let autoLevelBusy = false;

  function autoLevelTarget() {
    if (currentPresetFull === 'Reference Match' && typeof state.refLoudLufs === 'number') return state.refLoudLufs;
    const t = PRESETS.targetLufs && PRESETS.targetLufs[currentPresetFull];
    return typeof t === 'number' ? t : PRESETS.defaultTargetLufs;
  }

  function setAutoLevelBusy(busy, progress) {
    autoLevelBusy = busy;
    if (!autoLevelBtn) return;
    autoLevelBtn.classList.toggle('busy', busy);
    autoLevelBtn.style.setProperty('--al-progress', String(Math.max(0, Math.min(1, progress || 0))));
  }

  if (autoLevelBtn) {
    autoLevelBtn.addEventListener('click', () => {
      if (!IS_HOST) {
        showAlert(I18N.t('al.title'), I18N.t('al.preview'), '&#127919;');
        return;
      }
      if (autoLevelBusy) { native('cancelAutoLevel'); setAutoLevelBusy(false); return; }
      const target = autoLevelTarget();
      autoLevelBtn.title = I18N.t('al.start', { t: target.toFixed(1) });
      setAutoLevelBusy(true, 0);
      native('autoLevel', target);
    });
  }

  onNative('autoLevel', (st) => {
    if (!st || !autoLevelBtn) return;
    const fmt = (v) => Number(v).toFixed(1);
    if (st.state === 'listening') {
      setAutoLevelBusy(true, st.progress);
      autoLevelBtn.title = I18N.t('al.progress', { m: fmt(st.measured), t: fmt(st.target) });
      return;
    }
    setAutoLevelBusy(false);
    autoLevelBtn.title = I18N.t('tip.autoLevel');
    if (st.state === 'done')
      showAlert(I18N.t('al.done'), I18N.t('al.done.msg', { m: fmt(st.measured), t: fmt(st.target) }), '&#127919;');
    else if (st.state === 'unreachable')
      showAlert(I18N.t('al.unreachable'), I18N.t(st.tooQuiet ? 'al.tooQuiet' : 'al.tooLoud'), '&#9888;&#65039;');
    else if (st.state === 'nosignal')
      showAlert(I18N.t('al.nosignal'), I18N.t('al.nosignal.msg'), '&#9888;&#65039;');
  });

  document.getElementById('refAnCancel').addEventListener('click', () => {
    native('cancelReference');
    isAnalyzing = false;
    refRun++;
    closeRefModal();
  });
  document.getElementById('refResCancel').addEventListener('click', () => {
    if (refCompare.dataset.state === 'listening') native('cancelLearn');
    pendingRef = null; refMatch = null; closeRefModal();
  });

  let stateBeforeRef = null; // Guardar el estado antes de aplicar el reference match

  document.getElementById('refResApply').addEventListener('click', () => {
    if (!pendingRef) return closeRefModal();
    const res = pendingRef;
    pendingRef = null;
    
    // Guardar estado actual
    stateBeforeRef = {
      params: Object.assign({}, state.params),
      presetText: presetRaw(),
      presetFull: currentPresetFull
    };

    const values = Object.assign({}, NEUTRAL_PARAMS);
    Object.keys(values).forEach((k) => { if (res.params[k] !== undefined) values[k] = clamp01to100(res.params[k]); });
    const match = refMatch;
    if (match) {
      // Match real: el tono lo corrige el EQ de match (perillas de tono neutras), el ancho se acerca al de la
      // referencia y el volumen lo ajusta el Auto Volumen al de la parte fuerte de la referencia.
      Object.assign(values, matchParamValues(res, match));
    } else {
      native('clearMatch');
    }
    pushParamSet(values);
    if (match) {
      native('applyMatch', Number(refAmount.value));
      state.refLoudLufs = typeof match.refLoud === 'number' ? match.refLoud : state.refLoudLufs;
    }
    state.refCurve = res.curve;
    state.refLoudLufs = typeof res.loudLufs === 'number' && isFinite(res.loudLufs) ? res.loudLufs : null;
    setReferenceLoadedState(res.name);
    setPresetText('Reference Match');
    currentPresetFull = 'Reference Match';
    closeRefModal();
    persistUi();
    refMatch = null;
    // Con match: el volumen se lleva al de la referencia mientras sigue sonando tu parte fuerte
    if (match && IS_HOST && typeof state.refLoudLufs === 'number' && autoLevelBtn) autoLevelBtn.click();
  });
  refModal.addEventListener('click', (e) => {
    if (e.target === refModal && refModal.dataset.view === 'result') { pendingRef = null; closeRefModal(); }
  });

  // Soltar archivos sobre la ventana no hace nada (WebView2 no expone la ruta real del archivo): se usa el selector nativo.
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((ev) => window.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); }, false));

  dropZone.addEventListener('click', (e) => {
    if (e.target.closest('#removeRefBtn')) return;
    if (!state.referenceTrackLoaded && !isAnalyzing) pickReference();
    else if (state.referenceTrackLoaded && !isAnalyzing) pickReference();     // cambiar de referencia
  });
  removeRefBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setReferenceDefaultState();
    native('clearMatch');
    
    // Restaurar parámetros y preset si existe un estado guardado
    if (stateBeforeRef) {
      pushParamSet(stateBeforeRef.params);
      setPresetText(stateBeforeRef.presetText);
      currentPresetFull = stateBeforeRef.presetFull;
      stateBeforeRef = null;
    } else {
      // Por si acaso, volver a Neutral
      pushParamSet(NEUTRAL_PARAMS);
      setPresetText('Init');
      currentPresetFull = 'Init';
    }
    
    persistUi();
  });

  // Drag Interactivo de Knobs + Reseteo con Doble Clic (Reset to Default)
  document.querySelectorAll('.knob-container').forEach(knob => {
    let isDragging = false;
    let startY = 0;
    let startVal = 0;

    // Guardar valor inicial por defecto (Default Value)
    const defaultValue = parseInt(knob.dataset.value);

    // Función auxiliar para actualizar la representación gráfica y los displays
    function updateKnobUI(val) {
      applyKnobUI(knob, val);
    }

    // Evento de Doble Clic para resetear a posición inicial
    knob.addEventListener('dblclick', (e) => {
      e.preventDefault();
      gesture(knob.dataset.param, true);
      updateKnobUI(defaultValue);
      gesture(knob.dataset.param, false);
    });

    // Posición gráfica inicial SOLO visual: NUNCA se envía al procesador (antes se enviaban los 13 valores por defecto en
    // cada apertura y se pisaba el estado guardado). El valor real llega del procesador en uiReady.
    applyKnobUI(knob, defaultValue, true);

    knob.addEventListener('pointerdown', (e) => {
      isDragging = true;
      startY = e.clientY;
      startVal = parseInt(knob.dataset.value);
      document.body.style.cursor = 'ns-resize';
      knob.setPointerCapture(e.pointerId);
      gesture(knob.dataset.param, true);
    });

    knob.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const param = knob.dataset.param;
      // Sensibilidad ajustada: Loudness gira más despacio y con mayor precisión (factor 0.35)
      const sensitivity = (param === 'loudness') ? 0.35 : 0.45;
      const multiplier = e.shiftKey ? 0.2 : 1.0;
      const deltaY = (startY - e.clientY) * sensitivity * multiplier;
      let newVal = Math.min(100, Math.max(0, Math.round(startVal + deltaY)));
      updateKnobUI(newVal);
    });

    knob.addEventListener('pointerup', (e) => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'default';
        knob.releasePointerCapture(e.pointerId);
        gesture(knob.dataset.param, false);
      }
    });

    knob.addEventListener('pointercancel', (e) => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'default';
        knob.releasePointerCapture(e.pointerId);
        gesture(knob.dataset.param, false);
      }
    });

    // Control por Rueda del Ratón (Mouse Wheel): Rueda arriba = Subir, Rueda abajo = Bajar
    const interactiveTarget = knob.closest('.macro-card, .main-knob-card, .compact-card') || knob;
    let wheelGestureTimer = null;
    interactiveTarget.addEventListener('wheel', (e) => {
      e.preventDefault();
      const currentVal = parseInt(knob.dataset.value) || 0;
      const step = e.shiftKey ? 1 : 3; // Shift presionado = precisión fina (+/- 1), normal = (+/- 3)
      const direction = e.deltaY < 0 ? 1 : -1;
      let newVal = Math.min(100, Math.max(0, currentVal + (direction * step)));
      if (!wheelGestureTimer) gesture(knob.dataset.param, true);
      clearTimeout(wheelGestureTimer);
      wheelGestureTimer = setTimeout(() => { wheelGestureTimer = null; gesture(knob.dataset.param, false); }, 350);
      updateKnobUI(newVal);
    }, { passive: false });
  });

  // --- Dynamic Skin / Theme Customization Logic ---
  const themeSettingsBtn = document.getElementById('themeSettingsBtn');
  const themePopover = document.getElementById('themePopover');
  const chassisBtns = document.querySelectorAll('.chassis-btn');
  const ledBtns = document.querySelectorAll('.led-color-btn');

  state.theme = {
    chassis: 'dark',
    led: 'purple'
  };

  function applyTheme(chassis, led, persist = true) {
    // Solo valores conocidos (el estado guardado viene de fuera y no es de fiar)
    if (!['dark', 'silver', 'glass'].includes(chassis)) chassis = 'dark';
    if (!document.querySelector(`.led-color-btn[data-led="${led}"]`)) led = 'purple';
    state.theme.chassis = chassis;
    state.theme.led = led;

    // Guardar en el estado del proyecto DAW (nunca durante el arranque, para no pisar lo guardado)
    if (persist) persistUi();
    // Último tema usado: solo sirve para que el plugin abra ya con ese color mientras llega el estado del DAW
    try { localStorage.setItem('omni.lastTheme', chassis + '|' + led); } catch (e) { /* almacenamiento no disponible */ }

    // Remove all previous theme- classes from body
    Array.from(document.body.classList).forEach(cls => {
      if (cls.startsWith('theme-')) {
        document.body.classList.remove(cls);
      }
    });
    
    // Apply selected chassis class & LED class
    document.body.classList.add(`theme-${chassis}`);
    document.body.classList.add(`theme-${led}`);

    // Update popover button states
    chassisBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.chassis === chassis);
    });

    ledBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.led === led);
    });

    // Re-apply knob UI gradients to update CSS variables on outer ring
    document.querySelectorAll('.knob-container').forEach(knob => {
      const val = parseInt(knob.dataset.value) || 50;
      applyKnobUI(knob, val, false, false);
    });
  }

  // Toggle Theme Popover
  if (themeSettingsBtn && themePopover) {
    themeSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      themePopover.classList.toggle('open');
      themeSettingsBtn.classList.toggle('active', themePopover.classList.contains('open'));
    });

    document.addEventListener('click', (e) => {
      if (!themePopover.contains(e.target) && !themeSettingsBtn.contains(e.target)) {
        themePopover.classList.remove('open');
        themeSettingsBtn.classList.remove('active');
      }
    });
  }

  // Chassis selection listeners
  chassisBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      applyTheme(e.currentTarget.dataset.chassis, state.theme.led);
    });
  });

  // LED color selection listeners
  ledBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      applyTheme(state.theme.chassis, e.currentTarget.dataset.led);
    });
  });

  // Tema por defecto (solo visual: el tema guardado llega del procesador en uiReady)
  // Arranque: el último tema usado (si existe) evita el parpadeo morado → color guardado; el estado del proyecto
  // (uiReady) manda después.
  (function initialTheme() {
    let chassis = 'dark', led = 'purple';
    try {
      const saved = (localStorage.getItem('omni.lastTheme') || '').split('|');
      if (saved.length === 2) { chassis = saved[0]; led = saved[1]; }
    } catch (e) { /* almacenamiento no disponible */ }
    applyTheme(chassis, led, false);
  })();

  // Idioma (ES / EN): preferencia del usuario para todas las instancias. Lo estático lo traduce i18n.js; aquí se
  // repinta lo que genera este archivo.
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      I18N.setLang(btn.dataset.lang);
      if (IS_HOST) native('setLanguage', btn.dataset.lang);   // común a todos los DAW (registro de Windows)
    });
  });
  I18N.onChange(() => {
    setPresetText(presetRaw());
    renderPresetMenu();
    if (refTitle) refTitle.textContent = state.referenceTrackLoaded ? I18N.t('ref.active') : 'Reference Match';
    if (!autoLevelBusy && autoLevelBtn) autoLevelBtn.title = I18N.t('tip.autoLevel');
    if (refCompare.dataset.state !== 'listening') setCompareState(refCompare.dataset.state, refMatch ? I18N.t('ref.matchDone') : I18N.t('ref.hint'));
    document.querySelectorAll('#refParams .ref-param').forEach((cell) => {
      const n = cell.querySelector('.ref-param-name'); if (n) n.textContent = paramLabel(cell.dataset.k);
    });
    updateBadge();
    updateLicenseInfo();
    if (!L.isValid) renderLicense();
  });

  // Arrancar Render Loop
  renderVisualizer();

  // ===========================================================================
  // LICENCIA (misma lógica y mismos estados que Easy Mix / Easy Pitch)
  //   El C++ (LicenseManager) es la ÚNICA autoridad: aquí solo se muestra el estado y se envían acciones.
  //   Sin licencia el audio pasa limpio (bypass) y esta capa bloquea la interfaz; con licencia FULL no aparece nada.
  //   Insignia: solo para pruebas con fecha de fin (3 → 2 → 1 días → bloqueo por expiración).
  // ===========================================================================
  const T_LOCK = {
    expired:  { icon: '&#128274;' },
    revoked:  { icon: '&#128274;' },
    tampered: { icon: '&#128737;&#65039;' },
    clock:    { icon: '&#128339;', retry: true }
  };
  const T_ERR = ['offline', 'bad_format', 'bad_signature', 'server_error', 'bad_response', 'expired', 'revoked', 'not_found',
    'device_limit', 'trial_used', 'wrong_product'];
  function errText(res) {
    if (!res) return I18N.t('lerr.not_found');
    if (res.code && T_ERR.includes(res.code)) return I18N.t('lerr.' + res.code);
    return res.message || I18N.t('lerr.not_found');
  }

  let L = { isValid: true, kind: 'full', code: 'full', daysLeft: 0, secondsLeft: 0, serial: '', message: '', lastCheck: 0 };  // hasta el primer estado real
  const META = { hwid: '', version: '' };
  let welcomeShown = false, lastValid = null;
  const $id = (id) => document.getElementById(id);

  function updateBadge() {
    const b = $id('trial-badge'), show = L.isValid && L.kind === 'trial';
    b.classList.toggle('visible', show);
    if (!show) return;
    const d = L.daysLeft, sec = L.secondsLeft;
    let txt;
    if (d > 1) txt = I18N.t('days', { n: d }); else if (d === 1) txt = I18N.t('day'); else if (sec > 3600) txt = Math.ceil(sec / 3600) + 'h'; else txt = I18N.t('lastDay');
    $id('trial-time-left').textContent = txt;
  }

  function openActivation(cancellable) {
    const act = $id('activation-modal');
    act.dataset.forced = cancellable ? '0' : '1';
    $id('btn-close-activation').classList.toggle('hide', !cancellable);
    act.classList.add('open');
  }
  function showAlert(title, msg, icon) {
    $id('alert-icon').innerHTML = icon || '&#10060;';
    $id('alert-title').textContent = title;
    $id('alert-msg').textContent = msg;
    $id('alert-modal').classList.add('open');
  }

  function updateLicenseInfo() {
    const set = (id, v) => { const el = $id(id); if (el) el.textContent = v; };
    set('setLic', !L.isValid ? I18N.t('lic.none') : L.kind === 'full' ? 'FULL' : L.kind === 'trial'
      ? I18N.t('lic.trial', { d: L.daysLeft === 1 ? I18N.t('day') : I18N.t('days', { n: L.daysLeft }) }) : I18N.t('lic.sub'));
    set('setSerial', L.serial || '—');
    set('setVersion', 'Omni Plugin ' + (META.version || ''));
    set('setHwid', META.hwid || '—');
  }

  function renderLicense() {
    updateBadge();
    updateLicenseInfo();
    const act = $id('activation-modal'), lock = $id('license-expired-overlay');
    if (L.isValid) {
      lock.classList.remove('active');
      if (act.dataset.forced === '1') { act.classList.remove('open'); act.dataset.forced = '0'; }
      if (lastValid === false && !welcomeShown) { welcomeShown = true; $id('welcome-modal').classList.add('open'); }
      lastValid = true;
      return;
    }
    lastValid = false;
    themePopover && themePopover.classList.remove('open');
    if (L.code === 'none') {              // primera vez: modal de activación sin cerrar
      lock.classList.remove('active');
      openActivation(false);
    } else {                              // expirada / revocada / alterada / reloj: bloqueo duro
      act.classList.remove('open'); act.dataset.forced = '0';
      const code = T_LOCK[L.code] ? L.code : 'expired', c = T_LOCK[code];
      $id('exp-icon').innerHTML = c.icon; $id('exp-title').textContent = I18N.t('lock.' + code); $id('exp-subtitle').textContent = I18N.t('lock.' + code + '.msg');
      $id('exp-serial-input').classList.toggle('hide', !!c.retry); $id('exp-submit-btn').classList.toggle('hide', !!c.retry);
      $id('exp-retry-btn').classList.toggle('hide', !c.retry);
      lock.classList.add('active');
    }
  }

  function refreshLicense(cb) {
    native('getLicenseState').then((l) => { if (l) { L = l; renderLicense(); } if (cb) cb(); });
  }
  function applyLicenseFromNative(l) { if (l) { L = l; renderLicense(); } }
  onNative('license', applyLicenseFromNative);

  function buy() { native('openURL', 'https://offszn.lat/plugins/all.html'); }

  function submitSerial(input, btn, idleText) {
    const serial = input.value.trim();
    if (!serial) { showAlert(I18N.t('lerr.empty.title'), I18N.t('lerr.empty'), '&#128273;'); return; }
    btn.disabled = true; btn.textContent = I18N.t('act.verifying');
    native('activateLicense', serial).then((res) => {
      btn.disabled = false; btn.textContent = I18N.t(idleText);
      if (res && res.success) {
        input.value = '';
        $id('activation-modal').classList.remove('open'); $id('license-expired-overlay').classList.remove('active');
        welcomeShown = true; $id('welcome-modal').classList.add('open');
        refreshLicense();
      } else {
        input.style.borderColor = 'var(--em-red)'; setTimeout(() => { input.style.borderColor = ''; }, 2000);
        const offline = res && res.code === 'offline';
        showAlert(I18N.t(offline ? 'lerr.conn' : 'lerr.act'), errText(res), '&#10060;');
      }
    });
  }

  $id('alert-ok').addEventListener('click', () => $id('alert-modal').classList.remove('open'));
  $id('btn-welcome').addEventListener('click', () => $id('welcome-modal').classList.remove('open'));
  $id('btn-close-activation').addEventListener('click', () => $id('activation-modal').classList.remove('open'));
  $id('trial-badge').addEventListener('click', () => openActivation(true));
  $id('btnSetLicense').addEventListener('click', () => { themePopover && themePopover.classList.remove('open'); openActivation(true); });
  $id('act-link-btn').addEventListener('click', buy);
  $id('exp-link-btn').addEventListener('click', buy);
  $id('act-submit-btn').addEventListener('click', function () { submitSerial($id('serial-input'), this, 'act.btn'); });
  $id('exp-submit-btn').addEventListener('click', function () { submitSerial($id('exp-serial-input'), this, 'exp.btn'); });
  $id('exp-retry-btn').addEventListener('click', () => { native('refreshLicense'); setTimeout(refreshLicense, 500); });
  [$id('serial-input'), $id('exp-serial-input')].forEach((i) => {
    i.addEventListener('input', () => { i.value = i.value.toUpperCase(); });
    i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') (i.id === 'serial-input' ? $id('act-submit-btn') : $id('exp-submit-btn')).click(); });
    i.addEventListener('keyup', (e) => e.stopPropagation());
  });
  setInterval(() => refreshLicense(), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshLicense(); });

  // ===========================================================================
  // ARRANQUE: el procesador es la ÚNICA fuente de verdad del estado.
  // uiReady devuelve los parámetros reales + el estado de interfaz guardado; la UI se limita a mostrarlos.
  // Un handshake (petición/respuesta) reemplaza los reintentos a ciegas del diseño anterior.
  // ===========================================================================
  // Ganchos de diagnóstico para las pruebas E2E (tools/e2e_*.mjs): permiten forzar telemetría, estados de licencia y el
  // resultado de una referencia SIN audio real ni servidor. Son de solo lectura/visualización: no tocan el procesador.
  window.__OMNI_DEBUG__ = {
    telemetry: onTelemetry,
    license: applyLicenseFromNative,
    refResult: showRefResult,
    refAnalyzing: (name, pct) => { isAnalyzing = true; document.getElementById('refAnName').textContent = name; document.getElementById('refAnBar').style.width = (pct * 100) + '%'; document.getElementById('refAnPct').textContent = Math.round(pct * 100) + '%'; openRefModal('analyzing'); },
    setRefCurve: (name, curve) => { state.refCurve = curve; setReferenceLoadedState(name); },
    state: () => JSON.parse(JSON.stringify({ params: state.params, mode: state.globalMode, vis: state.mode, ref: state.refName })),
    selectPreset: (i) => selectPresetByIndex(i)
  };

  setTrimUI(TRIM_DEFAULT, true);
  if (IS_HOST) {
    native('uiReady').then((boot) => {
      if (boot) {
        META.hwid = boot.hwid || '';
        META.version = boot.version || '';
        if (boot.lang === 'es' || boot.lang === 'en') I18N.setLang(boot.lang);   // elegido en Omni o en el instalador
        applyParamsFromNative(boot.params);
        applyUiState(boot.ui);
        applyLicenseFromNative(boot.license);
      }
      _uiReady = true;
    });
  } else {
    _uiReady = true;   // vista previa en navegador (sin DAW)
  }
});
