---
name: crear-plugin-offszn
description: Workflow completo y arquitectura modular para crear plugins VST3/AU en OFFSZN: landings, assets multimedia, UI responsive/anti-resize, seguridad anti-abuso, seriales y compilación multiplataforma.
---

# 🎛️ Creador de Plugins, UI Responsive y Landings OFFSZN

## Cuándo usar este skill
- Cuando el usuario quiera crear o clonar un nuevo plugin de audio VST3/AU para la tienda OFFSZN.
- Cuando se requiera duplicar y personalizar la landing page y mockup HTML/JS de plugins como **Easy Mix**, **Easy Master** o **Inka Kola**.
- Cuando se configure la seguridad de seriales (anti-abuso, HWID, offline trust), maquetación modular anti-resize y compilación para Windows y macOS.

---

## 📋 Inputs Necesarios (Solicitar TODOS antes de iniciar)

| # | Input | Ejemplo |
|---|-------|---------|
| 1 | **Nombre del plugin** | `Inka Kola`, `Easy Master`, `Easy Mix` |
| 2 | **Slug / nombre de archivo** | `inka-kola`, `easy-master`, `easy-mix` |
| 3 | **Prefijo de seriales** | `INKA-`, `EMASTER-`, `EMIX-` |
| 4 | **Título del Hero** | `INKA KOLA PLUGIN` |
| 5 | **Subtítulo del Hero** | `Masterizar canciones tan fácil como tomarse una Inka Kola` |
| 6 | **Descripción corta (meta/og)** | 1-2 oraciones descriptivas sobre el resultado de audio |
| 7 | **Descripción larga / características** | Bullets de funciones, perillas, DSP y compatibilidad con DAWs |
| 8 | **Imagen del Hero Principal** | `/plugins/<slug>.png` — Mockup 3D o gráfica principal |
| 9 | **Video Demo ("Cómo Suena")** | `/plugins/<slug>.mp4` — Video demo con audio y control táctil |
| 10 | **Precio de lanzamiento** | `$5` USD (default de por vida) |
| 11 | **Número de WhatsApp de contacto** | `51993525005` (default OFFSZN) |
| 12 | **Enlace de descarga Windows (.exe)** | Google Drive en modo `/view?usp=sharing` |
| 13 | **Enlace de descarga macOS (.pkg)** | Google Drive en modo `/view?usp=sharing` (se puede colocar tras la build) |

---

## 🏗️ Arquitectura de Seguridad y Anti-Abuso (Todas las Capas)

```
[ FRONTEND UI (JS) ] ──(HWID + Serial)──► [ C++ JUCE NATIVE BRIDGE ] ──(HTTPS)──► [ BACKEND SERVER / SUPABASE ]
        │                                             │                                      │
   1. Validar formato                           2. Inyectar HWID                       3. Scavenger Anti-Abuse
   2. Offline Trust (FULL)                      3. Guardar InkaKola.lic                4. Bloqueo de HWID re-usados
   3. Bloqueo UI (TRIAL Exp)                    4. Launch URL browser                  5. Expiración de 7 días
```

### Matriz de Seguridad de Licencias
1. **Licencias FULL (`lifetime`):** `<PREFIX>-FULL-XXXX-XXXX`
   - **Offline Trust Absoluto:** Al activarse por primera vez online, la clave se guarda encriptada/localmente (`InkaKola.lic` / `EasyMaster.lic`).
   - El plugin **NUNCA** vuelve a requerir internet ni bloquea al usuario si está sin conexión.
2. **Licencias TRIAL (`trial`):** `<PREFIX>-TRIAL-XXXX-XXXX`
   - **Verificación Silenciosa cada Sesión:** Al abrir el plugin, valida contra `/api/plugin/activate` con `{ serial_key, hwid, plugin_name }`.
   - **Scavenger Server-Side:** Evita reciclaje de pruebas por el mismo HWID en Supabase.
   - **Hard-Lock Overlay:** Si la prueba vence o el servidor responde `success: false`, se activa el modal de **Prueba Expirada**.

---

## 🎨 UI Modular & Sistema Anti-Resize

Para garantizar que la interfaz HTML/CSS dentro del WebView2 (Windows) / WKWebView (macOS) **NUNCA sufra desbordamientos, distorsiones ni desorden al redimensionar la ventana en el DAW**:

### 1. Reglas CSS Anti-Resize y Anti-Zoom
```css
html, body {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden; /* Prohibido scrollbars */
  user-select: none; /* Prohibida selección de texto */
  -webkit-user-select: none;
  background: #0f0f11;
  font-family: 'Inter', sans-serif;
}
body { -webkit-touch-callout: none; }
```
```javascript
// Prevenir zoom con ctrl + rueda del ratón dentro del plugin
document.addEventListener('wheel', function(e) {
    if (e.ctrlKey) { e.preventDefault(); }
}, { passive: false });
```

### 2. Guardas en C++ JUCE (`PluginEditor.cpp`)
```cpp
setSize (580, 520);
setResizable (true, true);
setResizeLimits (480, 420, 1200, 1000); // Límites dinámicos seguros
```

### 3. Registro Modular de Controles UI (`knobRegistry`)
Para añadir perillas o faders nuevos sin desorganizar el código:
```javascript
var knobRegistry = {};

function registerKnob(id, element, onChange) {
    knobRegistry[id] = {
        element: element,
        setValue: function(val) { updateKnobVisual(element, val); },
        onChange: onChange
    };
}
```

---

## 🔄 Workflow Ordenado Paso a Paso

---

### PASO 1: Landing Page (`plugins/<slug>.html`)
1. Copiar base desde `plugins/inka-kola.html` o `plugins/easy-master-mockup.html`.
2. Actualizar meta tags SEO (`title`, `og:image`, `og:url`, `description`).
3. Asignar assets multimedia obligatorios:
   - Hero Image: `/plugins/<slug>.png`
   - Video Demo: `/plugins/<slug>.mp4`
4. Configurar botones de pago WA con el nombre **EXACTO** del plugin nuevo:
   - **Mercado Pago:** `text=Hola,%20quiero%20comprar%20el%20plugin%20[NOMBRE_URLENCODED]%20por%20Mercado%20Pago`
   - **Yape:** `text=Hola,%20quiero%20comprar%20el%20plugin%20[NOMBRE_URLENCODED]%20por%20Yape`
   - **Binance:** `text=Hola,%20quiero%20pagar%20con%20Binance%20el%20plugin%20[NOMBRE_URLENCODED]`
   - **Otros Medios:** `text=Hola,%20quiero%20el%20plugin%20de%20[NOMBRE_URLENCODED]`
5. Enlaces de descarga en Google Drive **siempre** con `/view?usp=sharing`.

---

### PASO 2: UI Nativa del Plugin (`Resources/index.html`)
1. Definir constantes globales al inicio:
   ```javascript
   const PLUGIN_NAME = '[Nombre Plugin]';
   const PLUGIN_SLUG = '[slug]';
   const PLUGIN_PREFIX = '[PREFIX]';
   const PLUGIN_LANDING_URL = 'https://offszn.lat/plugins/[slug].html';
   ```
2. Modales Estandarizados:
   - **Modal Inicial:** "Ingresa tu Serial Key" + `ACTIVAR PLUGIN` + `CONSIGUE TU LICENCIA →`.
   - **Modal Expirado:** Candado 🔒 + "PRUEBA EXPIRADA" + `ACTIVAR NUEVA LICENCIA` + `CONSIGUE TU LICENCIA →` (⚠️ **SIN botón de soporte**).
3. Puente `openExternalURL(url)` enviando cadena nativa directa (no array).
4. Persistencia mediante `applyUIParams(res)` y el evento `ui-ready`.

---

### PASO 3: Supabase & Servidor Backend
1. Insertar licencias activas en `plugin_licenses` (`plugin_name`, `max_devices: 2`).
2. Verificar que `/api/plugin/activate` reciba `{ serial_key, hwid, plugin_name }`.

---

### PASO 4: C++ JUCE & Reglas de CMake
1. Formatos: `FORMATS VST3 AU Standalone`.
2. **Regla de Firma en macOS (`codesign`):** Copiar recursos **únicamente a `Contents/Resources/` (`../Resources`)** dentro del bundle.
   - Prohibido copiar a la raíz (`../../Resources`) en Mac para evitar el error `unsealed contents` (exit code 65).
3. Guardas `#if JUCE_WINDOWS` para rutas locales de desarrollo (`D:\...`) y opciones de WebView2.

---

### PASO 5: Compilación y Publicación (ÚLTIMO PASO)
1. **Windows:** `cmake --build build --config Release` → Inno Setup (`ISCC.exe`) → `.exe` en Escritorio.
2. **macOS:** Push a GitHub → GitHub Action `build_mac.yml` genera `.pkg` (VST3 + AU + Standalone).
3. **Update final:** Pegar las URLs `/view?usp=sharing` de Google Drive en la landing page y publicar.

---

## ✅ Checklist Pre-Lanzamiento

- [ ] Inputs solicitados y validados antes de empezar.
- [ ] Assets multimedia `/plugins/<slug>.png` y `/plugins/<slug>.mp4` en su sitio.
- [ ] Links de WhatsApp con el nombre exacto del nuevo plugin.
- [ ] Modales estandarizados sin botón de soporte en el modal expirado.
- [ ] CSS responsive con `overflow: hidden`, `user-select: none` y prevent zoom `ctrlKey+wheel`.
- [ ] `applyUIParams` y `knobRegistry` respondiendo al evento `ui-ready`.
- [ ] CMakeLists.txt con copia de recursos a `Contents/Resources/` solo en Mac (`../Resources`).
- [ ] Instalador Windows `.exe` generado en Escritorio.
- [ ] GitHub Action para Mac probada y aprobada por `codesign`.
- [ ] Landing page publicada con links de Google Drive `/view?usp=sharing`.
