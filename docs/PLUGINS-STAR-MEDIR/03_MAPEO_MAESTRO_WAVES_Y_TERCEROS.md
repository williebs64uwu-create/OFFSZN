# 🎛️ 03. MAPEO MAESTRO DE WAVES Y TERCEROS (CON PLANTILLA UNIVERSAL UAD)

> **Decisión estratégica:**
> 1. Mapear los módulos base de **Waves V16** (~85 procesadores únicos que cubren las 723 instancias).
> 2. Mapear **FabFilter, Soundtoys, Slate Digital, SSL, Valhalla DSP, oeksound, Antares y OFFSZN**.
> 3. Para **Universal Audio (UAD)**, aplicar la **Plantilla Universal de Hardware**: al ser réplicas de equipo analógico estándar, no se mapean 452 plugins a mano; se controlan mediante 4 familias universales.

---

## 🌊 1. CATÁLOGO BASE WAVES V16 (Módulos Esenciales STAR CHAIN)

| Familia Waves | Plugins Clave | Perillas Físicas Mapeadas | Función en STAR CHAIN |
|---|---|---|---|
| **Vocal Essentials** | `Waves NS1` | `NS1` (0-100), `Attenuation Meter` | Limpieza de piso de ruido en toma 1. |
| | `Waves RVox` | `Gate`, `Comp`, `Gain` | Compresión vocal rápida y pegada inmediata. |
| | `Waves Sibilance` | `Threshold`, `Range`, `Mode` (Wide/Split), `Trim` | De-Esser orgánico para control de agudos. |
| | `Waves Vocal Rider` | `Target`, `Speed`, `Range Min/Max`, `Sensitivity` | Nivelación automática de dinámica. |
| | `Waves Tune Real-Time`| `Speed`, `Transition`, `Key`, `Scale`, `Tolerance` | Afinación directa en vivo y grabación. |
| | `Waves Clarity Vx` | `Clarity` (0-100%), `Broad 1/2`, `Delta` | Reducción de ruido por red neuronal. |
| | `Waves Silk Vocal` | `Low`, `Mid`, `High`, `High HP`, `Dynamics` | Supresión inteligente de asperezas vocales. |
| | `Waves Vocal Bender` | `Pitch` (-24/+24), `Formant` (-24/+24), `Mix` | Efectos modernos de tono y pitch. |
| **Chris Lord-Alge (CLA)** | `CLA-76` | `Input`, `Output`, `Attack 1-7`, `Release 1-7`, `Ratio 4/8/12/20/All`, `Revision Blacky/Bluey` | Compresor FET de ataque rápido para voz trap/urban. |
| | `CLA-2A` | `Peak Reduction`, `Gain`, `Compress/Limit`, `HiFreq` | Compresor óptico a válvulas para calidez y glue. |
| | `CLA Vocals` | `Bass`, `Treble`, `Compress`, `Reverb`, `Delay`, `Pitch` | Macro todo en uno signature. |
| | `CLA Epic` | 4 Delays + 4 Reverbs con ruteo cruzado | Paisajes espaciales completos. |
| **Consolas & EQs** | `SSL E-Channel / EV2` | `HP`, `LP`, Comp (`Thresh/Ratio/Rel`), EQ (`HF/HMF/LMF/LF`) | Channel strip analógico clásico de estudio. |
| | `Scheps 73` | Preamp Sat, `High Shelf 12k`, `Mid (0.36-7.2k)`, `Low`, `HPF` | Color y pegada tipo Neve 1073. |
| | `Scheps Omni Channel` | `Pre`, `2 De-Essers`, `4-Band EQ`, `Comp (VCA/FET/Opto)`, `Gate` | Channel strip versátil definitivo. |
| | `PuigTec EQP-1A` | `Low Boost/Atten`, `Low Freq`, `High Boost/Atten`, `Bandwidth` | Realce sedoso de graves y agudos (Pultec trick). |
| | `API 560` | 10 bandas gráficas (31 Hz a 16 kHz) | Control rápido de frecuencias por bandas. |
| **H-Series & Abbey Road** | `H-Delay` | `Delay`, `Feedback`, `LP/HP`, `Analog 1-4`, `Ping-Pong`, `Mix` | Delay híbrido analógico/digital de alta fidelidad. |
| | `H-Reverb` | `Decay`, `Pre-Delay`, `ER/Tail Balance`, `Size`, `Drive` | Reverb de convolución FIR con modulación. |
| | `Abbey Road J37` | `Input Level`, `Speed (7.5/15 IPS)`, `Formula 888`, `Wow/Flutter` | Saturación de cinta real de The Beatles. |
| | `Abbey Road Chambers`| `Decay`, `PreDelay`, `Bass/Treble`, `Distance` | Sala de reverberación clásica de Studio Two. |
| **Limitadores / Mastering**| `L2 / L3 Multimaximizer`| `Threshold`, `Ceiling`, `Release / Profile` | Maximizador de loudness transparente. |

---

## 🏛️ 2. LA PLANTILLA UNIVERSAL DE UAD (RESOLUCIÓN DE 452 PLUGINS EN 4 REGLAS)

No es necesario escribir 452 mapeos manuales de UAD. Toda la colección de UAD se basa en hardware vintage estandarizado:

### Familia A: 1176 Limiting Amplifier (UAD 1176LN, Rev A, Rev E, AE)
* **Regla Universal:**
  * `Input`: Sube volumen hacia el umbral de compresión.
  * `Output`: Ganancia de compensación.
  * `Attack`: Giro horario = más rápido (1 lento a 7 ultra-rápido).
  * `Release`: Giro horario = más rápido (1 lento a 7 ultra-rápido).
  * `Ratio`: Botones 4, 8, 12, 20 o All-In.

### Familia B: Teletronix LA-2A (Gray, Silver, Legacy)
* **Regla Universal:**
  * `Peak Reduction`: A mayor valor, mayor atenuación óptica.
  * `Gain`: Nivel de salida a válvulas.
  * `Compress / Limit`: Switch de ratio.

### Familia C: Pultec EQP-1A (Pultec EQ, Pro, Legacy)
* **Regla Universal:**
  * `Low Band`: Selector (20, 30, 60, 100 Hz), perillas `Boost` y `Atten`.
  * `High Band`: Selector (3 a 16 kHz), perilla `Boost`, selector `Atten Freq` y perilla `Atten`.

### Familia D: Neve Console (1073, 1084, 88RS)
* **Regla Universal:**
  * `Input Gain`: Saturación del transformador Marinair.
  * `High Shelf`: Brillo fijo en 12 kHz.
  * `Mid Peak`: Presencia vocal ajustable.
  * `High Pass`: Corte en 50, 80 o 160 Hz.

> **Resultado:** Cualquier plugin de UAD que cargue STAR CHAIN se comporta de inmediato bajo estas 4 plantillas sin errores.

---

## 🎯 3. PRESETS DE FÁBRICA: DÓNDE SÍ Y DÓNDE NO

| Tipo de Plugin | ¿Usar Presets de Fábrica? | Justificación Técnica |
|---|---|---|
| **Reverbs complejas** (`Valhalla`, `H-Reverb`, `Chambers`) | ✅ **SÍ (Recomendado)** | Un preset como *"Vocal Plate 80s"* configura 18 parámetros microscópicos (difusión, densidad de reflexiones tempranas, crossover de amortiguación). STAR solo ajusta `Mix` y `Decay`. |
| **Delays creativos** (`EchoBoy`, `H-Delay`) | ✅ **SÍ (Recomendado)** | Presets como *"1/4 Ping Pong Slap"* o *"Tape Vocal Echo"* entregan el carácter perfecto de inmediato. |
| **Compresores** (`CLA-76`, `Pro-C 2`, `RVox`) | ❌ **NO (Usar Knobs Dinámicos)** | Los presets de compresor no conocen el nivel de entrada del micrófono del usuario. STAR debe ajustar `Input` o `Threshold` basándose en el análisis de volumen real. |
| **EQs Correctivos** (`Pro-Q 3`, `SSL EQ`) | ❌ **NO (Usar Knobs Dinámicos)** | Cada voz tiene resonancias y frecuencias molestas en lugares diferentes. STAR debe aplicar las frecuencias según la jerga o el análisis espectral. |
