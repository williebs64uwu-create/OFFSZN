/**
 * OFFSZN UI Library • Error State Shake (.t-*)
 * Control de microinteracción de error con auto-revert y auto-clear al tipear.
 */

/**
 * Dispara la animación de error y sacudida en un contenedor .t-input-wrap.
 * @param {HTMLElement|string} target - El elemento contenedor o selector CSS
 * @param {string} [customMessage] - Mensaje de error a mostrar (opcional)
 */
export function triggerInputShake(target, customMessage) {
  const wrap = typeof target === 'string' ? document.querySelector(target) : target;
  if (!wrap) return;

  const input = wrap.querySelector('.t-input');
  const msgEl = wrap.querySelector('.t-error-msg');
  if (customMessage && msgEl) msgEl.textContent = customMessage;

  // Activa las clases de error
  wrap.classList.add('is-error');
  if (input) {
    input.classList.add('is-error');

    // Reinicia la animación forzando un reflow
    input.classList.remove('is-shaking');
    void input.offsetWidth;
    input.classList.add('is-shaking');

    // Remover la clase is-shaking al terminar (280ms)
    window.setTimeout(() => {
      input.classList.remove('is-shaking');
    }, 300);
  }

  // Cancelar temporizador anterior si existía
  if (wrap._revertTimer) {
    window.clearTimeout(wrap._revertTimer);
  }

  // Auto-revert tras 3 segundos
  wrap._revertTimer = window.setTimeout(() => {
    wrap._revertTimer = null;
    wrap.classList.remove('is-error');
    if (input) input.classList.remove('is-error');
  }, 3300);
}

/**
 * Limpia el estado de error de un input.
 * @param {HTMLElement|string} target
 */
export function clearInputError(target) {
  const wrap = typeof target === 'string' ? document.querySelector(target) : target;
  if (!wrap) return;

  if (wrap._revertTimer) {
    window.clearTimeout(wrap._revertTimer);
    wrap._revertTimer = null;
  }
  wrap.classList.remove('is-error');
  const input = wrap.querySelector('.t-input');
  if (input) {
    input.classList.remove('is-error');
    input.classList.remove('is-shaking');
  }
}

/**
 * Inicializa automáticamente todos los inputs con la clase .t-input-wrap
 * para que limpien el error inmediatamente cuando el usuario empieza a escribir.
 */
export function initInputShakeAutoClear() {
  document.querySelectorAll('.t-input-wrap').forEach((wrap) => {
    const inputEl = wrap.querySelector('.t-input-el');
    if (!inputEl) return;

    inputEl.addEventListener('input', () => {
      clearInputError(wrap);
    });
  });
}

// Auto-inicializar si está en el DOM
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInputShakeAutoClear);
  } else {
    initInputShakeAutoClear();
  }
}
