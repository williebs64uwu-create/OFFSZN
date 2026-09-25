/**
 * OFFSZN UI Library • Success Check (.t-success-check)
 * Transición de aparición con fade, rotación, desenfoque óptico, rebote vertical y trazado SVG.
 * Docs: https://transitions.dev/detail.html?t=success-check
 */

/**
 * Calcula la longitud del trazo de los elementos SVG y ajusta los dash tokens.
 * @param {HTMLElement} checkEl
 */
export function setupPathLength(checkEl) {
  if (!checkEl) return;
  const paths = checkEl.querySelectorAll('svg path, svg polyline');
  paths.forEach((p) => {
    try {
      if (typeof p.getTotalLength === 'function') {
        const len = Math.ceil(p.getTotalLength());
        if (len > 0) {
          p.style.setProperty('--check-path-length', len);
          p.style.strokeDasharray = len;
          p.style.strokeDashoffset = len;
        }
      }
    } catch (e) {
      // Fallback a valor por defecto
    }
  });
}

/**
 * Dispara la animación de éxito del checkmark.
 * @param {HTMLElement|string} target - Elemento .t-success-check o selector CSS
 */
export function playSuccessCheck(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;

  // Medir trazos de SVG
  setupPathLength(el);

  // Reiniciar estado con reflow
  el.setAttribute('data-state', 'out');
  void el.offsetWidth;
  el.setAttribute('data-state', 'in');

  // Disparar evento personalizado
  el.dispatchEvent(new CustomEvent('success-check-played', {
    bubbles: true
  }));
}

/**
 * Oculta el checkmark restableciendo su estado inicial.
 * @param {HTMLElement|string} target
 */
export function resetSuccessCheck(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  el.setAttribute('data-state', 'out');
}

/**
 * Inicializa automáticamente los elementos .t-success-check en el DOM.
 */
export function initSuccessChecks() {
  document.querySelectorAll('.t-success-check').forEach((el) => {
    setupPathLength(el);
  });
}

// Auto-inicializar si el DOM está disponible
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSuccessChecks);
  } else {
    initSuccessChecks();
  }
}
