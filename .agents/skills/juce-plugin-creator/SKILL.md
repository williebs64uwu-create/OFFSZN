---
name: juce-plugin-creator
description: Workflow completo, arquitectura de seguridad, estandares DAW, CMake e instaladores para crear, compilar y distribuir plugins VST3/AU de OFFSZN (Easy Mix, Easy Master, Inka Kola, Vocal Preset, Easy Pitch, etc.). Easy Mix es el gold standard.
---

# OFFSZN JUCE VST3/AU Plugin Creator — Guia Maestra

> **Referencia Gold Standard:** **Easy Mix** es el plugin de referencia. Todo plugin nuevo debe igualar o superar su arquitectura de seguridad, UX y calidad de DSP.
>
> **Skill activo:** `.agents/skills/juce-plugin-creator/SKILL.md`
> **Skill legado obsoleto:** `.agent/skills/production/crear-plugin-offszn/SKILL.md` (fusionado aqui — usar este)

---

## Inputs Necesarios (Solicitar TODOS antes de iniciar)

| # | Input | Ejemplo |
|---|-------|---------|
| 1 | Nombre del plugin | `Inka Kola`, `Easy Master`, `Easy Mix` |
| 2 | Slug / nombre de archivo | `inka-kola`, `easy-master`, `easy-mix` |
| 3 | Prefijo de seriales | `INKA-`, `EMASTER-`, `EMIX-` |
| 4 | Codigo de producto (4 chars) | `Esym`, `Voca`, `Vpst`, `Espt` |
| 5 | Nombre de carpeta GUI | `EasyMixGui`, `InkaKolaGui`, `VocalPresetGui` |
| 6 | Titulo del Hero | `INKA KOLA PLUGIN` |
| 7 | Subtitulo del Hero | `Masterizar canciones tan facil como tomarse una Inka Kola` |
| 8 | Descripcion corta (meta/og) | 1-2 oraciones sobre el resultado de audio |
| 9 | Caracteristicas / bullets DSP | Funciones, perillas, compatibilidad con DAWs |
| 10 | Imagen del Hero | `/plugins/<slug>.png` — Mockup 3D |
| 11 | Video Demo | `/plugins/<slug>.mp4` |
| 12 | Precio de lanzamiento | `$5` USD (default de por vida) |
| 13 | WhatsApp de contacto | `51993525005` (default OFFSZN) |
| 14 | Enlace Windows .exe | Google Drive `/view?usp=sharing` |
| 15 | Enlace macOS .pkg | Google Drive `/view?usp=sharing` |

---

## Ciclo de Vida End-to-End

```
Phase 1: Brainstorming y DSP Architecture
    ↓
Phase 2: GUI Mockup Local (mockup.html)
    ↓
Phase 3: JUCE 8 C++ DSP y DAW Stability Engine
    ↓
Phase 4: Multi-Layer Anti-Abuse Licensing
    ↓
Phase 5: CMake + Instaladores (Windows .exe / macOS .pkg)
    ↓
Phase 6: Landing Page y Checkout (Yape / Mercado Pago)
```

---

## Phase 1: Brainstorming y DSP Architecture

1. Define nombre, brand, codigo de producto (4 chars), manufacturer code `Ofsz`.
2. Lista parametros automatizables, valores default, skew curves y unidades (dB, Hz, ms, %).
3. Elige tier de licencia:
   - **Free/Gift** → sin serial, DSP siempre activo.
   - **Commercial** → activacion online + `.settings` tamper-resistant.
   - **Trial** → `PREFIX-TRIAL-XXXX-XXXX` con expiracion 72h + anti-reloj.

---

## Phase 2: GUI Local Architecture (mockup.html)

### REGLA DE ORO — NO SPAMEAR EL SERVIDOR

- **NUNCA** llamar `/api/plugin/activate` en cada arranque del plugin.
- Al iniciar: `callNative("getLicenseState")` → C++ valida localmente.
- Si `isValid == true`: confiar en C++, calcular dias restantes localmente, mostrar badge.
- **Solo fetch online cuando:** (a) usuario ingresa clave nueva, o (b) C++ devuelve `isValid == false`.
- Auditoria periodica silenciosa cada 5 horas — nunca bloquear audio ni UI.

### Carga Local (Offline-First)

```
%AppData%\OFFSZN\<PluginGuiFolder>\mockup.html  ← Carga principal
    Si no existe → fallback: https://offszn.lat/plugins/<slug>?v=5
```

### Constantes Globales al Inicio del HTML

```javascript
const PLUGIN_NAME    = '<Nombre Plugin>';
const PLUGIN_SLUG    = '<slug>';
const PLUGIN_PREFIX  = '<PREFIX>';
const PLUGIN_LANDING_URL = 'https://offszn.lat/plugins/<slug>.html';
const apiBase        = 'https://offszn.lat';
var   LICENSE_CHECK_INTERVAL_MS = 18000000; // 5 horas en ms
```

### CSS Anti-Resize y Anti-Zoom (Obligatorio)

```css
html, body {
  width: 100vw; height: 100vh;
  margin: 0; padding: 0;
  overflow: hidden;
  user-select: none; -webkit-user-select: none;
  background: #0a0a0a;
  font-family: 'Geist', 'Inter', sans-serif;
}
body { -webkit-touch-callout: none; }
```

```javascript
document.addEventListener('wheel', function(e) {
    if (e.ctrlKey) { e.preventDefault(); }
}, { passive: false });
```

### Modales Estandarizados

- **Modal Activacion:** "Ingresa tu Serial Key" + `ACTIVAR PLUGIN` + `CONSIGUE TU LICENCIA`
- **Modal Expirado:** Candado + "PRUEBA EXPIRADA" + `ACTIVAR NUEVA LICENCIA` + `CONSIGUE TU LICENCIA`
  - SIN boton de soporte. Sin boton de cerrar (hard-lock).

### Badge de Licencia

- `PRUEBA · X DIAS` → amber
- `FULL · OFFSZN` → green
- `DEMO · ACTIVAR` → red

### Startup Flow Correcto (Offline-First)

```javascript
callNative("getLicenseState").then(function(state) {
  var isValid   = state && state.isValid;
  var rawSerial = (state && state.serial || "").trim();
  if (rawSerial) {
    var isTrial = rawSerial.toUpperCase().indexOf("TRIAL-") !== -1;
    if (isTrial) {
      if (isValid) {
        var tokens      = rawSerial.split("|");
        var trialSerial = tokens[0];
        var expiresUnix = tokens.length > 1 ? parseInt(tokens[1], 10) : 0;
        if (expiresUnix > 0) {
          var daysLeft = Math.ceil((expiresUnix - Math.floor(Date.now() / 1000)) / 86400);
          updateTrialBadge(true, daysLeft > 1 ? daysLeft + " DIAS" : "ULTIMO DIA");
        } else { updateTrialBadge(true, "3 DIAS"); }
        // Background check — seguro offline (fire and forget)
        getHwidAsync().then(function(hwid) {
          fetch(apiBase + "/api/plugin/activate", {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({ serial_key: trialSerial, hwid: hwid || getOrCreateDeviceId(), plugin_name: PLUGIN_NAME })
          }).then(function(r){ return r.json(); }).then(function(resp){
            if (resp && !resp.success) triggerLicenseExpired("Prueba Expirada", resp.error);
          }).catch(function(err){ console.log("[Trial] Offline:", err); });
        });
        setInterval(performPeriodicLicenseAudit, LICENSE_CHECK_INTERVAL_MS);
      } else {
        triggerLicenseExpired("Prueba Expirada", "Tu periodo de prueba ha expirado.");
      }
    } else {
      // Licencia FULL: 100% offline para siempre
      if (isValid) { updateTrialBadge(false); }
      else { callNative("setLicenseStatus", false); openActivationModal(false); }
    }
  } else {
    openTrialOrActivationModal();
  }
});
```

### Auditoria Periodica Silenciosa (5 horas)

```javascript
function performPeriodicLicenseAudit() {
  callNative("getLicenseState").then(function(state) {
    if (!state || !state.isValid) {
      triggerLicenseExpired("Licencia Invalida", "La validacion de tu licencia fallo."); return;
    }
    var rawSerial = (state.serial || "").trim();
    if (rawSerial.toUpperCase().indexOf("TRIAL-") === -1) return; // FULL = sin re-validacion
    var tokens = rawSerial.split("|");
    var trialSerial = tokens[0];
    var expiresUnix = tokens.length > 1 ? parseInt(tokens[1], 10) : 0;
    if (expiresUnix > 0 && Math.floor(Date.now() / 1000) >= expiresUnix) {
      callNative("setLicenseStatus", false);
      triggerLicenseExpired("Prueba Expirada", "Tu periodo de prueba ha expirado."); return;
    }
    getHwidAsync().then(function(hwid) {
      fetch(apiBase + "/api/plugin/activate", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ serial_key: trialSerial, hwid: hwid || getOrCreateDeviceId(), plugin_name: PLUGIN_NAME })
      }).then(function(r){ return r.json(); }).then(function(resp){
        if (resp && !resp.success) { callNative("setLicenseStatus", false); triggerLicenseExpired("Prueba Revocada", resp.error); }
      }).catch(function(err){ console.log("[Audit] Offline — manteniendo estado local:", err); });
    });
  });
}
```

### Trial Local Fallback (Solo desde catch de red)

```javascript
// ADVERTENCIA: SOLO llamar desde catch de error de red — NUNCA desde boton de UI
function startLocalTrialFallback() {
  var rand  = Math.random().toString(36).substring(2, 10).toUpperCase();
  var now   = Math.floor(Date.now() / 1000);
  var exp   = now + (3 * 86400);
  var key   = PLUGIN_PREFIX + "-TRIAL-" + rand;
  var full  = key + "|" + exp + "|" + now;
  try { localStorage.setItem("offszn_serial", key); } catch(e) {}
  callNative("setLicenseStatus", true, full);
  updateLicenseBadge("trial", "PRUEBA 3 DIAS");
  closeActivationModal();
  setInterval(performPeriodicLicenseAudit, LICENSE_CHECK_INTERVAL_MS);
}
```

### knobRegistry — Registro Modular de Controles

```javascript
var knobRegistry = {};
function registerKnob(id, element, onChange) {
    knobRegistry[id] = { element: element, setValue: function(val) { updateKnobVisual(element, val); }, onChange: onChange };
}
// Persistencia mediante applyUIParams en el evento ui-ready
```

---

## Phase 3: JUCE 8 C++ DSP y DAW Stability Standards

### Reglas Obligatorias Anti-Crash DAW

| Problema | Causa Raiz | Fix |
|---|---|---|
| COM Threading | Ableton/Cubase abren GUIs VST3 en threads no-COM → WebView2 crashea DAW | `CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED)` al inicio del constructor Editor |
| Multi-Instance File Lock | Cache WebView2 compartida → colision SQLite .lock | Carpeta aislada `AppData/Roaming/OFFSZN/<PluginName>WV2` |
| Use-After-Free | Apertura/cierre rapido con async pendiente → puntero `this` colgante | `SafePointer<MyEditor> safeThis(this); if (safeThis == nullptr) return;` |
| Destructor Timer | Timer 30Hz en WebView null al destruir | `stopTimer(); webComponent = nullptr;` en destructor |
| Mono Track Crash | Rechazar mono en isBusesLayoutSupported | Permitir mono y stereo si mainOutput == mainInput |
| Denormal Floats | Fracciones flotantes infinitas en IIR/reverb → CPU 100% | `juce::ScopedNoDenormals noDenormals;` al inicio de processBlock |

### Boilerplate PluginEditor.cpp

```cpp
#include "PluginProcessor.h"
#include "PluginEditor.h"
#if JUCE_WINDOWS
 #include <objbase.h>
#endif

MyAudioProcessorEditor::MyAudioProcessorEditor(MyAudioProcessor& p)
    : AudioProcessorEditor(&p), audioProcessor(p)
{
#if JUCE_WINDOWS
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    juce::File wv2Folder = juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
        .getChildFile("OFFSZN").getChildFile("<PluginName>WV2");
    wv2Folder.createDirectory();
    auto options = juce::WebBrowserComponent::Options{}
        .withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
        .withNativeIntegrationEnabled()
        .withWinWebView2Options(juce::WebBrowserComponent::Options::WinWebView2{}
            .withUserDataFolder(wv2Folder).withStatusBarDisabled().withBuiltInErrorPageDisabled())
#else
    auto options = juce::WebBrowserComponent::Options{}.withNativeIntegrationEnabled()
#endif
        .withNativeFunction("getLicenseState", [this](const juce::Array<juce::var>&, auto complete) {
            auto obj = std::make_unique<juce::DynamicObject>();
            obj->setProperty("isValid", (bool)audioProcessor.isLicenseValid.load());
            obj->setProperty("serial",  audioProcessor.getStoredSerial());
            complete(juce::var(obj.release()));
        })
        .withNativeFunction("setLicenseStatus", [this](const juce::Array<juce::var>& args, auto complete) {
            bool valid = args.size() > 0 ? (bool)args[0] : false;
            juce::String serial = args.size() > 1 ? args[1].toString() : "";
            juce::Component::SafePointer<MyAudioProcessorEditor> safeThis(this);
            juce::MessageManager::callAsync([safeThis, valid, serial] {
                if (safeThis == nullptr) return;
                safeThis->audioProcessor.setLicenseFromUI(valid, serial);
            });
            complete(juce::var());
        })
        .withNativeFunction("setParam", [this](const juce::Array<juce::var>& args, auto complete) {
            if (args.size() >= 2) {
                juce::String id = args[0].toString(); float val = (float)args[1];
                juce::Component::SafePointer<MyAudioProcessorEditor> safeThis(this);
                juce::MessageManager::callAsync([safeThis, id, val] {
                    if (safeThis == nullptr) return;
                    safeThis->audioProcessor.setParamFromUI(id, val);
                });
            }
            complete(juce::var());
        })
        .withNativeFunction("openExternalURL", [](const juce::Array<juce::var>& args, auto complete) {
            if (args.size() > 0) juce::URL(args[0].toString()).launchInDefaultBrowser();
            complete(juce::var());
        });

    webComponent = std::make_unique<MyWebBrowser>(options);
    juce::File guiFile = juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
        .getChildFile("OFFSZN").getChildFile("<PluginName>Gui").getChildFile("mockup.html");
    webComponent->goToURL(guiFile.existsAsFile()
        ? "file:///" + guiFile.getFullPathName().replaceCharacter('\\', '/')
        : "https://offszn.lat/plugins/<slug>?v=5");
    addAndMakeVisible(*webComponent);
    setSize(1000, 530);
    setResizable(true, true);
    setResizeLimits(480, 420, 1400, 1000);
    startTimerHz(30);
}

MyAudioProcessorEditor::~MyAudioProcessorEditor() {
    stopTimer();
    webComponent = nullptr;
}
```

### Universal Bus Layout (Mono + Stereo)

```cpp
bool MyAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const {
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
     && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;
    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet()) return false;
    return true;
}
```

---

## Phase 4: Multi-Layer Anti-Abuse Licensing

**Filosofia:** Nunca confiar en JavaScript del lado cliente. C++ es la unica puerta de autorizacion.

**Reglas Core:**

1. Primera activacion requiere internet → rechazar activaciones offline sin verificar.
2. Ejecucion offline permanente una vez activado → C++ lee `.settings` localmente.
3. Deteccion anti-tamper de reloj → si `now < lastCheck - 3600`, revocar.
4. El instalador **NUNCA** sobreescribe `.settings` → datos del usuario preservados.
5. DSP gate → `if (!isLicenseValid.load()) { buffer.clear(); return; }`
6. Auditoria 5h silenciosa → `setInterval(performPeriodicLicenseAudit, 18000000)`. Offline → safe fallback.
7. `startLocalTrialFallback()` solo desde bloque `catch` de red.

### C++ Anti-Tamper y Settings Verification

```cpp
void MyAudioProcessor::loadLicenseFromSettings() {
    juce::File settingsFile = juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
        .getChildFile("OFFSZN").getChildFile("<Plugin>.settings");
    if (settingsFile.existsAsFile()) {
        juce::String content = settingsFile.loadFileAsString().trim();
        if (content.startsWith("<PREFIX>-FULL-")) {
            isLicenseValid.store(true); storedSerial = content;
        } else if (content.startsWith("<PREFIX>-TRIAL-")) {
            auto tokens = juce::StringArray::fromTokens(content, "|", "");
            int64_t expiresAt = tokens.size() > 1 ? tokens[1].getLargeIntValue() : 0;
            int64_t lastCheck = tokens.size() > 2 ? tokens[2].getLargeIntValue() : 0;
            int64_t now = juce::Time::currentTimeMillis() / 1000;
            if (expiresAt > 0 && now >= expiresAt) {
                isLicenseValid.store(false); // Expirado
            } else if (lastCheck > 0 && now < (lastCheck - 3600)) {
                isLicenseValid.store(false); // Reloj manipulado
            } else {
                isLicenseValid.store(true);
                if (expiresAt > 0)
                    settingsFile.replaceWithText(tokens[0] + "|" + juce::String(expiresAt) + "|" + juce::String(now));
                storedSerial = content;
            }
        }
    }
}
```

### DSP Bypass Gate

```cpp
void MyAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer&) {
    juce::ScopedNoDenormals noDenormals;
    for (auto i = getTotalNumInputChannels(); i < getTotalNumOutputChannels(); ++i)
        buffer.clear(i, 0, buffer.getNumSamples());
    if (!isLicenseValid.load()) return; // License gate
    // ... DSP real aqui ...
}
```

### Servidor — POST /api/plugin/activate

```javascript
router.post('/api/plugin/activate', async (req, res) => {
  const { serial_key, hwid, plugin_name } = req.body;
  if (!serial_key || !hwid || !plugin_name)
    return res.json({ success: false, error: 'Campos requeridos faltantes.' });
  const { data: license } = await supabase.from('plugin_licenses')
    .select('*').eq('serial_key', serial_key.trim().toUpperCase()).single();
  if (!license) return res.json({ success: false, error: 'Serial no encontrado.' });
  if (license.hwid && license.hwid !== hwid)
    return res.json({ success: false, error: 'Licencia vinculada a otro dispositivo.' });
  if (serial_key.includes('-TRIAL-') && license.expires_at)
    if (Math.floor(Date.now() / 1000) >= license.expires_at)
      return res.json({ success: false, error: 'Prueba expirada.' });
  if (!license.hwid)
    await supabase.from('plugin_licenses')
      .update({ hwid, activated_at: new Date().toISOString() }).eq('id', license.id);
  res.json({ success: true, license_type: license.type, expires_at: license.expires_at });
});
```

### Servidor — POST /api/plugin/request-trial

```javascript
router.post('/api/plugin/request-trial', async (req, res) => {
  const { hwid, plugin_name, plugin_prefix } = req.body;
  const { data: existing } = await supabase.from('plugin_licenses')
    .select('id').eq('hwid', hwid).eq('plugin_name', plugin_name).single();
  if (existing) return res.json({ success: false, error: 'Ya tienes una prueba activa.' });
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  const serial = `${plugin_prefix}-TRIAL-${rand}`;
  const nowUnix = Math.floor(Date.now() / 1000);
  const expiresUnix = nowUnix + (72 * 3600);
  await supabase.from('plugin_licenses').insert({
    serial_key: serial, plugin_name, hwid, type: 'trial',
    expires_at: expiresUnix, created_at: new Date().toISOString()
  });
  res.json({ success: true, serial: `${serial}|${expiresUnix}|${nowUnix}`, expires_at: expiresUnix });
});
```

**Supabase `plugin_licenses` campos:** `serial_key` (TEXT PK), `plugin_name`, `hwid` (nullable), `type` (`full`|`trial`), `expires_at` (INT8 Unix, null para FULL), `activated_at`, `max_devices: 2`.

---

## Phase 5: CMake + Instaladores Windows y macOS

### CMakeLists.txt — Template Estandar

```cmake
cmake_minimum_required(VERSION 3.22)
project(PLUGIN_UPPER VERSION 1.0.0)

if(APPLE)
    set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "Minimum macOS version")
    set(CMAKE_OSX_ARCHITECTURES "arm64;x86_64" CACHE STRING "Universal Binary")
endif()

# Localizacion JUCE: env var tiene prioridad (para GitHub Actions)
if(DEFINED ENV{JUCE_DIR})
    set(JUCE_DIR "$ENV{JUCE_DIR}")
elseif(EXISTS "C:/Users/Willie/Downloads/juce-8.0.13-windows/JUCE/CMakeLists.txt")
    set(JUCE_DIR "C:/Users/Willie/Downloads/juce-8.0.13-windows/JUCE")
elseif(EXISTS "C:/Users/Willie/Downloads/JUCE/CMakeLists.txt")
    set(JUCE_DIR "C:/Users/Willie/Downloads/JUCE")
elseif(APPLE)
    set(JUCE_DIR "/opt/homebrew/share/JUCE")
else()
    set(JUCE_DIR "C:/Users/Willie/Downloads/JUCE")
endif()

if(EXISTS ${JUCE_DIR}/CMakeLists.txt)
    add_subdirectory(${JUCE_DIR} ${CMAKE_BINARY_DIR}/JUCE)
else()
    message(FATAL_ERROR "JUCE no encontrado en ${JUCE_DIR}. Define JUCE_DIR.")
endif()

# Formatos por plataforma
if(APPLE)
    set(PLUGIN_FORMATS VST3 AU Standalone)
    set(EXTRA_PLUGIN_OPTIONS "")
else()
    set(PLUGIN_FORMATS VST3 Standalone)
    set(EXTRA_PLUGIN_OPTIONS NEEDS_WEBVIEW2 TRUE)
endif()

juce_add_plugin(PLUGIN_TARGET
    COMPANY_NAME "OFFSZN"
    BUNDLE_ID "com.offszn.bundleid"
    PLUGIN_MANUFACTURER_CODE Ofsz
    PLUGIN_CODE XXXX
    FORMATS ${PLUGIN_FORMATS}
    PRODUCT_NAME "Plugin Display Name"
    IS_SYNTH FALSE NEEDS_MIDI_INPUT FALSE NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    COPY_PLUGIN_AFTER_BUILD FALSE
    ${EXTRA_PLUGIN_OPTIONS}
)

juce_generate_juce_header(PLUGIN_TARGET)

target_sources(PLUGIN_TARGET PRIVATE
    Source/PluginProcessor.cpp Source/PluginProcessor.h
    Source/PluginEditor.cpp   Source/PluginEditor.h
    # ... fuentes DSP adicionales ...
)

target_link_libraries(PLUGIN_TARGET
    PRIVATE juce::juce_audio_utils juce::juce_gui_extra juce::juce_dsp
    PUBLIC  juce::juce_recommended_config_flags juce::juce_recommended_lto_flags
)

target_compile_definitions(PLUGIN_TARGET PUBLIC
    JUCE_WEB_BROWSER=1 JUCE_USE_CURL=0 JUCE_VST3_CAN_REPLACE_VST2=0 JUCE_DISPLAY_SPLASH_SCREEN=0
)
if(WIN32)
    target_compile_definitions(PLUGIN_TARGET PUBLIC JUCE_USE_WIN_WEBVIEW2=1)
endif()

# Windows dev: copiar mockup.html junto al Standalone
if(WIN32)
    add_custom_command(TARGET PLUGIN_TARGET_Standalone POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${CMAKE_SOURCE_DIR}/mockup.html"
            "$<TARGET_FILE_DIR:PLUGIN_TARGET_Standalone>/mockup.html"
        COMMENT "Copiando mockup.html..."
    )
endif()

# CRITICO macOS: Copiar DENTRO del bundle a Contents/Resources/ (../Resources)
# NUNCA a la raiz del bundle (../../Resources) — causa "unsealed contents" exit code 65
if(APPLE)
    add_custom_command(TARGET PLUGIN_TARGET_VST3 POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${CMAKE_SOURCE_DIR}/mockup.html"
            "$<TARGET_FILE_DIR:PLUGIN_TARGET_VST3>/../Resources/mockup.html"
        COMMENT "Copiando mockup.html a Contents/Resources..."
    )
endif()
```

### Windows — Build y PLUGIN.iss (Inno Setup)

**Comandos build:**
```powershell
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" "PLUGIN.iss"
```

**CRITICO:** `DefaultDirName` DEBE ser `{autopf}\OFFSZN\Plugin Name`. NUNCA `{commoncf}\VST3\PLUGIN.vst3`. Escribir el desinstalador dentro del bundle .vst3 causa Error 11 en el DAW.

```ini
[Setup]
AppId={{UNIQUE-GUID-HERE}}
AppName=OFFSZN PLUGIN_NAME VST3
AppVersion=X.X.X
DefaultDirName={autopf}\OFFSZN\Plugin Display Name
DefaultGroupName=OFFSZN
DisableDirPage=yes
OutputBaseFilename=OFFSZN_PLUGIN_NAME_Setup
OutputDir=.\Output
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
WizardStyle=modern

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "build\TARGET_artefacts\Release\VST3\PLUGIN_NAME.vst3\*"; DestDir: "{commoncf}\VST3\PLUGIN_NAME.vst3"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "mockup.html"; DestDir: "{userappdata}\OFFSZN\PluginGuiFolder"; Flags: replacesameversion uninsneveruninstall

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var bundlePath: String;
begin
  if CurStep = ssInstall then begin
    bundlePath := ExpandConstant('{commoncf}\VST3\PLUGIN_NAME.vst3');
    DeleteFile(bundlePath + '\unins000.exe'); DeleteFile(bundlePath + '\unins000.dat');
    DeleteFile(bundlePath + '\unins001.exe'); DeleteFile(bundlePath + '\unins001.dat');
    DelTree(bundlePath + '\PLUGIN_NAME.vst3', True, True, True);
    DelTree(ExpandConstant('{commoncf}\VST3\Plugin Display Name.vst3'), True, True, True);
  end;
end;
function InitializeSetup(): Boolean;
begin
  MsgBox('Antes de continuar, cierra todos los DAWs (FL Studio, Ableton, Reaper, Cubase).', mbInformation, MB_OK);
  Result := True;
end;

[UninstallDelete]
Type: filesandordirs; Name: "{commoncf}\VST3\PLUGIN_NAME.vst3"
```

### macOS — Script plugin_build_mac_installer.sh

```bash
#!/bin/bash
set -e
PROJECT_NAME="PLUGIN_UPPER"
DISPLAY_NAME="Plugin Display Name"
GUI_FOLDER="PluginNameGui"
VERSION="1.0.0"
LOWER_PROJECT_NAME=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]')
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$SCRIPT_DIR/plugins/<slug>"

if [ -z "$JUCE_DIR" ]; then
    [ -d "$SCRIPT_DIR/JUCE" ] && export JUCE_DIR="$SCRIPT_DIR/JUCE"
    [ -d "/opt/homebrew/share/JUCE" ] && export JUCE_DIR="/opt/homebrew/share/JUCE"
fi

cd "$PLUGIN_DIR"
mkdir -p build_mac && cd build_mac
cmake -G "Xcode" -DCMAKE_OSX_DEPLOYMENT_TARGET="11.0" -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" ..
cmake --build . --config Release --parallel 4
cd "$PLUGIN_DIR"

INSTALLER_DIR="$PLUGIN_DIR/MacInstaller"
ROOT_DIR="$INSTALLER_DIR/Root"
SCRIPTS_DIR="$INSTALLER_DIR/Scripts"
VST3_DIR="$ROOT_DIR/Library/Audio/Plug-Ins/VST3"
AU_DIR="$ROOT_DIR/Library/Audio/Plug-Ins/Components"
APP_DIR="$ROOT_DIR/Applications"
GUI_DIR="$ROOT_DIR/Library/Application Support/OFFSZN/$GUI_FOLDER"
rm -rf "$INSTALLER_DIR"
mkdir -p "$VST3_DIR" "$AU_DIR" "$APP_DIR" "$GUI_DIR" "$SCRIPTS_DIR"

# Copiar artefactos con fallback a find
if [ -d "build_mac/${PROJECT_NAME}_artefacts/Release/VST3/${PROJECT_NAME}.vst3" ]; then
    cp -R "build_mac/${PROJECT_NAME}_artefacts/Release/VST3/${PROJECT_NAME}.vst3" "$VST3_DIR/"
else
    find ./build_mac -name "*.vst3" -type d -exec cp -R {} "$VST3_DIR/" \; || true
fi
if [ -d "build_mac/${PROJECT_NAME}_artefacts/Release/AU/${PROJECT_NAME}.component" ]; then
    cp -R "build_mac/${PROJECT_NAME}_artefacts/Release/AU/${PROJECT_NAME}.component" "$AU_DIR/"
else
    find ./build_mac -name "*.component" -type d -exec cp -R {} "$AU_DIR/" \; || true
fi
find ./build_mac -name "*.app" -type d -exec cp -R {} "$APP_DIR/" \; || true

# Firma ad-hoc (Gatekeeper sin Developer ID)
codesign --force --deep -s - "$VST3_DIR/${PROJECT_NAME}.vst3" || true
codesign --force --deep -s - "$AU_DIR/${PROJECT_NAME}.component" || true
find "$APP_DIR" -name "*.app" -exec codesign --force --deep -s - {} \; || true

# GUI a Application Support (ruta de carga principal)
cp -f mockup.html "$GUI_DIR/mockup.html" || true

# postinstall: limpiar cuarentena Gatekeeper + forzar re-scan AU en Logic Pro
cat << 'POSTEOF' > "$SCRIPTS_DIR/postinstall"
#!/bin/bash
xattr -cr "/Library/Audio/Plug-Ins/VST3/PLUGIN_UPPER.vst3" 2>/dev/null || true
xattr -cr "/Library/Audio/Plug-Ins/Components/PLUGIN_UPPER.component" 2>/dev/null || true
chmod -R 755 "/Library/Audio/Plug-Ins/VST3/PLUGIN_UPPER.vst3" 2>/dev/null || true
chmod -R 755 "/Library/Audio/Plug-Ins/Components/PLUGIN_UPPER.component" 2>/dev/null || true
chmod -R 755 "/Library/Application Support/OFFSZN/PluginNameGui" 2>/dev/null || true
killall -9 AudioComponentRegistrar 2>/dev/null || true
exit 0
POSTEOF
chmod +x "$SCRIPTS_DIR/postinstall"

pkgbuild --root "$ROOT_DIR" --scripts "$SCRIPTS_DIR" \
         --identifier "com.offszn.${LOWER_PROJECT_NAME}" \
         --version "$VERSION" --install-location "/" \
         "$INSTALLER_DIR/${PROJECT_NAME}_Component.pkg"
productbuild --synthesize --package "$INSTALLER_DIR/${PROJECT_NAME}_Component.pkg" \
             "$INSTALLER_DIR/distribution.xml"
FINAL_PKG="$SCRIPT_DIR/${PROJECT_NAME}_Mac_Installer_v${VERSION}.pkg"
productbuild --distribution "$INSTALLER_DIR/distribution.xml" \
             --package-path "$INSTALLER_DIR" "$FINAL_PKG"
echo "Instalador macOS listo: $FINAL_PKG"
```

### GitHub Actions — .github/workflows/build_plugin_mac.yml

```yaml
name: Build macOS VST3, AU y Standalone (PLUGIN_NAME vX.X.X)
on:
  push:
    branches: [ main, master ]
    paths:
      - 'plugins/<slug>/**'
      - '<plugin>_build_mac_installer.sh'
      - '.github/workflows/build_<plugin>_mac.yml'
  workflow_dispatch:
jobs:
  build:
    runs-on: macos-14  # Apple Silicon (M1/M2), Xcode 15, CMake preinstalado
    steps:
      - uses: actions/checkout@v4
      - name: Clone JUCE 8.0.13
        run: git clone --depth 1 --branch 8.0.13 https://github.com/juce-framework/JUCE.git JUCE
      - name: Build
        env:
          JUCE_DIR: ${{ github.workspace }}/JUCE
        run: |
          sed -i '' 's/\r$//' <plugin>_build_mac_installer.sh
          chmod +x <plugin>_build_mac_installer.sh
          ./<plugin>_build_mac_installer.sh
      - uses: actions/upload-artifact@v4
        with:
          name: PLUGIN_NAME_Mac_Installer
          path: PLUGIN_NAME_Mac_Installer_vX.X.X.pkg
```

**IMPORTANTE codesign macOS:** mockup.html va UNICAMENTE a `Contents/Resources/` (`../Resources` desde `MacOS/`). Copiar a la raiz del bundle (`../../Resources`) provoca `unsealed contents` (exit code 65).

---

## Phase 6: Landing Page y Sales Architecture

### Estrategia Dual de Landing

1. **`/plugins/<slug>.html`** — Showcase organico: video, comparacion audio, trial, testimonios, pricing.
2. **`/plugin/<slug>.html`** — Directo para anuncios: ancla a `#pricing-section`, A/B precio, checkout inmediato.

### Design System (Referencia Easy Mix)

- Background: `#0a0a0a` → `#000000`
- Font: Google **Geist** `font-weight: 800`
- **CTA Principal: blanco puro `#ffffff` con texto negro `#000000`** — No botones de colores en UI dark.
- Barra de anuncio fija 40px (gradiente emerald).
- Navbar flotante: oculto en Hero → visible al scroll → oculto en `#pricing-section`.
- Hero: ambient mesh bg, h1 potente, CTA blanca, mockup 3D con glow.
- Marquee infinito 2 filas con testimonios y lightbox.
- Pricing doble columna: checks izquierda + card derecha (desktop), card primero (mobile).

### Botones de Pago WhatsApp (nombre EXACTO del plugin)

```
Mercado Pago: text=Hola,%20quiero%20comprar%20el%20plugin%20[NOMBRE_URLENCODED]%20por%20Mercado%20Pago
Yape:         text=Hola,%20quiero%20comprar%20el%20plugin%20[NOMBRE_URLENCODED]%20por%20Yape
Binance:      text=Hola,%20quiero%20pagar%20con%20Binance%20el%20plugin%20[NOMBRE_URLENCODED]
Otros Medios: text=Hola,%20quiero%20el%20plugin%20de%20[NOMBRE_URLENCODED]
```

### Yape / Mercado Pago Checkout

- **CRITICO:** Pasar `amount: pricePEN` a `mpInstance.yape()` — omitirlo causa `Invalid value for transaction_amount`.
- `installments: 1` y `payment_method_id: 'yape'` son obligatorios en el payload MP.
- Monto minimo: S/. 3.00.
- Al aprobar: generar serial FULL → registro Supabase → email de entrega → evento Meta CAPI Purchase.

### Platform Whitelist

```javascript
const isPlatformOrOwner = producerId === '0382a813-85c7-46c3-8d2c-61a5692adffd'
    || (producerNickname && producerNickname.toLowerCase().includes('willie'))
    || prodType === 'plugin';
```

### Video Streaming y CDN

- Siempre: `preload="auto"` + `autoplay muted loop playsinline controls`
- **NUNCA** `preload="none"` (causa pantalla negra en Safari mobile)
- Servidor: `Accept-Ranges: bytes` para HTTP 206 partial content
- CDN: `Cache-Control: public, max-age=86400, s-maxage=604800`
- Google Drive links siempre con `/view?usp=sharing`

### Vercel Bundle Guard

- Limite estricto: **<= 250 MB** Lambda sin comprimir.
- Sin duplicar videos: un solo `/plugins/<name>.mp4` canonico.
- Favicons `/plugins/*`: usar `/willieimages/favicon.ico` (Willie W). Todos los `.ico` con frames: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256.

---

## Arquitectura de Comandos de Voz (Vocal Preset)

Orden de prioridad en `processVoiceCommand(cmd)`:

1. Starter preset / mejora mi voz
2. Factory reset / limpiar
3. "Quitar X" (ANTES de bloques genericos del mismo FX)
4. Genre Presets: Trap, Reggaeton, Cumbia, Pop Radio, Indie/Rock, Balada/Soul
5. Mood Presets: Suave/Intima, Potente/Agresiva, Oscura, Brillante/Festival
6. Utility: guardar, silencio, en seco, en seco creativos
7. Navigation: ver efectos, volver, ir a mezcla
8. Undo / Redo
9. Effect recipes: reverb largo/corto, delay largo, ping pong, slapback, filtro, calor, lofi, stutter
10. Ajuste % general: target + sube/baja/al X%
11. AI Fallback: Groq llama-3.3-70b → JSON → apply

**AI Fallback Schema (Groq llama-3.3-70b-versatile):**
JSON keys: `reset`, `starterPreset`, `mixMacro`, `hpf`, `boxy`, `deesser`, `presMid`, `presHigh`, `sat`, `air`, `comp`, `doubler{on,amount}`, `chorus{on,amount}`, `delay{on,amount}`, `reverb{on,amount}`, `filtro{on,amount,mode}`, `calor{on,amount,profile}`, `lofi{on,amount,resolution}`, `stutter{on,amount,grid}`, `summary`.

---

## Checklist Pre-Lanzamiento

- [ ] Inputs solicitados y validados antes de empezar.
- [ ] `PLUGIN_NAME`, `PLUGIN_SLUG`, `PLUGIN_PREFIX`, `apiBase` definidos en el HTML.
- [ ] Assets `/plugins/<slug>.png` y `/plugins/<slug>.mp4` en su sitio.
- [ ] CSS anti-resize: `overflow: hidden`, `user-select: none`, `ctrlKey+wheel` prevent.
- [ ] `knobRegistry` y `applyUIParams` respondiendo al evento `ui-ready`.
- [ ] Startup Flow: `callNative("getLicenseState")` primero, fetch solo si `!isValid`.
- [ ] `startLocalTrialFallback()` solo en bloque `catch` de red.
- [ ] Auditoria 5h: `setInterval(performPeriodicLicenseAudit, 18000000)`.
- [ ] Modal expirado: hard-lock, sin boton de cerrar, sin boton de soporte.
- [ ] C++ anti-tamper: expiracion + anti-reloj + DSP gate en `processBlock`.
- [ ] `isBusesLayoutSupported` acepta mono Y stereo.
- [ ] `CoInitializeEx` en constructor Editor (Windows).
- [ ] `SafePointer` en todos los lambdas async de C++.
- [ ] `stopTimer(); webComponent = nullptr;` en destructor.
- [ ] CMakeLists.txt: `FORMATS VST3 AU Standalone` en mac, `VST3 Standalone` en win.
- [ ] CMakeLists.txt mac: copiar `mockup.html` a `../Resources` (NO `../../Resources`).
- [ ] `DefaultDirName={autopf}\OFFSZN\Plugin Name` en Inno Setup (NO dentro del .vst3).
- [ ] `[Code]` en .iss: limpia `unins000.*` y bundles anidados.
- [ ] Script mac: `postinstall` con `xattr -cr` + `killall AudioComponentRegistrar`.
- [ ] GitHub Action `macos-14` con `JUCE_DIR` como env var.
- [ ] Links WhatsApp con nombre exacto URL-encoded del plugin.
- [ ] Landing page publicada con links de Google Drive `/view?usp=sharing`.
- [ ] Supabase: `plugin_licenses` con `max_devices: 2`.
- [ ] Favicons correctos en paginas `/plugins/*`.
- [ ] Video con `preload="auto"` + `Accept-Ranges: bytes` en servidor.
