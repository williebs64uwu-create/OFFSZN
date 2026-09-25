/**
 * OFFSZN UI Library • Like Button (.t-like)
 * Microinteracción de Like con corazón spring-pop y dispersión orgánica de 8 partículas.
 * Docs: https://transitions.dev/detail.html?t=like-button
 */

const DEFAULT_DIST = 20; // px - coincide con --like-particle-dist

/**
 * Calcula y asigna los vectores y tiempos aleatorios para las 8 partículas del botón.
 * @param {HTMLElement} buttonEl
 */
export function seedLikeParticles(buttonEl) {
  const dots = buttonEl.querySelectorAll('.t-like-particles i');
  if (!dots.length) return;

  const computed = window.getComputedStyle(buttonEl);
  const rawDist = parseFloat(computed.getPropertyValue('--like-particle-dist'));
  const dist = Number.isFinite(rawDist) ? rawDist : DEFAULT_DIST;

  dots.forEach((dot, i) => {
    // Ángulo distribuido equitativamente con variación aleatoria
    const angle = (360 / dots.length) * i + (Math.random() * 2 - 1) * 16;
    const mag = dist * (0.68 + Math.random() * 0.5);
    const rad = (angle * Math.PI) / 180;
    const s = dot.style;

    s.setProperty('--px', `${(Math.cos(rad) * mag).toFixed(2)}px`);
    s.setProperty('--py', `${(Math.sin(rad) * mag).toFixed(2)}px`);
    s.setProperty('--pdur', `calc(var(--like-particle-dur, 600ms) * ${(0.78 + Math.random() * 0.44).toFixed(3)})`);
    s.setProperty('--pdelay', `${Math.round(Math.random() * 70)}ms`);
    s.setProperty('--p-end-scale', (0.35 + Math.random() * 0.4).toFixed(2));
    s.setProperty('--psize', (0.6 + Math.random() * 0.8).toFixed(2));
  });
}

/**
 * Alterna el estado de like en un botón .t-like.
 * @param {HTMLElement} buttonEl
 * @param {boolean} [forceState] - Opcionalmente forzar true o false
 * @returns {boolean} Nuevo estado de like
 */
export function toggleLike(buttonEl, forceState) {
  if (!buttonEl) return false;

  const current = buttonEl.getAttribute('data-liked') === 'true';
  const next = typeof forceState === 'boolean' ? forceState : !current;

  if (!next) {
    // Unliked state
    buttonEl.setAttribute('data-liked', 'false');
    buttonEl.setAttribute('aria-pressed', 'false');
    buttonEl.classList.remove('is-bursting');
    return false;
  }

  // Liked state
  buttonEl.setAttribute('data-liked', 'true');
  buttonEl.setAttribute('aria-pressed', 'true');
  buttonEl.classList.remove('is-bursting');

  // Calcular vectores orgánicos para las partículas
  seedLikeParticles(buttonEl);

  // Forzar reflow para reiniciar la animación de explosión
  void buttonEl.offsetWidth;
  buttonEl.classList.add('is-bursting');

  // Limpiar temporizador previo si existía
  if (buttonEl._burstTimer) window.clearTimeout(buttonEl._burstTimer);
  buttonEl._burstTimer = window.setTimeout(() => {
    buttonEl.classList.remove('is-bursting');
  }, 750);

  return true;
}

/**
 * Inicializa automáticamente todos los botones con la clase .t-like en el DOM.
 */
export function initLikeButtons() {
  document.querySelectorAll('.t-like').forEach((btn) => {
    // Evitar registrar múltiples listeners
    if (btn._likeInitialized) return;
    btn._likeInitialized = true;

    btn.addEventListener('click', () => {
      toggleLike(btn);
    });
  });
}

// Auto-inicializar al cargar el DOM
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLikeButtons);
  } else {
    initLikeButtons();
  }
}
