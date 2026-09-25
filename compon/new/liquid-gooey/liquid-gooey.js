/**
 * OFFSZN • Liquid Gooey Component Controller (Hyper-Realistic Physical Edition)
 * Recrea fielmente el motor físico de Libraries.dev por Jakub Antalik:
 * - Filtro SVG multicapa (Fusión + Sombra volumétrica unificada + Borde especular 1px).
 * - Cinemática de inercia y anticipación al absorber las gotas en el cierre.
 * - Despliegue elástico con retardo progresivo (stagger) y retorno instantáneo snappy.
 */

export class LiquidGooey {
  static FILTER_ID = 'liquid-goo-filter';

  /**
   * Genera el filtro SVG de sombreado e iluminación física
   */
  static getFilterMarkup(blur = 6, contrast = 18, theme = 'dark') {
    const intercept = Math.round((0.5 - contrast * (5 / 12)) * 100) / 100;
    const isDark = theme === 'dark';

    const rimColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
    const sheenColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.5)';
    const ds1Color = isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.06)';
    const ds2Color = isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.08)';

    return `
      <filter id="${LiquidGooey.FILTER_ID}" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB">
        <!-- 1. Desenfoque y umbralización de alpha (Fusión líquida) -->
        <feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="blur" />
        <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${contrast} ${intercept}" result="goo" />
        <feComposite in="SourceGraphic" in2="goo" operator="atop" result="shape" />

        <!-- 2. Binarización de silueta para máscaras de relieve y sombra -->
        <feColorMatrix in="shape" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 60 -29.5" result="bin" />

        <!-- 3. Sombra de oclusión ambiental (Próxima) -->
        <feGaussianBlur in="bin" stdDeviation="3" result="ds1-b" />
        <feOffset in="ds1-b" dx="0" dy="2" result="ds1-o" />
        <feFlood flood-color="${ds1Color}" result="ds1-c" />
        <feComposite in="ds1-c" in2="ds1-o" operator="in" result="shadow1" />

        <!-- 4. Sombra profunda difusa -->
        <feGaussianBlur in="bin" stdDeviation="14" result="ds2-b" />
        <feOffset in="ds2-b" dx="0" dy="8" result="ds2-o" />
        <feFlood flood-color="${ds2Color}" result="ds2-c" />
        <feComposite in="ds2-c" in2="ds2-o" operator="in" result="shadow2" />

        <!-- 5. Borde especular (1px Inset Rim Highlight que envuelve el cuello líquido) -->
        <feMorphology in="bin" operator="erode" radius="1" result="er1" />
        <feComposite in="bin" in2="er1" operator="out" result="rim-band" />
        <feFlood flood-color="${rimColor}" result="rim-c" />
        <feComposite in="rim-c" in2="rim-band" operator="in" result="inset-rim" />

        <!-- 6. Reflejo cenital sutil (Top Sheen) -->
        <feOffset in="er1" dx="0" dy="1.5" result="sheen-o" />
        <feComposite in="bin" in2="sheen-o" operator="out" result="sheen-band" />
        <feFlood flood-color="${sheenColor}" result="sheen-c" />
        <feComposite in="sheen-c" in2="sheen-band" operator="in" result="inset-sheen" />

        <!-- 7. Composición multicapa: Sombras -> Masa Líquida -> Resaltes Especulares -->
        <feMerge>
          <feMergeNode in="shadow2" />
          <feMergeNode in="shadow1" />
          <feMergeNode in="shape" />
          <feMergeNode in="inset-rim" />
          <feMergeNode in="inset-sheen" />
        </feMerge>
      </filter>
    `.trim();
  }

  /**
   * Inyecta o actualiza el filtro en el DOM
   */
  static ensureSvgFilter(blur = 6, contrast = 18, theme = 'dark') {
    let svgContainer = document.querySelector('svg.liquid-gooey-svg-defs');
    if (!svgContainer) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <svg class="liquid-gooey-svg-defs" style="position: absolute; width: 0; height: 0; pointer-events: none; overflow: hidden;" aria-hidden="true">
          <defs id="liquid-goo-defs">
            ${LiquidGooey.getFilterMarkup(blur, contrast, theme)}
          </defs>
        </svg>
      `.trim();
      document.body.appendChild(wrap.firstElementChild);
    } else {
      LiquidGooey.updateSvgFilter(blur, contrast, theme);
    }
  }

  static updateSvgFilter(blur = 6, contrast = 18, theme = 'dark') {
    const defs = document.getElementById('liquid-goo-defs') || document.querySelector('svg.liquid-gooey-svg-defs defs');
    if (defs) {
      defs.innerHTML = LiquidGooey.getFilterMarkup(blur, contrast, theme);
    }
  }

  constructor(target, options = {}) {
    this.wrap = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this.wrap) return;

    this.options = {
      blur: 6,
      contrast: 18,
      theme: 'dark',
      openDur: 520,
      closeDur: 240,
      openStagger: 40,
      anticipDist: 5,
      anticipDur: 600,
      closeOnClickOutside: true,
      closeOnEsc: true,
      ...options
    };

    this.isOpen = false;
    this.anticipTimer = null;
    this.triggerBtn = this.wrap.querySelector('.liquid-trigger-btn');
    this.itemBtns = Array.from(this.wrap.querySelectorAll('.liquid-item-btn'));
    this.blobItems = Array.from(this.wrap.querySelectorAll('.liquid-blob-item'));

    LiquidGooey.ensureSvgFilter(this.options.blur, this.options.contrast, this.options.theme);
    this.bindEvents();
  }

  bindEvents() {
    this.handleTriggerClick = (e) => {
      e.stopPropagation();
      this.toggle();
    };

    this.handleDocumentClick = (e) => {
      if (this.options.closeOnClickOutside && this.isOpen && !this.wrap.contains(e.target)) {
        this.close();
      }
    };

    this.handleKeyDown = (e) => {
      if (this.options.closeOnEsc && this.isOpen && e.key === 'Escape') {
        this.close();
        this.triggerBtn?.focus();
      }
    };

    this.triggerBtn?.addEventListener('click', this.handleTriggerClick);
    document.addEventListener('click', this.handleDocumentClick);
    document.addEventListener('keydown', this.handleKeyDown);

    this.itemBtns.forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        if (typeof this.options.onItemClick === 'function') {
          this.options.onItemClick(btn, index, e);
        }
      });
    });
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;

    if (this.anticipTimer) {
      clearTimeout(this.anticipTimer);
      this.anticipTimer = null;
    }
    this.wrap.classList.remove('is-anticipating');
    this.wrap.classList.add('is-open');

    this.triggerBtn?.setAttribute('aria-expanded', 'true');
    if (typeof this.options.onToggle === 'function') {
      this.options.onToggle(true);
    }
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;

    // Disparar anticipación física de absorción (inercia)
    if (this.options.anticipDist > 0) {
      this.wrap.classList.remove('is-anticipating');
      // Forzar reflow para reiniciar la animación
      void this.wrap.offsetWidth;
      this.wrap.classList.add('is-anticipating');

      if (this.anticipTimer) clearTimeout(this.anticipTimer);
      this.anticipTimer = setTimeout(() => {
        this.wrap.classList.remove('is-anticipating');
        this.anticipTimer = null;
      }, this.options.anticipDur);
    }

    this.wrap.classList.remove('is-open');
    this.triggerBtn?.setAttribute('aria-expanded', 'false');

    if (typeof this.options.onToggle === 'function') {
      this.options.onToggle(false);
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  setBlur(val) {
    this.options.blur = val;
    LiquidGooey.updateSvgFilter(this.options.blur, this.options.contrast, this.options.theme);
  }

  setContrast(val) {
    this.options.contrast = val;
    LiquidGooey.updateSvgFilter(this.options.blur, this.options.contrast, this.options.theme);
  }

  setTheme(theme) {
    this.options.theme = theme;
    this.wrap.setAttribute('data-theme', theme);
    LiquidGooey.updateSvgFilter(this.options.blur, this.options.contrast, this.options.theme);
  }

  setPositions(positions) {
    const applyToElements = (elements) => {
      elements.forEach((el, i) => {
        const pos = positions[i];
        if (pos) {
          el.style.setProperty('--item-x', `${pos.x}px`);
          el.style.setProperty('--item-y', `${pos.y}px`);
          if (pos.delay != null) {
            el.style.setProperty('--item-delay', `${pos.delay}ms`);
          }
        }
      });
    };

    applyToElements(this.itemBtns);
    applyToElements(this.blobItems);
  }

  destroy() {
    if (this.anticipTimer) clearTimeout(this.anticipTimer);
    this.triggerBtn?.removeEventListener('click', this.handleTriggerClick);
    document.removeEventListener('click', this.handleDocumentClick);
    document.removeEventListener('keydown', this.handleKeyDown);
  }
}

export function initLiquidGooey(selector = '.liquid-gooey-wrap', options = {}) {
  const elements = document.querySelectorAll(selector);
  return Array.from(elements).map(el => new LiquidGooey(el, options));
}

if (typeof window !== 'undefined') {
  window.LiquidGooey = LiquidGooey;
  window.initLiquidGooey = initLiquidGooey;
}
