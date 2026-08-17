# 💬 SISTEMA 2: EMBUDO DE CONVERSIÓN EN DMs, MANYCHAT & CIERRES
> **De la Conversación al Cash:** Automatización inteligente de cualificación, protocolo de demo en 60 segundos y manejo de objeciones para Willie Inspired.

---

## 🤖 1. EL FLUJO LÓGICO DE MANYCHAT

Para que no pierdas tiempo respondiendo a usuarios que no usan FL Studio o que solo buscan cosas gratis sin intención de compra, ManyChat actúa como un **filtro de cualificación**:

```mermaid
flowchart TD
    Trigger["1. Lead comenta palabra clave:<br/>'VOZ', 'PRESET', 'REGALO', 'EASY'"] --> DM1["2. ManyChat entrega Lead Magnet ($0)<br/>+ Pregunta 1: ¿Qué DAW usas?"]
    
    DM1 --> DAWChoice{"DAW Seleccionado"}
    DAWChoice -->|"FL Studio 🍊"| LeadHot["Lead Calificado 🔥<br/>(Tag: Lead_Calificado_FL)"]
    DAWChoice -->|"Otros DAWs / Celular 📱"| LeadCold["Lead Frío ❄️<br/>(Tag: Lead_Frio)"]
    
    LeadCold --> SendStore["Envía link general de Tienda OFFSZN"]
    
    LeadHot --> DM2["3. Pregunta 2: ¿Qué tipo de micrófono tienes?<br/>(USB / Condensador / Dinámico)"]
    DM2 --> DM3["4. Oferta de Demo Personalizada:<br/>'Mándame tu voz seca + beat por este chat'"]
    DM3 --> StopBot["5. Se detiene el bot 🛑<br/>Notificación para Willie"]
```

---

## 🎙️ 2. EL PROTOCOLO DE DEMO RÁPIDO DE 60 SEGUNDOS (PARA WILLIE)

Para no saturarte cuando recibas 20 audios diarios por DM:

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as 🎤 Cliente en DM
    actor Willie as 👑 Willie Inspired
    
    Cliente->>Willie: Envía archivo de voz seca (.wav/.mp3) + Instrumental
    Note over Willie: Abre FL Studio con proyecto TEMPLATE_TEST_WILLIE.flp
    Note over Willie: Arrastra voz seca al canal con Easy Mix / Cadena Willie
    Note over Willie: Ajusta autotune a la escala del tema (10 seg)
    Note over Willie: Exporta clip de 15s con Ctrl+R (5 seg)
    Willie->>Cliente: Envía nota/archivo de audio procesado por Instagram DM
    Willie->>Cliente: Envía Script de Cierre Venta Silenciosa con Enlace de $15
```

### ✍️ Script de Cierre por DM (Copy-Paste):
> *"¡Ahí te lo mandé hermano! 🎧 Escúchalo con audífonos.  
> Básicamente limpié la resonancia de cuarto en 300Hz, controlé los picos con el de-esser relativo y le inyecté el brillo fino estéreo de 20k.  
>   
> Como ves, el micro no era el problema. Si quieres tener esta misma cadena lista para usar en todos tus temas en 2 clics, te dejo el enlace de la plantilla completa de OFFSZN por solo $15 dólares: [ENLACE_CHECKOUT]  
>   
> Si te la llevas hoy, cualquier duda de instalación me avisas por aquí y te ayudo."*

---

## 🛡️ 3. MANEJO MAESTRO DE OBJECIONES (SCRIPTS DE RESPUESTA)

| Objeción del Cliente | Lo que realmente piensa | Script de Respuesta de Willie |
| :--- | :--- | :--- |
| **"No tengo dinero"** | *"No sé si esto realmente me va a servir"* | *"Tranquilo bro, te entiendo perfectamente. Por eso mismo te hice la prueba gratis primero para que escuches que con tu micro actual sí se puede sonar pro. El preset te sale $5 (menos de lo que cuesta un combo de comida) y te ahorra meses de frustración. Cuando estés listo me avisas."* |
| **"Mi PC es de bajos recursos"** | *"Tengo miedo de que me de lag en FL"* | *"Hermano, precisamente por eso diseñé Easy Mix y mis plantillas con ruteo optimizado en C++ y JUCE. No consume casi nada de CPU porque usa 1 sola instancia en vez de 12 plugins abiertos. Te va a correr fluido."* |
| **"Uso FL Studio crackeado o versión antigua"** | *"¿Será compatible?"* | *"Funciona perfectamente desde FL Studio 20 y 21 en adelante. Los presets son nativos y el plugin viene con su propio instalador automático en Windows y Mac."* |
| **"¿Y si no me gusta cómo queda?"** | *"Miedo a perder el dinero"* | *"Bro, si me compraste la plantilla y tienes dudas, me mandas captura de tu mixer y yo mismo te ayudo a calibrarla por DM hasta que tu voz suene exactamente como quieres."* |

---

## 📊 4. TRACKING INVERSO & PIPELINE DE LEADS

Para saber exactamente qué video o anuncio trajo las ventas:
1.  **Etiquetado por Trigger:** Cada palabra clave identifica el origen (`VOZ_REEL_32`, `MICRO_TIKTOK_ANTES`, `EASYMIX_PROMO`).
2.  **Score del Lead (1 al 10):**
    *   **Score 8-10:** Usa FL Studio + Envió audio seco + Respondió en <10 minutos. (Prioridad absoluta de cierre).
    *   **Score 5-7:** Usa FL Studio pero aún no envía el audio. (Enviar recordatorio a las 24 horas: *"Bro, ¿pudiste grabar la toma seca para tu prueba?"*).
    *   **Score 1-4:** Usa celular / BandLab. (Se le envía a la tienda general de OFFSZN).
