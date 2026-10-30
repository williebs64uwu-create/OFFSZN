# 📚 04. DICCIONARIO SEMÁNTICO DE PRODUCCIÓN Y JERGA URBANA

> **Propósito:** Esta tabla traduce cualquier expresión cotidiana (usada por ingenieros pro, productores urbanos o novatos que no saben términos técnicos) en la **acción exacta de mezcla** que STAR CHAIN debe ejecutar en los plugins de Willie.

---

## 🗂️ TABLA MAESTRA DE TRADUCCIÓN SEMÁNTICA

| Frase / Término que escribe el usuario | Categoría Acústica | Diagnóstico de STAR | Acción Técnica Ejecutada | Plugins de Willie Asignados |
|---|---|---|---|---|
| *"corta los graves"*, *"quítale el bajo"*, *"limpia el sub"*, *"menos peso"* | **Low Cut / HPF** | Residuos subsónicos, retumbe de cuarto o proximidad de micrófono. | Activa filtro Pasa-Altos (HPF) en 80-100 Hz con pendiente de 18 o 24 dB/oct. | `FabFilter Pro-Q 3`, `Waves SSL Channel`, `Scheps 73` |
| *"más ruidoso"*, *"más fuerte"*, *"más pegada"*, *"que rompa"*, *"con ponch"* | **Dinámica / Densidad** | Falta de energía sostenida (RMS bajo, picos descontrolados). | Compresión agresiva con ataque medio y release rápido + saturación analógica. | `Waves CLA-76` (Blacky, Ratio 4:1) + `Soundtoys Decapitator` |
| *"pon la voz al frente"*, *"que no se esconda"*, *"que flote sobre el beat"* | **Compresión Paralela / Glue** | La voz se ahoga detrás de las cajas y sintetizadores del instrumental. | Activa envío a bus de compresión paralela ('All-Buttons In' aplastada) a -18 dB. | `Waves RVox` (Comp -14 dB) + `SSL G-Master Bus Comp` |
| *"sácale el sonido a lata"*, *"suena a caja"*, *"está encajonada"*, *"ahogada"* | **Frecuencias Medias Bajas (Mud)** | Acumulación resonante entre 400 Hz y 700 Hz típica de cuartos no tratados. | Filtro Bell estrecho (Q 2.5) cortando entre -3 dB y -5 dB en la zona de 500 Hz. | `FabFilter Pro-Q 3` o `Waves F6 Dynamic EQ` |
| *"suena gangosa"*, *"nasal"*, *"parece que canta con la nariz tapada"* | **Medios Nasales** | Exceso de energía resonante en el tracto nasal (1.5 kHz a 3 kHz). | Corte Bell en 2.2 kHz de -3 dB con Q moderado (Q 2.0). | `FabFilter Pro-Q 3` o `oeksound Soothe2` |
| *"dame más aire"*, *"sonido caro"*, *"brillo sedoso"*, *"que respire"* | **Top-End / Exciter** | Señal opaca sin extensión por encima de los 10 kHz. | Realce dinámico de frecuencias ultra-altas (12 kHz - 20 kHz). | `Slate Digital Fresh Air` (`High Air` 35%) o `Maag Audio EQ4` (`Air Band` @ 20k) |
| *"me pican las eses"*, *"chilla"*, *"las eses están duras"*, *"lastima el oído"* | **Sibilancia / Dureza** | Transientes sibilantes excesivos entre 6 kHz y 9 kHz producidos por micrófonos de condensador brillantes. | De-Esser activado con detección focalizada en 7 kHz y rango de -6 dB. | `FabFilter Pro-DS`, `Waves Sibilance` o `OFFSZN Easy Deeser` |
| *"limpia el cuarto"*, *"se oye el ventilador"*, *"hay estática"*, *"ruido de fondo"* | **Denoiser / Supresión** | Piso de ruido acústico o electromagnético continuo. | Supresor espectral en tiempo real. | `Waves NS1` (`NS1` fader @ 25) o `Waves Clarity Vx` |
| *"que suene espacial"*, *"como en una iglesia"*, *"muy lejos"*, *"bañado"* | **Reverb Larga / Atmósfera** | Búsqueda de profundidad y cola amplia. | Reverb algorítmica con Decay largo (2.5 a 4.0 segundos) y Pre-Delay de 35 ms. | `Valhalla VintageVerb` (Concert Hall) o `Waves H-Reverb` |
| *"dale eco"*, *"eco trapero"*, *"repetición al tempo"* | **Delay / Repetición** | Sensación rítmica espacial urbana. | Delay sincronizado a semicorcheas o corcheas con puntillo (1/8 Dotted o 1/4) y feedback al 25%. | `Soundtoys EchoBoy` o `Waves H-Delay` |
| *"afíname la voz"*, *"modo robot"*, *"efecto trapero"*, *"flow Travis"* | **Pitch Correction Duro** | Efecto de corrección instantánea de entonación. | Retune speed en 0 ms o 1 ms con escala de la pista musical. | `Antares Auto-Tune Pro`, `Waves Tune Real-Time` o `OFFSZN Easy Pitch` |
| *"voz gruesa"*, *"voz de demonio"*, *"voz de monstruo"*, *"bájale el tono"* | **Formant & Pitch Shift** | Desplazamiento tímbrico hacia graves sin perder el tempo. | Pitch -12 semitonos, Formant -3 a -5, Mix 50% para duplicado. | `Soundtoys Little AlterBoy` o `Waves Vocal Bender` |

---

## 🧠 CÓMO USARÁ ESTE DICCIONARIO LA IA:
Si el usuario escribe cualquier frase, el motor de STAR busca las raíces de las palabras (ejemplo: `graves` + `corta` / `quitar`). 
Si coincide con la tabla, **aplica la solución al milisegundo**. 
Si el usuario hace una pregunta abierta de varias líneas, le pasa este diccionario al LLM local como contexto para que responda con la misma coherencia técnica.
