# 💬 Guía y Scripts del Funnel de DMs (ManyChat & Conversión)

Este documento detalla la estructura lógica de automatización y los scripts de copy-paste para el embudo de DMs de **OFFSZN / Willie Inspired**.

---

## 🤖 1. Estructura Lógica de ManyChat (Cualificación Automatizada)

Para evitar perder tiempo con curiosos o personas que no usan tu software y enfocar tu energía de "Prueba Personalizada" en prospectos de alto valor (Score >= 5/10), programaremos este flujo de preguntas y respuestas automáticas.

### 📌 Paso 1: Trigger de Palabra Clave
*   **Triggers**: El usuario comenta en tus Reels o envía un DM con las palabras clave: `"PRESET"`, `"MAQUETA"`, `"REGALO"` o `"PRUEBA"`.
*   **Acción Automatizada**: ManyChat responde al instante por DM y añade la etiqueta `"Lead_Iniciado"`.

---

### 📌 Paso 2: Mensaje Inicial y Primera Pregunta (DAW)
*   **Mensaje 1 (ManyChat)**:
    > *"¡Qué onda hermano! Qué gusto que quieras sonar pro. Aquí tienes tu link para descargar el Preset de Limpieza Gratis (Nativo de FL Studio): [Enlace de Descarga]  
    >   
    > Por cierto, para poder recomendarte los presets de artistas que mejor le queden a tu estilo... ¿qué programa (DAW) usas para grabar y mezclar tus voces?"*
*   **Botones de Opción Rápida**:
    *   `[ FL Studio 🍊 ]`
    *   `[ Ableton / Logic / ProTools 🎚️ ]`
    *   `[ Grabo con celular/BandLab 📱 ]`

---

### 📌 Paso 3: Lógica de Condicionales (Cualificación / Scoring)

#### 🛑 Ruta A: Lead Frío / No Cualificado
*   **Filtro**: Si elige `Grabo con celular/BandLab` o `Otro programa`.
*   **Etiqueta**: `"Lead_Frio"`.
*   **Respuesta de ManyChat**:
    > *"¡Buenísimo! Te comento que mis plantillas principales están optimizadas para FL Studio, pero igual te dejo el enlace de la tienda donde tengo varios presets individuales compatibles con otros programas: [Tienda OFFSZN]"*

#### 🟢 Ruta B: Lead Calificado (Score >= 5/10)
*   **Filtro**: Si elige `FL Studio 🍊`.
*   **Etiqueta**: `"Lead_Calificado_FL"`.
*   **Acción**: Disparar la segunda pregunta (Micrófono) para perfilar sus necesidades.
*   **Mensaje 2 (ManyChat)**:
    > *"¡Uff, FL Studio es el rey! Y una última duda para saber qué cadena te sirve más... ¿qué tipo de micrófono tienes actualmente?"*
*   **Botones de Opción Rápida**:
    *   `[ Micro USB (Cualquiera) 🎙️ ]`
    *   `[ Condensador + Interfaz 🎛️ ]`
    *   `[ Dinámico (tipo Shure SM58) 🎤 ]`

---

### 📌 Paso 4: Disparo de la Oferta de "Prueba Personalizada"
Una vez que responde a su tipo de micrófono, el sistema le asigna la etiqueta definitiva y le ofrece el demo personalizado de forma automática.

*   **Mensaje 3 (ManyChat)**:
    > *"¡Excelente! Como usas FL Studio y tu micrófono es [Tipo de Micro seleccionado], te tengo una propuesta brutal:  
    >   
    > Mándame por este mismo chat un archivo de audio con tu voz completamente seca (sin efectos ni autotune) + la pista instrumental (beat) de tu tema.  
    >   
    > Yo mismo le aplico mi plantilla de mezcla completa en FL Studio y te devuelvo un preview de 15 segundos para que escuches en tus propios auriculares cómo cambia el sonido en 2 clics. ¿Te late?"*
*   **Etiqueta**: `"Esperando_Audio_Prueba"`.

---

## 🎙️ 2. Scripts Manuales para Willie (El Cierre por DM)

Una vez que el usuario te envía el audio seco y el beat, la automatización se detiene y tú (o tu asistente) tomas el control de la conversación para cerrar la venta de forma humana y de alta confianza.

### 👣 Paso A: Recepción del Audio
Cuando recibes los archivos, envías un mensaje corto y amigable:
> *"¡Recibido bro! Dame unos minutos, lo meto al mixer de FL Studio con mi plantilla premium y te paso el preview para que escuches la magia."*

---

### 👣 Paso B: Mezcla Rápida (El Cheat Code de Willie)
1.  Importas la voz y el beat a tu FL Studio.
2.  Arrastras tu plantilla vocal de OFFSZN al canal de la voz.
3.  Ajustas rápidamente el volumen y el autotune al tono de la pista.
4.  Exportas un clip de audio de 15 segundos (un antes/después o directamente el procesado).
5.  Le envías el preview de audio por DM de Instagram (como nota de voz o como archivo reproducible).

---

### 👣 Paso C: El Cierre de Venta (Venta Silenciosa)
Una vez enviado el preview de audio, aplicas esta plantilla de copy:

> *"Ahí te lo mandé hermano. Escúchalo con audífonos. Básicamente le puse la cadena de mezcla de [Nombre del Artista de Referencia / Estilo] que viene en mi plantilla premium: limpié los graves sucios de habitación, acomodé las frecuencias medias y le di el brillo fino estéreo de 20k.  
>   
> Cuéntame, ¿qué tal te pareció el cambio?"*

*(El lead responde maravillado...)*

> *"¡Qué nivel bro! Me alegra que te gustara. La verdad es que con la plantilla de mezcla completa de OFFSZN te ahorras tener que perillear 15 plugins de cero. Solo arrastras tus tomas y grabas directamente.  
>   
> Te dejo aquí el enlace para que te lleves la plantilla completa por solo $15 dólares: [Enlace de Compra]  
>   
> Cualquier duda que tengas al instalarla me avisas por aquí y te ayudo."*
