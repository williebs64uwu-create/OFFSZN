---
name: crear-plugin-offszn
description: Workflow completo para lanzar un plugin VST3/AU en OFFSZN: duplicar landing, solicitar assets (hero + video), configurar descripciones, métodos de pago con WA links dinámicos, seriales anti-abuso, interfaz JUCE HTML/JS y compilación multiplataforma.
---

# 🎛️ Creador de Plugins y Landings OFFSZN

## Cuándo usar este skill
- Cuando el usuario quiera lanzar un nuevo plugin VST3/AU en la tienda OFFSZN.
- Cuando se requiera duplicar y personalizar la landing de un plugin existente (Inka Kola o Easy Master).
- Cuando se necesite configurar seriales, validación de licencias, pagos y compilación multiplataforma.

---

## Inputs necesarios (solicitar TODOS antes de empezar)

Antes de hacer cualquier cambio, preguntar explícitamente al usuario por cada uno de estos datos:

| # | Input | Ejemplo |
|---|-------|---------|
| 1 | **Nombre del plugin** | `Inka Kola`, `Easy Drums` |
| 2 | **Slug / nombre de archivo** | `inka-kola`, `easy-drums` |
| 3 | **Prefijo de seriales** | `INKA-`, `EDRUMS-` |
| 4 | **Título del Hero** | `INKA KOLA PLUGIN` |
| 5 | **Subtítulo del Hero** | `Masterizar canciones tan fácil como tomarse una Inka Kola` |
| 6 | **Descripción corta (para og:description y meta)** | 1-2 oraciones sobre qué hace el plugin |
| 7 | **Descripción larga / sección de características** | Párrafo o bullets de qué hace, para qué sirve, DAWs compatibles |
| 8 | **Imagen del Hero Principal** | `/plugins/<slug>.png` — pedir ruta o que el usuario la suba |
| 9 | **Video Demo ("Cómo Suena")** | `/plugins/<slug>.mp4` — pedir ruta o que el usuario lo suba |
| 10 | **Precio de lanzamiento** | `$5` USD (default) |
| 11 | **Número de WhatsApp de contacto** | `51993525005` (default OFFSZN) |
| 12 | **Enlace de descarga Windows (.exe)** | Google Drive en modo `/view?usp=sharing` |
| 13 | **Enlace de descarga macOS (.pkg)** | Google Drive en modo `/view?usp=sharing` (puede dejarse pendiente hasta compilar) |

> ⚠️ Si falta la imagen o el video, NO avanzar al siguiente paso. Esperar que el usuario los proporcione.

---

## 🔄 Workflow Ordenado (Paso a Paso Estricto)

---

### PASO 1: Duplicación y Personalización de Landing Page

**Archivo:** `plugins/<slug>.html`
**Base a copiar:** `plugins/inka-kola.html`

#### 1.1 — SEO & Metadatos (reemplazar con datos del nuevo plugin)
```html
<title>[Nombre Plugin] VST | OFFSZN</title>
<meta name="description" content="[Descripción corta]">
<meta property="og:title" content="[Nombre Plugin] VST | OFFSZN">
<meta property="og:description" content="[Descripción corta]">
<meta property="og:image" content="https://offszn.lat/plugins/[slug].png">
<meta property="og:url" content="https://offszn.lat/plugins/[slug]">
```

#### 1.2 — Hero Principal
- **Imagen Hero:** `<img src="/plugins/[slug].png" alt="[Nombre Plugin] VST" class="hero-mockup">`
- **Título:** `<h1 class="hero-title">[NOMBRE PLUGIN]</h1>`
- **Subtítulo:** `<p class="hero-subtitle">[Subtítulo descriptivo]</p>`
- **Botón Hero:** `<a href="#serial-section">DESCARGAR PLUGIN</a>`

#### 1.3 — Sección Video Demo ("Cómo Suena")
- Video: `<video src="/plugins/[slug].mp4" autoplay muted loop playsinline controls>`
- Incluir el overlay de silencio con botón "CLIC PARA SONIDO" (toggle mute funcional).
- Incluir texto izquierdo: subtítulo "Demo en acción", título "Mira cómo suena [Nombre Plugin]", descripción de qué resuelve el plugin.

#### 1.4 — Sección de Características / Descripción Larga
Solicitar al usuario los bullets o párrafos de:
- ¿Qué hace el plugin?
- ¿Para qué tipo de mezcla o master está pensado?
- ¿Con qué DAWs es compatible? (FL Studio, Ableton, Logic Pro, etc.)

#### 1.5 — Sección de Precios y Métodos de Pago
Precio default: **$5 USD — Pago Único De Por Vida**

**Botones de pago — todos los links deben usar el nombre EXACTO del plugin nuevo:**

| Método | Color | Link WA (personalizar nombre) |
|--------|-------|-------------------------------|
| PayPal | (via SDK) | `plugin-paypal-button-container` |
| Mercado Pago | `#009EE3` | `https://wa.me/[WA]?text=Hola,%20quiero%20comprar%20el%20plugin%20[NOMBRE_URLENCODED]%20por%20Mercado%20Pago` |
| Yape | `#742284` | `https://wa.me/[WA]?text=Hola,%20quiero%20comprar%20el%20plugin%20[NOMBRE_URLENCODED]%20por%20Yape` |
| Binance | `#F0B90B` | `https://wa.me/[WA]?text=Hola,%20quiero%20pagar%20con%20Binance%20el%20plugin%20[NOMBRE_URLENCODED]` |
| Otros Medios | Glassmorphism blanco | `https://wa.me/[WA]?text=Hola,%20quiero%20el%20plugin%20de%20[NOMBRE_URLENCODED]` |

> ⚠️ **CRÍTICO:** El `text=` de cada link WA debe contener el nombre exacto del plugin nuevo (URL-encoded). Nunca dejar el nombre de Inka Kola u otro plugin anterior.

#### 1.6 — Sección de Descarga (tras login)
```html
<!-- Windows -->
<a href="https://drive.google.com/file/d/[ID_WINDOWS]/view?usp=sharing" ...>
  <i class="fa-brands fa-windows"></i> Descargar para Windows (.exe)
</a>

<!-- macOS -->
<a href="https://drive.google.com/file/d/[ID_MAC]/view?usp=sharing" ...>
  <i class="fa-brands fa-apple"></i> Descargar para macOS
</a>
```
> Siempre en modo `/view?usp=sharing`. NUNCA usar el link de descarga directa de Drive.

#### 1.7 — Sección de Login / Auth Wall
- Redirigir a `/pages/login.html?redirect=/plugins/[slug]`
- Sección `ui-auth-wall` y `ui-serial-ready` configuradas con el slug correcto.

#### 1.8 — FAQ Section
Solicitar al usuario preguntas frecuentes del plugin o reutilizar las genéricas de compatibilidad con DAWs.

---

### PASO 2: Interfaz HTML/JS del Plugin (`Resources/index.html`)

#### 2.1 — Constantes del Plugin al Inicio del JS
```javascript
const PLUGIN_NAME = '[Nombre Plugin]';          // ej: 'INKA KOLA'
const PLUGIN_SLUG = '[slug]';                   // ej: 'inka-kola'
const PLUGIN_PREFIX = '[PREFIX]';               // ej: 'INKA'
const PLUGIN_LANDING_URL = 'https://offszn.lat/plugins/[slug].html';
```

#### 2.2 — Modales Estandarizados
- **Modal Inicial:** "Ingresa tu Serial Key" + Input placeholder `[PREFIX]-XXXX-YYYY-ZZZZ` + `ACTIVAR PLUGIN` + `CONSIGUE TU LICENCIA →`
- **Modal Expirado:** Candado 🔒 + "PRUEBA EXPIRADA" + mensaje personalizado con nombre del plugin + `ACTIVAR NUEVA LICENCIA` + `CONSIGUE TU LICENCIA →`
- ⛔ **NUNCA incluir "Contactar Soporte"** en ningún modal.

#### 2.3 — Función `openExternalURL` (Siempre igual)
```javascript
function openExternalURL(url) {
    if (hasJuceBridge()) {
        callNative('openURLNative', url); // NUNCA pasar como array [url]
    } else {
        window.open(url, '_blank');
    }
}
```

#### 2.4 — Persistencia de Parámetros
- Al cargar JS, enviar `callNative('setParam', 'ui-ready', 1)`.
- C++ responde con `sendAllParamsToUI()` enviando todos los parámetros del APVTS.
- JS ejecuta `applyUIParams(res)` para restaurar knobs, faders y porcentajes.
- Como respaldo: ejecutar `callNative('getParams')` con `.then(applyUIParams)`.

---

### PASO 3: Sistema de Licencias y Anti-Abuso (Supabase)

#### Formato de Seriales
- `[PREFIX]-FULL-XXXX-XXXX` → Lifetime. Offline trust total tras primera activación.
- `[PREFIX]-TRIAL-XXXX-XXXX` → 7 días. Verificación online silenciosa cada sesión.

#### Verificación de Trials
- Llamar a `/api/plugin/activate` con `{ serial_key, hwid, plugin_name }`.
- Si `success: true` → mostrar badge "PRUEBA: X DÍAS".
- Si expirado / bloqueado por Scavenger → mostrar Modal Expirado (Hard-Lock).

#### Insertar Licencias en Supabase
```js
await sb.from('plugin_licenses').insert({
  serial_key: '[PREFIX]-FULL-XXXX-XXXX',
  license_type: 'lifetime',
  status: 'active',
  max_devices: 2,
  expires_at: null,
  plugin_name: '[Nombre Plugin]'
});
```

---

### PASO 4: C++ JUCE y CMake

#### CMakeLists.txt
```cmake
juce_add_plugin(${PROJECT_NAME}
    COMPANY_NAME "OFFSZN"
    PLUGIN_MANUFACTURER_CODE Ofsz
    PLUGIN_CODE XXXX  # Código único de 4 chars por plugin
    FORMATS VST3 AU Standalone
    PRODUCT_NAME "[Nombre Plugin]"
)
```

#### Copia de Recursos (Regla Crítica macOS)
```cmake
# ✅ Correcto para macOS (Contents/Resources/)
add_custom_command(TARGET ${PROJECT_NAME}_VST3 POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/Resources"
        "$<TARGET_FILE_DIR:${PROJECT_NAME}_VST3>/../Resources"
)

# ✅ Solo para Windows
if(WIN32)
    add_custom_command(TARGET ${PROJECT_NAME}_VST3 POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory
            "${CMAKE_CURRENT_SOURCE_DIR}/Resources"
            "$<TARGET_FILE_DIR:${PROJECT_NAME}_VST3>/../../Resources"
        COMMAND ${CMAKE_COMMAND} -E copy_directory
            "${CMAKE_CURRENT_SOURCE_DIR}/Resources"
            "$ENV{COMMONPROGRAMFILES}/VST3/[Nombre Plugin].vst3/Contents/Resources"
    )
endif()
```
> ⚠️ Nunca copiar a `../../Resources` en Mac → causa error `unsealed contents` en codesign (exit code 65).

#### Guardas de Plataforma en PluginEditor.cpp
```cpp
#if JUCE_WINDOWS
// WebView2 y rutas locales de desarrollo solo en Windows
auto options = juce::WebBrowserComponent::Options{}
    .withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
    .withNativeIntegrationEnabled()
    .withWinWebView2Options(...);
#else
auto options = juce::WebBrowserComponent::Options{}
    .withNativeIntegrationEnabled();
#endif
```

#### findResourceDir() — orden de prioridad
```cpp
juce::File candidate;
#if JUCE_WINDOWS
candidate = juce::File("D:\\ruta\\local\\Resources");  // dev fallback
if (candidate.isDirectory() && ...) return candidate;
#endif
// luego rutas relativas al bundle (cross-platform)
candidate = exe.getParentDirectory().getParentDirectory().getParentDirectory().getChildFile("Resources");
// ...
```

---

### PASO 5: Compilación y Publicación (ÚLTIMO PASO)

1. **Windows:** `cmake --build build --config Release` → Inno Setup (`ISCC.exe InkaKola_Installer.iss`) → `.exe` en Escritorio.
2. **macOS:** `git add . && git commit -m "RELEASE [Nombre Plugin] vX.X.X" && git push origin main` → GitHub Action `build_mac.yml` genera `.pkg` (VST3 + AU + Standalone).
3. **Update Landing:** Pegar los IDs de Google Drive (`/view?usp=sharing`) en los botones de Windows y macOS de la landing page.
4. **Deploy:** `git push origin main` en el repo OFFSZN.

---

## ✅ Checklist Pre-Lanzamiento

- [ ] Inputs completos: nombre, slug, prefijo, hero image, video, descripciones, precio, WA number.
- [ ] Hero image (`/plugins/<slug>.png`) subido al repo OFFSZN.
- [ ] Video demo (`/plugins/<slug>.mp4`) subido al repo OFFSZN.
- [ ] Landing page con todos los links WA usando el nombre del plugin NUEVO (no de otro anterior).
- [ ] Botones de descarga con links de Google Drive en modo `/view?usp=sharing`.
- [ ] Modal inicial: "Ingresa tu Serial Key" funcional con botón "CONSIGUE TU LICENCIA →" abriendo el navegador.
- [ ] Modal expirado: sin botón de soporte, con "CONSIGUE TU LICENCIA →" funcional.
- [ ] `openExternalURL` pasa URL como string directo (no array).
- [ ] `applyUIParams` restaura todos los controles al reabrir el plugin en el DAW.
- [ ] `CMakeLists.txt` con `FORMATS VST3 AU Standalone` y copia de recursos solo a `Contents/Resources/` en Mac.
- [ ] Build Windows compilado sin errores.
- [ ] GitHub Action para Mac completada sin errores de codesign.
- [ ] Links de descarga finales actualizados en la landing page y publicados.

---

## Manejo de errores y correcciones

- Si el usuario no ha subido la imagen o el video: **detener el flujo y solicitarlos explícitamente**.
- Si los WA links contienen el nombre de otro plugin: **reemplazarlos todos** antes de continuar.
- Si el GitHub Action falla con `unsealed contents`: revisar que la copia de Resources vaya a `../Resources` (no `../../Resources`) en el target de macOS en CMakeLists.txt.
- Si `openExternalURL` no abre el navegador: verificar que `callNative('openURLNative', url)` recibe un string y no un array.
