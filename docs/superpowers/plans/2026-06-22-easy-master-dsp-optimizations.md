# EASY MASTER DSP Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver la distorsión del clipper con señales calientes mediante rodilla suave y sobremuestreo 4x FIR, y rediseñar el Stereo Imager usando Haas en M/S real sin comb filtering para mayor apertura y presencia de aire (+4dB).

**Architecture:** Cadena de señal en C++ con Oversampling lineal 4x envolviendo el waveshaper y clipper, Crossover Linkwitz-Riley separando bandas, Haas aplicado únicamente sobre el canal de diferencia del canal derecho ($R = Mid - Side_{delayed}$), y Side EQ High-Shelf.

**Tech Stack:** JUCE 8, C++17, DSP Module (Oversampling, Linkwitz-Riley, IIR, DelayLine, Limiter).

---

## Contexto e Inputs
- **Problema de distorsión**: El saturador `tanh` y Waveshaper corren a 1x muestreo con picos calientes, doblando aliasings y distorsión. Se solucionará con 4x Oversampling lineal FIR y un limitador de picos suave (Soft-Knee Peak Clipper) transparente por debajo de -0.5dB (0.95).
- **Problema del Imager**: Haas mezclado en fase causaba filtros de peine. Se solucionará aplicando el retraso de Haas únicamente al canal derecho de la banda lateral: $L = Mid + Side(t)$ y $R = Mid - Side(t - 6ms)$.
- **Presencia Side**: Boost High Shelf de aire (10kHz - 20kHz) escalable hasta +4.0dB.

---

## Plan de Ejecución de Tareas (Atomic Tasks)

### Task 1: Declarar y Configurar 4x Oversampling y Estructura en C++

**Files:**
- Modify: [PluginProcessor.h](file:///C:/Users/Willie/Desktop/EASY%20MASTER/Source/PluginProcessor.h)
- Modify: [PluginProcessor.cpp](file:///C:/Users/Willie/Desktop/EASY%20MASTER/Source/PluginProcessor.cpp)

- [ ] **Step 1: Declarar el Oversampler en `PluginProcessor.h`**
  ```cpp
  std::unique_ptr<juce::dsp::Oversampling<float>> oversampler;
  ```
- [ ] **Step 2: Inicializar el Oversampler en `PluginProcessor.cpp` constructor**
  ```cpp
  // 4x oversampling con filtro lineal FIR
  oversampler = std::make_unique<juce::dsp::Oversampling<float>>(2, 2, juce::dsp::Oversampling<float>::filterHalfBandFIR, true, true);
  ```
- [ ] **Step 3: Llamar `initProcessing` en `prepareToPlay`**
  ```cpp
  oversampler->initProcessing(samplesPerBlock);
  ```

---

### Task 2: Implementar el Soft-Knee Peak Clipper y Waveshaper a 4x Oversampling

**Files:**
- Modify: [PluginProcessor.cpp](file:///C:/Users/Willie/Desktop/EASY%20MASTER/Source/PluginProcessor.cpp)

- [ ] **Step 1: Modificar `processSaturation` para usar el bloque sobremuestreado**
  Subir frecuencia 4x, procesar waveshaper y peak clipping, bajar frecuencia.
- [ ] **Step 2: Implementar el Algoritmo del Soft-Knee Peak Clipper**
  El clipper debe ser totalmente transparente por debajo del umbral de -0.5dB (0.95f), y aplicar rodilla suave basada en `tanh` sobre los picos excedentes.
- [ ] **Step 3: Proteger el polinomio del Waveshaper (Oxford Inflator) contra explosiones**
  Saturar suavemente valores que excedan $|x| > 1.0$ antes de aplicar la curva polinómica.

---

### Task 3: Rediseñar el Imager con Haas M/S y Boost en Aire (+4dB)

**Files:**
- Modify: [PluginProcessor.cpp](file:///C:/Users/Willie/Desktop/EASY%20MASTER/Source/PluginProcessor.cpp)

- [ ] **Step 1: Cambiar la mezcla Haas en `processStereoWidth`**
  Reemplazar el mezclado destructivo en fase por:
  ```cpp
  L_out = Mid + Side(t);
  R_out = Mid - Side(t - 6ms);
  ```
- [ ] **Step 2: Incrementar la ganancia máxima de `imagerAmt`**
  Permitir que el Side crezca hasta un multiplicador de `1.5` (2.5x más ancho) a máximo AMOUNT para hacerlo extremadamente perceptible.
- [ ] **Step 3: Aumentar el boost del Side EQ**
  Mapear la ganancia de `sideEQ` hasta un máximo de `+4.0dB` (en lugar de +1.5dB) a máximo AMOUNT.

---

### Task 4: Compilación y QA

**Files:**
- Build local

- [ ] **Step 1: Compilar la versión Release**
  `cmake --build build --config Release`
- [ ] **Step 2: Probar con señales calientes (+21dB)**
  Confirmar en FL Studio que la distorsión del clipper es suave y analógica (sin chirridos digitales), que el estéreo se abre masivamente a 100% y que la presencia a 10k-20k le da aire premium al master.
