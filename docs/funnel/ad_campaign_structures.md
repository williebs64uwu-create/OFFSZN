# 🎯 Estructura de Campañas de Anuncios (Ads & Retargeting)

Este documento detalla la configuración técnica, copys y estructuras de audiencias para las campañas de Meta Ads de **OFFSZN / Willie Inspired**, basadas en los Sistemas 2 y 3 del transcript.

---

## 👥 Campaña 1: Robar Audiencia a Mundopineapple

El objetivo es extraer los emails de los seguidores del competidor `_pineapplemusic` (que cobra hasta $100 por presets de voz) y mostrarles anuncios para que visiten tu perfil e interactúen, sabiendo que ya están pre-educados en el nicho y que tus precios ($5 - $15) ofrecen un contraste de valor absurdo.

### ⚙️ Configuración Técnica
1.  **Herramienta de Extracción**: Utiliza **Growman** o **Mailerfind** para scrapear y descargar la base de datos de los seguidores de la cuenta de TikTok o Instagram `@_pineapplemusic`.
2.  **Público Personalizado en Meta**:
    *   Ve a *Administrador de anuncios* -> *Públicos* -> *Crear público* -> *Público personalizado* -> *Lista de clientes*.
    *   Sube el archivo CSV con los emails y teléfonos extraídos. Meta emparejará estos perfiles (tasa de éxito de coincidencia aproximada de 30-50%).
3.  **Objetivo de Campaña**: Tráfico -> **Visitas al perfil de Instagram**.
4.  **Presupuesto**: $2 a $5 USD diarios para empezar.

### ✍️ Creativo y Copy del Anuncio (Vídeo Corto 9:16)
*   **Visual**: Willie mostrando la página de `mundopineapple.com` en su pantalla y luego girándose hacia FL Studio.
*   **Hook**: *"No pagues $100 dólares por un preset de voz..."*
*   **Cuerpo**: *"Sé que quieres sonar pro en tu Home Studio, pero vaciar tu billetera en presets no es la solución. He diseñado plantillas de mezcla completas con de-esser relativo y ensanchamiento estéreo real por solo $15, y presets individuales de artistas por $5. Mismo micrófono, misma calidad de estudio comercial, a una fracción del costo."*
*   **CTA**: *"Toca en 'Más información', sígueme en mi perfil y pruébalo tú mismo gratis."*

---

## 📺 Campaña 2: Retargeting Largo (Vocal Mix Masterclass)

Esta es tu campaña principal de nutrición. Se muestra únicamente a personas que ya interactuaron con tu cuenta (engaged custom audiences) o visitaron `offszn.lat` en los últimos 90 días.

### ⚙️ Configuración Técnica
1.  **Audiencia**: Público personalizado de Interacción con Instagram (30-90 días) + Visitantes del sitio web (30-90 días).
2.  **Objetivo**: Mensajes (iniciar conversación por DM) o Clientes potenciales (si los mandas a una landing). La recomendación de Francisco es **Mensajes / Conversación por DM** usando la palabra clave `"MASTERCLASS"`.
3.  **Formato**: Vídeo horizontal (16:9), filmado como una clase aburrida de experto, sin cortes dinámicos rápidos.

### 📝 Estructura de Contenido del Video (12 Minutos)

*   **Min 0:00 - 1:30: El Contraste del Hardware**: Willie desmiente la idea de que necesitas una habitación tratada de $2000 y un Neumann. Muestra una voz mezclada con presets y otra seca.
*   **Min 1:30 - 4:00: Módulo Limpieza Dinámica**:
    *   *Low Cut*: Por qué cortar subsónicos limpia el rango de los 808/bajos.
    *   *Boxy Cut*: Explicar que el eco del cuarto se acumula entre 300Hz y 500Hz y cómo atenuarlo de forma quirúrgica.
    *   *De-esser Relativo*: En vez de usar un umbral fijo que cecea, explicar la detección relativa (Wideband RMS vs Sibilance RMS).
*   **Min 4:00 - 7:00: Módulo Color e Inyección Armónica**:
    *   *Compresión CLA-76/LA-2A*: Diferencia entre compresión óptica suave y compresión rápida FET para dar agresividad y presencia.
    *   *Saturación Multibanda*: Inyectar armónicos en medios y agudos para que la voz resalte en la instrumental (Corte).
    *   *Air Band*: La frecuencia mágica de 20kHz (inspirada en Maag EQ) para dar sensación de mezcla cara y espaciosa.
*   **Min 7:00 - 10:00: Módulo de Espacio (Estéreo Pro)**:
    *   *True Stereo Reverb*: Explicar por qué dos reverbs mono se cancelan al sumarse, y cómo una verdadera reverb estéreo con de-correlación algorítmica y *ducking* (compresión sidechain automática de voz a reverb) mantiene la voz al frente sin ensuciar la cola.
    *   *Efecto Haas / Micro-pitch*: Cómo ensanchar la voz con micro-desafinaciones de +/- 9 cents.
*   **Min 10:00 - 12:00: Pitch de Conversión**:
    *   *"Tienes dos opciones: gastar cientos de dólares en plugins individuales y pasar 3 horas reconstruyendo esto en cada sesión, o llevarte mi plantilla de mezcla completa por $15 que ya tiene todo el ruteo de buses listo en 2 clics. Toca abajo, coméntame 'MASTERCLASS' y te paso el link directo."*

---

## 📅 Campaña 3: Booking Page Visitors (Retargeting Ultra Caliente)

Esta campaña va dirigida a las personas que iniciaron la conversación, se les envió el link de agendar o de la tienda, y no completaron la acción. Es donde se recupera la mayor cantidad de dinero.

### ⚙️ Configuración Técnica
1.  **La Landing Page de Reserva**: En lugar de enviar el link crudo de Calendly o GoHighLevel, crea una página simple en tu dominio (ej: `offszn.lat/agenda`) e incrusta el calendario mediante código HTML (Iframe/Widget).
2.  **Píxel de Meta**: Instala el Píxel en `offszn.lat/agenda` con un evento de conversión personalizado llamado `"BookingPageVisit"`.
3.  **Público Objetivo**: Personas que visitaron `offszn.lat/agenda` en los últimos 14 días.
4.  **Exclusión**: Personas que completaron la agenda (evento `"Schedule"` o página de confirmación `/gracias-agenda`).

### ✍️ Creativo y Copy del Anuncio (Vídeo de Autoridad / Beneficio)
*   **Hook**: *"¿Se te pasó agendar tu prueba de voz gratis?"*
*   **Copy**: *"Veo que entraste a la agenda pero no terminaste de reservar tu lugar. Esta semana me quedan pocos espacios libres para procesar demos de voz gratis. Si quieres escuchar cómo suena tu música con nuestra cadena premium, toca abajo, reserva tu llamada o mándame un mensaje directo hoy."*
