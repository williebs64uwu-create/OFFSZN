# Studio AI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Transformar la interfaz de generación de audio en una experiencia premium con visualización de ondas, selección de géneros mediante chips y soporte para archivos MP3, siguiendo la estética de "Ruixen AI".
**Architecture:** Frontend (HTML/CSS/JS) con integración de Wavesurfer.js para la visualización de audio.
**Tech Stack:** HTML5, CSS3 (Glassmorphism, Gradients), JavaScript Vanilla, Wavesurfer.js CDN.
---

## User Review Required

> [!IMPORTANT]
> Se utilizará **Wavesurfer.js** vía CDN para la visualización de la forma de onda. Si el proyecto tiene políticas restrictivas con CDNs externos, por favor avisar.
> El límite de 100 caracteres se aplicará al input de texto para cumplir con la solicitud.
> El botón de carga de archivos será específico para `.mp3` como se solicitó.

## Proposed Changes

### [Component: UI Redesign]
#### [MODIFY] [texto-a-sample.html](file:///c:/Users/Willie/Desktop/OFFSZN/studio/texto-a-sample.html)
- Actualizar estructura HTML para incluir el área de chips.
- Agregar input de archivo oculto con label estilizada.
- Preparar contenedor para Wavesurfer.
- Añadir estilos CSS para el efecto de brillo (glow) y glassmorphism.

### [Component: Logic Update]
#### [MODIFY] [studio-ai.js](file:///c:/Users/Willie/Desktop/OFFSZN/script/studio-ai.js)
- Implementar validación de 100 caracteres.
- Manejar la selección de chips (inyectar texto al input).
- Integrar Wavesurfer.js para renderizar la onda al recibir el audio.
- Asegurar que el botón regrese al estado "Generar" después de la carga.
- Lógica para leer metadatos de MP3 (básica/segura) si se sube un archivo.

---

### Task 1: UI Enhancement (Layout & CSS)

**Files:**
- Modify `studio/texto-a-sample.html`

- [ ] **Step 1: Estilizar el contenedor con Glassmorphism y Glow**
`Actualizar el #prompt-container con background: rgba(255,255,255,0.05), backdrop-filter: blur(10px) y un box-shadow de brillo púrpura/blanco.`

- [ ] **Step 2: Agregar Chips de Género**
`Insertar un contenedor flex-wrap debajo del input con los chips: TRAP, CRANK, PLUGG, RNB, AFROBEAT, DANCEHALL, SPINZ 808, ZAY 808.`

- [ ] **Step 3: Agregar Selector de Archivos MP3**
`Añadir un botón con icono de clip que dispare un <input type="file" accept=".mp3">.`

### Task 2: Waveform Integration

**Files:**
- Modify `studio/texto-a-sample.html` (add CDN)
- Modify `script/studio-ai.js`

- [ ] **Step 1: Cargar Wavesurfer.js CDN**
`Añadir <script src="https://unpkg.com/wavesurfer.js@7"></script> al final del head.`

- [ ] **Step 2: Inicializar Wavesurfer en JS**
`Crear una instancia de WaveSurfer apuntando al contenedor de resultados.`

- [ ] **Step 3: Renderizar onda post-generación**
`En el callback de éxito, llamar a wavesurfer.load(audioUrl) en lugar de usar un player nativo visible.`

### Task 3: Interaction Logic & Constraints

**Files:**
- Modify `script/studio-ai.js`

- [ ] **Step 1: Limitar input a 100 caracteres**
`Añadir event listener 'input' para truncar a 100 caracteres.`

- [ ] **Step 2: Lógica de Chips**
`Al hacer click en un chip, añadir su texto al input (o reemplazar si es un 'rol').`

- [ ] **Step 3: Validación de Créditos e Icono Gem**
`Asegurar que solo se muestre una gema y el texto "N Créditos" de forma limpia.`

---

## Open Questions

> [!NOTE]
> ¿Deseas que al seleccionar un chip se **agregue** el texto al existente o que **limpie** el input para poner solo ese género?
> Para la carga de MP3, ¿el objetivo es que al subirlo se "lea" y se genere algo similar automáticamente, o solo para extraer metadatos visuales?

## Verification Plan

### Automated Tests
- N/A (Manual visual verification is priority for UI/Waveform).

### Manual Verification
- Verificar en `http://localhost:3000/studio/texto-a-sample` que el input no exceda 100 chars.
- Probar que los chips insertan texto.
- Generar un sonido y confirmar que la onda se dibuja correctamente.
- Verificar que el botón vuelva a "Generar" al finalizar.
