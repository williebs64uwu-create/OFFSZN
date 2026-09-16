# Guía de Comandos de Voz y Estado de Efectos - Vocal Preset

Documento oficial de referencia con todos los comandos de voz soportados, recetas de autor, atajos del sistema y el estado de implementación de cada efecto en el motor de audio DSP.

---

## 1. Estado de los Efectos en el Motor de Audio (DSP)

Actualmente el motor en tiempo real (**C++ DSP**) cuenta con **4 procesadores centrales estéreo** completamente funcionales y conectados tanto a la interfaz gráfica como al control por voz:

| Efecto | Estado DSP | Rango / Parámetros Principales | Audibilidad |
| :--- | :---: | :--- | :---: |
| **Reverb** | ✅ **100% Funcional** | Decay (0.1 a 6s), Damp/Darkness (0-100%), Ancho estéreo (0-100%), Pre-delay | Totalmente audible (rama paralela 100% wet con feedback cruzado) |
| **Delay** | ✅ **100% Funcional** | Tiempo en ms (10 a 1000ms), Feedback (0-95%), Modo Ping-Pong estéreo, Filtros HPF/LPF | Totalmente audible (DSP ping-pong dinámico) |
| **Chorus** | ✅ **100% Funcional** | Rate LFO (0.05 a 5 Hz), Depth (0-100%), Ancho estéreo, Color | Totalmente audible (modulación multivoz estéreo) |
| **Doubler** | ✅ **100% Funcional** | Desafinación (0 a 50 cents), Retardo microtemporal (0-40ms), Ancho estéreo | Totalmente audible (ensanchador y duplicador vocal) |

> **Nota sobre la pestaña "Mezcla" (Tono EQ, Compresor, Gate, De-Esser):**
> Esos procesadores están catalogados como *"Planificados"* en la interfaz visual porque no se deben aplicar de forma destructiva sobre la voz principal por defecto. Los 4 efectos esenciales que modelan el sonido del plugin son **Reverb, Delay, Chorus y Doubler** (visibles en la pestaña **Favoritos** y en sus respectivas secciones).

---

## 2. Comandos de Voz Disponibles para Probar

El plugin cuenta con un reconocedor de voz híbrido:
1. **Tier 1 (Instantáneo Offline/Local):** Reconoce palabras clave fonéticas en español e inglés directamente sin latencia.
2. **Tier 2 (IA NVIDIA Llama 3):** Si dices una frase coloquial o abstracta, la clasifica inteligentemente al comando adecuado.

---

### A. Ajustes Directos por Porcentaje (%)
Puedes pedir cualquier cantidad exacta del 0% al 100%:
- `"River al 50%"` o `"Reverb al 50%"`
- `"Pon reverb al 80%"`
- `"Delay al 25%"`
- `"Eco al 30%"`
- `"Chorus al 40%"`
- `"Doubler al 60%"`
- `"Reverb en 15%"`

*(Reconoce las variantes fonéticas: `river`, `rever`, `reber`, `riber`, `eco`, `diley`, `corus`, `dobles`, etc.)*

---

### B. Recetas de Autor (Presets Instantáneos)
Configuran la cantidad y los parámetros internos del procesador con un solo comando:

#### Reverb:
- `"Reverb íntima"`: Reverb corta y sutil (0.6s decay, 35% damp, cantidad 10%). Ideal para presencia vocal sin ensuciar.
- `"Reverb amplia"`: Reverb grande y espacial (2.8s decay, 40% damp, cantidad 20%). Ideal para baladas o coros flotantes.
- `"Reverb oscura"`: Reverb filtrada y profunda (1.8s decay, 80% damp, cantidad 18%). Evita sibilancias.

#### Delay:
- `"Slapback"`: Eco ultracorto clásico estilo rockabilly / reggaetón pegado (100ms, 10% feedback, cantidad 15%).
- `"Eco ping-pong"` o `"Delay ping-pong"`: Rebote alternado de izquierda a derecha (250ms, 25% feedback, estéreo 100%).
- `"Delay corchea"`: Retardo rítmico estándar (250ms, 25% feedback).

#### Doubler:
- `"Dobles anchos"` o `"Doubler ancho"`: Apertura lateral extrema (90% width, 6 cents detune, cantidad 20%).
- `"Doubler sutil"`: Pequeño engrosamiento vocal central (70% width, 4 cents detune, cantidad 12%).

#### Chorus:
- `"Chorus suave"`: Textura cálida y sedosa sin desafinación marcada (0.35 Hz, 25% depth, cantidad 15%).
- `"Chorus ancho"`: Modulación espacial envolvente (0.8 Hz, 65% depth, 95% width, cantidad 28%).

---

### C. Comandos Compuestos ("y")
Puedes activar dos efectos en la misma frase:
- `"Pon chorus suave y reverb oscura"`
- `"Slapback y reverb íntima"`
- `"Doubler ancho y delay ping-pong"`

---

### D. Subir / Bajar / Encender / Apagar
- **Activar:**
  - `"Activar reverb"`, `"Pon delay"`, `"Dame chorus"`, `"Enciende doubler"`, `"Mete reverb"`
- **Desactivar / Silenciar:**
  - `"Desactivar reverb"`, `"Quitar delay"`, `"Apagar chorus"`, `"Muta doubler"`, `"Quita river"`
- **Aumentar o reducir gradualmente (+5% / -5%):**
  - `"Más reverb"`, `"Sube delay"`, `"Aumentar chorus"`, `"Más doubler"`
  - `"Menos reverb"`, `"Baja delay"`, `"Reducir chorus"`, `"Menos river"`
- **Protección de negación:**
  - `"No quiero reverb"`, `"No pongas delay"` (lo desactiva de forma segura sin disparar falsos positivos).

---

### E. Comandos de Sistema y Navegación
- **Cambio de Modo de Vista:**
  - `"Modo hablar"`: Te regresa a la vista de voz con el botón central grande.
  - `"Modo efectos"`: Abre el rack con los diales circulares de cada módulo.
- **Ruteo de Audio:**
  - `"Modo inserto"`: Escuchas la voz limpia combinada con los efectos (para usar en el canal directo).
  - `"Modo envío"`: Salida 100% húmeda (ideal para canales de retorno/bus o send track).
- **Historial y Guardado:**
  - `"Deshacer"`: Revierte el último ajuste o cambio.
  - `"Rehacer"`: Recupera el cambio deshecho.
  - `"Guardar"`: Guarda el estado actual en la memoria del plugin.

---

## 3. ¿Cómo probarlo en tu DAW (ej. FL Studio)?
1. Abre el mixer y carga **Vocal Preset** en el insert donde esté tu micrófono.
2. Comprueba que el micrófono se escucha **completamente limpio** sin distorsión ni compresión no deseada.
3. Haz clic en **Presionar para hablar** (o en el botón `MIC` compacto en la esquina superior si estás en Modo Efectos).
4. Prueba decir:
   - *"River al 50%"* (verás cómo el dial de Reverb sube al 50% y la cola espacial entra al instante).
   - *"Slapback"* (el delay cambiará instantáneamente a eco corto).
   - *"Dobles anchos y reverb oscura"* (ambos efectos se activarán a la vez).
   - *"Quitar river"* (se apagará la reverb).
