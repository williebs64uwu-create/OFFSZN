# EASY MASTER Premium Modes & Salsa Extra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refinar el UI de EASY MASTER para corregir los textos que no se tradujeron (CANTIDAD, SALSA EXTRA, marcas en español, botón RESETEAR), mover el logo/título al footer izquierdo y la versión al footer derecho, solucionar el bloqueo de clicks por la pantalla de activación (remplazando con `display: none`) y añadir los efectos de partículas y salsa drip.

**Architecture:**
- **C++**: Mantener las lógicas DSP de Modos y Salsa Extra (Limiter Gain).
- **UI**: 
  - Ocultar la pantalla de activación usando `display: none` en lugar de sólo `pointer-events: none` para evitar el bug de Chromium/WebView2 que bloquea clicks.
  - Eliminar `.logo-area` de la cabecera.
  - Añadir una barra de pie de página (`.footer`) con `EASY MASTER by OFFSZN` a la izquierda y `Versión 1.0.0` a la derecha.
  - Corregir de forma rigurosa las etiquetas del dial usando reemplazos exactos en el HTML.

---

## Plan de Ejecución de Tareas (Atomic Tasks)

### Task 1: Restaurar y Re-aplicar Modificaciones en la UI

**Files:**
- Modify: [plugins/easy-master-mockup.html](file:///C:/Users/Willie/Desktop/OFFSZN/plugins/easy-master-mockup.html)

- [ ] **Step 1: Restaurar HTML a estado inicial limpio para evitar parches corruptos**
- [ ] **Step 2: Re-escribir script de parcheo usando strings de coincidencia exacta**
  - Mapear `<div class="label" style="margin-top: -5px;">AMOUNT</div>` -> `<div class="label" style="margin-top: -5px;">CANTIDAD</div>`
  - Mapear `<div class="label">OUTPUT</div>` -> `<div class="label">SALSA EXTRA</div>`
  - Mapear etiquetas de marcas: `LIMPIO`, `CÁLIDO`, `EQUILIBRADO`, `POTENTE`, `SAUCE`.
  - Mapear botón `Reset` -> `RESETEAR`.
- [ ] **Step 3: Mover Logo a Footer e Insertar Versión**
  - Quitar el div `.logo-area` del header.
  - Agregar `<div class="footer"><div class="footer-left">EASY MASTER by OFFSZN</div><div class="footer-right">Versión 1.0.0</div></div>` justo antes de `</body>`.
- [ ] **Step 4: Solucionar Bloqueo de Perillas**
  - Cambiar la lógica en `setLicenseStatus` para usar `overlay.style.display = 'none'` cuando la licencia sea válida, garantizando que el WebView2 no intercepte los clicks en las perillas.
- [ ] **Step 5: Integrar Canvas Gemas RMS, Salsa Drip y Aros SVG 25%**
  - Re-inyectar el canvas de gemas con comportamiento de aceleración RMS al recibir el evento `audio-rms`.
  - Colocar el SVG de goteo de salsa con baja opacidad en el centro del dial.
  - Ajustar el offset a 25% del arco (`70.7` y `212.0`).

---

### Task 2: Compilación y QA

**Files:**
- Build local

- [ ] **Step 1: Compilar la versión Release**
  `cmake --build build --config Release`
- [ ] **Step 2: Probar en FL Studio**
  - Comprobar que las perillas giren correctamente y no estén bloqueadas.
  - Comprobar que el diseño tenga el footer y la versión correctos.
  - Confirmar las traducciones al español.
