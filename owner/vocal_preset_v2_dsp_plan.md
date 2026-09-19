# Especificación y Arquitectura DSP: Efectos Creativos Vocales (Vocal Preset V2)

Documento técnico y de criterio de producción musical basado en el análisis de `Especificacion_DSP_Efectos_Creativos_Vocales.docx` (36,951 caracteres de especificación algorítmica y matemática) adaptado específicamente a la filosofía de **OFFSZN Vocal Preset**.

---

## 1. Criterio de Producción Musical: Filosofía OFFSZN

Un error común en plugins de efectos es saturar al usuario con decenas de perillas secundarias y ecuaciones complejas visibles. La visión de **OFFSZN** es la misma que hace legendarios a plugins como *Soundtoys Decapitator*, *FabFilter Pro-Q* o *Inka Kola*:
> **Máxima musicalidad instantánea, cero fricción técnica, calidad sonora de estudio comercial (Billboard / Spotify Top Charts).**

En la música urbana moderna (Trap, Reggaetón, Plugg, Drill, Hyperpop, R&B contemporáneo):
- Las voces necesitan **carácter, corte en mezcla y transiciones dinámicas**.
- Los efectos se usan en dos niveles:
  1. **Efecto de Paso / Transición:** Intros, puentes, drops, pre-coros (filtros, stutter, lo-fi).
  2. **Efecto de Grosor / Carácter:** Saturación armónica, calor de válvulas y apertura estéreo.

---

## 2. Selección de Módulos para V2 (Prioridad y Criterio)

| Módulo DSP | Decisión para V2 | Justificación de Productor y Flujo Vocal |
| :--- | :---: | :--- |
| **Filtro Creativo (SVF TPT)** | ✅ **Tier 1 (Prioridad Máxima)** | **El efecto más utilizado en voces urbanas.** Cortes tipo "Teléfono / Radio AM", barridos "Underwater" (corte de agudos para intros melancólicas) y barridos High-Pass antes del drop. Debe incluir perilla de *Cutoff*, selector de modo (*Radio*, *Underwater*, *Sweep*) y *Resonancia/Drive*. |
| **Saturación / Distorsión Cálida** | ✅ **Tier 1 (Prioridad Máxima)** | Las voces urbanas quedan sepultadas si no tienen armónicos que compitan con el 808 y el kick. Un módulo con 3 perfiles analógicos (*Cinta*, *Tubo / Válvula*, *Drive Agresivo*), oversampling 2x/4x para evitar aliasing y auto-gain compensation garantiza una voz con presencia premium. |
| **Stutter / Beat-Repeat (Glitch)** | ✅ **Tier 1 (Prioridad Máxima)** | Los productores pasan minutos cortando audio a mano en el DAW para crear repeticiones rápidas (*"tr-tr-tr-tra"*). Un botón momentáneo de Stutter sincronizado al tempo del proyecto (1/8, 1/16, 1/32 y tresillos) con crossfade anti-click de 3 ms es un diferenciador brutal. |
| **Lo-Fi Digital (Bitcrusher + Decimación)** | ✅ **Tier 2 (Alta Prioridad)** | Vital para géneros como Plugg, Hyperpop y pasajes retro. Reduce la profundidad de bits (4 a 16 bits) y la tasa de muestreo (1 kHz a 48 kHz estilo sampler clásico SP-1200). |
| **Flanger & Phaser** | 🔀 **Modos en Espacio/Modulación** | En voces líderes raramente se usan a full wet porque el *comb filtering* cancela los formantes de la voz y hace ininteligible la letra. **Solución:** Integrarlos como modos seleccionables dentro de la sección de *Modulación* existente (junto a Chorus y Doubler), perfectos para segundas voces y ad-libs. |

---

## 3. Especificaciones Técnicas y Ecuaciones DSP (C++ JUCE 8)

### Módulo 1: Filtro Creativo (State Variable Filter - TPT Topology)
- **Topología:** *Topology-Preserving Transform (TPT)* de Vadim Zavalishin. Evita inestabilidades y deformaciones de frecuencia cerca de Nyquist ($f_s / 2$).
- **Modos:**
  - `Radio / Telephone`: Band-pass centrado en 1.2 kHz - 2.8 kHz con Q moderado y saturación sutil.
  - `Underwater`: Low-pass de 4 polos (24 dB/oct) con corte modulable de 300 Hz a 20 kHz.
  - `Air Sweep`: High-pass de 2 polos (12 dB/oct) para vaciar el cuerpo vocal antes de un drop.
- **Ecuaciones TPT:**
  $$v_1 = s_1 + g \cdot (x - s_1 - R \cdot s_2) / (1 + g \cdot R + g^2)$$
  $$v_2 = s_2 + g \cdot v_1$$
  Donde $g = \tan(\pi f_c / f_s)$ y $R = 1/Q$.

---

### Módulo 2: Saturador Armónico Vocal (Harmonic Drive)
- **Algoritmo Waveshaping:**
  $$y = \frac{x}{\sqrt{1 + x^2}} \quad \text{(Saturación suave de tubo)}$$
  $$y = \tanh(\alpha \cdot x) \quad \text{(Cinta analógica con compresión de transientes)}$$
- **Oversampling:**
  Uso de `juce::dsp::Oversampling<float>` a **4x** con filtros de fase lineal para eliminar completamente el aliasing armónico en frecuencias audibles (6 kHz - 20 kHz), crítico para la inteligibilidad vocal.
- **Filtro DC Blocker Post-Saturación:**
  Filtro IIR de 1er orden ($y[n] = x[n] - x[n-1] + 0.995 \cdot y[n-1]$) para eliminar offsets de corriente continua provocados por saturación asimétrica.
- **Compensación de Ganancia Automática (Auto-Gain):**
  Escalamiento inverso dinámico para que aumentar el calor armónico no altere drásticamente el volumen percibido (evitando engaños psicoacústicos).

---

### Módulo 3: Stutter / Beat-Repeat Rítmico
- **Buffer Circular en Memoria:**
  Buffer de audio pre-alocado de 2 segundos (cero llamadas a `malloc` en tiempo real).
- **Sincronización al Transporte:**
  Lectura de `juce::AudioPlayHead` para obtener BPM y posición de compás (PPQ).
- **Rejilla Temporal (Grid):**
  $T_{\text{loop}} = \frac{60}{\text{BPM} \cdot N_{\text{subdiv}}}$ (1/4, 1/8, 1/16, 1/32, 1/16T).
- **Ventana Anti-Click:**
  Crossfade lineal/senoidal de 3 ms en los puntos de reinicio del buffer para garantizar cero ruidos o chasquidos durante la reproducción.

---

### Módulo 4: Lo-Fi Crusher (Degradación Digital)
- **Cuantización de Bits (Bit Depth Reduction):**
  $$y = \frac{\text{round}(x \cdot 2^{B-1})}{2^{B-1}} \quad (B \in [4, 16])$$
- **Decimación (Sample Rate Reduction):**
  Zero-order hold con acumulador de fase fraccional para emular conversores A/D vintage de baja frecuencia de muestreo (12 kHz - 22 kHz).

---

## 4. Estructura de Código C++ Propuesta para V2

```cpp
// Source/DSP/CreativeRack.h
#pragma once
#include <juce_dsp/juce_dsp.h>

namespace offszn {

class CreativeFilter {
public:
    enum class Mode { RadioTelephone, UnderwaterLP, AirHP, PeakSweep };
    void prepare(const juce::dsp::ProcessSpec& spec);
    void reset();
    void setParameters(Mode mode, float cutoffHz, float resonance, float drive);
    void process(juce::dsp::ProcessContextReplacing<float>& context);
private:
    juce::dsp::StateVariableTPTFilter<float> svf;
};

class HarmonicSaturator {
public:
    enum class Profile { TapeWarmth, TubeValve, AggressiveDrive };
    void prepare(const juce::dsp::ProcessSpec& spec);
    void reset();
    void setParameters(Profile profile, float driveAmount, float mix);
    void process(juce::dsp::ProcessContextReplacing<float>& context);
private:
    juce::dsp::Oversampling<float> oversampling { 2, 2, juce::dsp::Oversampling<float>::filterHalfBandFIREquiripple };
    juce::dsp::IIR::Filter<float> dcBlocker;
};

class BeatStutter {
public:
    void prepare(const juce::dsp::ProcessSpec& spec);
    void reset();
    void trigger(bool active, float noteDivFraction, double bpm);
    void process(juce::AudioBuffer<float>& buffer);
private:
    juce::AudioBuffer<float> ringBuffer;
    int writePos = 0;
    int loopLengthSamples = 0;
    bool isStuttering = false;
};

} // namespace offszn
```

---

## 5. Resumen de Estado del Proyecto

- **Versión 1.5 (Actual):**
  - Sistema de skins minimalistas de estudio implementado con 5 paletas (`Obsidian`, `Cobalt`, `Violet`, `Gold`, `Titanium`).
  - Persistencia permanente mediante `localStorage` y almacenamiento de sesión WebView2.
  - Cadena completa Easy Mix + Módulos de Espacio y Modulación (Doubler, Chorus, Delay, Reverb) activos y calibrados.
- **Versión 2.0 (Próxima):**
  - Integración del motor DSP en C++ `CreativeRack.h` implementando los 4 módulos priorizados (*Filtro*, *Saturador*, *Stutter*, *Lo-Fi*).
