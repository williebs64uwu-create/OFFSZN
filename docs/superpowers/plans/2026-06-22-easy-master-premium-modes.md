# EASY MASTER Premium Modes & Salsa Extra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar el UI de EASY MASTER para incluir el dropdown de Modos premium (Starter, Premium, Sauce) con cambios de color y parámetros de audio dinámicos, renombrar los controles a español (Cantidad, Salsa Extra como limitador, Resetear), añadir la animación de partículas tipo gemas al ritmo del audio, el dibujo sutil de salsa y corregir el desfase visual de los aros de las perillas.

**Architecture:** 
- **C++**: Agregar parámetro `mode` y mapear 3 lógicas de DSP diferenciadas (frecuencias de crossover, tiempos de liberación del limitador, profundidad del Inflator y clipping). Mapear `global-out` (Salsa Extra) como ganancia de entrada al limitador (hasta +12dB) con techo a -0.01dB.
- **UI**: Vanilla HTML/CSS/JS con dropdown premium, canvas de partículas interactivo al RMS por Webview, assets vectoriales sutiles y re-mapeo del rango del dial al 25% (270 grados).

**Tech Stack:** JUCE 8, Webview2, HTML5 Canvas, Vanilla CSS/JS.

---

## Contexto e Inputs
- **Capturas y feedback**: Las perillas no coinciden visualmente al 100% debido a un gap de 20% vs 270 grados de rotación. Se alineará a 25% (arco de 270 grados).
- **Salsa Extra**: Actúa como Maximizer. Subir este control empuja el limitador de forma limpia (Lookahead + Peak Clipper).
- **Modos**:
  - **Starter (Amarillo)**: Suave y seguro (Clipper suave, Haas 4ms, release 120ms).
  - **Premium (Naranja)**: Punch y calor analógico (PuigTec +3dB, Haas 6ms, release 80ms).
  - **Sauce (Morado)**: Agresivo y ruidoso (PuigTec +4dB, Haas 8ms, release 50ms, Clipper en 0.90f para dejar saturar un poco más de picos hasta +3dB).

---

## Plan de Ejecución de Tareas (Atomic Tasks)

### Task 1: Agregar el Parámetro de Modos y Lógica DSP en C++

**Files:**
- Modify: [PluginProcessor.h](file:///C:/Users/Willie/Desktop/EASY%20MASTER/Source/PluginProcessor.h)
- Modify: [PluginProcessor.cpp](file:///C:/Users/Willie/Desktop/EASY%20MASTER/Source/PluginProcessor.cpp)

- [ ] **Step 1: Declarar el parámetro `p_mode` en el header**
  ```cpp
  std::atomic<int> p_mode { 1 }; // Default: Premium (1)
  ```
- [ ] **Step 2: Actualizar `getStateInformation` y `setStateInformation` para persistir el modo**
  Guardar y leer 4 floats (global-in, global-out, amount, mode).
- [ ] **Step 3: Agregar soporte para `"mode"` en `setParamFromUI` y `getParamValue`**
- [ ] **Step 4: Cambiar la lógica en `updateDSP` según el Modo Activo**
  Implementar la tabla de configuraciones para cada uno de los 3 modos (Starter, Premium, Sauce) modificando:
  - Tiempos de crossover (LP/HP 100Hz a 120Hz, etc.)
  - PuigTec EQ Boost/Atten y Side EQ.
  - Liberación del limitador (`limiter.setRelease`).
  - Umbral del Clipper.
- [ ] **Step 5: Mapear "Salsa Extra" en `processBlock`**
  - Ajustar el default en constructor a `100.0f` para Amount y `50.0f` para global-out (que ahora en el UI representará Salsa Extra en porcentaje, pero mantendremos la ganancia unitaria a 50% de fábrica).
  - Quitar el outGain multiplicador directo al final que causaba clipping digital.
  - Aplicar `salsaDrive = p_globalOut.load() / 100.f * 12.f;` (si global-out > 50, drive de 0 a +12dB antes del limitador, si es < 50, atenuación).

---

### Task 2: Modificar la Interfaz Gráfica (HTML/CSS/JS)

**Files:**
- Modify: [plugins/easy-master-mockup.html](file:///C:/Users/Willie/Desktop/OFFSZN/plugins/easy-master-mockup.html)

- [ ] **Step 1: Renombrar perillas y etiquetas**
  - `INPUT` -> `INPUT`
  - `AMOUNT` -> `CANTIDAD`
  - `OUTPUT` -> `SALSA EXTRA` (mostrar porcentaje 0% a 100%, default 100%)
  - Modificar marcas de Cantidad: `LIMPIO`, `CÁLIDO`, `EQUILIBRADO`, `POTENTE`, `SAUCE`.
  - Botón `Reset` -> `RESETEAR`.
  - Añadir texto `v1.0.0` abajo a la derecha.
- [ ] **Step 2: Corregir el arco del SVG Ring y JS**
  - Cambiar `dashOffsetSmall` y `dashOffsetLarge` en CSS y JS para usar 25% de gap (`70.7` y `212.0`). Esto alineará los aros exactamente con el puntero.
- [ ] **Step 3: Crear el Dropdown Premium para los Modos**
  - Agregar botón y menú desplegable al lado derecho de "RESETEAR" (o en la cabecera).
  - Diseñar el dropdown con animación CSS premium y glassmorphism.
  - Al cambiar de modo, despachar `"mode"` a C++ y cambiar las variables CSS de color (`--primary` y `--accent`) y sombras dinámicamente.
- [ ] **Step 4: Dibujar la Salsa en el círculo central**
  - Colocar un SVG sutil de goteo/salsa en el fondo del círculo del Amount con baja opacidad.
- [ ] **Step 5: Implementar el Canvas de Partículas RMS (Gemas)**
  - Agregar un `<canvas>` en la perilla de Cantidad.
  - Programar el sistema de partículas que floten como gemas con brillo.
  - Suscribir a `audio-rms` para modificar la velocidad de emisión, brillo y escala en tiempo real.

---

### Task 3: Compilación y Pruebas

**Files:**
- Build local

- [ ] **Step 1: Compilar la versión Release**
  `cmake --build build --config Release`
- [ ] **Step 2: Verificar la interacción del dropdown y cambios estéticos en la UI**
- [ ] **Step 3: Validar que el limitador de Salsa Extra funcione sin distorsiones indeseadas**
