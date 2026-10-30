# 🔍 02. SISTEMA DE AUTO-DETECCIÓN Y APRENDIZAJE DE PLUGINS NUEVOS

> **Tu idea:** *"Para plugins nuevos sería bueno que te diga como 'analizando plugin...' o algo así, para que sepa qué hacer y se guarda para no perderlo."*

---

## 💡 1. EL CONCEPTO: "AUTO-DISCOVERY & FINGERPRINTING"

Cuando un productor compra o instala un nuevo plugin VST3, STAR CHAIN no debe quedar ciego ni requerir una actualización de software para usarlo. 

STAR CHAIN debe tener la capacidad de **inspeccionar dinámicamente el árbol de parámetros del nuevo VST3**, deducir su función matemática y categorizarlo automáticamente.

---

## 🔄 2. EL FLUJO VISUAL EN EL CHAT DE STAR

Cuando el usuario abre STAR CHAIN y se detecta una nueva DLL/VST3:
1. En el chat aparece un indicador animado con la estrella:  
   `✨ "Detecté 1 plugin nuevo en tu sistema: [FabFilter Saturn 2]"`  
   `⚙️ "Analizando arquitectura de perillas y parámetros..."`  
   *(Tarda menos de 1 segundo)*
2. Al terminar:  
   `✅ "[Saturn 2] clasificado como: SATURADOR MULTIBANDA Y DISTORSIÓN ANALÓGICA. Ya puedo usarlo en tus cadenas."`
3. La ficha queda guardada en el disco local de la PC de Willie en:  
   `%APPDATA%\OFFSZN\STARCHAIN\learned_plugins.json`

---

## 🧬 3. HEURÍSTICA DE RECONOCIMIENTO DE PARÁMETROS (CÓMO DEDUCE QUÉ HACE CADA KNOB)

Los desarrolladores de plugins de audio (Waves, FabFilter, Slate, etc.) utilizan nombres estandarizados en sus parámetros VST3. STAR CHAIN lee la lista de parámetros que entrega el DAW y aplica esta matriz de clasificación:

### A. Si el plugin contiene parámetros como:
* `Threshold`, `Ratio`, `Attack`, `Release`, `Knee`, `Makeup`, `Gain Reduction`, `GR`, `Peak Reduction`  
  👉 **Categoría:** **`COMPRESOR`**
  * Si tiene `Lookahead` y `Ceiling` o `Margin` 👉 **Subcategoría:** **`LIMITADOR / MAXIMIZADOR`**.
  * Si tiene `Opto` o `T4` 👉 **Carácter:** **`ÓPTICO / VINTAGE`**.
  * Si tiene `Fast Attack` o `FET` 👉 **Carácter:** **`FET / AGRESIVO`**.

### B. Si el plugin contiene:
* `Frequency`, `Freq`, `Gain`, `Q`, `Bandwidth`, `HPF`, `LPF`, `Low Cut`, `High Cut`, `Shelf`, `Bell`  
  👉 **Categoría:** **`ECUALIZADOR`**
  * Si tiene más de 4 bandas 👉 **`EQ QUIRÚRGICO`**.
  * Si solo tiene frecuencias fijas (20, 30, 60, 100) 👉 **`EQ ANALÓGICO / PULTEC`**.

### C. Si el plugin contiene:
* `Decay`, `RT60`, `Pre-Delay`, `Room Size`, `Diffusion`, `Damping`, `Early Reflections`, `Tail`  
  👉 **Categoría:** **`REVERB / ESPACIALIDAD`**

### D. Si el plugin contiene:
* `Delay Time`, `Feedback`, `Ping-Pong`, `BPM Sync`, `Tape Head`, `Flutter`, `Echo`  
  👉 **Categoría:** **`DELAY / ECO`**

### E. Si el plugin contiene:
* `Drive`, `Saturation`, `Warmth`, `Tube`, `Tape`, `Distortion`, `Crush`, `Bias`, `Harmonics`  
  👉 **Categoría:** **`SATURADOR / COLOR ANALÓGICO`**

### F. Si el plugin contiene:
* `Retune`, `Correction`, `Speed`, `Key`, `Scale`, `Formant`, `Pitch`  
  👉 **Categoría:** **`CORRECTOR DE TONO / AFINADOR`**

### G. Si el plugin contiene:
* `De-Ess`, `Sibilance`, `Sidechain Freq`, `Split / Wide`  
  👉 **Categoría:** **`DE-ESSER`**

---

## 💾 4. ESTRUCTURA DEL ARCHIVO LOCAL (`learned_plugins.json`)

Cada vez que STAR analiza un plugin, guarda una ficha estructurada:

```json
{
  "plugin_name": "Fresh Air",
  "vendor": "Slate Digital",
  "category": "EXCITER_HIGH_SHEEN",
  "date_discovered": "2026-10-28T00:10:00Z",
  "controls": {
    "mid_presence": "Mid Air",
    "high_air": "High Air",
    "output_level": "Trim",
    "link_switch": "Link"
  },
  "usage_rules": {
    "trap_vocals": { "Mid Air": 35, "High Air": 25, "Trim": -2.0 },
    "reggaeton_vocals": { "Mid Air": 20, "High Air": 40, "Trim": -1.8 }
  }
}
```

> **Beneficio:** Esta base de datos es acumulativa. Con el tiempo, la PC de Willie se convierte en la más inteligente del mercado porque recuerda el 100% de los plugins instalados.
