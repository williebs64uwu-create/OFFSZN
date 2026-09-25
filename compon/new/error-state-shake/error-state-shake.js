/**
 * OFFSZN UI Library • Error State Shake (.t-*)
 * Control de microinteracción de error con auto-revert y auto-clear al tipear.
 * Docs: https://transitions.dev/detail.html?t=error-state-shake
 */

/**
 * Dispara la animación de error y sacudida en un contenedor .t-input-wrap o input directo.
 * @param {HTMLElement|string} target - El elemento contenedor o selector CSS
 * @param {string} [customMessage] - Mensaje de error a mostrar (opcional)
 */
export function triggerInputShake(target, customMessage) {
  const wrap = typeof target === 'string' ? document.querySelector(target) : target;
  if (!wrap) return;

  const input = wrap.querySelector ? (wrap.querySelector('.t-input') || wrap) : wrap;
  const msgEl = wrap.querySelector ? wrap.querySelector('.t-error-msg') : null;
  if (customMessage && msgEl) msgEl.textContent = customMessage;

  // Activa las clases de error
  if (wrap.classList) wrap.classList.add('is-error');
  if (input && input.classList) {
    input.classList.add('is-error');
    input.classList.add('input-error-state');

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
    if (wrap.classList) wrap.classList.remove('is-error');
    if (input && input.classList) {
      input.classList.remove('is-error');
      input.classList.remove('input-error-state');
    }
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
  if (wrap.classList) wrap.classList.remove('is-error');
  const input = wrap.querySelector ? (wrap.querySelector('.t-input') || wrap) : wrap;
  if (input && input.classList) {
    input.classList.remove('is-error');
    input.classList.remove('input-error-state');
    input.classList.remove('is-shaking');
  }
}

/**
 * Inicializa automáticamente todos los inputs con la clase .t-input-wrap
 * para que limpien el error inmediatamente cuando el usuario empieza a escribir.
 */
export function initInputShakeAutoClear() {
  document.querySelectorAll('.t-input-wrap').forEach((wrap) => {
    const inputEl = wrap.querySelector('.t-input-el') || wrap.querySelector('input');
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
