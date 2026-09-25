# Liquid Gooey • OFFSZN UI Component (Hyper-Realistic Edition)

Efecto de separación y fusión líquida (*liquid goo*) de grado hiperrealista, inspirado en la arquitectura avanzada de [Libraries.dev](https://libraries.dev/gooey) por Jakub Antalik.

A diferencia de un simple filtro desenfocado, esta versión implementa **física de fluidos y volumetría 3D**:
1. **Borde Especular Líquido (`1px Inset Rim Highlight`)**: Un anillo de luz que sigue fielmente el contorno y envuelve el cuello líquido mientras se estira y adelgaza.
2. **Sombra Volumétrica Unificada (Dual Drop-Shadow)**: Las sombras de contacto y profundidad se calculan sobre la silueta fundida completa, no sobre elementos individuales.
3. **Inercia y Anticipación de Cierre**: Al cerrarse, el disparador central se sumerge 5px (`liquid-anticipate`) para absorber con inercia el impacto de las gotas que retornan.
4. **Materialización Suave de Iconos**: Los iconos se retienen desenfocados (`blur(2.5px); opacity: 0`) mientras el cuello líquido está unido y brotan nítidos al despegarse la gota.

---

## Rutas
- CSS: `compon/new/liquid-gooey/liquid-gooey.css`
- JS: `compon/new/liquid-gooey/liquid-gooey.js`

---

## Comando rápido para Antigravity
```
Usa el componente Liquid Gooey (ruta: compon/new/liquid-gooey/) en [botón flotante / menú de acciones / speed dial].
```

---

## 1. Uso en React 18+ (`liquid-gooey`)

Instalación:
```bash
npm install liquid-gooey
```

Código de ejemplo:
```tsx
import React, { useState } from 'react'
import { Liquid } from 'liquid-gooey'

export function ActionDial() {
  const [open, setOpen] = useState(false)

  return (
    <Liquid 
      blur={6} 
      contrast={18} 
      fill="#202020" 
      shadow="0 0 0 1px rgba(255, 255, 255, 0.04) inset, 0 1px 0 0 rgba(255, 255, 255, 0.03) inset, 0 2px 6px 0 rgba(0, 0, 0, 0.05), 0 4px 42px 0 rgba(0, 0, 0, 0.24)"
    >
      {/* Botón 1: Diagonal izquierda */}
      <Liquid.Item x={open ? -54 : 0} y={open ? -34 : 0} transition="bouncy">
        <button className="round-btn" aria-label="Favorito">
          <HeartIcon />
        </button>
      </Liquid.Item>

      {/* Botón 2: Centro superior */}
      <Liquid.Item x={0} y={open ? -64 : 0} transition="bouncy" delay={40}>
        <button className="round-btn" aria-label="Descargar Kit">
          <DownloadIcon />
        </button>
      </Liquid.Item>

      {/* Botón 3: Diagonal derecha */}
      <Liquid.Item x={open ? 54 : 0} y={open ? -34 : 0} transition="bouncy" delay={80}>
        <button className="round-btn" aria-label="Compartir">
          <ShareIcon />
        </button>
      </Liquid.Item>

      {/* Disparador central (FAB) */}
      <Liquid.Item x={0} y={0}>
        <button className="round-btn main" onClick={() => setOpen(!open)}>
          <PlusIcon className={open ? 'rotated' : ''} />
        </button>
      </Liquid.Item>
    </Liquid>
  )
}
```

---

## 2. Uso Nativo en Vanilla HTML / CSS / JS (OFFSZN)

### HTML:
```html
<link rel="stylesheet" href="/compon/new/liquid-gooey/liquid-gooey.css">

<div class="liquid-gooey-wrap" id="myLiquidDial">
  <!-- Capa de fusión SVG -->
  <div class="liquid-gooey-stage">
    <div class="liquid-blob liquid-blob-trigger"></div>
    <div class="liquid-blob liquid-blob-item" style="--item-x: -54px; --item-y: -34px;"></div>
    <div class="liquid-blob liquid-blob-item" style="--item-x: 0px; --item-y: -64px;"></div>
    <div class="liquid-blob liquid-blob-item" style="--item-x: 54px; --item-y: -34px;"></div>
  </div>

  <!-- Capa interactiva con iconos vectoriales -->
  <div class="liquid-controls-layer">
    <!-- Item 1 -->
    <button type="button" class="liquid-item-btn" style="--item-x: -54px; --item-y: -34px; --item-delay: 0ms;" data-label="Descargar">
      <span class="liquid-sat-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </span>
    </button>

    <!-- Item 2 -->
    <button type="button" class="liquid-item-btn" style="--item-x: 0px; --item-y: -64px; --item-delay: 40ms;" data-label="Favorito">
      <span class="liquid-sat-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      </span>
    </button>

    <!-- Item 3 -->
    <button type="button" class="liquid-item-btn" style="--item-x: 54px; --item-y: -34px; --item-delay: 80ms;" data-label="Compartir">
      <span class="liquid-sat-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
      </span>
    </button>

    <!-- Disparador Central (+) -->
    <button type="button" class="liquid-trigger-btn" aria-label="Abrir menú" aria-expanded="false">
      <span class="liquid-trigger-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </span>
    </button>
  </div>
</div>

<script type="module">
  import { LiquidGooey } from '/compon/new/liquid-gooey/liquid-gooey.js';

  const dial = new LiquidGooey('#myLiquidDial', {
    blur: 6,
    contrast: 18,
    theme: 'dark',
    anticipDist: 5,
    anticipDur: 600
  });
</script>
```

---

## 3. Arquitectura del Shader SVG

El pipeline se compone de 7 pases coordinados:
1. `feGaussianBlur`: Radio de difusión del fluido (`stdDeviation = blur`).
2. `feColorMatrix`: Multiplicador de tensión alpha con intercept calculado:
   $$\text{intercept} = \operatorname{round}\left(0.5 - \text{contrast} \times \frac{5}{12}\right)$$
3. `feComposite atop`: Compone la silueta sin degradar los píxeles internos.
4. `feColorMatrix (Binarize)`: Matriz `0 0 0 60 -29.5` para extraer la máscara de silueta matemática.
5. `feMorphology (erode 1px) + feComposite out`: Genera la banda de 1px perimetral para el **resalte especular de mercurio**.
6. `Dual Drop Shadow`: Sombra de contacto (3px blur) + sombra difusa profunda (14px blur) sobre la masa completa.
7. `feMerge`: Compone en orden físico: Sombras $\to$ Masa del fluido $\to$ Resalte especular perimetral $\to$ Reflejo cenital.
