# 🧠 01. ARQUITECTURA DEL CEREBRO DE STAR CHAIN: RESPUESTA TOTAL SIN FALLAS

> **Objetivo:** Lograr que STAR CHAIN jamás responda *"No te entendí del todo"*. Debe comportarse exactamente como un Ingeniero de Mezcla Senior (híbrido Claude/Gemini) que comprende la jerga de productores y novatos, explica la decisión con lenguaje accesible y ejecuta las acciones en las perillas de los plugins en tiempo real.

---

## 💥 1. ANÁLISIS DE LA FALLA ACTUAL (POR QUÉ FALLÓ EL TEST)

En el test del usuario que mandaste:
* **Entrada del usuario:** `"corta los graves de la voz"`
* **Respuesta de STAR:** `"No te entendí del todo. ¿Qué quieres hacer?"`
* **Causa técnica raíz:** 
  1. STAR dependía de expresiones regulares (regex) duras en `fast.html` (`localIntent()`).
  2. Su única regla de graves buscaba palabras como `mucho grave`, `retumba`, `turbia`.
  3. No reconoció el verbo `"corta"`, ni la construcción gramatical de orden acústica.
  4. Al no haber coincidencia exacta en regex, cayó directo al `fallback()` ciego.

---

## 🏛️ 2. EL MOTOR HÍBRIDO EN 4 CAPAS (ZERO-FAILURE ENGINE)

Para que STAR CHAIN responda el 100% de las veces, implementamos un flujo en cascada:

```
                            USUARIO ESCRIBE
                                  │
         ┌────────────────────────▼────────────────────────┐
         │ CAPA 1: DICCIONARIO SEMÁNTICO ACÚSTICO          │
         │ (Respuesta instantánea < 10ms sin IA ni red)   │
         │ Reconoce intenciones claras directas            │
         └────────────────────────┬────────────────────────┘
                                  │ (Si la frase es ambigua o reflexiva)
         ┌────────────────────────▼────────────────────────┐
         │ CAPA 2: INTÉRPRETE DIFUSO DE JERGA (FUZZY NLP)  │
         │ Extrae: [Acción] + [Zona Frecuencial / Timbre]  │
         │ Ejemplo: "corta" + "graves" = High-Pass Filter  │
         └────────────────────────┬────────────────────────┘
                                  │ (Si el usuario hace preguntas estilo ChatGPT)
         ┌────────────────────────▼────────────────────────┐
         │ CAPA 3: CEREBRO LLM (Ollama Local / Groq Nube)  │
         │ Devuelve: Explicación Pro + JSON de Acciones    │
         └────────────────────────┬────────────────────────┘
                                  │ (En el caso extremo de sin internet ni Ollama)
         ┌────────────────────────▼────────────────────────┐
         │ CAPA 4: AUTO-RESOLUCIÓN CONTEXTUAL PROACTIVA    │
         │ "Detecto que quieres ajustar X, lo aplico..."   │
         └─────────────────────────────────────────────────┘
```

---

## 🗣️ 3. FORMATO DE SALIDA DUAL ESTILO GEMINI / CLAUDE

Cuando un usuario interactúa con un modelo de IA de primer nivel, no solo recibe una acción muda: recibe **entendimiento, pedagogía y seguridad**.

### Estructura de la Respuesta de STAR:
```json
{
  "speech": "Entendido. Vamos a limpiar el subgrave de tu voz por debajo de 90 Hz para quitar el emborronamiento del micrófono y darle aire al 808.",
  "reasoning": "Detección de exceso de energía baja o petición de corte. Acción de HPF correctivo.",
  "actions": [
    {
      "role": "EQ_CORRECTIVO",
      "preferred_plugin": "FabFilter Pro-Q 3",
      "fallback_plugin": "Waves SSL E-Channel",
      "params": {
        "band": 1,
        "type": "Low Cut / HPF",
        "frequency": 90,
        "slope": "24 dB/oct"
      }
    }
  ]
}
```

### Ejemplos Reales de Conversión:
1. **Usuario:** *"quiero que mi voz este más ruidoso"*  
   * **STAR explica:** *"Para que tu voz se escuche 'más ruidosa' y al frente sin romper el máster, necesitamos compresión analógica y saturación de transformador en vez de solo subir volumen. Voy a apretar el CLA-76 y sumar un toque de Decapitator."*  
   * **STAR ejecuta:** `CLA-76` (Ratio 4:1, Attack 3, Release 7, Input 60) + `Decapitator` (Style A, Drive 2.0).

2. **Usuario:** *"sácale el sonido a lata"*  
   * **STAR explica:** *"El sonido a lata o caja se concentra entre los 400 y 600 Hz. Voy a hacer un corte quirúrgico estrecho con Pro-Q 3 para que tu voz gane claridad de estudio."*  
   * **STAR ejecuta:** `Pro-Q 3` (Band 2: Bell @ 500 Hz, Q 3.0, Gain -3.5 dB).

---

## ⚡ 4. ¿CÓMO SE COORDINA CON EL PROCESAMIENTO C++ DE JUCE?

1. La interfaz web (`fast.html`) envía el comando a C++ mediante la llamada nativa:  
   `native('executeAcousticIntent', jsonPayload)`
2. El C++ de STAR CHAIN recibe el rol (`EQ_CORRECTIVO`, `COMPRESOR_ATAQUE_RAPIDO`, etc.).
3. Consulta el inventario real de la máquina:
   - ¿Tiene FabFilter Pro-Q 3? -> Lo ajusta.
   - ¿No lo tiene pero tiene Waves SSL E-Channel? -> Activa el knob `HP` en 90 Hz.
   - ¿No tiene Waves? -> Activa el ecualizador interno nativo de OFFSZN.
4. **Cero fallas, cero pantallas de error.**
