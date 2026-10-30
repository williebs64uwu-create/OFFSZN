# 🎛️ PLUGIN BIBLE — STAR CHAIN (OFFSZN)
> **Documento de Referencia Técnica y Mapeo Real de Parámetros**
> **Regla de oro:** Todos los nombres de perillas, faders y switches coinciden exactamente con la interfaz real (GUI) de los plugins y sus manuales oficiales.
> **Uso:** Utilizado por STAR CHAIN para orquestar cadenas de mezcla, decidir sustitutos cuando un plugin falta y mapear parámetros con precisión quirúrgica.

---

## 📐 1. ARQUITECTURA DEL MOTOR DE DECISIÓN DE STAR CHAIN

### Flujo de Análisis y Asignación Dinámica:
```
┌────────────────────────────────────────────────────────┐
│ 1. ANÁLISIS DE AUDIO EN TIEMPO REAL (FFT & DSP)        │
│   - Crest Factor (Peak vs RMS) → Densidad dinámica     │
│   - Energía 200-400 Hz → Nivel de resonancia (mud)     │
│   - Energía 5-9 kHz → Nivel de sibilancias (eses)      │
│   - Spectral Tilt (> 10 kHz) → Nivel de opacidad/aire  │
│   - Piso de ruido residual → dB de ruido de fondo      │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 2. RECONOCIMIENTO DE GÉNERO Y PRESET DE ARTISTA        │
│   - Consulta base interna (Bad Bunny, Feid, Mora, etc) │
│   - Define el carácter tímbrico deseado                │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 3. ESCANEO DE PLUGINS INSTALADOS EN EL SISTEMA         │
│   - Si el plugin ideal está instalado → Lo carga       │
│   - Si NO está → Consulta la Matriz de Sustitución     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 4. AJUSTE QUIRÚRGICO DE PARÁMETROS REALES              │
│   - Mapeo directo sobre los faders/knobs físicos       │
│   - Compensación automática de ganancia (Auto-Gain)    │
└────────────────────────────────────────────────────────┘
```

---

## 💎 2. SLATE DIGITAL — MAPEO DE PARÁMETROS REALES

### Fresh Air (Dynamic High Frequency Processor)
> **Aclaración crítica:** En la interfaz física de Fresh Air NO existen perillas llamadas 'Presence' ni 'Air'. Los faders reales son **`Mid Air`** y **`High Air`**.

| Control Real | Rango | Comportamiento Físico / Frecuencial |
|---|---|---|
| **`Mid Air`** | `0.0% – 100.0%` | Exciter dinámico centrado en medios-altos (~3 kHz a 10 kHz). Añade presencia vocal, mordida y claridad sin aspereza metálica. |
| **`High Air`** | `0.0% – 100.0%` | Exciter dinámico centrado en el ultra-alto espectro (~10 kHz a 20+ kHz). Aporta el brillo sedoso ('expensive sheen') típico de grabaciones comerciales. |
| **`Link`** | `On / Off` (Switch) | Vincula el movimiento de `Mid Air` y `High Air` para moverlos de forma proporcional. |
| **`Trim`** | `-12.0 dB a +12.0 dB` | Perilla de ajuste de nivel de salida para compensar el incremento de volumen producido por el exciter. |
| **`Power`** | `Bypass / Active` | Switch general de bypass del procesador sin cortes de fase. |

**STAR CHAIN — Calibración según análisis:**
- *Voz Trap/Drill agresiva:* `Mid Air` 30-40%, `High Air` 20-30%, `Trim` -2.5 dB.
- *Voz Reggaetón limpia (Feid / Mora style):* `Mid Air` 15-25%, `High Air` 35-45%, `Trim` -1.8 dB.
- *Sustituto inmediato:* Maag Audio EQ4 (`Air Band` en 20 kHz o 40 kHz) o FabFilter Pro-Q 3 (High Shelf @ 12 kHz + Dynamic mode).

---

## 🌊 3. WAVES AUDIO (V16) — MAPEO DE PARÁMETROS REALES

### Waves NS1 (Noise Suppressor)
> **Aclaración crítica:** En Waves NS1 NO existe perilla de 'Threshold'. El control principal es un único fader vertical rotulado **`NS1`**.

| Control Real | Rango | Comportamiento Físico |
|---|---|---|
| **`NS1`** | `0.0 – 100.0` | Único fader de supresión. El motor de análisis interno de Waves diferencia voz de ruido ambiental y atenúa el piso de ruido. |
| **`Attenuation Meter`** | `0 dB a -∞ dB` | Medidor de barra visual que indica cuántos dB de ruido se están atenuando en tiempo real. |

**STAR CHAIN — Calibración:**
- *Micrófono de estudio silencioso:* `NS1` en 10-20 (elimina hiss eléctrico sin comer el final de las palabras).
- *Home studio con ruido o ventilador:* `NS1` en 25-45 (máximo antes de introducir artefactos de fase).
- *Sustituto:* OFFSZN Easy Clean o Waves Clarity Vx.

### Waves RVox (Renaissance Vox)
> **Aclaración crítica:** RVox consta exactamente de 3 faders verticales: `Gate`, `Comp` y `Gain`. No tiene controles rotulados 'Reverse' ni 'Threshold'.

| Control Real | Rango | Comportamiento Físico |
|---|---|---|
| **`Gate`** | `-∞ dB a 0.0 dB` | Fader izquierdo. Compuerta descendente rápida calibrada especialmente para voces. |
| **`Comp`** | `0.0 dB a -36.0 dB` | Fader central. Compresor de codo suave y ataque ultrarrápido con make-up gain automático. |
| **`Gain`** | `-36.0 dB a +36.0 dB` | Fader derecho. Control de techo de salida final. |
| **`Energy / Attenuation`**| Medidor dual | Muestra energía de entrada y medidor de reducción de ganancia (GR en amarillo/naranja). |

**STAR CHAIN — Calibración:**
- *Voz líder urbana:* `Gate` en -48 dB, `Comp` en -12 a -16 dB (aplica 3-6 dB de compresión sólida al cantar), `Gain` en 0.0 dB.

### Waves Sibilance (De-Esser Orgánico)
| Control Real | Rango | Comportamiento Físico |
|---|---|---|
| **`Threshold`** | `-60.0 dB a 0.0 dB` | Umbral de sensibilidad para detectar eventos sibilantes. |
| **`Range`** | `0.0 dB a -24.0 dB` | Límite máximo de reducción en dB aplicada a la 'S'. |
| **`Mode`** | `Wide` / `Split` | `Wide` atenúa la señal completa de forma transparente; `Split` corta únicamente las altas frecuencias de la sibilancia. |
| **`Detection`** | `Lookahead` (On/Off) | Activa 2 ms de anticipación para transientes sibilantes extremadamente rápidos. |
| **`Trim`** | `-18.0 dB a +18.0 dB` | Ajuste de nivel de salida global. |

### Waves Vocal Rider
| Control Real | Rango | Comportamiento Físico |
|---|---|---|
| **`Target`** | `-42.0 dBFS a 0.0 dBFS`| Punto objetivo de nivel vocal que el Rider mantendrá constante. |
| **`Vocal Sensitivity`** | `0.0 a 10.0` | Sensibilidad de detección de la voz humana frente al ruido. |
| **`Music Sensitivity`** | `0.0 a 10.0` | Sensibilidad del sidechain del beat/pista para cabalgar sobre la música. |
| **`Range Min / Max`** | `-12.0 dB a +12.0 dB` | Horquillas corredizas que delimitan el viaje máximo del fader (ej: -3 dB a +3 dB). |
| **`Speed`** | `Fast` / `Slow` | `Fast` para rap rápido o trap; `Slow` para baladas o melodías sostenidas. |
| **`Idle`** | `-12.0 dB a +12.0 dB` | Posición donde reposa el fader cuando el cantante deja de cantar. |

### Waves CLA-76 (Compressor / Limiter)
| Control Real | Rango | Comportamiento Físico |
|---|---|---|
| **`Input`** | `0 a 100` | Regula el nivel de entrada hacia el FET. A mayor Input, mayor compresión. |
| **`Output`** | `0 a 100` | Make-up gain final. |
| **`Attack`** | `1 (lento: ~800 µs) a 7 (ultrarrápido: ~20 µs)` | Giro horario = Más rápido (estándar 1176). |
| **`Release`** | `1 (lento: ~1100 ms) a 7 (ultrarrápido: ~50 ms)` | Giro horario = Más rápido. |
| **`Ratio`** | `4:1, 8:1, 12:1, 20:1, ALL` | Botones de proporción. `ALL` activa el famoso 'British Mode' (alta distorsión). |
| **`Revision`** | `Blacky` / `Bluey` | `Blacky` (Rev LN: sonido limpio y pegada en graves); `Bluey` (Rev A: distorsión armónica y brillo agresivo). |
| **`Comp Off`** | `On / Off` | Apaga la compresión permitiendo usar los preamplificadores y transformadores como saturador analógico. |

### Waves CLA-2A (Optical Tube Compressor)
| Control Real | Rango | Comportamiento Físico |
|---|---|---|
| **`Peak Reduction`** | `0 a 100` | Controla la intensidad de luz de la celda óptica T4. Más valor = Mayor compresión. |
| **`Gain`** | `0 a 100` | Ganancia del amplificador a tubos 12AX7. |
| **`Compress / Limit`**| `Switch` | `Compress` (~3:1 dependiente de señal); `Limit` (> 10:1 comportamiento limitador). |
| **`HiFreq`** | `Flat a HF Emphasis` | Tornillo de calibración: en HF Emphasis comprime más las altas frecuencias (actúa como de-esser). |
| **`Analog`** | `50 Hz / 60 Hz / Off` | Inyección de zumbido analógico de red eléctrica. |

### Waves SSL E-Channel / G-Channel / EV2
| Sección | Parámetros Reales | Comportamiento |
|---|---|---|
| **Filtros** | `HP` (16 - 350 Hz), `LP` (3 - 20 kHz), `FLT DYN SC` | Corta subgraves o agudos; switch para enviar filtros al sidechain del compresor. |
| **Compresor** | `Threshold` (+10 a -20 dB), `Ratio` (1:1 a ∞:1), `Release` (0.1 a 4s), `Fast Attack` switch | Compresor VCA legendario de canal SSL. |
| **Expander/Gate** | `Threshold` (-30 a +10 dB), `Range` (0 a 40 dB), `Release` (0.1 a 4s), `Fast Attack`, `Exp` switch | Compuerta y expansor descendente. |
| **HF (High)** | `1.5 - 16 kHz`, `Gain ±17 dB`, `Bell` switch | Campana o shelf de brillo analógico. |
| **HMF (High-Mid)** | `0.6 - 7 kHz`, `Gain ±17 dB`, `Q` (0.5 a 2.5) | Presencia y definición vocal. |
| **LMF (Low-Mid)** | `0.2 - 2.5 kHz`, `Gain ±17 dB`, `Q` (0.5 a 2.5) | Limpieza de frecuencias gomosas (corte en ~300 Hz). |
| **LF (Low)** | `30 - 450 Hz`, `Gain ±17 dB`, `Bell` switch | Peso y cuerpo. |
| **Master** | `Output ±17 dB`, `Analog` (On/Off), `Phase` (ø) | Saturación armónica SSL y volumen general. |

### Waves Scheps Omni Channel 2
| Módulo | Controles Reales | Función en Cadena |
|---|---|---|
| **`PRE`** | `Odd`, `Even`, `Heavy` (Saturación), `HP` (16-350Hz), `LP` (3-20kHz), `Thump` | Modelado de saturación de válvulas/transistores y filtrado previo. |
| **`DE-ESS`** | 2 bandas independientes (`Freq`, `Threshold`, `Listen`) | Permite suprimir sibilancias agudas ('S') y resonancias ásperas ('CH' / 'T') a la vez. |
| **`EQ`** | 4 bandas paramétricas completas + modo `Stereo / Duo / MS` | EQ analógica flexible desarrollada con Andrew Scheps. |
| **`COMP`** | 3 tipos seleccionables (`VCA`, `FET`, `OPTO`), `Threshold`, `Ratio`, `Release` | Compresión versátil con opción de mezcla paralela interna. |
| **`GATE`** | `Threshold`, `Decay`, `Floor` | Acondicionamiento acústico dinámico. |

### Waves Clarity Vx & Silk Vocal
| Plugin | Controles Reales | Uso en STAR CHAIN |
|---|---|---|
| **`Clarity Vx`** | `Clarity` (0-100%), `Broad 1` (voz limpia normal), `Broad 2` (voces con ruido extremo), `Delta` | Reducción de ruido por IA de máxima fidelidad en una sola perilla. |
| **`Silk Vocal`** | `Low`, `Mid`, `High` (faders inteligentes), `High HP`, `Dynamics`, `Mix` | Ecualizador dinámico neuronal que detecta asperezas vocales en tiempo real. |

### Waves Tune Real-Time & Vocal Bender
| Plugin | Controles Reales | Función |
|---|---|---|
| **`Waves Tune Real-Time`**| `Speed` (0.1 a 800 ms), `Transition` (0.1 a 800 ms), `Key`, `Scale`, `Tolerance`, `Correction Amount` | Afinación en vivo de latencia imperceptible para cabina y mezcla. |
| **`Vocal Bender`** | `Pitch` (-24 a +24 semitonos), `Formant` (-24 a +24), `Drive`, `Mix` | Efecto 'chopped and screwed', voces agudas o formantes robotizados. |

### Waves PuigTec EQP-1A (Pultec EQ)
| Control Real | Opciones / Rango | Truco de Estudio Pultec |
|---|---|---|
| **`Low Frequency`** | `20, 30, 60, 100 CPS` | Frecuencia de graves. |
| **`Low Boost`** | `0 a 10` | Realce en graves. |
| **`Low Atten`** | `0 a 10` | Atenuación en graves. |
| **`High Frequency`** | `3, 4, 5, 8, 10, 12, 16 KCS` | Frecuencia de agudos. |
| **`High Boost`** | `0 a 10` | Realce en agudos. |
| **`High Bandwidth`** | `0 (Sharp) a 10 (Broad)` | Anchura del boost en agudos. |
| **`High Atten`** | `0 a 10` | Atenuación de agudos. |
| **`Atten Freq`** | `5, 10, 20 KCS` | Frecuencia de corte para High Atten. |

> **Pultec Low-End Trick:** Subir `Low Boost` a 4 y `Low Atten` a 3 en 60 Hz produce una curva resonante con corte inmediato en 250 Hz que elimina el emborronamiento ('mud') del bajo y la voz automáticamente.

### Waves Abbey Road J37 Tape
| Control Real | Rango | Función |
|---|---|---|
| **`Input Level`** | `-18 dB a +18 dB` | Nivel de entrada; al saturar produce compresión analógica de cinta y armónicos cálidos. |
| **`Output Level`** | `-18 dB a +18 dB` | Compensación de nivel de salida. |
| **`Tape Speed`** | `7.5 IPS / 15 IPS` | 7.5 IPS aporta graves densos y agudos oscuros vintage; 15 IPS aporta respuesta hi-fi moderna. |
| **`Formula`** | `EMI 888 / 811 / 815` | Fórmulas químicas de cinta británicas con distintos niveles de saturación. |
| **`Bias`** | `Nominal / +3 dB / +5 dB` | Sobrepolarización magnética que engrosa los medios. |
| **`Wow` / `Flutter`** | `0 a 100` | Fluctuaciones mecánicas del motor y los rodillos de cinta. |

---

## 🔴 4. FABFILTER — MAPEO DE PARÁMETROS REALES

### FabFilter Pro-Q 3 / Pro-Q 4
| Control Real | Rango | Comportamiento |
|---|---|---|
| **`Frequency`** | `10 Hz a 30 kHz` | Frecuencia de corte o centro de banda. |
| **`Gain`** | `-30.0 dB a +30.0 dB` | Realce o corte de la banda. |
| **`Q / Bandwidth`** | `0.025 a 40.0` | Ancho de banda (valores altos = quirúrgico; valores bajos = musical/amplio). |
| **`Shape`** | `Bell, Low Shelf, Low Cut, High Shelf, High Cut, Notch, Band Pass, Tilt Shelf, Flat Tilt` | Formas de filtro seleccionables individualmente. |
| **`Slope`** | `6, 12, 18, 24, 30, 36, 48, 72, 96 dB/oct, Brickwall` | Caída de pendientes en filtros pasa altos y pasa bajos. |
| **`Dynamic Range`** | `-30.0 dB a +30.0 dB` | Aro dinámico: comprime o expande la banda en función de la energía entrante. |
| **`Dynamic Threshold`**| `Auto` o `-60 dBFS a 0 dBFS` | Nivel a partir del cual actúa la dinámica. |
| **`Stereo Placement`**| `Left, Right, Stereo, Mid, Side` | Asignación estéreo o Mid/Side por banda independiente. |

### FabFilter Pro-C 2
| Control Real | Rango | Comportamiento |
|---|---|---|
| **`Threshold`** | `-60.0 dB a 0.0 dBFS` | Umbral de compresión. |
| **`Ratio`** | `1:1 a 100:1 (∞:1)` | Proporción de compresión. |
| **`Attack`** | `0.005 ms a 250 ms` | Velocidad de activación. |
| **`Release`** | `10 ms a 2500 ms` | Velocidad de recuperación (cuenta con modo `Auto`). |
| **`Knee`** | `0.0 dB (hard) a +72.0 dB (soft)` | Curva de transición en el codo de compresión. |
| **`Range`** | `0.0 dB a 60.0 dB` | Limita la reducción de ganancia máxima que el compresor puede aplicar. |
| **`Lookahead`** | `0.0 ms a 20.0 ms` | Anticipación de transientes. |
| **`Style`** | `Clean, Classic, Opto, Vocal, Mastering, Bus, Punch, Pumping` | 8 algoritmos de compresión únicos. |
| **`Dry/Wet`** | `0.0% a 100.0%` | Mezcla paralela interna con alineación de fase. |

### FabFilter Pro-MB & Pro-DS
- **Pro-MB (Multiband):** Hasta 6 bandas flotantes libres con `Threshold`, `Range`, `Ratio`, `Attack`, `Release`, `Lookahead` y conmutador `Compress / Expand` individual por banda.
- **Pro-DS (De-Esser):** `Threshold`, `Range` (-24 a 0 dB), `Frequency` (1 a 20 kHz), `Mode` (`Single Vocal` para solistas / `Allround` para coros y mezclas), `Audition` (escucha aislada de eses).

### FabFilter Pro-L 2 & Saturn 2
- **Pro-L 2 (True Peak Limiter):** `Gain`, `Output` (Ceiling -0.1 dBFS recomendado), `Style` (`Modern`, `Transparent`, `Aggressive`, `Punchy`), `Lookahead`, `Attack`, `Release`, `True Peak Limiting` (On).
- **Saturn 2 (Multiband Saturation):** Hasta 6 bandas de distorsión con `Drive`, `Dynamics`, `Tone` (`Bass`, `Mid`, `Treble`, `Presence`), `Mix` y más de 20 modelos de saturación analógica.

---

## 🎯 5. OEKSOUND — SOOTHE2 & SPIFF

### oeksound Soothe2 (Dynamic Resonance Suppressor)
| Control Real | Rango | Comportamiento |
|---|---|---|
| **`Depth`** | `0.0 a 10.0` | Cantidad global de supresión de resonancias. |
| **`Sharpness`** | `0.0 a 10.0` | Anchura y precisión de los micro-filtros notch móviles. |
| **`Selectivity`**| `0.0 a 10.0` | Grado de selectividad del algoritmo: valores altos procesan únicamente picos duros. |
| **`Speed`** | `Fast / Slow` | Velocidad de reacción y relajación de los filtros notch. |
| **`Quality`** | `Normal, High, Ultra` | Resolución de sobremuestreo y procesamiento en fase mínima/lineal. |
| **`Mode`** | `Soft` / `Hard` | `Soft` para suavizado vocal transparente; `Hard` para baterías o distorsión áspera. |
| **`Delta`** | `On / Off` | Escucha exclusivamente las frecuencias resonantes eliminadas. |
| **`Mix`** | `0.0% a 100.0%` | Balance wet/dry. |

---

## 🎸 6. SOUNDTOYS — DECAPITATOR & ALTERBOY

### Soundtoys Decapitator
| Control Real | Rango | Comportamiento |
|---|---|---|
| **`Drive`** | `0 a 10` | Nivel de saturación analógica modelada. |
| **`Tone`** | `Dark (izq) a Bright (der)` | Ecualizador basculante tipo Tilt. |
| **`High Cut`** | `1 kHz a 20 kHz` | Filtro pasa bajos para redondear asperezas de distorsión. |
| **`Low Cut`** | `20 Hz a 1 kHz` | Filtro pasa altos para evitar saturación descontrolada en graves. |
| **`Thump`** | `On / Off` (Switch) | Realce resonante de graves justo en el punto de corte del Low Cut. |
| **`Style`** | `A, E, N, T, P` | `A` (Ampex 350 cinta); `E` (EMI TG consola); `N` (Neve 1057 germanio); `T` (Culture Vulture triodo); `P` (Culture Vulture pentodo). |
| **`Punish`** | `Button` | Inyección de +20 dB de ganancia extrema. |
| **`Mix`** | `0 a 100%` | Control de mezcla paralelo. |

### Soundtoys Little AlterBoy
| Control Real | Rango | Comportamiento |
|---|---|---|
| **`Pitch`** | `-12 a +12 semitonos` | Desplazamiento de tono de la señal vocal. |
| **`Formant`** | `-12 a +12` | Modificación del tracto vocal (cambio de garganta/timbre masculino a femenino). |
| **`Drive`** | `0 a 10` | Saturación a bulbos vintage incorporada. |
| **`Mode`** | `Transpose, Quantize, Robot` | `Transpose` (natural); `Quantize` (auto-tune duro); `Robot` (tono monótono fijado a una nota). |
| **`Mix`** | `0 a 100%` | Permite crear duplicados de octavas o armonías en paralelo. |

---

## 🌌 7. VALHALLA DSP — VINTAGEVERB & DELAY

### Valhalla VintageVerb
| Control Real | Rango | Comportamiento |
|---|---|---|
| **`Mix`** | `0.0% a 100.0%` | Mezcla dry/wet. |
| **`PreDelay`** | `0 ms a 500 ms` | Separación temporal entre voz seca y el inicio de la reverberación. |
| **`Decay`** | `0.20 s a 70.0 s` | Tiempo total de cola de reverb (RT60). |
| **`Color`** | `1970s, 1980s, Now` | `1970s` (reducido a 10kHz, oscuro); `1980s` (brillante pero cálido); `Now` (ancho de banda completo moderno). |
| **`Mode`** | 20+ algoritmos | `Concert Hall`, `Plate`, `Room`, `Chamber`, `Sanctuary`, etc. |
| **`High Cut`** | `100 Hz a 20 kHz` | Filtro para no entorpecer los agudos vocales. |
| **`Low Cut`** | `10 Hz a 1000 Hz` | Filtro para mantener limpio el registro de graves. |

---

## 🎤 8. ANTARES — AUTO-TUNE PRO
| Control Real | Rango | Comportamiento |
|---|---|---|
| **`Key` & `Scale`** | Tonalidades musicales | Escala mayor, menor, cromática, etc. |
| **`Retune Speed`** | `0.1 ms a 400.0 ms` | 0 = Efecto T-Pain / Travis Scott robótico instantáneo; 20-35 = Corrección pop moderna; 50-80 = Corrección transparente natural. |
| **`Flex-Tune`** | `0 a 100` | Permite libertad expresiva al alejarse de la nota y solo corrige al aproximarse. |
| **`Humanize`** | `0 a 100` | Añade variación natural en notas largas sostenidas. |

---

## 🟣 9. OFFSZN SUITE — PLUGINS PROPIOS DE WILLIE
| Plugin | Controles Clave | Función en STAR CHAIN |
|---|---|---|
| **`STAR CHAIN`** | `Artist Select`, `Vocal Macro`, `Chain Slots`, `Smart Fix` | Motor central de decisión y control de hardware/VST3 externo. |
| **`Easy Mix`** | `Amount` (0-100%), `Character`, `Air`, `Space` | Macro 1-Knob vocal de acción inmediata para maquetas y directos. |
| **`Easy Pitch`** | `Key`, `Scale`, `Speed`, `Formant` | Corrector de tono de latencia cero para grabación. |
| **`Easy Level`** | `Target`, `Tolerance`, `Max Boost/Cut` | Nivelador y automatizador de ganancia vocal. |
| **`Easy Deeser`** | `Frequency`, `Threshold`, `Reduction` | Supresor transparente de sibilancias. |
| **`Easy Clean`** | `Sensitivity`, `Floor`, `Hiss Reducer` | Supresor de ruidos de cabina y zumbidos. |
| **`Easy Master`** | `Loudness`, `Warmth`, `Clarity`, `Ceiling` | Finalizador estéreo y maximizador comercial. |
| **`Inka Kola`** | `Drive`, `Sweetness`, `Fizz`, `Tape Sat` | Saturador analógico cálido de armónicos dorados. |
| **`Omni Plugin`** | `Slot 1-4`, `Routing Matrix`, `Mix` | Rack multifunción modular. |

---

## 🔄 10. MATRIZ DE SUSTITUCIÓN INTELIGENTE (CUANDO FALTA UN PLUGIN)

| Etapa de Proceso | 1ª Opción (Referencia) | 2ª Opción (Equivalente) | 3ª Opción (Nativo / Alternativo) |
|---|---|---|---|
| **1. Supresión de Ruido** | **Waves NS1** (`NS1` fader) | **Waves Clarity Vx** | **OFFSZN Easy Clean** |
| **2. Afinación Vocal** | **Antares Auto-Tune Pro** | **Waves Tune Real-Time** | **OFFSZN Easy Pitch** |
| **3. Control de Dinámica / Level** | **Waves Vocal Rider** | **FabFilter Pro-C 2** (Vocal Style) | **OFFSZN Easy Level** |
| **4. Supresión de Resonancias** | **oeksound Soothe2** | **Waves Silk Vocal** | **FabFilter Pro-Q 3** (Dynamic Cut) |
| **5. Ecualización Quirúrgica** | **FabFilter Pro-Q 3** | **Waves F6 Dynamic EQ** | **Waves H-EQ** |
| **6. Preamplificador y Color** | **Scheps 73 (Neve 1073)** | **UA Neve 1073** | **Soundtoys Decapitator** (Style N) |
| **7. De-Essing (Sibilancias)** | **FabFilter Pro-DS** | **Waves Sibilance** | **OFFSZN Easy Deeser** |
| **8. Compresor de Ataque Rápido** | **Waves CLA-76** (Blacky) | **UA 1176LN** | **FabFilter Pro-C 2** (Punch Style) |
| **9. Compresor Óptico / Cuerpo** | **Waves CLA-2A** | **Teletronix LA-2A** (UAD) | **Waves RVox** |
| **10. Brillo y Aire Vocal** | **Slate Digital Fresh Air** (`Mid/High Air`)| **Maag Audio EQ4** (`Air Band`) | **FabFilter Pro-Q 3** (High Shelf dyn) |
| **11. Saturación Analógica** | **Soundtoys Decapitator** | **Waves Abbey Road Saturator** | **OFFSZN Inka Kola** |
| **12. Espacio y Reverb** | **Valhalla VintageVerb** | **Waves Abbey Road Plates** | **FabFilter Pro-R 2** |
| **13. Delay y Eco de Cinta** | **Soundtoys EchoBoy** | **Waves H-Delay** | **Valhalla Delay** |
| **14. Compresión de Bus / Master**| **SSL G-Master Bus Comp** | **FabFilter Pro-C 2** (Bus Style) | **UA SSL 4000 G Bus** |
| **15. Limitador Final / Loudness**| **FabFilter Pro-L 2** | **Waves L2 / L3** | **OFFSZN Easy Master** |

---

## 🎯 11. MAPEO POR GÉNERO Y ESTILO MUSICAL EN STAR CHAIN

### A. Trap Pesado / Drill (Ej. Travis Scott, Eladio Carrión, Duki)
- **Afinación:** `Auto-Tune Pro` (Retune Speed `0-5 ms`) o `Waves Tune Real-Time` (Speed `1 ms`).
- **Compresión 1:** `CLA-76` (Revision: Blacky, Ratio: 4:1 o 8:1, Attack: 3, Release: 7) → Aplana los transientes vocales.
- **Compresión 2:** `RVox` (Comp: -14 dB) → Da presencia inquebrantable que no se ahoga tras el 808.
- **Aire:** `Fresh Air` (`Mid Air`: 35%, `High Air`: 25%) → Brillo moderno que sobresale del beat.
- **Saturación:** `Decapitator` (Style: A o E, Drive: 2.5).

### B. Reggaetón Comercial / Perreo (Ej. Bad Bunny, Feid, Mora, Rauw Alejandro)
- **Afinación:** `Auto-Tune Pro` (Retune Speed `12-25 ms`, Flex-Tune `20`) → Afinación brillante pero melódica.
- **Preamplificador:** `Scheps 73` (High Shelf 12 kHz +2 dB, Low Shelf 110 Hz suave, HPF 80 Hz).
- **Compresión:** `CLA-2A` (Peak Reduction 40-50, aplicando 3-5 dB de reducción en coros) + `SSL Channel`.
- **Control:** `Soothe2` (Depth 2.5 en medios-altos) + `Sibilance` (Range -6 dB).
- **Espacialidad:** `Valhalla VintageVerb` (Color: 1980s, Mode: Concert Hall, Decay: 1.8s, PreDelay: 45 ms) + `EchoBoy` (Ping-Pong en 1/4 dotted).

### C. R&B Urbano y Soul Latino (Ej. Álvaro Díaz, Jesse Baez, Paloma Mami)
- **Afinación:** `Auto-Tune Pro` (Retune Speed `35-50 ms`, Humanize `40`).
- **Nivelador:** `Waves Vocal Rider` (Target -18 dBFS, Range ±3 dB, Speed Slow).
- **Compresión:** `Teletronix LA-2A` (suave y cálida a tubos).
- **Ecualización:** `PuigTec EQP-1A` (Boost 16 kHz Broad, Low Trick en 60 Hz).
- **Espacio:** `Abbey Road Chambers` o `Capitol Chambers` (reverb profunda y sedosa).