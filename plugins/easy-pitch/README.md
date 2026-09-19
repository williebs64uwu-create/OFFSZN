# EASY PITCH

Afinador vocal monofónico en tiempo real para voces principales. Desarrollado en C++ con JUCE 8 y WebView2.

---

## Características Principales

- **Afinación en Tiempo Real**: Algoritmo monofónico de baja latencia con seguimiento continuo de frecuencia fundamental (F0).
- **Selección de Tonalidad y Escala**:
  - 12 tonalidades cromáticas con nomenclatura dual (*C / Do*, *D / Re*, *E / Mi*, etc.).
  - Escalas *Mayor* y *Menor natural*.
  - Modo inicial *Elegir*: el audio pasa limpio y transparente con latencia compensada hasta seleccionar una tonalidad.
- **Controles Esenciales**:
  - **Rapidez** (0 - 100%): Velocidad de transición hacia la nota objetivo. 100% afinación marcada urbana/pop; 65% afinación moderna equilibrada; valores bajos para transiciones suaves y naturales.
  - **Cantidad** (0 - 100%): Grado de corrección aplicada hacia el objetivo. 0% sonido original alineado en fase; 100% corrección total.
- **Visualización en Vivo**:
  - Lectura en tiempo real de **Entrada** (nota detectada en la voz), **Objetivo** (nota hacia la que se afina) y **Ajuste** (cents aplicados con medidor visual dinámico).
- **Tratamiento Inteligente de Consonantes**:
  - Detección de sonoridad y consonantes no afinables (*s*, *t*, *k*, respiraciones). No fuerza notas musicales artificiales sobre fricativas ni silencios.
- **Panel Personalizar**:
  - **Rango de voz**: *General* (65 - 1000 Hz), *Grave* (65 - 450 Hz) y *Aguda* (130 - 1000 Hz).
  - **Conservar timbre**: Preserva la envolvente de formantes vocales.
  - **Referencia A4**: Calibración estándar de 430 a 450 Hz (por defecto 440 Hz).
- **Escuchar Original**: Comparación momentánea A/B sin desalineación temporal.
- **Arquitectura Estable para DAWs**:
  - Inicialización STA COM en Windows para FL Studio, Ableton Live, Cubase y Reaper.
  - Directorio de datos WebView2 aislado para evitar bloqueos por múltiples instancias.
  - Silenciamiento y bypass seguro ante falta de licencia activa.

---

## Estructura del Proyecto

```
EASY PITCH/
├── CMakeLists.txt             # Configuración de compilación JUCE 8
├── build.bat                  # Script de compilación automática en Windows (Release x64)
├── installer.iss              # Script de instalador Inno Setup
├── mockup.html                # Interfaz de usuario local HTML5 / CSS3 / JavaScript
├── Source/
│   ├── PluginProcessor.h      # Parámetros y procesamiento de audio
│   ├── PluginProcessor.cpp    # Ciclo de proceso en tiempo real
│   ├── PluginEditor.h         # Vista del editor y puente con WebView2
│   ├── PluginEditor.cpp       # Manejadores nativos de interacción
│   ├── dsp/
│   │   ├── PitchDetector.h    # Detector causal de pitch (MPM / NSDF)
│   │   ├── PitchDetector.cpp
│   │   ├── ScaleQuantizer.h   # Cuantización de notas e histéresis
│   │   ├── ScaleQuantizer.cpp
│   │   ├── PitchShifter.h     # Shifter sincronizado y compensación de latencia
│   │   └── PitchShifter.cpp
│   └── licensing/
│       ├── LicenseManager.h   # Validación offline y anti-tamper
│       └── LicenseManager.cpp
```

---

## Compilación en Windows

### Requisitos
- Visual Studio 2022 (con herramientas de C++ y Windows SDK).
- CMake 3.22 o superior.
- JUCE 8.

### Compilación rápida
Ejecutar el script:
```bat
build.bat
```

O manualmente por consola:
```powershell
cmake -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```

Los binarios generados se encontrarán en:
- `build/EASY_PITCH_artefacts/Release/VST3/EASY PITCH.vst3`
- `build/EASY_PITCH_artefacts/Release/Standalone/EASY PITCH.exe`

---

## Licencia y Distribución
Desarrollado para la suite de plugins de **OFFSZN**.
Todos los derechos reservados.
