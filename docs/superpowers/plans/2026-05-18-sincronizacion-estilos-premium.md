# Sincronización Estilos Premium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Lograr una unificación visual absoluta del 100% entre el Store Builder y el Perfil Público Premium compartiendo las mismas clases CSS, el mismo archivo de estilos unificado y las mismas plantillas HTML dinámicas generadas por JS.
**Architecture:** Eliminar el CSS acoplado de `premium-profile.html` e importar un único archivo CSS compartido `theme-base.css`. Sincronizar las plantillas de renderizado de `premium-profile-render.js` con las de `store-builder/js/renderer/engine.js`.
**Tech Stack:** HTML5, CSS3, JavaScript Vanilla, Supabase.
---

## Contexto y Alcance
Actualmente, el perfil público de producción y el editor (Store Builder) utilizan archivos CSS separados y plantillas de generación dinámica ligeramente distintas. Esto causa diferencias visuales y de posicionamiento (como en el Navbar flotante y en el Hero). 

Este plan erradica la divergencia visual de raíz:
1. Mueve/Copia `store-builder/css/theme-base.css` como la hoja de estilos base unificada para toda la plataforma de tiendas premium en `/css/theme-base.css`.
2. Limpia los estilos incrustados e inline de `premium-profile.html` para depender únicamente del CSS unificado.
3. Sincroniza la estructura HTML de la maqueta base en `premium-profile.html` para ser idéntica a la que el motor del builder (`engine.js`) espera.
4. Unifica las funciones de renderizado de componentes (Navbar, Hero, Licencias, Productos, Servicios, FAQ, Footer) en `premium-profile-render.js` con los mismos templates HTML literales de `engine.js`.

---

## Plan de Ejecución de Tareas (Atomic Tasks)

### Task 1: Unificar Hoja de Estilo Base (`theme-base.css`)

**Files:**
- Modify `/store-builder/css/theme-base.css` (para asegurar compatibilidad absoluta con Navbar y Hero del live profile).
- Link `/store-builder/css/theme-base.css` en `premium-profile.html` y eliminar todos los estilos inline redundantes o conflictivos.

- [ ] **Step 1: Inspeccionar y sincronizar variables y selectores en `theme-base.css`**
  Asegurar que todas las variables CSS de color (`--theme-bg`, `--theme-card-bg`, etc.) y fuentes premium estén declaradas correctamente tanto para el Live como para el Builder.

- [ ] **Step 2: Eliminar estilos incrustados en `premium-profile.html`**
  Limpiar el bloque `<style>` de la cabecera de `premium-profile.html` conservando únicamente variables globales críticas o estilos de layout básicos no conflictivos. Reemplazarlo con `<link rel="stylesheet" href="/store-builder/css/theme-base.css">`.

---

### Task 2: Unificar la Estructura Dinámica de Componentes (`premium-profile-render.js`)

**Files:**
- Modify `script/premium-profile-render.js`
- Match `store-builder/js/renderer/engine.js`

- [ ] **Step 1: Sincronizar Plantilla del Navbar**
  Hacer que el navbar dinámico se renderice exactamente igual, flotando de forma absoluta sobre el hero y alineado con el mismo espaciado de `engine.js`.

- [ ] **Step 2: Sincronizar Plantilla de Licencias y Productos**
  Reescribir las plantillas de `PremiumRender.renderLicenses` y `PremiumRender.renderProducts` en `premium-profile-render.js` para usar exactamente las mismas clases de tarjetas (`.lic-card-premium`, `.premium-product-card`) y distribución de rejilla/estantería del builder.

- [ ] **Step 3: Sincronizar Plantilla de Servicios, FAQ y Footer**
  Alinear las estructuras dinámicas de Servicios, FAQ y Footer con las de `engine.js` para asegurar que las variables de padding, bordes y fuentes hereden la estética premium del builder.

---

### Task 3: Ajustes Estructurales en la Maqueta Base (`premium-profile.html`)

**Files:**
- Modify `premium-profile.html`

- [ ] **Step 1: Adaptar los contenedores envolventes**
  Cambiar los IDs y clases de los bloques de sección en la maqueta HTML principal (`#licencias-section`, `#services-section`, etc.) para heredar los estilos unificados de la hoja de estilos compartida.

- [ ] **Step 2: Validar visualmente en dispositivos PC y Móvil**
  Asegurar que las directivas `@media` en `theme-base.css` manejen correctamente el responsive de los shelves (estanterías horizontales) y no permitan desbordamiento horizontal en el cuerpo general (`body`).
