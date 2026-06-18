# Teoría y Psicoacústica: EASY MIX - OFFSZN

Este documento explica de forma detallada qué hace cada módulo internamente bajo el capó (DSP), y analiza desde una perspectiva teórica qué le falta a la mezcla para sonar enorme, ancha y tridimensional.

---

## 1. Funcionamiento de los Módulos Actuales

### 🔵 SECCIÓN: LIMPIEZA
*El objetivo de esta sección es remover frecuencias innecesarias y controlar el rango dinámico antes del procesamiento aditivo (adición de armónicos).*

- **Eliminar Ruido (Noise Gate):** Utiliza un expansor/puerta de ruido para atenuar la señal por debajo de un `Umbral` determinado. La `Cantidad` controla cuán agresiva es la atenuación.
- **Equilibrar Voz (Vocal Rider):** En lugar de comprimir estáticamente, este módulo calcula el RMS de la voz en tiempo real y ajusta automáticamente la ganancia hacia un "target" (objetivo). Mantiene la voz en la cara de la mezcla sin aplastar los transitorios.
- **Quitar Graves (Low Cut):** Un filtro paso alto (HPF) asimétrico. Quita las frecuencias subsónicas (retumbo, efecto de proximidad del micro) para hacer espacio para el bajo/808.
- **Quitar Cartón (Boxy Cut):** Filtros dinámicos de campana (Notch/Bell) en la región de 250Hz - 500Hz. Remueve esa resonancia "a caja" o "nasal" típica de cuartos no tratados acústicamente.
- **5. De-esser (Split-Band con Detección Relativa)**
- **Motor de Detección Relativa**: En lugar de usar un umbral fijo absoluto que puede fallar si la voz sube o baja de volumen (y causar "siseos" indeseados o matar el brillo en partes suaves), el motor cuenta con una técnica de seguimiento relativo (Relative Loudness Tracking). Compara constantemente la energía **RMS de banda ancha (toda la voz)** contra la energía **RMS de la banda de sibilancia (5-8 kHz)**. Si la banda de sibilancia excede a la voz por un diferencial determinado (ej. +6 dB), el compresor actúa.
- **Procesamiento Split-Band**: La atenuación solo se aplica a la banda alta (sobre 5.5 kHz) usando filtros de cruce de grado de masterización (Linkwitz-Riley 24dB/octava). Así la voz mantiene su cuerpo y graves sin verse afectada. Limitamos la atenuación a un máximo de -15dB para no crear un efecto "lispy" (ceceo artificial).

### 🔴 SECCIÓN: COLOR Y CUERPO
*Aquí se añade densidad, carácter y brillo a la señal limpia.*

- **Compresor (Tipo CLA-76 / LA-2A):** Comprime los picos de la voz para pegarla a la instrumental.
  - *Modo Suave (LA-2A):* Compresor óptico con ataques y relajaciones lentas. Respeta la musicalidad.
  - *Modo Agresivo (CLA-76/FET):* Tiempos de ataque ultrarrápidos para atrapar transitorios violentos y hacer la voz más presente y "En la cara".
- **Presencia (Medios y Altos):** Utiliza técnica de **Mid/Side**. Excita las frecuencias medias y altas para añadir definición y corte en la mezcla (Corta a través del beat).
- **Cinta (Saturación Saturn / Spectre):** Un algoritmo multibanda avanzado. Por debajo, satura suavemente con calor analógico (estilo Tape). Por arriba, inyecta armónicos asimétricos paralelos (estilo Tube/Exciter). Da densidad sin afectar el bajo de la voz.
- **Brillo Fino (Air Band 20k):** Emula los legendarios ecualizadores Maag (Banda de aire de 10k, 16k y 20k). Añade un "polvo de hadas" ultra agudo que da la sensación de una voz cara y espaciosa sin sonar áspera.

### 🟣 SECCIÓN: ESPACIO Y FX
*Dimensión tridimensional.*

- **6. Procesamiento Espacial (True Stereo Reverb, Delay)**
- **Stereo Width y Haas Effect**: El plugin introduce el efecto Haas (retraso corto de ~15-30 ms en un canal) que convierte una voz mono en estéreo. Se incluye cancelación Mid/Side de graves en el 'Side' para mantener un anclaje fuerte de las bajas frecuencias en el centro.
- **True Stereo Reverb**: Anteriormente el plugin corría dos motores mono independientes (dual-mono) que al recibir voces mono sumaban sus señales de vuelta a mono, anulando el estéreo. Ahora utiliza procesamiento interno "True Stereo" (procesando bloques estéreo unificados por cada capa de reverberación) de forma que el motor inserta de-correlación algorítmica, expandiendo la señal mono hacia un tail completamente estéreo.
- **Arquitectura de Reverb Macro-morphing (Híbrida)**: Emplea tres capas mezclables algorítmicamente: Room Intimo, UAD Plate y Valhalla 1980s Hall. Se añade compresión con sidechain automático (ducking), de modo que cuando la voz canta, la reverberación baja en volumen y no ensucia el mensaje. Cuando el cantante se calla, el efecto "sube" llenando el vacío.
- **True Ping-Pong Delay**: Un retardo clásico de estéreo que cruza la retroalimentación de L a R y de R a L.

---

## 2. ¿Qué le falta a la mezcla? (Análisis Teórico)

Para que el sonido pase de sonar "bien" a sonar **"HUGE" (Enorme, Ancho y Tridimensional)**, desde la psicoacústica faltan estos elementos que suelen procesarse en *buses paralelos* o en el máster vocal:

### A. Excitación Estéreo (Dimension Expander y Micro-Pitch)
Tu plugin **ya soluciona gran parte de esto** con los modos **CLA** y **DOUBLER** en la perilla de Estéreo. 
- **Teoría (Micro-Pitch Shifting):** Para que una voz suene ancha como un disco moderno (ej. The Weeknd, Travis Scott), se envía la voz a un canal estéreo, pichando el lado izquierdo `-9 cents` y el lado derecho `+9 cents` con delays de `12 ms` y `24 ms`. El cerebro no lo percibe como un coro ni como un eco, sino como **grosor masivo**. *Tus modos actuales ya aplican estas bases de desfasaje y efecto Haas para ensanchar, logrando esa amplitud sin botones extra.*

### B. Saturación Paralela Extrema (Vocal Crush Bus)
- **Teoría:** La saturación directa en el canal inserto (lo que hace nuestro knob de "Cinta" actualmente) tiene un límite antes de que se pierda la inteligibilidad. Para lograr un sonido gigante, los ingenieros profesionales usan un **Bus Paralelo**. Aplastan la señal duplicada con un compresor a ratio 100:1 (Distortion/Fuzz), cortan todos los graves por debajo de 600Hz y los agudos por encima de 5kHz, y mezclan esa "basura armónica" muy por debajo de la señal original. Esto añade *peso* sin perder la nitidez de los transitorios.

### C. Compresión Sidechain Multibanda en la Instrumental
- **Teoría (Enmascaramiento de Frecuencias):** Tu plugin procesa la voz increíblemente, pero el sonido de la mezcla nunca será enorme si la instrumental choca con la voz. Se necesita un EQ dinámico (como Trackspacer o Soothe2) en el grupo de la Instrumental que lea la voz y atenúe **solo** las frecuencias donde la voz tiene energía principal (usualmente de 1kHz a 4kHz), milisegundo a milisegundo.

### D. Reverberación en Capas (El Secreto de la Profundidad Asíncrona)
- **Teoría:** Un sonido vocal "Huge" moderno casi nunca se logra con una sola reverb. La teoría avanzada indica que se deben usar **3 capas de reverb** trabajando de forma asíncrona:
  1. **Reverb de Cuarto (Room/Chamber) muy corta (<0.8s):** Sin pre-delay. Se fusiona con la voz para darle "cuerpo" tridimensional 3D sin que suene a que está en una cueva.
  2. **Reverb de Placa (Plate) media (1.5s):** Con un pre-delay de unos 20ms a 30ms. Le da ese brillo metálico clásico del pop a las vocales, aportando un "halo" brillante alrededor de las frecuencias medias.
  3. **Reverb de Salón (Hall) larga (3.0s+):** Con un Pre-Delay calculado al tempo (ej. 1/64 o 1/32 de nota, usualmente 60ms a 100ms). Esto asegura que la consonante de la voz principal "cruce" clara al frente de los monitores, y una fracción de segundo después explote la cola gigante por detrás, sin ensuciar la inteligibilidad.

## 3. Creative FX (Módulos de Efectos Especiales)

En la nueva versión, el panel de Efectos cuenta con 4 módulos rediseñados y basados en procesadores profesionales modernos:

### A. Coldfire Distorsión (Drive & Foldback)
- **Teoría:** Basado en distorsiones multibanda y de waveshaping como el *Arturia Coldfire*. En lugar de un simple clipping digital (Bitcrusher clásico), aplica algoritmos de Foldback y saturación por onda sinusoidal (`std::sin`), lo cual retuerce la señal armónica de forma analógica. Cuenta con un nivelador de volumen (Recorte) que compensa la ganancia añadida por el drive intenso para mantener bajo control la dinámica sin aplastar todo.

### B. Modo Teléfono (Filtro Bandpass Extremo)
- **Teoría:** Clásico efecto de "voz de radio" o "teléfono". En lugar de filtros simples de 1er o 2do orden, usa filtros Linkwitz-Riley y Butterworth en cascada logrando un corte brutal de **36dB/octava** (6to orden). Esto encapsula la voz exactamente entre 300Hz y 3kHz, imitando a la perfección la respuesta de frecuencias limitada de una bocina antigua, sumado a una sutil distorsión que engorda las frecuencias resultantes.

### C. Endless Smile (Dada Life Style Build-Up)
- **Teoría:** Imitando el plugin de *Dada Life*, este es un efecto "macro" de un solo knob para crear subidas (Build-ups) masivas antes de un Drop. Mientras subes la Intensidad, no solo crece el tamaño y duración de la Reverb hasta el infinito (congelando la señal al 100%), sino que además el *Volumen general se reduce sutilmente* de forma automática (-4dB). Esto crea una sensación psicoacústica de que el audio se aleja, de modo que cuando el efecto se apaga (el drop), el volumen seco golpea con una fuerza brutal.

### D. Ghost Reverb (Convolver / Eco Reverse)
- **Teoría:** Logra el clásico sonido de "AAAAAAA amigos". Actúa como una Reverb pre-delay infinita. Tiene tiempos de retraso inmensos (hasta 1000ms), lo que retrasa por completo la cola del efecto para que suene **después** de la palabra cantada. Usado con Feedback, actúa como un ecos de convolución densos, creando paredes de sonido envolvente espectrales. La absorción de agudos es brutal para generar un color oscuro o "fantasmal".
