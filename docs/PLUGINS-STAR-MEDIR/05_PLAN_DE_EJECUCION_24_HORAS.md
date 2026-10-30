# ⏱️ 05. PLAN DE EJECUCIÓN MAESTRO DE 24 HORAS PARA STAR CHAIN

> **Contexto:** Tienes un plazo crítico de **24 horas** para terminar y contrastar con Claude Code. 
> Este plan te da el cronograma exacto hora por hora, priorizando lo que genera máximo impacto y eliminando pérdidas de tiempo.

---

## 🕒 CRONOGRAMA HORA POR HORA (24 HORAS)

```
[HORAS 01-04] ➔ Blindaje Semántico del Chat (Solución a "corta los graves" y "más ruidoso")
[HORAS 05-08] ➔ Módulo de Detección de Plugins Nuevos ("Analizando plugin...")
[HORAS 09-14] ➔ Conexión del Cerebro Dual (Respuesta Educativa Gemini + Acciones VST3)
[HORAS 15-18] ➔ Mapeo de Waves V16 & Plantilla Universal UAD
[HORAS 19-21] ➔ Pruebas con Casos Extremos en FL Studio / Host VST3
[HORAS 22-24] ➔ Pulido Visual, Compilación Release y Empaquetado Final
```

---

### 📍 FASE 1: HORAS 01 A 04 — BLINDAJE SEMÁNTICO (CERO FALLAS EN CHAT)
* **Objetivo:** Eliminar para siempre el error *"No te entendí del todo"*.
* **Tareas Clave:**
  1. Integrar el Diccionario Semántico en `Source\ui\fast.html`.
  2. Implementar detector difuso de intenciones: si el texto contiene cualquier variación de *corte / bajo / grave / retumbe*, ejecutar inmediatamente la acción de corte de graves.
  3. Si contiene *ruidoso / fuerte / volumen / pegada*, ejecutar compresión y saturación.
* **Resultado al finalizar la Hora 4:** El usuario puede escribir cualquier frase cotidiana urbana y STAR responde al instante ejecutando la orden.

---

### 📍 FASE 2: HORAS 05 A 08 — DETECCIÓN INTELIGENTE DE PLUGINS NUEVOS
* **Objetivo:** Cumplir el requerimiento de Willie: *"para plugins nuevos te dice analizando plugin y lo guarda para no perderlo"*.
* **Tareas Clave:**
  1. Crear la rutina de fingerprinting VST3: cuando la librería detecta un plugin no catalogado, lee su lista de parámetros.
  2. Clasificarlo automáticamente según la heurística de palabras clave (`Threshold` -> Compresor, `Freq` -> EQ, `Decay` -> Reverb).
  3. Guardar la ficha en `%APPDATA%\OFFSZN\STARCHAIN\learned_plugins.json`.
  4. Mostrar en pantalla la animación de la estrella con el mensaje: `✨ "Analizando plugin nuevo..."`.
* **Resultado al finalizar la Hora 8:** Willie puede instalar cualquier VST3 nuevo y STAR CHAIN lo aprende en 1 segundo.

---

### 📍 FASE 3: HORAS 09 A 14 — CEREBRO DUAL LLM (RESPUESTA ESTILO GEMINI/CLAUDE)
* **Objetivo:** Que cuando el usuario pregunte algo complejo (*"¿cómo mezclo mi voz para un tema tipo Myke Towers?"*), STAR responda con la pedagogía y profundidad de un Claude o Gemini.
* **Tareas Clave:**
  1. En `AiClient.h`, conectar el motor local (Ollama Qwen/Gemma) o respaldo de alta velocidad (Groq/Nvidia).
  2. Inyectar el System Prompt especializado de STAR CHAIN con la `plugin_bible.md`.
  3. Separar la respuesta en:
     - Mensaje conversacional amigable para la vista del chat.
     - Array de acciones VST3 que el motor C++ aplica a la pista.
* **Resultado al finalizar la Hora 14:** STAR habla y razona como un ingeniero senior de estudio de grabación.

---

### 📍 FASE 4: HORAS 15 A 18 — MAPEO DE WAVES Y PLANTILLAS UAD
* **Objetivo:** Consolidar los 1,523 plugins reales de Willie.
* **Tareas Clave:**
  1. Validar los ~85 módulos base de Waves V16 (NS1, RVox, CLA, SSL, Scheps, PuigTec, H-Delay, etc.).
  2. Activar las 4 familias de Plantilla Universal para UAD (1176, LA-2A, Pultec, Neve).
  3. Asegurar que los plugins Image-Line/Fruity queden formalmente bloqueados del ruteo externo.
* **Resultado al finalizar la Hora 18:** Todo el catálogo de hardware virtual de la PC de Willie está interconectado.

---

### 📍 FASE 5: HORAS 19 A 21 — CONTROL DE CALIDAD Y PRUEBAS REALES
* **Objetivo:** Probar el sistema en condiciones reales dentro de FL Studio y Standalone.
* **Pruebas Obligatorias:**
  - Test 1: `"corta los graves de la voz"` -> Debe activar HPF en 90 Hz.
  - Test 2: `"quiero que mi voz suene más ruidosa"` -> Debe apretar CLA-76 y sumar saturación.
  - Test 3: `"quítale las eses"` -> Debe activar De-Esser.
  - Test 4: `"suena como en una lata"` -> Debe cortar en 500 Hz.
  - Test 5: `"estilo Feid"` -> Debe cargar afinación brillante, reverb de placa y delay ping pong.
* **Resultado al finalizar la Hora 21:** Cero cuelgues, cero respuestas vacías, 100% de efectividad en el test.

---

### 📍 FASE 6: HORAS 22 A 24 — COMPILACIÓN RELEASE Y ENTREGA
* **Objetivo:** Compilar binarios limpios y generar el instalador final.
* **Tareas Clave:**
  1. Compilar `STAR CHAIN.vst3` y `STAR CHAIN.exe` en configuración Release con CMake y MSVC.
  2. Validar que la licencia y el trial operen sin conflictos.
  3. Empaquetar el instalador Inno Setup si corresponde.
* **Resultado al finalizar la Hora 24:** Producto 100% terminado, estable y listo para lanzamiento comercial.

---

## ⚖️ TABLA COMPARATIVA PARA CONTRASTAR CON CLAUDE CODE

Cuando evalúes opciones con Claude Code, utiliza este checklist de validación:

| Criterio | Solución Propuesta Aquí | Enfoques Típicos Débiles |
|---|---|---|
| **Manejo de Errores** | Motor en 4 capas (Zero-Failure) con diccionario semántico + LLM. | Regex rígidas que fallan ante cualquier cambio de palabra. |
| **Plugins Nuevos** | Auto-discovery de parámetros VST3 + guardado persistente en JSON. | Requiere reprogramar el código cada vez que sale un plugin. |
| **Catálogo Waves** | Mapeo por módulos base (~85 procesadores) que cubre las 723 instancias. | Tratar de mapear 723 archivos a mano de forma caótica. |
| **Catálogo UAD** | 4 Plantillas Universales de Hardware analógico. | Dejar UAD fuera o intentar mapear 452 entradas una por una. |
| **Respuesta de IA** | Salida dual: Explicación estilo Gemini + JSON de perillas ejecutables. | Respuestas de texto vacías que no mueven ningún knob en el DAW. |
