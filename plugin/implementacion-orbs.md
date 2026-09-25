# 🔮 OFFSZN Thinking Orbs • Especificación de Implementación & Arquitectura de Plugin

> **Documento Maestro**: Guía integral para el desarrollo y aplicación del motor de **Thinking Orbs** con **Reactividad al Sonido** en el ecosistema OFFSZN (Web UI + Plugin de Audio C++ JUCE VST3/AU).

---

## 1. Visión & Filosofía Visual

**Thinking Orbs** (basado en la ingeniería matemática de Jakub Antalik) representa una de las interfaces visuales más elegantes y avanzadas para productos de audio y tecnología:
- **Estética Minimalista Black & White**: Puntos blancos sobre fondo negro absoluto (`#000000`), sin gradientes chillones ni elementos distractores.
- **Geometría 3D Real sin WebGL**: No depende de shaders pesados ni librerías externas. La profundidad se transmite enteramente mediante **tamaño de punto** y **peso de tinta** (*Halftone Sphere*).
- **Z-Sorting Determinista**: En cada fotograma a 60 FPS, los puntos se ordenan matemáticamente en el eje Z para lograr oclusión natural (las partículas del frente tapan a las del fondo).

---

## 2. Los 9 Estados Cinemáticos del Orbe

| Modo | Nombre | Descripción Cinemática | Aplicación en Audio / Plugins |
| :--- | :--- | :--- | :--- |
| **`listening`** | Wave | Ondas sinusoidales concéntricas que recorren los anillos. | **Visualizador Principal**: El audio modula directamente la altura y velocidad de las crestas. |
| **`working`** | Orbits | Partículas girando en órbitas elípticas inclinadas con aceleración Kepleriana. | **Compresión Activa**: Las partículas aceleran con el gain reduction del compresor. |
| **`searching`** | Globe | Malla de latitud/longitud con un meridiano de escaneo tipo radar. | **Análisis Espectral / EQ Match**: Modo escaneo para detectar frecuencias resonantes. |
| **`solving`** | Rubik | Bandas esféricas que se desalinean en giros angulares y encajan en palindrome. | **Mastering Limiter**: Cuando el master alcanza el 0 dBFS / LUFS objetivo, el orbe "encaja". |
| **`connecting`**| Web | Red de nodos flotantes que forman constelaciones unidas por líneas vectoriales. | **Ruteo / Preset Selector**: Selección de cadenas de plugins o envíos de efectos. |
| **`weaving`** | Braid | Tres trenzas tridimensionales entrelazándose sobre la superficie. | **Procesamiento Mid/Side o Multibanda**. |
| **`composing`** | Ribbon| Cinta continua ondulante de varias bandas con grosor dinámico. | **Saturación Armónica / Cinta Analógica**. |
| **`breathing`** | Ring | Anillo elástico que pulsa suavemente hacia adentro y hacia afuera. | **Modo Idle / Reposo / Bypass**. |
| **`shaping`** | Morph | Morfogénesis continua: Círculo $\to$ Triángulo $\to$ Cuadrado. | **Selector de Modos o Algoritmos** (Clean, Punch, Warm). |

---

## 3. Arquitectura de Reactividad al Sonido (Audio-Reactive Engine)

Para que el orbe se mueva con energía orgánica y musical sin saltos bruscos, el flujo de audio se divide en 3 bandas de frecuencia procesadas con **balística física (Attack / Decay)**:

```
[Entrada de Audio] 
       │
       ▼
[Análisis FFT (512 muestras)]
       │
       ├──► Banda 1: SUB & GRAVES (20 Hz - 250 Hz)
       │      └─► Modula: Radio base del Orbe y grosor de los puntos (Kick / 808)
       │
       ├──► Banda 2: MEDIOS (250 Hz - 4000 Hz)
       │      └─► Modula: Altura de las ondas sinusoidales y velocidad de giro (Voces / Snare)
       │
       └──► Banda 3: AGUDOS (4000 Hz - 16000 Hz)
              └─► Modula: Jitter / micro-vibración y brillo máximo de puntos (Hi-Hats / Air)
```

### Balística de Audio (Smoothing Filter):
```cpp
// En cada frame:
float targetLevel = currentFFTValue;
if (targetLevel > smoothedLevel) {
    // Attack ultra-rápido (reacciona al transitorio)
    smoothedLevel += (targetLevel - smoothedLevel) * 0.45f;
} else {
    // Release suave (evita parpadeos nerviosos)
    smoothedLevel += (targetLevel - smoothedLevel) * 0.08f;
}
```

---

## 4. Implementación en Plugin de Audio C++ (JUCE VST3 / AU)

Dado que este motor dibuja primitivas 2D (círculos y líneas) sobre coordenadas proyectadas en 3D, **se traslada directamente a JUCE C++** utilizando `juce::Graphics` en un hilo de interfaz desacoplado del hilo de audio.

### A. Hilo de Audio (`PluginProcessor.cpp`):
En el procesamiento de audio, extraemos la energía de las bandas sin realizar bloqueos de memoria (Lock-Free):

```cpp
void OFFSZNAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    const int numSamples = buffer.getNumSamples();
    
    // 1. Calcular RMS global
    float currentRMS = buffer.getRMSLevel(0, 0, numSamples);
    
    // 2. Extraer magnitudes FFT para Graves, Medios y Agudos
    // (empujamos muestras al ring-buffer de FFT)
    for (int i = 0; i < numSamples; ++i) {
        fftDataFifo.pushSample(buffer.getSample(0, i));
    }
    
    // 3. Almacenar valores normalizados en variables atómicas
    bassEnergy.store(calculatedBass, std::memory_order_relaxed);
    midEnergy.store(calculatedMid, std::memory_order_relaxed);
    highEnergy.store(calculatedHigh, std::memory_order_relaxed);
}
```

### B. Hilo de Interfaz (`ThinkingOrbComponent.h` / `.cpp`):
El componente de interfaz corre en un `juce::Timer` a 60 Hz:

```cpp
class ThinkingOrbComponent : public juce::Component, private juce::Timer
{
public:
    ThinkingOrbComponent(OFFSZNAudioProcessor& p) : processor(p)
    {
        startTimerHz(60); // 60 FPS fijos
    }

    void timerCallback() override
    {
        // Leer valores del procesador
        float bass = processor.bassEnergy.load(std::memory_order_relaxed);
        float mids = processor.midEnergy.load(std::memory_order_relaxed);
        
        // Actualizar reloj interno modulado por el audio
        time += 0.016f * (1.0f + mids * 2.0f);
        
        // Forzar repintado
        repaint();
    }

    void paint(juce::Graphics& g) override
    {
        g.fillAll(juce::Colours::black);
        
        const float cx = getWidth() * 0.5f;
        const float cy = getHeight() * 0.5f;
        const float bass = processor.bassEnergy.load(std::memory_order_relaxed);
        const float baseRadius = (getWidth() * 0.4f) * (1.0f + bass * 0.25f);
        
        // Generar puntos 3D, rotar con pitch/yaw y ordenar por Z
        auto dots = generateWaveFrame(baseRadius, time);
        
        // Dibujar en orden Z (de atrás hacia adelante)
        for (const auto& dot : dots)
        {
            // Profundidad controla opacidad y radio
            float alpha = juce::jlimit(0.15f, 1.0f, (dot.z + 1.0f) * 0.5f);
            g.setColour(juce::Colours::white.withAlpha(alpha));
            
            float r = dot.radius * (1.0f + (dot.z + 1.0f) * 0.5f);
            g.fillEllipse(dot.x - r, dot.y - r, r * 2.0f, r * 2.0f);
        }
    }

private:
    OFFSZNAudioProcessor& processor;
    float time = 0.0f;
};
```

---

## 5. Propuestas de Productos de Plugin OFFSZN

### Opción 1: OFFSZN Aura (Mastering Spectrum Visualizer VST3)
- **Concepto**: Un plugin medidor ultra-estético para master bus.
- **Función**: Flota en el centro del DAW mostrando la dinámica del track. Cuando el beat tiene buena separación estéreo y punch, el orbe se expande simétricamente; si hay saturación o desfase, las órbitas se dispersan.

### Opción 2: OFFSZN Easy Master v2 (Smart AI Limiter)
- **Concepto**: Integrar el orbe como núcleo del plugin Easy Master.
- **Función**:
  - En silencio: Modo `breathing`.
  - Cuando entra la música: Modo `listening` modulado por el punch del 808.
  - Cuando el limitador está reduciendo picos: Modo `working` / `orbits` con partículas girando en alta velocidad.

### Opción 3: OFFSZN Vocal AI (Tone & Pitch Assistant)
- **Concepto**: Plugin para tracking vocal.
- **Función**: El orbe escucha al cantante en tiempo real; cuando el vocalista canta afinado en la escala elegida, el orbe entra en modo `solving` (encajado armónico); si desafina, las partículas se desordenan indicando visualmente la corrección necesaria.

---

## 6. Implementación Web en la Librería OFFSZN

Para tener el orbe disponible de inmediato en la web antes de compilar el plugin en C++:

### Estructura de Archivos:
```
compon/new/
└── thinking-orb/
    ├── thinking-orb.js       <-- Motor matemático 2D (9 modos)
    ├── audio-reactive.js     <-- Analizador Web Audio API (FFT + Micrófono)
    ├── thinking-orb.css      <-- Estilos Black & White
    └── README.md             <-- Documentación de uso
```

### Integración en `probar.html`:
- Nuevo panel interactivo con canvas donde el usuario puede activar su micrófono o reproducir un loop sintético para ver la reactividad en tiempo real.
- Botón **"Copiar para el Chat"** para inyectar el orbe en cualquier sección de OFFSZN (reproductor de beats, landing page o checkout).

---

*Documento creado para OFFSZN • Arquitectura Visual y Procesamiento de Audio Digital.*
