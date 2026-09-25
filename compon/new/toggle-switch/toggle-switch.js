/**
 * OFFSZN UI Library • Toggle Switch (.t-toggle)
 * Microinteracción de switch con doble rebote (overshoot) y transición de pista.
 * Docs: https://transitions.dev/detail.html?t=toggle
 */

/**
 * Alterna el estado de un switch .t-toggle.
 * @param {HTMLElement} toggleEl - El elemento botón .t-toggle
 * @param {boolean} [forceState] - Estado forzado opcional (true = on, false = off)
 * @returns {boolean} Nuevo estado del toggle
 */
export function toggleSwitch(toggleEl, forceState) {
  if (!toggleEl) return false;

  // Marcar como inicializado en la primera interacción para permitir que corran las animaciones
  if (!toggleEl.classList.contains('is-init')) {
    toggleEl.classList.add('is-init');
  }

  const current = toggleEl.getAttribute('data-on') === 'true';
  const next = typeof forceState === 'boolean' ? forceState : !current;

  toggleEl.setAttribute('data-on', next ? 'true' : 'false');
  toggleEl.setAttribute('aria-checked', next ? 'true' : 'false');

  // Disparar evento personalizado para listeners externos
  toggleEl.dispatchEvent(new CustomEvent('toggle-change', {
    detail: { on: next },
    bubbles: true
  }));

  return next;
}

/**
 * Inicializa automáticamente todos los switches .t-toggle en el DOM.
 */
export function initToggleSwitches() {
  document.querySelectorAll('.t-toggle').forEach((el) => {
    if (el._toggleInitialized) return;
    el._toggleInitialized = true;

    // Click handler
    el.addEventListener('click', () => {
      toggleSwitch(el);
    });

    // Accesibilidad con teclado (Space / Enter)
    el.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleSwitch(el);
      }
    });
  });
}

// Auto-inicialización
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToggleSwitches);
  } else {
    initToggleSwitches();
  }
}
